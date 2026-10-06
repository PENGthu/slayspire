/**
 * 遗物与药水图标。画布 100×100（坐标 -50..50），透明背景，墨线 + 光照滤镜。
 */
import { POTIONS, RELICS } from '../../game/registry';
import { INK, circle, dot, ellipse, fill, glow, hash, ink, limb, line, memo, mix, place, rand, shade, starPath } from './kit';
import * as Mo from './motifs';
import { M, PALS } from './palettes';

type Draw = () => string;

/** 调用卡牌插画的图案 */
function mo(name: keyof typeof Mo, s = 0.62, opts: { tint?: string; n?: number; v?: string; color?: string; x?: number; y?: number; rot?: number } = {}): string {
  const fn = Mo[name] as Mo.Motif;
  const pal = PALS[opts.color ?? 'colorless'];
  return place(fn({ pal, r: rand(hash(name)), color: opts.color ?? 'colorless', tint: opts.tint, n: opts.n, v: opts.v }), opts.x ?? 0, opts.y ?? 0, s, opts.rot ?? 0);
}

const hi = (d: string, w = 2.4, o = 0.6) => line(d, '#fff', w, o);
const shadowR = (d: string, o = 0.22) => fill(d, '#000', o);

// ---------------------------------------------------------------- 小物件

function ring(band: string, gem?: string): string {
  return (
    `<ellipse cx="0" cy="6" rx="30" ry="24" fill="none" stroke="${INK}" stroke-width="15"/><ellipse cx="0" cy="6" rx="30" ry="24" fill="none" stroke="${band}" stroke-width="9"/>` +
    line('M-24 -4 C-18 -14 -8 -18 4 -18', '#fff', 2.4, 0.6) +
    (gem ? ink('M-12 -24 L0 -36 L12 -24 L0 -14 Z', gem, 2.6) + fill('M-6 -26 L0 -32 L4 -26 Z', '#fff', 0.7) : '')
  );
}

function snakeRing(col: string): string {
  return (
    `<ellipse cx="0" cy="4" rx="30" ry="26" fill="none" stroke="${INK}" stroke-width="15"/><ellipse cx="0" cy="4" rx="30" ry="26" fill="none" stroke="${col}" stroke-width="9"/>` +
    line('M-28 4 A30 26 0 0 1 28 4', mix(col, '#fff', 0.4), 2, 0.6) +
    ink('M18 -22 C30 -32 44 -26 42 -16 C40 -8 28 -8 22 -14 Z', col, 2.6) +
    dot(34, -20, 2.6, '#ffe040') +
    line('M42 -16 L48 -14 M42 -16 L48 -20', '#c0182a', 1.6)
  );
}

function egg(col: string, deco: string): string {
  return glow(0, 4, 40, col, 0.4) + ink('M0 -38 C22 -38 32 -6 32 12 C32 32 18 40 0 40 C-18 40 -32 32 -32 12 C-32 -6 -22 -38 0 -38 Z', col) + shadowR('M10 -34 C26 -26 32 0 32 12 C32 32 18 40 2 40 C20 24 22 -6 10 -34 Z') + deco + hi('M-18 -10 C-16 -22 -10 -30 -4 -32', 3);
}

function fruit(col: string, leaf = '#4a8a3a'): string {
  return (
    ink('M0 -24 C26 -30 38 -6 34 14 C30 34 14 40 0 38 C-14 40 -30 34 -34 14 C-38 -6 -26 -30 0 -24 Z', col) +
    shadowR('M10 -26 C30 -24 38 -4 34 14 C30 32 16 40 4 38 C22 24 24 -6 10 -26 Z') +
    limb('M0 -24 L4 -38', '#5a3a1a', 3) +
    ink('M4 -34 C14 -46 28 -44 30 -36 C20 -32 12 -30 4 -34 Z', leaf, 2.2) +
    hi('M-22 -8 C-22 -16 -16 -22 -10 -22', 3)
  );
}

function statue(col: string): string {
  return (
    ink('M-26 40 L-22 26 L22 26 L26 40 Z', shade(col, -0.2)) +
    ink('M-20 26 C-26 4 -22 -14 -12 -22 C-16 -34 -4 -42 6 -38 C18 -40 26 -28 20 -16 C28 -6 26 14 20 26 Z', col) +
    shadowR('M8 -38 C20 -38 26 -28 20 -16 C28 -6 26 14 20 26 L4 26 C14 6 16 -16 8 -38 Z') +
    ink('M-10 -38 L-14 -48 L-4 -40 Z M12 -38 L16 -48 L6 -40 Z', col, 2) +
    dot(-4, -28, 2.6, INK) +
    dot(8, -28, 2.6, INK) +
    line('M-2 -18 L6 -18', INK, 2) +
    hi('M-16 0 C-18 -10 -14 -18 -8 -22', 2.4)
  );
}

function gem(col: string): string {
  return (
    glow(0, 0, 44, col, 0.5) +
    ink('M-30 -10 L-16 -30 L16 -30 L30 -10 L0 34 Z', col) +
    ink('M-30 -10 L30 -10 M-16 -30 L-8 -10 L0 34 L8 -10 L16 -30', 'none', 2) +
    fill('M-16 -30 L-8 -10 L-30 -10 Z', '#fff', 0.45) +
    shadowR('M8 -10 L30 -10 L0 34 Z', 0.28)
  );
}

function urnBody(col: string, extra = ''): string {
  return (
    ink('M-12 -38 L12 -38 L10 -30 C30 -20 34 6 26 24 C20 36 10 42 0 42 C-10 42 -20 36 -26 24 C-34 6 -30 -20 -10 -30 Z', col) +
    ink('M-16 -42 L16 -42 L14 -36 L-14 -36 Z', shade(col, -0.25), 2.4) +
    line('M-28 4 L28 4', M.gold, 2.6, 0.9) +
    shadowR('M6 -30 C28 -20 34 6 26 24 C20 36 10 42 2 42 C18 24 20 -6 6 -30 Z') +
    extra +
    hi('M-22 -8 C-26 2 -26 12 -22 20', 2.6)
  );
}

function bottleShape(shape: string): { body: string; neck: string; cork: string; liquid: string; hiL: string } {
  switch (shape) {
    case 'tall':
      return {
        body: 'M-14 -16 L14 -16 L16 34 C16 40 12 42 6 42 L-6 42 C-12 42 -16 40 -16 34 Z',
        neck: 'M-8 -30 L8 -30 L8 -16 L-8 -16 Z',
        cork: 'M-10 -40 L10 -40 L9 -30 L-9 -30 Z',
        liquid: 'M-15 6 L15 6 L16 34 C16 40 12 42 6 42 L-6 42 C-12 42 -16 40 -16 34 Z',
        hiL: 'M-9 -10 L-10 30',
      };
    case 'square':
      return {
        body: 'M-24 -14 L24 -14 L26 38 L-26 38 Z',
        neck: 'M-8 -26 L8 -26 L8 -14 L-8 -14 Z',
        cork: 'M-10 -36 L10 -36 L9 -26 L-9 -26 Z',
        liquid: 'M-25 4 L25 4 L26 38 L-26 38 Z',
        hiL: 'M-18 -8 L-19 30',
      };
    case 'heart':
      return {
        body: 'M0 40 C-30 20 -38 0 -32 -12 C-26 -24 -8 -22 0 -10 C8 -22 26 -24 32 -12 C38 0 30 20 0 40 Z',
        neck: 'M-6 -26 L6 -26 L6 -12 L-6 -12 Z',
        cork: 'M-8 -36 L8 -36 L7 -26 L-7 -26 Z',
        liquid: 'M-32 0 C-20 6 20 -6 33 0 C34 14 22 26 0 40 C-22 26 -34 14 -32 0 Z',
        hiL: 'M-24 -10 C-28 -4 -26 6 -20 12',
      };
    case 'jar':
      return {
        body: 'M-26 -14 C-30 -14 -30 -6 -28 0 L-28 30 C-28 38 -22 42 -14 42 L14 42 C22 42 28 38 28 30 L28 0 C30 -6 30 -14 26 -14 Z',
        neck: 'M-22 -22 L22 -22 L22 -14 L-22 -14 Z',
        cork: 'M-24 -32 L24 -32 L22 -22 L-22 -22 Z',
        liquid: 'M-28 8 L28 8 L28 30 C28 38 22 42 14 42 L-14 42 C-22 42 -28 38 -28 30 Z',
        hiL: 'M-20 -6 L-21 30',
      };
    case 'cone':
      return {
        body: 'M-8 -16 L8 -16 L32 34 C34 40 30 42 24 42 L-24 42 C-30 42 -34 40 -32 34 Z',
        neck: 'M-7 -30 L7 -30 L7 -16 L-7 -16 Z',
        cork: 'M-9 -40 L9 -40 L8 -30 L-8 -30 Z',
        liquid: 'M-20 10 L20 10 L32 34 C34 40 30 42 24 42 L-24 42 C-30 42 -34 40 -32 34 Z',
        hiL: 'M-6 -10 L-24 32',
      };
    default:
      // round
      return {
        body: 'M-8 -16 C-30 -10 -36 14 -28 28 C-22 40 -10 44 0 44 C10 44 22 40 28 28 C36 14 30 -10 8 -16 Z',
        neck: 'M-8 -30 L8 -30 L8 -14 L-8 -14 Z',
        cork: 'M-10 -40 L10 -40 L9 -30 L-9 -30 Z',
        liquid: 'M-33 12 C-20 4 20 20 33 10 C34 22 30 32 24 36 C16 42 8 44 0 44 C-10 44 -22 40 -28 28 C-32 22 -34 18 -33 12 Z',
        hiL: 'M-22 0 C-28 10 -26 22 -20 30',
      };
  }
}

function potionBody(shape: string, col: string, emblem: string, cork = '#8a5a2a'): string {
  const b = bottleShape(shape);
  const id = `pc${hash(shape + col)}`;
  return (
    glow(0, 14, 42, col, 0.45) +
    ink(b.neck, '#cfe4ea', 2.6) +
    ink(b.body, '#d8eef2', 3) +
    `<clipPath id="${id}"><path d="${b.body}"/></clipPath><g clip-path="url(#${id})"><path d="${b.liquid}" fill="${col}"/>${fill('M0 -60 L60 -60 L60 60 L8 60 Z', '#000', 0.18)}</g>` +
    `<path d="${b.body}" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    ink(b.cork, cork, 2.4) +
    emblem +
    hi(b.hiL, 3, 0.75) +
    dot(10, 22, 2.4, '#fff', 0.5) +
    dot(4, 30, 1.6, '#fff', 0.5)
  );
}

/** 药水瓶上的小徽记（白色剪影） */
const EMB: Record<string, string> = {
  flame: fill('M0 30 C-10 30 -12 22 -10 16 C-8 10 -4 8 -4 2 C0 6 2 10 2 14 C4 10 6 6 6 2 C12 10 12 22 8 26 C6 28 4 30 0 30 Z', '#fff4c0', 0.95),
  bolt: fill('M3 2 L-8 20 L-1 20 L-5 34 L8 14 L1 14 L6 2 Z', '#fff8c0', 0.95),
  shield: fill('M-9 6 L9 6 L9 16 C9 24 4 28 0 31 C-4 28 -9 24 -9 16 Z', '#eef6ff', 0.95),
  fist: fill('M-9 10 C-9 4 9 4 9 10 L9 22 C9 28 -9 28 -9 22 Z', '#fff', 0.9),
  skull: fill('M-9 16 C-10 6 10 6 9 16 C9 20 6 22 6 26 L-6 26 C-6 22 -9 20 -9 16 Z', '#f4ece0', 0.95) + dot(-4, 15, 2.2, INK) + dot(4, 15, 2.2, INK),
  heart: fill('M0 30 C-12 22 -12 12 -8 9 C-4 6 0 9 0 13 C0 9 4 6 8 9 C12 12 12 22 0 30 Z', '#ffd0d8', 0.95),
  star: fill(starPath(0, 18, 11, 4.4, 5), '#fff6c0', 0.95),
  swirl: line('M-8 18 C-8 8 8 8 8 18 C8 26 -2 26 -2 20', '#fff', 2.6, 0.9),
  drop: fill('M0 6 C4 12 9 18 9 23 C9 28 5 31 0 31 C-5 31 -9 28 -9 23 C-9 18 -4 12 0 6 Z', '#ffd0d0', 0.95),
  leaf: fill('M-8 28 C-8 14 2 6 10 6 C10 20 2 28 -8 28 Z', '#e0ffd0', 0.9),
  wind: line('M-10 14 L6 14 C12 14 12 6 6 6 M-10 22 L10 22 C16 22 16 30 10 30', '#fff', 2.4, 0.9),
  dice: fill('M-8 10 L8 10 L8 26 L-8 26 Z', '#fff', 0.9) + dot(-3, 15, 1.8, INK) + dot(3, 21, 1.8, INK),
  eye: fill('M-11 18 C-5 10 5 10 11 18 C5 26 -5 26 -11 18 Z', '#fff', 0.9) + dot(0, 18, 3.4, INK),
  crown: fill('M-11 26 L-12 10 L-5 18 L0 8 L5 18 L12 10 L11 26 Z', '#ffe08a', 0.95),
  bone: line('M-8 26 L8 10', '#f4ece0', 4, 0.95) + dot(-9, 27, 3, '#f4ece0') + dot(9, 9, 3, '#f4ece0'),
  gear: `<circle cx="0" cy="18" r="7" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="3 2.4" opacity="0.9"/>`,
  ghost: fill('M-8 30 L-8 14 C-8 4 8 4 8 14 L8 30 L4 26 L0 30 L-4 26 Z', '#f4f0ff', 0.95) + dot(-3, 15, 1.6, INK) + dot(3, 15, 1.6, INK),
  orb: `<circle cx="0" cy="18" r="8" fill="#fff" opacity="0.85"/>`,
  card: fill('M-7 8 L7 8 L7 28 L-7 28 Z', '#fff', 0.9) + line('M-4 14 L4 14 M-4 19 L4 19', INK, 1.4, 0.7),
  spark: [0, 1, 2, 3, 4, 5].map((i) => line(`M0 18 L${(Math.cos((i * Math.PI) / 3) * (i % 2 ? 7 : 10)).toFixed(1)} ${(18 + Math.sin((i * Math.PI) / 3) * (i % 2 ? 7 : 10)).toFixed(1)}`, '#fff6ec', 3.4, 0.95)).join(''),
  none: '',
};

interface PotionSpec {
  shape: 'round' | 'tall' | 'square' | 'heart' | 'jar' | 'cone';
  emb: keyof typeof EMB;
  col?: string;
}

const POTION_SPEC: Record<string, PotionSpec> = {
  fire_potion: { shape: 'round', emb: 'flame' },
  explosive_potion: { shape: 'jar', emb: 'flame', col: '#e8702a' },
  block_potion: { shape: 'square', emb: 'shield' },
  energy_potion: { shape: 'tall', emb: 'bolt' },
  strength_potion: { shape: 'round', emb: 'fist' },
  dexterity_potion: { shape: 'cone', emb: 'wind' },
  swift_potion: { shape: 'tall', emb: 'wind' },
  fear_potion: { shape: 'round', emb: 'eye' },
  weak_potion: { shape: 'cone', emb: 'drop' },
  poison_potion: { shape: 'round', emb: 'skull' },
  flex_potion: { shape: 'square', emb: 'fist' },
  speed_potion: { shape: 'tall', emb: 'wind' },
  attack_potion: { shape: 'cone', emb: 'card' },
  skill_potion: { shape: 'cone', emb: 'card' },
  power_potion: { shape: 'cone', emb: 'card' },
  colorless_potion: { shape: 'cone', emb: 'card' },
  blood_potion: { shape: 'heart', emb: 'drop' },
  cunning_potion: { shape: 'tall', emb: 'none' },
  star_potion: { shape: 'round', emb: 'star' },
  bone_potion: { shape: 'jar', emb: 'bone' },
  focus_potion: { shape: 'round', emb: 'orb' },
  ancient_potion: { shape: 'jar', emb: 'swirl' },
  regen_potion: { shape: 'heart', emb: 'leaf' },
  essence_of_steel: { shape: 'square', emb: 'gear' },
  liquid_bronze: { shape: 'square', emb: 'shield' },
  gamblers_brew: { shape: 'round', emb: 'dice' },
  duplication_potion: { shape: 'tall', emb: 'swirl' },
  liquid_memories: { shape: 'round', emb: 'swirl' },
  distilled_chaos: { shape: 'cone', emb: 'swirl' },
  fruit_juice: { shape: 'jar', emb: 'leaf' },
  forge_potion: { shape: 'square', emb: 'flame' },
  doom_potion: { shape: 'round', emb: 'skull' },
  capacitor_potion: { shape: 'tall', emb: 'orb' },
  fairy_in_bottle: { shape: 'jar', emb: 'none' },
  smoke_bomb: { shape: 'round', emb: 'none', col: '#8a8f98' },
  entropic_brew: { shape: 'cone', emb: 'swirl' },
  cultist_potion: { shape: 'round', emb: 'eye' },
  heart_of_iron: { shape: 'heart', emb: 'shield' },
  elixir: { shape: 'cone', emb: 'star' },
  ghost_in_a_jar: { shape: 'jar', emb: 'ghost' },
  crown_elixir: { shape: 'heart', emb: 'crown' },
  essence_of_darkness: { shape: 'round', emb: 'orb', col: '#3a1a5a' },
  soul_vessel: { shape: 'jar', emb: 'ghost' },
  insight_potion: { shape: 'round', emb: 'spark' },
  tool_potion: { shape: 'square', emb: 'gear' },
  compaction_potion: { shape: 'tall', emb: 'card' },
};

function potionArtBody(id: string): string {
  const def = POTIONS[id];
  const spec = POTION_SPEC[id] ?? { shape: 'round', emb: 'none' };
  const col = spec.col ?? def?.color ?? '#8ad0ff';
  let extra = '';
  if (id === 'fairy_in_bottle') extra = glow(0, 16, 16, '#fff6c0', 0.9) + fill('M0 10 C6 4 14 6 12 12 C10 16 4 16 0 14 C-4 16 -10 16 -12 12 C-14 6 -6 4 0 10 Z', '#fff', 0.8) + dot(0, 16, 3, '#fff8d0');
  if (id === 'smoke_bomb') extra = `<circle cx="-8" cy="-44" r="8" fill="#c8ccd4" opacity="0.7"/><circle cx="6" cy="-48" r="6" fill="#c8ccd4" opacity="0.6"/>`;
  if (id === 'explosive_potion') extra = limb('M0 -32 C4 -40 12 -42 16 -38', '#8a6a3a', 2.4) + place(Mo.flameBody(), 18, -40, 0.12);
  return potionBody(spec.shape, col, EMB[spec.emb] ?? '') + extra;
}

// ---------------------------------------------------------------- 遗物

const R: Record<string, Draw> = {
  // Claude
  the_spark: () => glow(0, 0, 46, '#ffb48a', 0.6) + Mo.sparkBody('#d97757', 40, 12, 6),
  blazing_spark: () => place(Mo.flameBody(), 0, -6, 0.62) + place(Mo.sparkBody('#e8845f', 26, 12, 6), 0, 12, 1),
  sticky_note: () =>
    place(ink('M-32 -32 L32 -32 L32 22 L18 34 L-32 34 Z', '#ffe27a') + ink('M18 34 L18 22 L32 22 Z', '#e8c050', 2) + line('M-22 -16 L20 -16 M-22 -4 L20 -4 M-22 8 L8 8', '#8a6a2a', 2.6, 0.7) + shadowR('M10 -32 L32 -32 L32 22 L18 34 L10 34 Z', 0.12), 0, 2, 1, -8) +
    circle(-4, -34, 6, '#d97757', 2.4),
  tool_belt: () => mo('toolbox', 0.6, { color: 'claude' }),
  endless_scroll: () => mo('scroll', 0.58, { color: 'claude' }) + place(Mo.infinity({ pal: PALS.claude, r: rand(5), color: 'claude', tint: '#d97757' }), 0, 32, 0.32),
  rubber_duck: () =>
    ink('M-34 6 C-38 28 -16 38 8 36 C28 34 38 22 34 6 C30 -2 20 0 14 4 C4 8 -20 10 -34 6 Z', '#ffd23a') +
    shadowR('M0 34 C20 34 34 24 34 8 C36 22 26 36 4 37 Z', 0.18) +
    ink('M-22 8 C-12 0 4 2 8 12 C-2 18 -16 16 -22 8 Z', '#f0be20', 2.2) +
    ink('M6 -6 C4 -26 20 -36 32 -28 C42 -22 40 -6 30 0 C22 6 8 4 6 -6 Z', '#ffd23a') +
    ink('M38 -16 L52 -12 C50 -6 44 -4 36 -8 Z', '#f08a2a', 2.4) +
    dot(28, -20, 3.4, INK) +
    dot(27, -21, 1.2, '#fff') +
    line('M-28 0 C-24 -4 -18 -4 -14 -2', '#fff', 2.4, 0.6),
  burning_blood: () => mo('drop', 0.62, { tint: '#b01020', y: 8 }) + place(Mo.flameBody(), 0, -30, 0.32),
  ring_of_snake: () => snakeRing('#4a8a3a'),
  divine_right: () => mo('star', 0.66),
  bound_phylactery: () => urnBody('#7a4a8a', glow(0, -48, 14, '#e0a0ff', 0.8)),
  cracked_core: () => mo('core', 0.62, { color: 'defect' }) + line('M-6 -26 L2 -10 L-4 0 L6 18', INK, 3),
  anchor: () => mo('anchor', 0.66),
  ancient_tea_set: () =>
    ink('M-26 -6 C-30 30 -10 40 4 40 C20 40 34 30 30 -6 Z', '#5a8a7a') +
    shadowR('M8 -6 L30 -6 C34 30 20 40 6 40 C18 26 18 6 8 -6 Z') +
    ink('M-30 -10 L34 -10 L32 -2 L-28 -2 Z', '#4a7a6a', 2.4) +
    limb('M30 6 C46 4 46 24 30 26', '#5a8a7a', 4) +
    limb('M-26 4 L-44 -14', '#5a8a7a', 5) +
    ink('M-6 -16 C-6 -24 10 -24 10 -16 Z', '#4a7a6a', 2) +
    line('M-16 12 L18 12', M.gold, 2.4, 0.9),
  art_of_war: () => mo('book', 0.56, { tint: '#2a4a8a' }),
  bag_of_marbles: () =>
    ink('M-26 -8 C-34 20 -24 40 0 40 C24 40 34 20 26 -8 C18 -18 -18 -18 -26 -8 Z', '#8a6a4a') +
    limb('M-18 -12 C-10 -6 10 -6 18 -12', '#5a3a1a', 3) +
    circle(-10, -24, 9, '#5a8ae0', 2.4) +
    circle(8, -26, 8, '#e05a5a', 2.4) +
    circle(-2, -36, 7, '#5ad08a', 2.4) +
    dot(-13, -27, 2.4, '#fff', 0.8) +
    dot(5, -29, 2, '#fff', 0.8),
  bag_of_preparation: () => mo('backpack', 0.62),
  blood_vial: () => mo('vial', 0.6, { tint: '#c0182a' }),
  bronze_scales: () => {
    let s = '';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3 - (r % 2); c++) s += ink(`M${-28 + c * 24 + (r % 2) * 12} ${-24 + r * 18} C${-28 + c * 24 + (r % 2) * 12} ${-4 + r * 18} ${-4 + c * 24 + (r % 2) * 12} ${-4 + r * 18} ${-4 + c * 24 + (r % 2) * 12} ${-24 + r * 18} Z`, '#c8803a', 2.4);
    return s + hi('M-26 -20 C-24 -12 -20 -8 -14 -8', 2);
  },
  centennial_puzzle: () => mo('puzzle', 0.66, { tint: '#c89a4a' }),
  ceramic_fish: () => mo('fish', 0.66, { tint: '#d8e8f0' }),
  dream_catcher: () => {
    let s = `<circle cx="0" cy="-8" r="28" fill="none" stroke="${INK}" stroke-width="9"/><circle cx="0" cy="-8" r="28" fill="none" stroke="#a8784a" stroke-width="5"/>`;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      s += line(`M0 -8 L${(Math.cos(a) * 26).toFixed(1)} ${(-8 + Math.sin(a) * 26).toFixed(1)}`, '#e8dcc0', 1.4, 0.8);
    }
    return s + circle(0, -8, 5, '#5ab0e0', 2) + limb('M-14 18 L-16 40 M0 20 L0 44 M14 18 L16 40', '#a8784a', 2) + ink('M-20 38 L-16 48 L-12 38 Z M-4 42 L0 50 L4 42 Z M12 38 L16 48 L20 38 Z', '#e8eef2', 1.6);
  },
  happy_flower: () => {
    let s = limb('M0 10 L0 44', '#4a8a3a', 5) + ink('M0 30 C-16 22 -24 30 -22 36 C-14 36 -6 34 0 30 Z', '#5aa04a', 2);
    for (let i = 0; i < 10; i++) s += place(ink('M0 -14 C6 -20 6 -30 0 -34 C-6 -30 -6 -20 0 -14 Z', '#f2c430', 2), 0, -10, 1, i * 36);
    return s + circle(0, -10, 14, '#8a5a2a') + dot(-5, -13, 2, INK) + dot(5, -13, 2, INK) + line('M-6 -6 C-2 -2 2 -2 6 -6', INK, 2);
  },
  juzu_bracelet: () => {
    let s = '';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      s += circle(Math.cos(a) * 28, Math.sin(a) * 24, 8, i % 4 === 0 ? '#c0302a' : '#8a5a3a', 2.2) + dot(Math.cos(a) * 28 - 2, Math.sin(a) * 24 - 2, 2, '#fff', 0.6);
    }
    return s;
  },
  lantern: () =>
    glow(0, 4, 44, '#ff9a4a', 0.6) +
    limb('M0 -40 L0 -30', INK, 2) +
    ink('M-14 -32 L14 -32 L12 -26 L-12 -26 Z', '#2a1a10', 2) +
    ink('M-26 0 C-26 -24 26 -24 26 0 C26 24 -26 24 -26 0 Z', '#d8402a') +
    line('M-26 0 L26 0 M-22 -12 L22 -12 M-22 12 L22 12', '#7a1a10', 1.6, 0.8) +
    ink('M-14 22 L14 22 L12 28 L-12 28 Z', '#2a1a10', 2) +
    limb('M0 28 L0 42', '#e0b040', 2.4) +
    hi('M-18 -10 C-20 -4 -20 4 -18 10', 2.4),
  maw_bank: () =>
    ink('M-36 4 C-36 -22 20 -26 30 -6 C40 -4 42 6 36 10 C32 30 -30 32 -36 4 Z', '#f0a0b0') +
    shadowR('M10 -20 C26 -16 34 -6 36 10 C30 26 10 30 0 30 C20 14 22 -6 10 -20 Z') +
    ink('M30 -2 C40 -4 44 4 38 10 C34 10 32 8 30 6 Z', '#e88a9a', 2) +
    dot(36, 2, 1.6, INK) +
    dot(40, 4, 1.6, INK) +
    dot(18, -8, 2.6, INK) +
    ink('M-8 -22 L10 -22 L8 -18 L-6 -18 Z', '#1a1010', 1.6) +
    limb('M-24 24 L-24 36 M-8 28 L-8 38 M12 26 L12 36', '#e88a9a', 6) +
    ink('M14 -18 L18 -30 L24 -16 Z', '#f0a0b0', 2),
  meal_ticket: () =>
    place(ink('M-34 -18 L34 -18 L34 -6 C28 -6 28 6 34 6 L34 18 L-34 18 L-34 6 C-28 6 -28 -6 -34 -6 Z', '#f4e2a0') + line('M-16 -14 L-16 14', '#a8803a', 2, 0.8) + line('M-6 -6 L22 -6 M-6 4 L16 4', '#a8302a', 2.4), 0, 0, 1, -12),
  nunchaku: () => limb('M-30 -30 L-8 4', '#2a1a14', 9) + limb('M30 -30 L8 4', '#2a1a14', 9) + line('M-8 4 C-4 16 4 16 8 4', '#c8c8d0', 2.4) + line('M-26 -24 L-12 -2 M26 -24 L12 -2', '#c0302a', 2, 0.8),
  oddly_smooth_stone: () => ellipse(0, 6, 34, 24, '#9a9aa4') + shadowR('M8 -16 C30 -12 36 6 30 18 C22 30 4 32 -4 30 C18 20 22 -2 8 -16 Z') + `<ellipse cx="-12" cy="-4" rx="12" ry="6" fill="#fff" opacity="0.45"/>`,
  omamori: () =>
    ink('M-20 -22 L20 -22 L22 40 L-22 40 Z', '#c0302a') +
    ink('M-20 -22 C-14 -36 14 -36 20 -22 Z', '#a8201a', 2.4) +
    limb('M0 -34 L0 -46', '#e0b040', 2.4) +
    `<circle cx="0" cy="-48" r="5" fill="none" stroke="#e0b040" stroke-width="2.4"/>` +
    ink('M-10 0 L10 0 L10 26 L-10 26 Z', '#f4e2a0', 2) +
    line('M-4 6 L4 6 M-4 12 L4 12 M-4 18 L4 18', '#a8302a', 1.6),
  orichalcum: () =>
    ink('M-34 10 L-20 -12 L34 -12 L20 10 Z', '#f0a040') + ink('M-34 10 L20 10 L20 24 L-34 24 Z', '#c8781a') + ink('M20 10 L34 -12 L34 2 L20 24 Z', '#a8601a') + hi('M-20 -6 L24 -6', 2.4, 0.7),
  pen_nib: () =>
    place(ink('M0 -40 C14 -20 18 10 10 26 L0 40 L-10 26 C-18 10 -14 -20 0 -40 Z', M.gold) + line('M0 -4 L0 38', INK, 2) + circle(0, -6, 4, INK, 0) + shadowR('M0 -40 C14 -20 18 10 10 26 L0 40 Z'), 0, 0, 1, 30),
  potion_belt: () =>
    ink('M-44 -6 L44 -6 L44 8 L-44 8 Z', '#6a4426') +
    [-24, 0, 24].map((x, i) => ink(`M${x - 9} 4 L${x + 9} 4 L${x + 9} 26 L${x - 9} 26 Z`, '#8a5a32', 2.2) + circle(x, -14, 7, ['#e05a3a', '#5a8ae0', '#5ad04a'][i], 2)).join(''),
  preserved_insect: () =>
    glow(0, 0, 40, '#ffb030', 0.5) +
    ink('M0 -38 C24 -38 34 -10 30 14 C26 34 12 40 0 40 C-12 40 -26 34 -30 14 C-34 -10 -24 -38 0 -38 Z', '#e8a030') +
    `<g opacity="0.75">${place(ellipse(0, 0, 10, 14, '#3a2a14', 2) + line('M-10 -6 L-20 -14 M-10 4 L-22 4 M-10 12 L-20 20 M10 -6 L20 -14 M10 4 L22 4 M10 12 L20 20', '#3a2a14', 2), 0, 2, 1)}</g>` +
    hi('M-18 -16 C-16 -26 -10 -32 -4 -34', 3),
  regal_pillow: () =>
    ink('M-40 -14 C-20 -22 20 -22 40 -14 C44 0 44 10 40 20 C20 28 -20 28 -40 20 C-44 10 -44 0 -40 -14 Z', '#8a2a8a') +
    line('M-40 -14 L40 20 M40 -14 L-40 20', '#6a1a6a', 1.6, 0.4) +
    [-40, 40].map((x) => [-14, 20].map((y) => circle(x, y, 4, M.gold, 1.6)).join('')).join('') +
    hi('M-30 -12 C-10 -16 10 -16 28 -12', 2.4, 0.5),
  strawberry: () =>
    ink('M0 40 C-20 28 -32 6 -26 -10 C-20 -22 20 -22 26 -10 C32 6 20 28 0 40 Z', '#d8302a') +
    shadowR('M14 -18 C24 -14 30 0 26 10 C22 24 12 32 2 38 C14 22 18 0 14 -18 Z') +
    [[-12, -4], [4, -8], [16, 4], [-6, 10], [8, 16], [-2, 26]].map(([x, y]) => ellipse(x, y, 1.8, 3, '#f8e070', 0)).join('') +
    ink('M-20 -16 L-8 -26 L0 -18 L8 -26 L20 -16 L0 -12 Z', '#4a9a3a', 2.2) +
    limb('M0 -22 L2 -34', '#3a7a2a', 3),
  smiling_mask: () => mo('mask', 0.66),
  toy_ornithopter: () =>
    ink('M-30 4 C-10 -6 10 -6 34 0 C10 8 -10 10 -30 4 Z', '#c8783a') +
    ink('M-6 -2 C-20 -30 -40 -34 -44 -26 C-30 -18 -18 -8 -10 0 Z', '#e8dcc0', 2.4) +
    ink('M6 -2 C14 -30 36 -36 40 -28 C28 -20 18 -8 10 0 Z', '#e8dcc0', 2.4) +
    circle(28, 0, 3, INK, 0) +
    limb('M-30 4 L-42 10', '#8a5a2a', 3) +
    line('M-20 -14 L-30 -26 M18 -14 L30 -28', '#a89070', 1.4, 0.8),
  vajra: () =>
    place(
      limb('M0 -14 L0 14', M.gold, 6) +
        circle(0, 0, 8, M.gold) +
        [-1, 1].map((k) => ink(`M0 ${k * 14} C-14 ${k * 22} -14 ${k * 34} 0 ${k * 44} C14 ${k * 34} 14 ${k * 22} 0 ${k * 14} Z`, M.gold, 2.4) + line(`M0 ${k * 16} L0 ${k * 42}`, M.goldDark, 2)).join(''),
      0,
      0,
      1,
      35,
    ),
  war_paint: () =>
    ink('M-26 0 C-28 30 28 30 26 0 Z', '#6a4a2a') +
    `<ellipse cx="0" cy="0" rx="26" ry="8" fill="#c0302a" stroke="${INK}" stroke-width="2.6"/>` +
    place(limb('M0 0 L0 40', '#8a5a2a', 4) + ink('M-5 -8 L5 -8 L4 2 L-4 2 Z', '#2a1a14', 2) + fill('M-4 -16 L4 -16 L5 -8 L-5 -8 Z', '#c0302a'), 22, -24, 0.9, 30) +
    line('M-30 26 C-20 34 -6 30 0 36', '#2a6ad0', 4, 0.9),
  whetstone: () => place(ink('M-38 -10 L38 -10 L34 12 L-34 12 Z', '#7a8a9a') + fill('M-38 -10 L38 -10 L36 -2 L-36 -2 Z', '#fff', 0.25) + line('M-24 2 L-10 2 M4 4 L20 4', '#4a5a6a', 1.6, 0.8), 0, 10, 1, -10) + place(Mo.daggerBody(M.steel), 6, -18, 0.55, 70),
  akabeko: () => mo('beast', 0.58, { tint: '#c0302a', v: 'bull' }),
  red_skull: () => mo('skull', 0.66, { tint: '#d06a5a' }),
  snecko_skull: () => mo('skull', 0.66, { tint: '#a8c890' }),
  star_chart: () =>
    ink('M-36 -24 L36 -24 L36 30 L-36 30 Z', '#2a3a6a') +
    ink('M-40 -28 C-40 -36 -32 -36 -32 -28 L-32 34 C-32 42 -40 42 -40 34 Z', '#c8b088', 2.2) +
    line('M-22 18 L-8 -4 L10 6 L24 -14', '#ffe8a8', 1.6, 0.9) +
    [[-22, 18], [-8, -4], [10, 6], [24, -14], [16, 22]].map(([x, y]) => fill(starPath(x, y, 5, 2, 4), '#fff')).join(''),
  bone_flute: () =>
    place(limb('M0 -40 L0 40', M.bone, 14) + [-24, -10, 4, 18].map((y) => dot(0, y, 3, INK)).join('') + ellipse(0, -42, 9, 5, M.bone, 2.2) + ellipse(0, 42, 9, 5, M.bone, 2.2) + hi('M-4 -34 L-4 34', 2, 0.5), 0, 0, 1, 40),
  data_disk: () => mo('disk', 0.66, { color: 'defect' }),
  blue_candle: () =>
    glow(0, -30, 36, '#6ab0ff', 0.7) +
    ink('M-12 -12 L12 -12 L14 40 L-14 40 Z', '#4a7ac8') +
    shadowR('M2 -12 L12 -12 L14 40 L4 40 Z') +
    line('M0 -12 L0 -20', INK, 2) +
    place(Mo.flameBody(['#1d3f9a', '#3a7ae0', '#8ad0ff', '#e8fbff']), 0, -34, 0.3),
  eternal_feather: () => mo('feather', 0.7, { tint: '#e8f0ff' }) + glow(0, 0, 30, '#fff6c0', 0.4),
  gremlin_horn: () => mo('horn', 0.6, { tint: '#c8a080' }),
  horn_cleat: () => ink('M-36 -8 C-36 -18 36 -18 36 -8 C36 0 18 0 10 -2 L8 30 L-8 30 L-10 -2 C-18 0 -36 0 -36 -8 Z', '#8a9aa8') + ink('M-20 30 L20 30 L20 40 L-20 40 Z', '#6a7a88', 2.4) + hi('M-30 -12 L28 -12', 2),
  ink_bottle: () =>
    ink('M-24 -2 C-26 34 -16 40 0 40 C16 40 26 34 24 -2 C18 -10 -18 -10 -24 -2 Z', '#2a2a48') +
    ink('M-10 -16 L10 -16 L10 -4 L-10 -4 Z', '#3a3a5a', 2.4) +
    `<ellipse cx="0" cy="-2" rx="22" ry="5" fill="#101020"/>` +
    place(ink('M0 -40 C10 -24 12 0 4 14 L0 22 L-4 14 C-12 0 -10 -24 0 -40 Z', '#e8eef2'), 16, -24, 0.8, 30) +
    hi('M-16 6 C-18 16 -16 26 -12 32', 2.6),
  kunai: () => place(ink('M-6 10 L0 -40 L6 10 Z', M.steel) + line('M0 -34 L0 6', '#fff', 1.4, 0.7) + limb('M0 10 L0 34', '#3a2418', 6) + `<circle cx="0" cy="42" r="7" fill="none" stroke="${INK}" stroke-width="7"/><circle cx="0" cy="42" r="7" fill="none" stroke="${M.steelDark}" stroke-width="3"/>`, 0, -2, 1, 40),
  shuriken: () => ink(starPath(0, 0, 40, 10, 4, -45), M.steel) + circle(0, 0, 7, '#2a2a34') + line('M-6 -6 L-26 -26 M6 6 L26 26', '#fff', 1.6, 0.5),
  ornamental_fan: () => {
    let s = '';
    for (let i = 0; i < 7; i++) s += place(ink('M0 34 L-6 -26 C-4 -32 4 -32 6 -26 Z', i % 2 ? '#c0302a' : '#e8c060', 2), 0, 0, 1, -60 + i * 20);
    return s + circle(0, 34, 5, M.gold, 2) + `<path d="M-40 4 A44 44 0 0 1 40 4" fill="none" stroke="${INK}" stroke-width="3"/>`;
  },
  letter_opener: () => ink('M-36 -18 L30 -18 L30 26 L-36 26 Z', '#efe2c0') + line('M-36 -18 L-3 8 L30 -18', INK, 2.4) + place(Mo.daggerBody(M.steel), 22, -8, 0.6, 50),
  meat_on_the_bone: () => mo('meat', 0.66),
  mercury_hourglass: () => mo('hourglass', 0.66, { tint: '#c8d0dc' }),
  molten_egg: () => egg('#e86a2a', line('M-12 -14 L-4 -2 L-10 10 M10 -6 L16 6 L10 16', '#ffe060', 2.4)),
  toxic_egg: () => egg('#6ab84a', dot(-10, -6, 5, '#3a7a2a') + dot(12, 8, 6, '#3a7a2a') + dot(-6, 20, 4, '#3a7a2a')),
  frozen_egg: () => egg('#a8e0f8', line('M-14 -10 L-6 0 L-14 8 M12 -14 L6 -2 L14 6', '#fff', 2.4, 0.9)),
  pantograph: () => {
    let s = '';
    for (let i = 0; i < 4; i++) s += limb(`M${-36 + i * 18} 24 L${-18 + i * 18} -24`, '#c8a060', 4) + limb(`M${-36 + i * 18} -24 L${-18 + i * 18} 24`, '#a8803a', 4);
    return s + [-36, 36].map((x) => circle(x, 0, 4, M.steelDark, 2)).join('');
  },
  pear: () => ink('M0 -22 C14 -22 14 -2 22 10 C32 26 22 42 0 42 C-22 42 -32 26 -22 10 C-14 -2 -14 -22 0 -22 Z', '#c8d050') + shadowR('M6 -20 C14 -12 14 0 22 10 C30 24 22 40 4 42 C18 26 16 0 6 -20 Z') + limb('M0 -22 L2 -36', '#5a3a1a', 3) + ink('M2 -32 C10 -44 22 -40 24 -34 C16 -30 8 -30 2 -32 Z', '#4a8a3a', 2) + hi('M-14 12 C-18 22 -16 30 -10 34', 3),
  question_card: () => place(ink('M-26 -36 L26 -36 L26 36 L-26 36 Z', '#f4ece0') + line('M-8 -12 C-8 -24 12 -24 12 -12 C12 -4 2 -2 2 8', '#c0302a', 5) + dot(2, 20, 3.4, '#c0302a'), 0, 0, 1, -10),
  self_forming_clay: () => ink('M-30 30 C-40 10 -26 -10 -14 -4 C-10 -24 12 -26 16 -10 C32 -12 40 10 30 30 Z', '#b07040') + shadowR('M14 -8 C30 -10 40 10 30 30 L10 30 C22 14 22 0 14 -8 Z') + hi('M-22 4 C-20 -2 -14 -2 -12 2', 2.4),
  singing_bowl: () => ink('M-38 -4 C-36 30 36 30 38 -4 Z', '#c8903a') + `<ellipse cx="0" cy="-4" rx="38" ry="9" fill="#e8b04a" stroke="${INK}" stroke-width="3"/>` + shadowR('M10 0 L38 -4 C36 24 16 32 6 30 C20 18 20 6 10 0 Z') + line('M-50 -24 C-44 -30 -38 -30 -32 -24 M32 -24 C38 -30 44 -30 50 -24', '#fff6c0', 2.4, 0.7) + place(limb('M0 -30 L0 10', '#6a4426', 5), 30, -16, 1, 50),
  strike_dummy: () =>
    limb('M0 -10 L0 46', '#6a4426', 6) +
    limb('M-30 4 L30 4', '#6a4426', 5) +
    ink('M-16 -2 L16 -2 L18 30 L-18 30 Z', '#c8a870') +
    circle(0, -24, 14, '#c8a870') +
    line('M-6 -28 L-2 -24 M-6 -24 L-2 -28 M2 -28 L6 -24 M2 -24 L6 -28', INK, 1.8) +
    `<circle cx="0" cy="12" r="8" fill="none" stroke="#c0302a" stroke-width="3"/>`,
  sundial: () => ellipse(0, 18, 38, 14, '#a8a8a0') + `<ellipse cx="0" cy="14" rx="36" ry="12" fill="#c8c8c0" stroke="${INK}" stroke-width="2.4"/>` + ink('M-4 14 L10 -30 L14 -28 L4 14 Z', M.goldDark, 2.2) + line('M-30 14 L-20 14 M20 14 L30 14 M0 4 L0 0', INK, 1.6, 0.8) + fill('M4 14 L30 22 L28 18 Z', '#000', 0.3),
  paper_phrog: () => ink('M-34 24 L0 -24 L34 24 Z', '#7ab86a') + ink('M-34 24 L0 8 L34 24 Z', '#5a9a4a', 2.2) + line('M0 -24 L0 8', INK, 1.6, 0.7) + dot(-8, -6, 3, INK) + dot(8, -6, 3, INK),
  white_beast_statue: () => statue('#e8e4dc'),
  darkstone_periapt: () => limb('M-20 -40 C-20 -20 20 -20 20 -40', '#8a8a90', 2.4) + glow(0, 6, 30, '#8a4aff', 0.5) + ink('M0 36 C-26 18 -30 -2 -22 -12 C-14 -22 -4 -18 0 -8 C4 -18 14 -22 22 -12 C30 -2 26 18 0 36 Z', '#2a1a3a') + fill('M-14 -8 C-10 -14 -4 -12 -2 -6 Z', '#fff', 0.4),
  ninja_scroll: () => mo('scroll', 0.62, { tint: '#3a3a48' }),
  crown_shard: () => glow(0, 0, 36, '#ffd04a', 0.5) + ink('M-10 40 L-24 -6 L-4 -40 L18 -12 L10 40 Z', '#f2c040') + fill('M-4 -40 L18 -12 L10 40 L2 40 Z', '#000', 0.2) + fill('M-20 -6 L-6 -34 L-8 0 Z', '#fff', 0.45),
  soul_jar: () => urnBody('#6a3a8a', glow(0, 6, 22, '#d18ce8', 0.8) + place(Mo.flameBody(['#4a1470', '#8a3ad0', '#d08aff', '#fbe8ff']), 0, 10, 0.2)),
  paper_crane: () => ink('M-40 4 L-6 -6 L0 -36 L8 -6 L40 -14 L14 8 L4 24 L-6 8 Z', '#f4ece0') + line('M0 -36 L4 24 M-6 -6 L8 -6', '#a8a090', 1.6, 0.8) + ink('M-40 4 L-48 -6 L-36 -2 Z', '#f4ece0', 1.6),
  blood_pact: () => mo('scroll', 0.58) + mo('drop', 0.28, { tint: '#c0182a', x: 16, y: 18 }),
  gold_plated_cables: () => mo('chain', 0.6, { tint: M.gold }),
  symbiotic_virus: () => mo('germ', 0.62, { tint: '#b06ad0' }),
  bird_faced_urn: () => urnBody('#5a8aa0', ink('M-10 -16 L10 -16 L0 4 Z', '#e8b030', 2) + dot(-10, -20, 3, INK) + dot(10, -20, 3, INK)),
  calipers: () => limb('M-30 -34 L30 -34', '#8a9aa8', 6) + limb('M-24 -34 L-24 10 L-14 36', '#a8b4c0', 5) + limb('M20 -34 L20 10 L10 36', '#a8b4c0', 5) + circle(0, -34, 5, M.gold, 2),
  dead_branch: () => limb('M-34 40 C-20 10 -6 -6 10 -20 M-6 -6 L-26 -22 M10 -20 L30 -36 M10 -20 L24 -8 M-20 14 L-34 2', '#6a4a30', 6) + dot(30, -36, 3, '#5a3a20'),
  du_vu_doll: () =>
    ink('M-14 -24 C-14 -40 14 -40 14 -24 C14 -12 6 -8 0 -8 C-6 -8 -14 -12 -14 -24 Z', '#b08a5a') +
    ink('M-12 -6 L12 -6 L16 26 L-16 26 Z', '#a07a4a') +
    limb('M-12 -2 L-28 10 M12 -2 L28 10 M-8 26 L-12 42 M8 26 L12 42', '#a07a4a', 6) +
    line('M-8 -28 L-2 -22 M-8 -22 L-2 -28 M4 -28 L10 -22 M4 -22 L10 -28', INK, 1.8) +
    line('M-4 4 L4 14 M-4 14 L4 4', INK, 1.6) +
    limb('M18 -18 L36 -34', M.steel, 2) +
    circle(36, -34, 3.6, '#c0302a', 1.4) +
    limb('M-16 12 L-36 4', M.steel, 2) +
    circle(-36, 4, 3.6, '#3a6ad0', 1.4),
  fossilized_helix: () => {
    let s = ink('M0 0 m-34 0 a34 30 0 1 0 68 0 a34 30 0 1 0 -68 0', '#c8b088');
    s += line('M2 2 C2 -4 10 -4 10 2 C10 12 -6 12 -6 2 C-6 -14 18 -14 18 2 C18 20 -14 20 -14 2 C-14 -22 26 -22 26 2', '#7a6040', 3);
    return s;
  },
  ginger: () => ink('M-36 10 C-30 -6 -16 -4 -10 2 C-8 -16 6 -18 10 -6 C18 -20 34 -14 30 0 C40 6 36 22 22 22 C10 32 -24 30 -36 10 Z', '#d8b070') + line('M-20 10 L-12 14 M2 4 L8 10 M18 6 L24 12', '#a8803a', 2, 0.8),
  turnip: () => ink('M0 40 C-10 26 -30 14 -28 -2 C-26 -16 26 -16 28 -2 C30 14 10 26 0 40 Z', '#e8e0f0') + fill('M-28 -2 C-26 -16 26 -16 28 -2 C14 6 -14 6 -28 -2 Z', '#b04a9a') + ink('M-6 -14 C-14 -30 -20 -36 -16 -42 C-6 -34 -2 -24 -2 -14 Z', '#4a9a3a', 2) + ink('M4 -14 C10 -32 20 -36 22 -30 C14 -24 10 -20 6 -12 Z', '#5aaa4a', 2),
  ice_cream: () => ink('M-20 0 L20 0 L0 44 Z', '#d8a060') + line('M-14 8 L6 32 M14 8 L-6 32', '#a8783a', 1.6, 0.8) + circle(-10, -10, 14, '#f8e8f0') + circle(10, -10, 14, '#f0c8d8') + circle(0, -26, 14, '#a8e0c8') + dot(0, -40, 4, '#c0302a'),
  incense_burner: () => ink('M-30 10 C-30 34 30 34 30 10 Z', M.gold) + ink('M-34 6 L34 6 L32 12 L-32 12 Z', M.goldDark, 2.4) + limb('M-20 30 L-24 40 M20 30 L24 40', M.goldDark, 4) + line('M-6 4 C-14 -10 2 -20 -6 -34 M8 4 C2 -12 16 -22 8 -40', '#c8ccd4', 3, 0.7),
  lizard_tail: () => limb('M-36 30 C-10 30 10 10 14 -10 C16 -24 28 -34 36 -30', '#5a9a4a', 12) + line('M-30 26 C-6 24 10 8 12 -10', '#a8e070', 2, 0.5) + [0, 1, 2, 3].map((i) => line(`M${-20 + i * 12} ${30 - i * 10} L${-18 + i * 12} ${22 - i * 10}`, '#3a7a2a', 2)).join(''),
  mango: () => fruit('#f0a030', '#4a8a3a'),
  old_coin: () => glow(0, 0, 40, M.gold, 0.4) + circle(0, 0, 34, '#c8902a') + circle(0, 0, 26, '#e0a83a', 2.4) + ink('M-8 -8 L8 -8 L8 8 L-8 8 Z', '#8a5a1a', 2.4) + line('M-16 -18 L-12 -14 M16 18 L12 14', '#8a5a1a', 2) + hi('M-24 -10 C-20 -20 -12 -26 -4 -28', 2.6),
  peace_pipe: () => limb('M-40 20 L20 -4', '#8a5a2a', 7) + ink('M14 -18 L34 -18 L32 6 C30 14 16 14 16 6 Z', '#6a4426') + `<ellipse cx="24" cy="-18" rx="10" ry="4" fill="#2a1a10"/>` + line('M22 -24 C16 -34 30 -38 24 -48', '#c8ccd4', 2.4, 0.7) + [0, 1].map((i) => ink(`M${-30 + i * 10} ${16 - i * 4} L${-34 + i * 10} ${30 - i * 4} L${-26 + i * 10} ${14 - i * 4} Z`, '#e8dcc0', 1.4)).join(''),
  shovel: () => place(limb('M0 -40 L0 10', '#8a5a2a', 6) + ink('M-8 -46 L8 -46 L8 -38 L-8 -38 Z', '#6a4426', 2) + ink('M-16 8 L16 8 L14 34 C8 44 -8 44 -14 34 Z', M.steel) + hi('M-10 14 L-9 32', 2), 0, 0, 1, 30),
  girya: () => `<path d="M-16 -10 C-18 -34 18 -34 16 -10" fill="none" stroke="${INK}" stroke-width="11"/><path d="M-16 -10 C-18 -34 18 -34 16 -10" fill="none" stroke="#3a3a44" stroke-width="6"/>` + circle(0, 16, 26, '#3a3a44') + hi('M-16 4 C-18 14 -16 24 -10 30', 3, 0.4),
  tungsten_rod: () => place(ink('M-8 -40 L8 -40 L8 40 L-8 40 Z', '#6a7080') + fill('M-8 -40 L-2 -40 L-2 40 L-8 40 Z', '#fff', 0.25) + ellipse(0, -40, 8, 3, '#8a90a0', 2), 0, 0, 1, 35),
  torii: () => ink('M-44 -30 C-20 -36 20 -36 44 -30 L44 -22 L-44 -22 Z', '#c0302a') + ink('M-36 -14 L36 -14 L36 -8 L-36 -8 Z', '#c0302a', 2.4) + ink('M-28 -22 L-22 -22 L-20 40 L-30 40 Z', '#c0302a', 2.4) + ink('M22 -22 L28 -22 L30 40 L20 40 Z', '#c0302a', 2.4) + ink('M-4 -22 L4 -22 L4 -8 L-4 -8 Z', '#2a1a14', 1.6),
  unceasing_top: () => ink('M-30 -10 C-30 -24 30 -24 30 -10 C30 6 6 26 0 40 C-6 26 -30 6 -30 -10 Z', '#5a8ae0') + fill('M-30 -10 C-20 -4 20 -4 30 -10 C28 0 20 8 12 16 C4 10 -4 10 -12 16 C-20 8 -28 0 -30 -10 Z', '#c0302a', 0.85) + limb('M0 -20 L0 -36', '#6a4426', 4) + line('M-40 -16 C-44 -6 -40 6 -34 12 M40 -16 C44 -6 40 6 34 12', '#fff', 2, 0.6),
  thread_and_needle: () => ink('M-22 -20 L14 -20 L14 -12 L-22 -12 Z', '#a8783a', 2.2) + ink('M-22 20 L14 20 L14 28 L-22 28 Z', '#a8783a', 2.2) + ink('M-18 -12 L10 -12 L10 20 L-18 20 Z', '#c0302a') + line('M-18 -4 L10 -4 M-18 4 L10 4 M-18 12 L10 12', '#8a1a14', 1.4, 0.8) + limb('M24 -36 L32 30', M.steel, 2.6) + line('M24 -36 C40 -20 0 0 14 4', '#c0302a', 1.6),
  pocketwatch: () => `<circle cx="0" cy="-38" r="6" fill="none" stroke="${INK}" stroke-width="7"/><circle cx="0" cy="-38" r="6" fill="none" stroke="${M.gold}" stroke-width="3"/>` + circle(0, 4, 34, M.gold) + circle(0, 4, 27, '#f8f0dc', 2.2) + line('M0 4 L0 -16 M0 4 L14 10', INK, 3) + dot(0, 4, 3, INK) + line('M0 -20 L0 -23 M0 28 L0 31 M-24 4 L-27 4 M24 4 L27 4', INK, 2),
  prayer_wheel: () => limb('M0 30 L0 46', '#6a4426', 6) + ink('M-24 -26 L24 -26 L24 28 L-24 28 Z', M.gold) + ink('M-28 -32 L28 -32 L24 -26 L-24 -26 Z', M.goldDark, 2) + ink('M-28 34 L28 34 L24 28 L-24 28 Z', M.goldDark, 2) + line('M-16 -10 L16 -10 M-16 0 L16 0 M-16 10 L16 10', '#8a5a1a', 2) + shadowR('M6 -26 L24 -26 L24 28 L6 28 Z') + ink('M0 -32 L0 -44', 'none', 2.4),
  champion_belt: () => ink('M-46 -10 L46 -10 L46 12 L-46 12 Z', '#c0302a') + ink('M-22 -22 L22 -22 L22 24 L-22 24 Z', M.gold) + ink(starPath(0, 1, 13, 5.4, 5), '#fff4c0', 2) + [-36, 36].map((x) => circle(x, 1, 4, M.gold, 1.6)).join(''),
  tough_bandages: () => mo('bandage', 0.6),
  astral_gem: () => gem('#5a8af0') + ink(starPath(16, -30, 7, 2.4, 4), '#fff', 1.4),
  grave_urn: () => urnBody('#7a7a80', glow(0, -48, 12, '#d18ce8', 0.7)),
  emotion_chip: () => mo('chip', 0.62, { color: 'defect' }) + fill('M0 20 C-12 12 -12 2 -8 -1 C-4 -4 0 -1 0 3 C0 -1 4 -4 8 -1 C12 2 12 12 0 20 Z', '#ff7ab0'),
  coffee_dripper: () => ink('M-30 -20 L30 -20 L16 10 L-16 10 Z', '#e8e0d0') + ink('M-20 14 L20 14 L18 40 L-18 40 Z', '#6a4a3a') + `<ellipse cx="0" cy="14" rx="20" ry="4" fill="#3a2010"/>` + limb('M20 20 C32 20 32 34 20 34', '#6a4a3a', 4) + dot(0, 12, 2.4, '#3a2010') + line('M-6 -32 C-10 -40 -2 -44 -6 -50 M6 -32 C2 -40 10 -44 6 -50', '#c8ccd4', 2.4, 0.6),
  fusion_hammer: () => glow(10, -10, 40, '#ff8a3a', 0.6) + mo('hammer', 0.62),
  ectoplasm: () => `<g opacity="0.9">${ink('M-30 30 C-40 0 -26 -30 0 -32 C26 -30 40 0 30 30 C20 36 -20 36 -30 30 Z', '#8af0c0')}</g>` + dot(-10, -4, 5, '#1a3a2a') + dot(10, -4, 5, '#1a3a2a') + dot(-24, 38, 4, '#8af0c0', 0.8) + dot(20, 40, 3, '#8af0c0', 0.8),
  sozu: () => limb('M0 40 L0 -10', '#4a8a3a', 4) + [-1, 1].map((k) => [0, 1, 2].map((i) => ink(`M0 ${20 - i * 18} C${k * 14} ${10 - i * 18} ${k * 28} ${16 - i * 18} ${k * 30} ${6 - i * 18} C${k * 18} ${4 - i * 18} ${k * 8} ${10 - i * 18} 0 ${20 - i * 18} Z`, '#5aa04a', 2)).join('')).join(''),
  velvet_choker: () => `<ellipse cx="0" cy="0" rx="34" ry="22" fill="none" stroke="${INK}" stroke-width="12"/><ellipse cx="0" cy="0" rx="34" ry="22" fill="none" stroke="#5a1a4a" stroke-width="7"/>` + ink('M0 18 C-16 6 -22 30 -10 32 C-4 32 -2 26 0 22 C2 26 4 32 10 32 C22 30 16 6 0 18 Z', '#a83a8a', 2.2) + circle(0, 22, 4, M.gold, 1.6),
  philosophers_stone: () => gem('#d8302a'),
  busted_crown: () => mo('crown', 0.6) + line('M-6 -24 L2 -6 L-6 6 L4 20', INK, 3),
  mark_of_pain: () => mo('drop', 0.62, { tint: '#6a0a14' }) + line('M-30 -30 L-18 -18 M30 -30 L18 -18 M-30 24 L-18 14 M30 24 L18 14', '#c0182a', 3),
  cursed_key: () => mo('key', 0.62, { tint: '#8a4ac0' }) + glow(-12, -18, 20, '#b06aff', 0.5),
  runic_pyramid: () => ink('M0 -40 L40 30 L-40 30 Z', '#6a7a8a') + fill('M0 -40 L40 30 L4 30 Z', '#000', 0.22) + line('M-6 0 L6 0 M0 -8 L0 16 M-8 12 L8 12', '#7af0e0', 2.4) + glow(0, 6, 16, '#7af0e0', 0.6),
  snecko_eye: () => mo('eye', 0.6, { tint: '#6ab04a' }) + `<ellipse cx="0" cy="0" rx="3" ry="11" fill="${INK}" transform="scale(0.6)"/>`,
  black_star: () => glow(0, 0, 46, '#a86aff', 0.85) + ink(starPath(0, 2, 40, 18, 5), '#2a2030', 3) + fill(starPath(0, 2, 20, 9, 5), '#6a5a8a', 0.9) + line('M-12 -8 L0 -36', '#d0b0ff', 2.4, 0.7),
  astrolabe: () => {
    let s = circle(0, 4, 34, M.gold) + circle(0, 4, 26, '#2a3a6a', 2.4);
    for (let i = 0; i < 12; i++) s += line(`M${(Math.cos((i / 12) * Math.PI * 2) * 22).toFixed(1)} ${(4 + Math.sin((i / 12) * Math.PI * 2) * 22).toFixed(1)} L${(Math.cos((i / 12) * Math.PI * 2) * 26).toFixed(1)} ${(4 + Math.sin((i / 12) * Math.PI * 2) * 26).toFixed(1)}`, M.gold, 1.6);
    return s + limb('M-16 18 L16 -10', M.gold, 3) + fill(starPath(10, -4, 6, 2.4, 4), '#fff') + `<circle cx="0" cy="-34" r="5" fill="none" stroke="${M.gold}" stroke-width="3"/>`;
  },
  empty_cage: () => {
    let s = ink('M-26 34 L26 34 L26 40 L-26 40 Z', M.goldDark, 2.4) + `<path d="M-24 34 L-24 -14 C-24 -40 24 -40 24 -14 L24 34" fill="none" stroke="${INK}" stroke-width="7"/>`;
    for (const x of [-24, -12, 0, 12, 24]) s += line(`M${x} 34 L${x} ${x === 0 ? -34 : -14 - (24 - Math.abs(x)) * 0.8}`, M.gold, 3);
    return s + `<path d="M-24 -14 C-24 -40 24 -40 24 -14" fill="none" stroke="${M.gold}" stroke-width="3.5"/>` + `<circle cx="0" cy="-42" r="5" fill="none" stroke="${M.gold}" stroke-width="3"/>`;
  },
  pandoras_box: () => glow(0, -12, 40, '#c08aff', 0.6) + ink('M-34 -4 L34 -4 L30 36 L-30 36 Z', '#6a3a8a') + ink('M-38 -16 L38 -16 L34 -4 L-34 -4 Z', '#8a4aaa', 2.4) + line('M-34 14 L34 14', M.gold, 2.4) + ink('M-6 -2 L6 -2 L6 10 L-6 10 Z', M.gold, 2) + [-1, 0, 1].map((k) => line(`M${k * 14} -20 C${k * 18} -30 ${k * 10} -36 ${k * 16} -46`, '#e0a0ff', 2.4, 0.8)).join(''),
  tiny_house: () => ink('M-30 -4 L0 -32 L30 -4 Z', '#c0302a') + ink('M-24 -4 L24 -4 L24 34 L-24 34 Z', '#e8d8b0') + ink('M-8 12 L8 12 L8 34 L-8 34 Z', '#6a4426', 2.2) + ink('M10 2 L20 2 L20 12 L10 12 Z', '#8ad0ff', 1.8) + ink('M14 -26 L22 -26 L22 -14 L14 -20 Z', '#8a5a3a', 2),
  sacred_bark: () => ink('M-20 -40 L18 -36 L22 40 L-18 38 Z', '#8a6a4a') + line('M-12 -30 C-8 -10 -14 10 -10 30 M2 -32 C6 -10 0 10 6 32 M14 -30 C12 -10 16 10 12 30', '#5a3a20', 2.4, 0.8) + glow(0, 0, 30, '#ffe08a', 0.35),
  calling_bell: () => mo('bell', 0.62),
  black_blood: () => mo('drop', 0.62, { tint: '#2a0a14' }) + glow(0, 6, 30, '#c0182a', 0.35),
  ring_of_serpent: () => snakeRing('#2a7a5a') + glow(0, 4, 40, '#5af0a0', 0.25),
  celestial_crown: () => mo('crown', 0.62, { tint: '#d8e8ff' }) + [[-30, -30], [30, -30], [0, -44]].map(([x, y]) => fill(starPath(x, y, 6, 2.4, 4), '#fff')).join(''),
  eternal_phylactery: () => urnBody('#c8a040', glow(0, -48, 16, '#e0a0ff', 0.9) + ink(starPath(0, 14, 8, 3, 5), '#e0a0ff', 1.6)),
  frozen_core: () => mo('core', 0.62, { color: 'defect' }) + [[-24, -28], [26, -24], [-28, 22], [24, 26]].map(([x, y]) => place(Mo.snowflakeBody(), x, y, 0.12)).join(''),
  inserter: () => mo('plug', 0.62, { color: 'defect' }),
  membership_card: () => place(ink('M-38 -24 L38 -24 L38 24 L-38 24 Z', '#2a3a5a') + fill('M-38 -12 L38 -12 L38 -4 L-38 -4 Z', '#111') + ink('M-28 4 L-12 4 L-12 16 L-28 16 Z', M.gold, 1.8) + line('M0 10 L28 10', '#c8ccd4', 2.4), 0, 0, 1, -10),
  the_courier: () => ink('M-30 30 L-28 0 C-28 -14 -8 -14 -6 0 L-4 20 L24 22 C34 24 34 34 24 34 L-30 34 Z', '#8a5a32') + ink('M-6 -6 C10 -26 30 -30 40 -22 C26 -14 12 -8 -2 0 Z', '#f4ece0', 2.2) + ink('M-8 -2 C4 -16 20 -16 30 -10 C18 -6 8 -2 -4 4 Z', '#e8dcc0', 2),
  strange_spoon: () => place(ink('M0 -42 C14 -42 16 -20 4 -14 L3 36 L-3 36 L-4 -14 C-16 -20 -14 -42 0 -42 Z', M.steel) + hi('M-6 -36 C-8 -30 -6 -24 -2 -22', 2), 0, 0, 1, 30) + line('M-36 -20 C-30 -26 -24 -26 -18 -20', '#c08aff', 2, 0.7),
  chemical_x: () => mo('flask', 0.6, { tint: '#b04ad0' }) + line('M-8 12 L8 28 M8 12 L-8 28', '#fff', 3.4),
  lees_waffle: () => {
    let s = ink('M-36 -30 L36 -30 L36 30 L-36 30 Z', '#e0a850');
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) s += ink(`M${-28 + i * 15} ${-22 + j * 15} h10 v10 h-10 Z`, '#b07a2a', 1.6);
    return place(s, 0, 0, 0.95, 12) + ink('M-10 -36 C-14 -44 -4 -46 -2 -40 L2 -26 L-8 -24 Z', '#fff6c0', 1.8);
  },
  medical_kit: () => ink('M-34 -20 L34 -20 L34 30 L-34 30 Z', '#e8e8ec') + limb('M-12 -20 L-12 -30 L12 -30 L12 -20', '#8a8a90', 3) + ink('M-6 -10 L6 -10 L6 0 L16 0 L16 12 L6 12 L6 22 L-6 22 L-6 12 L-16 12 L-16 0 L-6 0 Z', '#d0302a', 2) + shadowR('M10 -20 L34 -20 L34 30 L10 30 Z', 0.12),
  sling: () => limb('M0 40 L0 6 L-20 -30 M0 6 L20 -30', '#8a5a2a', 6) + line('M-20 -30 C-10 -10 10 -10 20 -30', '#c8a870', 2.4) + ellipse(0, -14, 7, 5, '#6a4426', 2) + circle(0, -26, 6, M.stone, 2),
  clockwork_souvenir: () => mo('gear', 0.6, { tint: '#c8a060' }) + place(Mo.gear({ pal: PALS.colorless, r: rand(3), color: 'colorless', tint: M.steel }), 26, 24, 0.3),
  cauldron: () => glow(0, -14, 36, '#8af06a', 0.45) + ink('M-36 -10 C-40 30 -16 40 0 40 C16 40 40 30 36 -10 Z', '#2a2a30') + `<ellipse cx="0" cy="-10" rx="36" ry="9" fill="#6ac04a" stroke="${INK}" stroke-width="3"/>` + limb('M-26 36 L-30 46 M26 36 L30 46', '#2a2a30', 5) + dot(-10, -12, 3, '#c8f8a0') + dot(8, -14, 2.4, '#c8f8a0') + hi('M-28 0 C-30 12 -26 24 -20 30', 2.6, 0.35),
  dollys_mirror: () => mo('mirror', 0.6, { color: 'colorless' }),
  runic_capacitor: () => mo('battery', 0.62, { color: 'defect' }),
  warped_tongs: () => limb('M-30 40 C-20 10 -10 -10 -16 -34', '#6a707c', 5) + limb('M30 40 C20 10 10 -10 16 -34', '#6a707c', 5) + circle(0, 6, 5, M.steelDark, 2) + ink('M-20 -36 L-8 -42 L-12 -30 Z M20 -36 L8 -42 L12 -30 Z', M.steel, 1.8),
  circlet: () => ring(M.gold, '#c0302a'),
  golden_idol: () => glow(0, 0, 40, '#ffd04a', 0.5) + statue('#e8b030'),
  odd_mushroom: () => ink('M-8 0 L-6 38 L6 38 L8 0 Z', '#efe2c8') + ink('M-34 2 C-34 -34 34 -34 34 2 C20 8 -20 8 -34 2 Z', '#9a4ad0') + dot(-14, -14, 6, '#f4ece0') + dot(12, -18, 5, '#f4ece0') + dot(20, -4, 3.4, '#f4ece0') + shadowR('M10 -28 C26 -20 34 -10 34 2 C26 6 16 6 10 6 C20 -6 20 -18 10 -28 Z'),
  bloody_idol: () => statue('#c0302a') + mo('drop', 0.16, { tint: '#ffd0d0', x: 0, y: 10 }),
  mark_of_bloom: () => mo('rose', 0.62, { tint: '#e070b0' }),
  neows_lament: () => glow(0, 4, 40, '#7ad8ff', 0.5) + mo('drop', 0.6, { tint: '#6ab0e0' }) + line('M-8 4 C-4 0 4 0 8 4', INK, 2.4) + dot(-10, -6, 2, INK) + dot(10, -6, 2, INK),
  pael_eye: () => mo('eye', 0.62, { tint: '#c0302a' }) + [0, 1, 2, 3, 4, 5].map((i) => line(`M${(Math.cos(i) * 34).toFixed(1)} ${(Math.sin(i) * 26).toFixed(1)} L${(Math.cos(i) * 44).toFixed(1)} ${(Math.sin(i) * 36).toFixed(1)}`, '#a83a4a', 3)).join(''),
  orobas_prism: () => glow(0, 0, 40, '#c08aff', 0.6) + ink('M0 -40 L30 26 L-30 26 Z', '#b8a0f0') + fill('M0 -40 L30 26 L4 26 Z', '#000', 0.2) + line('M-50 0 L-14 -4 M14 4 L50 0 M16 8 L50 14 M16 12 L50 26', '#ff7ab0', 2, 0.8),
  tezcatara_ember: () => glow(0, 4, 44, '#ff8a3a', 0.6) + place(Mo.flameBody(), 0, 0, 0.62) + dot(0, 18, 7, '#fff6c0'),
  nonupeipe_purse: () => ink('M-26 -6 C-34 22 -24 40 0 40 C24 40 34 22 26 -6 Z', '#c0302a') + ink('M-28 -10 L28 -10 L26 -2 L-26 -2 Z', M.gold, 2.4) + limb('M-14 -10 C-14 -24 14 -24 14 -10', M.gold, 3) + circle(0, 16, 9, M.gold, 2.2) + [[-20, -28], [18, -32], [2, -40]].map(([x, y]) => ellipse(x, y, 7, 5, M.gold, 2)).join(''),
  vakuu_mask: () => ink('M-30 -20 C-20 -34 20 -34 30 -20 C34 4 20 30 0 34 C-20 30 -34 4 -30 -20 Z', '#f4ece0') + fill('M0 -32 C14 -32 28 -28 30 -20 C34 4 20 30 0 34 Z', '#1a1a20', 0.85) + dot(-12, -8, 5, '#8af0a0') + dot(12, -8, 5, '#ff5aff') + ink('M-14 12 C-6 20 6 20 14 12 C8 24 -8 24 -14 12 Z', '#3a1a2a', 2),
};

// ---------------------------------------------------------------- 导出

function iconDoc(body: string, seed: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100" width="100" height="100">${defsLite(seed)}<g filter="url(#paint)">${body}</g></svg>`;
}

/** 图标用的精简滤镜（与插画一致的墨线抖动与光照） */
function defsLite(seed: number): string {
  return `<defs><filter id="paint" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="${seed}" result="t"/>
<feDisplacementMap in="SourceGraphic" in2="t" scale="1.8" xChannelSelector="R" yChannelSelector="G" result="d"/>
<feGaussianBlur in="SourceAlpha" stdDeviation="2" result="b"/>
<feDiffuseLighting in="b" surfaceScale="2.6" diffuseConstant="1" lighting-color="#fff" result="l"><feDistantLight azimuth="235" elevation="52"/></feDiffuseLighting>
<feComposite in="d" in2="l" operator="arithmetic" k1="1.25" k2="0" k3="0" k4="0" result="m"/>
<feComposite in="m" in2="d" operator="in"/>
</filter><filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter><filter id="soft2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter></defs>`;
}

const relicCache = memo((id: string) => {
  const fn = R[id];
  return iconDoc(fn ? fn() : mo('sparkle', 0.6), hash(id) % 97);
});
const potionCache = memo((id: string) => iconDoc(potionArtBody(id), hash(id) % 97));

export function relicArtUrl(id: string): string {
  return relicCache(id);
}

export function potionArtUrl(id: string): string {
  return potionCache(id);
}

const serviceCache = memo((id: string) => iconDoc(id === 'remove' ? mo('scissors', 0.62) : mo('sparkle', 0.6), 7));

/** 商店服务图标 */
export function serviceArtUrl(id: string): string {
  return serviceCache(id);
}

export function hasRelicArt(id: string): boolean {
  return id in R;
}

export function missingRelicArt(): string[] {
  return Object.keys(RELICS).filter((id) => !(id in R));
}

