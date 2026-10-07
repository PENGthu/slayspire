// AI 对手：对每个候选行动做模拟（克隆状态，隐藏牌库顺序），用局面估值函数打分，选最好的。
// 行动中的子决定（放哪、打哪只、选哪项奖励）用一步模拟或启发式。
import { Rng, hashSeed } from '../core/rng';
import { BUILDINGS, buildingDef, enclosureSize } from './buildings';
import { animal, card, project, SCORING_CARDS } from './content';
import { bonusCells, scoringCp, scoringMetric, triggerIcon } from './effects';
import { apply, decision, reachedEnd, shuffle, type Decision } from './engine';
import { featureCells, type BonusId, type LeftBonusId } from './maps';
import { legalMoves, sponsorMoves } from './moves';
import {
  adjacentTerrain,
  animalCost,
  animalOptions,
  assocMoves,
  buildableTypes,
  cardIcons,
  coveredCells,
  fitsSpace,
  handLimit,
  harborActive,
  has,
  iconCounts,
  isLarge,
  isSmall,
  kinds,
  mapOf,
  placements,
  projectProgress,
  range,
  reqShort,
  sponsorLevel,
  terrainConnection,
  unmetDetail,
} from './query';
import { appealIncome, cpPoints, progress, repRange, SOLO_ROUNDS } from './rules';
import type { Ability, ActionId, AiLevel, AnimalCard, Building, Frame, Gain, GameState, Icon, Move, Opt, PlayerState, SponsorCard } from './types';
import { ACTIONS } from './types';

/** AI 估值参数 */
export const AI_PARAMS = {
  /** 预计一局的回合数 */
  turns: 30,
  /** 钱的价值：基础 + 随剩余回合增加的部分 */
  vmBase: 0.04,
  vmScale: 0.17,
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
  upgrade: 1,
  worker: 1.6,
  projects: 1,
  kiosk: 1,
  /** 合作动物园、大学本身的价值（不含它们带来的图标、折扣） */
  partnerVal: 2.5,
  uniVal: 2.0,
  /** 按实际进度估计剩余回合（0 = 按固定速度估计） */
  adaptive: 0,
  /** 进度会加速：观察到的平均速度乘以这个系数 */
  accel: 1.3,
};

// ———————————————————————————————————————————— 局面估值

interface Ctx {
  /** 估计的剩余回合数 */
  R: number;
  /** 估计的剩余（有用的）休息次数 */
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
  let R = Math.max(AI_PARAMS.turns - me.stats.turns, (100 - Math.max(myProg, oppProg)) / 4.5, 0);
  if (n > 1) R = Math.min(R, Math.max(0, (100 - oppProg) / 4.0));
  if (AI_PARAMS.adaptive) {
    // 每位玩家按开局以来的平均速度（会逐渐加快）估计还要多少回合到达终点，最快的那位决定对局长度
    const left = g.players.map((p) => {
      const prog = progress(p.appeal, p.cp);
      const rate = Math.max(2.5, ((prog + 14) / Math.max(5, p.stats.turns)) * AI_PARAMS.accel);
      return Math.max(0, (100 - prog) / rate);
    });
    R = Math.min(...left);
  }
  let perBreakTurns = g.breakMax / (1.5 * Math.max(1, n));
  let breaks: number;
  if (g.solo) {
    R = g.solo.left + SOLO_ROUNDS.slice(g.solo.round + 1).reduce((s, x) => s + x, 0);
    breaks = Math.max(0, SOLO_ROUNDS.length - 1 - g.solo.round);
    perBreakTurns = 4;
  } else {
    if (g.endBy !== null) R = 0;
    R = Math.min(AI_PARAMS.adaptive ? 40 : 25, R);
    breaks = Math.max(0, (R - (1 - g.breakPos / g.breakMax) * perBreakTurns) / perBreakTurns + 1);
    breaks = Math.min(breaks, R / perBreakTurns + 0.5);
  }
  const late = (k: number) => Math.max(0, Math.min(1, R / k));
  const vm = AI_PARAMS.vmBase + AI_PARAMS.vmScale * late(10);
  const a = me.appeal;
  const marginal = a < 10 ? 1 : a < 40 ? 0.5 : a < 70 ? 0.33 : 0;
  const va = 1 + marginal * Math.min(breaks, R / perBreakTurns) * vm;
  const vr = 0.35 * late(8);
  const vpa = AI_PARAMS.vpa * late(1.5);
  return { R, breaks, vm, va, vr, vpa, late };
}

function gainValue(gn: Gain, ctx: Ctx): number {
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

/** 估计今后每个回合自己打出某种图标的次数 */
const ICON_RATE: Partial<Record<Icon, number>> = {
  science: 0.12,
  africa: 0.1,
  europe: 0.1,
  asia: 0.1,
  americas: 0.1,
  australia: 0.08,
  predator: 0.1,
  herbivore: 0.12,
  bird: 0.1,
  reptile: 0.08,
  primate: 0.08,
  bear: 0.03,
  water: 0.1,
  rock: 0.08,
};

function abilityValue(g: GameState, p: PlayerState, a: AnimalCard, ab0: Ability, ctx: Ctx): number {
  const ab = g.solo ? soloSwap(ab0) : ab0;
  const L = ctx.late(4);
  const ic = iconCounts(p);
  const others = g.players.filter((o) => o !== p);
  switch (ab.k) {
    case 'sprint':
      return 0.9 * ab.n * L;
    case 'hunter':
      return (0.9 + 0.15 * ab.n) * L;
    case 'perception':
      return 1.8 * L;
    case 'snap':
      return 1.3 * ab.n * L;
    case 'boost':
    case 'clever':
      return 1.0 * L;
    case 'actionNow':
      return 2.2 * ctx.late(2);
    case 'determination':
      return 3.0 * ctx.late(2);
    case 'multiplier':
      return 2.0 * ctx.late(3);
    case 'pack':
      return (ic.predator + a.icons.filter((x) => x === 'predator').length) * ctx.va;
    case 'iconic': {
      const n = g.players.reduce((s, o) => s + iconCounts(o)[ab.cont], 0) + a.icons.filter((x) => x === ab.cont).length;
      return Math.min(8, n) * ctx.va;
    }
    case 'pouch':
      return 1.6 * Math.min(ab.n, Math.max(1, p.hand.length - 1));
    case 'sunbathe':
      return 0.6 * ab.n * L;
    case 'venom':
      return 0.5 * ab.n * others.filter((o) => o.appeal > p.appeal + a.appeal).length;
    case 'constrict':
      return 0.6 * others.filter((o) => o.appeal > p.appeal + a.appeal || o.cp > p.cp).length;
    case 'hypnosis':
      return g.players.length > 1 ? 1.8 * L : 0;
    case 'jump':
      return ab.n * ctx.vm + 0.2;
    case 'dig':
      return 0.4 * ab.n * L;
    case 'posture':
      return (ctx.va + 0.5) * ab.n;
    case 'resist':
      return 1.0;
    case 'assert':
    case 'dominance':
      return 1.5 * ctx.late(6);
    case 'scavenge':
      return 1.0 * L;
    case 'inventive':
      return 0.7 * ab.n * ctx.late(3);
    case 'inventiveBear':
      return 0.7 * Math.min(3, g.players.reduce((s, o) => s + iconCounts(o).bear, 0) + 1) * ctx.late(3);
    case 'inventivePrimate': {
      const pr = ic.primate + 1;
      return 0.7 * (pr >= 5 ? 3 : pr >= 3 ? 2 : 1) * ctx.late(3);
    }
    case 'fullThroated':
      return p.workers < 4 ? 2.2 * ctx.late(8) : 0;
    case 'sponsorMagnet':
      return 0.8 * g.display.filter((id) => card(id).kind === 'sponsor').length * L;
    case 'pilfer':
      return (ab.n > 1 ? 2 : 1) * Math.max(5 * ctx.vm, 0.9 * L);
    case 'peacock':
      return p.buildings.some((b) => b.type === 'aviary') ? 0 : 10 * ctx.vm + 1;
    case 'petting':
      return 3 * (ic.petting + 1) * ctx.va;
    case 'flock':
      return 0;
  }
  return 0;
}

function soloSwap(ab: Ability): Ability {
  if (ab.k === 'venom') return { k: 'inventive', n: ab.n };
  if (ab.k === 'constrict') return { k: 'clever' };
  if (ab.k === 'hypnosis') return { k: 'determination' };
  if (ab.k === 'pilfer') return { k: 'sprint', n: ab.n };
  return ab;
}

/** 打出一张带图标的卡时，自己 / 别人的赞助卡触发的价值（只算自己的） */
function triggerValue(p: PlayerState, icons: Icon[], ctx: Ctx): number {
  let v = 0;
  for (const sid of p.sponsors) {
    const t = triggerIcon(sid);
    if (!t) continue;
    const n = icons.filter((x) => x === t.icon).length;
    if (n) v += n * triggerUnit(sid, ctx);
  }
  return v;
}

/** 一次触发的价值 */
function triggerUnit(sid: string, ctx: Ctx): number {
  switch (sid) {
    case 's202':
      return 0.2 + ctx.vr;
    case 's204':
      return 2.4;
    case 's208':
      return 2 * ctx.vm;
    case 's210':
    case 's213':
      return 1 + 2 * ctx.vm;
    case 's211':
      return 0.8;
    case 's212':
      return 1.6;
    case 's214':
      return 0.8 * ctx.late(3);
    case 's236':
    case 's237':
    case 's238':
    case 's239':
    case 's240':
      return 3 * ctx.vm;
    case 's243':
    case 's244':
    case 's245':
    case 's246':
    case 's247':
    case 's251':
      return 2 * ctx.va;
    case 's248':
      return 0.7 * ctx.late(3);
    case 's249':
      return 1.0 * ctx.late(4);
    case 's250':
      return 1.0 * ctx.late(4);
    case 's252':
      return 1.2 * ctx.late(4);
    case 's253':
      return 1.5 * ctx.late(3);
  }
  return 0;
}

/** 动物打出时的净收益（扣除费用） */
function animalNet(g: GameState, p: PlayerState, a: AnimalCard, ctx: Ctx, from = -1): number {
  const cost = animalCost(g, p, a, from);
  let v = a.appeal * ctx.va + 2.4 * (a.cp ?? 0) + (a.rep ?? 0) * (ctx.vr + 0.3);
  for (const ab of a.abilities ?? []) v += abilityValue(g, p, a, ab, ctx);
  // 图标对保护项目、终局计分的帮助
  v += cardIcons(a.id).length * 0.45 * ctx.late(4);
  v += triggerValue(p, cardIcons(a.id), ctx);
  if (p.waza === 'small' && isSmall(a)) v += 2 * ctx.va;
  if (p.waza === 'large' && isLarge(a)) v += 4 * ctx.va;
  return v - cost * ctx.vm;
}

/** 卡牌条件还差多少（粗略的可行性） */
function feasibility(p: PlayerState, reqs: AnimalCard['req'], a?: AnimalCard): number {
  if (!reqs) return 1;
  const ic = iconCounts(p);
  let f = 1;
  for (const r of reqs) {
    const short = reqShort(p, r, ic, a);
    if (!short) continue;
    if (r.k === 'rep') f *= p.rep + 2 >= r.n ? 0.55 : 0.25;
    else if (r.k === 'upgrade') f *= 0.35;
    else if (r.k === 'appealMax') f *= 0;
    else f *= short > 1 ? 0.2 : 0.4;
  }
  return f;
}

/** 赞助卡的立即效果（估计） */
function sponsorNowValue(g: GameState, p: PlayerState, c: SponsorCard, ctx: Ctx): number {
  const ic = iconCounts(p);
  for (const i of cardIcons(c.id)) ic[i]++;
  const kindsN = (of: 'continent' | 'category') => kinds({ ...p, sponsors: [...p.sponsors, c.id] }, of);
  let v = c.gain ? gainValue(c.gain, ctx) : 0;
  const m = (x: number) => x * ctx.vm;
  const ap = (x: number) => x * ctx.va;
  switch (c.id) {
    case 's201':
    case 's254':
      v += 1.2 * ctx.late(4);
      break;
    case 's203':
      v += m([0, 2, 5, 10][p.unis.length]);
      break;
    case 's204':
      v += m(2 * ic.science);
      break;
    case 's206':
      v += ap(2 * p.supported.length);
      break;
    case 's207':
      v += 2.4 * Math.floor((kindsN('continent') + kindsN('category')) / 2);
      break;
    case 's208':
      v += ap(ic.science);
      break;
    case 's209':
    case 's224':
    case 's225':
      v += 0.7 * ctx.late(3);
      break;
    case 's210':
      v += ap(ic.americas);
      break;
    case 's211':
      v += ap(ic.europe);
      break;
    case 's212':
      v += ap(ic.australia);
      break;
    case 's213':
      v += ap(ic.asia);
      break;
    case 's214':
      v += ap(ic.africa);
      break;
    case 's215':
    case 's218':
      v += 1.5 * ctx.late(4);
      break;
    case 's216':
      v += p.workers < 4 ? 2.2 * ctx.late(8) : 0;
      break;
    case 's219':
      v += m(2 * (ic.water + ic.rock));
      break;
    case 's220':
      v += m(3);
      break;
    case 's222':
      v += 2.4 * Math.min(3, ic.science);
      break;
    case 's227':
      v += 1.2 * ctx.late(4);
      break;
    case 's228':
      v += m(2 * p.buildings.reduce((s, b) => s + b.animals.filter((id) => isSmall(animal(id))).length, 0));
      break;
    case 's229':
      v += ap(p.buildings.reduce((s, b) => s + b.animals.filter((id) => isSmall(animal(id))).length, 0));
      break;
    case 's230':
      v += ap(2 * p.buildings.reduce((s, b) => s + b.animals.filter((id) => isLarge(animal(id))).length, 0));
      break;
    case 's231':
      v += ap(ic.primate);
      break;
    case 's232':
      v += ap(ic.reptile);
      break;
    case 's233':
      v += ap(ic.bird);
      break;
    case 's234':
      v += ap(ic.predator);
      break;
    case 's235':
      v += ap(ic.herbivore);
      break;
    case 's241':
      v += ap(ic.water);
      break;
    case 's242':
      v += ap(3 * Math.floor(ic.rock / 2));
      break;
    case 's253':
      v += 1.5 * ctx.late(4);
      break;
    case 's258':
      v += ap(terrainConnection(p, 'water').connected);
      break;
    case 's259':
      v += ap(terrainConnection(p, 'rock').connected);
      break;
    case 's260':
      v += ap(3);
      break;
    case 's262':
      v += m(2 * (kindsN('continent') + kindsN('category')));
      break;
    case 's263':
      v += 10 * ctx.vm;
      break;
    case 's264':
      v += ap(bonusCells(p).connected);
      break;
  }
  // 卡上的图标、专属建筑覆盖的格子
  v += cardIcons(c.id).length * 0.5 * ctx.late(4);
  v += triggerValue(p, cardIcons(c.id), ctx);
  if (c.building) v += c.building.shape.length * 0.8 * ctx.vm * 2;
  return v;
}

/** 已打出的赞助卡在剩余对局中的持续价值（触发、收入、终局） */
function sponsorOngoing(g: GameState, p: PlayerState, id: string, ctx: Ctx): number {
  const ic = iconCounts(p);
  const t = triggerIcon(id);
  let v = 0;
  if (t) {
    const rate = (ICON_RATE[t.icon] ?? 0.08) * (t.any ? g.players.length : 1);
    v += ctx.R * rate * triggerUnit(id, ctx);
  }
  const inc = (money: number) => money * ctx.breaks * ctx.vm;
  const near = (have: number, need: number) => (have >= need ? 1 : Math.max(0, 1 - (need - have) * 0.3) * ctx.late(3));
  switch (id) {
    case 's201':
      v += 0.9 * ctx.breaks * ctx.late(3) + 2.4 * (ic.science >= 6 ? 2 : ic.science >= 3 ? 1 : near(ic.science, 3));
      break;
    case 's203':
      v += ctx.R * 0.08 * 2;
      v += 2.4 * near(p.unis.length, 3);
      break;
    case 's206':
      v += 2.4 * ctx.breaks;
      break;
    case 's209':
      v += 0.7 * ctx.breaks + 2.4 * near(p.unis.length, 3);
      break;
    case 's208':
    case 's261':
      v += 2.4 * near(kinds(p, 'category'), 5);
      break;
    case 's210':
      v += 2.4 * near(p.buildings.filter((b) => b.type === 'kiosk').length, 5);
      break;
    case 's214':
      v += p.x * ctx.va * 0.8;
      break;
    case 's215':
    case 's218':
      v += 2.4 * near(p.supported.length, 5) + (p.cardTokens[id] ?? 0) * 1.2 * ctx.late(4);
      break;
    case 's216':
    case 's220':
      v += 2.4 * near(p.rep, 9);
      if (id === 's220') v += inc(3);
      break;
    case 's217':
      v += ctx.R * 0.15 * 1.2;
      break;
    case 's219':
      v += 2 * Math.min(3, ic.water + ic.rock) * ctx.va;
      break;
    case 's221':
      v += ctx.R * 0.15;
      break;
    case 's224':
      v += ctx.R * 0.05 * 2.4;
      break;
    case 's225':
    case 's226':
      v += 2.4 * near(kinds(p, 'continent'), 5);
      break;
    case 's229':
    case 's230':
      v += ctx.R * 0.12 * (id === 's229' ? 3 : 4) * ctx.vm;
      break;
    case 's231':
    case 's232':
    case 's233':
    case 's234':
    case 's235': {
      const icon = ({ s231: 'primate', s232: 'reptile', s233: 'bird', s234: 'predator', s235: 'herbivore' } as Record<string, Icon>)[id];
      const n = ic[icon];
      v += inc(n >= 5 ? 9 : n >= 3 ? 6 : n >= 1 ? 3 : 1.5);
      break;
    }
    case 's241':
    case 's242':
      v += ctx.R * 0.3 * ctx.vm;
      break;
    case 's243':
    case 's244':
    case 's245':
    case 's246':
    case 's247': {
      const icon = ({ s243: 'herbivore', s244: 'bird', s245: 'water', s246: 'rock', s247: 'primate' } as Record<string, Icon>)[id];
      v += 2.4 * near(ic[icon], 6);
      break;
    }
    case 's251':
      v += 2.4 * (ic.bear >= 6 ? 2 : ic.bear >= 3 ? 1 : near(ic.bear, 3));
      break;
    case 's257':
      v += inc(4);
      break;
    case 's263':
      v += ctx.R * 0.06;
      break;
    case 's262':
      v += ctx.R * 0.1 * (ctx.va + 2 * ctx.vm);
      break;
  }
  return v;
}

function projectCardValue(g: GameState, p: PlayerState, id: string, ctx: Ctx): number {
  const c = project(id);
  const prog = projectProgress(p, c);
  let best = 0;
  for (const lv of c.levels) {
    const value = lv.cp * 2.4 + (lv.rep ?? 0) * ctx.vr;
    if (c.goal.k === 'release' || c.goal.k === 'breed') best = Math.max(best, prog > 0 ? value * 0.4 : value * 0.12);
    else if (prog >= lv.need) best = Math.max(best, value * 0.6);
    else best = Math.max(best, value * 0.25 * (prog / lv.need) ** 2);
  }
  return best * ctx.late(4);
}

/** 动物能否住进某座建筑（含可忽略的条件） */
function canHouse(p: PlayerState, a: AnimalCard, b: Building): boolean {
  if (!fitsSpace(p, a, b)) return false;
  // 声望、升级之类的条件以后还能补上，这里只看建筑相关的条件是否满足
  return unmetDetail(p, a, b).filter((x) => x.terrain).length <= (has(p, 's263') && isLarge(a) ? 1 : 0);
}

/** 单张卡在手牌中的价值（用于弃牌、保留、选择） */
export function cardValue(g: GameState, pi: number, id: string, ctx = context(g, pi)): number {
  const p = g.players[pi];
  const c = card(id);
  if (c.kind === 'animal') {
    const net = animalNet(g, p, c, ctx);
    const fit = p.buildings.some((b) => (buildingDef(b.type).kind !== 'enclosure' || b.animals.length === 0) && canHouse(p, c, b));
    const encl = fit ? ctx.vpa : (c.special ? 10 : c.size * 2) * ctx.vm + 2 * ctx.vpa;
    return (Math.max(0, net * feasibility(p, c.req, c) - encl) + 0.5) * ctx.late(3);
  }
  if (c.kind === 'sponsor') {
    const f = feasibility(p, c.req);
    return (Math.max(0, (sponsorNowValue(g, p, c, ctx) + sponsorOngoing(g, p, c.id, ctx)) * f - ctx.vpa - c.level * 0.2) + 0.5) * ctx.late(2);
  }
  return projectCardValue(g, p, id, ctx);
}

const UPGRADE_VALUE: Record<ActionId, number> = { animals: 4.2, association: 3.4, build: 2.6, sponsors: 2.4, cards: 2.2 };

/**
 * 做决定的 AI 此刻已知的牌（手牌与展示区）。模拟中新抽到的牌不在其中，
 * 按平均价值计算——否则 AI 会因为模拟时“碰巧抽到好牌”而高估抽牌。
 */
let knownCards: Set<string> | null = null;
let knownFor = -1;

/** 手牌与空围栏：动物配对到能放下它的空建筑，扣除兑现需要的行动 */
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
    .map((a) => ({ a, net: animalNet(g, p, a, ctx) * feasibility(p, a.req, a) }))
    .sort((x, y) => y.net - x.net);
  const option = AI_PARAMS.option * ctx.late(4);
  // 按收益从高到低依次“预留”买动物的钱：钱不够的动物要等下次休息，价值打折
  let budget = p.money;
  for (const { a, net } of animals) {
    const b = free.find((x) => !used.has(x.uid) && canHouse(p, a, x));
    const cost = animalCost(g, p, a, -1);
    const afford = budget >= cost ? 1 : 0.55;
    if (afford === 1) budget -= cost;
    if (b) {
      if (buildingDef(b.type).kind === 'enclosure') used.add(b.uid);
      matched++;
      vals.push(Math.max(0, net * AI_PARAMS.matched - ctx.vpa * 0.6) * afford + option);
    } else {
      const encl = (a.special ? 10 : a.size * 2) * ctx.vm;
      vals.push(Math.max(0, net * AI_PARAMS.unmatched - encl * 0.5 - ctx.vpa * 0.6) * afford + option);
    }
  }
  for (const id of p.hand) {
    const c = card(id);
    if (c.kind === 'sponsor') {
      const f = feasibility(p, c.req);
      vals.push(Math.max(0, (sponsorNowValue(g, p, c, ctx) + sponsorOngoing(g, p, c.id, ctx)) * f * 0.6 - ctx.vpa * 0.7) + option);
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
    else total += AI_PARAMS.emptyCell * 2 * ctx.late(4);
  }
  return { total, matched };
}

/** 地图左侧露出的紫色奖励在每次休息时的价值 */
function leftValue(id: LeftBonusId, ctx: Ctx): number {
  switch (id) {
    case 'draw':
      return 0.9 * ctx.late(3);
    case 'enc2':
      return 4 * ctx.vm + 0.3;
    case 'money5':
      return 5 * ctx.vm;
    case 'cp1':
      return 2.4;
    case 'sponsor':
      return 1.0 * ctx.late(3);
    case 'slot1x2':
      return 0.8 * ctx.late(3);
    case 'pouch2':
      return 2.5;
    default:
      return 0;
  }
}

/** 决策时根局面的时间估计（搜索期间固定） */
let rootCtx: { pi: number; ctx: Ctx } | null = null;

function ctxFor(g: GameState, pi: number): Ctx {
  if (rootCtx && rootCtx.pi === pi && g.endBy === null) return rootCtx.ctx;
  return context(g, pi);
}

function kioskIncome(p: PlayerState): number {
  const map = mapOf(p);
  let n = 0;
  for (const b of p.buildings) {
    if (b.type !== 'kiosk') continue;
    const adj = new Set<number>();
    for (const c of map.cells[b.cells[0]].nbrs) {
      const o = p.buildings.find((x) => x.cells.includes(c));
      if (o && o.type !== 'kiosk') adj.add(o.uid);
    }
    n += adj.size;
  }
  return n;
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
  for (const a of ACTIONS) {
    if (p.upgraded[a]) v += UPGRADE_VALUE[a] * AI_PARAMS.upgrade * ctx.late(10);
    const t = p.tokens[a];
    if (t?.mult) v += 1.6 * ctx.late(2);
    if (t?.venom) v -= 1.0;
    if (t?.constrict) v -= 1.0;
  }
  v += p.partners.length * AI_PARAMS.partnerVal * ctx.late(6) + p.unis.length * AI_PARAMS.uniVal * ctx.late(6);
  // 售货亭与地图带来的未来收入
  v += kioskIncome(p) * AI_PARAMS.kiosk * ctx.breaks * ctx.vm;
  const map = mapOf(p);
  map.left.forEach((lb, i) => {
    if (lb.recurring && !p.mapTokens.includes(i)) v += leftValue(lb.id, ctx) * ctx.breaks;
  });
  if (harborActive(p)) v += ctx.R * 0.3 * ctx.vm;
  const rest = featureCells(map, 'restaurant');
  if (rest.length) {
    const covered = coveredCells(p);
    v += map.cells.filter((c) => covered.has(c.i) && c.nbrs.some((x) => rest.includes(x))).length * ctx.breaks * ctx.vm;
  }
  for (const sid of p.sponsors) v += sponsorOngoing(g, p, sid, ctx);

  v += handPotential(g, p, ctx).total;

  // 保护项目的潜力（还需要一次协会行动）
  const pots: number[] = [];
  for (const bp of g.projects) {
    const c = project(bp.id);
    if (p.supported.some((x) => x.id === bp.id) && !(c.goal.k === 'release' && has(p, 's224'))) continue;
    const prog = projectProgress(p, c);
    let best = 0;
    c.levels.forEach((lv, i) => {
      if (bp.slots[i] !== null) return;
      const value = cpPoints(p.cp + lv.cp) - cpPoints(p.cp) + (lv.rep ?? 0) * ctx.vr;
      if (c.goal.k === 'release') {
        if (prog > 0) best = Math.max(best, (value - ctx.vpa) * 0.3);
        return;
      }
      if (c.goal.k === 'breed') {
        if (prog > 0) best = Math.max(best, (value - ctx.vpa) * 0.7);
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
    if (!s.tiers.length) continue;
    const m = scoringMetric(g, pi, id);
    const next = s.tiers.find(([need]) => m < need);
    if (next) v += 0.8 * ctx.late(4) * (m / next[0]);
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

const BIG = ['build', 'animals', 'cards', 'assoc', 'sponsors', 'extra', 'sponsorPay'];

/** 用启发式（不模拟）快速处理附带的小决定 */
function settle(g: GameState, pi: number, rnd: Rng) {
  let guard = 0;
  while (inTurn(g, pi) && guard++ < 40) {
    const f = decision(g)!;
    if (BIG.includes(f.k)) break;
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

const BONUS_SCORE: Record<BonusId, number> = {
  x: 1.0,
  card: 1.2,
  money5: 2.2,
  money10: 4,
  money2: 0.9,
  rep1: 1.0,
  rep2: 1.8,
  slot1: 0.8,
  worker: 3.2,
  partner: 3,
  sponsor: 1.2,
  mult: 1.4,
  uni: 3,
  kiosk: 1.5,
};

function placementScore(g: GameState, p: PlayerState, type: string, cells: number[]): number {
  const map = mapOf(p);
  const covered = coveredCells(p);
  let s = 0;
  for (const i of cells) {
    const c = map.cells[i];
    if (c.bonus) s += BONUS_SCORE[c.bonus];
    if (c.feature === 'hills') s += 1.5;
    if (c.feature === 'harbor' || c.feature === 'institute') s += 2.5;
    if (c.upgrade) s += 0.3;
    for (const n of c.nbrs) if (covered.has(n)) s += 0.15;
    if (c.border) s += 0.05;
  }
  const def = BUILDINGS[type];
  if (def.kind === 'enclosure' || def.kind === 'special') {
    const water = adjacentTerrain(p, cells, 'water');
    const rock = adjacentTerrain(p, cells, 'rock');
    const size = enclosureSize(type);
    const fake: Building = { uid: -1, type, cells, animals: [] };
    let bestFit = 0;
    for (const id of p.hand) {
      const c = card(id);
      if (c.kind !== 'animal' || !canHouse(p, c, fake)) continue;
      const exact = def.kind === 'special' ? 1.2 : c.size === size ? 1.6 : 0.6;
      bestFit = Math.max(bestFit, exact + ((c.water ?? 0) > 0 ? 0.6 : 0) + ((c.rock ?? 0) > 0 ? 0.6 : 0));
      s += 0.3;
    }
    s += bestFit;
    s += Math.min(2, water) * 0.25 + Math.min(2, rock) * 0.25;
    const tower = featureCells(map, 'tower');
    if (def.kind === 'enclosure' && tower.length && cells.some((i) => map.cells[i].nbrs.some((n) => tower.includes(n)))) s += 1.5;
    const gate = featureCells(map, 'gate');
    if (def.kind === 'enclosure' && gate.length && cells.some((i) => map.cells[i].nbrs.some((n) => gate.includes(n)))) s += 1.2;
  }
  if (def.kind === 'kiosk') {
    const adj = new Set<number>();
    for (const n of map.cells[cells[0]].nbrs) {
      const o = p.buildings.find((x) => x.cells.includes(n));
      if (o) adj.add(o.uid);
    }
    s += adj.size * 1.2;
  }
  const rest = featureCells(map, 'restaurant');
  if (rest.length) s += cells.filter((i) => map.cells[i].nbrs.some((n) => rest.includes(n))).length * 0.6;
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
  const v = scoringMetric(g, pi, id);
  if (!s.tiers.length) return 0.6 + scoringCp(g, pi, id) * 0.5;
  return 0.5 + v / s.tiers[1][0];
}

function chooseOptScore(g: GameState, pi: number, o: Opt): number {
  const p = g.players[pi];
  switch (o.k) {
    case 'upgrade':
      return 10 - UPGRADE_ORDER.indexOf(o.action);
    case 'worker':
      return p.workers < 2 ? 9.5 : p.workers < 3 ? 7 : 4;
    case 'tile':
      return { t_money: 7, t_rep: 6, t_x: 6, t_enclosure: 5, t_cards: 6, t_mult: 5, t_uni: 7, t_partner: 7.5, t_wild: 5 }[o.id] ?? 5;
    case 'slot':
      return o.to === 4 ? 3 + (o.action === 'animals' ? 3 : o.action === 'association' ? 2 : 1) : p.actions.indexOf(o.action) >= 3 ? 0.5 : 1;
    case 'hypno': {
      const t = g.players[o.target];
      return t.actions.indexOf(o.action) + 1 + (t.upgraded[o.action] ? 1 : 0);
    }
    case 'mult':
      return o.action === 'animals' ? 5 : o.action === 'association' ? 4 : o.action === 'sponsors' ? 3 : 2;
    case 'mapToken': {
      const lb = mapOf(p).left[o.i];
      return lb.recurring ? 6 : lb.id === 'money12' ? 5 : lb.id === 'worker' ? 5.5 : 4;
    }
    case 'pilfer':
      return o.give === 'money' ? (p.money >= 15 ? 2 : 1) : p.hand.length > 2 ? 2 : 0.5;
    case 'waza':
      return o.size === 'small' ? 2 : 1.5;
    case 'partner':
      return p.hand.filter((id) => card(id).kind === 'animal' && animal(id).icons.includes(o.continent)).length + 1;
    case 'university':
      return o.uni === 'u_rep' ? 3 : o.uni === 'u_sci' ? 2.5 : 2;
    case 'bonus':
      return BONUS_SCORE[o.bonus];
    case 'project':
      return 2;
    case 'gain':
      return 5;
    case 'none':
      return 0.2;
  }
}

/** 不模拟的快速决定 */
function heuristicMove(g: GameState, f: Decision, rnd: Rng): Move {
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
      let bv = f.deck ? AI_PARAMS.drawValue * ctx.late(4) : -Infinity;
      g.display.forEach((id, i) => {
        if (!f.any && i >= range(p)) return;
        const c = card(id);
        if (f.filter === 'sponsor' && c.kind !== 'sponsor') return;
        if (f.filter === 'small' && !(c.kind === 'animal' && isSmall(c))) return;
        const v = cardValue(g, f.p, id, ctx);
        if (v > bv) {
          bv = v;
          best = i;
        }
      });
      if (best >= 0) return { t: 'take', slot: best };
      return f.deck ? { t: 'take', slot: -1 } : { t: 'done' };
    }
    case 'place': {
      const best = bestPlacements(g, p, f.types, 1, f.ignoreUpgrade)[0];
      return best ? { t: 'build', type: best.type, cells: best.cells } : { t: 'done' };
    }
    case 'dig': {
      const avg = 1.0 * ctx.late(3);
      const worst = [...p.hand].sort((a, b) => cardValue(g, f.p, a, ctx) - cardValue(g, f.p, b, ctx))[0];
      if (worst && cardValue(g, f.p, worst, ctx) < avg) return { t: 'cards', cards: [worst] };
      return { t: 'done' };
    }
    case 'sponsorPay': {
      let best: Move = { t: 'done' };
      let bv = 0;
      for (const id of p.hand) {
        const c = card(id);
        if (c.kind !== 'sponsor' || sponsorLevel(p, c) > p.money) continue;
        const ms = sponsorMoves(g, f.p, null, id, -1);
        if (!ms.length) continue;
        const v = sponsorNowValue(g, p, c, ctx) + sponsorOngoing(g, p, id, ctx) - sponsorLevel(p, c) * ctx.vm;
        if (v > bv) {
          bv = v;
          best = c.building ? ({ t: 'sponsor', card: id, from: -1, cells: bestPlacements(g, p, [id], 1)[0]?.cells ?? (ms[0] as { cells: number[] }).cells } as Move) : ms[0];
        }
      }
      return best;
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
  if (f.purpose === 'scoring') {
    const best = [...pool].sort((a, b) => scoringDesire(g, f.p, b) - scoringDesire(g, f.p, a));
    return best.slice(0, min);
  }
  if (f.purpose === 'scoringDrop') {
    const worst = [...pool].sort((a, b) => scoringDesire(g, f.p, a) - scoringDesire(g, f.p, b));
    return worst.slice(0, min);
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
      const best = byValue.find((id) => card(id).kind === 'animal');
      return best ? [best] : [];
    }
    case 'sell': {
      const worth = 4 * ctx.vm;
      return [...pool]
        .sort((a, b) => val(a) - val(b))
        .filter((id) => val(id) < worth)
        .slice(0, f.max);
    }
    case 'pouch': {
      const asc = [...pool].sort((a, b) => val(a) - val(b));
      return asc.filter((id) => val(id) < 2 * ctx.va).slice(0, f.max);
    }
    default:
      return byValue.slice(0, min);
  }
}

// ———————————————————————————————————————————— 行动中的决定（一步模拟）

function candidateMoves(g: GameState, f: Decision, level: AiLevel): Move[] {
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
      const opts = animalOptions(g, f.p, f.up, f.onlySmall);
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
        const ms = sponsorMoves(g, f.p, f, id, from);
        if (!ms.length) continue;
        if (c.building) {
          const good = bestPlacements(g, p, [id], 2).map((b) => b.cells.join(','));
          out.push(...ms.filter((m) => m.t === 'sponsor' && good.includes((m.cells ?? []).join(','))));
        } else out.push(...ms);
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

function bestSubMove(g: GameState, f: Decision, level: AiLevel, rnd: Rng, depth: number): Move {
  if (f.k === 'extra') {
    if (depth > 1) return { t: 'done' };
    const p = g.players[f.p];
    const cands: Move[] = [{ t: 'done' }];
    for (const a of ACTIONS) {
      if ((f.only && a !== f.only) || (f.except && a === f.except)) continue;
      for (let x = 0; x <= Math.min(p.x, level === 'hard' ? 2 : 1); x++) cands.push({ t: 'action', action: a, x });
    }
    let best = cands[0];
    let bv = -Infinity;
    for (const m of cands) {
      const v = m.t === 'done' ? scoreAfter(g, f.p, m, rnd) : simulateTurn(g, f.p, m, 'easy', rnd, depth + 1);
      if (v > bv) {
        bv = v;
        best = m;
      }
    }
    return best;
  }
  if (!['build', 'animals', 'assoc', 'sponsors', 'cards'].includes(f.k)) {
    if (f.k === 'choose' && level !== 'easy' && f.opts.length > 1) {
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
export function simulateTurn(g: GameState, pi: number, first: Move, level: AiLevel, rnd: Rng, depth = 0): number {
  const c = simulateLine(g, pi, first, level, rnd, depth);
  return c ? evaluate(c, pi) : -Infinity;
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
      if (p.tokens[a]?.mult) out.push({ t: 'action', action: a, x, mult: true });
    }
    out.push({ t: 'xaction', action: a });
  }
  return out;
}

export const aiDebug: { on: boolean; last: unknown } = { on: false, last: null };

/** 把模拟局面推进到下一个回合开始，并让 pi 再行动一次 */
function giveTurnBack(c: GameState, pi: number, rnd: Rng): boolean {
  let guard = 0;
  while (!c.over && guard++ < 60) {
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

export function simulateLine(g: GameState, pi: number, first: Move, level: AiLevel, rnd: Rng, depth = 0): GameState | null {
  const c = simClone(g, rnd);
  if (!tryApply(c, first)) return null;
  let guard = 0;
  while (inTurn(c, pi) && guard++ < 40) {
    const f = decision(c)!;
    const m = bestSubMove(c, f, level, rnd, depth);
    if (!tryApply(c, m) && !tryApply(c, { t: 'done' })) break;
  }
  return c;
}

/** 商港：手牌里价值很低的牌换 3 元 */
function harborMove(g: GameState, pi: number): Move | null {
  const p = g.players[pi];
  if (pi !== g.current || !harborActive(p) || p.harborTurn === g.turn || !p.hand.length) return null;
  const ctx = context(g, pi);
  const worst = [...p.hand].sort((a, b) => cardValue(g, pi, a, ctx) - cardValue(g, pi, b, ctx))[0];
  return cardValue(g, pi, worst, ctx) < 3 * ctx.vm ? { t: 'harbor', card: worst } : null;
}

/** 为当前需要决定的 AI 玩家选择一步 */
export function aiMove(g: GameState, level: AiLevel = 'normal'): Move {
  const f = decision(g);
  if (!f) throw new Error('当前不需要决定');
  const rnd = new Rng(hashSeed(g.rng, g.turn, g.stack.length, f.k));
  knownCards = new Set([...g.players[f.p].hand, ...g.display, ...(f.k === 'pick' ? f.cards : [])]);
  knownFor = f.p;
  rootCtx = { pi: f.p, ctx: context(g, f.p) };
  if (f.k !== 'turn') return bestSubMove(g, f, level, rnd, 0);
  const pi = f.p;
  const hm = harborMove(g, pi);
  if (hm) return hm;
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
