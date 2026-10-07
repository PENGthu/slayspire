// 界面状态与对局控制：执行走法、撤销、AI 自动行动、同屏轮换遮挡、自动存档。
import { useEffect, useState } from 'preact/hooks';
import { aiMove } from '../game/ai';
import { apply, clone, createGame, decision, RuleError, STATE_VERSION } from '../game/engine';
import type { ActionId, GameOptions, GameState, Move } from '../game/types';
import { sfx } from './sound';

const SAVE_KEY = 'ark-nova/save';
const SETTINGS_KEY = 'ark-nova/settings';

export type Screen = 'menu' | 'setup' | 'game' | 'rules' | 'compendium';
export type AiSpeed = 'fast' | 'normal' | 'slow';

export interface Settings {
  aiSpeed: AiSpeed;
  sound: boolean;
  /** 同屏多人时，换人前遮住手牌 */
  cover: boolean;
}

export interface Selection {
  /** 选中的行动卡（回合开始时） */
  action: ActionId | null;
  x: number;
  /** 建造：选中的建筑与朝向 */
  build: string | null;
  orient: number;
  anchor: number | null;
  /** 选中的卡（打出动物 / 赞助 / 项目） */
  card: string | null;
  cardFrom: number;
  /** 选牌（弃牌、保留等） */
  picks: string[];
  /** 卡牌行动：从展示区选的位置 */
  displayPicks: number[];
}

export type Modal =
  | { k: 'card'; id: string }
  | { k: 'menu' }
  | { k: 'rules' }
  | { k: 'project'; id: string; fromHand: boolean; display?: number }
  | { k: 'release'; id: string; level: number; fromHand: boolean; display?: number }
  | { k: 'player'; p: number }
  | { k: 'guide' }
  | { k: 'confirm'; text: string; yes: string; onYes: () => void };

export interface Toast {
  key: number;
  text: string;
  kind: 'error' | 'info';
}

/** AI 行动的动态（右上角，几秒后消失） */
export interface FeedItem {
  key: number;
  p: number;
  text: string;
}

export interface AppState {
  screen: Screen;
  g: GameState | null;
  view: number;
  sel: Selection;
  undo: GameState[];
  thinking: boolean;
  modal: Modal | null;
  toasts: Toast[];
  feed: FeedItem[];
  /** 刚刚建成或放入动物的建筑（短暂高亮） */
  fresh: number[];
  /** 同屏多人：遮挡中，等待该玩家确认 */
  cover: number | null;
  lastHuman: number | null;
  tab: 'public' | 'players' | 'log';
  mobileTab: 'zoo' | 'hand' | 'public' | 'players' | 'log';
  settings: Settings;
  hasSave: boolean;
}

function loadSettings(): Settings {
  const def: Settings = { aiSpeed: 'normal', cover: true, sound: true };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...def, ...JSON.parse(raw) } : def;
  } catch {
    return def;
  }
}

export function emptySel(): Selection {
  return { action: null, x: 0, build: null, orient: 0, anchor: null, card: null, cardFrom: -1, picks: [], displayPicks: [] };
}

export const state: AppState = {
  screen: 'menu',
  g: null,
  view: 0,
  sel: emptySel(),
  undo: [],
  thinking: false,
  modal: null,
  toasts: [],
  feed: [],
  fresh: [],
  cover: null,
  lastHuman: null,
  tab: 'public',
  mobileTab: 'zoo',
  settings: loadSettings(),
  hasSave: hasSavedGame(),
};

const listeners = new Set<() => void>();
let version = 0;

export function refresh() {
  version++;
  for (const l of listeners) l();
}

export function set(patch: Partial<AppState>) {
  Object.assign(state, patch);
  refresh();
}

export function useStore(): AppState {
  const [, setV] = useState(0);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return state;
}

let toastKey = 0;
export function toast(text: string, kind: Toast['kind'] = 'info') {
  const key = ++toastKey;
  state.toasts = [...state.toasts.slice(-3), { key, text, kind }];
  refresh();
  setTimeout(() => {
    state.toasts = state.toasts.filter((t) => t.key !== key);
    refresh();
  }, kind === 'error' ? 3200 : 2400);
}

export function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  } catch {
    /* 忽略 */
  }
}

// ———————————————————————————————————————————— 存档

function hasSavedGame(): boolean {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

function persist() {
  try {
    if (state.g && !state.g.over) localStorage.setItem(SAVE_KEY, JSON.stringify(state.g));
    else localStorage.removeItem(SAVE_KEY);
    state.hasSave = !!state.g && !state.g.over;
  } catch {
    /* 存储不可用时忽略 */
  }
}

export function loadSaved(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as GameState;
    if (g.v !== STATE_VERSION) return null;
    return g;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* 忽略 */
  }
  state.hasSave = false;
}

// ———————————————————————————————————————————— 对局控制

export function humans(g: GameState): number[] {
  return g.players.map((p, i) => (p.ai ? -1 : i)).filter((i) => i >= 0);
}

/** 界面上代表“我”的玩家：正在决定的人类玩家，否则最近一次行动的人类玩家 */
export function me(): number {
  const g = state.g;
  if (!g) return 0;
  const f = decision(g);
  if (f && !g.players[f.p].ai) return f.p;
  if (state.lastHuman !== null) return state.lastHuman;
  return humans(g)[0] ?? 0;
}

const GUIDE_KEY = 'ark-nova/guide-seen';

export function guideSeen(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) === '1';
  } catch {
    return true;
  }
}

export function markGuideSeen() {
  try {
    localStorage.setItem(GUIDE_KEY, '1');
  } catch {
    /* 忽略 */
  }
}

export function startGame(opts: GameOptions) {
  const g = createGame(opts);
  state.g = g;
  state.screen = 'game';
  state.undo = [];
  state.sel = emptySel();
  state.modal = null;
  state.cover = null;
  state.lastHuman = null;
  state.view = humans(g)[0] ?? 0;
  if (!guideSeen()) state.modal = { k: 'guide' };
  afterChange();
}

export function resumeGame(g: GameState) {
  state.g = g;
  state.screen = 'game';
  state.undo = [];
  state.sel = emptySel();
  state.modal = null;
  state.cover = null;
  state.lastHuman = null;
  state.view = humans(g)[0] ?? 0;
  afterChange();
}

/** 执行一步（失败时提示原因，不改变状态） */
export function act(m: Move): boolean {
  const g = state.g;
  if (!g) return false;
  const f = decision(g);
  if (!f) return false;
  const next = clone(g);
  try {
    apply(next, m);
  } catch (e) {
    sfx('error');
    if (e instanceof RuleError) toast(e.message, 'error');
    else {
      console.error(e);
      toast(`出错了：${(e as Error).message}`, 'error');
    }
    return false;
  }
  const human = !g.players[f.p].ai;
  if (!human) pushFeed(g, next, f.p);
  markFresh(g, next);
  playFor(g, next, f.p);
  if (human) {
    state.undo = [...state.undo.slice(-40), g];
    state.lastHuman = f.p;
  } else state.undo = [];
  state.g = next;
  state.sel = emptySel();
  afterChange();
  return true;
}

/** 找出这一步新建的建筑、新放入动物的建筑 */
function markFresh(before: GameState, after: GameState) {
  const fresh: number[] = [];
  after.players.forEach((p, i) => {
    const old = new Map(before.players[i].buildings.map((b) => [b.uid, b.animals.length]));
    for (const b of p.buildings) {
      const n = old.get(b.uid);
      if (n === undefined || n !== b.animals.length) fresh.push(b.uid);
    }
  });
  if (!fresh.length) return;
  state.fresh = fresh;
  setTimeout(() => {
    if (state.fresh === fresh) {
      state.fresh = [];
      refresh();
    }
  }, 1400);
}

/** 根据这一步的变化播放音效 */
function playFor(before: GameState, after: GameState, pi: number) {
  const a = after.players[pi];
  const b = before.players[pi];
  if (after.over && !before.over) return sfx('end');
  if (a.cp > b.cp) return sfx('cp');
  if (a.stats.animals > b.stats.animals) return sfx('animal');
  if (a.buildings.length > b.buildings.length) return sfx('build');
  if (a.appeal > b.appeal) return sfx('appeal');
  if (after.breaks > before.breaks) return sfx('coin');
  if (a.hand.length > b.hand.length) return sfx('card');
  if (a.money > b.money) return sfx('coin');
  sfx('click');
}

let feedKey = 0;

/** 把 AI 这一步产生的日志放进动态栏 */
function pushFeed(before: GameState, after: GameState, p: number) {
  const last = before.log[before.log.length - 1];
  let start = 0;
  if (last) {
    for (let i = after.log.length - 1; i >= 0; i--) {
      const l = after.log[i];
      if (l.text === last.text && l.turn === last.turn && l.p === last.p) {
        start = i + 1;
        break;
      }
    }
  }
  const fresh = after.log.slice(start).filter((l) => l.p === p);
  if (!fresh.length) return;
  const items = fresh.slice(0, 4).map((l) => ({ key: ++feedKey, p: l.p!, text: l.text }));
  state.feed = [...state.feed, ...items].slice(-6);
  const keys = new Set(items.map((x) => x.key));
  setTimeout(() => {
    state.feed = state.feed.filter((x) => !keys.has(x.key));
    refresh();
  }, 6000);
}

export function canUndo(): boolean {
  const g = state.g;
  if (!g || !state.undo.length || state.thinking) return false;
  const prev = state.undo[state.undo.length - 1];
  return prev.reveal === g.reveal;
}

export function undo() {
  if (!canUndo()) return;
  state.g = state.undo.pop()!;
  state.sel = emptySel();
  persist();
  refresh();
}

let aiTimer: ReturnType<typeof setTimeout> | null = null;

function aiDelay(sub: boolean): number {
  const base = { fast: 120, normal: 550, slow: 1100 }[state.settings.aiSpeed];
  return sub ? base * 0.6 : base;
}

/** 状态变化后：存档、切换视角、安排 AI 行动或换人遮挡 */
function afterChange() {
  const g = state.g;
  persist();
  if (!g) return refresh();
  if (g.over) {
    state.thinking = false;
    clearSave();
    return refresh();
  }
  const f = decision(g);
  if (!f) return refresh();
  const p = g.players[f.p];
  if (p.ai) {
    state.thinking = true;
    refresh();
    if (aiTimer) clearTimeout(aiTimer);
    aiTimer = setTimeout(() => {
      aiTimer = null;
      const cur = state.g;
      if (!cur || cur !== g || state.screen !== 'game') return;
      const d = decision(cur);
      if (!d || !cur.players[d.p].ai) return;
      let m: Move;
      try {
        m = aiMove(cur, cur.players[d.p].ai!);
      } catch (e) {
        console.error(e);
        m = { t: 'done' };
      }
      if (!act(m)) act({ t: 'done' });
    }, aiDelay(f.k !== 'turn'));
    return;
  }
  state.thinking = false;
  const hs = humans(g);
  if (hs.length > 1 && state.settings.cover && state.lastHuman !== null && state.lastHuman !== f.p) state.cover = f.p;
  if (state.cover === null) state.view = f.p;
  refresh();
}

export function uncover() {
  if (state.cover !== null) state.view = state.cover;
  state.cover = null;
  refresh();
}

export function quitToMenu() {
  if (aiTimer) clearTimeout(aiTimer);
  aiTimer = null;
  state.screen = 'menu';
  state.thinking = false;
  state.modal = null;
  refresh();
}

/** 调试入口 */
export function debugState() {
  return state;
}
