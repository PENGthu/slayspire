import { useEffect, useState } from 'preact/hooks';
import { Run } from '../game/run';
import type { CharId } from '../game/types';

const SAVE_KEY = 'spire-reforged/save';
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
}

export type Overlay =
  | null
  | { kind: 'deck'; pile: 'deck' | 'draw' | 'discard' | 'exhaust' }
  | { kind: 'settings' }
  | { kind: 'map' }
  | { kind: 'confirm'; text: string; yes: string; onYes: () => void };

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

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* 存储不可用时静默失败 */
  }
}
function safeDel(key: string) {
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
}

export function saveRun() {
  const run = state.run;
  if (!run) return;
  if (run.screen.s === 'gameover') {
    safeDel(SAVE_KEY);
    state.hasSave = false;
    return;
  }
  // 战斗中不存档：读档会回到进入战斗前的状态
  if (run.screen.s === 'combat') return;
  safeSet(SAVE_KEY, JSON.stringify(run.toJSON()));
  state.hasSave = true;
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
  state.hasSave = false;
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
