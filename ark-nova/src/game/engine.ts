// 规则引擎：游戏状态是纯 JSON，所有变化都通过 apply(state, move) 发生。
// 需要玩家决定的事项和自动结算的步骤都放在 stack 上（栈顶先结算），
// 这样多步行动、触发的奖励、休息时的弃牌都能统一处理，AI 和界面也走同一条路径。
import { buildingDef } from './buildings';
import { animal, baseProjects, card, deckCards, project, sponsor, SCORING, SCORING_CARDS } from './content';
import { BONUS_INFO } from './maps';
import {
  animalCost,
  animalError,
  canIgnoreCondition,
  buildCost,
  buildableTypes,
  canSnap,
  continentName,
  freeWorkers,
  handLimit,
  iconName,
  mapOf,
  matchesFilter,
  metric,
  placementError,
  placements,
  range,
  sponsorError,
  supportError,
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
  REP_CAP_BASIC,
  MAX_WORKERS,
  MAX_X,
  REP_BONUSES,
  SOLO_BREAKS,
  START_MONEY,
  START_REP,
  TASK_VALUE,
  TILES,
  animalsCount,
  animalsRep,
  appealIncome,
  breakLength,
  cardsDraw,
  donationCost,
  finalScore,
  progress,
  tile,
  university,
} from './rules';
import type { ActionId, Frame, Gain, GameOptions, GameState, Move, Opt, PlayerState, TaskId } from './types';
import { ACTIONS } from './types';

export const STATE_VERSION = 2;
export const PLAYER_COLORS = ['#d9534f', '#3b7dd8', '#e0a526', '#4caf6a'];

/** 每位玩家最多回合数（防止异常对局无限进行） */
const TURN_LIMIT = 80;

const AUTO_KINDS = new Set<Frame['k']>(['endTurn', 'afterTurn', 'finishAction', 'animalsEnd', 'breakFinish', 'begin', 'hypnoEnd']);

export class RuleError extends Error {}

function fail(msg: string): never {
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
export function decision(g: GameState): Exclude<Frame, { k: 'endTurn' | 'afterTurn' | 'finishAction' | 'animalsEnd' | 'breakFinish' | 'begin' | 'hypnoEnd' }> | null {
  const f = top(g);
  if (!f || isAuto(f)) return null;
  return f as ReturnType<typeof decision>;
}

function push(g: GameState, f: Frame) {
  g.stack.push(f);
}

/** 按顺序依次结算（第一个最先） */
function queue(g: GameState, fs: Frame[]) {
  for (let i = fs.length - 1; i >= 0; i--) g.stack.push(fs[i]);
}

function pop(g: GameState) {
  g.stack.pop();
}

function drawDeck(g: GameState, n: number): string[] {
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

function drawToHand(g: GameState, pi: number, n: number) {
  const cards = drawDeck(g, n);
  g.players[pi].hand.push(...cards);
}

function refillDisplay(g: GameState) {
  while (g.display.length < DISPLAY_SIZE) {
    const c = drawDeck(g, 1);
    if (!c.length) break;
    g.display.push(c[0]);
  }
}

function takeDisplay(g: GameState, slot: number): string {
  const [c] = g.display.splice(slot, 1);
  refillDisplay(g);
  return c;
}

function advanceBreak(g: GameState, n: number) {
  g.breakPos = Math.min(g.breakMax, g.breakPos + n);
}

export function moveAction(p: PlayerState, a: ActionId, toIndex: number) {
  const i = p.actions.indexOf(a);
  if (i < 0) return;
  p.actions.splice(i, 1);
  p.actions.splice(toIndex, 0, a);
}

// ———————————————————————————————————————————— 创建对局

export function createGame(opts: GameOptions): GameState {
  const n = opts.players.length;
  if (n < 1 || n > 4) throw new Error('需要 1–4 名玩家');
  const solo = n === 1;
  const g: GameState = {
    v: STATE_VERSION,
    seed: opts.seed >>> 0,
    rng: opts.seed >>> 0,
    solo,
    players: [],
    deck: [],
    discard: [],
    display: [],
    projects: [],
    tasks: { rep: [], partner: [], university: [], project: [] },
    donationStep: 0,
    tiles: [],
    cp10: false,
    scoringPile: [],
    breakPos: 0,
    breakMax: breakLength(n, solo),
    breaks: 0,
    current: 0,
    first: 0,
    turn: 0,
    endBy: null,
    finalTurns: 0,
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
  for (const id of shuffle(g, baseProjects()).slice(0, 3)) {
    g.projects.push({ id, slots: project(id).levels.map(() => null) });
  }
  g.tiles = shuffle(
    g,
    TILES.map((t) => t.id),
  )
    .slice(0, 4)
    .map((id, i) => ({ id, at: i < 2 ? 5 : 8, by: null }));

  opts.players.forEach((spec, i) => {
    const others = shuffle(g, ACTIONS.filter((a) => a !== 'animals'));
    g.players.push({
      name: spec.name,
      ai: spec.ai,
      color: PLAYER_COLORS[i],
      map: spec.map,
      money: START_MONEY,
      appeal: i,
      cp: 0,
      rep: START_REP,
      x: 0,
      workers: 1,
      actions: ['animals', ...others],
      upgraded: { animals: false, build: false, cards: false, association: false, sponsors: false },
      hand: [],
      scoring: [],
      buildings: [],
      sponsors: [],
      partners: [],
      unis: [],
      projects: [],
      cpBonuses: [],
      repBonuses: [],
      donations: 0,
      stats: { turns: 0, animals: 0, released: 0 },
    });
  });
  refillDisplay(g);

  const setup: Frame[] = [];
  g.players.forEach((_, i) => {
    setup.push({ k: 'pick', p: i, purpose: 'setup', cards: drawDeck(g, 8), min: 4, max: 4 });
    g.players[i].scoring = g.scoringPile.splice(0, 2);
  });
  queue(g, [...setup, { k: 'begin' }]);
  g.reveal = 0;
  log(g, null, solo ? `单人挑战开始：在第 ${SOLO_BREAKS} 次休息结束前让两个标记相遇。` : `游戏开始，${n} 名玩家。`);
  return g;
}

// ———————————————————————————————————————————— 收益与奖励

export function gain(g: GameState, pi: number, gn: Gain) {
  const p = g.players[pi];
  if (gn.money) p.money += gn.money;
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

function upgradeOpts(p: PlayerState): Opt[] {
  return ACTIONS.filter((a) => !p.upgraded[a]).map((a) => ({ k: 'upgrade', action: a }) as Opt);
}

function pushChoose(g: GameState, pi: number, reason: string, opts: Opt[]) {
  if (!opts.length) return;
  if (opts.length === 1) {
    applyOpt(g, pi, opts[0], reason);
    return;
  }
  push(g, { k: 'choose', p: pi, reason, opts });
}

function pushUpgrade(g: GameState, pi: number, reason: string) {
  pushChoose(g, pi, reason, upgradeOpts(g.players[pi]));
}

function addRep(g: GameState, pi: number, n: number) {
  const p = g.players[pi];
  const cap = p.upgraded.cards ? MAX_REP : REP_CAP_BASIC;
  for (let i = 0; i < n; i++) {
    if (p.rep >= cap) {
      if (cap === MAX_REP) p.appeal++;
      else {
        log(g, pi, `声望已到 ${REP_CAP_BASIC}（升级卡牌行动后才能继续提升）`);
        break;
      }
      continue;
    }
    p.rep++;
    const b = REP_BONUSES.find((x) => x.at === p.rep);
    if (b && !p.repBonuses.includes(b.at)) {
      p.repBonuses.push(b.at);
      log(g, pi, `声望达到 ${b.at}：${b.text}`);
      if (b.gain === 'display') push(g, { k: 'display', p: pi, n: 1, any: true, reason: `声望 ${b.at} 奖励` });
      else gain(g, pi, b.gain);
    }
  }
}

function addCp(g: GameState, pi: number, n: number) {
  const p = g.players[pi];
  const before = p.cp;
  p.cp += n;
  for (const t of CP_BONUSES) {
    if (before >= t || p.cp < t || p.cpBonuses.includes(t)) continue;
    p.cpBonuses.push(t);
    if (t === 2) {
      const opts = upgradeOpts(p);
      if (p.workers < MAX_WORKERS) opts.push({ k: 'worker' });
      pushChoose(g, pi, '保护点数 2 奖励：升级行动卡或获得协会工人', opts);
    } else if (t === 10) {
      if (!g.cp10) {
        g.cp10 = true;
        log(g, pi, '第一位达到保护点数 10：所有玩家各保留 1 张终局计分卡，弃掉其余的');
        g.players.forEach((o, oi) => {
          if (o.scoring.length > 1) push(g, { k: 'pick', p: oi, purpose: 'scoringKeep', cards: [...o.scoring], min: 1, max: 1 });
        });
      }
    } else {
      const opts: Opt[] = g.tiles.filter((x) => x.at === t && x.by === null).map((x) => ({ k: 'tile', id: x.id }));
      opts.push({ k: 'gain', gain: { money: 5 } });
      pushChoose(g, pi, `保护点数 ${t} 奖励：拿 5 元或一块奖励板块`, opts);
    }
  }
}

export function optText(g: GameState, o: Opt): string {
  switch (o.k) {
    case 'upgrade':
      return `升级「${ACTION_INFO[o.action].name}」行动卡`;
    case 'worker':
      return '获得 1 名协会工人';
    case 'tile':
      return `${tile(o.id).name}：${tile(o.id).text}`;
    case 'gain':
      return gainText(o.gain);
    case 'hypno':
      return `执行 ${g.players[o.target].name} 的「${ACTION_INFO[o.action].name}」（强度 ${g.players[o.target].actions.indexOf(o.action) + 1}）`;
    case 'boost':
      return `把「${ACTION_INFO[o.action].name}」移到 5 号位`;
    case 'none':
      return '不使用';
  }
}

function applyOpt(g: GameState, pi: number, o: Opt, reason: string) {
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
      applyTile(g, pi, o.id);
      break;
    }
    case 'gain':
      log(g, pi, `${reason}：${gainText(o.gain)}`);
      gain(g, pi, o.gain);
      break;
    case 'hypno': {
      const t = g.players[o.target];
      const slot = t.actions.indexOf(o.action) + 1;
      log(g, pi, `催眠：以强度 ${slot} 执行 ${t.name} 的「${ACTION_INFO[o.action].name}」行动`);
      push(g, { k: 'hypnoEnd', p: pi, target: o.target, action: o.action });
      startAction(g, pi, o.action, slot, t.upgraded[o.action]);
      break;
    }
    case 'boost':
      moveAction(p, o.action, 4);
      log(g, pi, `把「${ACTION_INFO[o.action].name}」行动卡移到 5 号位`);
      break;
    case 'none':
      break;
  }
}

function applyTile(g: GameState, pi: number, id: string) {
  const p = g.players[pi];
  switch (id) {
    case 't_money':
      gain(g, pi, { money: 10 });
      break;
    case 't_rep':
      gain(g, pi, { rep: 2 });
      break;
    case 't_display':
      push(g, { k: 'display', p: pi, n: 2, any: true, reason: '优先引进' });
      break;
    case 't_enclosure': {
      const types = ['E1', 'E2', 'E3'].filter((t) => placements(p, t).length > 0);
      if (types.length) push(g, { k: 'place', p: pi, types, reason: '捐建围栏（免费，不超过 3 格）', count: 1 });
      break;
    }
    case 't_appeal':
      gain(g, pi, { appeal: 3 });
      break;
    case 't_x':
      gain(g, pi, { x: 2 });
      break;
    case 't_draw':
      gain(g, pi, { cards: 3 });
      break;
    case 't_kiosk': {
      const types = ['kiosk', 'pavilion'].filter((t) => placements(p, t).length > 0);
      if (types.length) push(g, { k: 'place', p: pi, types, reason: '游客设施（免费）', count: 1 });
      break;
    }
  }
}

// ———————————————————————————————————————————— 建筑

function addBuilding(g: GameState, pi: number, type: string, cells: number[]) {
  const p = g.players[pi];
  const b = { uid: g.nextUid++, type, cells: [...cells], animals: [] as string[] };
  p.buildings.push(b);
  return b;
}

function afterBuild(g: GameState, pi: number, b: { type: string; cells: number[] }) {
  const p = g.players[pi];
  const map = mapOf(p);
  const def = buildingDef(b.type);
  for (const i of b.cells) {
    const bonus = map.cells[i]!.bonus;
    if (!bonus) continue;
    log(g, pi, `覆盖奖励格：${BONUS_INFO[bonus].label}`);
    switch (bonus) {
      case 'money':
        gain(g, pi, { money: 5 });
        break;
      case 'card':
        gain(g, pi, { cards: 1 });
        break;
      case 'rep':
        gain(g, pi, { rep: 1 });
        break;
      case 'x':
        gain(g, pi, { x: 1 });
        break;
      case 'upgrade':
        pushUpgrade(g, pi, '放置奖励');
        break;
      case 'worker':
        gain(g, pi, { worker: 1 });
        break;
    }
  }
  if (def.kind === 'pavilion') gain(g, pi, { appeal: 1 });
  const ab = map.ability;
  if (ab.k === 'waterBuild') {
    const adj = b.cells.some((i) => map.cells[i]!.nbrs.some((n) => map.cells[n]!.terrain === 'water'));
    if (adj) {
      p.money += ab.money;
      log(g, pi, `湖畔园区：建筑与水域相邻，获得 ${ab.money} 元`);
    }
  }
  const kind = def.kind === 'enclosure' ? 'enclosure' : def.kind === 'kiosk' ? 'kiosk' : def.kind === 'pavilion' ? 'pavilion' : def.kind === 'special' ? 'special' : null;
  if (kind) {
    for (const id of p.sponsors) {
      for (const e of sponsor(id).effects ?? []) {
        if (e.k === 'onBuild' && e.building === kind) {
          log(g, pi, `「${sponsor(id).name}」：${gainText(e.gain)}`);
          gain(g, pi, e.gain);
        }
      }
    }
  }
}

// ———————————————————————————————————————————— 行动

function startAction(g: GameState, pi: number, action: ActionId, str: number, up: boolean) {
  switch (action) {
    case 'animals':
      push(g, { k: 'animals', p: pi, str, up, left: animalsCount(str, up), played: 0 });
      break;
    case 'build':
      push(g, { k: 'build', p: pi, str, up, budget: str, built: [], done: 0 });
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

function playAnimal(g: GameState, pi: number, id: string, from: number, uid: number) {
  const p = g.players[pi];
  const a = animal(id);
  const cost = animalCost(g, p, a, from);
  p.money -= cost;
  if (from < 0) p.hand.splice(p.hand.indexOf(id), 1);
  else takeDisplay(g, from);
  const b = p.buildings.find((x) => x.uid === uid)!;
  b.animals.push(id);
  p.stats.animals++;
  log(g, pi, `打出 ${a.emoji}${a.name}（${cost} 元）`);
  gain(g, pi, { appeal: a.appeal, cp: a.cp, rep: a.rep });
  for (const sid of p.sponsors) {
    for (const e of sponsor(sid).effects ?? []) {
      if (e.k === 'onPlay' && matchesFilter(a, e.filter)) {
        log(g, pi, `「${sponsor(sid).name}」：${gainText(e.gain)}`);
        gain(g, pi, e.gain);
      }
    }
  }
  g.players.forEach((o, oi) => {
    if (oi === pi) return;
    for (const sid of o.sponsors) {
      for (const e of sponsor(sid).effects ?? []) {
        if (e.k === 'onOtherPlay' && matchesFilter(a, e.filter)) {
          log(g, oi, `「${sponsor(sid).name}」：${gainText(e.gain)}`);
          gain(g, oi, e.gain);
        }
      }
    }
  });
  if (a.ability) resolveAbility(g, pi, a.ability, uid);
}

function resolveAbility(g: GameState, pi: number, ab: NonNullable<ReturnType<typeof animal>['ability']>, uid: number) {
  const p = g.players[pi];
  switch (ab.k) {
    case 'sprint':
      drawToHand(g, pi, ab.n);
      log(g, pi, `冲刺 ${ab.n}：抽 ${ab.n} 张牌`);
      break;
    case 'hunter': {
      const cards = drawDeck(g, ab.n);
      if (cards.length) push(g, { k: 'pick', p: pi, purpose: 'keepAnimal', cards, min: 0, max: 1 });
      break;
    }
    case 'perception': {
      const cards = drawDeck(g, ab.n);
      const k = Math.min(2, cards.length);
      if (cards.length) push(g, { k: 'pick', p: pi, purpose: 'keep', cards, min: k, max: k });
      break;
    }
    case 'snap':
      push(g, { k: 'display', p: pi, n: ab.n, any: true, reason: `抢先 ${ab.n}` });
      break;
    case 'boost':
      moveAction(p, ab.action, 4);
      log(g, pi, `助推：「${ACTION_INFO[ab.action].name}」移到 5 号位`);
      break;
    case 'clever':
      pushChoose(
        g,
        pi,
        '聪慧：把一张行动卡移到 5 号位',
        ACTIONS.map((a) => ({ k: 'boost', action: a }) as Opt),
      );
      break;
    case 'pack':
    case 'iconic': {
      const icon = ab.k === 'pack' ? ab.cat : ab.cont;
      const n = Math.min(5, metric(g, p, { m: 'icon', icon }));
      if (n > 0) {
        log(g, pi, `${ab.k === 'pack' ? '群居' : '标志'}：${n} 个${iconName(icon)}图标，吸引力 +${n}`);
        gain(g, pi, { appeal: n });
      }
      break;
    }
    case 'pouch':
      if (p.hand.length) push(g, { k: 'pick', p: pi, purpose: 'pouch', cards: [], min: 0, max: 1, uid });
      break;
    case 'sunbathe':
      if (p.hand.length) push(g, { k: 'pick', p: pi, purpose: 'sell', cards: [], min: 0, max: ab.n });
      break;
    case 'venom':
      g.players.forEach((o, oi) => {
        if (oi !== pi && o.appeal > p.appeal) {
          const lose = Math.min(o.money, ab.n);
          o.money -= lose;
          log(g, oi, `被毒液波及，失去 ${lose} 元`);
        }
      });
      break;
    case 'constrict':
      g.players.forEach((o, oi) => {
        if (oi !== pi && o.appeal > p.appeal) {
          const a = o.actions[4];
          moveAction(o, a, 0);
          log(g, oi, `被绞杀：「${ACTION_INFO[a].name}」移到 1 号位`);
        }
      });
      break;
    case 'hypnosis': {
      const opts: Opt[] = [];
      g.players.forEach((o, oi) => {
        if (oi === pi) return;
        o.actions.forEach((a, i) => {
          if (i < ab.n) opts.push({ k: 'hypno', target: oi, action: a });
        });
      });
      if (opts.length) push(g, { k: 'choose', p: pi, reason: `催眠 ${ab.n}：选择对手的一张行动卡`, opts: [...opts, { k: 'none' }] });
      break;
    }
    case 'jump':
      advanceBreak(g, ab.n);
      p.money += ab.n;
      log(g, pi, `跳跃 ${ab.n}：休息标记前进 ${ab.n} 格，获得 ${ab.n} 元`);
      break;
    case 'dig':
      if (p.hand.length) push(g, { k: 'pick', p: pi, purpose: 'dig', cards: [], min: 0, max: ab.n });
      break;
    case 'posture':
      if (placements(p, 'pavilion').length) push(g, { k: 'place', p: pi, types: ['pavilion'], reason: `炫耀 ${ab.n}：免费建造凉亭`, count: ab.n });
      break;
    case 'resist': {
      const cards = g.scoringPile.splice(0, 2);
      if (cards.length) push(g, { k: 'pick', p: pi, purpose: 'scoring', cards, min: 1, max: 1 });
      break;
    }
    case 'assert': {
      const types = ['reptile', 'aviary'].filter((t) => placements(p, t, { ignoreTypeUpgrade: true }).length > 0);
      if (types.length) push(g, { k: 'place', p: pi, types, reason: '霸主：免费建造特殊场馆', count: 1 });
      break;
    }
    case 'trade':
      if (p.hand.length && g.display.length) push(g, { k: 'pick', p: pi, purpose: 'trade', cards: [], min: 0, max: 1 });
      break;
    case 'scavenge': {
      if (!g.discard.length) break;
      shuffle(g, g.discard);
      const cards = g.discard.splice(0, ab.n);
      g.reveal++;
      push(g, { k: 'pick', p: pi, purpose: 'keep', cards, min: 1, max: 1 });
      break;
    }
    case 'xtoken':
      gain(g, pi, { x: ab.n });
      break;
    case 'money':
      gain(g, pi, { money: ab.n });
      break;
  }
}

function playSponsor(g: GameState, pi: number, id: string, cells?: number[]) {
  const p = g.players[pi];
  const c = sponsor(id);
  p.sponsors.push(id);
  log(g, pi, `打出赞助卡 ${c.emoji}${c.name}`);
  if (c.building && cells) {
    const b = addBuilding(g, pi, id, cells);
    afterBuild(g, pi, b);
    if (id === 'observation_tower') {
      const map = mapOf(p);
      const adj = new Set<number>();
      for (const i of b.cells) {
        for (const n of map.cells[i]!.nbrs) {
          const other = p.buildings.find((x) => x.uid !== b.uid && x.cells.includes(n));
          if (other) adj.add(other.uid);
        }
      }
      const n = Math.min(4, adj.size);
      if (n) gain(g, pi, { appeal: n });
    }
  }
  if (c.gain) gain(g, pi, c.gain);
  if (c.gainPer) {
    const times = Math.min(c.gainPer.max, Math.floor(metric(g, p, c.gainPer.metric) / c.gainPer.per));
    if (times > 0) {
      const gn: Gain = {};
      for (const [k, v] of Object.entries(c.gainPer.gain) as [keyof Gain, number][]) gn[k] = v * times;
      log(g, pi, `「${c.name}」：${gainText(gn)}`);
      gain(g, pi, gn);
    }
  }
}

function supportProject(
  g: GameState,
  pi: number,
  id: string,
  level: number,
  fromHand: boolean,
  release?: { uid: number; card: string },
  display?: number,
) {
  const p = g.players[pi];
  const c = project(id);
  if (display !== undefined) {
    p.money -= display + 1;
    takeDisplay(g, display);
    g.projects.push({ id, slots: c.levels.map(() => null) });
    log(g, pi, `从展示区打出保护项目 ${c.emoji}${c.name}（${display + 1} 元）`);
  } else if (fromHand) {
    p.hand.splice(p.hand.indexOf(id), 1);
    g.projects.push({ id, slots: c.levels.map(() => null) });
    log(g, pi, `打出保护项目 ${c.emoji}${c.name}`);
  }
  const bp = g.projects.find((x) => x.id === id)!;
  if (release) {
    const b = p.buildings.find((x) => x.uid === release.uid)!;
    b.animals.splice(b.animals.indexOf(release.card), 1);
    const a = animal(release.card);
    p.appeal = Math.max(0, p.appeal - a.appeal);
    g.discard.push(release.card);
    p.stats.released++;
    log(g, pi, `放归 ${a.emoji}${a.name}，失去 ${a.appeal} 点吸引力`);
  }
  bp.slots[level] = pi;
  p.projects.push(id);
  const cp = c.levels[level].cp;
  log(g, pi, `支持保护项目「${c.name}」，获得 ${cp} 保护点数`);
  gain(g, pi, { cp });
  for (const sid of p.sponsors) {
    for (const e of sponsor(sid).effects ?? []) {
      if (e.k === 'onProject') {
        log(g, pi, `「${sponsor(sid).name}」：${gainText(e.gain)}`);
        gain(g, pi, e.gain);
      }
    }
  }
  const ab = mapOf(p).ability;
  if (ab.k === 'projectMoney') {
    p.money += ab.n;
    log(g, pi, `保护中心：获得 ${ab.n} 元`);
  }
}

// ———————————————————————————————————————————— 休息、回合与终局

export function breakIncome(g: GameState, pi: number): { total: number; parts: { label: string; money: number }[] } {
  const p = g.players[pi];
  const map = mapOf(p);
  const parts: { label: string; money: number }[] = [{ label: '吸引力收入', money: appealIncome(p.appeal) }];
  let kiosk = 0;
  for (const b of p.buildings) {
    if (b.type !== 'kiosk') continue;
    const adj = new Set<number>();
    for (const n of map.cells[b.cells[0]]!.nbrs) {
      const other = p.buildings.find((x) => x.cells.includes(n));
      if (other && other.type !== 'kiosk') adj.add(other.uid);
    }
    kiosk += adj.size;
    if (map.ability.k === 'kioskIncome') kiosk += map.ability.n;
  }
  if (kiosk) parts.push({ label: '售货亭', money: kiosk });
  for (const id of p.sponsors) {
    const c = sponsor(id);
    for (const e of c.effects ?? []) {
      if (e.k === 'income') parts.push({ label: c.name, money: e.money });
      if (e.k === 'incomePer') {
        let m = Math.floor(metric(g, p, e.metric) / e.per) * e.money;
        if (e.max !== undefined) m = Math.min(e.max, m);
        if (m) parts.push({ label: c.name, money: m });
      }
    }
  }
  return { total: parts.reduce((s, x) => s + x.money, 0), parts };
}

function doEndTurn(g: GameState, pi: number) {
  g.players[pi].stats.turns++;
  if (g.breakPos >= g.breakMax) {
    log(g, pi, '休息标记到达终点：触发休息');
    const fs: Frame[] = [];
    const n = g.players.length;
    for (let k = 1; k <= n; k++) {
      const j = (pi + k) % n;
      const p = g.players[j];
      const over = p.hand.length - handLimit(p);
      if (over > 0) fs.push({ k: 'pick', p: j, purpose: 'discard', cards: [], min: over, max: over });
    }
    queue(g, [...fs, { k: 'breakFinish', p: pi }, { k: 'afterTurn', p: pi }]);
  } else push(g, { k: 'afterTurn', p: pi });
}

function doBreak(g: GameState, pi: number) {
  g.tasks = { rep: [], partner: [], university: [], project: [] };
  const gone = g.display.splice(0, 2);
  g.discard.push(...gone);
  refillDisplay(g);
  g.players.forEach((p, i) => {
    const inc = breakIncome(g, i);
    p.money += inc.total;
    log(g, i, `休息收入 ${inc.total} 元（${inc.parts.map((x) => `${x.label} ${x.money}`).join('，')}）`);
  });
  g.breakPos = 0;
  g.breaks++;
  const p = g.players[pi];
  if (p.x < MAX_X) {
    p.x++;
    log(g, pi, '触发休息，获得 1 个 X 标记');
  }
  log(g, null, `第 ${g.breaks} 次休息结束：协会工人回到玩家手中，展示区弃掉前 2 张并补满。`);
}

export function reachedEnd(p: PlayerState): boolean {
  return progress(p.appeal, p.cp) >= END_THRESHOLD;
}

function doAfterTurn(g: GameState, pi: number) {
  const n = g.players.length;
  const p = g.players[pi];
  if (g.endBy === null && reachedEnd(p)) {
    g.endBy = pi;
    g.finalTurns = n - 1;
    log(g, pi, n > 1 ? '两个标记相遇，触发游戏结束！其他玩家各再进行 1 个回合。' : '两个标记相遇！');
  } else if (g.endBy !== null) g.finalTurns--;
  const soloOver = g.solo && g.breaks >= SOLO_BREAKS;
  const limit = g.players.every((x) => x.stats.turns >= TURN_LIMIT);
  if ((g.endBy !== null && g.finalTurns <= 0) || soloOver || limit) {
    finishGame(g);
    return;
  }
  const next = (pi + 1) % n;
  g.current = next;
  g.turn++;
  queue(g, [{ k: 'turn', p: next }, { k: 'endTurn', p: next }]);
}

export function scoringCp(g: GameState, pi: number, id: string): number {
  const s = SCORING_CARDS[id];
  const v = metric(g, g.players[pi], s.metric);
  let cp = 0;
  for (const [need, c] of s.tiers) if (v >= need) cp = c;
  return cp;
}

function finishGame(g: GameState) {
  g.players.forEach((p, i) => {
    const breakdown: { label: string; cp: number }[] = [];
    for (const id of p.scoring) breakdown.push({ label: SCORING_CARDS[id].name, cp: scoringCp(g, i, id) });
    for (const sid of p.sponsors) {
      for (const e of sponsor(sid).effects ?? []) {
        if (e.k === 'end') {
          const cp = Math.min(e.max, Math.floor(metric(g, p, e.metric) / e.per) * e.cp);
          breakdown.push({ label: sponsor(sid).name, cp });
        }
      }
    }
    const extra = breakdown.reduce((s, x) => s + x.cp, 0);
    p.cp += extra;
    p.final = { cp: extra, score: finalScore(p.appeal, p.cp), breakdown };
  });
  g.over = true;
  g.stack = [];
  const order = ranking(g);
  log(g, null, `游戏结束！${order.map((i) => `${g.players[i].name} ${g.players[i].final!.score} 分`).join('，')}`);
}

/** 名次（玩家编号），同分时比较剩余的钱 */
export function ranking(g: GameState): number[] {
  return g.players
    .map((_, i) => i)
    .sort((a, b) => {
      const pa = g.players[a];
      const pb = g.players[b];
      const sa = pa.final?.score ?? finalScore(pa.appeal, pa.cp);
      const sb = pb.final?.score ?? finalScore(pb.appeal, pb.cp);
      return sb - sa || pb.projects.length - pa.projects.length || pb.money - pa.money;
    });
}

// ———————————————————————————————————————————— 自动步骤

export function run(g: GameState) {
  let guard = 0;
  while (!g.over) {
    if (++guard > 10000) throw new Error('自动结算陷入循环');
    const f = top(g);
    if (!f) return;
    if (!isAuto(f)) return;
    pop(g);
    switch (f.k) {
      case 'begin':
        g.current = g.first;
        queue(g, [{ k: 'turn', p: g.first }, { k: 'endTurn', p: g.first }]);
        log(g, null, '准备完毕，开始第 1 回合。');
        break;
      case 'finishAction':
        moveAction(g.players[f.p], f.action, 0);
        break;
      case 'hypnoEnd':
        moveAction(g.players[f.target], f.action, 0);
        break;
      case 'animalsEnd':
        if (f.rep) {
          log(g, f.p, '升级的动物行动：声望 +1');
          gain(g, f.p, { rep: f.rep });
        }
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

export function apply(g: GameState, m: Move) {
  if (g.over) fail('游戏已经结束');
  const f = decision(g);
  if (!f) fail('当前没有需要决定的事');
  const pi = f.p;
  const p = g.players[pi];
  switch (f.k) {
    case 'turn':
      if (m.t === 'action') {
        if (!ACTIONS.includes(m.action)) fail('未知行动');
        if (!Number.isInteger(m.x) || m.x < 0 || m.x > p.x) fail('X 标记不够');
        const str = p.actions.indexOf(m.action) + 1 + m.x;
        p.x -= m.x;
        pop(g);
        push(g, { k: 'finishAction', p: pi, action: m.action });
        startAction(g, pi, m.action, str, p.upgraded[m.action]);
        log(g, pi, `执行「${ACTION_INFO[m.action].name}」行动，强度 ${str}${m.x ? `（使用 ${m.x} 个 X 标记）` : ''}${p.upgraded[m.action] ? '（已升级）' : ''}`);
      } else if (m.t === 'xaction') {
        if (!ACTIONS.includes(m.action)) fail('未知行动');
        pop(g);
        moveAction(p, m.action, 0);
        p.x = Math.min(MAX_X, p.x + 1);
        log(g, pi, `把「${ACTION_INFO[m.action].name}」移到 1 号位，获得 1 个 X 标记`);
      } else fail('请选择一张行动卡');
      break;

    case 'build':
      if (m.t === 'build') {
        if (!buildableTypes(p, f).includes(m.type)) fail('现在不能建造这种建筑');
        const err = placementError(p, m.type, m.cells);
        if (err) fail(err);
        const cost = buildCost(m.type);
        p.money -= cost;
        const b = addBuilding(g, pi, m.type, m.cells);
        f.budget -= m.cells.length;
        f.built.push(m.type);
        f.done++;
        if (!f.up || f.budget <= 0) pop(g);
        log(g, pi, `建造${buildingDef(m.type).name}（${cost} 元）`);
        afterBuild(g, pi, b);
      } else if (m.t === 'done') pop(g);
      else fail('请建造或结束');
      break;

    case 'animals':
      if (m.t === 'animal') {
        if (f.left <= 0) fail('不能再打出动物');
        let err = animalError(g, pi, m.card, m.from, m.building, f.up);
        let ignored = false;
        if (err && canIgnoreCondition(f)) {
          const lenient = animalError(g, pi, m.card, m.from, m.building, f.up, true);
          if (lenient === null) {
            err = null;
            ignored = true;
          }
        }
        if (err) fail(err);
        if (ignored) {
          // 忽略 1 个条件：这只动物之后本次行动结束
          f.left = 1;
          log(g, pi, '动物行动 I：只打出 1 只动物，忽略它的 1 个条件');
        }
        f.left--;
        f.played++;
        if (f.left === 0) {
          pop(g);
          push(g, { k: 'animalsEnd', p: pi, rep: animalsRep(f.str, f.up) });
        }
        playAnimal(g, pi, m.card, m.from, m.building);
      } else if (m.t === 'done') {
        pop(g);
        push(g, { k: 'animalsEnd', p: pi, rep: f.played > 0 ? animalsRep(f.str, f.up) : 0 });
      } else fail('请打出动物或结束');
      break;

    case 'cards':
      if (m.t === 'draw') {
        const { draw, discard } = cardsDraw(f.str, f.up);
        const slots = [...new Set(m.display)];
        if (slots.length !== m.display.length) fail('重复的位置');
        if (slots.length && !f.up) fail('需要升级的卡牌行动才能从展示区抽牌');
        if (slots.length > draw) fail('抽牌数量超出');
        for (const s of slots) if (s < 0 || s >= Math.min(range(p), g.display.length)) fail('超出声望范围');
        pop(g);
        const taken = [...slots].sort((a, b) => b - a).map((s) => g.display.splice(s, 1)[0]);
        p.hand.push(...taken);
        refillDisplay(g);
        drawToHand(g, pi, draw - slots.length);
        advanceBreak(g, CARDS_BREAK);
        log(g, pi, `抽 ${draw} 张牌${slots.length ? `（其中 ${slots.length} 张来自展示区）` : ''}${discard ? `，弃 ${discard} 张` : ''}`);
        if (discard) {
          const k = Math.min(discard, p.hand.length);
          if (k) push(g, { k: 'pick', p: pi, purpose: 'discard', cards: [], min: k, max: k });
        }
      } else if (m.t === 'snap') {
        if (!canSnap(p, f.str, f.up)) fail('强度不足，不能直接从展示区拿牌');
        if (m.slot < 0 || m.slot >= Math.min(range(p), g.display.length)) fail('超出声望范围');
        pop(g);
        const c = takeDisplay(g, m.slot);
        p.hand.push(c);
        advanceBreak(g, CARDS_BREAK);
        log(g, pi, `从展示区 ${m.slot + 1} 号位拿走 ${card(c).name}`);
      } else fail('请选择抽牌方式');
      break;

    case 'assoc':
      if (m.t === 'assoc') {
        const task: TaskId = m.task;
        const value = TASK_VALUE[task];
        if (value > f.budget) fail('任务价值超过行动强度');
        if (f.used.includes(task)) fail('同一次行动中每项任务只能做一次');
        const need = workersNeeded(g, task);
        if (freeWorkers(g, pi) < need) fail(`需要 ${need} 名空闲的协会工人`);
        if (m.task === 'partner') {
          if (p.partners.includes(m.continent)) fail('已经有这个大洲的合作动物园');
          if (p.partners.length >= MAX_PARTNERS) fail(`最多 ${MAX_PARTNERS} 个合作动物园`);
          if (p.partners.length >= 2 && !p.upgraded.association) fail('第 3、4 个合作动物园需要升级的协会行动');
        } else if (m.task === 'university') {
          if (p.unis.includes(m.uni) || !university(m.uni)) fail('已经有这所大学');
        } else if (m.task === 'project') {
          const err = supportError(g, pi, m.project, m.level, m.fromHand, m.release, m.display, f.up);
          if (err) fail(err);
        }
        for (let i = 0; i < need; i++) g.tasks[task].push(pi);
        f.budget -= value;
        f.used.push(task);
        if (!f.up || (f.budget < 2 && (f.donated || p.money < donationCost(g.donationStep)))) pop(g);
        if (m.task === 'rep') {
          log(g, pi, '协会任务：声望 +2');
          gain(g, pi, { rep: 2 });
        } else if (m.task === 'partner') {
          p.partners.push(m.continent);
          log(g, pi, `协会任务：结交${continentName(m.continent)}合作动物园`);
          if (p.partners.length === 2) pushUpgrade(g, pi, '第 2 个合作动物园：升级 1 张行动卡');
          if (p.partners.length === 3) {
            gain(g, pi, { worker: 1 });
            log(g, pi, '第 3 个合作动物园：获得 1 名协会工人');
          }
        } else if (m.task === 'university') {
          p.unis.push(m.uni);
          const u = university(m.uni);
          log(g, pi, `协会任务：与${u.name}合作（${u.text}）`);
          if (u.rep) gain(g, pi, { rep: u.rep });
          if (p.unis.length === 2) pushUpgrade(g, pi, '第 2 所大学：升级 1 张行动卡');
        } else {
          supportProject(g, pi, m.project, m.level, m.fromHand, m.release, m.display);
        }
      } else if (m.t === 'donate') {
        if (!f.up || f.donated) fail('不能捐款');
        const cost = donationCost(g.donationStep);
        if (p.money < cost) fail('钱不够');
        p.money -= cost;
        g.donationStep++;
        p.donations++;
        f.donated = true;
        if (f.budget < 2) pop(g);
        log(g, pi, `捐款 ${cost} 元，获得 1 保护点数`);
        gain(g, pi, { cp: 1 });
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
        } else p.hand.splice(p.hand.indexOf(m.card), 1);
        f.budget -= c.level;
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

    case 'pick': {
      if (m.t !== 'cards') fail('请选择卡牌');
      const pool = f.cards.length ? f.cards : p.hand;
      const sel = m.cards;
      if (new Set(sel).size !== sel.length) fail('重复选择');
      for (const id of sel) if (!pool.includes(id)) fail('选择的卡不在可选范围内');
      const min = Math.min(f.min, pool.length);
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
        const err = placementError(p, m.type, m.cells, { ignoreTypeUpgrade: true });
        if (err) fail(err);
        const b = addBuilding(g, pi, m.type, m.cells);
        f.count--;
        if (f.count <= 0 || !f.types.some((t) => placements(p, t, { ignoreTypeUpgrade: true }).length)) pop(g);
        log(g, pi, `免费建造${buildingDef(m.type).name}`);
        afterBuild(g, pi, b);
      } else if (m.t === 'done') pop(g);
      else fail('请放置建筑或跳过');
      break;

    case 'display':
      if (m.t === 'take') {
        if (m.slot < 0 || m.slot >= g.display.length) fail('无效的位置');
        if (!f.any && m.slot >= range(p)) fail('超出声望范围');
        if (f.swap) {
          const c = g.display[m.slot];
          g.display[m.slot] = f.swap;
          p.hand.push(c);
          pop(g);
          log(g, pi, `交换：用 ${card(f.swap).name} 换走展示区的 ${card(c).name}`);
        } else {
          const c = takeDisplay(g, m.slot);
          p.hand.push(c);
          f.n--;
          if (f.n <= 0 || !g.display.length) pop(g);
          log(g, pi, `从展示区拿走 ${card(c).name}`);
        }
      } else if (m.t === 'done') {
        pop(g);
        if (f.swap) p.hand.push(f.swap);
      } else fail('请从展示区选择一张牌');
      break;
  }
  run(g);
}

function resolvePick(g: GameState, f: Extract<Frame, { k: 'pick' }>, sel: string[]) {
  const pi = f.p;
  const p = g.players[pi];
  const fromHand = (ids: string[]) => {
    for (const id of ids) p.hand.splice(p.hand.indexOf(id), 1);
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
      break;
    case 'scoringKeep':
      p.scoring = [...sel];
      g.scoringPile.push(...rest);
      log(g, pi, '保留 1 张终局计分卡');
      break;
    case 'sell':
      fromHand(sel);
      g.discard.push(...sel);
      if (sel.length) {
        p.money += 4 * sel.length;
        log(g, pi, `日光浴：出售 ${sel.length} 张手牌，获得 ${4 * sel.length} 元`);
      }
      break;
    case 'pouch': {
      if (!sel.length) break;
      fromHand(sel);
      const b = p.buildings.find((x) => x.uid === f.uid);
      if (b) (b.pouch ??= []).push(...sel);
      log(g, pi, `育儿袋：把 ${sel.length} 张牌放进育儿袋，吸引力 +${2 * sel.length}`);
      gain(g, pi, { appeal: 2 * sel.length });
      break;
    }
    case 'dig':
      fromHand(sel);
      g.discard.push(...sel);
      if (sel.length) {
        drawToHand(g, pi, sel.length);
        log(g, pi, `掘地：弃掉 ${sel.length} 张，再抽 ${sel.length} 张`);
      }
      break;
    case 'trade':
      if (sel.length) {
        fromHand(sel);
        push(g, { k: 'display', p: pi, n: 1, any: false, reason: '交换', swap: sel[0] });
      }
      break;
  }
}

/** 深拷贝状态（AI 模拟、撤销快照用） */
export function clone(g: GameState): GameState {
  return structuredClone(g);
}

export { sponsorError, iconName };
