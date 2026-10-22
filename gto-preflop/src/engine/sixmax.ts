// 6 人桌 100bb 的翻前决策树：把 data/sixmax.ts 里的范围展开成一个个决策点，并沿行动线算出双方的范围。
import { POSITIONS, type Pos, RFI, VS_3BET, VS_4BET, VS_5BET, VS_OPEN } from '../data/sixmax';
import { HAND_COUNT } from '../poker/cards';
import { parseRange, type Range } from '../poker/range';
import type { ActionDef, LineStep, SpotNode } from './types';

export const SIXMAX_STACK = 100;
export const FAMILY_NAMES: Record<string, string> = {
  RFI: '开池',
  VO: '面对开池',
  V3: '面对 3-Bet',
  V4: '面对 4-Bet',
  V5: '面对 5-Bet',
  VA: '面对全下',
};
export const FAMILIES = ['RFI', 'VO', 'V3', 'V4', 'V5'] as const;

const idx = (p: Pos) => POSITIONS.indexOf(p);
const after = (p: Pos) => POSITIONS.slice(idx(p) + 1) as Pos[];
const before = (p: Pos) => POSITIONS.slice(0, idx(p)) as Pos[];
const between = (a: Pos, b: Pos) => POSITIONS.slice(idx(a) + 1, idx(b)) as Pos[];
const isBlind = (p: Pos) => p === 'SB' || p === 'BB';

export const openTo = (p: Pos) => (p === 'SB' ? 3 : 2.5);
export function threeBetTo(hero: Pos, opener: Pos): number {
  if (hero === 'SB') return 11;
  if (hero === 'BB') return opener === 'SB' ? 9 : 12;
  return 7.5;
}
export function fourBetTo(opener: Pos, threeBettor: Pos): number {
  if (opener === 'SB') return 22;
  return isBlind(threeBettor) ? 25 : 20;
}

export const nodeKey = {
  rfi: (p: Pos) => `6max/RFI/${p}`,
  vo: (hero: Pos, opener: Pos) => `6max/VO/${hero}/${opener}`,
  v3: (opener: Pos, tb: Pos) => `6max/V3/${opener}/${tb}`,
  v4: (tb: Pos, opener: Pos) => `6max/V4/${tb}/${opener}`,
  v5: (opener: Pos, tb: Pos) => `6max/V5/${opener}/${tb}`,
};

/** 开池者在 3-Bet 底池里有没有位置，决定用哪一组面对 3-Bet 的范围 */
export function vs3betTemplate(opener: Pos, tb: Pos): string {
  if (opener === 'SB') return 'SB-OOP';
  if (opener === 'BTN') return 'BTN-IP';
  return `${opener}-${isBlind(tb) ? 'IP' : 'OOP'}`;
}
export function vs4betTemplate(tb: Pos, opener: Pos): string {
  const heroIP = !(tb === 'SB' || (tb === 'BB' && opener !== 'SB'));
  const group = opener === 'UTG' || opener === 'HJ' ? 'EARLY' : opener === 'CO' ? 'LATE' : 'STEAL';
  return `${heroIP ? 'IP' : 'OOP'}-${group}`;
}
export const vs5betTemplate = (opener: Pos) => (opener === 'UTG' || opener === 'HJ' ? 'EARLY' : 'LATE');

const A = {
  fold: (): ActionDef => ({ id: 'fold', kind: 'fold', label: '弃牌', short: '弃牌', tone: 'fold', key: 'f' }),
  call: (): ActionDef => ({ id: 'call', kind: 'call', label: '跟注', short: '跟注', tone: 'call', key: 'c' }),
  open: (to: number): ActionDef => ({ id: 'raise', kind: 'raise', label: `加注 ${to}`, short: '加注', to, tone: 'raise', key: 'r' }),
  threebet: (to: number): ActionDef => ({ id: 'raise', kind: 'raise', label: `3-Bet ${to}`, short: '3-Bet', to, tone: 'raise', key: 'r' }),
  fourbet: (to: number): ActionDef => ({ id: 'raise', kind: 'raise', label: `4-Bet ${to}`, short: '4-Bet', to, tone: 'raise2', key: 'r' }),
  allin: (to: number): ActionDef => ({ id: 'allin', kind: 'allin', label: `全下 ${to}`, short: '全下', to, tone: 'allin', key: 'a' }),
};

const folds = (ps: Pos[]): LineStep[] => ps.map((pos) => ({ pos, kind: 'fold' }));

/** 由各非弃牌行动的范围拼出策略矩阵（弃牌 = 剩余部分） */
function strategyFrom(parts: (Range | null)[], warnings: string[], key: string): Float32Array {
  const k = parts.length + 1;
  const s = new Float32Array(HAND_COUNT * k);
  for (let h = 0; h < HAND_COUNT; h++) {
    let sum = 0;
    for (let a = 0; a < parts.length; a++) sum += parts[a]?.[h] ?? 0;
    const scale = sum > 1 + 1e-6 ? 1 / sum : 1;
    if (scale < 1) warnings.push(`${key}: 第 ${h} 手牌的频率之和为 ${sum.toFixed(2)}`);
    let rest = 1;
    for (let a = 0; a < parts.length; a++) {
      const f = (parts[a]?.[h] ?? 0) * scale;
      s[h * k + a + 1] = f;
      rest -= f;
    }
    s[h * k] = Math.max(0, rest);
  }
  return s;
}

const column = (n: SpotNode, a: number): Float32Array => {
  const k = n.actions.length;
  const out = new Float32Array(HAND_COUNT);
  for (let h = 0; h < HAND_COUNT; h++) out[h] = n.strategy[h * k + a];
  return out;
};
const mul = (x: Float32Array, y: Float32Array) => x.map((v, i) => v * y[i]);
const ones = () => new Float32Array(HAND_COUNT).fill(1);

export interface SixMaxTree {
  nodes: Map<string, SpotNode>;
  /** 数据里频率之和超过 1 等问题（正常应为空） */
  warnings: string[];
}

/** 用户编辑过的策略：节点 → 169 × 行动数 */
export type Overrides = Record<string, ArrayLike<number>>;

/** 不在范围内的手牌统一记为弃牌，避免显示无意义的频率 */
function maskByReach(s: Float32Array, reach: Float32Array, k: number) {
  for (let h = 0; h < HAND_COUNT; h++) {
    if (reach[h] > 0) continue;
    s[h * k] = 1;
    for (let a = 1; a < k; a++) s[h * k + a] = 0;
  }
}

export function buildSixMax(overrides: Overrides = {}): SixMaxTree {
  const nodes = new Map<string, SpotNode>();
  const warnings: string[] = [];
  const blinds = { SB: 0.5, BB: 1 };
  const seats = [...POSITIONS];
  const base = { source: 'sixmax' as const, seats, stack: SIXMAX_STACK, ante: 0, blinds };

  const finish = (n: SpotNode) => {
    const o = overrides[n.key];
    if (o && o.length === n.strategy.length) n.strategy = Float32Array.from(o);
    maskByReach(n.strategy, n.heroReach, n.actions.length);
    nodes.set(n.key, n);
    return n;
  };

  // 开池
  for (const p of POSITIONS) {
    if (p === 'BB') continue;
    const nextHero = after(p)[0];
    const to = openTo(p);
    finish({
      ...base,
      key: nodeKey.rfi(p),
      family: 'RFI',
      title: `${p} 开池`,
      hero: p,
      line: folds(before(p)),
      actions: [A.fold(), A.open(to)],
      strategy: strategyFrom([parseRange(RFI[p])], warnings, nodeKey.rfi(p)),
      heroReach: ones(),
      children: [nextHero !== 'BB' ? nodeKey.rfi(nextHero) : null, nodeKey.vo(nextHero, p)],
    });
  }

  // 面对开池
  for (const o of POSITIONS) {
    if (o === 'BB') continue;
    const rfi = nodes.get(nodeKey.rfi(o))!;
    const openRange = column(rfi, 1);
    for (const h of after(o)) {
      const data = VS_OPEN[`${h}>${o}`];
      const tb = threeBetTo(h, o);
      const nextHero = after(h)[0];
      finish({
        ...base,
        key: nodeKey.vo(h, o),
        family: 'VO',
        title: `${h} 面对 ${o} 开池`,
        hero: h,
        villain: o,
        line: [...folds(before(o)), { pos: o, kind: 'raise', to: openTo(o) }, ...folds(between(o, h))],
        actions: [A.fold(), A.call(), A.threebet(tb)],
        strategy: strategyFrom([parseRange(data.call), parseRange(data.threebet)], warnings, nodeKey.vo(h, o)),
        heroReach: ones(),
        villainReach: openRange,
        children: [nextHero ? nodeKey.vo(nextHero, o) : null, null, nodeKey.v3(o, h)],
      });
    }
  }

  // 开池后面对 3-Bet
  for (const o of POSITIONS) {
    if (o === 'BB') continue;
    const openRange = column(nodes.get(nodeKey.rfi(o))!, 1);
    for (const t of after(o)) {
      const vo = nodes.get(nodeKey.vo(t, o))!;
      const data = VS_3BET[vs3betTemplate(o, t)];
      const tb = threeBetTo(t, o);
      const fb = fourBetTo(o, t);
      finish({
        ...base,
        key: nodeKey.v3(o, t),
        family: 'V3',
        title: `${o} 开池后面对 ${t} 3-Bet`,
        hero: o,
        villain: t,
        line: [
          ...folds(before(o)),
          { pos: o, kind: 'raise', to: openTo(o) },
          ...folds(between(o, t)),
          { pos: t, kind: 'raise', to: tb, name: '3-Bet' },
          ...folds(after(t)),
        ],
        actions: [A.fold(), A.call(), A.fourbet(fb)],
        strategy: strategyFrom([parseRange(data.call), parseRange(data.fourbet)], warnings, nodeKey.v3(o, t)),
        heroReach: openRange,
        villainReach: column(vo, 2),
        children: [null, null, nodeKey.v4(t, o)],
      });
    }
  }

  // 3-Bet 后面对 4-Bet
  for (const o of POSITIONS) {
    if (o === 'BB') continue;
    const openRange = column(nodes.get(nodeKey.rfi(o))!, 1);
    for (const t of after(o)) {
      const vo = nodes.get(nodeKey.vo(t, o))!;
      const v3 = nodes.get(nodeKey.v3(o, t))!;
      const data = VS_4BET[vs4betTemplate(t, o)];
      finish({
        ...base,
        key: nodeKey.v4(t, o),
        family: 'V4',
        title: `${t} 3-Bet 后面对 ${o} 4-Bet`,
        hero: t,
        villain: o,
        line: [...v3.line, { pos: o, kind: 'raise', to: fourBetTo(o, t), name: '4-Bet' }],
        actions: [A.fold(), A.call(), A.allin(SIXMAX_STACK)],
        strategy: strategyFrom([parseRange(data.call), parseRange(data.allin)], warnings, nodeKey.v4(t, o)),
        heroReach: column(vo, 2),
        villainReach: mul(openRange, column(v3, 2)),
        children: [null, null, nodeKey.v5(o, t)],
      });
    }
  }

  // 4-Bet 后面对 5-Bet 全下
  for (const o of POSITIONS) {
    if (o === 'BB') continue;
    const openRange = column(nodes.get(nodeKey.rfi(o))!, 1);
    for (const t of after(o)) {
      const vo = nodes.get(nodeKey.vo(t, o))!;
      const v3 = nodes.get(nodeKey.v3(o, t))!;
      const v4 = nodes.get(nodeKey.v4(t, o))!;
      const data = VS_5BET[vs5betTemplate(o)];
      finish({
        ...base,
        key: nodeKey.v5(o, t),
        family: 'V5',
        title: `${o} 4-Bet 后面对 ${t} 全下`,
        hero: o,
        villain: t,
        line: [...v4.line, { pos: t, kind: 'allin', to: SIXMAX_STACK }],
        actions: [A.fold(), A.call()],
        strategy: strategyFrom([parseRange(data.call)], warnings, nodeKey.v5(o, t)),
        heroReach: mul(openRange, column(v3, 2)),
        villainReach: mul(column(vo, 2), column(v4, 2)),
        children: [null, null],
      });
    }
  }

  return { nodes, warnings };
}

/** 未经编辑的默认策略（用于"恢复默认"） */
let defaults: SixMaxTree | null = null;
export function defaultSixMax(): SixMaxTree {
  defaults ??= buildSixMax();
  return defaults;
}

export { POSITIONS };
export type { Pos };
