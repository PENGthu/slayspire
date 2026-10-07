// AI 对手：对每个候选行动做模拟（克隆状态，隐藏牌库顺序），用局面估值函数打分，选最好的。
// 行动中的子决定（放哪、打哪只、选哪项奖励）用一步模拟或启发式。
import { Rng, hashSeed } from '../core/rng';
import { BUILDINGS, buildingDef, enclosureSize } from './buildings';
import { animal, card, project, sponsor, SCORING_CARDS } from './content';
import { apply, decision, reachedEnd, scoringCp, shuffle } from './engine';
import { legalMoves } from './moves';
import {
  animalCost,
  animalOptions,
  assocMoves,
  buildableTypes,
  buildingAdjacent,
  canIgnoreCondition,
  coveredCells,
  fitsBuilding,
  handLimit,
  iconCounts,
  mapOf,
  matchesFilter,
  metric,
  placements,
  projectProgress,
  range,
  reqMet,
  sponsorError,
} from './query';
import { appealIncome, cpPoints, progress, repRange } from './rules';
import type { Ability, ActionId, AiLevel, AnimalCard, Frame, GameState, Move, Opt, PlayerState, SponsorCard } from './types';
import { ACTIONS } from './types';

/** AI 估值参数（经自我对弈调参） */
export const AI_PARAMS = {
  /** 预计一局的回合数 */
  turns: 32,
  /** 钱的价值：基础 + 随剩余回合增加的部分 */
  vmBase: 0.04,
  vmScale: 0.18,
  /** 一个行动的机会成本 */
  vpa: 2.2,
  /** 已得分的额外权重 */
  tempo: 0.5,
  /** 两步前瞻的收益折扣 */
  lookahead: 0.5,
  /** 手牌中已有围栏 / 没有围栏的动物按净收益计入的比例 */
  matched: 0.55,
  unmatched: 0.2,
  /** 每张手牌的选择价值 */
  option: 0.4,
  /** 空围栏每格的选择价值 */
  emptyCell: 0.25,
  /** 新抽到（未知）的牌的平均价值 */
  drawValue: 0.85,
  /** 升级、工人、保护项目潜力、售货亭收入的权重 */
  upgrade: 1,
  worker: 1.6,
  projects: 1,
  kiosk: 1,
};

// ———————————————————————————————————————————— 局面估值

interface Ctx {
  /** 估计的剩余回合数 */
  R: number;
  /** 估计的剩余休息次数 */
  breaks: number;
  vm: number;
  va: number;
  vr: number;
  /** 一个行动平均能换来的分数（持有的资源需要再花行动才能兑现） */
  vpa: number;
  late: (k: number) => number;
}

function context(g: GameState, pi: number): Ctx {
  // 剩余回合只看对局进度（回合数、对手的分数），不看自己的分数——否则 AI 会因为“得分会让游戏更快结束”而不愿得分
  const n = g.players.length;
  const me = g.players[pi];
  const oppProg = Math.max(0, ...g.players.filter((_, i) => i !== pi).map((p) => progress(p.appeal, p.cp)));
  const myProg = progress(me.appeal, me.cp);
  // 按回合数估计（一局约 32 回合），但离终局还远时不能让估计降到 0。
  // 注意：搜索中所有叶子局面都使用决策时（根局面）算出的这份估计，否则“得分让游戏更快结束”会反过来惩罚得分。
  let R = Math.max(AI_PARAMS.turns - me.stats.turns, (100 - Math.max(myProg, oppProg)) / 4.5, 0);
  if (n > 1) R = Math.min(R, Math.max(0, (100 - oppProg) / 4.0));
  const perBreakTurns = g.breakMax / (1.5 * Math.max(1, n));
  if (g.solo) {
    const left = (5 - g.breaks) * (g.breakMax / 1.6) - g.breakPos / 1.6;
    R = Math.max(0, Math.min(R, left));
  }
  if (g.endBy !== null) R = 0;
  R = Math.min(25, R);
  const breaks = Math.max(0, (R - (1 - g.breakPos / g.breakMax) * perBreakTurns) / perBreakTurns + 1);
  const late = (k: number) => Math.max(0, Math.min(1, R / k));
  const vm = AI_PARAMS.vmBase + AI_PARAMS.vmScale * late(10);
  const a = g.players[pi].appeal;
  const marginal = a < 10 ? 1 : a < 40 ? 0.5 : a < 70 ? 0.33 : 0;
  const va = 1 + marginal * Math.min(breaks, R / perBreakTurns) * vm;
  const vr = 0.35 * late(8);
  const vpa = AI_PARAMS.vpa * late(1.5);
  return { R, breaks: Math.min(breaks, R / perBreakTurns + 0.5), vm, va, vr, vpa, late };
}

function abilityValue(g: GameState, p: PlayerState, a: AnimalCard, ab: Ability | undefined, ctx: Ctx): number {
  if (!ab) return 0;
  const L = ctx.late(4);
  switch (ab.k) {
    case 'sprint':
      return 0.9 * ab.n * L;
    case 'hunter':
      return (1.0 + 0.15 * ab.n) * L;
    case 'perception':
      return 1.6 * L;
    case 'snap':
      return 1.3 * ab.n * L;
    case 'boost':
    case 'clever':
      return 1.0 * L;
    case 'pack':
    case 'iconic': {
      const icon = ab.k === 'pack' ? ab.cat : ab.cont;
      const have = iconCounts(p)[icon] + 1;
      return Math.min(5, have) * ctx.va;
    }
    case 'pouch':
      return 1.6;
    case 'sunbathe':
      return 0.7 * ab.n * L;
    case 'venom':
      return 0.25 * ab.n * g.players.filter((o) => o !== p && o.appeal > p.appeal + a.appeal).length;
    case 'constrict':
      return 0.6 * g.players.filter((o) => o !== p && o.appeal > p.appeal + a.appeal).length;
    case 'hypnosis':
      return g.players.length > 1 ? 1.6 * L : 0;
    case 'jump':
      return ab.n * ctx.vm + 0.2;
    case 'dig':
      return 0.4 * ab.n * L;
    case 'posture':
      return (ctx.va + 0.5) * ab.n;
    case 'resist':
      return 1.0;
    case 'assert':
      return p.buildings.some((b) => b.type === 'reptile') && p.buildings.some((b) => b.type === 'aviary') ? 0 : 3.5 * ctx.late(6);
    case 'trade':
      return 0.7 * L;
    case 'scavenge':
      return 1.0 * L;
    case 'xtoken':
      return 0.7 * ab.n * ctx.late(3);
    case 'money':
      return ab.n * ctx.vm;
  }
  return 0;
}

/** 动物打出时的净收益（扣除费用） */
function animalNet(g: GameState, p: PlayerState, a: AnimalCard, ctx: Ctx, from = -1): number {
  const cost = animalCost(g, p, a, from);
  let v = a.appeal * ctx.va + cpPoints(a.cp ?? 0) * 1.0 + (a.rep ?? 0) * (ctx.vr + 0.3) + abilityValue(g, p, a, a.ability, ctx);
  // 图标对保护项目的帮助
  v += (a.continents.length + a.categories.length) * 0.45 * ctx.late(4);
  for (const sid of p.sponsors) {
    for (const e of sponsor(sid).effects ?? []) {
      if (e.k === 'onPlay' && matchesFilter(a, e.filter)) v += gainValue(e.gain, ctx);
    }
  }
  return v - cost * ctx.vm;
}

function gainValue(gn: { money?: number; appeal?: number; cp?: number; rep?: number; x?: number; cards?: number; worker?: number; upgrade?: number }, ctx: Ctx): number {
  return (
    (gn.money ?? 0) * ctx.vm +
    (gn.appeal ?? 0) * ctx.va +
    (gn.cp ?? 0) * 2.4 +
    (gn.rep ?? 0) * (ctx.vr + 0.2) +
    (gn.x ?? 0) * 0.7 * ctx.late(3) +
    (gn.cards ?? 0) * 0.9 * ctx.late(4) +
    (gn.worker ?? 0) * 2.2 * ctx.late(8) +
    (gn.upgrade ?? 0) * 3 * ctx.late(10)
  );
}

function animalFeasibility(p: PlayerState, a: AnimalCard): number {
  if (reqMet(p, a.req)) return 1;
  let f = 1;
  for (const r of a.req ?? []) {
    if (r.k === 'rep' && p.rep < r.n) f *= p.rep + 2 >= r.n ? 0.55 : 0.25;
    if (r.k === 'upgrade' && !p.upgraded[r.action]) f *= 0.35;
    if (r.k === 'icon' && iconCounts(p)[r.icon] < r.n) f *= 0.4;
    if (r.k === 'partner' && !p.partners.includes(r.continent)) f *= 0.4;
  }
  return f;
}

function sponsorNet(g: GameState, p: PlayerState, c: SponsorCard, ctx: Ctx): number {
  let v = 0;
  if (c.gain) v += gainValue(c.gain, ctx);
  if (c.gainPer) {
    const times = Math.min(c.gainPer.max, Math.floor(metric(g, p, c.gainPer.metric) / c.gainPer.per));
    v += gainValue(c.gainPer.gain, ctx) * times;
  }
  v += c.icons.length * 0.5 * ctx.late(4);
  for (const e of c.effects ?? []) v += effectValue(g, p, e, ctx);
  if (c.building) v += c.building.shape.length * 0.6 * ctx.vm * 2; // 免费的建筑占位（覆盖奖励格）
  if (c.id === 'observation_tower') v += 2 * ctx.va;
  return v;
}

function effectValue(g: GameState, p: PlayerState, e: NonNullable<SponsorCard['effects']>[number], ctx: Ctx): number {
  const future = ctx.R / 6; // 估计未来打出的符合条件的动物数量（粗略）
  switch (e.k) {
    case 'onPlay': {
      const share = e.filter.cat || e.filter.cont ? 0.35 : 0.6;
      return gainValue(e.gain, ctx) * future * share * 2;
    }
    case 'onOtherPlay':
      return gainValue(e.gain, ctx) * future * 0.3 * (g.players.length - 1);
    case 'onBuild':
      return gainValue(e.gain, ctx) * ctx.R * 0.15;
    case 'onProject':
      return gainValue(e.gain, ctx) * ctx.R * 0.12;
    case 'income':
      return e.money * ctx.breaks * ctx.vm;
    case 'incomePer': {
      let m = Math.floor(metric(g, p, e.metric) / e.per) * e.money + e.money * 0.5;
      if (e.max !== undefined) m = Math.min(e.max, m);
      return m * ctx.breaks * ctx.vm;
    }
    case 'discount':
      return e.n * ctx.vm * future * 0.4;
    case 'end':
      return Math.min(e.max, Math.floor(metric(g, p, e.metric) / e.per) * e.cp + 0.5) * 2.4;
    case 'handLimit':
      return 1.2 * ctx.late(6);
    case 'range':
      return 1.5 * ctx.late(6);
  }
  return 0;
}

function projectCardValue(g: GameState, p: PlayerState, id: string, ctx: Ctx): number {
  const c = project(id);
  const prog = projectProgress(g, p, c);
  let best = 0;
  for (const lv of c.levels) {
    if (prog >= lv.need) best = Math.max(best, lv.cp * 2.4 * 0.6);
    else best = Math.max(best, lv.cp * 2.4 * 0.25 * (prog / lv.need) ** 2);
  }
  return best * ctx.late(4);
}

/** 单张卡在手牌中的价值（用于弃牌、保留、选择） */
export function cardValue(g: GameState, pi: number, id: string, ctx = context(g, pi)): number {
  const p = g.players[pi];
  const c = card(id);
  if (c.kind === 'animal') {
    const net = animalNet(g, p, c, ctx);
    const fit = p.buildings.some((b) => b.animals.length === 0 && fitsBuilding(p, c, b)) || (c.special && p.buildings.some((b) => fitsBuilding(p, c, b)));
    const encl = fit ? ctx.vpa : (c.size > 0 ? c.size * 2 * ctx.vm : 6 * ctx.vm) + 2 * ctx.vpa;
    return (Math.max(0, net * animalFeasibility(p, c) - encl) + 0.5) * ctx.late(3);
  }
  if (c.kind === 'sponsor') {
    const f = reqMet(p, c.req) ? 1 : 0.35;
    return (Math.max(0, sponsorNet(g, p, c, ctx) * f - ctx.vpa - c.level * 0.2) + 0.5) * ctx.late(2);
  }
  return projectCardValue(g, p, id, ctx);
}

const UPGRADE_VALUE: Record<ActionId, number> = { animals: 4.2, association: 3.4, build: 2.4, sponsors: 2.2, cards: 1.6 };

/** 手牌与空围栏：动物配对到能放下它的空建筑，扣除兑现需要的行动 */
/**
 * 做决定的 AI 此刻已知的牌（手牌与展示区）。模拟中新抽到的牌不在其中，
 * 按平均价值计算——否则 AI 会因为模拟时“碰巧抽到好牌”而高估抽牌。
 */
let knownCards: Set<string> | null = null;
let knownFor = -1;

function handPotential(g: GameState, p: PlayerState, ctx: Ctx): { total: number; matched: number } {
  const pi = g.players.indexOf(p);
  const hidden = knownCards && knownFor === pi ? p.hand.filter((id) => !knownCards!.has(id)) : [];
  if (hidden.length) {
    const visible = { ...p, hand: p.hand.filter((id) => knownCards!.has(id)) };
    const r = handPotential(g, visible, ctx);
    return { total: r.total + hidden.length * AI_PARAMS.drawValue * ctx.late(4), matched: r.matched };
  }
  const free = p.buildings.filter((b) => {
    const d = buildingDef(b.type);
    return d.kind === 'special' || (d.kind === 'enclosure' && b.animals.length === 0);
  });
  const used = new Set<number>();
  const vals: number[] = [];
  let matched = 0;
  const animals = p.hand
    .filter((id) => card(id).kind === 'animal')
    .map((id) => animal(id))
    .map((a) => ({ a, net: animalNet(g, p, a, ctx) * animalFeasibility(p, a) }))
    .sort((x, y) => y.net - x.net);
  const option = AI_PARAMS.option * ctx.late(4);
  // 按收益从高到低依次“预留”买动物的钱：钱不够的动物要等下次休息，价值打折
  let budget = p.money;
  for (const { a, net } of animals) {
    const b = free.find((x) => !used.has(x.uid) && fitsBuilding(p, a, x));
    const cost = animalCost(g, p, a, -1);
    const afford = budget >= cost ? 1 : 0.55;
    if (afford === 1) budget -= cost;
    if (b) {
      if (buildingDef(b.type).kind === 'enclosure') used.add(b.uid);
      matched++;
      vals.push(Math.max(0, net * AI_PARAMS.matched - ctx.vpa * 0.6) * afford + option);
    } else {
      const encl = a.size > 0 ? a.size * 2 * ctx.vm : 6 * ctx.vm;
      vals.push(Math.max(0, net * AI_PARAMS.unmatched - encl * 0.5 - ctx.vpa * 0.6) * afford + option);
    }
  }
  for (const id of p.hand) {
    const c = card(id);
    if (c.kind === 'sponsor') {
      const f = reqMet(p, c.req) ? 1 : 0.35;
      vals.push(Math.max(0, sponsorNet(g, p, c, ctx) * f * 0.6 - ctx.vpa * 0.7) + option);
    } else if (c.kind === 'project') vals.push(projectCardValue(g, p, id, ctx) + option * 0.6);
  }
  vals.sort((a, b) => b - a);
  const keep = handLimit(p) + 2;
  let total = vals.slice(0, keep).reduce((s, x) => s + x, 0) + vals.slice(keep).reduce((s, x) => s + x, 0) * 0.3;
  // 没被配对的空围栏：将来抽到动物时的选择价值
  for (const b of free) {
    if (used.has(b.uid)) continue;
    const d = buildingDef(b.type);
    if (d.kind === 'enclosure') total += AI_PARAMS.emptyCell * b.cells.length * ctx.late(4);
  }
  return { total, matched };
}

/** 决策时根局面的时间估计（搜索期间固定） */
let rootCtx: { pi: number; ctx: Ctx } | null = null;

function ctxFor(g: GameState, pi: number): Ctx {
  if (rootCtx && rootCtx.pi === pi && g.endBy === null) return rootCtx.ctx;
  return context(g, pi);
}

export function evaluate(g: GameState, pi: number): number {
  const p = g.players[pi];
  const ctx = ctxFor(g, pi);
  if (g.over) return (p.final?.score ?? progress(p.appeal, p.cp) - 100) * 3;
  // 已经拿到的分数比“潜力”更可靠：额外加权，让 AI 倾向于把资源兑现成分数
  let v = p.appeal * ctx.va + cpPoints(p.cp) + AI_PARAMS.tempo * (p.appeal + cpPoints(p.cp));
  // 钱的边际价值递减：剩余回合里花不完的钱不太值钱
  const cap = 12 + 5 * ctx.R;
  v += Math.min(p.money, cap) * ctx.vm + Math.max(0, p.money - cap) * ctx.vm * 0.25;
  v += Math.min(p.rep, 15) * ctx.vr + repRange(p.rep) * 0.25 * ctx.late(6);
  v += p.x * 0.6 * ctx.late(3);
  v += (p.workers - 1) * AI_PARAMS.worker * ctx.late(8);
  for (const a of ACTIONS) if (p.upgraded[a]) v += UPGRADE_VALUE[a] * AI_PARAMS.upgrade * ctx.late(10);
  // 售货亭与赞助卡带来的未来收入
  let kioskIncome = 0;
  const map = mapOf(p);
  for (const b of p.buildings) {
    if (b.type !== 'kiosk') continue;
    const adj = new Set<number>();
    for (const n of map.cells[b.cells[0]]!.nbrs) {
      const o = p.buildings.find((x) => x.cells.includes(n));
      if (o && o.type !== 'kiosk') adj.add(o.uid);
    }
    kioskIncome += adj.size;
  }
  v += kioskIncome * AI_PARAMS.kiosk * ctx.breaks * ctx.vm;
  for (const sid of p.sponsors) for (const e of sponsor(sid).effects ?? []) v += effectValue(g, p, e, ctx);

  const hand = handPotential(g, p, ctx);
  v += hand.total;

  // 保护项目的潜力（还需要一次协会行动）
  const pots: number[] = [];
  for (const bp of g.projects) {
    if (p.projects.includes(bp.id)) continue;
    const c = project(bp.id);
    const prog = projectProgress(g, p, c);
    let best = 0;
    c.levels.forEach((lv, i) => {
      if (bp.slots[i] !== null) return;
      const value = cpPoints(p.cp + lv.cp) - cpPoints(p.cp);
      if (c.goal.k === 'release') {
        if (prog >= lv.need) best = Math.max(best, (value - ctx.vpa) * 0.4);
        return;
      }
      if (prog >= lv.need) best = Math.max(best, (value - ctx.vpa) * 0.75);
      else best = Math.max(best, Math.max(0, value - ctx.vpa) * 0.35 * (prog / lv.need) ** 2);
    });
    pots.push(Math.max(0, best));
  }
  pots.sort((a, b) => b - a);
  v += pots.slice(0, 3).reduce((s, x, i) => s + x * (i === 0 ? 1 : 0.6), 0) * AI_PARAMS.projects * ctx.late(2);

  // 终局计分卡
  for (const id of p.scoring) {
    const cp = scoringCp(g, pi, id);
    v += cpPoints(p.cp + cp) - cpPoints(p.cp);
    const s = SCORING_CARDS[id];
    const next = s.tiers.find(([need]) => metric(g, p, s.metric) < need);
    if (next) v += 0.8 * ctx.late(4) * (metric(g, p, s.metric) / next[0]);
  }
  if (reachedEnd(p) && g.endBy === null) v += 2;
  return v;
}

// ———————————————————————————————————————————— 模拟

function simClone(g: GameState, rnd: Rng): GameState {
  const c = structuredClone({ ...g, log: [] });
  c.rng = (rnd.next() * 4294967296) >>> 0;
  shuffle(c, c.deck);
  return c;
}

function tryApply(g: GameState, m: Move): boolean {
  try {
    apply(g, m);
    return true;
  } catch {
    return false;
  }
}

/** 是否仍是 pi 的行动中（还没轮到下一个回合） */
function inTurn(g: GameState, pi: number): boolean {
  const f = decision(g);
  return !!f && f.p === pi && f.k !== 'turn' && !g.over;
}

/** 用启发式（不模拟）快速处理附带的小决定 */
function settle(g: GameState, pi: number, rnd: Rng) {
  let guard = 0;
  while (inTurn(g, pi) && guard++ < 40) {
    const f = decision(g)!;
    if (['build', 'animals', 'cards', 'assoc', 'sponsors'].includes(f.k)) break;
    if (!tryApply(g, heuristicMove(g, f, rnd))) {
      if (!tryApply(g, { t: 'done' })) break;
    }
  }
}

function scoreAfter(g: GameState, pi: number, m: Move, rnd: Rng): number {
  const c = simClone(g, rnd);
  if (!tryApply(c, m)) return -Infinity;
  settle(c, pi, rnd);
  return evaluate(c, pi);
}

// ———————————————————————————————————————————— 启发式

const UPGRADE_ORDER: ActionId[] = ['animals', 'association', 'build', 'sponsors', 'cards'];

function placementScore(g: GameState, p: PlayerState, type: string, cells: number[]): number {
  const map = mapOf(p);
  const covered = coveredCells(p);
  let s = 0;
  for (const i of cells) {
    const b = map.cells[i]!.bonus;
    if (b) s += { money: 2.2, card: 1.2, rep: 1.4, x: 1.0, upgrade: 4.5, worker: 3.2 }[b];
    if (map.cells[i]!.upgrade) s += 0.3;
    for (const n of map.cells[i]!.nbrs) if (covered.has(n)) s += 0.15;
    if (map.cells[i]!.border) s += 0.05;
  }
  const def = BUILDINGS[type];
  if (def.kind === 'enclosure' || def.kind === 'special') {
    const water = buildingAdjacent(p, cells, 'water');
    const rock = buildingAdjacent(p, cells, 'rock');
    const size = enclosureSize(type);
    const fake = { uid: -1, type, cells, animals: [] as string[] };
    for (const id of p.hand) {
      const c = card(id);
      if (c.kind !== 'animal') continue;
      if (fitsBuilding(p, c, fake)) {
        const exact = def.kind === 'special' ? 1 : c.size === size ? 1.6 : 0.6;
        s += exact + ((c.water ?? 0) > 0 ? 0.6 : 0) + ((c.rock ?? 0) > 0 ? 0.6 : 0);
      }
    }
    s += Math.min(2, water) * 0.25 + Math.min(2, rock) * 0.25;
  }
  if (def.kind === 'kiosk') {
    const adj = new Set<number>();
    for (const n of map.cells[cells[0]]!.nbrs) {
      const o = p.buildings.find((x) => x.cells.includes(n));
      if (o) adj.add(o.uid);
    }
    s += adj.size * 1.2;
  }
  void g;
  return s;
}

function bestPlacements(g: GameState, p: PlayerState, types: string[], k: number, ignoreTypeUpgrade = false): { type: string; cells: number[]; s: number }[] {
  const all: { type: string; cells: number[]; s: number }[] = [];
  for (const t of types) {
    const ps = placements(p, t, { ignoreTypeUpgrade });
    const scored = ps.map((cells) => ({ type: t, cells, s: placementScore(g, p, t, cells) }));
    scored.sort((a, b) => b.s - a.s);
    all.push(...scored.slice(0, k));
  }
  return all.sort((a, b) => b.s - a.s);
}

function scoringDesire(g: GameState, pi: number, id: string): number {
  const s = SCORING_CARDS[id];
  const p = g.players[pi];
  const v = metric(g, p, s.metric);
  const base: Record<string, number> = {
    s_large: 0.5,
    s_small: 0.6,
    s_science: 0.4,
    s_network: 0.6,
    s_full: 0.5,
    s_builder: 0.7,
    s_water: 0.5,
    s_rock: 0.4,
    s_sponsors: 0.5,
    s_reputation: 0.6,
    s_species: 0.6,
    s_world: 0.8,
    s_special: 0.4,
    s_kiosks: 0.5,
    s_upgrades: 0.6,
  };
  return (base[id] ?? 0.5) + v / s.tiers[1][0];
}

function chooseOptScore(g: GameState, pi: number, o: Opt): number {
  const p = g.players[pi];
  switch (o.k) {
    case 'upgrade':
      return 10 - UPGRADE_ORDER.indexOf(o.action);
    case 'worker':
      return p.workers < 2 ? 9.5 : p.workers < 3 ? 7 : 4;
    case 'tile':
      return { t_upgrade: 9, t_money: 7, t_rep: 6, t_appeal: 6.5, t_display: 6, t_enclosure: 5, t_x: 5 }[o.id] ?? 5;
    case 'boost':
      return o.action === 'animals' ? 8 : o.action === 'association' ? 7 : o.action === 'build' ? 6 : 5;
    case 'hypno':
      return g.players[o.target].actions.indexOf(o.action) + (g.players[o.target].upgraded[o.action] ? 1 : 0);
    case 'gain':
      return 5;
    case 'none':
      return 0;
  }
}

/** 不模拟的快速决定 */
function heuristicMove(g: GameState, f: NonNullable<ReturnType<typeof decision>>, rnd: Rng): Move {
  const p = g.players[f.p];
  const ctx = context(g, f.p);
  switch (f.k) {
    case 'choose': {
      let bi = 0;
      f.opts.forEach((o, i) => {
        if (chooseOptScore(g, f.p, o) > chooseOptScore(g, f.p, f.opts[bi])) bi = i;
      });
      return { t: 'choose', i: bi };
    }
    case 'pick':
      return { t: 'cards', cards: pickCards(g, f, ctx) };
    case 'display': {
      let best = -1;
      let bv = -Infinity;
      g.display.forEach((id, i) => {
        if (!f.any && i >= range(p)) return;
        const v = cardValue(g, f.p, id, ctx);
        if (v > bv) {
          bv = v;
          best = i;
        }
      });
      if (f.swap && bv <= cardValue(g, f.p, f.swap, ctx)) return { t: 'done' };
      return best >= 0 ? { t: 'take', slot: best } : { t: 'done' };
    }
    case 'place': {
      const best = bestPlacements(g, p, f.types, 1, true)[0];
      return best ? { t: 'build', type: best.type, cells: best.cells } : { t: 'done' };
    }
    default:
      void rnd;
      return { t: 'done' };
  }
}

function pickCards(g: GameState, f: Extract<Frame, { k: 'pick' }>, ctx: Ctx): string[] {
  const p = g.players[f.p];
  const pool = f.cards.length ? f.cards : p.hand;
  const min = Math.min(f.min, pool.length);
  if (f.purpose === 'scoring' || f.purpose === 'scoringKeep') {
    const best = [...pool].sort((a, b) => scoringDesire(g, f.p, b) - scoringDesire(g, f.p, a));
    return best.slice(0, min);
  }
  const val = (id: string) => cardValue(g, f.p, id, ctx);
  const byValue = [...pool].sort((a, b) => val(b) - val(a));
  switch (f.purpose) {
    case 'discard': {
      const asc = [...pool].sort((a, b) => val(a) - val(b));
      return asc.slice(0, min);
    }
    case 'keep':
    case 'setup':
      return byValue.slice(0, Math.max(min, Math.min(f.max, byValue.length)));
    case 'keepAnimal': {
      const best = byValue.find((id) => card(id).kind === 'animal' && val(id) > 0.3);
      return best ? [best] : [];
    }
    case 'sell': {
      const worth = 4 * ctx.vm;
      return [...pool].sort((a, b) => val(a) - val(b)).filter((id) => val(id) < worth).slice(0, f.max);
    }
    case 'pouch': {
      const worst = [...pool].sort((a, b) => val(a) - val(b))[0];
      return worst && val(worst) < 2 * ctx.va ? [worst] : [];
    }
    case 'dig': {
      const avg = 1.0 * ctx.late(3);
      return [...pool].sort((a, b) => val(a) - val(b)).filter((id) => val(id) < avg).slice(0, f.max);
    }
    case 'trade': {
      const worst = [...pool].sort((a, b) => val(a) - val(b))[0];
      const bestDisplay = Math.max(-Infinity, ...g.display.slice(0, range(p)).map(val));
      return worst && bestDisplay > val(worst) + 0.5 ? [worst] : [];
    }
  }
  return byValue.slice(0, min);
}

// ———————————————————————————————————————————— 行动中的决定（一步模拟）

function candidateMoves(g: GameState, f: NonNullable<ReturnType<typeof decision>>, level: AiLevel): Move[] {
  const p = g.players[f.p];
  const wide = level === 'hard' ? 10 : level === 'normal' ? 6 : 3;
  switch (f.k) {
    case 'build': {
      const types = buildableTypes(p, f);
      const best = bestPlacements(g, p, types, wide).slice(0, wide * 2);
      return [...best.map((b) => ({ t: 'build', type: b.type, cells: b.cells }) as Move), { t: 'done' }];
    }
    case 'animals': {
      if (f.left <= 0) return [{ t: 'done' }];
      const opts = animalOptions(g, f.p, f.up, canIgnoreCondition(f));
      return [...opts.map((o) => ({ t: 'animal', card: o.card, from: o.from, building: o.building }) as Move), { t: 'done' }];
    }
    case 'assoc':
      return [...assocMoves(g, f.p, f), { t: 'done' }];
    case 'sponsors': {
      const out: Move[] = [];
      const sources: [string, number][] = p.hand.map((id) => [id, -1]);
      if (f.up) g.display.forEach((id, i) => i < range(p) && sources.push([id, i]));
      for (const [id, from] of sources) {
        const c = card(id);
        if (c.kind !== 'sponsor') continue;
        if (c.building) {
          for (const b of bestPlacements(g, p, [id], 2)) {
            if (sponsorError(g, f.p, f, id, from, b.cells) === null) out.push({ t: 'sponsor', card: id, from, cells: b.cells });
          }
        } else if (sponsorError(g, f.p, f, id, from) === null) out.push({ t: 'sponsor', card: id, from });
      }
      if (f.played === 0) out.push({ t: 'sponsorMoney' });
      out.push({ t: 'done' });
      return out;
    }
    case 'cards':
      return legalMoves(g);
    default:
      return [];
  }
}

function bestSubMove(g: GameState, f: NonNullable<ReturnType<typeof decision>>, level: AiLevel, rnd: Rng): Move {
  if (!['build', 'animals', 'assoc', 'sponsors', 'cards'].includes(f.k)) {
    if (f.k === 'choose' && level !== 'easy') {
      let best = 0;
      let bv = -Infinity;
      f.opts.forEach((_, i) => {
        const v = scoreAfter(g, f.p, { t: 'choose', i }, rnd) + chooseOptScore(g, f.p, f.opts[i]) * 0.05;
        if (v > bv) {
          bv = v;
          best = i;
        }
      });
      return { t: 'choose', i: best };
    }
    return heuristicMove(g, f, rnd);
  }
  const moves = candidateMoves(g, f, level);
  let best = moves[moves.length - 1];
  let bv = -Infinity;
  for (const m of moves) {
    const v = scoreAfter(g, f.p, m, rnd);
    if (v > bv) {
      bv = v;
      best = m;
    }
  }
  return best;
}

/** 模拟一个完整的行动，返回估值 */
export function simulateTurn(g: GameState, pi: number, first: Move, level: AiLevel, rnd: Rng): number {
  const c = simClone(g, rnd);
  if (!tryApply(c, first)) return -Infinity;
  let guard = 0;
  while (inTurn(c, pi) && guard++ < 30) {
    const f = decision(c)!;
    const m = bestSubMove(c, f, level, rnd);
    if (!tryApply(c, m) && !tryApply(c, { t: 'done' })) break;
  }
  return evaluate(c, pi);
}

export function turnCandidates(g: GameState, pi: number, level: AiLevel): Move[] {
  const p = g.players[pi];
  const out: Move[] = [];
  const maxX = level === 'easy' ? Math.min(p.x, 1) : p.x;
  for (const a of ACTIONS) {
    const slot = p.actions.indexOf(a) + 1;
    for (let x = 0; x <= maxX; x++) {
      if (x > 0 && slot + x > 6) break;
      out.push({ t: 'action', action: a, x });
    }
    out.push({ t: 'xaction', action: a });
  }
  return out;
}

export interface AiThinking {
  move: Move;
  score: number;
}


export const aiDebug: { on: boolean; last: unknown } = { on: false, last: null };

/** 把模拟局面推进到下一个回合开始，并让 pi 再行动一次 */
function giveTurnBack(c: GameState, pi: number, rnd: Rng): boolean {
  let guard = 0;
  while (!c.over && guard++ < 40) {
    const f = decision(c);
    if (!f) return false;
    if (f.k === 'turn') {
      const n = c.stack.length;
      const below = c.stack[n - 2];
      f.p = pi;
      if (below && below.k === 'endTurn') below.p = pi;
      return true;
    }
    if (!tryApply(c, heuristicMove(c, f, rnd)) && !tryApply(c, { t: 'done' })) return false;
  }
  return false;
}

export function simulateLine(g: GameState, pi: number, first: Move, level: AiLevel, rnd: Rng): GameState | null {
  const c = simClone(g, rnd);
  if (!tryApply(c, first)) return null;
  let guard = 0;
  while (inTurn(c, pi) && guard++ < 30) {
    const f = decision(c)!;
    const m = bestSubMove(c, f, level, rnd);
    if (!tryApply(c, m) && !tryApply(c, { t: 'done' })) break;
  }
  return c;
}

/** 为当前需要决定的 AI 玩家选择一步 */
export function aiMove(g: GameState, level: AiLevel = 'normal'): Move {
  const f = decision(g);
  if (!f) throw new Error('当前不需要决定');
  const rnd = new Rng(hashSeed(g.rng, g.turn, g.stack.length, f.k));
  knownCards = new Set([...g.players[f.p].hand, ...g.display, ...(f.k === 'pick' ? f.cards : [])]);
  knownFor = f.p;
  rootCtx = { pi: f.p, ctx: context(g, f.p) };
  if (f.k !== 'turn') return bestSubMove(g, f, level, rnd);
  const pi = f.p;
  const cands = turnCandidates(g, pi, level);
  const samples = level === 'hard' ? 3 : level === 'normal' ? 2 : 1;
  const first = cands
    .map((m) => {
      let state: GameState | null = null;
      let total = 0;
      for (let k = 0; k < samples; k++) {
        const c = simulateLine(g, pi, m, level, rnd);
        if (!c) return { move: m, state: null, score: -Infinity };
        total += evaluate(c, pi);
        state ??= c;
      }
      return { move: m, state, score: total / samples };
    })
    .sort((a, b) => b.score - a.score);
  if (level === 'easy') {
    const top = first.filter((s) => s.score > first[0].score - 2.5).slice(0, 4);
    return rnd.pick(top).move;
  }
  // 两步前瞻：对最好的几个行动，再模拟自己的下一个行动
  // 每种行动至少展开最好的一个候选（避免“先建围栏、下回合放动物”这类两步计划被一步估值剪掉）
  const K = level === 'hard' ? 5 : 3;
  const pick = new Set(first.slice(0, K));
  const seenKind = new Set<string>();
  for (const s of first) {
    const kind = s.move.t === 'action' ? s.move.action : 'x';
    if (seenKind.has(kind) || s.score === -Infinity) continue;
    seenKind.add(kind);
    pick.add(s);
  }
  const expanded = [...pick].map((s) => {
    if (!s.state || s.state.over) return { move: s.move, score: s.score };
    const c = s.state;
    if (!giveTurnBack(c, pi, rnd)) return { move: s.move, score: s.score };
    let best = -Infinity;
    for (const m2 of turnCandidates(c, pi, level === 'hard' ? 'normal' : 'easy')) {
      const c2 = simulateLine(c, pi, m2, 'easy', rnd);
      if (c2) best = Math.max(best, evaluate(c2, pi));
    }
    // 前瞻收益打折：只看两步时，最后一步总会被拿来“兑现”最强的行动，导致关键行动被一再推迟
    return { move: s.move, score: best === -Infinity ? s.score : s.score + AI_PARAMS.lookahead * (best - s.score) };
  });
  expanded.sort((a, b) => b.score - a.score);
  if (aiDebug.on) aiDebug.last = { first: first.map((x) => ({ move: x.move, score: x.score })), expanded };
  if (level === 'normal' && expanded.length > 1 && expanded[1].score > expanded[0].score - 0.3 && rnd.chance(0.25)) return expanded[1].move;
  return expanded[0].move;
}

export { appealIncome };
