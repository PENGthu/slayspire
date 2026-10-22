// 起手牌类别之间的全下胜率（预先算好的表，见 scripts/gen-equity.mjs）。
import { EQUITY_B64 } from '../data/equity';
import { HAND_COUNT, pairWeights } from './cards';

let table: Float64Array | null = null;

function decode(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array((globalThis as unknown as { Buffer: { from(s: string, e: string): Uint8Array } }).Buffer.from(b64, 'base64'));
}

/** 完整的 169×169 胜率矩阵：E[a*169+b] = a 对 b 的胜率 */
export function equityMatrix(): Float64Array {
  if (table) return table;
  const bytes = decode(EQUITY_B64);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const m = new Float64Array(HAND_COUNT * HAND_COUNT);
  let k = 0;
  for (let a = 0; a < HAND_COUNT; a++) {
    m[a * HAND_COUNT + a] = 0.5;
    for (let b = a + 1; b < HAND_COUNT; b++) {
      const e = view.getUint16(2 * k++, true) / 65535;
      m[a * HAND_COUNT + b] = e;
      m[b * HAND_COUNT + a] = 1 - e;
    }
  }
  table = m;
  return m;
}

export function equity(a: number, b: number): number {
  return equityMatrix()[a * HAND_COUNT + b];
}

/**
 * 一手牌对抗一个范围的胜率（考虑卡牌移除）。
 * 范围里没有任何与之不冲突的组合时返回 NaN。
 */
export function equityVsRange(hand: number, range: ArrayLike<number>): number {
  const e = equityMatrix();
  const w = pairWeights();
  let num = 0;
  let den = 0;
  const row = hand * HAND_COUNT;
  for (let j = 0; j < HAND_COUNT; j++) {
    const x = w[row + j] * range[j];
    if (x <= 0) continue;
    num += x * e[row + j];
    den += x;
  }
  return den > 0 ? num / den : NaN;
}
