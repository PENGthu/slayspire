import { state } from './store';

/**
 * 合成音效：全部用 WebAudio 现场合成，不依赖任何音频文件。
 *
 * 所有声音经过一条总线（音量 → 压缩器 → 输出），音量由设置里的滑块控制。
 * 浏览器要求在用户的点击里启动音频，所以第一次按下时才创建 AudioContext（见 installSound）。
 */
let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let musicOut: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const unlockHooks: (() => void)[] = [];

function volume(): number {
  const v = state.profile.settings.volume;
  return typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.7;
}

/**
 * 共用的 AudioContext：音效或背景音乐有一个开着就创建。
 * 音效走「音量 → 压缩器 → 输出」，背景音乐有自己的音量总线（见 music.ts）。
 */
export function audioCtx(): AudioContext | null {
  const st = state.profile.settings;
  if (!st.sound && !st.music) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 12;
      comp.ratio.value = 5;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      bus = ctx.createGain();
      bus.connect(comp).connect(ctx.destination);
      musicOut = ctx.createGain();
      musicOut.gain.value = 0;
      musicOut.connect(ctx.destination);
      // 一段 2 秒的白噪声，所有噪声类音效共用
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended' && !document.hidden) void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** 背景音乐的总线（音量由 music.ts 控制） */
export function musicBus(): GainNode | null {
  return audioCtx() ? musicOut : null;
}

/** 音频第一次可用时（用户第一次点击）通知背景音乐开始播放 */
export function onAudioUnlock(fn: () => void) {
  unlockHooks.push(fn);
}

function ac(): AudioContext | null {
  if (!state.profile.settings.sound || volume() <= 0) return null;
  const c = audioCtx();
  if (c) bus!.gain.value = volume() * 0.9;
  return c;
}

// ------------------------------------------------------------------ 基本音色

interface ToneOpts {
  type?: OscillatorType;
  /** 起始频率 */
  f: number;
  /** 结束频率（滑音） */
  to?: number;
  /** 开始时间（秒，相对现在） */
  t?: number;
  dur: number;
  vol: number;
  attack?: number;
  /** 低通滤波 */
  lp?: number;
  /** 颤音：频率（Hz）与幅度（音分） */
  vib?: [number, number];
}

function tone(c: AudioContext, o: ToneOpts) {
  const t0 = c.currentTime + (o.t ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.dur);
  const atk = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.vol, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  let node: AudioNode = osc;
  if (o.lp) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.lp;
    node = node.connect(f);
  }
  if (o.vib) {
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = o.vib[0];
    lg.gain.value = o.vib[1];
    lfo.connect(lg).connect(osc.detune);
    lfo.start(t0);
    lfo.stop(t0 + o.dur + 0.05);
  }
  node.connect(g).connect(bus!);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
}

interface NoiseOpts {
  t?: number;
  dur: number;
  vol: number;
  /** 滤波器类型与频率；to 为扫频终点 */
  filter?: BiquadFilterType;
  f?: number;
  to?: number;
  q?: number;
  attack?: number;
}

function noise(c: AudioContext, o: NoiseOpts) {
  const t0 = c.currentTime + (o.t ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = o.filter ?? 'bandpass';
  f.frequency.setValueAtTime(o.f ?? 1500, t0);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
  f.Q.value = o.q ?? 1;
  const g = c.createGain();
  const atk = o.attack ?? 0.003;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.vol, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  src.connect(f).connect(g).connect(bus!);
  // 每次从噪声里随机一段开始，听起来不会完全一样
  src.start(t0, Math.random() * 1.5, o.dur + 0.05);
}

/** 金属声：调频合成（盾、铁砧、硬币） */
function metal(c: AudioContext, f: number, ratio: number, index: number, t: number, dur: number, vol: number) {
  const t0 = c.currentTime + t;
  const car = c.createOscillator();
  const mod = c.createOscillator();
  const mg = c.createGain();
  const g = c.createGain();
  car.frequency.value = f;
  mod.frequency.value = f * ratio;
  mg.gain.setValueAtTime(f * index, t0);
  mg.gain.exponentialRampToValueAtTime(f * 0.05, t0 + dur);
  mod.connect(mg).connect(car.frequency);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  car.connect(g).connect(bus!);
  car.start(t0);
  mod.start(t0);
  car.stop(t0 + dur + 0.05);
  mod.stop(t0 + dur + 0.05);
}

/** 铃声：基音加两个泛音，快速起音、缓慢衰减 */
function bell(c: AudioContext, f: number, t: number, dur: number, vol: number) {
  tone(c, { f, t, dur, vol, attack: 0.003 });
  tone(c, { f: f * 2.01, t, dur: dur * 0.6, vol: vol * 0.35, attack: 0.003 });
  tone(c, { f: f * 3.98, t, dur: dur * 0.3, vol: vol * 0.12, attack: 0.002 });
}

/** 打击：低频下滑的“咚” */
function thump(c: AudioContext, f: number, t: number, dur: number, vol: number) {
  tone(c, { f, to: f * 0.4, t, dur, vol, attack: 0.002 });
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// ------------------------------------------------------------------ 音效表

const RECIPES = {
  // ---------- 界面
  click: (c: AudioContext) => {
    tone(c, { type: 'triangle', f: 620, to: 480, dur: 0.05, vol: 0.05 });
    noise(c, { dur: 0.025, vol: 0.05, f: 2600, q: 2 });
  },
  hover: (c: AudioContext) => noise(c, { dur: 0.03, vol: 0.07, f: rnd(4200, 5200), q: 3 }),
  select: (c: AudioContext) => {
    tone(c, { type: 'triangle', f: 660, dur: 0.08, vol: 0.05 });
    tone(c, { type: 'triangle', f: 990, t: 0.05, dur: 0.1, vol: 0.045 });
  },
  deny: (c: AudioContext) => {
    tone(c, { type: 'square', f: 190, to: 150, dur: 0.09, vol: 0.05, lp: 900 });
    tone(c, { type: 'square', f: 170, to: 130, t: 0.1, dur: 0.12, vol: 0.05, lp: 900 });
  },
  open: (c: AudioContext) => noise(c, { dur: 0.16, vol: 0.14, f: 900, to: 3200, q: 1.2, attack: 0.04 }),
  close: (c: AudioContext) => noise(c, { dur: 0.14, vol: 0.12, f: 2800, to: 800, q: 1.2, attack: 0.02 }),
  step: (c: AudioContext) => {
    thump(c, 170, 0, 0.12, 0.12);
    noise(c, { dur: 0.06, vol: 0.06, filter: 'lowpass', f: 700 });
  },
  // ---------- 卡牌
  draw: (c: AudioContext) => noise(c, { dur: 0.06, vol: 0.14, f: rnd(2800, 3800), to: 5200, q: 2.5 }),
  shuffle: (c: AudioContext) => {
    for (let i = 0; i < 9; i++) noise(c, { t: i * 0.035 + rnd(0, 0.01), dur: 0.04, vol: 0.11, f: rnd(2500, 4500), q: 2 });
  },
  cardAttack: (c: AudioContext) => {
    noise(c, { dur: 0.2, vol: 0.3, f: 700, to: 3400, q: 1.5, attack: 0.03 });
    tone(c, { type: 'sawtooth', f: 260, to: 120, dur: 0.12, vol: 0.025, lp: 1200 });
  },
  cardSkill: (c: AudioContext) => {
    noise(c, { dur: 0.16, vol: 0.12, f: 4500, q: 1, attack: 0.02 });
    tone(c, { f: 740, to: 1100, dur: 0.18, vol: 0.05, attack: 0.02 });
  },
  cardPower: (c: AudioContext) => {
    tone(c, { type: 'sawtooth', f: 110, to: 220, dur: 0.5, vol: 0.06, lp: 700, attack: 0.08 });
    tone(c, { f: 440, to: 880, dur: 0.45, vol: 0.05, attack: 0.1 });
    noise(c, { dur: 0.45, vol: 0.05, f: 600, to: 2600, q: 1, attack: 0.2 });
    bell(c, 1319, 0.32, 0.5, 0.035);
  },
  exhaust: (c: AudioContext) => {
    noise(c, { dur: 0.35, vol: 0.18, f: 1800, to: 500, q: 0.8, attack: 0.03 });
    for (let i = 0; i < 6; i++) noise(c, { t: rnd(0, 0.3), dur: 0.02, vol: 0.06, f: rnd(2000, 5000), q: 4 });
  },
  upgrade: (c: AudioContext) => {
    [784, 988, 1319].forEach((f, i) => bell(c, f, i * 0.07, 0.4, 0.05));
  },
  reveal: (c: AudioContext) => {
    noise(c, { dur: 0.25, vol: 0.05, f: 3000, to: 6000, q: 1, attack: 0.08 });
    bell(c, 880, 0.05, 0.4, 0.045);
    bell(c, 1320, 0.12, 0.4, 0.035);
  },
  cardGet: (c: AudioContext) => {
    noise(c, { dur: 0.12, vol: 0.06, f: 3500, to: 1200, q: 1.5 });
    thump(c, 220, 0.06, 0.1, 0.07);
  },
  burn: (c: AudioContext) => {
    noise(c, { dur: 0.6, vol: 0.2, f: 600, to: 2400, q: 0.7, attack: 0.08 });
    for (let i = 0; i < 9; i++) noise(c, { t: rnd(0, 0.55), dur: 0.02, vol: 0.06, f: rnd(1800, 5000), q: 5 });
  },
  // ---------- 战斗
  hit: (c: AudioContext) => {
    thump(c, rnd(130, 160), 0, 0.14, 0.22);
    noise(c, { dur: 0.09, vol: 0.12, filter: 'lowpass', f: 2200 });
    noise(c, { dur: 0.03, vol: 0.06, filter: 'highpass', f: 3500 });
  },
  hitHeavy: (c: AudioContext) => {
    thump(c, rnd(90, 110), 0, 0.3, 0.32);
    noise(c, { dur: 0.22, vol: 0.18, filter: 'lowpass', f: 1300, to: 300 });
    noise(c, { dur: 0.05, vol: 0.1, filter: 'highpass', f: 2500 });
  },
  hurt: (c: AudioContext) => {
    thump(c, 110, 0, 0.22, 0.28);
    noise(c, { dur: 0.14, vol: 0.12, filter: 'lowpass', f: 1500 });
    tone(c, { type: 'sawtooth', f: 180, to: 95, dur: 0.22, vol: 0.05, lp: 700 });
  },
  block: (c: AudioContext) => {
    metal(c, 520, 1.41, 3, 0, 0.28, 0.07);
    noise(c, { dur: 0.04, vol: 0.06, filter: 'highpass', f: 4000 });
  },
  blocked: (c: AudioContext) => {
    metal(c, 380, 1.5, 2.5, 0, 0.2, 0.08);
    thump(c, 200, 0, 0.08, 0.08);
  },
  buff: (c: AudioContext) => {
    [523, 659, 784].forEach((f, i) => tone(c, { type: 'triangle', f, t: i * 0.05, dur: 0.16, vol: 0.05 }));
    noise(c, { dur: 0.2, vol: 0.03, f: 5000, q: 1, attack: 0.05 });
  },
  debuff: (c: AudioContext) => {
    tone(c, { type: 'sawtooth', f: 420, to: 190, dur: 0.3, vol: 0.045, lp: 1100, vib: [9, 40] });
    tone(c, { f: 300, to: 150, dur: 0.3, vol: 0.04, vib: [7, 30] });
  },
  heal: (c: AudioContext) => {
    [880, 1175, 1568].forEach((f, i) => bell(c, f, i * 0.07, 0.45, 0.04));
  },
  die: (c: AudioContext) => {
    noise(c, { dur: 0.7, vol: 0.12, filter: 'lowpass', f: 1600, to: 150, attack: 0.01 });
    tone(c, { type: 'sawtooth', f: 200, to: 45, dur: 0.6, vol: 0.06, lp: 600 });
    for (let i = 0; i < 6; i++) noise(c, { t: 0.15 + rnd(0, 0.4), dur: 0.04, vol: 0.05, filter: 'lowpass', f: rnd(400, 1200) });
  },
  bossDie: (c: AudioContext) => {
    thump(c, 70, 0, 0.9, 0.35);
    noise(c, { dur: 1.4, vol: 0.16, filter: 'lowpass', f: 2000, to: 100, attack: 0.01 });
    tone(c, { type: 'sawtooth', f: 160, to: 30, dur: 1.2, vol: 0.07, lp: 500 });
    [392, 311, 262].forEach((f, i) => tone(c, { type: 'triangle', f, t: 0.5 + i * 0.25, dur: 0.6, vol: 0.04 }));
  },
  turn: (c: AudioContext) => {
    tone(c, { type: 'triangle', f: 392, dur: 0.3, vol: 0.05, attack: 0.02 });
    tone(c, { type: 'triangle', f: 523, t: 0.09, dur: 0.35, vol: 0.05, attack: 0.02 });
    tone(c, { f: 784, t: 0.09, dur: 0.35, vol: 0.02, attack: 0.03 });
  },
  enemyTurn: (c: AudioContext) => {
    thump(c, 75, 0, 0.35, 0.22);
    thump(c, 70, 0.18, 0.35, 0.18);
    noise(c, { dur: 0.25, vol: 0.05, filter: 'lowpass', f: 300 });
  },
  swing: (c: AudioContext) => noise(c, { dur: 0.14, vol: 0.24, f: 500, to: 2200, q: 1.8, attack: 0.02 }),
  endTurn: (c: AudioContext) => noise(c, { dur: 0.22, vol: 0.18, f: 2600, to: 600, q: 1.2, attack: 0.02 }),
  potion: (c: AudioContext) => {
    tone(c, { f: 500, to: 1300, dur: 0.05, vol: 0.08 });
    noise(c, { dur: 0.03, vol: 0.06, filter: 'highpass', f: 2000 });
    for (let i = 0; i < 3; i++) tone(c, { f: rnd(260, 340), to: rnd(180, 220), t: 0.1 + i * 0.09, dur: 0.08, vol: 0.06 });
  },
  orb: (c: AudioContext) => {
    tone(c, { type: 'sawtooth', f: 220, to: 330, dur: 0.25, vol: 0.035, lp: 1500, attack: 0.03 });
    bell(c, 990, 0.08, 0.3, 0.03);
  },
  evoke: (c: AudioContext) => {
    tone(c, { type: 'square', f: 1400, to: 180, dur: 0.22, vol: 0.04, lp: 3000 });
    noise(c, { dur: 0.15, vol: 0.06, filter: 'highpass', f: 2500 });
  },
  stars: (c: AudioContext) => [1568, 2093].forEach((f, i) => bell(c, f, i * 0.06, 0.3, 0.03)),
  compact: (c: AudioContext) => {
    tone(c, { type: 'square', f: 300, to: 1200, dur: 0.2, vol: 0.03, lp: 2500 });
    [659, 880, 1319].forEach((f, i) => bell(c, f, 0.15 + i * 0.06, 0.35, 0.04));
  },
  summon: (c: AudioContext) => {
    noise(c, { dur: 0.6, vol: 0.07, f: 400, to: 2400, q: 3, attack: 0.25 });
    tone(c, { f: 220, to: 440, dur: 0.55, vol: 0.05, attack: 0.2, vib: [6, 25] });
  },
  escape: (c: AudioContext) => noise(c, { dur: 0.35, vol: 0.2, f: 1200, to: 4000, q: 1, attack: 0.05 }),
  // ---------- 敌人的预备动作
  windup: (c: AudioContext) => {
    tone(c, { type: 'sawtooth', f: 85, to: 70, dur: 0.32, vol: 0.06, lp: 380, attack: 0.06, vib: [22, 60] });
    noise(c, { dur: 0.25, vol: 0.05, filter: 'lowpass', f: 500, attack: 0.08 });
  },
  shieldUp: (c: AudioContext) => {
    metal(c, 440, 2, 1.5, 0, 0.45, 0.05);
    noise(c, { dur: 0.3, vol: 0.04, f: 1500, to: 4000, q: 2, attack: 0.1 });
  },
  powerUp: (c: AudioContext) => {
    tone(c, { type: 'sawtooth', f: 140, to: 420, dur: 0.45, vol: 0.06, lp: 1600, attack: 0.1 });
    noise(c, { dur: 0.4, vol: 0.05, f: 500, to: 2500, q: 2, attack: 0.2 });
  },
  hex: (c: AudioContext) => {
    tone(c, { f: 330, to: 220, dur: 0.5, vol: 0.05, attack: 0.08, vib: [5, 50] });
    tone(c, { f: 337, to: 226, dur: 0.5, vol: 0.04, attack: 0.08 });
    noise(c, { dur: 0.45, vol: 0.04, f: 2500, to: 900, q: 6, attack: 0.15 });
  },
  bolt: (c: AudioContext) => noise(c, { dur: 0.3, vol: 0.22, f: 1200, to: 3500, q: 4, attack: 0.05 }),
  snore: (c: AudioContext) => noise(c, { dur: 0.7, vol: 0.2, filter: 'lowpass', f: 380, to: 220, attack: 0.3 }),
  stunned: (c: AudioContext) => [1568, 1760, 1568, 1760].forEach((f, i) => tone(c, { type: 'triangle', f, t: i * 0.07, dur: 0.07, vol: 0.03 })),
  // ---------- 收获与房间
  coin: (c: AudioContext) => {
    const f = rnd(1900, 2400);
    metal(c, f, 1.5, 0.6, 0, 0.12, 0.06);
    tone(c, { type: 'triangle', f: f * 1.33, t: 0.035, dur: 0.12, vol: 0.04 });
  },
  gold: (c: AudioContext) => {
    for (let i = 0; i < 3; i++) {
      const f = rnd(1900, 2500);
      metal(c, f, 1.5, 0.6, i * 0.06, 0.12, 0.055);
    }
  },
  relic: (c: AudioContext) => {
    [784, 988, 1175, 1568].forEach((f, i) => bell(c, f, i * 0.06, 0.6, 0.045));
    noise(c, { dur: 0.4, vol: 0.03, filter: 'highpass', f: 6000, attack: 0.05 });
  },
  potionGet: (c: AudioContext) => {
    bell(c, 2200, 0, 0.18, 0.04);
    bell(c, 2900, 0.04, 0.15, 0.03);
    tone(c, { f: 320, to: 210, t: 0.08, dur: 0.08, vol: 0.05 });
  },
  buy: (c: AudioContext) => {
    metal(c, 2100, 1.5, 0.6, 0, 0.12, 0.035);
    metal(c, 2500, 1.5, 0.6, 0.06, 0.12, 0.035);
    bell(c, 1568, 0.14, 0.5, 0.05);
  },
  chestShake: (c: AudioContext) => {
    for (let i = 0; i < 4; i++) noise(c, { t: i * 0.08, dur: 0.06, vol: 0.26, f: rnd(500, 800), q: 2 });
  },
  chestOpen: (c: AudioContext) => {
    tone(c, { type: 'sawtooth', f: 180, to: 120, dur: 0.25, vol: 0.04, lp: 700, vib: [30, 80] });
    thump(c, 140, 0.22, 0.15, 0.12);
    [659, 880, 1047, 1319].forEach((f, i) => bell(c, f, 0.28 + i * 0.06, 0.5, 0.04));
  },
  rest: (c: AudioContext) => {
    noise(c, { dur: 1.1, vol: 0.1, filter: 'lowpass', f: 900, attack: 0.3 });
    for (let i = 0; i < 10; i++) noise(c, { t: rnd(0, 1), dur: 0.02, vol: 0.06, f: rnd(1500, 4500), q: 5 });
    [262, 330, 392].forEach((f, i) => tone(c, { type: 'triangle', f, t: 0.1 + i * 0.12, dur: 0.9, vol: 0.03, attack: 0.15 }));
  },
  smith: (c: AudioContext) => {
    metal(c, 880, 2.76, 4, 0, 0.6, 0.08);
    metal(c, 880, 2.76, 4, 0.22, 0.6, 0.06);
    noise(c, { dur: 0.05, vol: 0.08, filter: 'highpass', f: 3000 });
    [988, 1319].forEach((f, i) => bell(c, f, 0.45 + i * 0.07, 0.4, 0.04));
  },
  achievement: (c: AudioContext) => {
    [523, 659, 784, 1047].forEach((f, i) => bell(c, f, i * 0.08, 0.6, 0.045));
  },
  // ---------- 场景
  victory: (c: AudioContext) => {
    [523, 659, 784].forEach((f, i) => tone(c, { type: 'triangle', f, t: i * 0.09, dur: 0.3, vol: 0.06 }));
    [523, 659, 784, 1047].forEach((f) => tone(c, { type: 'triangle', f, t: 0.3, dur: 0.8, vol: 0.035, attack: 0.02 }));
  },
  win: (c: AudioContext) => {
    [523, 659, 784, 1047].forEach((f, i) => tone(c, { type: 'triangle', f, t: i * 0.12, dur: 0.35, vol: 0.06 }));
    [523, 659, 784, 1047, 1319].forEach((f) => tone(c, { type: 'triangle', f, t: 0.5, dur: 1.4, vol: 0.03, attack: 0.03 }));
    bell(c, 2093, 0.5, 1, 0.03);
  },
  lose: (c: AudioContext) => {
    [392, 311, 262, 196].forEach((f, i) => tone(c, { type: 'triangle', f, t: i * 0.22, dur: 0.5, vol: 0.06, lp: 1500 }));
    thump(c, 60, 0.9, 0.8, 0.2);
  },
  bossIntro: (c: AudioContext) => {
    thump(c, 55, 0, 1, 0.3);
    thump(c, 55, 0.5, 1, 0.25);
    [110, 117, 165].forEach((f) => tone(c, { type: 'sawtooth', f, t: 0.1, dur: 1.6, vol: 0.03, lp: 500, attack: 0.4 }));
  },
} satisfies Record<string, (c: AudioContext) => void>;

export type Sfx = keyof typeof RECIPES;

/** 同一音效的最短间隔（毫秒）：连击、一串金币之类可以更密 */
const GAP: Partial<Record<Sfx, number>> = { swing: 60, coin: 25, draw: 45, hover: 60, hit: 55, hitHeavy: 70, lose: 4000, victory: 1500, win: 3000 };

let last: Partial<Record<Sfx, number>> = {};

/** 播放音效；delay 为延迟毫秒数（与动画对齐） */
export function sfx(name: Sfx, delay = 0) {
  const at = performance.now() + delay;
  if (Math.abs(at - (last[name] ?? -1e9)) < (GAP[name] ?? 40)) return;
  last[name] = at;
  (window as unknown as { __sfxLog?: string[] }).__sfxLog?.push(name);
  const c = ac();
  if (!c) return;
  if (delay > 0) {
    setTimeout(() => {
      const c2 = ac();
      if (c2) RECIPES[name](c2);
    }, delay);
  } else RECIPES[name](c);
}

/** 进入某个画面时的音效 */
export function sfxForScreen(s: string) {
  const run = state.run;
  if (s === 'gameover' && run?.screen.s === 'gameover') sfx(run.screen.win ? 'win' : 'lose');
  else if (s === 'shop') sfx('gold');
  else if (s === 'rest') sfx('rest');
  else if (s === 'map' || s === 'event' || s === 'ancient') sfx('open');
  else if (s === 'combat' && run?.combat?.boss) sfx('bossIntro');
  else if (s === 'combat') sfx('enemyTurn');
  return undefined;
}

/** 调试：把某个音效离线渲染出来（检查有没有声音、会不会爆音） */
export async function renderSfx(name: Sfx, seconds = 2.5): Promise<{ peak: number; rms: number; len: number }> {
  const OAC = window.OfflineAudioContext;
  const off = new OAC(1, Math.floor(44100 * seconds), 44100);
  const saved = { ctx, bus, noiseBuf };
  bus = off.createGain();
  bus.gain.value = 0.9;
  bus.connect(off.destination);
  noiseBuf = off.createBuffer(1, off.sampleRate * 2, off.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  try {
    RECIPES[name](off as unknown as AudioContext);
  } finally {
    ({ ctx, bus, noiseBuf } = saved);
  }
  const out = (await off.startRendering()).getChannelData(0);
  let peak = 0;
  let sum = 0;
  let lastLoud = 0;
  for (let i = 0; i < out.length; i++) {
    const v = Math.abs(out[i]);
    if (v > peak) peak = v;
    sum += v * v;
    if (v > 0.002) lastLoud = i;
  }
  return { peak, rms: Math.sqrt(sum / out.length), len: lastLoud / 44100 };
}

export const SFX_NAMES = Object.keys(RECIPES) as Sfx[];

export function resetSfx() {
  last = {};
}

/** 会发出点击声的元素（卡牌、遗物之类另有音效） */
const CLICKABLE = 'button, .event-opt, .rest-opt, .blessing, .char-card, .tab, [role="button"]';

let installed = false;

/** 第一次按下时启动音频；按钮统一发出轻微的点击声 */
export function installSound() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const unlock = () => {
    if (audioCtx()) for (const fn of unlockHooks) fn();
  };
  // 切到后台时暂停所有声音，回来再继续
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  });
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  window.addEventListener('keydown', unlock, { capture: true, passive: true });
  window.addEventListener(
    'click',
    (e) => {
      const t = (e.target as Element | null)?.closest?.(CLICKABLE) as HTMLButtonElement | null;
      if (t && !t.disabled && !t.closest('.potion-slot, .card')) sfx('click');
    },
    true,
  );
}
