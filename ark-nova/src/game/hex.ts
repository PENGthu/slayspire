// 六边形网格（尖顶朝上，奇数行右移）。地图格子用下标引用，形状用轴坐标 (q, r) 描述。

export type Axial = [number, number];

export const DIRS: Axial[] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

export function offsetToAxial(col: number, row: number): Axial {
  return [col - (row - (row & 1)) / 2, row];
}

export function axialToOffset(q: number, r: number): [number, number] {
  return [q + (r - (r & 1)) / 2, r];
}

export function hexDistance(a: Axial, b: Axial): number {
  const dq = a[0] - b[0];
  const dr = a[1] - b[1];
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** 旋转 60°：(q, r) → (−r, q + r) */
function rotate([q, r]: Axial): Axial {
  return [-r, q + r];
}

/** 镜像：交换立方坐标的 x 与 z */
function mirror([q, r]: Axial): Axial {
  return [r, q];
}

function key(cells: Axial[]): string {
  const minR = Math.min(...cells.map((c) => c[1]));
  const minQ = Math.min(...cells.filter((c) => c[1] === minR).map((c) => c[0]));
  return cells
    .map(([q, r]) => [q - minQ, r - minR] as Axial)
    .sort((a, b) => a[1] - b[1] || a[0] - b[0])
    .map((c) => c.join(','))
    .join(';');
}

/** 以最靠中心的格子为原点 */
function centre(cells: Axial[]): Axial[] {
  let best = cells[0];
  let bestD = Infinity;
  for (const c of cells) {
    const d = cells.reduce((s, o) => s + hexDistance(c, o), 0);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return cells.map(([q, r]) => [q - best[0], r - best[1]] as Axial);
}

const orientCache = new Map<string, Axial[][]>();

/** 形状所有不同的朝向（旋转 × 镜像，去重），每个朝向以中心格为原点 */
export function orientations(shape: Axial[]): Axial[][] {
  const k = key(shape);
  const hit = orientCache.get(k);
  if (hit) return hit;
  const seen = new Set<string>();
  const out: Axial[][] = [];
  for (const flip of [false, true]) {
    let cur = flip ? shape.map(mirror) : shape.map((c) => [...c] as Axial);
    for (let i = 0; i < 6; i++) {
      const kk = key(cur);
      if (!seen.has(kk)) {
        seen.add(kk);
        out.push(centre(cur));
      }
      cur = cur.map(rotate);
    }
  }
  orientCache.set(k, out);
  return out;
}

/** 六边形中心的像素坐标（尖顶，边长 size） */
export function hexToPixel(q: number, r: number, size: number): [number, number] {
  return [size * Math.sqrt(3) * (q + r / 2), size * 1.5 * r];
}

/** 尖顶六边形的六个顶点 */
export function hexCorners(cx: number, cy: number, size: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    out.push([cx + size * Math.cos(a), cy + size * Math.sin(a)]);
  }
  return out;
}
