/**
 * 敌人立绘的通用部件：眼睛、阴影、尖刺、长袍人形、骑士、史莱姆等。
 */
import { INK, circle, dot, ellipse, fill, glow, ink, limb, line, mix, place, shade } from './kit';
import { M } from './palettes';

// ---------------------------------------------------------------- 通用部件

/** 发光的眼睛 */
export function eye(x: number, y: number, r: number, col = '#ffe066', pupil = true): string {
  return glow(x, y, r * 3, col, 0.55) + circle(x, y, r, col, 2) + (pupil ? dot(x - r * 0.2, y, r * 0.42, INK) : '') + dot(x - r * 0.35, y - r * 0.35, r * 0.25, '#fff', 0.9);
}

/** 地面阴影 */
export function shadow(w = 70, x = 100): string {
  return `<ellipse cx="${x}" cy="192" rx="${w}" ry="7" fill="#000" opacity="0.45"/>`;
}

/** 右下侧的暗部（叠加在形状上） */
export function dark(d: string, o = 0.22): string {
  return fill(d, '#000', o);
}

export function hi(d: string, w = 2.4, o = 0.55): string {
  return line(d, '#fff', w, o);
}

/** 尖刺排列 */
export function spikes(cx: number, cy: number, rx: number, ry: number, n: number, len: number, col: string, from = 200, to = 340): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = ((from + ((to - from) * i) / (n - 1)) * Math.PI) / 180;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    const tx = cx + Math.cos(a) * (rx + len);
    const ty = cy + Math.sin(a) * (ry + len);
    const px = Math.cos(a + Math.PI / 2) * 6;
    const py = Math.sin(a + Math.PI / 2) * 6;
    s += ink(`M${(x - px).toFixed(1)} ${(y - py).toFixed(1)} L${tx.toFixed(1)} ${ty.toFixed(1)} L${(x + px).toFixed(1)} ${(y + py).toFixed(1)} Z`, col, 2.2);
  }
  return s;
}

/** 昆虫腿 */
export function bugLegs(xs: number[], y: number, col: string, len = 26): string {
  return xs.map((x, i) => limb(`M${x} ${y} L${x - 8 + i * 2} ${y + len * 0.55} L${x - 14 + i * 3} ${y + len}`, col, 4)).join('');
}

// ---------------------------------------------------------------- 人形模板

export interface Robed {
  robe: string;
  trim: string;
  head: string;
  /** 头部（以 (0,0) 为头部中心） */
  face: string;
  staff?: string;
  extra?: string;
  w?: number;
}

export function robed(o: Robed): string {
  const w = o.w ?? 1;
  const rx = 46 * w;
  return (
    shadow(60 * w) +
    // 长袍
    ink(`M${100 - rx * 0.55} 72 C${100 - rx} 110 ${100 - rx * 1.15} 160 ${100 - rx * 1.2} 190 L${100 + rx * 1.2} 190 C${100 + rx * 1.15} 160 ${100 + rx} 110 ${100 + rx * 0.55} 72 Z`, o.robe) +
    dark(`M100 72 L${100 + rx * 0.55} 72 C${100 + rx} 110 ${100 + rx * 1.15} 160 ${100 + rx * 1.2} 190 L112 190 C118 150 112 110 100 72 Z`, 0.25) +
    ink(`M${100 - rx * 1.2} 190 L${100 + rx * 1.2} 190 L${100 + rx * 1.18} 180 L${100 - rx * 1.18} 180 Z`, o.trim, 2.4) +
    line(`M${100 - rx * 0.4} 90 C${100 - rx * 0.6} 120 ${100 - rx * 0.7} 150 ${100 - rx * 0.75} 178`, mix(o.robe, '#000', 0.4), 2.4, 0.7) +
    ink(`M${100 - rx * 0.62} 74 C${100 - rx * 0.3} 88 ${100 + rx * 0.3} 88 ${100 + rx * 0.62} 74 L${100 + rx * 0.5} 64 C${100 + rx * 0.2} 72 ${100 - rx * 0.2} 72 ${100 - rx * 0.5} 64 Z`, o.trim, 2.4) +
    (o.staff ?? '') +
    // 手臂
    ink(`M${100 - rx * 0.5} 80 C${100 - rx * 0.95} 100 ${100 - rx * 1.05} 120 ${100 - rx * 0.95} 132 L${100 - rx * 0.7} 136 C${100 - rx * 0.66} 120 ${100 - rx * 0.5} 104 ${100 - rx * 0.3} 92 Z`, shade(o.robe, 0.08), 2.6) +
    place(o.face, 100, 52, 1) +
    (o.extra ?? '')
  );
}

export interface Knight {
  armor: string;
  trim: string;
  helm?: 'great' | 'open' | 'lizard' | 'ghost' | 'mecha' | 'plume' | 'frog' | 'none';
  weapon?: string;
  cape?: string;
  skin?: string;
  eyeCol?: string;
}

export function knight(o: Knight): string {
  const a = o.armor;
  const helm = o.helm ?? 'great';
  const eyeCol = o.eyeCol ?? '#ffe28a';
  let head = '';
  if (helm === 'great' || helm === 'plume' || helm === 'ghost') {
    head =
      ink('M-22 18 C-26 -10 -16 -26 0 -26 C16 -26 26 -10 22 18 Z', a) +
      dark('M2 -26 C16 -26 26 -10 22 18 L6 18 C12 0 10 -16 2 -26 Z', 0.25) +
      ink('M-22 -2 L14 -2 L14 6 L-22 6 Z', '#14100e', 2) +
      glow(-8, 2, 10, eyeCol, 0.8) +
      line('M-18 2 L8 2', eyeCol, 2, 0.9) +
      line('M-4 6 L-4 16 M-10 8 L-10 14 M2 8 L2 14', INK, 1.6, 0.7) +
      hi('M-18 -8 C-16 -18 -8 -22 -2 -22', 2);
    if (helm === 'plume') head += ink('M4 -24 C10 -46 34 -50 44 -36 C30 -38 20 -30 12 -20 Z', o.trim, 2.4);
  } else if (helm === 'lizard') {
    head =
      ink('M10 -16 C-6 -24 -30 -18 -40 -6 C-44 0 -40 6 -30 8 L-6 10 C6 14 20 10 22 0 C24 -8 20 -14 10 -16 Z', '#5a8a3a') +
      ink('M-40 0 L-20 4 L-32 8 Z', '#f4ece0', 1.4) +
      eye(-14, -8, 4, '#ffd040') +
      ink('M0 -18 C10 -30 22 -28 26 -16', a, 2.6) +
      ink('M16 -20 L22 -34 L26 -18 Z', o.trim, 2);
  } else if (helm === 'frog') {
    head =
      ink('M22 -4 C24 -20 10 -28 -6 -26 C-26 -24 -40 -12 -40 2 C-40 14 -26 20 -8 20 C10 20 22 12 22 -4 Z', '#6aa84a') +
      dark('M4 -27 C18 -24 24 -14 22 -4 C22 10 12 18 0 20 C12 8 14 -10 4 -27 Z', 0.22) +
      ink('M-40 4 C-26 12 -6 12 8 8', 'none', 2.4) +
      fill('M-36 8 C-24 16 -6 16 6 12 C-4 20 -26 20 -36 8 Z', '#e8e0a0', 0.9) +
      circle(-24, -22, 9, '#7ab85a') +
      circle(-2, -28, 9, '#6aa84a') +
      eye(-24, -23, 5, '#ffd040') +
      eye(-2, -29, 5, '#ffd040') +
      ink('M8 -22 L12 -32 L16 -24 L20 -30 L22 -18 Z', o.trim, 2);
  } else if (helm === 'none') {
    head = '';
  } else if (helm === 'mecha') {
    head = ink('M-24 -24 L22 -24 L26 16 L-26 16 Z', a) + ink('M-20 -10 L18 -10 L18 2 L-20 2 Z', '#14100e', 2) + glow(-2, -4, 16, '#ff6a3a', 0.8) + line('M-16 -4 L14 -4', '#ffb04a', 3) + dark('M4 -24 L22 -24 L26 16 L6 16 Z', 0.25);
  } else {
    head =
      ink('M-18 14 C-22 -6 -14 -22 0 -22 C14 -22 22 -6 18 14 Z', o.skin ?? M.skin) +
      ink('M-24 -2 C-26 -26 -10 -34 2 -34 C16 -34 28 -24 24 -2 L18 -6 L-18 -6 Z', a) +
      dot(-8, 2, 2.6, INK) +
      line('M-12 10 L-2 10', INK, 2);
  }
  const ghostly = helm === 'ghost';
  const body =
    // 披风
    (o.cape ? ink('M78 62 C60 100 54 150 56 186 L144 186 C146 150 140 100 122 62 Z', o.cape) + dark('M100 62 L122 62 C140 100 146 150 144 186 L104 186 Z', 0.25) : '') +
    // 腿
    ink('M84 128 L78 186 L96 186 L98 132 Z', shade(a, -0.12)) +
    ink('M116 128 L122 186 L104 186 L102 132 Z', shade(a, -0.2)) +
    ink('M72 182 L98 182 L98 192 L68 192 Z', shade(a, -0.3), 2.4) +
    ink('M102 182 L128 182 L132 192 L102 192 Z', shade(a, -0.35), 2.4) +
    // 躯干
    ink('M74 64 L126 64 L132 120 C118 134 82 134 68 120 Z', a) +
    dark('M100 64 L126 64 L132 120 C122 130 108 133 100 133 Z', 0.22) +
    ink('M84 72 L116 72 L114 102 C106 108 94 108 86 102 Z', shade(a, 0.12), 2.4) +
    ink('M70 116 L130 116 L132 128 L68 128 Z', o.trim, 2.4) +
    hi('M80 70 L76 112', 2.2) +
    // 肩甲
    ellipse(72, 68, 16, 12, shade(a, 0.05)) +
    ellipse(128, 68, 16, 12, shade(a, -0.15)) +
    place(head, 100, 40, 1) +
    (o.weapon ?? '');
  return shadow(64) + (ghostly ? `<g opacity="0.82">${body}</g>` : body);
}

// ---------------------------------------------------------------- 史莱姆

/** 枝条史莱姆背后伸出的树枝 */
function twigs(sz: number): string {
  const wood = '#6a4a2a';
  const leaf = (x: number, y: number, rot: number) => place(ink('M0 0 C-6 -4 -8 -12 -2 -16 C4 -12 4 -4 0 0 Z', '#7ab040', 1.6), x, y, 1, rot);
  const br: [string, number, number, number][] = [
    ['M70 96 L52 58 M58 70 L40 62', 46, 60, -30],
    ['M104 86 L110 40 M108 56 L124 46', 112, 40, 10],
    ['M136 96 L164 64 M154 74 L170 80', 166, 62, 40],
    ['M48 116 L18 96', 18, 96, -60],
    ['M156 120 L186 104', 186, 104, 60],
  ];
  return br
    .slice(0, 3 + sz)
    .map(([d, lx, ly, r]) => limb(d, wood, 5) + leaf(lx, ly, r))
    .join('');
}

/** 枝条史莱姆身体里透出的小树枝 */
function twigsFront(sz: number): string {
  return line('M60 170 L74 150 M70 156 L64 150', '#6a4a2a', 3, 0.7) + (sz >= 1 ? line('M132 166 L146 146 M140 154 L148 156', '#6a4a2a', 3, 0.7) : '');
}

/** 史莱姆：size 0/1/2 = 小/中/大。叶片史莱姆头顶长着叶子，枝条史莱姆身上插着树枝，尖刺史莱姆背着一圈尖刺；越大越凶 */
export function slime(col: string, opts: { spikes?: boolean; twigs?: boolean; size?: 0 | 1 | 2 } = {}): string {
  const sz = opts.size ?? 0;
  const d = 'M22 190 C10 160 26 104 70 88 C88 80 112 80 130 88 C174 104 190 160 178 190 Z';
  const leaf = (x: number, y: number, rot: number, s = 1) =>
    place(limb('M0 0 L0 -10', '#4a7a2a', 3) + ink('M0 -8 C-12 -14 -14 -28 -4 -34 C6 -26 8 -14 0 -8 Z', '#5aa83a', 2) + line('M0 -10 L-3 -28', '#3a6a22', 1.2, 0.8), x, y, s, rot);
  const bubbles = [
    [150, 122, 8],
    [62, 116, 6],
    [128, 160, 5],
    [82, 168, 4],
    [160, 156, 4],
  ]
    .slice(0, sz * 2 + 1)
    .map(([x, y, r]) => dot(x, y, r, shade(col, 0.32), 0.7) + dot(x - r * 0.3, y - r * 0.3, r * 0.3, '#fff', 0.6))
    .join('');
  return (
    shadow(82) +
    (opts.spikes ? spikes(100, 130, 70, 46, 5 + sz * 2, 14 + sz * 7, shade(col, -0.15), 195, 345) : '') +
    (opts.twigs ? twigs(sz) : '') +
    ink(d, col) +
    dark('M120 84 C170 100 190 160 178 190 L130 190 C150 150 148 110 120 84 Z', 0.25) +
    fill('M40 150 C60 130 140 128 160 150 C150 170 50 172 40 150 Z', shade(col, 0.18), 0.6) +
    hi('M42 130 C50 110 66 98 84 94', 4, 0.6) +
    bubbles +
    // 叶片史莱姆头顶的叶子
    (opts.spikes || opts.twigs ? '' : leaf(100, 86, -8) + (sz >= 1 ? leaf(88, 90, -40, 0.85) : '') + (sz >= 2 ? leaf(114, 90, 38, 0.9) + leaf(76, 98, -70, 0.75) : '')) +
    eye(78, 128, 9, '#fff6c8') +
    eye(112, 128, 9, '#fff6c8') +
    // 大史莱姆：竖起的怒眉和更大的嘴
    (sz >= 2
      ? ink('M64 112 L90 120 L88 114 Z', shade(col, -0.45), 2) + ink('M126 112 L100 120 L102 114 Z', shade(col, -0.45), 2) + ink('M76 150 C88 162 106 162 118 150 C114 168 82 168 76 150 Z', '#1a1010', 2) + ink('M84 153 L88 160 L92 154 Z M104 154 L108 160 L112 153 Z', '#f4ece0', 1)
      : ink('M80 152 C90 160 104 160 114 152 C108 164 88 164 80 152 Z', '#1a1010', 2)) +
    (opts.twigs ? twigsFront(sz) : '') +
    (opts.spikes ? '' : dot(30, 170, 6, col, 0.9) + dot(176, 176, 5, col, 0.9) + line('M64 190 L62 198 M140 190 L142 198', col, 4, 0.8))
  );
}

/** 简单的人形（渔夫、居民） */
export function knightLike(body: string, trim: string, skin: string): string {
  return (
    ink('M82 126 L78 186 L96 186 L98 130 Z', shade(body, -0.15)) +
    ink('M118 126 L122 186 L104 186 L102 130 Z', shade(body, -0.25)) +
    ink('M72 182 L98 182 L98 192 L68 192 Z', '#3a2a1a', 2.4) +
    ink('M102 182 L128 182 L132 192 L102 192 Z', '#2a1a10', 2.4) +
    ink('M72 64 L128 64 L134 126 C118 136 82 136 66 126 Z', body) +
    dark('M100 64 L128 64 L134 126 C124 132 110 134 100 134 Z', 0.25) +
    ink('M68 116 L132 116 L134 126 L66 126 Z', trim, 2.4) +
    limb('M72 72 C56 96 54 116 60 132', body, 13) +
    limb('M128 72 C144 90 150 86 152 80', shade(body, -0.1), 12) +
    circle(60, 136, 8, skin) +
    circle(152, 78, 8, skin) +
    ink('M80 50 C78 26 90 18 100 18 C112 18 124 26 120 50 C118 64 108 70 100 70 C92 70 82 64 80 50 Z', skin) +
    dark('M104 18 C116 20 124 30 120 50 C118 62 110 68 104 70 C114 54 114 32 104 18 Z', 0.2) +
    dot(90, 44, 3, INK) +
    line('M84 58 C92 62 100 62 106 58', INK, 2) +
    fill('M80 52 C82 68 94 76 104 74 C116 72 122 62 120 52 C114 60 90 62 80 52 Z', '#5a4a3a', 0.9)
  );
}

