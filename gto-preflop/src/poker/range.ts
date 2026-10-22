// 范围记法：解析 "22+, A2s+, KTo+, 99-66, AKs:0.5, A5s:50%" 这类常见写法，以及反向压缩成记法。
import { HAND_COMBOS, HAND_COUNT, RANKS } from './cards';

/** 169 个类别各自的权重（0–1） */
export type Range = Float32Array;

export function emptyRange(): Range {
  return new Float32Array(HAND_COUNT);
}

const pairIdx = (r: number) => r * 13 + r;
const suitedIdx = (hi: number, lo: number) => hi * 13 + lo;
const offIdx = (hi: number, lo: number) => lo * 13 + hi;

export class RangeParseError extends Error {}

function rank(ch: string, token: string): number {
  const r = RANKS.indexOf(ch.toUpperCase());
  if (r < 0) throw new RangeParseError(`无法识别的点数 "${ch}"（${token}）`);
  return r;
}

/** 解析一个不含权重的记号，返回涉及的类别编号 */
function expandToken(tok: string): number[] {
  const t = tok.trim();
  if (!t) return [];
  const out: number[] = [];
  const m = t.match(/^([2-9TJQKA])([2-9TJQKA])([so]?)(\+?)(?:-([2-9TJQKA])([2-9TJQKA])([so]?))?$/i);
  if (!m) throw new RangeParseError(`无法识别的记号 "${t}"`);
  const [, a1, b1, s1raw, plus, a2, b2, s2raw] = m;
  const s1 = s1raw.toLowerCase();
  const s2 = (s2raw ?? '').toLowerCase();
  const r1 = rank(a1, t);
  const k1 = rank(b1, t);
  const kinds = (s: string) => (s === 's' ? ['s'] : s === 'o' ? ['o'] : ['s', 'o']);
  const push = (hi: number, lo: number, s: string) => {
    for (const k of kinds(s)) out.push(k === 's' ? suitedIdx(hi, lo) : offIdx(hi, lo));
  };

  if (r1 === k1) {
    if (s1) throw new RangeParseError(`对子不能带 s/o（${t}）`);
    if (plus) {
      for (let r = r1; r >= 0; r--) out.push(pairIdx(r));
    } else if (a2) {
      const r2 = rank(a2, t);
      if (rank(b2, t) !== r2) throw new RangeParseError(`对子区间两端都应是对子（${t}）`);
      const [from, to] = r1 < r2 ? [r1, r2] : [r2, r1];
      for (let r = from; r <= to; r++) out.push(pairIdx(r));
    } else out.push(pairIdx(r1));
    return out;
  }

  const hi = Math.min(r1, k1);
  const lo = Math.max(r1, k1);
  if (plus) {
    // A2s+ = A2s…AKs：高牌不动，踢脚一直升到比高牌小一级
    for (let k = lo; k > hi; k--) push(hi, k, s1);
  } else if (a2) {
    const h2 = Math.min(rank(a2, t), rank(b2, t));
    const l2 = Math.max(rank(a2, t), rank(b2, t));
    if (h2 !== hi) throw new RangeParseError(`区间两端的高牌应相同（${t}）`);
    if (s2 && s2 !== s1) throw new RangeParseError(`区间两端的同花/杂色应一致（${t}）`);
    const [from, to] = lo < l2 ? [lo, l2] : [l2, lo];
    for (let k = from; k <= to; k++) push(hi, k, s1);
  } else push(hi, lo, s1);
  return out;
}

/** 解析范围记法；同一手牌出现多次时以后出现的为准 */
export function parseRange(text: string): Range {
  const r = emptyRange();
  for (const raw of text.split(/[,\s]+/)) {
    if (!raw.trim()) continue;
    let tok = raw;
    let w = 1;
    const colon = raw.indexOf(':');
    if (colon >= 0) {
      tok = raw.slice(0, colon);
      const ws = raw.slice(colon + 1).trim();
      const pct = ws.endsWith('%');
      const v = Number(pct ? ws.slice(0, -1) : ws);
      if (!Number.isFinite(v) || v < 0) throw new RangeParseError(`无效的权重 "${raw}"`);
      w = pct || v > 1 ? v / 100 : v;
      if (w > 1) throw new RangeParseError(`权重不能超过 100%（${raw}）`);
    }
    for (const i of expandToken(tok)) r[i] = w;
  }
  return r;
}

/** 范围内的组合数（按权重） */
export function rangeCombos(r: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < HAND_COUNT; i++) s += r[i] * HAND_COMBOS[i];
  return s;
}

/** 把一组权重相同的类别压缩为记号 */
function compress(set: Set<number>): string[] {
  const out: string[] = [];
  // 对子：连续一段，顶到 AA 写成 XX+
  let r = 0;
  while (r < 13) {
    if (!set.has(pairIdx(r))) {
      r++;
      continue;
    }
    let end = r;
    while (end + 1 < 13 && set.has(pairIdx(end + 1))) end++;
    const top = RANKS[r] + RANKS[r];
    const bottom = RANKS[end] + RANKS[end];
    if (r === end) out.push(top);
    else if (r === 0) out.push(`${bottom}+`);
    else out.push(`${top}-${bottom}`);
    r = end + 1;
  }
  for (const kind of ['s', 'o'] as const) {
    for (let hi = 0; hi < 12; hi++) {
      const idx = (lo: number) => (kind === 's' ? suitedIdx(hi, lo) : offIdx(hi, lo));
      let lo = hi + 1;
      while (lo < 13) {
        if (!set.has(idx(lo))) {
          lo++;
          continue;
        }
        let end = lo;
        while (end + 1 < 13 && set.has(idx(end + 1))) end++;
        const name = (k: number) => RANKS[hi] + RANKS[k] + kind;
        if (lo === end) out.push(name(lo));
        else if (lo === hi + 1) out.push(`${name(end)}+`);
        else out.push(`${name(lo)}-${name(end)}`);
        lo = end + 1;
      }
    }
  }
  return out;
}

/** 把权重压缩成范围记法，例如 "TT+, AKs, A5s:0.5"（权重保留两位小数） */
export function formatRange(r: ArrayLike<number>): string {
  const groups = new Map<number, Set<number>>();
  for (let i = 0; i < HAND_COUNT; i++) {
    const w = Math.round(r[i] * 100) / 100;
    if (w <= 0) continue;
    if (!groups.has(w)) groups.set(w, new Set());
    groups.get(w)!.add(i);
  }
  const parts: string[] = [];
  for (const w of [...groups.keys()].sort((a, b) => b - a)) {
    for (const tok of compress(groups.get(w)!)) parts.push(w >= 1 ? tok : `${tok}:${w}`);
  }
  return parts.join(', ');
}
