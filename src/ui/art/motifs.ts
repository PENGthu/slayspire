/**
 * 卡牌插画的主体图案。坐标以 (0,0) 为中心，大致占据 ±60 的范围。
 */
import { INK, burstPath, circle, dot, ellipse, fill, g, glow, ink, limb, line, mix, place, shade, starPath } from './kit';
import { M, type Pal } from './palettes';

export interface Ctx {
  pal: Pal;
  r: () => number;
  /** 卡牌颜色（职业） */
  color: string;
  /** 主体染色 */
  tint?: string;
  /** 数量 */
  n?: number;
  /** 姿势或变体 */
  v?: string;
}

export type Motif = (c: Ctx) => string;

// ---------------------------------------------------------------- 武器

export function swordBody(blade = M.steel, guard = M.gold, len = 1): string {
  const tip = -62 * len;
  return (
    ink(`M-7 18 L-7 ${tip + 14} L0 ${tip} L7 ${tip + 14} L7 18 Z`, blade) +
    fill(`M0 ${tip + 2} L7 ${tip + 14} L7 18 L0 18 Z`, shade(blade, -0.35), 0.6) +
    line(`M-3.6 ${tip + 16} L-3.6 14`, '#ffffff', 1.6, 0.8) +
    ink('M-24 16 Q0 24 24 16 L22 25 Q0 31 -22 25 Z', guard) +
    ink('M-5 27 L5 27 L5 48 L-5 48 Z', M.leather) +
    line('M-5 33 L5 31 M-5 39 L5 37 M-5 45 L5 43', INK, 1.4, 0.6) +
    circle(0, 53, 7, guard) +
    dot(-2, 51, 2.2, '#fff6d0', 0.7)
  );
}

export const sword: Motif = (c) => place(swordBody(c.tint ?? M.steel), 0, 0, 0.92, 38);

export const swords: Motif = (c) =>
  place(swordBody(c.tint ?? M.steel), -6, 2, 0.86, -38) + place(swordBody(c.tint ?? M.steel, M.gold), 6, 2, 0.86, 38);

export function daggerBody(blade = M.steel, curved = false): string {
  const b = curved
    ? 'M-6 10 L-6 -22 Q-4 -40 6 -50 Q10 -34 6 -16 L6 10 Z'
    : 'M-6 10 L-6 -30 L0 -46 L6 -30 L6 10 Z';
  return (
    ink(b, blade) +
    line(curved ? 'M-3 6 L-3 -22 Q-1 -34 4 -42' : 'M-3 6 L-3 -28', '#ffffff', 1.4, 0.75) +
    ink('M-16 9 L16 9 L14 16 L-14 16 Z', M.goldDark) +
    ink('M-4.5 16 L4.5 16 L4.5 34 L-4.5 34 Z', '#3a2418') +
    circle(0, 38, 5, M.goldDark)
  );
}

export const dagger: Motif = (c) => {
  const n = c.n ?? 1;
  if (n === 1) return place(daggerBody(c.tint ?? M.steel, c.color === 'silent'), 0, 0, 1.1, 32);
  let s = '';
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    s += place(daggerBody(c.tint ?? M.steel, c.color === 'silent'), t * 70, Math.abs(t) * 18, 0.8, 20 + t * 50);
  }
  return s;
};

/** 下落的一阵飞刀 */
export const knifeRain: Motif = (c) => {
  let s = '';
  for (let i = 0; i < 7; i++) {
    const x = -62 + i * 21 + c.r() * 8;
    const y = -20 + c.r() * 40;
    s += place(daggerBody(M.steel), x, y, 0.5, 180 + (c.r() - 0.5) * 20);
  }
  return s;
};

export function axeBody(): string {
  return (
    limb('M0 -50 L0 56', M.wood, 7) +
    ink('M2 -46 C26 -58 40 -40 38 -14 C36 -4 26 -2 2 -12 Z', M.steel) +
    line('M8 -40 C26 -48 34 -34 33 -18', '#ffffff', 1.6, 0.7) +
    ink('M-2 -40 L-14 -34 L-14 -20 L-2 -18 Z', M.steelDark)
  );
}

export const axe: Motif = () => place(axeBody(), 0, 2, 0.95, 28);

export function hammerBody(): string {
  return (
    limb('M0 -24 L0 56', M.wood, 7) +
    ink('M-30 -46 L30 -46 L30 -14 L-30 -14 Z', M.stone) +
    fill('M-30 -26 L30 -26 L30 -14 L-30 -14 Z', M.stoneDark, 0.6) +
    ink('M-34 -50 L-26 -50 L-26 -10 L-34 -10 Z', M.steelDark) +
    ink('M26 -50 L34 -50 L34 -10 L26 -10 Z', M.steelDark) +
    line('M-22 -42 L20 -42', '#ffffff', 1.5, 0.5)
  );
}

export const hammer: Motif = () => place(hammerBody(), 4, 4, 0.9, -32);

export const spear: Motif = (c) =>
  place(
    limb('M0 -30 L0 70', M.wood, 6) +
      ink('M-9 -26 L0 -66 L9 -26 L4 -22 L-4 -22 Z', c.tint ?? M.steel) +
      line('M-3 -30 L0 -58', '#fff', 1.4, 0.7) +
      ink('M-12 -24 L12 -24 L8 -16 L-8 -16 Z', M.gold),
    0,
    0,
    0.9,
    50,
  );

export const trident: Motif = () =>
  place(
    limb('M0 -20 L0 66', M.wood, 6) +
      ink('M-22 -56 L-18 -20 L18 -20 L22 -56 L14 -30 L6 -30 L0 -64 L-6 -30 L-14 -30 Z', M.gold) +
      line('M-16 -24 L16 -24', INK, 2),
    0,
    0,
    0.9,
    30,
  );

export const scythe: Motif = (c) =>
  place(
    limb('M-6 -50 C-2 -10 2 20 8 64', M.wood, 6) +
      ink('M-8 -52 C24 -64 58 -46 70 -10 C50 -36 22 -42 -4 -38 Z', c.tint ?? M.steel) +
      line('M0 -50 C26 -56 50 -42 62 -20', '#ffffff', 1.4, 0.6),
    -10,
    4,
    0.95,
    -8,
  );

export const pickaxe: Motif = () =>
  place(limb('M0 -40 L0 60', M.wood, 6) + ink('M-46 -30 C-20 -54 20 -54 46 -30 C20 -42 -20 -42 -46 -30 Z', M.steel), 0, 4, 0.95, 24);

export const saw: Motif = () => {
  let teeth = '';
  for (let i = 0; i < 10; i++) teeth += `L${-40 + i * 8 + 4} 14 L${-40 + i * 8 + 8} 8 `;
  return place(ink(`M-40 -10 L44 -10 L44 8 ${teeth}L-40 8 Z`, M.steel) + ink('M-60 -14 L-40 -14 L-40 12 L-60 12 Z', M.wood), 6, 0, 1, -18);
};

export const scissors: Motif = () =>
  place(daggerBody(M.steel), -8, 0, 1, -24) + place(daggerBody(M.steel), 8, 0, 1, 24) + circle(0, 4, 4, M.gold);

export const boomerang: Motif = () =>
  place(ink('M-50 20 C-30 -10 -6 -36 4 -46 C14 -40 16 -32 10 -26 C-4 -10 -20 8 -34 30 Z', M.steel) + ink('M4 -46 C24 -34 44 -10 54 16 C46 22 40 22 34 16 C26 -2 16 -16 10 -26 Z', M.steel), 0, 6, 0.95, 10) +
  line('M-62 30 C-70 10 -60 -20 -40 -40', '#fff', 2, 0.35);

// ---------------------------------------------------------------- 防具

export function shieldBody(face: string, rim = M.steel, emblem = ''): string {
  return (
    ink('M-40 -44 L40 -44 L40 -6 C40 22 20 40 0 52 C-20 40 -40 22 -40 -6 Z', rim) +
    ink('M-31 -35 L31 -35 L31 -6 C31 15 15 30 0 41 C-15 30 -31 15 -31 -6 Z', face, 2.4) +
    fill('M0 -35 L31 -35 L31 -6 C31 15 15 30 0 41 Z', '#000', 0.18) +
    emblem +
    dot(-34, -38, 2.4, INK) +
    dot(34, -38, 2.4, INK) +
    dot(0, 46, 2.4, INK) +
    line('M-35 -38 L-35 -6 C-35 14 -22 30 -8 40', '#ffffff', 1.8, 0.5)
  );
}

export const shield: Motif = (c) => {
  const face = c.tint ?? c.pal.accent;
  const em = ink('M-6 -26 L6 -26 L6 -10 L22 -10 L22 2 L6 2 L6 28 L-6 28 L-6 2 L-22 2 L-22 -10 L-6 -10 Z', c.pal.accent2, 2);
  return place(shieldBody(face, M.steel, em), 0, 0, 1);
};

export const wall: Motif = (c) => {
  let s = '';
  const rows = 4;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < 4; x++) {
      const ox = (y % 2) * 12 - 54 + x * 26;
      s += ink(`M${ox} ${-44 + y * 22} h24 v20 h-24 Z`, mix(c.tint ?? M.stone, '#000', c.r() * 0.25), 2.4);
    }
  }
  return s;
};

export const tower: Motif = (c) =>
  ink('M-24 56 L-18 -30 L18 -30 L24 56 Z', c.tint ?? M.stone) +
  ink('M-28 -30 L28 -30 L28 -44 L20 -44 L20 -38 L10 -38 L10 -44 L0 -44 L0 -38 L-10 -38 L-10 -44 L-20 -44 L-20 -38 L-28 -38 Z', shade(c.tint ?? M.stone, 0.1)) +
  ink('M-6 0 C-6 -10 6 -10 6 0 L6 14 L-6 14 Z', '#1a1012', 2) +
  fill('M0 -30 L18 -30 L24 56 L0 56 Z', '#000', 0.2) +
  glow(0, 4, 10, c.pal.light, 0.7);

export const helmet: Motif = (c) =>
  ink('M-34 20 C-36 -30 -16 -44 0 -44 C16 -44 36 -30 34 20 L22 26 L22 4 L-22 4 L-22 26 Z', c.tint ?? M.steel) +
  ink('M-22 -6 L22 -6 L22 4 L-22 4 Z', '#1a1012', 2) +
  ink('M-4 -44 L4 -44 L4 26 L-4 26 Z', M.gold, 2) +
  line('M-26 -24 C-22 -34 -12 -40 -4 -40', '#fff', 2, 0.6);

export const armorPlate: Motif = (c) =>
  ink('M-40 -40 C-20 -48 20 -48 40 -40 L36 30 C20 46 -20 46 -36 30 Z', c.tint ?? M.steel) +
  ink('M-26 -30 L26 -30 L22 20 C10 30 -10 30 -22 20 Z', shade(c.tint ?? M.steel, -0.15), 2) +
  dot(-30, -32, 3, INK) +
  dot(30, -32, 3, INK) +
  dot(-28, 24, 3, INK) +
  dot(28, 24, 3, INK) +
  line('M-34 -34 L-30 24', '#fff', 2, 0.5);

// ---------------------------------------------------------------- 元素

export function flamePath(s = 1): string {
  const p = (x: number, y: number) => `${(x * s).toFixed(1)} ${(y * s).toFixed(1)}`;
  return `M${p(0, 48)} C${p(-30, 48)} ${p(-42, 26)} ${p(-36, 4)} C${p(-32, -12)} ${p(-20, -18)} ${p(-18, -34)} C${p(-10, -24)} ${p(-8, -14)} ${p(-6, -10)} C${p(-4, -26)} ${p(4, -40)} ${p(2, -60)} C${p(16, -42)} ${p(22, -26)} ${p(18, -10)} C${p(24, -16)} ${p(26, -24)} ${p(26, -30)} C${p(38, -14)} ${p(42, 8)} ${p(36, 24)} C${p(30, 40)} ${p(18, 48)} ${p(0, 48)} Z`;
}

export function flameBody(cols = [M.flame4, M.flame3, M.flame2, M.flame1]): string {
  return (
    ink(flamePath(1), cols[0], 2.6) +
    g(fill(flamePath(0.78), cols[1]), 'translate(0 9)') +
    g(fill(flamePath(0.55), cols[2]), 'translate(0 18)') +
    g(fill(flamePath(0.3), cols[3]), 'translate(0 30)')
  );
}

export const flame: Motif = (c) => {
  const cols =
    c.tint === 'blue'
      ? ['#1d3f9a', '#3a7ae0', '#8ad0ff', '#e8fbff']
      : c.tint === 'purple'
        ? ['#4a1470', '#8a3ad0', '#d08aff', '#fbe8ff']
        : c.tint === 'green'
          ? ['#1f5a14', '#4aa82a', '#a8f06a', '#f4ffd0']
          : undefined;
  return glow(0, 10, 70, cols ? cols[2] : M.flame2, 0.5) + flameBody(cols);
};

export const fireball: Motif = (c) =>
  glow(10, 10, 64, M.flame2, 0.55) +
  place(flameBody(), 22, -14, 0.62, -135) +
  circle(-8, 10, 26, M.flame3, 2.6) +
  dot(-8, 10, 18, M.flame2) +
  dot(-12, 6, 10, M.flame1) +
  line('M18 40 L52 60 M4 44 L30 66 M26 28 L62 44', M.flame2, 3, 0.5) +
  (c.v === 'rock' ? ink('M-30 -4 L-18 -24 L4 -26 L18 -8 L12 18 L-14 26 L-30 12 Z', M.stoneDark, 2.4) : '');

export function boltPath(): string {
  return 'M10 -60 L-22 4 L-3 4 L-14 60 L26 -10 L5 -10 L20 -60 Z';
}

export const bolt: Motif = (c) =>
  glow(0, 0, 70, M.boltDark, 0.55) +
  ink(boltPath(), c.tint ?? M.bolt, 2.8) +
  fill('M10 -60 L20 -60 L5 -10 L26 -10 L20 -1 L0 -1 Z', '#fff', 0.6) +
  (c.n && c.n > 1 ? place(ink(boltPath(), M.bolt, 2.8), -44, 10, 0.55, -12) + place(ink(boltPath(), M.bolt, 2.8), 44, 10, 0.55, 14) : '');

export const stormCloud: Motif = (c) =>
  place(ink(boltPath(), M.bolt, 2.6), c.v === 'snow' ? -200 : 0, 34, 0.55, 8) +
  ink('M-50 6 C-64 6 -64 -18 -46 -18 C-46 -40 -16 -44 -8 -26 C0 -46 34 -44 36 -20 C56 -24 62 4 44 6 Z', c.tint ?? '#5a6074', 2.8) +
  fill('M-50 6 C-58 0 -56 -8 -44 -8 C-30 -2 20 -2 44 -6 C52 -2 50 6 44 6 Z', '#000', 0.25) +
  line('M-40 -22 C-36 -32 -24 -34 -16 -28', '#fff', 2, 0.4) +
  (c.v === 'snow'
    ? [-36, -14, 8, 30].map((x, i) => place(snowflakeBody(), x, 26 + (i % 2) * 14, 0.22)).join('')
    : c.v === 'rain'
      ? line('M-38 14 L-44 34 M-18 14 L-24 38 M4 14 L-2 34 M26 14 L20 38', '#9fd0ff', 2.4, 0.8)
      : '');

export function snowflakeBody(col = M.ice): string {
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += g(limb('M0 0 L0 -50 M0 -30 L-12 -40 M0 -30 L12 -40 M0 -14 L-10 -22 M0 -14 L10 -22', col, 4), `rotate(${i * 60})`);
  }
  return s + circle(0, 0, 8, col, 2.4);
}

export const snowflake: Motif = () => glow(0, 0, 70, M.iceDark, 0.5) + snowflakeBody();

export const iceShard: Motif = (c) => {
  let s = glow(0, 0, 70, M.iceDark, 0.45);
  const n = c.n ?? 3;
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 28;
    const h = 46 + (i % 2 ? -10 : 8);
    s += ink(`M${x - 12} 40 L${x - 6} ${-h} L${x + 2} ${-h - 10} L${x + 12} 40 Z`, M.ice, 2.4) + fill(`M${x + 2} ${-h - 10} L${x + 12} 40 L${x + 2} 40 Z`, M.iceDark, 0.45);
  }
  return s;
};

export const iceCube: Motif = () =>
  glow(0, 0, 66, M.iceDark, 0.45) +
  ink('M-34 -14 L0 -32 L34 -14 L34 24 L0 42 L-34 24 Z', M.ice) +
  ink('M-34 -14 L0 4 L34 -14', 'none', 2.4) +
  ink('M0 4 L0 42', 'none', 2.4) +
  fill('M0 4 L34 -14 L34 24 L0 42 Z', M.iceDark, 0.4) +
  line('M-26 -12 L-4 -24', '#fff', 2.4, 0.8);

export const glacier: Motif = () =>
  ink('M-70 50 L-44 -20 L-30 -4 L-8 -48 L14 -12 L30 -30 L66 50 Z', M.ice) +
  fill('M-8 -48 L14 -12 L30 -30 L66 50 L10 50 Z', M.iceDark, 0.45) +
  ink('M-8 -48 L-16 -30 L-2 -26 L4 -36 Z', '#fff', 1.6);

export const wave: Motif = (c) =>
  ink('M-70 50 C-60 10 -30 -40 10 -40 C40 -40 56 -14 44 6 C36 18 18 12 22 0 C26 -10 14 -16 6 -8 C-10 8 -10 40 10 50 Z', c.tint ?? '#3a8fc8') +
  fill('M-60 50 C-50 20 -30 -20 4 -30 C-20 -10 -30 20 -24 50 Z', '#000', 0.2) +
  line('M-40 -10 C-26 -30 0 -36 20 -30', '#e8fbff', 3, 0.7) +
  [0, 1, 2].map((i) => dot(30 + i * 9, -32 - i * 6, 3 - i * 0.6, '#e8fbff', 0.8)).join('');

export const vortex: Motif = (c) => {
  let s = glow(0, 0, 70, c.tint ?? c.pal.light, 0.5);
  for (let i = 0; i < 4; i++) {
    const r = 54 - i * 12;
    s += line(`M${-r} 0 A${r} ${r * 0.62} 0 1 1 ${r * 0.7} ${r * 0.44}`, i % 2 ? (c.tint ?? c.pal.light) : '#ffffff', 5 - i * 0.7, 0.85 - i * 0.12);
  }
  return s + dot(0, 0, 6, '#fff');
};

export const tornado: Motif = (c) => {
  let s = '';
  for (let i = 0; i < 6; i++) {
    const y = -48 + i * 18;
    const w = 60 - i * 9;
    s += `<ellipse cx="${(i % 2) * 4}" cy="${y}" rx="${w}" ry="${8 - i * 0.5}" fill="none" stroke="${INK}" stroke-width="7"/><ellipse cx="${(i % 2) * 4}" cy="${y}" rx="${w}" ry="${8 - i * 0.5}" fill="none" stroke="${i % 2 ? (c.tint ?? '#b8c4cc') : '#e6eef2'}" stroke-width="3.5"/>`;
  }
  return s;
};

export const explosion: Motif = (c) =>
  glow(0, 0, 80, c.tint ?? M.flame2, 0.6) +
  ink(burstPath(0, 0, 58, 26, 11, c.r), c.tint ? shade(c.tint, -0.2) : M.flame3, 2.6) +
  fill(burstPath(0, 0, 40, 18, 9, c.r), c.tint ?? M.flame2) +
  fill(burstPath(0, 0, 20, 10, 7, c.r), '#fff6c8');

export const sparkle: Motif = (c) =>
  glow(0, 0, 72, c.tint ?? c.pal.light, 0.55) +
  ink(starPath(0, 0, 46, 9, 4), c.tint ?? '#fff6c8', 2.4) +
  place(ink(starPath(0, 0, 46, 9, 4), '#fff', 2), 40, -26, 0.38) +
  place(ink(starPath(0, 0, 46, 9, 4), '#fff', 2), -42, 22, 0.3);

export const star: Motif = (c) =>
  glow(0, 0, 76, c.tint ?? '#ffd77a', 0.6) +
  ink(starPath(0, 2, 50, 22, 5), c.tint ?? '#ffd257', 3) +
  fill(starPath(0, 2, 50, 22, 5).replace(/^M[^L]+/, 'M0 2'), '#000', 0) +
  fill(starPath(0, 2, 26, 11, 5), '#fff3c0', 0.85);

export const fallingStar: Motif = (c) =>
  fill('M-70 -50 L10 4 L-4 16 Z', c.tint ?? '#ffe8a8', 0.35) +
  fill('M-60 -56 L14 -4 L4 10 Z', '#fff', 0.35) +
  place(star(c), 18, 14, 0.62, 12);

export const sun: Motif = (c) => {
  let rays = '';
  for (let i = 0; i < 12; i++) rays += g(ink('M-6 -40 L0 -62 L6 -40 Z', M.flame2, 2), `rotate(${i * 30})`);
  return glow(0, 0, 90, c.tint ?? M.flame2, 0.65) + rays + circle(0, 0, 36, M.flame2) + dot(0, 0, 26, M.flame1) + dot(-8, -8, 10, '#fff', 0.8);
};

export const moon: Motif = (c) =>
  glow(0, 0, 70, c.tint ?? c.pal.light, 0.45) +
  ink('M10 -46 C-24 -46 -40 -16 -36 8 C-30 36 -4 50 22 44 C-6 36 -18 12 -12 -10 C-6 -30 8 -42 10 -46 Z', c.tint ?? '#f2ecd8') +
  dot(-20, 4, 4, '#000', 0.12) +
  dot(-10, 26, 3, '#000', 0.12);

export const eclipse: Motif = (c) =>
  glow(0, 0, 80, c.tint ?? c.pal.light, 0.7) + circle(0, 0, 40, '#f6e6b0', 0) + circle(6, -4, 38, '#120814', 3) + line('M-34 20 C-40 0 -36 -20 -20 -34', '#fff', 2.4, 0.7);

export const blackHole: Motif = (c) =>
  vortex({ ...c, tint: c.tint ?? M.voidLight }) + circle(0, 0, 16, '#05020a', 3) + `<ellipse cx="0" cy="0" rx="40" ry="9" fill="none" stroke="${M.voidLight}" stroke-width="3" opacity="0.7"/>`;

export const planet: Motif = (c) =>
  glow(0, 0, 70, c.pal.light, 0.4) +
  `<ellipse cx="0" cy="4" rx="58" ry="14" fill="none" stroke="${INK}" stroke-width="8" transform="rotate(-14)"/><ellipse cx="0" cy="4" rx="58" ry="14" fill="none" stroke="${M.gold}" stroke-width="4" transform="rotate(-14)"/>` +
  circle(0, 0, 32, c.tint ?? '#c27a3a') +
  fill('M-30 -6 C-10 -2 10 -8 31 -10 L32 0 C10 4 -10 8 -31 6 Z', '#000', 0.2) +
  fill('M0 32 C20 30 30 16 32 0 C26 18 14 26 0 32 Z', '#000', 0.25) +
  `<path d="M-56 18 A58 14 -14 0 0 56 -10" fill="none" stroke="${M.gold}" stroke-width="4" transform="rotate(-14)"/>`;

export const galaxy: Motif = (c) => {
  let s = glow(0, 0, 80, c.pal.light, 0.4);
  for (let i = 0; i < 2; i++) s += line(`M0 0 C${i ? 30 : -30} ${i ? -40 : 40} ${i ? 70 : -70} ${i ? -10 : 10} ${i ? 60 : -60} ${i ? 30 : -30}`, i ? '#c8b0ff' : '#ffd77a', 6, 0.7);
  for (let i = 0; i < 18; i++) s += dot((c.r() - 0.5) * 140, (c.r() - 0.5) * 90, c.r() * 2 + 0.6, '#fff', 0.8);
  return s + glow(0, 0, 20, '#fff', 0.9);
};

export const constellation: Motif = (c) => {
  const pts = [
    [-50, 20],
    [-24, -12],
    [4, -4],
    [26, -34],
    [52, -10],
    [30, 28],
  ];
  let s = glow(0, 0, 80, c.pal.light, 0.35);
  s += line('M' + pts.map((p) => p.join(' ')).join(' L'), '#ffe8a8', 1.6, 0.8);
  for (const [x, y] of pts) s += place(fill(starPath(0, 0, 9, 3, 4), '#fff'), x, y, 1) + glow(x, y, 9, '#ffe8a8', 0.8);
  return s;
};

export const rays: Motif = (c) => {
  let s = glow(0, 0, 90, c.tint ?? c.pal.light, 0.7);
  for (let i = 0; i < 16; i++) s += g(fill('M-4 -20 L0 -80 L4 -20 Z', '#fff', 0.5), `rotate(${i * 22.5})`);
  return s + circle(0, 0, 16, '#fffbe8', 2.4);
};

export const beam: Motif = (c) =>
  fill('M-80 -14 L60 -6 L60 6 L-80 14 Z', c.tint ?? c.pal.light, 0.5) +
  fill('M-80 -6 L60 -2 L60 2 L-80 6 Z', '#fff', 0.9) +
  glow(60, 0, 26, c.tint ?? c.pal.light, 0.9) +
  ink('M-70 -18 L-46 -18 L-46 18 L-70 18 Z', '#3b4c63', 2.6) +
  circle(-58, 0, 8, c.tint ?? c.pal.light, 2);

export const rainbow: Motif = () => {
  const cols = ['#e04a3a', '#f0a030', '#f0e040', '#5ac84a', '#3a8ae0', '#8a4ad0'];
  return cols.map((col, i) => line(`M${-60 + i * 7} 40 A${60 - i * 7} ${56 - i * 7} 0 0 1 ${60 - i * 7} 40`, col, 7)).join('');
};

export const atom: Motif = (c) => {
  let s = glow(0, 0, 70, c.tint ?? c.pal.light, 0.5);
  for (let i = 0; i < 3; i++)
    s += `<ellipse rx="56" ry="18" fill="none" stroke="${INK}" stroke-width="7" transform="rotate(${i * 60})"/><ellipse rx="56" ry="18" fill="none" stroke="${c.tint ?? c.pal.accent2}" stroke-width="3.5" transform="rotate(${i * 60})"/>`;
  return s + circle(0, 0, 10, '#fff');
};

export const orb: Motif = (c) => {
  const col = c.tint ?? c.pal.light;
  return glow(0, 0, 70, col, 0.6) + circle(0, 0, 34, shade(col, -0.35)) + dot(0, 0, 26, col) + dot(-10, -12, 10, '#fff', 0.85) + line('M-18 14 C-6 22 10 20 20 8', '#fff', 2.4, 0.5);
};

export const bubbles: Motif = (c) => {
  let s = '';
  for (let i = 0; i < 6; i++) {
    const x = (c.r() - 0.5) * 100;
    const y = (c.r() - 0.5) * 70;
    const rr = 10 + c.r() * 18;
    s += circle(x, y, rr, mix(c.pal.light, '#ffffff', 0.4), 2) + dot(x - rr * 0.35, y - rr * 0.35, rr * 0.25, '#fff', 0.9);
  }
  return `<g opacity="0.9">${s}</g>`;
};

export const cloud: Motif = (c) =>
  glow(0, 0, 70, c.tint ?? c.pal.light, 0.4) +
  ink('M-56 18 C-70 18 -70 -6 -52 -8 C-54 -30 -26 -36 -16 -20 C-8 -40 26 -40 30 -16 C50 -22 64 2 48 18 Z', c.tint ?? '#9aa2a8', 2.6) +
  fill('M-56 18 C-60 12 -58 6 -50 6 C-30 12 20 10 48 6 C54 10 52 16 48 18 Z', '#000', 0.2) +
  line('M-44 -10 C-40 -20 -30 -24 -20 -18', '#fff', 2, 0.45);

export const smoke: Motif = (c) => {
  const col = c.tint ?? '#8a8f98';
  let s = '';
  const puffs: [number, number, number][] = [
    [-40, 14, 22],
    [-14, 22, 20],
    [14, 16, 24],
    [40, 22, 18],
    [-24, -10, 24],
    [8, -16, 26],
    [34, -6, 20],
    [-4, -36, 18],
  ];
  for (const [x, y, rr] of puffs) {
    const k = c.r();
    s += circle(x, y, rr, mix(col, k < 0.5 ? '#000000' : '#ffffff', 0.12 + k * 0.12), 2.4);
    s += line(`M${x - rr * 0.55} ${y - rr * 0.1} C${x - rr * 0.4} ${y - rr * 0.6} ${x + rr * 0.2} ${y - rr * 0.7} ${x + rr * 0.4} ${y - rr * 0.3}`, '#fff', 2, 0.35);
  }
  s += line('M-56 -30 C-50 -44 -36 -44 -36 -32 C-36 -24 -46 -24 -46 -32', INK, 5) + line('M-56 -30 C-50 -44 -36 -44 -36 -32 C-36 -24 -46 -24 -46 -32', col, 2.4);
  s += line('M46 -40 C52 -54 66 -52 64 -40 C62 -32 52 -34 54 -42', INK, 5) + line('M46 -40 C52 -54 66 -52 64 -40 C62 -32 52 -34 54 -42', col, 2.4);
  return glow(0, 0, 70, col, 0.35) + s;
};

export const wind: Motif = (c) =>
  line('M-70 -20 L20 -20 C40 -20 44 -44 26 -46 C14 -46 12 -34 18 -30', c.tint ?? '#e6f2f6', 5) +
  line('M-60 2 L40 2 C62 2 66 28 46 30 C34 30 32 20 36 16', c.tint ?? '#e6f2f6', 5) +
  line('M-70 24 L0 24', c.tint ?? '#e6f2f6', 4, 0.7);

// ---------------------------------------------------------------- 血、毒、药剂

export function dropPath(s = 1): string {
  return `M0 ${-52 * s} C${14 * s} ${-28 * s} ${32 * s} ${-6 * s} ${32 * s} ${16 * s} C${32 * s} ${36 * s} ${18 * s} ${50 * s} 0 ${50 * s} C${-18 * s} ${50 * s} ${-32 * s} ${36 * s} ${-32 * s} ${16 * s} C${-32 * s} ${-6 * s} ${-14 * s} ${-28 * s} 0 ${-52 * s} Z`;
}

export const drop: Motif = (c) => {
  const col = c.tint ?? M.blood;
  const n = c.n ?? 1;
  const one = ink(dropPath(), col) + fill('M10 -20 C22 -4 28 10 26 24 C20 40 8 46 0 48 C16 36 20 14 10 -20 Z', shade(col, -0.4), 0.6) + line('M-16 4 C-18 14 -14 26 -6 32', '#fff', 3, 0.6);
  if (n === 1) return glow(0, 0, 64, col, 0.35) + one;
  return place(one, -26, 8, 0.7) + place(one, 26, -6, 0.6) + place(one, 4, 22, 0.42);
};

export const syringe: Motif = (c) =>
  place(
    ink('M-10 -30 L10 -30 L10 34 L-10 34 Z', '#e6eef2') +
      fill('M-8 -6 L8 -6 L8 32 L-8 32 Z', c.tint ?? M.blood) +
      ink('M-16 34 L16 34 L16 40 L-16 40 Z', M.steelDark) +
      limb('M0 -30 L0 -64', M.steel, 2.5) +
      ink('M-4 40 L4 40 L4 56 L-4 56 Z', M.steelDark) +
      ink('M-14 56 L14 56 L14 62 L-14 62 Z', M.steelDark) +
      line('M-6 -24 L-6 26', '#fff', 1.6, 0.7),
    0,
    0,
    0.95,
    40,
  );

export const vial: Motif = (c) => {
  const col = c.tint ?? M.poison;
  return (
    glow(0, 10, 60, col, 0.45) +
    ink('M-10 -46 L10 -46 L10 -20 C34 -10 40 18 30 34 C20 50 -20 50 -30 34 C-40 18 -34 -10 -10 -20 Z', '#d8eef2') +
    fill('M-34 14 C-20 8 20 20 36 12 C38 24 34 32 28 38 C16 50 -16 50 -28 38 C-34 32 -36 22 -34 14 Z', col) +
    dot(-10, 26, 4, '#fff', 0.6) +
    dot(6, 32, 2.6, '#fff', 0.6) +
    ink('M-13 -54 L13 -54 L13 -44 L-13 -44 Z', M.wood) +
    line('M-20 -6 C-28 4 -30 14 -28 24', '#fff', 2.4, 0.7)
  );
};

export const flask: Motif = (c) => {
  const col = c.tint ?? M.poison;
  return (
    glow(0, 10, 60, col, 0.45) +
    ink('M-9 -46 L9 -46 L9 -12 L34 34 C38 42 32 48 24 48 L-24 48 C-32 48 -38 42 -34 34 L-9 -12 Z', '#d8eef2') +
    fill('M-22 12 L22 12 L34 34 C38 42 32 46 24 46 L-24 46 C-32 46 -38 42 -34 34 Z', col) +
    dot(-8, 30, 4, '#fff', 0.6) +
    ink('M-12 -54 L12 -54 L12 -44 L-12 -44 Z', M.wood) +
    line('M-5 -40 L-5 -12 L-20 18', '#fff', 2, 0.6) +
    `<circle cx="10" cy="-60" r="6" fill="${col}" opacity="0.5" filter="url(#soft2)"/>`
  );
};

export const petri: Motif = (c) =>
  `<ellipse cx="0" cy="10" rx="56" ry="22" fill="#d8eef2" stroke="${INK}" stroke-width="3"/>` +
  `<ellipse cx="0" cy="6" rx="48" ry="16" fill="${c.tint ?? M.poison}" opacity="0.85"/>` +
  [-20, 4, 22, -6].map((x, i) => dot(x, 4 + (i % 2) * 6, 5 - i, '#e8ffd0', 0.9)).join('') +
  line('M-46 0 C-30 -8 10 -10 30 -6', '#fff', 2, 0.6);

export const fang: Motif = (c) =>
  ink('M-50 -30 C-30 -44 30 -44 50 -30 C40 -10 20 -6 0 -6 C-20 -6 -40 -10 -50 -30 Z', '#7a1a24') +
  ink('M-24 -16 L-18 22 L-10 -12 Z', M.bone, 2.4) +
  ink('M24 -16 L18 22 L10 -12 Z', M.bone, 2.4) +
  ink('M-50 30 C-30 44 30 44 50 30 C40 14 -40 14 -50 30 Z', '#7a1a24') +
  place(ink(dropPath(), M.blood), -18, 34, 0.22) +
  place(ink(dropPath(), M.blood), 18, 30, 0.18);

export const meat: Motif = () =>
  limb('M20 20 L50 50', M.bone, 8) +
  circle(52, 48, 7, M.bone) +
  circle(46, 56, 7, M.bone) +
  ink('M-44 -10 C-50 -40 -10 -52 14 -36 C34 -22 36 6 20 22 C6 36 -30 34 -40 14 Z', '#a8402a') +
  fill('M-30 -20 C-20 -36 6 -36 14 -22 C0 -28 -18 -26 -30 -20 Z', '#e88a6a', 0.8) +
  line('M-34 0 C-20 10 0 12 14 4', '#5a1a0e', 2, 0.6);

export const bandage: Motif = () =>
  place(ink('M-56 -14 L56 -14 L56 14 L-56 14 Z', '#efe6d6') + ink('M-16 -14 L16 -14 L16 14 L-16 14 Z', '#d8cbb0', 2) + [-10, 0, 10].map((x) => dot(x, 0, 1.6, '#8a7a5a')).join(''), 0, 0, 1, -24) +
  place(ink('M-56 -14 L56 -14 L56 14 L-56 14 Z', '#efe6d6') + ink('M-16 -14 L16 -14 L16 14 L-16 14 Z', '#d8cbb0', 2), 0, 0, 1, 24) +
  place(ink(dropPath(), M.blood, 2), 0, 0, 0.16);

// ---------------------------------------------------------------- 死亡、骸骨

export function skullBody(bone = M.bone, eye = '#1a0e10'): string {
  return (
    ink('M-30 -4 C-34 -36 -14 -48 0 -48 C14 -48 34 -36 30 -4 C30 8 24 12 22 18 L-22 18 C-24 12 -30 8 -30 -4 Z', bone) +
    fill('M2 -48 C16 -46 34 -36 30 -4 C30 8 24 12 22 18 L6 18 C16 6 20 -20 2 -48 Z', '#000', 0.16) +
    ink('M-18 16 L18 16 L16 34 C8 40 -8 40 -16 34 Z', bone) +
    ink('M-21 -12 C-21 -22 -7 -22 -6 -10 C-6 -1 -19 1 -21 -12 Z', eye, 2) +
    ink('M21 -12 C21 -22 7 -22 6 -10 C6 -1 19 1 21 -12 Z', eye, 2) +
    ink('M0 2 L-5 12 L5 12 Z', eye, 2) +
    line('M-11 22 L-11 32 M-4 23 L-4 35 M4 23 L4 35 M11 22 L11 32', INK, 1.6) +
    line('M8 -46 L4 -36 L10 -30', INK, 1.5, 0.7) +
    line('M-22 -30 C-18 -40 -8 -44 0 -44', '#fff', 2.2, 0.6)
  );
}

export const skull: Motif = (c) => {
  const eye = c.v === 'glow' ? c.pal.light : '#1a0e10';
  return (c.v === 'glow' ? glow(-13, -10, 12, c.pal.light, 0.9) + glow(13, -10, 12, c.pal.light, 0.9) : '') + skullBody(c.tint ?? M.bone, eye) + (c.v === 'crossbones' ? '' : '');
};

export const crossbones: Motif = (c) =>
  place(limb('M-44 -30 L44 30', M.bone, 8) + limb('M44 -30 L-44 30', M.bone, 8), 0, 20, 0.9) + place(skullBody(c.tint ?? M.bone), 0, -6, 0.8);

export function boneBody(len = 46): string {
  return (
    limb(`M0 ${-len} L0 ${len}`, M.bone, 9) +
    circle(-6, -len - 2, 7, M.bone, 2.6) +
    circle(6, -len - 2, 7, M.bone, 2.6) +
    circle(-6, len + 2, 7, M.bone, 2.6) +
    circle(6, len + 2, 7, M.bone, 2.6) +
    line(`M-2 ${-len + 6} L-2 ${len - 6}`, '#fff', 1.6, 0.6)
  );
}

export const bone: Motif = (c) => {
  const n = c.n ?? 1;
  let s = '';
  for (let i = 0; i < n; i++) s += place(boneBody(), (i - (n - 1) / 2) * 26, 0, 0.85, 30 + (i - (n - 1) / 2) * 40);
  return s;
};

export const ribcage: Motif = (c) => {
  let s = limb('M0 -50 L0 50', M.bone, 7);
  for (let i = 0; i < 5; i++) {
    const y = -36 + i * 18;
    const w = 44 - Math.abs(i - 1.5) * 6;
    s += limb(`M0 ${y} C${-w} ${y - 6} ${-w} ${y + 14} ${-w * 0.5} ${y + 18}`, M.bone, 5) + limb(`M0 ${y} C${w} ${y - 6} ${w} ${y + 14} ${w * 0.5} ${y + 18}`, M.bone, 5);
  }
  return glow(0, 0, 60, c.pal.light, 0.35) + s;
};

export const coffin: Motif = (c) =>
  ink('M-22 -54 L22 -54 L34 -24 L22 54 L-22 54 L-34 -24 Z', c.tint ?? '#4a2c22') +
  fill('M0 -54 L22 -54 L34 -24 L22 54 L0 54 Z', '#000', 0.25) +
  ink('M-4 -32 L4 -32 L4 -18 L14 -18 L14 -10 L4 -10 L4 16 L-4 16 L-4 -10 L-14 -10 L-14 -18 L-4 -18 Z', M.gold, 2) +
  line('M-26 -26 L-18 -50', '#fff', 1.6, 0.4);

export const grave: Motif = (c) =>
  ink('M-70 54 C-40 40 40 40 70 54 Z', '#3a2c22') +
  ink('M-28 46 L-28 -20 C-28 -50 28 -50 28 -20 L28 46 Z', c.tint ?? M.stone) +
  fill('M4 -46 C20 -42 28 -32 28 -20 L28 46 L8 46 Z', '#000', 0.2) +
  line('M-12 -16 L12 -16 M0 -28 L0 10', INK, 3) +
  line('M-20 30 C-10 26 10 26 20 30', INK, 1.6, 0.5);

export const urn: Motif = (c) =>
  glow(0, 0, 60, c.pal.light, 0.35) +
  ink('M-14 -46 L14 -46 L12 -36 C34 -26 40 0 30 24 C24 40 12 48 0 48 C-12 48 -24 40 -30 24 C-40 0 -34 -26 -12 -36 Z', c.tint ?? '#7a5a8a') +
  ink('M-18 -50 L18 -50 L16 -44 L-16 -44 Z', M.gold, 2) +
  line('M-30 6 L30 6 M-28 14 L28 14', M.gold, 2.4, 0.9) +
  fill('M6 -34 C28 -24 36 0 28 24 C22 38 12 46 4 48 C20 30 22 0 6 -34 Z', '#000', 0.25) +
  line('M-24 -10 C-28 0 -28 12 -24 20', '#fff', 2, 0.5) +
  `<path d="M-6 -56 C-14 -70 4 -76 0 -90 C14 -76 6 -64 10 -56" fill="${c.pal.light}" opacity="0.5" filter="url(#soft2)"/>`;

export const ghost: Motif = (c) => {
  const col = c.tint ?? mix(c.pal.light, '#ffffff', 0.5);
  return (
    glow(0, 0, 64, c.pal.light, 0.5) +
    `<g opacity="0.92">` +
    ink('M-30 50 L-30 -10 C-30 -40 30 -40 30 -10 L30 50 L20 40 L10 52 L0 40 L-10 52 L-20 40 Z', col, 2.6) +
    fill('M8 -38 C24 -32 30 -20 30 -10 L30 50 L20 40 L14 48 C16 20 18 -10 8 -38 Z', '#000', 0.15) +
    `</g>` +
    ellipse(-11, -8, 6, 9, '#1a0e1e', 0) +
    ellipse(11, -8, 6, 9, '#1a0e1e', 0) +
    ellipse(0, 16, 6, 8, '#1a0e1e', 0)
  );
};

export const soulFlame: Motif = (c) => place(flame({ ...c, tint: c.color === 'necrobinder' ? 'purple' : 'blue' }), 0, 0, 0.9) + dot(-8, 18, 4, '#fff', 0.8) + dot(8, 18, 4, '#fff', 0.8);

export const bell: Motif = (c) =>
  limb('M0 -56 L0 -44', M.wood, 5) +
  ink('M-8 -46 C-8 -54 8 -54 8 -46 Z', M.goldDark, 2) +
  ink('M-12 -44 C-28 -40 -30 -10 -32 14 C-34 26 -44 30 -44 36 L44 36 C44 30 34 26 32 14 C30 -10 28 -40 12 -44 Z', c.tint ?? M.gold) +
  fill('M6 -44 C26 -38 30 -10 32 14 C34 26 44 30 44 36 L14 36 C20 10 20 -20 6 -44 Z', '#000', 0.2) +
  circle(0, 44, 8, M.goldDark) +
  line('M-24 -20 C-26 -4 -26 10 -30 22', '#fff', 2.2, 0.6) +
  line('M-58 -10 C-62 0 -62 14 -56 24 M58 -10 C62 0 62 14 56 24', c.pal.light, 3, 0.6);

export const notes: Motif = (c) => {
  const col = c.tint ?? c.pal.accent2;
  const note = (x: number, y: number, s: number) => place(ink('M-8 12 C-18 12 -18 26 -6 26 C4 26 6 18 6 12 L6 -30 L22 -24 L22 -16 L10 -20 L10 12 Z', col, 2.4), x, y, s);
  return glow(0, 0, 70, c.pal.light, 0.4) + note(-30, 6, 1) + note(18, -10, 0.8) + note(40, 22, 0.6);
};

export const rose: Motif = (c) =>
  limb('M0 50 C-6 20 4 0 0 -10', '#3a5a2a', 4) +
  ink('M-4 22 C-24 20 -30 6 -26 0 C-18 6 -10 12 -4 22 Z', '#3a5a2a', 2) +
  ink('M-24 -20 C-30 -44 -6 -54 4 -40 C20 -54 36 -36 24 -16 C14 -2 -14 -2 -24 -20 Z', c.tint ?? '#5a1430') +
  line('M-14 -24 C-6 -36 6 -34 8 -26 C10 -18 0 -14 -6 -20', INK, 1.8, 0.8) +
  ink('M10 -4 L18 22 L26 18 Z', c.tint ?? '#5a1430', 2) +
  ink('M-18 6 L-26 30 L-14 26 Z', c.tint ?? '#5a1430', 2);

export const leaves: Motif = (c) => {
  let s = '';
  for (let i = 0; i < 6; i++) {
    const x = (c.r() - 0.5) * 120;
    const y = (c.r() - 0.5) * 80;
    s += place(ink('M0 -20 C14 -10 14 10 0 20 C-14 10 -14 -10 0 -20 Z', mix('#8a5a1a', '#5a2a10', c.r()), 2) + line('M0 -18 L0 18', INK, 1.2, 0.6), x, y, 0.8 + c.r() * 0.5, c.r() * 360);
  }
  return s;
};

export const chain: Motif = (c) => {
  let s = '';
  for (let i = 0; i < 6; i++) {
    const x = -60 + i * 24;
    const y = Math.sin(i * 0.9) * 10;
    s += i % 2
      ? `<ellipse cx="${x}" cy="${y}" rx="16" ry="6" fill="none" stroke="${INK}" stroke-width="9"/><ellipse cx="${x}" cy="${y}" rx="16" ry="6" fill="none" stroke="${c.tint ?? M.steelDark}" stroke-width="4.5"/>`
      : `<ellipse cx="${x}" cy="${y}" rx="16" ry="10" fill="none" stroke="${INK}" stroke-width="9"/><ellipse cx="${x}" cy="${y}" rx="16" ry="10" fill="none" stroke="${c.tint ?? M.steel}" stroke-width="4.5"/>`;
  }
  return s;
};

export const hourglass: Motif = (c) =>
  ink('M-30 -52 L30 -52 L30 -44 L-30 -44 Z', M.wood) +
  ink('M-30 52 L30 52 L30 44 L-30 44 Z', M.wood) +
  ink('M-24 -44 L24 -44 C24 -16 6 -8 6 0 C6 8 24 16 24 44 L-24 44 C-24 16 -6 8 -6 0 C-6 -8 -24 -16 -24 -44 Z', '#d8eef2', 2.4) +
  fill('M-16 -30 L16 -30 C12 -18 4 -10 0 -4 C-4 -10 -12 -18 -16 -30 Z', c.tint ?? M.gold) +
  fill('M-20 42 C-16 30 -6 24 0 22 C6 24 16 30 20 42 Z', c.tint ?? M.gold) +
  line('M0 -4 L0 22', c.tint ?? M.gold, 1.4);

// ---------------------------------------------------------------- 手、肢体

export function handBody(skin = M.skin, open = true): string {
  if (!open)
    return (
      ink('M-26 -16 C-26 -30 26 -30 26 -16 L28 18 C28 34 -24 36 -26 18 Z', skin) +
      line('M-26 -8 C-14 -4 14 -4 26 -8 M-12 -26 L-12 -6 M2 -27 L2 -6 M16 -26 L16 -6', INK, 2) +
      ink('M-26 -2 C-36 -6 -40 8 -30 14 L-24 12 Z', skin, 2.4) +
      ink('M-18 34 L18 34 L16 56 L-16 56 Z', shade(skin, -0.15))
    );
  return (
    ink('M-22 56 L-20 14 L-30 -10 C-34 -18 -24 -22 -20 -14 L-12 2 L-14 -40 C-14 -48 -4 -48 -4 -40 L-2 -6 L0 -48 C0 -56 10 -56 10 -48 L10 -6 L14 -42 C14 -50 24 -50 24 -42 L20 0 L26 -28 C28 -36 36 -34 34 -26 L28 16 L24 56 Z', skin) +
    fill('M10 -6 L14 -42 C16 -48 22 -48 24 -42 L20 0 L26 -28 C28 -34 34 -34 34 -26 L28 16 L24 56 L8 56 Z', '#000', 0.15)
  );
}

export const hand: Motif = (c) => glow(0, 0, 64, c.pal.light, 0.4) + place(handBody(c.tint ?? M.skin, true), 0, 4, 0.92, c.v === 'down' ? 180 : 0);

export const fist: Motif = (c) =>
  glow(-10, -10, 60, c.pal.light, 0.4) +
  place(handBody(c.tint ?? M.skin, false), 0, 6, 1.05, c.v === 'up' ? 0 : -28) +
  line('M30 -40 L50 -54 M36 -24 L60 -28 M24 -52 L32 -66', '#fff', 3, 0.6);

export const gauntlet: Motif = (c) => fist({ ...c, tint: c.tint ?? M.steel });

export const boneHand: Motif = (c) => {
  let s = '';
  const fingers = [-24, -10, 4, 18];
  fingers.forEach((x, i) => (s += limb(`M${x} 6 L${x + (i - 1.5) * 4} -36 L${x + (i - 1.5) * 7} -54`, M.bone, 7)));
  s += limb('M-32 14 L-46 -6 L-50 -22', M.bone, 7);
  s += ink('M-34 2 C-34 -6 26 -6 26 2 L22 30 C10 40 -20 40 -30 30 Z', M.bone);
  s += limb('M-12 36 L-14 60 M4 36 L6 60', M.bone, 8);
  return glow(0, 0, 66, c.pal.light, 0.45) + place(s, 0, 0, 0.92, c.v === 'down' ? 180 : 0);
};

export const leg: Motif = (c) =>
  place(
    limb('M-40 -40 L0 0 L36 10', c.tint ?? '#3a3a44', 18) + ink('M30 -2 L58 2 C64 4 64 20 56 22 L28 22 Z', M.leather),
    0,
    0,
    1,
    -10,
  ) + line('M60 -10 L80 -20 M62 6 L84 6 M58 24 L78 34', '#fff', 3, 0.6);

// ---------------------------------------------------------------- 生物

export const eye: Motif = (c) =>
  glow(0, 0, 70, c.tint ?? c.pal.light, 0.45) +
  ink('M-60 0 C-30 -40 30 -40 60 0 C30 40 -30 40 -60 0 Z', '#f4ece0') +
  circle(0, 0, 22, c.tint ?? c.pal.accent) +
  dot(0, 0, 11, '#120a0c') +
  dot(-7, -8, 5, '#fff', 0.9) +
  fill('M-60 0 C-30 -40 30 -40 60 0 C30 -26 -30 -26 -60 0 Z', '#000', 0.2);

export const snake: Motif = (c) =>
  limb('M-60 40 C-30 60 -10 20 -30 0 C-50 -20 -20 -46 10 -30 C30 -20 20 6 40 0', c.tint ?? '#4a8a3a', 14) +
  line('M-60 40 C-30 60 -10 20 -30 0 C-50 -20 -20 -46 10 -30 C30 -20 20 6 40 0', '#e8f0a0', 2, 0.35) +
  ink('M34 -10 C44 -16 62 -10 62 0 C62 8 46 12 36 8 Z', c.tint ?? '#4a8a3a') +
  dot(50, -4, 3, '#f0e040') +
  line('M62 0 L72 -4 M62 0 L72 4', '#c0182a', 2);

export const beast: Motif = (c) => {
  // 冲撞的野兽头部（公牛/野猪/犀牛）
  const col = c.tint ?? '#6a4a34';
  const horns = c.v === 'rhino'
    ? ink('M30 -10 L58 -40 L44 -4 Z', M.bone)
    : c.v === 'ram'
      ? limb('M-6 -28 C-30 -50 -50 -20 -30 -6', '#c8b090', 9) + limb('M10 -28 C30 -50 50 -20 30 -6', '#c8b090', 9)
      : c.v === 'boar'
        ? ink('M20 14 C30 10 40 0 42 -10 C34 -2 26 4 16 6 Z', M.bone, 2) + ink('M-20 14 C-30 10 -40 0 -42 -10 C-34 -2 -26 4 -16 6 Z', M.bone, 2)
        : ink('M-22 -26 C-40 -30 -54 -46 -50 -60 C-40 -48 -30 -42 -14 -38 Z', M.bone, 2.4) + ink('M22 -26 C40 -30 54 -46 50 -60 C40 -48 30 -42 14 -38 Z', M.bone, 2.4);
  return (
    glow(0, 0, 70, c.pal.light, 0.4) +
    ink('M-34 -30 C-20 -44 20 -44 34 -30 C40 -10 36 20 20 40 C10 50 -10 50 -20 40 C-36 20 -40 -10 -34 -30 Z', col) +
    fill('M4 -42 C20 -42 34 -32 36 -20 C38 0 32 24 18 40 C10 48 4 48 0 48 C14 30 20 -10 4 -42 Z', '#000', 0.22) +
    ink('M-16 24 C-16 14 16 14 16 24 C16 36 -16 36 -16 24 Z', shade(col, 0.2), 2.4) +
    dot(-7, 26, 2.6, INK) +
    dot(7, 26, 2.6, INK) +
    ink('M-22 -10 L-8 -4 L-20 0 Z', '#ffdd55', 1.8) +
    ink('M22 -10 L8 -4 L20 0 Z', '#ffdd55', 1.8) +
    horns
  );
};

export const wolf: Motif = (c) =>
  glow(0, 0, 66, c.pal.light, 0.35) +
  ink('M-40 -40 L-20 -14 L20 -14 L40 -40 L36 0 C30 20 14 40 0 46 C-14 40 -30 20 -36 0 Z', c.tint ?? '#5a5a66') +
  fill('M0 -14 L20 -14 L40 -40 L36 0 C30 20 14 40 0 46 Z', '#000', 0.2) +
  ink('M-24 -2 L-8 4 L-22 8 Z', '#ffe066', 1.8) +
  ink('M24 -2 L8 4 L22 8 Z', '#ffe066', 1.8) +
  ink('M-8 30 L8 30 L0 40 Z', '#1a1010', 2) +
  line('M-10 36 L-6 44 M10 36 L6 44', '#fff', 2.4);

export const bird: Motif = (c) =>
  glow(0, 0, 66, c.pal.light, 0.4) +
  ink('M0 -30 C20 -30 30 -10 26 10 C22 30 8 40 0 40 C-8 40 -22 30 -26 10 C-30 -10 -20 -30 0 -30 Z', c.tint ?? '#8a6a48') +
  ink('M-26 0 C-50 -20 -64 -10 -66 10 C-50 4 -40 10 -24 18 Z', shade(c.tint ?? '#8a6a48', -0.15)) +
  ink('M26 0 C50 -20 64 -10 66 10 C50 4 40 10 24 18 Z', shade(c.tint ?? '#8a6a48', -0.15)) +
  circle(-10, -12, 8, '#f8e8b0', 2) +
  circle(10, -12, 8, '#f8e8b0', 2) +
  dot(-10, -12, 4, INK) +
  dot(10, -12, 4, INK) +
  ink('M-6 0 L6 0 L0 12 Z', M.gold, 2);

export const butterfly: Motif = (c) =>
  glow(0, 0, 70, c.pal.light, 0.4) +
  ink('M0 0 C-20 -50 -64 -40 -50 -6 C-40 10 -16 6 0 0 Z', c.tint ?? '#5a8ae0') +
  ink('M0 0 C20 -50 64 -40 50 -6 C40 10 16 6 0 0 Z', c.tint ?? '#5a8ae0') +
  ink('M0 4 C-14 14 -40 30 -30 44 C-18 50 -6 26 0 4 Z', shade(c.tint ?? '#5a8ae0', -0.2)) +
  ink('M0 4 C14 14 40 30 30 44 C18 50 6 26 0 4 Z', shade(c.tint ?? '#5a8ae0', -0.2)) +
  dot(-36, -20, 7, '#fff', 0.8) +
  dot(36, -20, 7, '#fff', 0.8) +
  limb('M0 -20 L0 30', '#2a1a14', 5) +
  line('M0 -20 L-10 -40 M0 -20 L10 -40', INK, 2);

export const worm: Motif = (c) => {
  let s = '';
  for (let i = 0; i < 6; i++) s += circle(-50 + i * 20, Math.sin(i * 1.1) * 14, 15 - i * 0.6, i % 2 ? (c.tint ?? '#b07a5a') : shade(c.tint ?? '#b07a5a', 0.15), 2.6);
  return glow(0, 0, 60, c.pal.light, 0.35) + s + dot(-54, -4, 3, INK) + dot(-46, -4, 3, INK);
};

export const germ: Motif = (c) => {
  let s = glow(0, 0, 64, c.tint ?? M.poison, 0.45);
  for (let i = 0; i < 10; i++) s += g(limb('M0 -30 L0 -44', c.tint ?? M.poison, 4) + circle(0, -46, 4, c.tint ?? M.poison, 2), `rotate(${i * 36})`);
  return s + circle(0, 0, 32, c.tint ?? M.poison) + dot(-10, -6, 7, shade(c.tint ?? M.poison, -0.3)) + dot(10, 8, 5, shade(c.tint ?? M.poison, -0.3)) + dot(-8, -14, 4, '#fff', 0.6);
};

export const slime: Motif = (c) =>
  ink('M-50 40 C-56 10 -40 -30 0 -36 C40 -30 56 10 50 40 Z', c.tint ?? '#7ad04a') +
  fill('M10 -34 C36 -26 54 8 50 40 L24 40 C34 10 30 -14 10 -34 Z', '#000', 0.2) +
  dot(-14, 0, 6, INK) +
  dot(14, 0, 6, INK) +
  dot(-16, -2, 2, '#fff') +
  dot(12, -2, 2, '#fff') +
  line('M-30 -16 C-24 -24 -14 -28 -6 -28', '#fff', 3, 0.6) +
  dot(30, -40, 6, c.tint ?? '#7ad04a', 0.8);

export const dragon: Motif = (c) =>
  glow(30, 10, 60, M.flame2, 0.5) +
  ink('M-60 30 C-50 -10 -30 -36 0 -36 C24 -36 36 -20 40 -6 L10 0 L36 8 C30 26 6 34 -20 30 Z', c.tint ?? '#4a7a3a') +
  ink('M-20 -30 L-30 -56 L-6 -36 Z', M.bone, 2) +
  ink('M2 -34 L0 -60 L16 -32 Z', M.bone, 2) +
  dot(-2, -20, 4, '#ffe040') +
  place(flameBody(), 56, 4, 0.5, 90);

export const demon: Motif = (c) =>
  glow(0, 0, 70, c.tint ?? M.flame3, 0.5) +
  ink('M-26 -36 C-40 -50 -46 -62 -40 -70 C-30 -58 -20 -50 -12 -44 Z', M.bone, 2.4) +
  ink('M26 -36 C40 -50 46 -62 40 -70 C30 -58 20 -50 12 -44 Z', M.bone, 2.4) +
  ink('M-34 -30 C-24 -48 24 -48 34 -30 C40 -6 30 30 0 46 C-30 30 -40 -6 -34 -30 Z', c.tint ?? '#a82a1e') +
  fill('M4 -46 C20 -44 34 -34 36 -20 C38 0 28 30 0 46 C16 20 20 -10 4 -46 Z', '#000', 0.25) +
  ink('M-24 -12 L-6 -4 L-22 2 Z', '#ffe066', 1.8) +
  ink('M24 -12 L6 -4 L22 2 Z', '#ffe066', 1.8) +
  ink('M-16 18 C-6 26 6 26 16 18 L12 28 C4 32 -4 32 -12 28 Z', '#1a0808', 2) +
  ink('M-10 20 L-8 26 L-6 20 Z', '#fff', 1) +
  ink('M10 20 L8 26 L6 20 Z', '#fff', 1);

export const owl: Motif = (c) => bird({ ...c, tint: c.tint ?? '#7a6a52' });

// ---------------------------------------------------------------- 王权、星辰

export const crown: Motif = (c) =>
  glow(0, 0, 70, c.pal.light, 0.5) +
  ink('M-46 30 L-52 -26 L-26 -2 L0 -40 L26 -2 L52 -26 L46 30 Z', c.tint ?? M.gold) +
  ink('M-48 30 L48 30 L46 44 L-46 44 Z', shade(c.tint ?? M.gold, -0.15)) +
  fill('M0 -40 L26 -2 L52 -26 L46 30 L0 30 Z', '#000', 0.15) +
  circle(0, 12, 7, '#d9472b', 2) +
  circle(-26, 16, 5, '#3a8ae0', 2) +
  circle(26, 16, 5, '#3a8ae0', 2) +
  dot(0, -40, 4, '#fff6d0') +
  dot(-52, -26, 4, '#fff6d0') +
  dot(52, -26, 4, '#fff6d0') +
  line('M-40 24 L-44 -10', '#fff', 2, 0.6);

export const scales: Motif = (c) =>
  limb('M0 -50 L0 46', M.gold, 5) +
  ink('M-24 46 L24 46 L18 52 L-18 52 Z', M.goldDark, 2) +
  limb('M-48 -34 L48 -34', M.gold, 5) +
  line('M-48 -34 L-62 4 M-48 -34 L-34 4 M48 -34 L34 0 M48 -34 L62 0', INK, 1.6) +
  ink('M-66 4 C-66 18 -30 18 -30 4 Z', c.tint ?? M.gold) +
  ink('M30 0 C30 14 66 14 66 0 Z', c.tint ?? M.gold) +
  circle(0, -54, 6, M.gold);

export const temple: Motif = (c) =>
  ink('M-60 -20 L0 -54 L60 -20 Z', c.tint ?? '#e8dcc0') +
  ink('M-56 -20 L56 -20 L56 -12 L-56 -12 Z', '#d0c4a8') +
  [-44, -22, 0, 22, 44].map((x) => ink(`M${x - 6} -12 L${x + 6} -12 L${x + 6} 40 L${x - 6} 40 Z`, '#e8dcc0', 2.4) + fill(`M${x + 1} -12 L${x + 6} -12 L${x + 6} 40 L${x + 1} 40 Z`, '#000', 0.2)).join('') +
  ink('M-64 40 L64 40 L64 50 L-64 50 Z', '#d0c4a8') +
  glow(0, -30, 20, c.pal.light, 0.6);

export const horn: Motif = (c) =>
  ink('M-50 20 C-30 20 10 6 40 -30 L52 -20 C34 20 -10 36 -52 34 Z', c.tint ?? '#d8c4a0') +
  ink('M40 -30 L60 -44 L66 -10 L52 -20 Z', M.gold) +
  line('M-30 22 L-28 32 M-10 18 L-6 28 M10 10 L16 22', M.goldDark, 2.4) +
  line('M70 -40 L88 -50 M72 -24 L92 -24 M70 -8 L88 2', '#fff', 3, 0.6);

export const scroll: Motif = (c) =>
  ink('M-40 -40 L40 -40 L40 40 L-40 40 Z', c.tint ?? '#efe2c0') +
  ink('M-48 -44 C-48 -54 48 -54 48 -44 C48 -34 -48 -34 -48 -44 Z', '#d8c8a0') +
  ink('M-48 44 C-48 34 48 34 48 44 C48 54 -48 54 -48 44 Z', '#d8c8a0') +
  line('M-28 -24 L28 -24 M-28 -12 L24 -12 M-28 0 L28 0 M-28 12 L16 12', '#6a5030', 2.4, 0.8) +
  circle(22, 26, 9, '#b02a2a', 2.4);

export const book: Motif = (c) =>
  (c.tint ? ink('M0 -26 C-20 -36 -46 -36 -66 -28 L-66 40 C-46 32 -20 32 0 42 C20 32 46 32 66 40 L66 -28 C46 -36 20 -36 0 -26 Z', c.tint) : '') +
  ink('M0 -30 C-20 -40 -44 -40 -60 -32 L-60 34 C-44 26 -20 26 0 36 Z', '#efe2c0') +
  ink('M0 -30 C20 -40 44 -40 60 -32 L60 34 C44 26 20 26 0 36 Z', '#e8d8b0') +
  line('M-48 -20 C-36 -24 -20 -24 -10 -20 M-48 -8 C-36 -12 -20 -12 -10 -8 M-48 4 C-36 0 -20 0 -10 4 M10 -20 C20 -24 36 -24 48 -20 M10 -8 C20 -12 36 -12 48 -8', '#6a5030', 2, 0.7) +
  glow(0, -10, 50, c.pal.light, 0.35);

export const crystalBall: Motif = (c) =>
  ink('M-34 34 L34 34 L28 50 L-28 50 Z', M.goldDark) +
  glow(0, -8, 56, c.pal.light, 0.6) +
  circle(0, -8, 38, mix(c.pal.light, '#ffffff', 0.3), 3) +
  `<circle cx="0" cy="-8" r="30" fill="${c.pal.accent}" opacity="0.55"/>` +
  line('M-18 -20 C-10 -32 10 -32 18 -20 C10 -10 -6 -2 -18 -20', '#fff', 2, 0.8) +
  dot(-14, -26, 7, '#fff', 0.9);

export const coin: Motif = (c) => {
  let s = glow(0, 0, 66, M.gold, 0.5);
  for (let i = 0; i < 4; i++) s += `<ellipse cx="${-20 + i * 14}" cy="${30 - i * 16}" rx="24" ry="9" fill="${M.gold}" stroke="${INK}" stroke-width="2.6"/>`;
  return s + circle(14, -20, 22, M.gold) + circle(14, -20, 14, M.goldDark, 2) + dot(8, -26, 4, '#fff', 0.7);
};

export const key: Motif = () => place(circle(0, -36, 18, M.gold) + circle(0, -36, 8, '#1a1010', 2) + limb('M0 -18 L0 50', M.gold, 8) + ink('M4 30 L22 30 L22 38 L4 38 Z', M.gold, 2) + ink('M4 42 L16 42 L16 50 L4 50 Z', M.gold, 2), 0, 0, 0.95, 36);

export const halo: Motif = (c) =>
  glow(0, 0, 80, '#fff6c8', 0.7) +
  `<ellipse cx="0" cy="-30" rx="40" ry="12" fill="none" stroke="${INK}" stroke-width="10"/><ellipse cx="0" cy="-30" rx="40" ry="12" fill="none" stroke="#ffe48a" stroke-width="6"/>` +
  ink('M-30 50 C-30 10 -20 -6 0 -6 C20 -6 30 10 30 50 Z', '#fbf3e0') +
  ink('M-44 10 C-70 -6 -70 30 -40 40 Z', '#fbf3e0', 2.4) +
  ink('M44 10 C70 -6 70 30 40 40 Z', '#fbf3e0', 2.4);

// ---------------------------------------------------------------- 杂物

export const target: Motif = (c) =>
  circle(0, 0, 44, '#efe2c0') + circle(0, 0, 32, '#c0302a') + circle(0, 0, 20, '#efe2c0') + circle(0, 0, 9, '#c0302a') + place(daggerBody(M.steel), 18, -18, 0.8, 45);

export const dice: Motif = () => {
  const die = (pips: [number, number][]) => ink('M-22 -22 L22 -22 L22 22 L-22 22 Z', '#f4ece0') + pips.map(([x, y]) => dot(x, y, 4, '#1a1010')).join('');
  return (
    place(die([[-10, -10], [0, 0], [10, 10]]), -22, 6, 1, -14) +
    place(die([[-10, -10], [10, -10], [-10, 10], [10, 10], [0, 0]]), 26, -6, 0.9, 18)
  );
};

export const bomb: Motif = (c) =>
  circle(0, 8, 34, '#2a2a34') +
  dot(-12, -6, 8, '#fff', 0.35) +
  ink('M8 -28 L20 -28 L20 -20 L8 -20 Z', '#4a4a54', 2) +
  line('M14 -28 C16 -40 30 -44 36 -36', '#8a6a3a', 3.5) +
  place(ink(starPath(0, 0, 14, 5, 8), M.flame2, 2), 38, -38, 1) +
  glow(38, -38, 20, M.flame2, 0.8);

export const mask: Motif = (c) =>
  ink('M-44 -30 C-30 -44 30 -44 44 -30 C48 0 30 40 0 46 C-30 40 -48 0 -44 -30 Z', c.tint ?? '#efe6d6') +
  fill('M4 -42 C26 -40 44 -32 44 -30 C48 0 30 40 0 46 C18 20 22 -10 4 -42 Z', '#000', 0.15) +
  ink('M-30 -12 C-24 -22 -12 -22 -8 -10 C-14 -4 -26 -4 -30 -12 Z', '#1a1010', 2) +
  ink('M30 -12 C24 -22 12 -22 8 -10 C14 -4 26 -4 30 -12 Z', '#1a1010', 2) +
  (c.v === 'sad'
    ? ink('M-16 26 C-8 16 8 16 16 26 L14 28 C6 22 -6 22 -14 28 Z', '#1a1010', 2)
    : ink('M-18 18 C-8 30 8 30 18 18 L14 16 C6 22 -6 22 -14 16 Z', '#1a1010', 2)) +
  line('M-36 -28 C-28 -36 -14 -38 -4 -38', '#fff', 2, 0.6);

/** 表情脸（怒、惧、痛……） */
export const face: Motif = (c) => {
  const v = c.v ?? 'angry';
  const skin = c.tint ?? (v === 'cold' ? '#a8d8f0' : v === 'sick' ? '#b8d090' : M.skin);
  let brows = '';
  let eyes = '';
  let mouth = '';
  if (v === 'angry') {
    brows = line('M-28 -20 L-8 -10 M28 -20 L8 -10', INK, 4);
    eyes = dot(-16, -4, 4, INK) + dot(16, -4, 4, INK);
    mouth = ink('M-18 24 C-8 14 8 14 18 24 Z', '#5a1010', 2.4);
  } else if (v === 'scream' || v === 'fear') {
    brows = line('M-28 -14 L-10 -22 M28 -14 L10 -22', INK, 3);
    eyes = circle(-16, -4, 7, '#fff', 2) + circle(16, -4, 7, '#fff', 2) + dot(-16, -4, 2.4, INK) + dot(16, -4, 2.4, INK);
    mouth = ink('M-10 16 C-10 6 10 6 10 16 L8 32 C4 38 -4 38 -8 32 Z', '#3a0808', 2.4);
  } else if (v === 'pain') {
    brows = line('M-28 -14 L-10 -20 M28 -14 L10 -20', INK, 3);
    eyes = line('M-24 -4 L-10 -2 M24 -4 L10 -2', INK, 3);
    mouth = line('M-16 22 L-8 18 L0 22 L8 18 L16 22', INK, 3);
  } else if (v === 'sad') {
    brows = line('M-28 -10 L-10 -18 M28 -10 L10 -18', INK, 3);
    eyes = dot(-16, -2, 3.6, INK) + dot(16, -2, 3.6, INK) + ink('M-18 6 C-22 14 -14 18 -14 10 Z', '#8ad0ff', 1.4);
    mouth = line('M-14 26 C-6 18 6 18 14 26', INK, 3);
  } else if (v === 'smug') {
    brows = line('M-26 -16 L-10 -16 M26 -20 L10 -14', INK, 3);
    eyes = line('M-24 -4 L-10 -4 M24 -4 L10 -4', INK, 3);
    mouth = line('M-12 22 C0 26 10 22 16 14', INK, 3);
  } else {
    brows = line('M-26 -16 L-10 -16 M26 -16 L10 -16', INK, 3);
    eyes = dot(-16, -4, 4, INK) + dot(16, -4, 4, INK);
    mouth = line('M-12 22 L12 22', INK, 3);
  }
  return (
    glow(0, 0, 66, c.pal.light, 0.35) +
    ink('M-36 -18 C-36 -46 36 -46 36 -18 L34 14 C30 40 14 48 0 48 C-14 48 -30 40 -34 14 Z', skin) +
    fill('M6 -44 C26 -40 36 -30 36 -18 L34 14 C30 40 14 48 0 48 C18 30 22 -10 6 -44 Z', '#000', 0.16) +
    brows +
    eyes +
    mouth +
    (v === 'angry' ? line('M40 -40 L50 -50 M44 -30 L56 -32', '#c0182a', 3, 0.8) : '')
  );
};

export const brain: Motif = (c) =>
  glow(0, 0, 66, c.tint ?? c.pal.light, 0.45) +
  ink('M-40 10 C-50 -10 -36 -36 -14 -34 C-6 -46 20 -46 26 -32 C46 -34 52 -6 44 8 C50 26 30 40 14 34 C4 44 -20 44 -26 32 C-44 34 -50 20 -40 10 Z', c.tint ?? '#e8a0b0') +
  line('M-28 -14 C-18 -20 -10 -10 -16 0 C-22 10 -10 18 0 12 M0 -34 C-4 -20 10 -12 18 -18 C28 -24 34 -6 24 4 C14 14 26 26 30 24', '#8a3a50', 2.4, 0.8);

export const magnifier: Motif = (c) =>
  place(limb('M24 24 L54 54', M.wood, 10) + circle(0, 0, 32, '#2a2018') + `<circle cx="0" cy="0" r="25" fill="${mix(c.pal.light, '#ffffff', 0.4)}" opacity="0.6"/>` + line('M-14 -10 C-10 -18 -2 -20 4 -18', '#fff', 3, 0.9), -6, -6, 1);

export const arrows: Motif = (c) =>
  line('M-40 -10 A42 42 0 0 1 36 -18', INK, 13) +
  line('M-40 -10 A42 42 0 0 1 36 -18', c.tint ?? c.pal.accent2, 7) +
  ink('M24 -34 L48 -18 L24 -2 Z', c.tint ?? c.pal.accent2, 2.4) +
  line('M40 10 A42 42 0 0 1 -36 18', INK, 13) +
  line('M40 10 A42 42 0 0 1 -36 18', c.tint ?? c.pal.accent2, 7) +
  ink('M-24 34 L-48 18 L-24 2 Z', c.tint ?? c.pal.accent2, 2.4);

export const infinity: Motif = (c) =>
  glow(0, 0, 70, c.pal.light, 0.45) +
  line('M0 0 C-20 -34 -60 -30 -60 0 C-60 30 -20 34 0 0 C20 -34 60 -30 60 0 C60 30 20 34 0 0', INK, 16) +
  line('M0 0 C-20 -34 -60 -30 -60 0 C-60 30 -20 34 0 0 C20 -34 60 -30 60 0 C60 30 20 34 0 0', c.tint ?? c.pal.accent2, 9);

export const feather: Motif = (c) =>
  place(
    ink('M0 -60 C24 -40 26 10 4 44 L0 56 L-4 44 C-26 10 -24 -40 0 -60 Z', c.tint ?? '#e8eef2') +
      line('M0 -54 L0 56', '#8a8a90', 2) +
      line('M0 -30 L-14 -40 M0 -14 L-18 -24 M0 2 L-18 -6 M0 -30 L14 -40 M0 -14 L18 -24 M0 2 L18 -6', '#8a8a90', 1.4, 0.8),
    0,
    0,
    1,
    30,
  );

export const caltrops: Motif = () => {
  let s = '';
  for (const [x, y] of [
    [-34, 18],
    [8, 26],
    [36, 6],
    [-6, -8],
  ]) {
    s += place(ink('M0 -20 L6 4 L-6 4 Z', M.steel, 2.2) + ink('M-18 12 L4 0 L2 10 Z', M.steelDark, 2) + ink('M18 12 L-4 0 L-2 10 Z', M.steel, 2), x, y, 1, (x * 7) % 40);
  }
  return s;
};

export const clock: Motif = (c) =>
  circle(0, 4, 42, '#efe2c0') + circle(0, 4, 34, '#f8f0dc', 2) + ink('M-6 -46 L6 -46 L6 -38 L-6 -38 Z', M.gold, 2) + line('M0 4 L0 -22 M0 4 L18 12', INK, 4) + dot(0, 4, 4, INK) + line('M0 -26 L0 -30 M0 34 L0 38 M-30 4 L-34 4 M30 4 L34 4', INK, 2);

export const map: Motif = () =>
  ink('M-56 -36 L-20 -44 L20 -36 L56 -44 L56 36 L20 44 L-20 36 L-56 44 Z', '#e8d8b0') +
  fill('M-20 -44 L20 -36 L20 44 L-20 36 Z', '#000', 0.1) +
  line('M-44 24 C-30 0 -10 20 4 -4 C14 -20 30 -10 40 -26', '#a82a1e', 2.4) +
  line('M34 -32 L46 -20 M46 -32 L34 -20', '#a82a1e', 3);

export const chess: Motif = (c) =>
  ink('M-26 50 L26 50 L22 38 L-22 38 Z', c.tint ?? '#efe6d6') +
  ink('M-16 38 L-10 -4 L10 -4 L16 38 Z', c.tint ?? '#efe6d6') +
  (c.v === 'queen'
    ? ink('M-20 -4 L-24 -36 L-10 -20 L0 -44 L10 -20 L24 -36 L20 -4 Z', c.tint ?? '#efe6d6') + circle(0, -48, 5, M.gold)
    : c.v === 'knight'
      ? ink('M-14 -4 L-18 -24 C-14 -44 10 -50 18 -34 L22 -12 L10 -14 L14 -4 Z', c.tint ?? '#efe6d6') + dot(4, -32, 3, INK)
      : circle(0, -16, 16, c.tint ?? '#efe6d6')) +
  fill('M0 -4 L10 -4 L16 38 L22 38 L26 50 L0 50 Z', '#000', 0.15);

export const flag: Motif = (c) =>
  limb('M-30 54 L-30 -56', M.wood, 5) +
  ink('M-28 -52 C0 -60 10 -40 40 -46 L40 0 C10 6 0 -14 -28 -6 Z', c.tint ?? '#efe6d6') +
  [0, 1, 2].map((i) => fill(`M${-28 + i * 22} -52 h11 v11 h-11 Z`, INK, 0.8)).join('');

export const tent: Motif = (c) =>
  ink('M-60 40 L0 -44 L60 40 Z', c.tint ?? '#8a7a5a') + ink('M-12 40 L0 4 L12 40 Z', '#1a1010', 2) + fill('M0 -44 L60 40 L0 40 Z', '#000', 0.2) + place(flameBody(), 40, 40, 0.24) + glow(40, 36, 24, M.flame2, 0.7);

export const compass: Motif = (c) =>
  circle(0, 0, 42, M.gold) + circle(0, 0, 34, '#f4ead0', 2) + ink('M0 -30 L8 0 L0 30 L-8 0 Z', '#c0302a', 2) + fill('M0 0 L8 0 L0 30 L-8 0 Z', '#2a2a34') + dot(0, 0, 3, M.gold);

export const wand: Motif = (c) =>
  place(limb('M0 -10 L0 60', '#2a1a14', 6) + ink(starPath(0, -30, 24, 10, 5), '#ffe48a', 2.4) + glow(0, -30, 36, c.pal.light, 0.7), 0, 0, 1, 30);

export const bulb: Motif = (c) =>
  glow(0, -6, 66, '#fff1a8', 0.6) +
  ink('M-14 30 C-14 14 -32 4 -32 -16 C-32 -38 -16 -50 0 -50 C16 -50 32 -38 32 -16 C32 4 14 14 14 30 Z', '#fff7c8') +
  ink('M-14 30 L14 30 L12 44 L-12 44 Z', M.steelDark) +
  line('M-8 28 L-4 -6 L4 -6 L8 28', '#d8a83a', 2) +
  line('M-22 -24 C-20 -34 -12 -42 -4 -42', '#fff', 3, 0.9);

export const card: Motif = (c) =>
  place(ink('M-26 -38 L26 -38 L26 38 L-26 38 Z', '#f4ece0') + ink(starPath(0, 0, 14, 6, 4), '#c0302a', 2), -16, 4, 1, -14) +
  place(ink('M-26 -38 L26 -38 L26 38 L-26 38 Z', '#f4ece0') + ink(starPath(0, 0, 14, 6, 5), c.pal.accent, 2), 18, 0, 1, 12);

export const dove: Motif = (c) =>
  glow(0, 0, 70, '#fff6e0', 0.5) +
  ink('M-50 10 C-30 -6 -10 -2 0 6 C10 -30 40 -50 60 -46 C40 -30 34 -10 30 4 C40 6 50 14 52 20 C30 30 0 30 -20 22 C-34 20 -44 16 -50 10 Z', '#fbf6ea') +
  dot(-36, 6, 3, INK) +
  ink('M-52 10 L-62 14 L-52 16 Z', M.gold, 1.6);

export const anchor: Motif = (c) =>
  circle(0, -44, 10, 'none', 0) +
  `<circle cx="0" cy="-46" r="9" fill="none" stroke="${INK}" stroke-width="9"/><circle cx="0" cy="-46" r="9" fill="none" stroke="${M.steelDark}" stroke-width="4.5"/>` +
  limb('M0 -36 L0 44', M.steelDark, 8) +
  limb('M-22 -22 L22 -22', M.steelDark, 7) +
  limb('M-40 18 C-36 40 -16 50 0 50 C16 50 36 40 40 18', M.steelDark, 7) +
  ink('M-46 10 L-34 14 L-42 26 Z', M.steelDark, 2) +
  ink('M46 10 L34 14 L42 26 Z', M.steelDark, 2);

// ---------------------------------------------------------------- 科技（故障机器人）

export const battery: Motif = (c) =>
  glow(0, 0, 64, c.pal.light, 0.45) +
  ink('M-24 -40 L24 -40 L24 48 L-24 48 Z', '#3b4c63') +
  ink('M-10 -48 L10 -48 L10 -40 L-10 -40 Z', M.steelDark, 2) +
  [0, 1, 2, 3].map((i) => fill(`M-16 ${36 - i * 20} h32 v-14 h-32 Z`, i < 3 ? c.pal.light : '#18263a')).join('') +
  line('M-18 -34 L-18 40', '#fff', 1.6, 0.4);

export const chip: Motif = (c) => {
  let pins = '';
  for (let i = 0; i < 5; i++) pins += line(`M${-28 + i * 14} -40 L${-28 + i * 14} -52 M${-28 + i * 14} 40 L${-28 + i * 14} 52 M-40 ${-28 + i * 14} L-52 ${-28 + i * 14} M40 ${-28 + i * 14} L52 ${-28 + i * 14}`, M.gold, 3);
  return glow(0, 0, 70, c.pal.light, 0.4) + pins + ink('M-40 -40 L40 -40 L40 40 L-40 40 Z', '#24303e') + ink('M-20 -20 L20 -20 L20 20 L-20 20 Z', c.pal.accent, 2) + glow(0, 0, 16, c.pal.light, 0.9);
};

export const disk: Motif = (c) =>
  ink('M-40 -44 L30 -44 L42 -32 L42 44 L-40 44 Z', '#2a3442') +
  ink('M-24 -44 L20 -44 L20 -14 L-24 -14 Z', M.steel, 2.4) +
  ink('M8 -40 L16 -40 L16 -20 L8 -20 Z', '#2a3442', 1.6) +
  ink('M-28 6 L30 6 L30 44 L-28 44 Z', '#efe6d6', 2.4) +
  line('M-18 18 L20 18 M-18 28 L14 28', c.pal.accent, 2.4);

export const plug: Motif = (c) =>
  limb('M-60 40 C-30 40 -30 0 -10 0', '#2a2a34', 7) +
  ink('M-12 -16 L18 -16 C30 -16 30 16 18 16 L-12 16 Z', '#3b4c63') +
  limb('M24 -8 L44 -8 M24 8 L44 8', M.gold, 5) +
  line('M48 -18 L58 -28 M52 0 L66 0 M48 18 L58 28', c.pal.light, 3, 0.9) +
  glow(50, 0, 24, c.pal.light, 0.7);

export const gear: Motif = (c) => {
  let teeth = '';
  for (let i = 0; i < 10; i++) teeth += g(ink('M-7 -46 L7 -46 L9 -34 L-9 -34 Z', c.tint ?? M.steel, 2.4), `rotate(${i * 36})`);
  return teeth + circle(0, 0, 36, c.tint ?? M.steel) + circle(0, 0, 14, '#2a2a34') + fill('M0 -36 A36 36 0 0 1 0 36 Z', '#000', 0.15);
};

export const wrench: Motif = (c) =>
  place(
    limb('M0 -14 L0 58', c.tint ?? M.steel, 11) +
      ink('M-22 -50 C-34 -32 -26 -10 -8 -8 L8 -8 C26 -10 34 -32 22 -50 L13 -50 L13 -28 L-13 -28 L-13 -50 Z', c.tint ?? M.steel) +
      line('M-18 -44 C-26 -30 -20 -16 -8 -13', '#fff', 1.8, 0.6) +
      fill('M0 -8 L8 -8 C26 -10 34 -32 22 -50 L13 -50 L13 -28 L0 -28 Z', '#000', 0.2),
    0,
    0,
    0.95,
    -36,
  );

export const rocket: Motif = (c) =>
  place(
    ink('M0 -56 C16 -40 18 -10 14 20 L-14 20 C-18 -10 -16 -40 0 -56 Z', '#e8eef2') +
      circle(0, -18, 7, c.pal.accent, 2.4) +
      ink('M-14 6 L-28 28 L-14 22 Z', '#c0302a', 2) +
      ink('M14 6 L28 28 L14 22 Z', '#c0302a', 2) +
      place(flameBody(), 0, 38, 0.32, 180),
    0,
    0,
    1,
    45,
  ) + line('M-30 40 L-60 70 M-20 54 L-40 80', '#fff', 3, 0.5);

export const screen: Motif = (c) =>
  ink('M-50 -36 L50 -36 L50 30 L-50 30 Z', '#24303e') +
  ink('M-42 -28 L42 -28 L42 22 L-42 22 Z', '#0c1a28', 2) +
  line('M-34 -16 L-10 -16 M-34 -4 L6 -4 M-34 8 L-4 8', c.pal.light, 3, 0.9) +
  glow(0, -4, 40, c.pal.light, 0.35) +
  ink('M-14 30 L14 30 L18 42 L-18 42 Z', '#3b4c63');

export const robotHead: Motif = (c) =>
  glow(0, 0, 66, c.pal.light, 0.4) +
  ink('M-34 -30 L34 -30 L38 24 L-38 24 Z', '#6d8fb8') +
  ink('M-26 -14 L26 -14 L26 2 L-26 2 Z', '#0e2233', 2.4) +
  fill('M-22 -10 L22 -10 L22 -2 L-22 -2 Z', c.pal.light) +
  limb('M0 -30 L0 -46', '#2a3a4a', 4) +
  circle(0, -50, 6, '#ff7a6a') +
  ink('M-14 10 L14 10 L14 18 L-14 18 Z', '#3b4c63', 2) +
  fill('M4 -30 L34 -30 L38 24 L4 24 Z', '#000', 0.15);

export const claw: Motif = (c) =>
  limb('M-60 40 L-20 10', '#3b4c63', 14) +
  circle(-20, 10, 12, '#5b7fa8') +
  ink('M-14 0 C10 -30 40 -40 56 -30 C36 -26 20 -14 6 4 Z', M.steel) +
  ink('M-10 18 C14 14 40 20 52 34 C34 34 16 32 0 28 Z', M.steel) +
  line('M30 -46 L50 -60 M40 -30 L66 -36 M44 40 L66 52', '#fff', 3, 0.6);

export const radio: Motif = (c) =>
  ink('M-50 -24 L50 -24 L50 36 L-50 36 Z', '#6a4a34') +
  circle(-22, 6, 18, '#2a2018', 2.4) +
  [0, 1, 2].map((i) => line(`M-36 ${-6 + i * 8} L-8 ${-6 + i * 8}`, '#5a4a3a', 2)).join('') +
  ink('M10 -12 L40 -12 L40 4 L10 4 Z', '#efe2c0', 2) +
  circle(20, 20, 6, M.gold, 2) +
  circle(34, 20, 6, M.gold, 2) +
  limb('M30 -24 L50 -56', M.steel, 2.5) +
  line('M58 -50 C64 -44 64 -36 58 -30 M66 -56 C76 -46 76 -32 66 -24', c.pal.light, 3, 0.8);

export const satellite: Motif = (c) =>
  ink('M-40 -20 C-20 30 30 40 50 20 C20 10 -10 -10 -40 -20 Z', '#e8eef2') +
  limb('M6 10 L30 -20', M.steelDark, 4) +
  circle(32, -22, 6, c.pal.light) +
  limb('M4 26 L-10 56 M4 26 L20 56', M.steelDark, 5) +
  line('M44 -34 C54 -30 58 -20 56 -10 M50 -46 C66 -40 72 -22 68 -6', c.pal.light, 3, 0.8);

export const loop: Motif = (c) => arrows({ ...c, tint: c.tint ?? c.pal.light });

export const chart: Motif = (c) =>
  ink('M-50 -40 L-50 40 L54 40', 'none', 4) +
  (c.v === 'down'
    ? line('M-46 -30 L-20 -10 L0 -20 L20 10 L46 24', '#e0503a', 5)
    : line('M-46 30 L-20 10 L0 20 L20 -10 L46 -26', '#5ad04a', 5)) +
  ink(c.v === 'down' ? 'M36 30 L50 26 L44 14 Z' : 'M36 -32 L50 -28 L44 -16 Z', c.v === 'down' ? '#e0503a' : '#5ad04a', 2);

export const puzzle: Motif = (c) =>
  ink('M-40 -40 L-8 -40 C-8 -54 10 -54 10 -40 L40 -40 L40 -8 C54 -8 54 10 40 10 L40 40 L-40 40 Z', c.tint ?? c.pal.accent) + fill('M10 -40 L40 -40 L40 -8 C46 -6 46 8 40 10 L40 40 L10 40 Z', '#000', 0.2) + line('M-34 -34 L-34 30', '#fff', 2, 0.4);

export const thermometer: Motif = (c) =>
  ink('M-8 -50 C-8 -60 8 -60 8 -50 L8 20 C20 26 20 50 0 50 C-20 50 -20 26 -8 20 Z', '#e8eef2') +
  fill('M-3 -30 L3 -30 L3 26 L-3 26 Z', '#e0503a') +
  dot(0, 36, 10, '#e0503a') +
  line('M14 -40 L22 -40 M14 -24 L22 -24 M14 -8 L22 -8', INK, 2);

export const recycle: Motif = (c) => {
  let s = '';
  for (let i = 0; i < 3; i++) s += g(line('M-30 20 L-6 -22', INK, 13) + line('M-30 20 L-6 -22', c.tint ?? '#5ad04a', 7) + ink('M-14 -30 L4 -34 L4 -14 Z', c.tint ?? '#5ad04a', 2), `rotate(${i * 120})`);
  return glow(0, 0, 60, c.pal.light, 0.35) + s;
};

export const keyboard: Motif = (c) => {
  let keys = '';
  for (let y = 0; y < 3; y++) for (let x = 0; x < 7; x++) keys += ink(`M${-48 + x * 14 + y * 3} ${-14 + y * 14} h11 v11 h-11 Z`, '#d8dce6', 1.6);
  return ink('M-56 -22 L56 -22 L56 32 L-56 32 Z', '#3b4c63') + keys + glow(0, 0, 50, c.pal.light, 0.2);
};

export const projector: Motif = (c) =>
  fill('M20 -6 L80 -50 L80 50 Z', c.pal.light, 0.3) +
  ink('M-40 -20 L20 -20 L20 20 L-40 20 Z', '#3b4c63') +
  circle(20, 0, 12, c.pal.light) +
  circle(-30, -32, 12, '#2a3442') +
  circle(-6, -32, 12, '#2a3442');

export const cabinet: Motif = (c) =>
  ink('M-34 -50 L34 -50 L34 50 L-34 50 Z', M.steelDark) +
  [0, 1, 2].map((i) => ink(`M-28 ${-44 + i * 32} h56 v28 h-56 Z`, M.steel, 2) + ink(`M-8 ${-34 + i * 32} h16 v6 h-16 Z`, M.gold, 1.6)).join('');

export const abacus: Motif = (c) => {
  let s = ink('M-50 -40 L50 -40 L50 40 L-50 40 Z', 'none', 6);
  for (let r = 0; r < 4; r++) {
    s += line(`M-46 ${-26 + r * 18} L46 ${-26 + r * 18}`, '#6a4a34', 2.4);
    for (let i = 0; i < 5; i++) s += circle(-36 + i * 10 + (r % 2) * 20, -26 + r * 18, 5, i % 2 ? '#c0302a' : c.pal.accent, 1.6);
  }
  return s;
};

export const speaker: Motif = (c) =>
  ink('M-40 -16 L-20 -16 L6 -40 L6 40 L-20 16 L-40 16 Z', '#3b4c63') +
  line('M20 -16 C28 -8 28 8 20 16 M30 -28 C44 -14 44 14 30 28 M40 -40 C60 -20 60 20 40 40', c.pal.light, 4, 0.9);

export const globe: Motif = (c) =>
  glow(0, 0, 70, c.pal.light, 0.45) +
  circle(0, 0, 42, '#1c3f6b') +
  `<ellipse cx="0" cy="0" rx="18" ry="42" fill="none" stroke="${c.pal.light}" stroke-width="2.4"/>` +
  line('M-42 0 L42 0 M-36 -20 L36 -20 M-36 20 L36 20 M0 -42 L0 42', c.pal.light, 2.4, 0.9) +
  [0, 1, 2, 3].map((i) => {
    const a = (i * Math.PI) / 2 + 0.5;
    return dot(Math.cos(a) * 54, Math.sin(a) * 54, 4, c.pal.light) + line(`M${Math.cos(a) * 42} ${Math.sin(a) * 42} L${Math.cos(a) * 54} ${Math.sin(a) * 54}`, c.pal.light, 2);
  }).join('');

export const biohazard: Motif = (c) => {
  let s = glow(0, 0, 70, '#e0e040', 0.5) + circle(0, 0, 44, '#f0e040');
  for (let i = 0; i < 3; i++) s += g(fill('M0 0 L-14 -36 C-6 -40 6 -40 14 -36 Z', INK), `rotate(${i * 120})`);
  return s + circle(0, 0, 8, '#f0e040', 2.4);
};

export const forceField: Motif = (c) =>
  glow(0, 0, 70, c.pal.light, 0.5) +
  `<path d="M-54 40 A54 54 0 0 1 54 40" fill="${c.pal.light}" fill-opacity="0.25" stroke="${INK}" stroke-width="7"/><path d="M-54 40 A54 54 0 0 1 54 40" fill="none" stroke="${c.pal.light}" stroke-width="3.5"/>` +
  [0, 1, 2, 3, 4].map((i) => line(`M${-40 + i * 20} 40 L${-36 + i * 18} ${-10 - Math.abs(2 - i) * -8}`, c.pal.light, 1.4, 0.5)).join('');

export const core: Motif = (c) =>
  glow(0, 0, 76, c.pal.light, 0.6) + ink('M0 -46 L40 -23 L40 23 L0 46 L-40 23 L-40 -23 Z', '#3b4c63') + ink('M0 -30 L26 -15 L26 15 L0 30 L-26 15 L-26 -15 Z', c.pal.accent, 2.4) + glow(0, 0, 24, '#ffffff', 0.9);

// ---------------------------------------------------------------- 人物剪影

type J = [number, number];
interface Pose {
  h: J;
  n: J;
  p: J;
  le: J;
  lh: J;
  re: J;
  rh: J;
  lk: J;
  lf: J;
  rk: J;
  rf: J;
  /** 手持物 */
  hold?: 'sword' | 'dagger' | 'barbell' | 'staff';
  cape?: boolean;
}

const POSES: Record<string, Pose> = {
  stand: { h: [0, -44], n: [0, -30], p: [0, 4], le: [-12, -12], lh: [-15, 8], re: [12, -12], rh: [15, 8], lk: [-8, 28], lf: [-10, 54], rk: [8, 28], rf: [10, 54] },
  run: { h: [12, -40], n: [7, -27], p: [-2, 4], le: [-12, -14], lh: [-26, -4], re: [20, -16], rh: [32, -26], lk: [-12, 26], lf: [-32, 44], rk: [16, 16], rf: [14, 40] },
  kick: { h: [-14, -40], n: [-11, -26], p: [-4, 6], le: [-26, -14], lh: [-38, -24], re: [4, -18], rh: [16, -26], lk: [-10, 30], lf: [-14, 56], rk: [18, -2], rf: [46, -14] },
  flip: { h: [6, 26], n: [3, 12], p: [-2, -18], le: [-14, 20], lh: [-22, 34], re: [16, 18], rh: [26, 30], lk: [-16, -34], lf: [-2, -46], rk: [10, -38], rf: [22, -30] },
  meditate: { h: [0, -22], n: [0, -8], p: [0, 24], le: [-17, 6], lh: [-10, 22], re: [17, 6], rh: [10, 22], lk: [-28, 40], lf: [8, 46], rk: [28, 40], rf: [-8, 46] },
  lift: { h: [0, -18], n: [0, -4], p: [0, 26], le: [-17, -20], lh: [-26, -40], re: [17, -20], rh: [26, -40], lk: [-12, 40], lf: [-16, 56], rk: [12, 40], rf: [16, 56], hold: 'barbell' },
  shrug: { h: [0, -40], n: [0, -26], p: [0, 8], le: [-18, -16], lh: [-32, -28], re: [18, -16], rh: [32, -28], lk: [-8, 32], lf: [-10, 56], rk: [8, 32], rf: [10, 56] },
  dance: { h: [6, -44], n: [4, -30], p: [0, 4], le: [-14, -38], lh: [-24, -56], re: [18, -22], rh: [34, -18], lk: [-6, 30], lf: [-4, 56], rk: [16, 22], rf: [32, 36] },
  pray: { h: [0, -26], n: [0, -12], p: [0, 18], le: [-9, -2], lh: [-1, -14], re: [9, -2], rh: [1, -14], lk: [-12, 38], lf: [-30, 44], rk: [14, 32], rf: [14, 54], cape: true },
  slash: { h: [-6, -42], n: [-4, -28], p: [0, 6], le: [-18, -14], lh: [-26, 2], re: [12, -34], rh: [24, -48], lk: [-14, 30], lf: [-24, 54], rk: [12, 28], rf: [22, 54], hold: 'sword' },
  stab: { h: [-8, -40], n: [-6, -26], p: [-2, 6], le: [-20, -12], lh: [-30, 0], re: [14, -22], rh: [34, -22], lk: [-16, 30], lf: [-28, 54], rk: [14, 28], rf: [26, 54], hold: 'dagger' },
  throw: { h: [-4, -42], n: [-2, -28], p: [0, 6], le: [16, -22], lh: [34, -24], re: [-14, -36], rh: [-26, -50], lk: [-16, 30], lf: [-26, 54], rk: [14, 28], rf: [26, 54], hold: 'dagger' },
  crouch: { h: [12, -10], n: [7, 2], p: [-8, 22], le: [16, 14], lh: [28, 24], re: [0, 14], rh: [8, 28], lk: [12, 36], lf: [6, 54], rk: [-22, 40], rf: [-32, 54], hold: 'dagger', cape: true },
  cloak: { h: [0, -44], n: [0, -30], p: [0, 4], le: [-10, -10], lh: [-6, 6], re: [10, -10], rh: [6, 6], lk: [-6, 28], lf: [-8, 54], rk: [6, 28], rf: [8, 54], cape: true },
  leap: { h: [14, -46], n: [9, -33], p: [-2, -4], le: [-14, -30], lh: [-26, -44], re: [24, -36], rh: [36, -48], lk: [-14, 14], lf: [-34, 24], rk: [14, 10], rf: [8, 30] },
  block: { h: [-4, -42], n: [-2, -28], p: [0, 6], le: [14, -26], lh: [22, -40], re: [16, -16], rh: [26, -30], lk: [-12, 30], lf: [-18, 54], rk: [12, 28], rf: [20, 54] },
  cast: { h: [0, -44], n: [0, -30], p: [0, 4], le: [-18, -30], lh: [-26, -48], re: [18, -30], rh: [26, -48], lk: [-8, 28], lf: [-12, 54], rk: [8, 28], rf: [12, 54], cape: true },
};

const CAPE_OK = new Set(['stand', 'cloak', 'pray', 'cast', 'meditate', 'shrug', 'slash', 'stab', 'throw', 'block', 'crouch']);

function rig(q: Pose, col: string, hood: boolean, pose: string): string {
  const L = (a: J, b: J, c: J, w: number) => line(`M${a[0]} ${a[1]} L${b[0]} ${b[1]} L${c[0]} ${c[1]}`, col, w);
  let s = '';
  if (q.cape || (hood && CAPE_OK.has(pose))) {
    const [nx, ny] = q.n;
    const [px, py] = q.p;
    s += fill(`M${nx - 12} ${ny - 4} L${nx + 12} ${ny - 4} L${px + 26} ${py + 46} C${px + 8} ${py + 52} ${px - 8} ${py + 52} ${px - 26} ${py + 46} Z`, col);
  }
  s += L(q.n, q.le, q.lh, 8.5) + L(q.p, q.lk, q.lf, 10.5);
  s += line(`M${q.n[0]} ${q.n[1]} L${q.p[0]} ${q.p[1]}`, col, 17);
  s += L(q.p, q.rk, q.rf, 10.5) + L(q.n, q.re, q.rh, 8.5);
  s += `<circle cx="${q.h[0]}" cy="${q.h[1]}" r="9.5" fill="${col}"/>`;
  if (hood) s += fill(`M${q.h[0] - 12} ${q.h[1] + 8} C${q.h[0] - 14} ${q.h[1] - 12} ${q.h[0] + 4} ${q.h[1] - 18} ${q.h[0] + 12} ${q.h[1] - 6} L${q.h[0] + 12} ${q.h[1] + 8} Z`, col);
  return s;
}

function heldItem(q: Pose): string {
  const [x, y] = q.rh;
  if (q.hold === 'sword') return place(swordBody(M.steel), x + 6, y - 22, 0.55, 24);
  if (q.hold === 'dagger') return place(daggerBody(M.steel), x + 6, y - 10, 0.55, 70);
  if (q.hold === 'barbell')
    return limb(`M${q.lh[0] - 22} ${q.lh[1]} L${q.rh[0] + 22} ${q.rh[1]}`, '#2a2a30', 4) + ink(`M${q.lh[0] - 30} ${q.lh[1] - 14} h9 v28 h-9 Z`, '#2a2a30', 2) + ink(`M${q.rh[0] + 21} ${q.rh[1] - 14} h9 v28 h-9 Z`, '#2a2a30', 2);
  return '';
}

/** 背光剪影人物（动作类卡牌） */
export const figure: Motif = (c) => {
  const q = POSES[c.v ?? 'stand'] ?? POSES.stand;
  const hood = c.color === 'silent' || c.color === 'necrobinder';
  const dark = c.tint ?? mix(c.pal.dark, '#000000', 0.55);
  const rimCol = mix(c.pal.light, '#ffffff', 0.35);
  let s = glow(0, -6, 78, c.pal.light, 0.75) + `<ellipse cx="0" cy="58" rx="40" ry="6" fill="#000" opacity="0.35"/>`;
  const pose = c.v ?? 'stand';
  s += g(rig(q, rimCol, hood, pose), 'translate(-2 -1.6)');
  s += rig(q, dark, hood, pose);
  if (hood) s += dot(q.h[0] + 2, q.h[1], 2, c.pal.light) + dot(q.h[0] + 7, q.h[1], 2, c.pal.light);
  if (c.color === 'regent') s += ink(`M${q.h[0] - 8} ${q.h[1] - 8} L${q.h[0] - 9} ${q.h[1] - 18} L${q.h[0] - 4} ${q.h[1] - 12} L${q.h[0]} ${q.h[1] - 20} L${q.h[0] + 4} ${q.h[1] - 12} L${q.h[0] + 9} ${q.h[1] - 18} L${q.h[0] + 8} ${q.h[1] - 8} Z`, M.gold, 1.6);
  if (c.color === 'defect') s += limb(`M${q.h[0]} ${q.h[1] - 9} L${q.h[0]} ${q.h[1] - 18}`, dark, 2) + dot(q.h[0], q.h[1] - 20, 3, '#ff7a6a');
  return s + heldItem(q);
};

/** 多个剪影（残影、军团） */
export const figures: Motif = (c) =>
  `<g opacity="0.55">${place(figure({ ...c, v: c.v ?? 'stand' }), -38, 6, 0.75)}${place(figure({ ...c, v: c.v ?? 'stand' }), 38, 6, 0.75)}</g>` + place(figure(c), 0, 0, 0.92);

/** 斩击（纯效果） */
export const slashFx: Motif = (c) => {
  const n = c.n ?? 1;
  let s = glow(0, 0, 70, c.pal.light, 0.5);
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) * 22;
    s += fill(`M${-64 + o} ${40 + o * 0.2} C${-20 + o} ${10 + o * 0.2} ${20 + o} ${-20 + o * 0.2} ${64 + o} ${-46 + o * 0.2} C${24 + o} ${-12 + o * 0.2} ${-16 + o} ${18 + o * 0.2} ${-64 + o} ${40 + o * 0.2} Z`, '#fff', 0.95);
    s += line(`M${-60 + o} ${36 + o * 0.2} C${-20 + o} ${8 + o * 0.2} ${20 + o} ${-18 + o * 0.2} ${60 + o} ${-42 + o * 0.2}`, c.pal.light, 7, 0.4);
  }
  return s;
};

/** 爪痕 */
export const clawMarks: Motif = (c) => {
  let s = glow(0, 0, 66, M.blood, 0.4);
  for (let i = 0; i < 3; i++) s += fill(`M${-40 + i * 22} -50 C${-30 + i * 22} -10 ${-24 + i * 22} 20 ${-34 + i * 22} 54 C${-18 + i * 22} 20 ${-20 + i * 22} -14 ${-40 + i * 22} -50 Z`, c.tint ?? '#fff', 0.95);
  return s;
};

export const holes: Motif = (c) => {
  let s = '';
  for (let i = 0; i < 6; i++) {
    const x = (c.r() - 0.5) * 110;
    const y = (c.r() - 0.5) * 70;
    s += circle(x, y, 7 + c.r() * 5, '#0c0608', 2.4) + line(`M${x - 10} ${y - 10} L${x - 16} ${y - 18} M${x + 10} ${y + 8} L${x + 18} ${y + 12}`, INK, 1.6, 0.8);
  }
  return s;
};

export const peel: Motif = () =>
  ink('M-10 20 C-30 0 -40 -20 -30 -40 C-20 -20 -6 -4 4 4 Z', '#f2d84a') +
  ink('M4 4 C20 -10 36 -16 52 -10 C36 0 20 10 10 22 Z', '#f2d84a') +
  ink('M-10 20 C0 30 10 30 10 22 L4 4 Z', '#e8c03a') +
  ink('M-10 20 C-20 40 -10 50 0 44 C10 40 14 30 10 22 Z', '#f6e070');

export const crutch: Motif = () =>
  place(limb('M-10 -50 L0 56 M10 -50 L0 56', M.wood, 5) + limb('M-20 -50 L20 -50', M.wood, 7) + limb('M-6 0 L6 0', M.wood, 5), 0, 0, 1, 14);

export const ruler: Motif = () => {
  let ticks = '';
  for (let i = 0; i < 12; i++) ticks += line(`M${-54 + i * 10} -12 L${-54 + i * 10} ${i % 2 ? -4 : 0}`, INK, 1.6);
  return place(ink('M-60 -12 L60 -12 L60 12 L-60 12 Z', '#e8d8a0') + ticks, 0, 0, 1, -20);
};

export const parasite: Motif = (c) => worm({ ...c, tint: '#8a5a7a' }) + place(eye({ ...c, tint: '#c0302a' }), 30, -20, 0.3);

export const dna: Motif = (c) => {
  let s = '';
  for (let i = 0; i <= 10; i++) {
    const y = -50 + i * 10;
    const x = Math.sin(i * 0.7) * 26;
    s += line(`M${-x} ${y} L${x} ${y}`, i % 2 ? c.pal.accent2 : '#efe6d6', 3);
  }
  let p1 = '';
  let p2 = '';
  for (let i = 0; i <= 20; i++) {
    const y = -50 + i * 5;
    const x = Math.sin(i * 0.35) * 26;
    p1 += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y}`;
    p2 += `${i ? 'L' : 'M'}${(-x).toFixed(1)} ${y}`;
  }
  return glow(0, 0, 64, c.pal.light, 0.4) + s + limb(p1, c.pal.accent, 5) + limb(p2, '#efe6d6', 5);
};

export const chestPlate: Motif = (c) => armorPlate(c);

export const backpack: Motif = (c) =>
  ink('M-30 -30 C-30 -50 30 -50 30 -30 L34 44 L-34 44 Z', c.tint ?? '#7a5a34') +
  ink('M-24 0 L24 0 L24 30 L-24 30 Z', shade(c.tint ?? '#7a5a34', -0.15), 2.4) +
  ink('M-6 -6 L6 -6 L6 6 L-6 6 Z', M.gold, 2) +
  limb('M-14 -44 C-14 -60 14 -60 14 -44', '#4a3420', 4) +
  place(daggerBody(), 40, -10, 0.5, 20);

export const toolbox: Motif = (c) =>
  ink('M-50 -10 L50 -10 L50 40 L-50 40 Z', '#a8402a') +
  ink('M-54 -20 L54 -20 L50 -6 L-50 -6 Z', '#c0503a') +
  limb('M-16 -20 L-16 -34 L16 -34 L16 -20', '#3a3a44', 4) +
  place(daggerBody(), -20, -30, 0.5, -20) +
  place(daggerBody(), 4, -32, 0.5, 10) +
  place(wrench({ ...c }), 28, -32, 0.4) +
  ink('M-8 6 L8 6 L8 14 L-8 14 Z', M.gold, 2);

export const hat: Motif = (c) =>
  ink('M-56 30 C-56 20 56 20 56 30 C56 40 -56 40 -56 30 Z', '#1a1a20') +
  ink('M-30 26 L-30 -36 C-30 -44 30 -44 30 -36 L30 26 Z', '#24242c') +
  ink('M-30 10 L30 10 L30 20 L-30 20 Z', '#a8302a', 2) +
  place(card({ ...c }), 34, -40, 0.35, 20) +
  line('M-24 -30 L-24 4', '#fff', 2, 0.25);

export const pins: Motif = (c) => caltrops(c);

export const presents: Motif = (c) => backpack(c);

export const handshake: Motif = (c) => place(handBody(M.skin, true), -20, 6, 0.8, 50) + place(handBody(shade(M.skin, -0.1), true), 20, 6, 0.8, -50);

export const ladder: Motif = () => limb('M-20 56 L-20 -56 M20 56 L20 -56', M.wood, 5) + limb('M-20 -36 L20 -36 M-20 -12 L20 -12 M-20 12 L20 12 M-20 36 L20 36', M.wood, 4);

export const candle: Motif = (c) =>
  glow(0, -34, 50, M.flame2, 0.7) +
  ink('M-14 -16 L14 -16 L16 48 L-16 48 Z', c.tint ?? '#efe6d0') +
  fill('M2 -16 L14 -16 L16 48 L4 48 Z', '#000', 0.15) +
  ink('M-14 -16 C-10 -8 -6 -4 -6 4 C-4 -4 0 -10 2 -16 Z', '#efe6d0', 1.6) +
  line('M0 -16 L0 -24', INK, 2) +
  place(flameBody(), 0, -40, 0.36) +
  ink('M-26 48 L26 48 L22 56 L-22 56 Z', M.goldDark, 2);

export const rock: Motif = (c) => {
  let s = '';
  const n = c.n ?? 1;
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : (i - (n - 1) / 2) * 36;
    const k = n === 1 ? 1 : 0.6;
    s += place(ink('M-40 20 L-34 -16 L-10 -36 L22 -30 L40 -6 L36 26 L6 38 L-26 34 Z', c.tint ?? M.stone) + fill('M22 -30 L40 -6 L36 26 L6 38 L10 0 Z', '#000', 0.25) + line('M-22 -14 L-8 -26 M-4 -6 L10 4', INK, 1.6, 0.6), x, (i % 2) * 12, k, i * 40);
  }
  return s;
};

export const fireworks: Motif = (c) => {
  let s = '';
  const cols = [c.pal.light, M.flame2, '#fff', c.pal.accent2];
  for (let i = 0; i < 4; i++) {
    const x = (c.r() - 0.5) * 110;
    const y = (c.r() - 0.5) * 70;
    const col = cols[i % cols.length];
    s += glow(x, y, 26, col, 0.6);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      s += line(`M${x + Math.cos(a) * 6} ${y + Math.sin(a) * 6} L${x + Math.cos(a) * 20} ${y + Math.sin(a) * 20}`, col, 2.4, 0.9);
    }
  }
  return s;
};

export const volcano: Motif = (c) =>
  glow(0, -30, 70, M.flame3, 0.7) +
  ink('M-70 56 L-22 -20 L22 -20 L70 56 Z', c.tint ?? '#3a2a24') +
  fill('M0 -20 L22 -20 L70 56 L20 56 Z', '#000', 0.25) +
  ink('M-22 -20 L-10 -6 L0 -16 L10 -4 L22 -20 Z', M.flame3, 2) +
  line('M-8 -12 C-14 10 -4 30 -12 56 M8 -10 C14 10 10 30 20 56', M.flame2, 3, 0.85) +
  place(flameBody(), 0, -40, 0.42) +
  [0, 1, 2].map((i) => place(rock({ ...c, n: 1 }), -30 + i * 30, -54 + (i % 2) * 10, 0.16)).join('');

export const footprints: Motif = () => {
  let s = '';
  for (let i = 0; i < 4; i++) {
    const x = -48 + i * 30;
    const y = i % 2 ? 14 : -10;
    s += place(ink('M-8 -14 C-8 -24 8 -24 8 -14 L6 8 C6 14 -6 14 -6 8 Z', '#2a2018', 2) + dot(-6, -26, 3, '#2a2018') + dot(0, -28, 3, '#2a2018') + dot(6, -26, 3, '#2a2018'), x, y, 0.9, 80);
  }
  return s;
};

export const hook: Motif = (c) =>
  limb('M0 -56 L0 10', c.tint ?? M.steelDark, 6) +
  limb('M0 10 C0 40 -36 40 -36 14', c.tint ?? M.steel, 7) +
  ink('M-42 20 L-36 4 L-28 18 Z', c.tint ?? M.steel, 2);

export const orbs: Motif = (c) => {
  const col = c.pal.light;
  const one = (x: number, y: number, s: number, cc: string) => place(glow(0, 0, 50, cc, 0.5) + circle(0, 0, 26, shade(cc, -0.35)) + dot(0, 0, 19, cc) + dot(-8, -9, 7, '#fff', 0.85), x, y, s);
  return one(-30, 8, 0.9, col) + one(30, -6, 0.9, c.tint ?? M.bolt);
};

export const button: Motif = () =>
  ink('M-50 30 L50 30 L44 50 L-44 50 Z', '#3a3a44') +
  `<ellipse cx="0" cy="18" rx="44" ry="16" fill="#8a1010" stroke="${INK}" stroke-width="3"/>` +
  `<ellipse cx="0" cy="8" rx="40" ry="14" fill="#e0302a" stroke="${INK}" stroke-width="3"/>` +
  `<ellipse cx="-12" cy="4" rx="14" ry="4" fill="#fff" opacity="0.5"/>`;

export const anvil: Motif = (c) =>
  glow(0, -10, 60, M.flame2, 0.5) +
  ink('M-50 -16 L40 -16 C50 -16 60 -24 64 -30 C64 -10 50 0 30 0 L20 0 L20 20 L34 34 L-34 34 L-20 20 L-20 0 L-40 0 C-50 0 -56 -8 -50 -16 Z', '#3a3a44') +
  fill('M-50 -16 L40 -16 L36 -10 L-46 -10 Z', '#fff', 0.25) +
  place(hammerBody(), 26, -40, 0.5, -50) +
  [0, 1, 2, 3, 4].map((i) => dot(-10 + i * 6 + (c.r() - 0.5) * 20, -26 - c.r() * 20, 2, M.flame1)).join('');

// ---------------------------------------------------------------- 事件插画用

export const fish: Motif = (c) =>
  glow(0, 0, 70, c.pal.light, 0.35) +
  ink('M40 0 C60 -20 66 -16 64 0 C66 16 60 20 40 0 Z', c.tint ?? '#5a8ab0') +
  ink('M-56 0 C-40 -34 20 -36 44 0 C20 36 -40 34 -56 0 Z', c.tint ?? '#6a9ac0') +
  fill('M-10 -32 C20 -30 36 -14 44 0 C30 4 0 6 -20 4 Z', '#fff', 0.15) +
  fill('M-50 8 C-30 26 20 28 42 4 C20 30 -30 30 -50 8 Z', '#000', 0.2) +
  line('M-20 -20 C-16 -6 -16 6 -20 20', INK, 2, 0.7) +
  dot(-38, -6, 5, '#f4ece0') +
  dot(-38, -6, 2.6, INK) +
  ink('M-10 -30 C0 -46 16 -46 22 -32', 'none', 3);

export const fountain: Motif = (c) =>
  glow(0, -10, 70, '#8ae0ff', 0.45) +
  ink('M-56 30 L56 30 L48 52 L-48 52 Z', M.stone) +
  `<ellipse cx="0" cy="30" rx="56" ry="10" fill="#5ab0e0" stroke="${INK}" stroke-width="3"/>` +
  ink('M-8 30 L-6 -16 L6 -16 L8 30 Z', M.stone) +
  ink('M-26 -16 L26 -16 L20 -6 L-20 -6 Z', M.stone) +
  line('M0 -18 C-10 -50 -30 -40 -36 24 M0 -18 C10 -50 30 -40 36 24 M0 -18 L0 -50', '#c8f2ff', 3.5, 0.9) +
  [0, 1, 2, 3].map((i) => dot(-30 + i * 20, 22, 2.4, '#fff', 0.8)).join('');

export const mushroom: Motif = (c) => {
  const one = (x: number, y: number, s: number, col: string) =>
    place(ink('M-8 0 L-6 30 L6 30 L8 0 Z', '#efe2c8') + ink('M-34 2 C-34 -26 34 -26 34 2 C20 8 -20 8 -34 2 Z', col) + dot(-14, -10, 5, '#f4ece0') + dot(10, -14, 4, '#f4ece0') + dot(18, -2, 3, '#f4ece0'), x, y, s);
  return glow(0, 0, 70, c.tint ?? '#d070ff', 0.45) + one(-26, 10, 0.9, '#9a4ad0') + one(28, 16, 0.7, '#c03a8a') + one(4, -6, 1.1, c.tint ?? '#c8302a');
};

export const wheel: Motif = (c) => {
  let s = glow(0, 0, 70, c.pal.light, 0.4) + circle(0, 0, 48, M.wood) + circle(0, 0, 40, '#efe2c0', 2.4);
  const cols = ['#c0302a', '#3a7ad0', '#e0b040', '#4aa04a', '#8a4ad0', '#e07030'];
  for (let i = 0; i < 6; i++) {
    const a1 = (i / 6) * Math.PI * 2;
    const a2 = ((i + 1) / 6) * Math.PI * 2;
    s += fill(`M0 0 L${(Math.cos(a1) * 38).toFixed(1)} ${(Math.sin(a1) * 38).toFixed(1)} A38 38 0 0 1 ${(Math.cos(a2) * 38).toFixed(1)} ${(Math.sin(a2) * 38).toFixed(1)} Z`, cols[i], 0.85);
  }
  for (let i = 0; i < 6; i++) s += line(`M0 0 L${(Math.cos((i / 6) * Math.PI * 2) * 40).toFixed(1)} ${(Math.sin((i / 6) * Math.PI * 2) * 40).toFixed(1)}`, INK, 2.4);
  return s + circle(0, 0, 8, M.gold) + ink('M-8 -58 L8 -58 L0 -44 Z', '#c0302a', 2.4);
};

export const ship: Motif = (c) =>
  glow(0, 0, 70, c.pal.light, 0.3) +
  ink('M-60 20 L60 20 L44 44 L-46 44 Z', '#5a3a22') +
  line('M-54 30 L52 30', INK, 2, 0.6) +
  limb('M-6 20 L-6 -54', M.wood, 5) +
  ink('M-2 -50 C30 -40 34 -10 -2 4 Z', '#e8dcc0', 2.4) +
  ink('M-10 -46 C-36 -36 -38 -10 -10 0 Z', '#d8ccb0', 2.4) +
  ink('M-6 -54 L18 -60 L-6 -64 Z', '#a8302a', 2) +
  `<path d="M-70 46 C-50 38 -30 54 -10 46 C10 38 30 54 50 46 C60 42 66 44 70 46 L70 60 L-70 60 Z" fill="#3a7aa0" stroke="${INK}" stroke-width="2.4"/>` +
  (c.v === 'wreck' ? line('M-46 44 L-30 20 M20 44 L36 24', '#1a1010', 3) : '');

export const shell: Motif = (c) => {
  let s = glow(0, 0, 64, '#ffd0c0', 0.4) + ink('M0 40 C-50 30 -56 -10 -30 -34 C-10 -50 10 -50 30 -34 C56 -10 50 30 0 40 Z', c.tint ?? '#f0c8b0');
  for (let i = -3; i <= 3; i++) s += line(`M0 38 L${i * 14} -40`, '#c08a70', 2.2, 0.8);
  return s + ink('M-12 38 L12 38 L8 50 L-8 50 Z', c.tint ?? '#e8b8a0', 2.4);
};

export const pot: Motif = (c) =>
  glow(0, 0, 66, '#ffb030', 0.4) +
  ink('M-30 -20 C-50 -10 -50 40 -24 48 L24 48 C50 40 50 -10 30 -20 Z', c.tint ?? '#b0702a') +
  ink('M-34 -30 L34 -30 L30 -18 L-30 -18 Z', shade(c.tint ?? '#b0702a', -0.15)) +
  ink('M-26 -30 C-20 -44 20 -44 26 -30 Z', '#ffb030', 2.4) +
  ink('M-20 -22 C-22 -6 -14 4 -16 14 C-10 6 -12 -10 -8 -22 Z', '#ffb030', 2) +
  fill('M10 -18 C30 -10 40 20 24 46 L10 46 C24 20 22 0 10 -18 Z', '#000', 0.2) +
  line('M-34 10 L34 10', '#5a3a14', 2.4, 0.8);

export const mirror: Motif = (c) =>
  glow(0, 0, 70, c.pal.light, 0.5) +
  ink('M-34 -40 C-34 -62 34 -62 34 -40 L34 40 C34 56 -34 56 -34 40 Z', M.gold) +
  ink('M-26 -38 C-26 -54 26 -54 26 -38 L26 38 C26 48 -26 48 -26 38 Z', mix(c.pal.light, '#c8e8ff', 0.5), 2.4) +
  line('M-16 -30 L4 -46 M-18 -10 L14 -38 M-16 10 L10 -14', '#fff', 3, 0.7) +
  ink(starPath(0, -58, 6, 2.4, 4), M.gold, 1.6);

// ---------------------------------------------------------------- Claude

const fx1 = (n: number) => n.toFixed(1);

/** Claude 的星火：长短不一、末端圆润的放射光芒（先画整体墨线轮廓，再填色，避免光芒之间互相描边） */
export function sparkBody(col = '#d97757', R = 48, n = 12, rot = 0): string {
  const lens = [1, 0.74, 0.9, 0.66, 0.96, 0.78, 0.88, 0.7, 1, 0.76, 0.92, 0.68];
  let under = '';
  let over = '';
  let hiL = '';
  for (let i = 0; i < n; i++) {
    const a = (((i / n) * 360 + rot + (i % 2 ? 4 : -3)) * Math.PI) / 180;
    const L = R * lens[i % lens.length];
    const w0 = R * 0.12;
    const w1 = R * 0.075;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    const px = -cy;
    const py = cx;
    const bx = cx * R * 0.12;
    const by = cy * R * 0.12;
    const tx = cx * L;
    const ty = cy * L;
    const d = `M${fx1(bx + px * w0)} ${fx1(by + py * w0)} L${fx1(tx + px * w1)} ${fx1(ty + py * w1)} Q${fx1(tx + cx * w1 * 1.9)} ${fx1(ty + cy * w1 * 1.9)} ${fx1(tx - px * w1)} ${fx1(ty - py * w1)} L${fx1(bx - px * w0)} ${fx1(by - py * w0)} Z`;
    under += `<path d="${d}" fill="${INK}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`;
    over += fill(d, col);
    hiL += line(`M${fx1(cx * R * 0.3 + px * w0 * 0.4)} ${fx1(cy * R * 0.3 + py * w0 * 0.4)} L${fx1(cx * L * 0.82 + px * w1 * 0.4)} ${fx1(cy * L * 0.82 + py * w1 * 0.4)}`, '#fff', 1.3, 0.32);
  }
  return under + circle(0, 0, R * 0.22, INK, 5) + over + dot(0, 0, R * 0.24, col) + hiL + dot(-R * 0.06, -R * 0.06, R * 0.08, '#fff', 0.35);
}

export const spark: Motif = (c) => glow(0, 0, 74, c.tint ? mix(c.tint, '#ffffff', 0.4) : '#ffc9a8', 0.6) + sparkBody(c.tint ?? '#d97757', 48, 12, c.r() * 24);

/** 对话气泡 */
export const speech: Motif = (c) =>
  glow(0, -6, 66, c.pal.light, 0.35) +
  ink('M-52 -36 C-52 -46 -44 -50 -34 -50 L34 -50 C44 -50 52 -46 52 -36 L52 8 C52 18 44 22 34 22 L-2 22 L-26 44 L-20 22 L-34 22 C-44 22 -52 18 -52 8 Z', c.tint ?? '#f6ecd8') +
  fill('M20 -50 L34 -50 C44 -50 52 -46 52 -36 L52 8 C52 18 44 22 34 22 L28 22 C40 10 40 -30 20 -50 Z', '#000', 0.12) +
  line('M-36 -30 L30 -30 M-36 -16 L22 -16 M-36 -2 L6 -2', '#8a5a3a', 3.2, 0.7);

/** 文档（带折角的纸页） */
export const docPage: Motif = (c) =>
  glow(0, 0, 64, c.pal.light, 0.3) +
  place(ink('M-30 -44 L18 -44 L34 -28 L34 46 L-30 46 Z', '#e6d8bc'), 16, 4, 0.9, 12) +
  ink('M-34 -46 L14 -46 L30 -30 L30 44 L-34 44 Z', c.tint ?? '#fbf3e2') +
  ink('M14 -46 L14 -30 L30 -30 Z', '#e0d2b4', 2) +
  line('M-24 -26 L4 -26 M-24 -12 L20 -12 M-24 2 L20 2 M-24 16 L12 16 M-24 30 L16 30', '#8a6a4a', 2.6, 0.65);

/** 终端窗口 */
export const terminal: Motif = (c) =>
  glow(0, 0, 66, c.pal.light, 0.3) +
  ink('M-56 -40 L56 -40 L56 38 L-56 38 Z', '#1e1a1c') +
  ink('M-56 -40 L56 -40 L56 -27 L-56 -27 Z', '#3a3234', 2) +
  dot(-47, -33.5, 2.8, '#ff6a5a') +
  dot(-38, -33.5, 2.8, '#ffc24a') +
  dot(-29, -33.5, 2.8, '#6ad06a') +
  line('M-44 -14 L-33 -6 L-44 2', c.tint ?? '#d97757', 3.6) +
  line('M-26 4 L-10 4', '#f6ecd8', 3.6) +
  line('M-44 18 L-8 18 M0 18 L26 18 M-44 28 L10 28', mix(c.pal.light, '#ffffff', 0.3), 2.6, 0.55);

/** 互相连接的节点（多智能体、子代理） */
export const nodes: Motif = (c) => {
  const pts: [number, number][] = [
    [0, 0],
    [-42, -26],
    [40, -30],
    [-36, 32],
    [38, 28],
    [2, -52],
  ];
  const edges = [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 5],
    [2, 5],
    [1, 3],
    [2, 4],
  ];
  let s = glow(0, 0, 70, c.pal.light, 0.4);
  for (const [a, b] of edges) s += line(`M${pts[a][0]} ${pts[a][1]} L${pts[b][0]} ${pts[b][1]}`, INK, 6) + line(`M${pts[a][0]} ${pts[a][1]} L${pts[b][0]} ${pts[b][1]}`, mix(c.pal.light, '#ffffff', 0.2), 2.4);
  pts.forEach(([x, y], i) => {
    s += i === 0 ? place(sparkBody(c.tint ?? '#d97757', 18, 10), x, y, 1) : circle(x, y, 10, i % 2 ? c.pal.accent2 : '#f2dcc2', 2.6) + dot(x - 3, y - 3, 3, '#fff', 0.5);
  });
  return s;
};
