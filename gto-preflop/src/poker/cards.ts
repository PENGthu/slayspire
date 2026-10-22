// 牌与 169 个起手牌类别。
//
// 类别按 13×13 矩阵编号：idx = 行 * 13 + 列，行列 0 = A … 12 = 2。
// 对角线是对子，右上（行 < 列）是同花，左下（行 > 列）是杂色。
// 具体的牌编号为 点数 * 4 + 花色，点数同样 0 = A，花色 0 ♠ 1 ♥ 2 ♦ 3 ♣。

export const RANKS = 'AKQJT98765432';
export const SUITS = ['s', 'h', 'd', 'c'] as const;
export const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣'];
export const HAND_COUNT = 169;

export type Card = number;

export function cardRank(c: Card): number {
  return c >> 2;
}
export function cardSuit(c: Card): number {
  return c & 3;
}
export function cardLabel(c: Card): string {
  return RANKS[cardRank(c)] + SUITS[cardSuit(c)];
}

export type HandKind = 'pair' | 'suited' | 'offsuit';

export function handKind(idx: number): HandKind {
  const r = Math.floor(idx / 13);
  const c = idx % 13;
  return r === c ? 'pair' : r < c ? 'suited' : 'offsuit';
}

/** 高牌、低牌的点数（0 = A） */
export function handRanks(idx: number): [number, number] {
  const r = Math.floor(idx / 13);
  const c = idx % 13;
  return r <= c ? [r, c] : [c, r];
}

export function handLabel(idx: number): string {
  const [hi, lo] = handRanks(idx);
  const kind = handKind(idx);
  return RANKS[hi] + RANKS[lo] + (kind === 'pair' ? '' : kind === 'suited' ? 's' : 'o');
}

export function combosOf(idx: number): number {
  const kind = handKind(idx);
  return kind === 'pair' ? 6 : kind === 'suited' ? 4 : 12;
}

export const HAND_LABELS: string[] = Array.from({ length: HAND_COUNT }, (_, i) => handLabel(i));
export const HAND_COMBOS: number[] = Array.from({ length: HAND_COUNT }, (_, i) => combosOf(i));
export const TOTAL_COMBOS = 1326;

/** 由标签（AKs / 77 / T9o）找类别编号；无效时返回 -1 */
export function handIndex(label: string): number {
  const s = label.trim();
  if (s.length < 2) return -1;
  const a = RANKS.indexOf(s[0].toUpperCase());
  const b = RANKS.indexOf(s[1].toUpperCase());
  if (a < 0 || b < 0) return -1;
  if (a === b) return s.length === 2 ? a * 13 + a : -1;
  const suffix = s[2]?.toLowerCase();
  const hi = Math.min(a, b);
  const lo = Math.max(a, b);
  if (suffix === 's') return hi * 13 + lo;
  if (suffix === 'o') return lo * 13 + hi;
  return -1;
}

/** 某个类别的全部具体组合 */
export function combosList(idx: number): [Card, Card][] {
  const [hi, lo] = handRanks(idx);
  const kind = handKind(idx);
  const out: [Card, Card][] = [];
  if (kind === 'pair') {
    for (let s1 = 0; s1 < 4; s1++) for (let s2 = s1 + 1; s2 < 4; s2++) out.push([hi * 4 + s1, hi * 4 + s2]);
  } else if (kind === 'suited') {
    for (let s = 0; s < 4; s++) out.push([hi * 4 + s, lo * 4 + s]);
  } else {
    for (let s1 = 0; s1 < 4; s1++) for (let s2 = 0; s2 < 4; s2++) if (s1 !== s2) out.push([hi * 4 + s1, lo * 4 + s2]);
  }
  return out;
}

/** 从类别里随机发一手具体的牌（高牌在前） */
export function dealCombo(idx: number, rnd: () => number = Math.random): [Card, Card] {
  const list = combosList(idx);
  return list[Math.floor(rnd() * list.length)];
}

/** 具体两张牌所属的类别 */
export function classOfCards(a: Card, b: Card): number {
  const ra = cardRank(a);
  const rb = cardRank(b);
  if (ra === rb) return ra * 13 + ra;
  const hi = Math.min(ra, rb);
  const lo = Math.max(ra, rb);
  return cardSuit(a) === cardSuit(b) ? hi * 13 + lo : lo * 13 + hi;
}

/**
 * 两个类别之间互不冲突的组合对数量（卡牌移除）。W[a*169+b]，对称。
 * 例如 AA 对 AKs：每个 AKs 组合只剩 3 个 AA 组合，共 12 对而不是 24 对。
 */
let pairWeightsCache: Float64Array | null = null;
export function pairWeights(): Float64Array {
  if (pairWeightsCache) return pairWeightsCache;
  const w = new Float64Array(HAND_COUNT * HAND_COUNT);
  const all: { cls: number; mask: bigint }[] = [];
  for (let i = 0; i < HAND_COUNT; i++)
    for (const [a, b] of combosList(i)) all.push({ cls: i, mask: (1n << BigInt(a)) | (1n << BigInt(b)) });
  // 用两个 32 位整数代替 bigint 做冲突判断，快得多
  const lo = all.map((x) => Number(x.mask & 0xffffffffn));
  const hi = all.map((x) => Number(x.mask >> 32n));
  for (let i = 0; i < all.length; i++) {
    const ci = all[i].cls * HAND_COUNT;
    for (let j = 0; j < all.length; j++) {
      if ((lo[i] & lo[j]) !== 0 || (hi[i] & hi[j]) !== 0) continue;
      w[ci + all[j].cls] += 1;
    }
  }
  pairWeightsCache = w;
  return w;
}
