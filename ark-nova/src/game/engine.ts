// 规则引擎：游戏状态是纯 JSON，所有变化都通过 apply(state, move) 发生。
// 需要玩家决定的事项和自动结算的步骤都放在 stack 上（栈顶先结算），
// 这样多步行动、触发的奖励、休息时的弃牌都能统一处理，AI 和界面也走同一条路径。
// 卡牌能力、赞助卡效果、放置奖励等具体效果在 effects.ts 中实现。
import { buildingDef } from './buildings';
import { animal, baseProjects, card, deckCards, project, sponsor, SCORING } from './content';
import { attachPost, breakIncome, endgameBreakdown, iconFx, playAnimalFx, recurringFx, resolveFx, tileFx } from './effects';
import { BONUS_INFO, featureCells, getMap, LEFT_INFO, type BonusId } from './maps';
import {
  animalCost,
  animalError,
  buildCost,
  buildableTypes,
  canSnap,
  cardIcons,
  continentName,
  freeWorkers,
  handLimit,
  harborActive,
  has,
  iconCounts,
  instituteActive,
  isLarge,
  isSmall,
  mapOf,
  placementError,
  placements,
  range,
  sponsorError,
  sponsorLevel,
  supportError,
  taskValue,
  unmetConditions,
  workersNeeded,
} from './query';
import {
  ACTION_INFO,
  CARDS_BREAK,
  CP_BONUSES,
  DISPLAY_SIZE,
  END_THRESHOLD,
  MAX_PARTNERS,
  MAX_REP,
  MAX_WORKERS,
  MAX_X,
  REP_BONUSES,
  REP_CAP_BASIC,
  SOLO_ROUNDS,
  START_MONEY,
  START_REP,
  TILES,
  animalsCount,
  animalsRep,
  breakLength,
  cardsDraw,
  donationCost,
  finalScore,
  progress,
  tile,
  university,
} from './rules';
import type { ActionId, Continent, Frame, Fx, Gain, GameOptions, GameState, Move, Opt, PlayerState, TaskId } from './types';
import { ACTIONS } from './types';

export const STATE_VERSION = 3;
export const PLAYER_COLORS = ['#d9534f', '#3b7dd8', '#e0a526', '#4caf6a', '#9b6ad6'];

/** 每位玩家最多回合数（防止异常对局无限进行） */
const TURN_LIMIT = 120;

type AutoKind = 'fx' | 'again' | 'finishAction' | 'animalsEnd' | 'endTurn' | 'afterTurn' | 'breakFinish' | 'begin';
const AUTO_KINDS = new Set<Frame['k']>(['fx', 'again', 'finishAction', 'animalsEnd', 'endTurn', 'afterTurn', 'breakFinish', 'begin']);

export type Decision = Exclude<Frame, { k: AutoKind }>;

export class RuleError extends Error {}

export function fail(msg: string): never {
  throw new RuleError(msg);
}

// ———————————————————————————————————————————— 随机数（状态保存在 g.rng）

export function rand(g: GameState): number {
  let t = (g.rng = (g.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function shuffle<T>(g: GameState, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand(g) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ———————————————————————————————————————————— 基础操作

export function log(g: GameState, p: number | null, text: string) {
  g.log.push({ p, text, turn: g.turn });
  if (g.log.length > 600) g.log.splice(0, g.log.length - 600);
}

export function top(g: GameState): Frame | null {
  return g.stack.length ? g.stack[g.stack.length - 1] : null;
}

export function isAuto(f: Frame): boolean {
  return AUTO_KINDS.has(f.k);
}

/** 当前等待的决定（自动步骤已全部结算） */
export function decision(g: GameState): Decision | null {
  const f = top(g);
  if (!f || isAuto(f)) return null;
  return f as Decision;
}

export function push(g: GameState, f: Frame) {
  g.stack.push(f);
}

/** 按顺序依次结算（第一个最先） */
export function queue(g: GameState, fs: Frame[]) {
  for (let i = fs.length - 1; i >= 0; i--) g.stack.push(fs[i]);
}

export function queueFx(g: GameState, pi: number, fxs: Fx[]) {
  queue(
    g,
    fxs.map((fx) => ({ k: 'fx', p: pi, fx }) as Frame),
  );
}

function pop(g: GameState) {
  g.stack.pop();
}

export function drawDeck(g: GameState, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    if (!g.deck.length) {
      if (!g.discard.length) break;
      g.deck = shuffle(g, g.discard);
      g.discard = [];
      log(g, null, '牌库用完，弃牌堆洗混成新的牌库。');
    }
    out.push(g.deck.pop()!);
  }
  if (out.length) g.reveal++;
  return out;
}

export function drawToHand(g: GameState, pi: number, n: number) {
  const cards = drawDeck(g, n);
  g.players[pi].hand.push(...cards);
  return cards;
}

export function refillDisplay(g: GameState) {
  while (g.display.length < DISPLAY_SIZE) {
    const c = drawDeck(g, 1);
    if (!c.length) break;
    g.display.push(c[0]);
  }
}

export function takeDisplay(g: GameState, slot: number): string {
  const [c] = g.display.splice(slot, 1);
  refillDisplay(g);
  return c;
}

/** 从牌库依次翻牌，直到翻到符合条件的牌；其余的牌弃掉 */
export function revealUntil(g: GameState, ok: (id: string) => boolean): string | null {
  let guard = 0;
  while (guard++ < 300) {
    const [c] = drawDeck(g, 1);
    if (!c) return null;
    if (ok(c)) return c;
    g.discard.push(c);
  }
  return null;
}

export function advanceBreak(g: GameState, n: number) {
  g.breakPos = Math.min(g.breakMax, g.breakPos + n);
}

export function moveAction(p: PlayerState, a: ActionId, toIndex: number) {
  const i = p.actions.indexOf(a);
  if (i < 0) return;
  p.actions.splice(i, 1);
  p.actions.splice(toIndex, 0, a);
}

/** 打出动物：从手牌或展示区移走 */
function removeFromHand(p: PlayerState, id: string) {
  const i = p.hand.indexOf(id);
  if (i < 0) fail('手牌中没有这张牌');
  p.hand.splice(i, 1);
}

// ———————————————————————————————————————————— 创建对局

export function createGame(opts: GameOptions): GameState {
  const n = opts.players.length;
  if (n < 1 || n > 5) throw new Error('需要 1–5 名玩家');
  const solo = n === 1;
  const g: GameState = {
    v: STATE_VERSION,
    seed: opts.seed >>> 0,
    rng: opts.seed >>> 0,
    solo: solo ? { round: 0, left: SOLO_ROUNDS[0] } : null,
    players: [],
    deck: [],
    discard: [],
    display: [],
    projects: [],
    baseUnused: [],
    tasks: { rep: [], partner: [], university: [], project: [] },
    donationStep: 0,
    tiles: [],
    cp10: false,
    scoringPile: [],
    breakPos: 0,
    breakMax: breakLength(n),
    breaks: 0,
    current: 0,
    first: 0,
    turn: 0,
    endBy: null,
    finalLeft: [],
    over: false,
    stack: [],
    log: [],
    reveal: 0,
    nextUid: 1,
  };
  g.deck = shuffle(g, deckCards());
  g.scoringPile = shuffle(
    g,
    SCORING.map((s) => s.id),
  );
  const base = shuffle(g, baseProjects());
  for (const id of base.slice(0, 3)) g.projects.push({ id, slots: project(id).levels.map(() => null) });
  g.baseUnused = base.slice(3);
  g.tiles = shuffle(
    g,
    TILES.map((t) => t.id),
  )
    .slice(0, 4)
    .map((id, i) => ({ id, at: i < 2 ? 5 : 8, by: null }));

  opts.players.forEach((spec, i) => {
    const others = shuffle(
      g,
      ACTIONS.filter((a) => a !== 'animals'),
    );
    const p: PlayerState = {
      name: spec.name,
      ai: spec.ai,
      color: PLAYER_COLORS[i],
      map: spec.map,
      money: START_MONEY,
      appeal: solo ? Math.max(0, Math.min(20, opts.soloAppeal ?? 10)) : i,
      cp: 0,
      rep: START_REP,
      x: 0,
      workers: 1,
      actions: ['animals', ...others],
      upgraded: { animals: false, build: false, cards: false, association: false, sponsors: false },
      tokens: {},
      hand: [],
      scoring: [],
      buildings: [],
      sponsors: [],
      partners: [],
      unis: [],
      supported: [],
      mapTokens: [0, 1, 2, 3, 4, 5, 6],
      tucked: {},
      cardTokens: {},
      waza: null,
      ignoreTokens: 0,
      cpBonuses: [],
      repBonuses: [],
      donations: 0,
      harborTurn: -1,
      stats: { turns: 0, animals: 0, released: 0 },
    };
    g.players.push(p);
    // 地图 A：开局已有 1 个售货亭和 1 座空的 3 格围栏
    const map = getMap(spec.map);
    const kiosk = featureCells(map, 'startKiosk');
    const enc = featureCells(map, 'startEnclosure');
    if (kiosk.length) p.buildings.push({ uid: g.nextUid++, type: 'kiosk', cells: kiosk, animals: [] });
    if (enc.length) p.buildings.push({ uid: g.nextUid++, type: 'E3', cells: enc, animals: [] });
  });
  refillDisplay(g);

  const setup: Frame[] = [];
  g.players.forEach((p, i) => {
    setup.push({ k: 'pick', p: i, purpose: 'setup', cards: drawDeck(g, 8), min: 4, max: 4 });
    p.scoring = g.scoringPile.splice(0, 2);
  });
  queue(g, [...setup, { k: 'begin' }]);
  g.reveal = 0;
  log(
    g,
    null,
    solo
      ? `单人挑战开始：起始吸引力 ${g.players[0].appeal}，共 6 轮（每轮 ${SOLO_ROUNDS.join('/')} 个回合，每轮之后休息）。最后一次休息后得分 ≥ 0 即获胜。`
      : `游戏开始，${n} 名玩家。`,
  );
  return g;
}

// ———————————————————————————————————————————— 收益与奖励

export function gain(g: GameState, pi: number, gn: Gain) {
  const p = g.players[pi];
  if (gn.money) p.money = Math.max(0, p.money + gn.money);
  if (gn.appeal) p.appeal = Math.max(0, p.appeal + gn.appeal);
  if (gn.x) p.x = Math.min(MAX_X, p.x + gn.x);
  if (gn.worker) p.workers = Math.min(MAX_WORKERS, p.workers + gn.worker);
  if (gn.cards) drawToHand(g, pi, gn.cards);
  if (gn.upgrade) for (let i = 0; i < gn.upgrade; i++) pushUpgrade(g, pi, '升级 1 张行动卡');
  if (gn.rep) addRep(g, pi, gn.rep);
  if (gn.cp) addCp(g, pi, gn.cp);
}

export function gainText(gn: Gain): string {
  const parts: string[] = [];
  if (gn.money) parts.push(`${gn.money > 0 ? '+' : ''}${gn.money} 元`);
  if (gn.appeal) parts.push(`吸引力 +${gn.appeal}`);
  if (gn.cp) parts.push(`保护点数 +${gn.cp}`);
  if (gn.rep) parts.push(`声望 +${gn.rep}`);
  if (gn.x) parts.push(`X 标记 +${gn.x}`);
  if (gn.cards) parts.push(`抽 ${gn.cards} 张牌`);
  if (gn.worker) parts.push(`协会工人 +${gn.worker}`);
  if (gn.upgrade) parts.push('升级行动卡');
  return parts.join('，');
}

export function gainLog(g: GameState, pi: number, why: string, gn: Gain) {
  const t = gainText(gn);
  if (!t) return;
  log(g, pi, `${why}：${t}`);
  gain(g, pi, gn);
}

function upgradeOpts(p: PlayerState): Opt[] {
  return ACTIONS.filter((a) => !p.upgraded[a]).map((a) => ({ k: 'upgrade', action: a }) as Opt);
}

/** 让玩家多选一（只有一个选项时直接执行） */
export function pushChoose(g: GameState, pi: number, reason: string, opts: Opt[]) {
  if (!opts.length) return;
  if (opts.length === 1 && opts[0].k !== 'none') {
    applyOpt(g, pi, opts[0], reason);
    return;
  }
  push(g, { k: 'choose', p: pi, reason, opts });
}

export function pushUpgrade(g: GameState, pi: number, reason: string) {
  pushChoose(g, pi, reason, upgradeOpts(g.players[pi]));
}

/** 声望上限：卡牌行动升级之前为 9 */
export function repCap(p: PlayerState): number {
  return p.upgraded.cards ? MAX_REP : REP_CAP_BASIC;
}

export function addRep(g: GameState, pi: number, n: number) {
  const p = g.players[pi];
  const cap = repCap(p);
  for (let i = 0; i < n; i++) {
    if (p.rep >= cap) {
      if (cap === MAX_REP) {
        p.appeal++;
        log(g, pi, '声望已满：改为吸引力 +1');
        continue;
      }
      log(g, pi, `声望已到 ${REP_CAP_BASIC}（升级卡牌行动之后才能继续提升）`);
      break;
    }
    p.rep++;
    const b = REP_BONUSES.find((x) => x.at === p.rep);
    if (!b || p.repBonuses.includes(b.at)) continue;
    p.repBonuses.push(b.at);
    log(g, pi, `声望达到 ${b.at}：${b.text}`);
    switch (b.bonus) {
      case 'upgrade':
        pushUpgrade(g, pi, `声望 ${b.at} 奖励：升级 1 张行动卡`);
        break;
      case 'worker':
        gain(g, pi, { worker: 1 });
        break;
      case 'card':
        push(g, { k: 'display', p: pi, n: 1, any: false, deck: true, reason: `声望 ${b.at} 奖励：从声望范围内或牌库拿 1 张牌` });
        break;
      case 'cp':
        gain(g, pi, { cp: 1 });
        break;
      case 'x':
        gain(g, pi, { x: 1 });
        break;
    }
  }
}

export function addCp(g: GameState, pi: number, n: number) {
  const p = g.players[pi];
  const before = p.cp;
  p.cp += n;
  // 一次跨过多个奖励时，低的先结算（栈顶先结算，所以倒序压栈）
  for (const t of [...CP_BONUSES].reverse()) {
    if (before >= t || p.cp < t || p.cpBonuses.includes(t)) continue;
    p.cpBonuses.push(t);
    if (t === 2) {
      const opts = upgradeOpts(p);
      if (p.workers < MAX_WORKERS) opts.push({ k: 'worker' });
      pushChoose(g, pi, '保护点数 2 奖励：升级 1 张行动卡，或获得 1 名协会工人', opts);
    } else if (t === 10) {
      if (!g.cp10) {
        g.cp10 = true;
        log(g, pi, '第一位玩家达到保护点数 10：所有玩家各弃掉 1 张终局计分卡');
        g.players.forEach((o, oi) => {
          if (o.scoring.length > 1) push(g, { k: 'pick', p: oi, purpose: 'scoringDrop', cards: [...o.scoring], min: 1, max: 1 });
        });
      }
    } else {
      const opts: Opt[] = g.tiles.filter((x) => x.at === t && x.by === null).map((x) => ({ k: 'tile', id: x.id }));
      opts.push({ k: 'gain', gain: { money: 5 } });
      pushChoose(g, pi, `保护点数 ${t} 奖励：拿 1 块奖励板块或 5 元`, opts);
    }
  }
}

export function canAddPartner(p: PlayerState, c?: Continent): boolean {
  if (c && p.partners.includes(c)) return false;
  if (p.partners.length >= MAX_PARTNERS) return false;
  if (p.partners.length >= 2 && !p.upgraded.association) return false;
  return true;
}

export function addPartner(g: GameState, pi: number, c: Continent) {
  const p = g.players[pi];
  p.partners.push(c);
  log(g, pi, `结交${continentName(c)}合作动物园`);
  if (p.partners.length === 2) pushUpgrade(g, pi, '第 2 个合作动物园：升级 1 张行动卡');
  if (p.partners.length === 3) gainLog(g, pi, '第 3 个合作动物园', { worker: 1 });
  if (p.partners.length === 4) gainLog(g, pi, '第 4 个合作动物园', { cp: 2 });
}

export function addUniversity(g: GameState, pi: number, id: string) {
  const p = g.players[pi];
  const u = university(id);
  p.unis.push(id);
  log(g, pi, `与${u.name}合作（${u.text}）`);
  if (u.rep) gain(g, pi, { rep: u.rep });
  if (p.unis.length === 2) pushUpgrade(g, pi, '第 2 所大学：升级 1 张行动卡');
  if (p.unis.length === 3) gainLog(g, pi, '第 3 所大学', { cp: 1 });
}

export function partnerOpts(p: PlayerState): Opt[] {
  if (!canAddPartner(p)) return [];
  return (['africa', 'europe', 'asia', 'americas', 'australia'] as Continent[])
    .filter((c) => !p.partners.includes(c))
    .map((c) => ({ k: 'partner', continent: c }) as Opt);
}

export function uniOpts(p: PlayerState): Opt[] {
  return ['u_hand', 'u_sci', 'u_rep'].filter((u) => !p.unis.includes(u)).map((u) => ({ k: 'university', uni: u }) as Opt);
}

export function slotOpts(p: PlayerState, to: number): Opt[] {
  return p.actions.filter((_, i) => i !== to).map((a) => ({ k: 'slot', action: a, to }) as Opt);
}

export function optText(g: GameState, o: Opt, pi = g.current): string {
  switch (o.k) {
    case 'upgrade':
      return `升级「${ACTION_INFO[o.action].name}」行动卡`;
    case 'worker':
      return '获得 1 名协会工人';
    case 'tile':
      return `${tile(o.id).name}：${tile(o.id).text}`;
    case 'gain':
      return gainText(o.gain);
    case 'hypno': {
      const t = g.players[o.target];
      return `执行 ${t.name} 的「${ACTION_INFO[o.action].name}」${t.upgraded[o.action] ? ' II' : ' I'}（强度 ${t.actions.indexOf(o.action) + 1}）`;
    }
    case 'slot':
      return `把「${ACTION_INFO[o.action].name}」放到 ${o.to + 1} 号位`;
    case 'mult':
      return `在「${ACTION_INFO[o.action].name}」上放倍增标记`;
    case 'mapToken': {
      const lb = mapOf(g.players[pi]).left[o.i];
      return `${LEFT_INFO[lb.id].icon} ${LEFT_INFO[lb.id].label}${lb.recurring ? '（之后每次休息再获得一次）' : ''}`;
    }
    case 'pilfer':
      return o.give === 'card' ? `让 ${g.players[o.thief].name} 随机抽走 1 张手牌` : `给 ${g.players[o.thief].name} 5 元`;
    case 'waza':
      return o.size === 'small' ? '小型动物（体型 ≤2）' : '大型动物（体型 ≥4）';
    case 'partner':
      return `${continentName(o.continent)}合作动物园`;
    case 'university':
      return `${university(o.uni).name}（${university(o.uni).text}）`;
    case 'bonus':
      return BONUS_INFO[o.bonus].label;
    case 'project':
      return `把「${card(o.id).name}」加入手牌`;
    case 'none':
      return '不使用';
  }
}

export function applyOpt(g: GameState, pi: number, o: Opt, reason: string) {
  const p = g.players[pi];
  switch (o.k) {
    case 'upgrade':
      p.upgraded[o.action] = true;
      log(g, pi, `${reason}：升级了「${ACTION_INFO[o.action].name}」行动卡`);
      break;
    case 'worker':
      p.workers = Math.min(MAX_WORKERS, p.workers + 1);
      log(g, pi, `${reason}：获得 1 名协会工人（共 ${p.workers} 名）`);
      break;
    case 'tile': {
      const t = g.tiles.find((x) => x.id === o.id);
      if (!t || t.by !== null) fail('这块奖励板块已被拿走');
      t.by = pi;
      log(g, pi, `${reason}：拿走「${tile(o.id).name}」（${tile(o.id).text}）`);
      queueFx(g, pi, tileFx(o.id));
      break;
    }
    case 'gain':
      gainLog(g, pi, reason, o.gain);
      break;
    case 'hypno': {
      const t = g.players[o.target];
      const str = t.actions.indexOf(o.action) + 1;
      log(g, pi, `催眠：以强度 ${str} 执行 ${t.name} 的「${ACTION_INFO[o.action].name}」行动`);
      push(g, { k: 'finishAction', p: pi, action: o.action, owner: o.target, after: [] });
      startAction(g, pi, o.action, str, t.upgraded[o.action]);
      break;
    }
    case 'slot':
      moveAction(p, o.action, o.to);
      log(g, pi, `${reason}：把「${ACTION_INFO[o.action].name}」放到 ${o.to + 1} 号位`);
      break;
    case 'mult':
      (p.tokens[o.action] ??= {}).mult = 1;
      log(g, pi, `${reason}：在「${ACTION_INFO[o.action].name}」上放 1 个倍增标记`);
      break;
    case 'mapToken': {
      const i = p.mapTokens.indexOf(o.i);
      if (i < 0) fail('这个标记已经被拿走了');
      p.mapTokens.splice(i, 1);
      const lb = mapOf(p).left[o.i];
      queueFx(g, pi, [{ t: 'left', id: lb.id }]);
      break;
    }
    case 'pilfer': {
      const thief = g.players[o.thief];
      if (o.give === 'card' && p.hand.length) {
        const k = Math.floor(rand(g) * p.hand.length);
        const [c] = p.hand.splice(k, 1);
        thief.hand.push(c);
        g.reveal++;
        log(g, pi, `被掠夺：${thief.name} 抽走 1 张手牌`);
      } else {
        const m = Math.min(5, p.money);
        p.money -= m;
        thief.money += m;
        log(g, pi, `被掠夺：给 ${thief.name} ${m} 元`);
      }
      break;
    }
    case 'waza': {
      p.waza = o.size;
      const want = (id: string) => {
        const c = card(id);
        return c.kind === 'animal' && (o.size === 'small' ? isSmall(c) : isLarge(c));
      };
      const c = revealUntil(g, want);
      if (c) p.hand.push(c);
      log(g, pi, `世界动物园协会特别任务：选择${o.size === 'small' ? '小型' : '大型'}动物${c ? `，翻到 ${card(c).name} 加入手牌` : ''}`);
      break;
    }
    case 'partner':
      if (!canAddPartner(p, o.continent)) fail('不能再结交这个合作动物园');
      addPartner(g, pi, o.continent);
      break;
    case 'university':
      if (p.unis.includes(o.uni)) fail('已经有这所大学');
      addUniversity(g, pi, o.uni);
      break;
    case 'bonus':
      queueFx(g, pi, [{ t: 'bonus', bonus: o.bonus as BonusId, border: false }]);
      break;
    case 'project': {
      const i = g.baseUnused.indexOf(o.id);
      if (i < 0) fail('这个项目已经不在了');
      g.baseUnused.splice(i, 1);
      p.hand.push(o.id);
      log(g, pi, `${reason}：把基础保护项目「${card(o.id).name}」加入手牌`);
      break;
    }
    case 'none':
      break;
  }
}

// ———————————————————————————————————————————— 建筑

export function addBuilding(g: GameState, pi: number, type: string, cells: number[]) {
  const p = g.players[pi];
  const b = { uid: g.nextUid++, type, cells: [...cells], animals: [] as string[] };
  p.buildings.push(b);
  afterBuild(g, pi, b);
  return b;
}

/** 覆盖格子后的放置奖励与相关效果 */
function afterBuild(g: GameState, pi: number, b: { type: string; cells: number[] }) {
  const p = g.players[pi];
  const map = mapOf(p);
  const def = buildingDef(b.type);
  const fxs: Fx[] = [];
  for (const i of b.cells) {
    const c = map.cells[i];
    if (c.bonus) fxs.push({ t: 'bonus', bonus: c.bonus, border: c.border });
    if (c.feature === 'hills') fxs.push({ t: 'hills' });
  }
  if (def.kind === 'pavilion') gainLog(g, pi, '凉亭', { appeal: 1 });
  for (const [sid, terrain] of [
    ['s241', 'water'],
    ['s242', 'rock'],
  ] as const) {
    if (!has(p, sid)) continue;
    const n = b.cells.filter((i) => map.cells[i].nbrs.some((x) => map.cells[x].terrain === terrain)).length;
    if (n) gainLog(g, pi, sponsor(sid).name, { money: n });
  }
  queueFx(g, pi, fxs);
}

// ———————————————————————————————————————————— 行动

export function startAction(g: GameState, pi: number, action: ActionId, str: number, up: boolean) {
  switch (action) {
    case 'animals': {
      const left = animalsCount(str, up);
      if (left <= 0) {
        log(g, pi, '强度不足，这次不能打出动物');
        break;
      }
      push(g, { k: 'animals', p: pi, str, up, left, played: 0, allSmall: true, onlySmall: false, waza228: false });
      break;
    }
    case 'build':
      push(g, { k: 'build', p: pi, str, up, budget: str, built: [], engineer: false });
      break;
    case 'cards':
      push(g, { k: 'cards', p: pi, str, up });
      break;
    case 'association':
      push(g, { k: 'assoc', p: pi, str, up, budget: str, used: [], donated: false });
      break;
    case 'sponsors':
      push(g, { k: 'sponsors', p: pi, str, up, budget: up ? str + 1 : str, played: 0 });
      break;
  }
}

/** 选择行动卡执行行动（含毒液、绞杀、倍增标记） */
function takeAction(g: GameState, pi: number, m: Extract<Move, { t: 'action' }>) {
  const p = g.players[pi];
  if (!ACTIONS.includes(m.action)) fail('未知行动');
  if (!Number.isInteger(m.x) || m.x < 0 || m.x > p.x) fail('X 标记不够');
  const tk = p.tokens[m.action] ?? {};
  if (m.mult && !tk.mult) fail('这张行动卡上没有倍增标记');
  let str = p.actions.indexOf(m.action) + 1 + m.x;
  p.x -= m.x;
  const notes: string[] = [];
  if (tk.venom) {
    delete tk.venom;
    notes.push('移除毒液标记');
  } else if (ACTIONS.some((a) => p.tokens[a]?.venom)) {
    const pay = Math.min(2, p.money);
    p.money -= pay;
    notes.push(`毒液：支付 ${pay} 元`);
  }
  if (tk.constrict) {
    delete tk.constrict;
    str = Math.max(0, str - 2);
    notes.push('绞杀：强度 −2');
  }
  push(g, { k: 'finishAction', p: pi, action: m.action, owner: pi, after: [] });
  const up = p.upgraded[m.action];
  if (m.mult) {
    delete tk.mult;
    notes.push('使用倍增标记：执行 2 次');
    push(g, { k: 'again', p: pi, action: m.action, str, up });
  }
  log(
    g,
    pi,
    `执行「${ACTION_INFO[m.action].name}」${up ? ' II' : ' I'}，强度 ${str}${m.x ? `（使用 ${m.x} 个 X 标记）` : ''}${notes.length ? `（${notes.join('，')}）` : ''}`,
  );
  startAction(g, pi, m.action, str, up);
}

function playAnimal(g: GameState, pi: number, id: string, from: number, uid: number) {
  const p = g.players[pi];
  const a = animal(id);
  const before = iconCounts(p);
  const cost = animalCost(g, p, a, from);
  p.money -= cost;
  if (from < 0) removeFromHand(p, id);
  else takeDisplay(g, from);
  const b = p.buildings.find((x) => x.uid === uid)!;
  b.animals.push(id);
  p.stats.animals++;
  log(g, pi, `打出 ${a.emoji}${a.name}（${cost} 元），放进${buildingDef(b.type).name}`);
  gain(g, pi, { appeal: a.appeal, cp: a.cp, rep: a.rep });
  if (p.waza === 'small' && isSmall(a)) gainLog(g, pi, '世界动物园协会特别任务', { appeal: 2 });
  if (p.waza === 'large' && isLarge(a)) gainLog(g, pi, '世界动物园协会特别任务', { appeal: 4 });
  const map = mapOf(p);
  const tower = featureCells(map, 'tower');
  if (tower.length && buildingDef(b.type).kind === 'enclosure' && b.cells.some((i) => map.cells[i].nbrs.some((n) => tower.includes(n))))
    gainLog(g, pi, '观景塔', { appeal: 2 });
  const fxs = playAnimalFx(g, pi, a, uid);
  queue(g, [...fxs.map((fx) => ({ k: 'fx', p: pi, fx }) as Frame), ...iconFx(g, pi, id, cardIcons(id), before)]);
}

export function playSponsor(g: GameState, pi: number, id: string, cells?: number[]) {
  const p = g.players[pi];
  const c = sponsor(id);
  const before = iconCounts(p);
  p.sponsors.push(id);
  log(g, pi, `打出赞助卡 ${c.emoji}${c.name}`);
  if (c.building && cells) addBuilding(g, pi, id, cells);
  if (c.gain) gain(g, pi, c.gain);
  queue(g, [{ k: 'fx', p: pi, fx: { t: 'sponsor', id } }, ...iconFx(g, pi, id, cardIcons(id), before)]);
}

function supportProject(g: GameState, pi: number, m: Extract<Move, { t: 'assoc'; task: 'project' }>) {
  const p = g.players[pi];
  const c = project(m.project);
  if (m.display !== undefined) {
    p.money -= m.display + 1;
    takeDisplay(g, m.display);
    g.projects.push({ id: c.id, slots: c.levels.map(() => null) });
    log(g, pi, `从展示区打出保护项目 ${c.emoji}${c.name}（${m.display + 1} 元）`);
  } else if (m.fromHand) {
    removeFromHand(p, c.id);
    g.projects.push({ id: c.id, slots: c.levels.map(() => null) });
    log(g, pi, `打出保护项目 ${c.emoji}${c.name}`);
  }
  const bp = g.projects.find((x) => x.id === c.id)!;
  if (m.release) {
    const b = p.buildings.find((x) => x.uid === m.release!.uid)!;
    b.animals.splice(b.animals.indexOf(m.release.card), 1);
    const a = animal(m.release.card);
    p.appeal = Math.max(0, p.appeal - a.appeal);
    g.discard.push(m.release.card);
    p.stats.released++;
    log(g, pi, `把 ${a.emoji}${a.name} 放归野外，吸引力 −${a.appeal}`);
  }
  for (const w of m.wild ?? []) {
    p.cardTokens[w] = (p.cardTokens[w] ?? 0) - 1;
    log(g, pi, `弃掉「${sponsor(w).name}」上的 1 个标记，当作任意 1 个图标`);
  }
  bp.slots[m.level] = pi;
  p.supported.push({ id: c.id, level: m.level });
  const lv = c.levels[m.level];
  const extra = c.goal.k === 'release' && has(p, 's224') ? 1 : 0;
  gainLog(g, pi, `支持保护项目「${c.name}」`, { cp: lv.cp + extra, rep: lv.rep });
  const opts: Opt[] = p.mapTokens.map((i) => ({ k: 'mapToken', i }) as Opt);
  pushChoose(g, pi, '拿走地图左侧的 1 个玩家标记放到项目上，获得露出的奖励', opts);
}

// ———————————————————————————————————————————— 休息、回合与终局

function startBreak(g: GameState, pi: number) {
  const fs: Frame[] = [];
  const n = g.players.length;
  for (let k = 0; k < n; k++) {
    const j = (pi + k) % n;
    const p = g.players[j];
    const over = p.hand.length - handLimit(p);
    if (over > 0) fs.push({ k: 'pick', p: j, purpose: 'discard', cards: [], min: over, max: over });
  }
  queue(g, [...fs, { k: 'breakFinish', p: pi }]);
}

function doEndTurn(g: GameState, pi: number) {
  g.players[pi].stats.turns++;
  push(g, { k: 'afterTurn', p: pi });
  if (g.solo) {
    g.solo.left--;
    if (g.solo.left <= 0) {
      log(g, pi, `第 ${g.solo.round + 1} 轮结束：休息`);
      startBreak(g, pi);
    }
  } else if (g.breakPos >= g.breakMax) {
    log(g, pi, '休息标记到达终点：触发休息');
    startBreak(g, pi);
  }
}

function doBreak(g: GameState, pi: number) {
  for (const p of g.players) {
    for (const a of ACTIONS) {
      const t = p.tokens[a];
      if (!t) continue;
      delete t.venom;
      delete t.constrict;
      delete t.mult;
    }
  }
  g.tasks = { rep: [], partner: [], university: [], project: [] };
  const gone = g.display.splice(0, 2);
  g.discard.push(...gone);
  refillDisplay(g);
  const n = g.players.length;
  for (let k = 0; k < n; k++) {
    const i = (pi + k) % n;
    const p = g.players[i];
    const inc = breakIncome(g, i);
    p.money += inc.total;
    log(g, i, `休息收入 ${inc.total} 元（${inc.parts.map((x) => `${x.label} ${x.money}`).join('，')}）`);
  }
  // 需要决定的收入（地图左侧露出的紫色奖励、赞助卡）按玩家顺序结算
  const fs: Frame[] = [];
  for (let k = 0; k < n; k++) {
    const i = (pi + k) % n;
    for (const fx of recurringFx(g, i)) fs.push({ k: 'fx', p: i, fx });
  }
  queue(g, fs);
  g.breakPos = 0;
  g.breaks++;
  if (!g.solo) gainLog(g, pi, '触发休息', { x: 1 });
  log(g, null, `第 ${g.breaks} 次休息：协会工人回到玩家手中，行动卡上的标记被清除，展示区弃掉前 2 张并补满。`);
  if (g.solo) {
    g.solo.round++;
    g.solo.left = SOLO_ROUNDS[g.solo.round] ?? 0;
  }
}

export function reachedEnd(p: PlayerState): boolean {
  return progress(p.appeal, p.cp) >= END_THRESHOLD;
}

function doAfterTurn(g: GameState, pi: number) {
  const n = g.players.length;
  if (g.solo) {
    if (reachedEnd(g.players[0]) || g.solo.round >= SOLO_ROUNDS.length || g.players[0].stats.turns >= TURN_LIMIT) {
      finishGame(g);
      return;
    }
  } else {
    if (g.endBy === null) {
      for (let k = 0; k < n; k++) {
        const j = (pi + k) % n;
        if (reachedEnd(g.players[j])) {
          g.endBy = j;
          g.finalLeft = g.players.map((_, i) => i).filter((i) => i !== j);
          log(g, j, '两个标记相遇，触发游戏结束！其他玩家各再进行 1 个回合。');
          break;
        }
      }
    } else g.finalLeft = g.finalLeft.filter((i) => i !== pi);
    const limit = g.players.every((x) => x.stats.turns >= TURN_LIMIT);
    if ((g.endBy !== null && g.finalLeft.length === 0) || limit) {
      finishGame(g);
      return;
    }
  }
  let next = (pi + 1) % n;
  if (g.endBy !== null) while (!g.finalLeft.includes(next)) next = (next + 1) % n;
  g.current = next;
  g.turn++;
  queue(g, [{ k: 'turn', p: next }, { k: 'endTurn', p: next }]);
}

function finishGame(g: GameState) {
  g.players.forEach((p, i) => {
    const breakdown = endgameBreakdown(g, i);
    const cp = breakdown.reduce((s, x) => s + x.cp, 0);
    const appeal = breakdown.reduce((s, x) => s + (x.appeal ?? 0), 0);
    p.cp += cp;
    p.appeal += appeal;
    p.final = { cp, appeal, score: finalScore(p.appeal, p.cp), breakdown };
  });
  g.over = true;
  g.stack = [];
  const order = ranking(g);
  if (g.solo) {
    const s = g.players[0].final!.score;
    log(g, null, `游戏结束！得分 ${s}，${s >= 0 ? '挑战成功！' : '挑战失败。'}`);
  } else log(g, null, `游戏结束！${order.map((i) => `${g.players[i].name} ${g.players[i].final!.score} 分`).join('，')}`);
}

/** 名次（玩家编号）：同分时比较支持过的保护项目数，再比较剩余的钱 */
export function ranking(g: GameState): number[] {
  return g.players
    .map((_, i) => i)
    .sort((a, b) => {
      const pa = g.players[a];
      const pb = g.players[b];
      const sa = pa.final?.score ?? finalScore(pa.appeal, pa.cp);
      const sb = pb.final?.score ?? finalScore(pb.appeal, pb.cp);
      return sb - sa || pb.supported.length - pa.supported.length || pb.money - pa.money;
    });
}

// ———————————————————————————————————————————— 自动步骤

export function run(g: GameState) {
  let guard = 0;
  while (!g.over) {
    if (++guard > 20000) throw new Error('自动结算陷入循环');
    const f = top(g);
    if (!f || !isAuto(f)) return;
    pop(g);
    switch (f.k) {
      case 'begin':
        g.current = g.first;
        queue(g, [{ k: 'turn', p: g.first }, { k: 'endTurn', p: g.first }]);
        log(g, null, '准备完毕，开始第 1 回合。');
        break;
      case 'fx':
        resolveFx(g, f.p, f.fx);
        break;
      case 'again':
        log(g, f.p, `倍增：再执行一次「${ACTION_INFO[f.action].name}」行动`);
        startAction(g, f.p, f.action, f.str, f.up);
        break;
      case 'finishAction':
        moveAction(g.players[f.owner], f.action, 0);
        queueFx(g, f.p, f.after);
        break;
      case 'animalsEnd':
        if (f.rep) gainLog(g, f.p, '升级的动物行动（强度 5）', { rep: f.rep });
        if (f.take228 && g.display.some((id) => card(id).kind === 'animal' && isSmall(animal(id))))
          push(g, { k: 'display', p: f.p, n: 1, any: true, deck: false, filter: 'small', reason: '世界动物园协会小型动物计划：从展示区拿 1 张小型动物' });
        break;
      case 'endTurn':
        doEndTurn(g, f.p);
        break;
      case 'breakFinish':
        doBreak(g, f.p);
        break;
      case 'afterTurn':
        doAfterTurn(g, f.p);
        break;
    }
  }
}

// ———————————————————————————————————————————— 处理玩家决定

function endAnimals(g: GameState, f: Extract<Frame, { k: 'animals' }>) {
  pop(g);
  if (f.waza228) return;
  const p = g.players[f.p];
  const bonus228 = has(p, 's228') && f.played > 0 && f.allSmall;
  push(g, { k: 'animalsEnd', p: f.p, rep: f.played > 0 ? animalsRep(f.str, f.up) : 0, take228: bonus228 });
  if (bonus228) push(g, { ...f, left: 1, onlySmall: true, waza228: true });
}

/** 动物需要忽略的条件：研究所、大型动物计划免费忽略 1 个，不够时用掉“忽略条件”奖励 */
function useIgnores(g: GameState, pi: number, id: string, uid: number) {
  const p = g.players[pi];
  const a = animal(id);
  const b = p.buildings.find((x) => x.uid === uid)!;
  const unmet = unmetConditions(p, a, b).length;
  if (!unmet) return;
  const free = (instituteActive(p) ? 1 : 0) + (has(p, 's263') && isLarge(a) ? 1 : 0);
  if (unmet > free) {
    p.ignoreTokens--;
    log(g, pi, `使用“忽略条件”奖励，忽略 ${unmet} 个条件`);
  } else log(g, pi, `忽略 ${unmet} 个条件`);
}

export function apply(g: GameState, m: Move) {
  if (g.over) fail('游戏已经结束');
  const f = decision(g);
  if (!f) fail('当前没有需要决定的事');
  const pi = f.p;
  const p = g.players[pi];
  if (m.t === 'harbor') {
    if (pi !== g.current) fail('只能在自己的回合使用商港');
    if (!harborActive(p)) fail('商港还没有启用');
    if (p.harborTurn === g.turn) fail('每回合只能使用一次商港');
    removeFromHand(p, m.card);
    g.discard.push(m.card);
    p.money += 3;
    p.harborTurn = g.turn;
    log(g, pi, `商港：弃掉 ${card(m.card).name}，获得 3 元`);
    return;
  }
  switch (f.k) {
    case 'turn':
      if (m.t === 'action') {
        pop(g);
        takeAction(g, pi, m);
      } else if (m.t === 'xaction') {
        if (!ACTIONS.includes(m.action)) fail('未知行动');
        pop(g);
        moveAction(p, m.action, 0);
        p.x = Math.min(MAX_X, p.x + 1);
        log(g, pi, `X 标记行动：把「${ACTION_INFO[m.action].name}」移到 1 号位，获得 1 个 X 标记`);
      } else fail('请选择一张行动卡');
      break;

    case 'extra':
      if (m.t === 'action') {
        if (f.only && m.action !== f.only) fail(`只能执行「${ACTION_INFO[f.only].name}」行动`);
        if (f.except && m.action === f.except) fail('需要执行另一个行动');
        pop(g);
        takeAction(g, pi, m);
      } else if (m.t === 'done') pop(g);
      else fail('请选择行动或跳过');
      break;

    case 'build':
      if (m.t === 'build') {
        if (!buildableTypes(p, f).includes(m.type)) fail('现在不能建造这种建筑');
        const err = placementError(p, m.type, m.cells);
        if (err) fail(err);
        const cost = buildCost(m.type);
        p.money -= cost;
        if (f.engineer) pop(g);
        else {
          f.budget -= m.cells.length;
          f.built.push(m.type);
          if (!f.up || f.budget <= 0) endBuild(g, f);
        }
        log(g, pi, `建造${buildingDef(m.type).name}（${cost} 元）${f.engineer ? '（工程师）' : ''}`);
        addBuilding(g, pi, m.type, m.cells);
      } else if (m.t === 'done') {
        if (f.engineer) pop(g);
        else endBuild(g, f);
      } else fail('请建造或结束');
      break;

    case 'animals':
      if (m.t === 'animal') {
        if (f.left <= 0) fail('不能再打出动物');
        const err = animalError(g, pi, m.card, m.from, m.building, f.up, f.onlySmall);
        if (err) fail(err);
        useIgnores(g, pi, m.card, m.building);
        f.left--;
        f.played++;
        if (!isSmall(animal(m.card))) f.allSmall = false;
        if (f.left === 0) endAnimals(g, f);
        playAnimal(g, pi, m.card, m.from, m.building);
      } else if (m.t === 'done') endAnimals(g, f);
      else fail('请打出动物或结束');
      break;

    case 'cards':
      if (m.t === 'draw') {
        const { draw, discard } = cardsDraw(f.str, f.up);
        const slots = [...new Set(m.display)];
        if (slots.length !== m.display.length) fail('重复的位置');
        if (slots.length && !f.up) fail('需要升级的卡牌行动才能从展示区拿牌');
        if (slots.length > draw) fail('抽牌数量超出');
        for (const s of slots) if (s < 0 || s >= Math.min(range(p), g.display.length)) fail('超出声望范围');
        pop(g);
        const taken = [...slots].sort((a, b) => b - a).map((s) => g.display.splice(s, 1)[0]);
        p.hand.push(...taken);
        refillDisplay(g);
        drawToHand(g, pi, draw - slots.length);
        advanceBreak(g, CARDS_BREAK);
        log(g, pi, `拿 ${draw} 张牌${slots.length ? `（其中 ${slots.length} 张来自展示区）` : ''}${discard ? `，弃 ${discard} 张` : ''}；休息标记前进 ${CARDS_BREAK} 格`);
        if (discard) {
          const k = Math.min(discard, p.hand.length);
          if (k) push(g, { k: 'pick', p: pi, purpose: 'discard', cards: [], min: k, max: k });
        }
      } else if (m.t === 'snap') {
        if (!canSnap(f.str, f.up)) fail('强度不足，不能精选');
        if (m.slot < 0 || m.slot >= Math.min(range(p), g.display.length)) fail('超出声望范围');
        pop(g);
        const c = takeDisplay(g, m.slot);
        p.hand.push(c);
        advanceBreak(g, CARDS_BREAK);
        log(g, pi, `精选：从展示区 ${m.slot + 1} 号位拿走 ${card(c).name}；休息标记前进 ${CARDS_BREAK} 格`);
      } else fail('请选择抽牌方式');
      break;

    case 'assoc':
      if (m.t === 'assoc') {
        const task: TaskId = m.task;
        const value = taskValue(p, task);
        if (value > f.budget) fail('任务价值超过行动强度');
        if (f.used.includes(task)) fail('同一次行动中每项任务只能做一次');
        const need = workersNeeded(g, task);
        if (freeWorkers(g, pi) < need) fail(`需要 ${need} 名空闲的协会工人`);
        if (m.task === 'partner') {
          if (!canAddPartner(p, m.continent)) fail(p.partners.length >= 2 && !p.upgraded.association ? '第 3、4 个合作动物园需要升级的协会行动' : '不能结交这个合作动物园');
        } else if (m.task === 'university') {
          if (p.unis.includes(m.uni) || !university(m.uni)) fail('已经有这所大学');
        } else if (m.task === 'project') {
          const err = supportError(g, pi, m.project, m.level, m.fromHand, m.release, m.display, f.up, m.wild ?? []);
          if (err) fail(err);
        }
        for (let i = 0; i < need; i++) g.tasks[task].push(pi);
        f.budget -= value;
        f.used.push(task);
        if (!f.up || (f.budget < 2 && (f.donated || p.money < donationCost(g.donationStep)))) pop(g);
        if (m.task === 'rep') gainLog(g, pi, '协会任务', { rep: 2 });
        else if (m.task === 'partner') addPartner(g, pi, m.continent);
        else if (m.task === 'university') addUniversity(g, pi, m.uni);
        else supportProject(g, pi, m);
      } else if (m.t === 'donate') {
        if (!f.up || f.donated) fail('不能捐款');
        const cost = donationCost(g.donationStep);
        if (p.money < cost) fail('钱不够');
        p.money -= cost;
        g.donationStep++;
        p.donations++;
        f.donated = true;
        if (f.budget < 2) pop(g);
        gainLog(g, pi, `捐款 ${cost} 元`, { cp: 1 });
      } else if (m.t === 'done') pop(g);
      else fail('请选择协会任务或结束');
      break;

    case 'sponsors':
      if (m.t === 'sponsor') {
        const err = sponsorError(g, pi, f, m.card, m.from, m.cells);
        if (err) fail(err);
        const c = sponsor(m.card);
        if (m.from >= 0) {
          p.money -= m.from + 1;
          takeDisplay(g, m.from);
        } else removeFromHand(p, m.card);
        f.budget -= sponsorLevel(p, c);
        f.played++;
        if (!f.up || f.budget <= 0) pop(g);
        playSponsor(g, pi, m.card, m.cells);
      } else if (m.t === 'sponsorMoney') {
        if (f.played > 0) fail('已经打出赞助卡');
        pop(g);
        const money = f.up ? f.str * 2 : f.str;
        p.money += money;
        advanceBreak(g, f.str);
        log(g, pi, `赞助行动改为获得 ${money} 元，休息标记前进 ${f.str} 格`);
      } else if (m.t === 'done') pop(g);
      else fail('请打出赞助卡或结束');
      break;

    case 'sponsorPay':
      if (m.t === 'sponsor') {
        if (m.from !== -1) fail('只能从手牌打出');
        const err = sponsorError(g, pi, null, m.card, -1, m.cells);
        if (err) fail(err);
        const cost = sponsorLevel(p, sponsor(m.card));
        if (p.money < cost) fail('钱不够');
        p.money -= cost;
        removeFromHand(p, m.card);
        if (f.token) p.cardTokens[f.token] = (p.cardTokens[f.token] ?? 0) - 1;
        pop(g);
        log(g, pi, `${f.reason}：支付 ${cost} 元`);
        playSponsor(g, pi, m.card, m.cells);
      } else if (m.t === 'done') pop(g);
      else fail('请选择赞助卡或跳过');
      break;

    case 'pick': {
      if (m.t !== 'cards') fail('请选择卡牌');
      const pool = f.cards.length ? f.cards : p.hand;
      const sel = m.cards;
      if (new Set(sel).size !== sel.length) fail('重复选择');
      for (const id of sel) if (!pool.includes(id)) fail('选择的卡不在可选范围内');
      const eligible = f.purpose === 'keepAnimal' ? pool.filter((id) => card(id).kind === 'animal') : pool;
      const min = Math.min(f.min, eligible.length);
      if (sel.length < min || sel.length > f.max) fail(min === f.max ? `请选择 ${f.max} 张` : `请选择 ${min}–${f.max} 张`);
      if (f.purpose === 'keepAnimal' && sel.some((id) => card(id).kind !== 'animal')) fail('只能保留动物卡');
      pop(g);
      resolvePick(g, f, sel);
      break;
    }

    case 'choose': {
      if (m.t !== 'choose') fail('请选择一项');
      const o = f.opts[m.i];
      if (!o) fail('无效的选项');
      pop(g);
      applyOpt(g, pi, o, f.reason);
      break;
    }

    case 'place':
      if (m.t === 'build') {
        if (!f.types.includes(m.type)) fail('不能建造这种建筑');
        const err = placementError(p, m.type, m.cells, { ignoreTypeUpgrade: f.ignoreUpgrade });
        if (err) fail(err);
        f.count--;
        if (f.count <= 0) pop(g);
        log(g, pi, `${f.reason}：免费建造${buildingDef(m.type).name}`);
        addBuilding(g, pi, m.type, m.cells);
        if (f.count > 0 && !f.types.some((t) => placements(p, t, { ignoreTypeUpgrade: f.ignoreUpgrade }).length)) pop(g);
      } else if (m.t === 'done') pop(g);
      else fail('请放置建筑或跳过');
      break;

    case 'display':
      if (m.t === 'take') {
        let c: string;
        if (m.slot === -1) {
          if (!f.deck) fail('不能从牌库抽');
          const d = drawDeck(g, 1);
          if (!d.length) fail('牌库已空');
          c = d[0];
          log(g, pi, `${f.reason}：从牌库抽 1 张`);
        } else {
          if (m.slot < 0 || m.slot >= g.display.length) fail('无效的位置');
          if (!f.any && m.slot >= range(p)) fail('超出声望范围');
          const id = g.display[m.slot];
          const cc = card(id);
          if (f.filter === 'sponsor' && cc.kind !== 'sponsor') fail('只能拿赞助卡');
          if (f.filter === 'small' && !(cc.kind === 'animal' && isSmall(cc))) fail('只能拿小型动物');
          c = takeDisplay(g, m.slot);
          log(g, pi, `${f.reason}：从展示区拿走 ${cc.name}`);
        }
        p.hand.push(c);
        f.n--;
        if (f.n <= 0 || (!g.display.length && !f.deck)) pop(g);
      } else if (m.t === 'done') pop(g);
      else fail('请从展示区选择一张牌');
      break;

    case 'dig':
      if (m.t === 'take') {
        if (m.slot < 0 || m.slot >= g.display.length) fail('无效的位置');
        const [c] = g.display.splice(m.slot, 1);
        g.discard.push(c);
        refillDisplay(g);
        log(g, pi, `掘地：弃掉展示区的 ${card(c).name} 并补充`);
      } else if (m.t === 'cards') {
        if (m.cards.length !== 1) fail('请选择 1 张手牌');
        removeFromHand(p, m.cards[0]);
        g.discard.push(m.cards[0]);
        drawToHand(g, pi, 1);
        log(g, pi, '掘地：弃掉 1 张手牌，再抽 1 张');
      } else if (m.t === 'done') {
        pop(g);
        break;
      } else fail('请选择');
      f.left--;
      if (f.left <= 0) pop(g);
      break;
  }
  run(g);
}

function endBuild(g: GameState, f: Extract<Frame, { k: 'build' }>) {
  const p = g.players[f.p];
  pop(g);
  if (has(p, 's217') && f.built.length && f.built.some((t) => buildingDef(t).kind !== 'special')) {
    push(g, { ...f, engineer: true });
  }
}

function resolvePick(g: GameState, f: Extract<Frame, { k: 'pick' }>, sel: string[]) {
  const pi = f.p;
  const p = g.players[pi];
  const fromHand = (ids: string[]) => {
    for (const id of ids) removeFromHand(p, id);
  };
  const rest = f.cards.filter((id) => !sel.includes(id));
  switch (f.purpose) {
    case 'discard':
      fromHand(sel);
      g.discard.push(...sel);
      log(g, pi, `弃掉 ${sel.length} 张牌`);
      break;
    case 'keep':
    case 'keepAnimal':
    case 'setup':
      p.hand.push(...sel);
      g.discard.push(...rest);
      if (f.purpose !== 'setup') log(g, pi, sel.length ? `保留 ${sel.map((id) => card(id).name).join('、')}` : '没有保留任何牌');
      break;
    case 'scoring':
      p.scoring.push(...sel);
      g.scoringPile.push(...rest);
      log(g, pi, `保留 ${sel.length} 张终局计分卡`);
      break;
    case 'scoringDrop':
      p.scoring = p.scoring.filter((id) => !sel.includes(id));
      g.scoringPile.push(...sel);
      log(g, pi, '弃掉 1 张终局计分卡');
      break;
    case 'sell':
      fromHand(sel);
      g.discard.push(...sel);
      if (sel.length) gainLog(g, pi, `日光浴：出售 ${sel.length} 张手牌`, { money: 4 * sel.length });
      break;
    case 'pouch': {
      if (!sel.length) break;
      fromHand(sel);
      const key = f.under ?? 'map';
      (p.tucked[key] ??= []).push(...sel);
      gainLog(g, pi, `育儿袋：压了 ${sel.length} 张牌`, { appeal: 2 * sel.length });
      break;
    }
    case 'harbor':
      break;
  }
}

/** 深拷贝状态（AI 模拟、撤销快照用） */
export function clone(g: GameState): GameState {
  return structuredClone(g);
}

export { attachPost, sponsorError };
