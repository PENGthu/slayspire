// 界面状态与对局控制：执行走法、撤销、AI 自动行动、同屏轮换遮挡、自动存档。
// 联机时由 net/online.ts 通过 netHooks 接入：房主广播每一步，其他玩家把走法发给房主。
import { useEffect, useState } from 'preact/hooks';
import { aiMove } from '../game/ai';
import { apply, clone, createGame, decision, RuleError, STATE_VERSION } from '../game/engine';
import type { ActionId, Frame, GameOptions, GameState, Move } from '../game/types';
import { sfx } from './sound';

const SAVE_KEY = 'ark-nova/save';
const SETTINGS_KEY = 'ark-nova/settings';

export type Screen = 'menu' | 'setup' | 'game' | 'rules' | 'compendium' | 'online' | 'lobby';
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
  | { k: 'room' }
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

/** 联机状态（界面需要的部分；房间细节在 net/online.ts） */
export interface NetView {
  role: 'host' | 'guest';
  room: string;
  link: 'connecting' | 'online' | 'offline';
  /** 我控制的玩家序号（-1：观战或还没开局） */
  seat: number;
}

export interface AppState {
  screen: Screen;
  g: GameState | null;
  view: number;
  sel: Selection;
  undo: GameState[];
  /** 每个撤销点是谁走的那一步 */
  undoBy: number[];
  net: NetView | null;
  /** 联机：还没轮到时提前选好的牌（轮到时自动提交） */
  prePick: { key: string; cards: string[] } | null;
  /** 提前选牌时的勾选（不受别人走法的影响） */
  preSel: string[];
  /** 暂时不提前选的那次选牌 */
  preSkip: string | null;
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
  undoBy: [],
  net: null,
  prePick: null,
  preSel: [],
  preSkip: null,
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
  if (state.net) return netHooks.persist?.();
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
  if (state.net) return state.net.seat >= 0 ? state.net.seat : state.view;
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
  state.net = null;
  state.screen = 'game';
  state.undo = [];
  state.undoBy = [];
  state.sel = emptySel();
  state.modal = null;
  state.cover = null;
  state.lastHuman = null;
  state.view = humans(g)[0] ?? 0;
  if (!guideSeen()) state.modal = { k: 'guide' };
  afterChange();
}

/** 联机对局开始（或中途加入）：视角固定在自己的座位 */
export function beginOnlineGame(g: GameState, seat: number) {
  state.g = g;
  state.screen = 'game';
  state.undo = [];
  state.undoBy = [];
  state.sel = emptySel();
  state.modal = !guideSeen() && seat >= 0 ? { k: 'guide' } : null;
  state.cover = null;
  state.lastHuman = null;
  state.view = Math.max(0, seat);
  afterChange();
}

export function resumeGame(g: GameState) {
  state.g = g;
  state.net = null;
  state.screen = 'game';
  state.undo = [];
  state.undoBy = [];
  state.sel = emptySel();
  state.modal = null;
  state.cover = null;
  state.lastHuman = null;
  state.view = humans(g)[0] ?? 0;
  afterChange();
}

/** 联机模块接入的钩子 */
export const netHooks: {
  /** 一步走法生效之后（local：本机做出的走法，含房主的 AI） */
  commit?: (prev: GameState, next: GameState, by: number, m: Move, local: boolean) => void;
  /** 本机暂时不能行动的原因（同步中、断线） */
  blocked?: () => string | null;
  canUndo?: () => boolean;
  undo?: () => void;
  persist?: () => void;
} = {};

/** 执行一步（失败时提示原因，不改变状态） */
export function act(m: Move): boolean {
  const g = state.g;
  if (!g) return false;
  const f = decision(g);
  if (!f) return false;
  const why = state.net ? netHooks.blocked?.() : null;
  if (why) {
    sfx('error');
    toast(why, 'error');
    return false;
  }
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
  commit(g, next, f.p, m, true);
  return true;
}

/** 房主执行其他玩家发来的走法：成功返回 null，否则返回原因 */
export function actRemote(m: Move, by: number): string | null {
  const g = state.g;
  if (!g) return '对局还没开始';
  const f = decision(g);
  if (!f || f.p !== by || g.players[by].ai) return '现在不是你的回合';
  const next = clone(g);
  try {
    apply(next, m);
  } catch (e) {
    if (e instanceof RuleError) return e.message;
    console.error(e);
    return `出错了：${(e as Error).message}`;
  }
  commit(g, next, by, m, false);
  return null;
}

function commit(g: GameState, next: GameState, by: number, m: Move, local: boolean) {
  effects(g, next, by);
  if (!g.players[by].ai) {
    state.undo = [...state.undo.slice(-40), g];
    state.undoBy = [...state.undoBy.slice(-40), by];
    state.lastHuman = by;
  } else {
    state.undo = [];
    state.undoBy = [];
  }
  state.g = next;
  state.sel = emptySel();
  netHooks.commit?.(g, next, by, m, local);
  afterChange(g);
}

/** 联机的其他玩家：收到房主确认的新局面（m 为空表示整体同步） */
export function receive(next: GameState, m?: Move, by?: number) {
  const prev = state.g;
  if (prev && m && by !== undefined) effects(prev, next, by);
  state.g = next;
  state.undo = [];
  state.undoBy = [];
  state.sel = emptySel();
  afterChange(prev);
}

/** 动态栏、高亮、音效 */
function effects(before: GameState, after: GameState, by: number) {
  const mine = state.net ? by === state.net.seat : !before.players[by].ai;
  if (!mine) pushFeed(before, after, by);
  markFresh(before, after);
  playFor(before, after, by);
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
  if (state.net) return netHooks.canUndo?.() ?? false;
  const g = state.g;
  if (!g || !state.undo.length || state.thinking) return false;
  const prev = state.undo[state.undo.length - 1];
  return prev.reveal === g.reveal;
}

export function undo() {
  if (state.net) return netHooks.undo?.();
  if (!canUndo()) return;
  state.g = state.undo.pop()!;
  state.undoBy.pop();
  state.sel = emptySel();
  persist();
  refresh();
}

/** 现在能撤销上一步的玩家（-1：没有）。撤销点之后不能翻开过新信息，AI 行动时也不行 */
export function undoSeat(): number {
  const g = state.g;
  if (!g || !state.undo.length) return -1;
  const f = decision(g);
  if (!f || g.players[f.p].ai) return -1;
  if (state.undo[state.undo.length - 1].reveal !== g.reveal) return -1;
  return state.undoBy[state.undoBy.length - 1] ?? -1;
}

/** 房主：撤销某个玩家的上一步 */
export function undoFor(by: number): boolean {
  if (undoSeat() !== by) return false;
  state.g = state.undo.pop()!;
  state.undoBy.pop();
  state.sel = emptySel();
  afterChange();
  return true;
}

/** 房主：切换某个座位的 AI 托管（局面整体替换） */
export function setSeatAi(i: number, ai: GameState['players'][number]['ai']) {
  const g = state.g;
  if (!g) return;
  const next = clone(g);
  next.players[i].ai = ai;
  state.g = next;
  state.undo = [];
  state.undoBy = [];
  afterChange(g);
}

let aiTimer: { cancel(): void } | null = null;

/** 延迟执行。页面在后台时浏览器会把定时器放慢到每分钟一次（联机房主的 AI 会卡住），这时改用消息队列立即执行 */
function later(fn: () => void, ms: number): { cancel(): void } {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && typeof MessageChannel !== 'undefined') {
    let live = true;
    const ch = new MessageChannel();
    ch.port1.onmessage = () => {
      ch.port1.close();
      if (live) fn();
    };
    ch.port2.postMessage(0);
    return { cancel: () => (live = false) };
  }
  const t = setTimeout(fn, ms);
  return { cancel: () => clearTimeout(t) };
}

function aiDelay(sub: boolean): number {
  const base = { fast: 120, normal: 550, slow: 1100 }[state.settings.aiSpeed];
  return sub ? base * 0.6 : base;
}

/** 状态变化后：存档、切换视角、安排 AI 行动或换人遮挡 */
function afterChange(prev?: GameState | null) {
  const g = state.g;
  persist();
  if (!g) return refresh();
  if (g.over) {
    state.thinking = false;
    if (!state.net) clearSave();
    return refresh();
  }
  const f = decision(g);
  if (!f) return refresh();
  const p = g.players[f.p];
  if (p.ai) {
    state.thinking = true;
    refresh();
    // 联机时只有房主运行 AI
    if (state.net?.role === 'guest') return;
    aiTimer?.cancel();
    aiTimer = later(() => {
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
  if (state.net) {
    if (f.p === state.net.seat && f.k === 'pick' && state.prePick) {
      // 提前选好的牌：轮到时自动提交
      const pre = state.prePick;
      state.prePick = null;
      state.preSel = [];
      if (pre.key === pickKey(g, f)) {
        later(() => {
          if (state.g === g) act({ t: 'cards', cards: pre.cards });
        }, 150);
        return refresh();
      }
    }
    if (f.p === state.net.seat) {
      const pf = prev ? decision(prev) : null;
      const already = !!prev && !!pf && pf.p === f.p && !prev.players[pf.p].ai;
      if (!already) {
        state.view = f.p;
        notifyTurn();
      }
    }
    return refresh();
  }
  const hs = humans(g);
  if (hs.length > 1 && state.settings.cover && state.lastHuman !== null && state.lastHuman !== f.p) state.cover = f.p;
  if (state.cover === null) state.view = f.p;
  refresh();
}

type PickFrame = Extract<Frame, { k: 'pick' }>;

/** 一次选牌的标识（同一次选牌在各个局面里相同） */
export function pickKey(g: GameState, f: PickFrame): string {
  return [f.purpose, f.p, f.min, f.max, f.cards.join(','), f.cards.length ? '' : g.players[f.p].hand.join(','), g.breaks].join('|');
}

/** 联机：排在后面、轮到我时才处理的选牌（开局选牌、休息弃牌、保留终局计分卡），可以提前选 */
export function pendingPick(g: GameState): PickFrame | null {
  const seat = state.net?.seat ?? -1;
  if (seat < 0 || g.over || g.players[seat].ai) return null;
  const top = decision(g);
  if (top && top.p === seat) return null;
  for (let i = g.stack.length - 1; i >= 0; i--) {
    const f = g.stack[i];
    if (f.k === 'pick' && f.p === seat && (f.purpose === 'setup' || f.purpose === 'discard' || f.purpose === 'scoringKeep')) return f;
    // 只看紧接着的一串选牌，不往更后面的回合里找
    if (f.k !== 'pick') break;
  }
  return null;
}

/** 联机：轮到我时提醒（音效、震动、标签页标题） */
function notifyTurn() {
  sfx('turn');
  try {
    navigator.vibrate?.(120);
  } catch {
    /* 忽略 */
  }
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    const title = document.title.replace(/^【轮到你了】/, '');
    document.title = `【轮到你了】${title}`;
    const restore = () => {
      if (document.visibilityState !== 'visible') return;
      document.title = title;
      document.removeEventListener('visibilitychange', restore);
    };
    document.addEventListener('visibilitychange', restore);
  }
}

export function uncover() {
  if (state.cover !== null) state.view = state.cover;
  state.cover = null;
  refresh();
}

export function quitToMenu() {
  aiTimer?.cancel();
  aiTimer = null;
  state.net = null;
  state.screen = 'menu';
  state.thinking = false;
  state.modal = null;
  refresh();
}

/** 调试入口 */
export function debugState() {
  return state;
}
