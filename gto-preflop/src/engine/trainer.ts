// 训练：按筛选条件抽题（决策点 + 手牌），并给出评分。
import { type Card, HAND_COMBOS, HAND_COUNT, dealCombo } from '../poker/cards';
import { handFreqs, type SpotNode } from './types';

export interface TrainFilter {
  families: string[];
  heroes: string[];
  /** 边缘牌优先：减少一眼就能判断的手牌（如 72o 弃牌） */
  focus: boolean;
}

export interface Deal {
  node: SpotNode;
  hand: number;
  cards: [Card, Card];
  /** 随机数 0–99，随机数模式下决定混合策略该选哪个行动 */
  rng: number;
}

export type Grade = 'best' | 'good' | 'inaccurate' | 'wrong';

export interface Verdict {
  grade: Grade;
  correct: boolean;
  /** 所选行动的 GTO 频率 */
  freq: number;
  freqs: number[];
  /** 随机数模式下应选的行动 */
  rngAction?: number;
  /** 求解器节点：与最优行动相比损失的期望值（bb） */
  evLoss?: number;
}

/** 到达此处的组合数（按权重） */
export function reachCombos(n: SpotNode): number {
  let s = 0;
  for (let h = 0; h < HAND_COUNT; h++) s += n.heroReach[h] * HAND_COMBOS[h];
  return s;
}

export function eligibleNodes(nodes: Iterable<SpotNode>, f: TrainFilter): SpotNode[] {
  const out: SpotNode[] = [];
  for (const n of nodes) {
    if (!f.families.includes(n.family) || !f.heroes.includes(n.hero)) continue;
    if (reachCombos(n) < 0.5) continue;
    out.push(n);
  }
  return out;
}

const argmax = (xs: number[]) => xs.reduce((best, x, i) => (x > xs[best] ? i : best), 0);

/** 是否为"难题"：混合策略，或者在矩阵上与相邻手牌的主要行动不同（范围边缘） */
export function isBorderline(n: SpotNode, h: number): boolean {
  const freqs = handFreqs(n, h);
  if (Math.max(...freqs) < 0.9) return true;
  const main = argmax(freqs);
  const r = Math.floor(h / 13);
  const c = h % 13;
  for (const [dr, dc] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const rr = r + dr;
    const cc = c + dc;
    if (rr < 0 || rr > 12 || cc < 0 || cc > 12) continue;
    const j = rr * 13 + cc;
    if (n.heroReach[j] <= 0) continue;
    if (argmax(handFreqs(n, j)) !== main) return true;
  }
  return false;
}

/** 抽到每手牌的权重：组合数 × 到达概率 ×（边缘牌优先时的难度系数） */
export function handWeights(n: SpotNode, focus: boolean): Float64Array {
  const w = new Float64Array(HAND_COUNT);
  for (let h = 0; h < HAND_COUNT; h++) {
    const base = HAND_COMBOS[h] * n.heroReach[h];
    if (base <= 0) continue;
    w[h] = focus ? base * (isBorderline(n, h) ? 1 : 0.12) : base;
  }
  return w;
}

function pickWeighted(w: ArrayLike<number>, rnd: () => number): number {
  let total = 0;
  for (let i = 0; i < w.length; i++) total += w[i];
  let x = rnd() * total;
  for (let i = 0; i < w.length; i++) {
    x -= w[i];
    if (x < 0 && w[i] > 0) return i;
  }
  for (let i = w.length - 1; i >= 0; i--) if (w[i] > 0) return i;
  return 0;
}

export function dealFrom(n: SpotNode, hand: number, rnd: () => number = Math.random): Deal {
  return { node: n, hand, cards: dealCombo(hand, rnd), rng: Math.floor(rnd() * 100) };
}

export function deal(nodes: SpotNode[], f: TrainFilter, rnd: () => number = Math.random): Deal | null {
  if (!nodes.length) return null;
  const n = nodes[Math.floor(rnd() * nodes.length)];
  const hand = pickWeighted(handWeights(n, f.focus), rnd);
  return dealFrom(n, hand, rnd);
}

/**
 * 随机数模式：按"激进 → 保守"的顺序（全下、加注、跟注、弃牌）累加频率，
 * 随机数落在哪一段就选哪个行动。例如加注 30%、跟注 50%：0–29 加注，30–79 跟注，80–99 弃牌。
 */
export function rngAction(freqs: number[], rng: number): number {
  let acc = 0;
  for (let a = freqs.length - 1; a >= 0; a--) {
    acc += freqs[a] * 100;
    if (rng < acc - 1e-9) return a;
  }
  return argmax(freqs);
}

export function grade(n: SpotNode, hand: number, action: number, rngMode: boolean, rng: number): Verdict {
  const freqs = handFreqs(n, hand);
  const f = freqs[action];
  const max = Math.max(...freqs);
  let evLoss: number | undefined;
  if (n.ev) {
    const k = n.actions.length;
    const evs = Array.from(n.ev.subarray(hand * k, hand * k + k));
    if (evs.every(Number.isFinite)) evLoss = Math.max(0, Math.max(...evs) - evs[action]);
  }
  if (rngMode) {
    const target = rngAction(freqs, rng);
    const correct = target === action;
    return { grade: correct ? 'best' : f >= 0.05 ? 'inaccurate' : 'wrong', correct, freq: f, freqs, rngAction: target, evLoss };
  }
  let g: Grade;
  if (f >= max - 1e-6 || f >= 0.5) g = 'best';
  else if (f >= 0.2) g = 'good';
  else if (f >= 0.05) g = 'inaccurate';
  else g = 'wrong';
  return { grade: g, correct: g === 'best' || g === 'good', freq: f, freqs, evLoss };
}

export const GRADE_TEXT: Record<Grade, string> = {
  best: '正确',
  good: '可以（混合策略）',
  inaccurate: '不够准确',
  wrong: '错误',
};
