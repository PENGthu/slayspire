import { useEffect, useState } from 'preact/hooks';
import { Run } from '../game/run';
import type { CharId } from '../game/types';

const SAVE_KEY = 'spire-reforged/save';
const SAVE_TIME_KEY = 'spire-reforged/save-time';
const PROFILE_KEY = 'spire-reforged/profile';

export interface Settings {
  fast: boolean;
  sound: boolean;
}

export interface Profile {
  /** 每个角色已解锁的最高进阶 */
  maxAsc: Partial<Record<CharId, number>>;
  wins: number;
  runs: number;
  bestScore: number;
  settings: Settings;
  /** 是否已看过战斗教程 */
  tutorialSeen?: boolean;
}

export type Overlay =
  | null
  | { kind: 'deck'; pile: 'deck' | 'draw' | 'discard' | 'exhaust' }
  | { kind: 'settings' }
  | { kind: 'map' }
  | { kind: 'confirm'; text: string; yes: string; onYes: () => void }
  | { kind: 'login' }
  | { kind: 'account' }
  | { kind: 'syncConflict' };

export interface UiState {
  /** 打开操作菜单的药水栏位 */
  potionMenu: number | null;
  /** 正在选择目标的药水栏位 */
  potionTarget: number | null;
}

export interface AppState {
  view: 'menu' | 'charSelect' | 'run' | 'compendium';
  run: Run | null;
  overlay: Overlay;
  profile: Profile;
  hasSave: boolean;
  ui: UiState;
}

/** 本地存档变化时的回调（云存档用它来同步） */
export const persistHooks: { onChange: ((what: 'run' | 'profile') => void) | null } = { onChange: null };

/** 存档的概要（用于在本机和云端存档之间做选择） */
export interface RunMeta {
  char: CharId;
  act: number;
  floor: number;
  ascension: number;
  savedAt: number;
}

export function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function safeSet(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* 存储不可用时静默失败 */
  }
}
export function safeDel(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function loadProfile(): Profile {
  const def: Profile = { maxAsc: {}, wins: 0, runs: 0, bestScore: 0, settings: { fast: false, sound: true } };
  const raw = safeGet(PROFILE_KEY);
  if (!raw) return def;
  try {
    const p = JSON.parse(raw);
    return { ...def, ...p, settings: { ...def.settings, ...(p.settings ?? {}) } };
  } catch {
    return def;
  }
}

export const state: AppState = {
  view: 'menu',
  run: null,
  overlay: null,
  profile: loadProfile(),
  hasSave: !!safeGet(SAVE_KEY),
  ui: { potionMenu: null, potionTarget: null },
};

const listeners = new Set<() => void>();

export function refresh() {
  for (const l of listeners) l();
}

/** 订阅全局状态，任何 refresh() 都会触发重新渲染 */
export function useStore(): AppState {
  const [, set] = useState(0);
  useEffect(() => {
    const l = () => set((x) => x + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return state;
}

export function saveProfile() {
  safeSet(PROFILE_KEY, JSON.stringify(state.profile));
  persistHooks.onChange?.('profile');
}

/** 本机存档的原始 JSON */
export function localRunRaw(): string | null {
  return safeGet(SAVE_KEY);
}

export function runMetaOf(raw: string | null, savedAt?: number): RunMeta | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    return { char: j.char, act: j.act, floor: j.floor, ascension: j.ascension ?? 0, savedAt: savedAt ?? 0 };
  } catch {
    return null;
  }
}

export function localRunMeta(): RunMeta | null {
  return runMetaOf(localRunRaw(), Number(safeGet(SAVE_TIME_KEY) ?? 0) || 0);
}

/** 用外部（云端）存档覆盖本机存档，不触发同步 */
export function writeLocalRun(raw: string | null, savedAt = Date.now()) {
  if (raw) {
    safeSet(SAVE_KEY, raw);
    safeSet(SAVE_TIME_KEY, String(savedAt));
  } else {
    safeDel(SAVE_KEY);
    safeDel(SAVE_TIME_KEY);
  }
  state.hasSave = !!raw;
}

export function saveRun() {
  const run = state.run;
  if (!run) return;
  if (run.screen.s === 'gameover') {
    if (state.hasSave) {
      safeDel(SAVE_KEY);
      safeDel(SAVE_TIME_KEY);
      state.hasSave = false;
      persistHooks.onChange?.('run');
    }
    return;
  }
  // 战斗中不存档：读档会回到进入战斗前的状态
  if (run.screen.s === 'combat') return;
  const raw = JSON.stringify(run.toJSON());
  if (raw === safeGet(SAVE_KEY)) return;
  safeSet(SAVE_KEY, raw);
  safeSet(SAVE_TIME_KEY, String(Date.now()));
  state.hasSave = true;
  persistHooks.onChange?.('run');
}

export function loadRun(): Run | null {
  const raw = safeGet(SAVE_KEY);
  if (!raw) return null;
  try {
    return Run.fromJSON(JSON.parse(raw));
  } catch (e) {
    console.warn('读档失败', e);
    safeDel(SAVE_KEY);
    state.hasSave = false;
    return null;
  }
}

export function deleteSave() {
  safeDel(SAVE_KEY);
  safeDel(SAVE_TIME_KEY);
  state.hasSave = false;
  persistHooks.onChange?.('run');
}

let recorded = new WeakSet<Run>();

/** 执行一个改变游戏状态的操作：存档并刷新界面 */
export function act(fn: () => void) {
  try {
    fn();
  } catch (e) {
    console.error(e);
    state.run?.toast(`出错了：${(e as Error).message}`);
  }
  const run = state.run;
  if (run) {
    if (run.screen.s === 'gameover' && !recorded.has(run)) {
      recorded.add(run);
      const p = state.profile;
      p.runs++;
      p.bestScore = Math.max(p.bestScore, run.score());
      if (run.screen.win) {
        p.wins++;
        p.maxAsc[run.char] = Math.max(p.maxAsc[run.char] ?? 0, Math.min(10, run.ascension + 1));
      }
      saveProfile();
    }
    saveRun();
  }
  refresh();
}

export function startNewRun(run: Run) {
  recorded = new WeakSet();
  state.run = run;
  state.view = 'run';
  state.overlay = null;
  act(() => {});
}

export function setOverlay(o: Overlay) {
  state.overlay = o;
  refresh();
}

export function confirm(text: string, yes: string, onYes: () => void) {
  setOverlay({ kind: 'confirm', text, yes, onYes });
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function speed(ms: number): number {
  return state.profile.settings.fast ? Math.round(ms * 0.45) : ms;
}
