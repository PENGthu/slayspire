let uidCounter = 1;

/** 全局唯一 id（卡牌、生物） */
export function nextUid(): number {
  return uidCounter++;
}

/** 读档后确保后续 uid 不与已有 id 冲突 */
export function bumpUid(min: number) {
  if (uidCounter <= min) uidCounter = min + 1;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function remove<T>(arr: T[], item: T): boolean {
  const i = arr.indexOf(item);
  if (i >= 0) {
    arr.splice(i, 1);
    return true;
  }
  return false;
}

export function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}
