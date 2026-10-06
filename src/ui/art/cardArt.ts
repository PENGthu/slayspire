/**
 * 卡牌插画：绘画风背景 + 主体图案 + 卡牌类型特效。
 * 每张卡的插画由 emoji 对应的图案决定，部分卡牌有专门的设定。
 */
import type { CardDef } from '../../game/types';
import { INK, doc, glow, grain, hash, line, memo, mix, place, rand, shade, vignette } from './kit';
import * as Mo from './motifs';
import { M, PALS, type Pal } from './palettes';

export const ART_W = 200;
export const ART_H = 116;

type MotifName = {
  [K in keyof typeof Mo]: (typeof Mo)[K] extends Mo.Motif ? K : never;
}[keyof typeof Mo];

export interface ArtSpec {
  m: MotifName;
  tint?: string;
  n?: number;
  v?: string;
  /** 缩放 */
  s?: number;
  x?: number;
  y?: number;
  rot?: number;
  /** 背景氛围 */
  bg?: 'fire' | 'night' | 'storm' | 'poison' | 'blood' | 'void' | 'frost' | 'gold';
  /** 前景特效 */
  fx?: 'slash' | 'slash3' | 'sparks' | 'impact' | 'motes' | 'none';
}

/** emoji → 插画设定 */
const BY_GLYPH: Record<string, ArtSpec> = {
  '🗡️': { m: 'dagger', fx: 'slash' },
  '⚔️': { m: 'swords', fx: 'impact' },
  '🛡️': { m: 'shield' },
  '⚡': { m: 'bolt', bg: 'storm' },
  '🩸': { m: 'drop', bg: 'blood' },
  '🔥': { m: 'flame', bg: 'fire' },
  '👻': { m: 'ghost', bg: 'void' },
  '🌀': { m: 'vortex' },
  '🔪': { m: 'dagger', fx: 'slash' },
  '🌪️': { m: 'tornado', bg: 'storm' },
  '☄️': { m: 'fireball', v: 'rock', bg: 'fire' },
  '🌑': { m: 'eclipse', bg: 'void' },
  '🫳': { m: 'hand', v: 'down' },
  '💥': { m: 'explosion', bg: 'fire' },
  '🌧️': { m: 'knifeRain' },
  '🌫️': { m: 'smoke' },
  '🦴': { m: 'bone', n: 2 },
  '🔨': { m: 'hammer', fx: 'impact' },
  '🧠': { m: 'brain' },
  '📜': { m: 'scroll' },
  '🎯': { m: 'target' },
  '🕯️': { m: 'candle' },
  '🌾': { m: 'scythe', fx: 'slash' },
  '💨': { m: 'wind', fx: 'slash' },
  '🕳️': { m: 'blackHole', bg: 'void' },
  '🌠': { m: 'fallingStar', bg: 'night' },
  '👑': { m: 'crown', bg: 'gold' },
  '🔧': { m: 'wrench' },
  '🤺': { m: 'swords' },
  '🪓': { m: 'axe', fx: 'slash' },
  '🌊': { m: 'wave' },
  '✨': { m: 'sparkle' },
  '🔱': { m: 'trident', fx: 'impact' },
  '🪨': { m: 'rock' },
  '💉': { m: 'syringe' },
  '🦵': { m: 'figure', v: 'kick', fx: 'impact' },
  '🧘': { m: 'figure', v: 'meditate' },
  '😱': { m: 'face', v: 'scream' },
  '🧱': { m: 'wall' },
  '👊': { m: 'fist', fx: 'impact' },
  '🐗': { m: 'beast', v: 'boar', fx: 'impact' },
  '🩹': { m: 'bandage' },
  '🌬️': { m: 'wind' },
  '⚰️': { m: 'coffin', bg: 'void' },
  '🔍': { m: 'magnifier' },
  '💀': { m: 'skull', v: 'glow' },
  '🍖': { m: 'meat' },
  '📈': { m: 'chart' },
  '🧛': { m: 'fang', bg: 'blood' },
  '🔄': { m: 'arrows' },
  '🐍': { m: 'snake', bg: 'poison' },
  '💃': { m: 'figure', v: 'dance' },
  '🧪': { m: 'vial', bg: 'poison' },
  '🥷': { m: 'figure', v: 'crouch' },
  '💢': { m: 'slashFx', n: 3, bg: 'blood' },
  '🎲': { m: 'dice' },
  '♾️': { m: 'infinity' },
  '🦿': { m: 'figure', v: 'kick', fx: 'impact' },
  '👁️': { m: 'eye' },
  '☠️': { m: 'crossbones' },
  '🎆': { m: 'fireworks', bg: 'night' },
  '🎭': { m: 'mask' },
  '💫': { m: 'sparkle' },
  '✂️': { m: 'scissors', fx: 'slash' },
  '🌟': { m: 'star', bg: 'night' },
  '🔆': { m: 'rays', bg: 'gold' },
  '🔦': { m: 'beam' },
  '🪐': { m: 'planet', bg: 'night' },
  '😤': { m: 'face', v: 'angry' },
  '🌌': { m: 'galaxy', bg: 'night' },
  '📯': { m: 'horn' },
  '📢': { m: 'horn' },
  '⚖️': { m: 'scales', bg: 'gold' },
  '🍂': { m: 'leaves' },
  '🌩️': { m: 'stormCloud', bg: 'storm' },
  '🥶': { m: 'face', v: 'cold', bg: 'frost' },
  '🔁': { m: 'arrows' },
  '⛓️': { m: 'chain' },
  '😠': { m: 'face', v: 'angry', bg: 'fire' },
  '🐂': { m: 'beast', v: 'bull', fx: 'impact' },
  '💪': { m: 'fist', v: 'up' },
  '🏋️': { m: 'figure', v: 'lift' },
  '🐏': { m: 'beast', v: 'ram', fx: 'impact' },
  '🤷': { m: 'figure', v: 'shrug' },
  '🪃': { m: 'boomerang' },
  '📣': { m: 'horn' },
  '🐺': { m: 'wolf', fx: 'slash' },
  '🤹': { m: 'swords' },
  '🏰': { m: 'tower' },
  '🧬': { m: 'dna' },
  '🐉': { m: 'dragon', bg: 'fire' },
  '🔩': { m: 'armorPlate' },
  '😡': { m: 'face', v: 'angry', bg: 'fire' },
  '🦏': { m: 'beast', v: 'rhino', fx: 'impact' },
  '🔴': { m: 'eye', tint: '#d0302a', bg: 'blood' },
  '🗼': { m: 'tower' },
  '🥊': { m: 'fist', v: 'up', tint: '#c0302a', fx: 'impact' },
  '🏯': { m: 'wall' },
  '😈': { m: 'demon', bg: 'fire' },
  '⛏️': { m: 'pickaxe' },
  '👹': { m: 'demon', bg: 'fire' },
  '🌋': { m: 'volcano', bg: 'fire' },
  '🗿': { m: 'shield', tint: M.stone },
  '🏕️': { m: 'tent', bg: 'night' },
  '🤸': { m: 'figure', v: 'flip' },
  '🧥': { m: 'figure', v: 'cloak' },
  '🪶': { m: 'feather' },
  '♟️': { m: 'chess' },
  '🎒': { m: 'backpack' },
  '🎩': { m: 'hat' },
  '⚗️': { m: 'flask', bg: 'poison' },
  '📍': { m: 'caltrops' },
  '🧫': { m: 'petri', bg: 'poison' },
  '☁️': { m: 'cloud', tint: '#8ab05a', bg: 'poison' },
  '🏃': { m: 'figure', v: 'run' },
  '🗺️': { m: 'map' },
  '📚': { m: 'book' },
  '🏁': { m: 'flag' },
  '👣': { m: 'footprints' },
  '🪝': { m: 'hook', fx: 'impact' },
  '🐆': { m: 'wolf', tint: '#c8963a', fx: 'slash' },
  '🍢': { m: 'spear', fx: 'impact' },
  '♞': { m: 'chess', v: 'knight' },
  '📋': { m: 'scroll' },
  '👥': { m: 'figures' },
  '⏱️': { m: 'clock' },
  '💣': { m: 'bomb' },
  '😩': { m: 'face', v: 'pain' },
  '👤': { m: 'figures', v: 'cloak', bg: 'void' },
  '🧰': { m: 'toolbox' },
  '🔫': { m: 'knifeRain' },
  '🙏': { m: 'figure', v: 'pray', bg: 'gold' },
  '⚒️': { m: 'anvil' },
  '💂': { m: 'helmet' },
  '♒': { m: 'constellation', bg: 'night' },
  '☝️': { m: 'hand' },
  '🥋': { m: 'armorPlate', tint: M.gold },
  '🔮': { m: 'crystalBall' },
  '🫅': { m: 'crown', bg: 'gold' },
  '🌞': { m: 'sun', bg: 'fire' },
  '🏛️': { m: 'temple', bg: 'gold' },
  '🌃': { m: 'moon', bg: 'night' },
  '✋': { m: 'boneHand' },
  '🫗': { m: 'vial', tint: '#c06ae0' },
  '🗣️': { m: 'ghost' },
  '⚱️': { m: 'urn' },
  '🫂': { m: 'boneHand' },
  '😨': { m: 'face', v: 'fear', bg: 'void' },
  '🎶': { m: 'notes' },
  '🔔': { m: 'bell' },
  '🥀': { m: 'rose' },
  '😋': { m: 'skull', v: 'glow', bg: 'void' },
  '🪦': { m: 'grave', bg: 'night' },
  '🏚️': { m: 'ghost', bg: 'night' },
  '🔗': { m: 'chain' },
  '🦷': { m: 'bone', n: 3 },
  '🌙': { m: 'moon', bg: 'night' },
  '🪖': { m: 'figures', v: 'stand' },
  '🧟': { m: 'grave' },
  '🎼': { m: 'notes' },
  '♊': { m: 'orbs' },
  '🔋': { m: 'battery' },
  '🦾': { m: 'claw', fx: 'slash' },
  '💽': { m: 'disk' },
  '🧊': { m: 'iceCube', bg: 'frost' },
  '📽️': { m: 'projector' },
  '🦘': { m: 'figure', v: 'leap' },
  '🗄️': { m: 'cabinet' },
  '♨️': { m: 'smoke', tint: '#d8dce6' },
  '📉': { m: 'chart', v: 'down' },
  '📡': { m: 'satellite' },
  '🧮': { m: 'abacus' },
  '🌨️': { m: 'stormCloud', v: 'snow', bg: 'frost' },
  '💻': { m: 'screen' },
  '🔌': { m: 'plug' },
  '🍽️': { m: 'orb', tint: '#c06ae0' },
  '🧩': { m: 'puzzle' },
  '🚀': { m: 'rocket' },
  '🔵': { m: 'forceField' },
  '☢️': { m: 'biohazard' },
  '🏔️': { m: 'glacier', bg: 'frost' },
  '🌡️': { m: 'thermometer' },
  '👋': { m: 'hand', tint: '#8ab0d8' },
  '➰': { m: 'loop' },
  '🫠': { m: 'flame', tint: 'blue', bg: 'fire' },
  '♻️': { m: 'recycle' },
  '⌨️': { m: 'keyboard' },
  '🪚': { m: 'saw', fx: 'slash' },
  '📄': { m: 'book' },
  '⛈️': { m: 'stormCloud', v: 'rain', bg: 'storm' },
  '📻': { m: 'radio' },
  '🫶': { m: 'rays' },
  '🫧': { m: 'bubbles' },
  '💠': { m: 'core' },
  '🤖': { m: 'robotHead' },
  '🔊': { m: 'speaker' },
  '🌐': { m: 'globe' },
  '⚛️': { m: 'atom' },
  '🎇': { m: 'fireworks', bg: 'night' },
  '🌈': { m: 'rainbow', bg: 'night' },
  '🧭': { m: 'compass' },
  '🪄': { m: 'wand' },
  '🦉': { m: 'owl', bg: 'night' },
  '🆘': { m: 'button' },
  '🤪': { m: 'face', v: 'scream', tint: '#d8a0e0' },
  '🍌': { m: 'peel' },
  '💡': { m: 'bulb' },
  '🃏': { m: 'card' },
  '🕊️': { m: 'dove', bg: 'gold' },
  '🤔': { m: 'face', v: 'neutral' },
  '🙈': { m: 'mask', v: 'sad' },
  '😇': { m: 'halo', bg: 'gold' },
  '🤑': { m: 'coin', bg: 'gold' },
  '♛': { m: 'chess', v: 'queen' },
  '🗝️': { m: 'key' },
  '📖': { m: 'book' },
  '🦋': { m: 'butterfly' },
  '🐛': { m: 'worm', tint: '#6ab04a' },
  '😔': { m: 'face', v: 'sad' },
  '🤕': { m: 'face', v: 'pain' },
  '🪱': { m: 'parasite' },
  '🩼': { m: 'crutch' },
  '😳': { m: 'face', v: 'fear', tint: '#e8a090' },
  '🤨': { m: 'face', v: 'smug' },
  '🤦': { m: 'face', v: 'pain' },
  '😖': { m: 'face', v: 'pain', tint: '#c8b0d0' },
  '📏': { m: 'ruler' },
  '🟢': { m: 'slime' },
  '🦠': { m: 'germ', bg: 'poison' },
  '🐊': { m: 'beast', v: 'boar', tint: '#3a6a3a' },
};

/** 个别卡牌的专门设定 */
const BY_ID: Record<string, ArtSpec> = {
  strike_r: { m: 'sword', fx: 'slash', rot: 0 },
  strike_g: { m: 'dagger', fx: 'slash' },
  strike_o: { m: 'sword', tint: '#f6e3a6', fx: 'slash', bg: 'gold' },
  strike_n: { m: 'scythe', fx: 'slash' },
  strike_b: { m: 'claw', fx: 'slash' },
  defend_r: { m: 'shield' },
  defend_g: { m: 'figure', v: 'cloak' },
  defend_o: { m: 'shield', tint: '#d9821f' },
  defend_n: { m: 'boneHand' },
  defend_b: { m: 'forceField' },
  heavy_blade: { m: 'sword', s: 1.15, fx: 'impact' },
  twin_strike: { m: 'swords', fx: 'slash3' },
  dagger_spray: { m: 'knifeRain' },
  shiv_storm: { m: 'knifeRain' },
  meteor_shower: { m: 'fallingStar', bg: 'night' },
  tempest: { m: 'stormCloud', v: 'rain', bg: 'storm' },
  blade_dance: { m: 'dagger', n: 3 },
  a_thousand_cuts: { m: 'dagger', n: 4 },
  cloak_and_dagger: { m: 'figure', v: 'cloak' },
  noxious_fumes: { m: 'smoke', tint: '#8ab05a', bg: 'poison' },
  stardust: { m: 'sparkle', bg: 'night' },
  doom_and_gloom: { m: 'smoke', tint: '#4a3a5a', bg: 'void' },
  blur: { m: 'figures', v: 'run' },
  storm_of_steel: { m: 'knifeRain' },
  bone_storm: { m: 'bone', n: 3 },
  soul_storm: { m: 'soulFlame' },
  soul: { m: 'soulFlame' },
  soul_siphon: { m: 'soulFlame' },
  ghost_touch: { m: 'boneHand' },
  bodyguard: { m: 'boneHand' },
  unleash: { m: 'boneHand', fx: 'impact' },
  zap: { m: 'bolt', bg: 'storm' },
  dualcast: { m: 'orbs' },
  double_energy: { m: 'battery' },
  shiv: { m: 'dagger', tint: '#e8eef2', fx: 'slash' },
  wraith_form: { m: 'ghost', bg: 'void' },
  corruption: { m: 'demon', tint: '#5a1a5a', bg: 'void' },
  inflame: { m: 'flame', bg: 'fire' },
  star_forge: { m: 'anvil', bg: 'night' },
  slimed: { m: 'slime' },
  burn: { m: 'flame', bg: 'fire' },
  wound: { m: 'clawMarks', bg: 'blood' },
  dazed: { m: 'sparkle' },
  void: { m: 'blackHole', bg: 'void' },
  riddle_with_holes: { m: 'holes' },
  bite: { m: 'fang', bg: 'blood' },
  sly_dagger: { m: 'dagger', fx: 'slash' },
  sovereign_blade: { m: 'sword', tint: '#ffe8a8', bg: 'gold', s: 1.1, fx: 'slash' },
  osty_strike: { m: 'boneHand', fx: 'impact' },
};

function specFor(d: CardDef): ArtSpec {
  return BY_ID[d.id] ?? BY_GLYPH[d.art] ?? (d.type === 'attack' ? { m: 'slashFx' } : d.type === 'power' ? { m: 'orb' } : { m: 'sparkle' });
}

/** 背景：底色渐变 + 笔触 + 氛围光 */
function background(pal: Pal, type: string, spec: ArtSpec, r: () => number, W = ART_W, H = ART_H): string {
  let top = pal.mid;
  let bot = pal.dark;
  let light = pal.light;
  switch (spec.bg) {
    case 'fire':
      top = mix(pal.mid, '#8a2a0a', 0.55);
      bot = mix(pal.dark, '#2a0602', 0.6);
      light = mix(light, M.flame2, 0.6);
      break;
    case 'night':
      top = mix(pal.dark, '#0a0a24', 0.5);
      bot = mix(pal.mid, '#1a1440', 0.5);
      break;
    case 'storm':
      top = mix(pal.mid, '#2a3048', 0.6);
      bot = mix(pal.dark, '#0a0c16', 0.6);
      light = mix(light, '#fff4a0', 0.5);
      break;
    case 'poison':
      top = mix(pal.mid, '#2a4a14', 0.6);
      bot = mix(pal.dark, '#0a1404', 0.6);
      light = mix(light, '#b8f06a', 0.6);
      break;
    case 'blood':
      top = mix(pal.mid, '#5a0a10', 0.6);
      bot = mix(pal.dark, '#1a0204', 0.6);
      light = mix(light, '#ff6a5a', 0.5);
      break;
    case 'void':
      top = mix(pal.mid, '#2a1040', 0.6);
      bot = mix(pal.dark, '#080210', 0.6);
      light = mix(light, '#c08aff', 0.5);
      break;
    case 'frost':
      top = mix(pal.mid, '#2a5a7a', 0.6);
      bot = mix(pal.dark, '#061420', 0.6);
      light = mix(light, '#c8f2ff', 0.6);
      break;
    case 'gold':
      top = mix(pal.mid, '#6a4a14', 0.55);
      bot = mix(pal.dark, '#1a1004', 0.6);
      light = mix(light, '#ffe08a', 0.6);
      break;
  }
  const id = `bg${hash(top + bot)}`;
  let s = `<linearGradient id="${id}" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient><rect width="${W}" height="${H}" fill="url(#${id})"/>`;
  // 笔触
  for (let i = 0; i < 9; i++) {
    const y = r() * H;
    const x = -20 + r() * 40;
    const c = r() < 0.5 ? shade(top, 0.12 + r() * 0.1) : shade(bot, -0.2);
    s += line(`M${x} ${y.toFixed(1)} C${60 + r() * 30} ${(y - 20 + r() * 40).toFixed(1)} ${120 + r() * 30} ${(y - 20 + r() * 40).toFixed(1)} ${W + 20} ${(y - 10 + r() * 20).toFixed(1)}`, c, 8 + r() * 14, 0.18 + r() * 0.12);
  }
  if (spec.bg === 'night') {
    for (let i = 0; i < 26; i++) s += `<circle cx="${(r() * W).toFixed(1)}" cy="${(r() * H).toFixed(1)}" r="${(0.4 + r() * 1.1).toFixed(2)}" fill="#fff" opacity="${(0.4 + r() * 0.6).toFixed(2)}"/>`;
  }
  s += glow(W / 2, H * 0.5, W * 0.46, light, type === 'power' ? 0.6 : 0.45, H * 0.6);
  if (type === 'power') {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + r() * 0.2;
      const x2 = W / 2 + Math.cos(a) * 160;
      const y2 = H / 2 + Math.sin(a) * 160;
      const a2 = a + 0.08;
      s += `<path d="M${W / 2} ${H / 2} L${x2.toFixed(1)} ${y2.toFixed(1)} L${(W / 2 + Math.cos(a2) * 160).toFixed(1)} ${(H / 2 + Math.sin(a2) * 160).toFixed(1)} Z" fill="${light}" opacity="0.1"/>`;
    }
    s += `<ellipse cx="${W / 2}" cy="${H / 2}" rx="78" ry="44" fill="none" stroke="${light}" stroke-width="1.4" opacity="0.35"/><ellipse cx="${W / 2}" cy="${H / 2}" rx="94" ry="54" fill="none" stroke="${light}" stroke-width="1" opacity="0.2"/>`;
  } else if (type === 'attack') {
    for (let i = 0; i < 6; i++) {
      const y = r() * H;
      s += line(`M${(r() * 40).toFixed(1)} ${(y + 30).toFixed(1)} L${(W - r() * 40).toFixed(1)} ${(y - 30).toFixed(1)}`, light, 1 + r() * 1.5, 0.12 + r() * 0.12);
    }
  } else if (type === 'curse') {
    for (let i = 0; i < 4; i++) {
      const x = r() * W;
      s += line(`M${x.toFixed(1)} ${H} C${(x - 30 + r() * 60).toFixed(1)} ${H * 0.6} ${(x - 30 + r() * 60).toFixed(1)} ${H * 0.3} ${(x - 20 + r() * 40).toFixed(1)} 0`, '#000', 10, 0.25);
    }
  }
  return s;
}

function foreground(spec: ArtSpec, type: string, pal: Pal, r: () => number): string {
  const fx = spec.fx ?? (type === 'skill' ? 'motes' : 'none');
  const W = ART_W;
  const H = ART_H;
  let s = '';
  if (fx === 'slash' || fx === 'slash3') {
    const n = fx === 'slash3' ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const o = i * 18 - (n - 1) * 9;
      s += `<path d="M${30 + o} ${H - 8} C${80 + o} ${H * 0.55} ${120 + o} ${H * 0.35} ${W - 16 + o} 10 C${130 + o} ${H * 0.42} ${90 + o} ${H * 0.62} ${30 + o} ${H - 8} Z" fill="#fff" opacity="0.85"/>`;
    }
  } else if (fx === 'impact') {
    for (let i = 0; i < 10; i++) {
      const a = r() * Math.PI * 2;
      const r1 = 40 + r() * 10;
      const r2 = r1 + 10 + r() * 16;
      s += line(`M${(W / 2 + Math.cos(a) * r1).toFixed(1)} ${(H / 2 + Math.sin(a) * r1 * 0.7).toFixed(1)} L${(W / 2 + Math.cos(a) * r2).toFixed(1)} ${(H / 2 + Math.sin(a) * r2 * 0.7).toFixed(1)}`, '#fff', 2, 0.7);
    }
  } else if (fx === 'sparks') {
    for (let i = 0; i < 12; i++) s += `<circle cx="${(r() * W).toFixed(1)}" cy="${(r() * H).toFixed(1)}" r="${(0.8 + r() * 1.6).toFixed(1)}" fill="${M.flame1}" opacity="0.9"/>`;
  } else if (fx === 'motes') {
    for (let i = 0; i < 9; i++) s += `<circle cx="${(r() * W).toFixed(1)}" cy="${(r() * H).toFixed(1)}" r="${(0.8 + r() * 1.8).toFixed(1)}" fill="${pal.light}" opacity="${(0.35 + r() * 0.5).toFixed(2)}"/>`;
  }
  return s;
}

export function cardArtSvg(d: CardDef): string {
  const pal = PALS[d.color] ?? PALS.colorless;
  const spec = specFor(d);
  const seed = hash(d.id);
  const r = rand(seed);
  const motif = Mo[spec.m] as Mo.Motif;
  const body = motif({ pal, r: rand(seed ^ 0x9e37), color: d.color, tint: spec.tint, n: spec.n, v: spec.v });
  // 同一图案在不同卡牌上略作变化：位置、角度、镜像
  const jr = rand(seed ^ 0x51ed);
  const varied = !BY_ID[d.id] && spec.m !== 'face' && spec.m !== 'figure' && spec.m !== 'figures';
  const jx = varied ? (jr() - 0.5) * 14 : 0;
  const jrot = varied ? (jr() - 0.5) * 24 : 0;
  const flip = varied && jr() < 0.35;
  const subj = place(body, ART_W / 2 + (spec.x ?? 0) + jx, ART_H / 2 + 4 + (spec.y ?? 0), 0.96 * (spec.s ?? 1), (spec.rot ?? 0) + jrot, flip);
  const ground = `<ellipse cx="${ART_W / 2}" cy="${ART_H - 6}" rx="70" ry="10" fill="${INK}" opacity="0.25"/>`;
  return doc(
    ART_W,
    ART_H,
    background(pal, d.type, spec, r) + ground + `<g filter="url(#paint)">${subj}</g>` + foreground(spec, d.type, pal, r) + vignette(ART_W, ART_H, 0.9) + grain(ART_W, ART_H, 0.5),
    seed % 97,
  );
}

const cache = memo((id: string, d: CardDef) => cardArtSvg(d));

/** 卡牌插画的 data URI（按卡牌 id 缓存） */
export function cardArtUrl(d: CardDef): string {
  return cache(d.id, d);
}

export function hasCardArt(d: CardDef): boolean {
  return !!(BY_ID[d.id] ?? BY_GLYPH[d.art]);
}

/** 事件插画 */
const EVENT_SPEC: Record<string, ArtSpec> = {
  big_fish: { m: 'fish', bg: 'frost' },
  golden_shrine: { m: 'temple', tint: '#e8c870', bg: 'gold' },
  cleansing_spring: { m: 'fountain', bg: 'frost' },
  upgrade_shrine: { m: 'anvil', bg: 'fire' },
  transmogrifier: { m: 'vortex', bg: 'void' },
  mushrooms: { m: 'mushroom', bg: 'poison' },
  scrap_ooze: { m: 'slime', tint: '#8a8a7a' },
  wheel_of_fate: { m: 'wheel', bg: 'gold' },
  enchanter: { m: 'crystalBall', bg: 'void' },
  wandering_merchant: { m: 'backpack' },
  lost_traveler: { m: 'compass', bg: 'night' },
  shipwreck: { m: 'ship', v: 'wreck', bg: 'storm' },
  smuggler: { m: 'flag', tint: '#2a2a30', bg: 'night' },
  tide_pool: { m: 'shell', bg: 'frost' },
  honey_pot: { m: 'pot', bg: 'gold' },
  masked_bandits: { m: 'figures', v: 'crouch', bg: 'night' },
  knowing_skull: { m: 'skull', v: 'glow', bg: 'void' },
  duplicator: { m: 'mirror', bg: 'night' },
  forgotten_altar: { m: 'temple', tint: M.stone, bg: 'void' },
  library: { m: 'book', bg: 'gold' },
  mind_bloom: { m: 'rose', tint: '#e070b0', bg: 'void' },
  falling_star: { m: 'fallingStar', bg: 'night' },
  secret_portal: { m: 'blackHole', bg: 'void' },
  cursed_tome: { m: 'book', tint: '#7a1a1a', bg: 'blood' },
  vampires: { m: 'fang', bg: 'blood' },
};

export function eventArtSvg(id: string, glyph: string): string {
  const spec = EVENT_SPEC[id] ?? BY_GLYPH[glyph] ?? { m: 'sparkle' };
  const pal = PALS.colorless;
  const seed = hash('ev:' + id);
  const r = rand(seed);
  const motif = Mo[spec.m] as Mo.Motif;
  const body = motif({ pal, r: rand(seed ^ 0x9e37), color: 'colorless', tint: spec.tint, n: spec.n, v: spec.v });
  const S = 200;
  const subj = place(body, S / 2, S / 2 + 6, 1.45 * (spec.s ?? 1), spec.rot ?? 0);
  return doc(S, S, background(pal, 'skill', spec, r, S, S) + `<ellipse cx="${S / 2}" cy="${S - 22}" rx="80" ry="12" fill="${INK}" opacity="0.3"/>` + `<g filter="url(#paint)">${subj}</g>` + vignette(S, S, 0.9) + grain(S, S, 0.45), seed % 97);
}

const evCache = memo((id: string, glyph: string) => eventArtSvg(id, glyph));

export function eventArtUrl(id: string, glyph: string): string {
  return evCache(id, glyph);
}
