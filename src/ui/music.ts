/**
 * 背景音乐：和音效一样全部用 WebAudio 现场合成，不依赖音频文件。
 *
 * 每首曲子是「和弦进行 + 若干声部的节奏型」，按小节生成：每小节用带种子的随机数挑选琶音走向、
 * 加花和旋律，所以循环起来不会一模一样。调度器提前约一秒把下一小节的音符排进 AudioContext 的时间线，
 * 主线程偶尔卡一下也不会断音。切换场景时新旧曲子交叉淡入淡出。
 *
 * 曲目：主菜单、地图（四个区域各自的调式与音色）、普通战斗、精英战、首领战、商店、篝火、事件、
 * 先古之民、失败。
 */
import { audioCtx, musicBus, onAudioUnlock } from './sound';
import { state } from './store';

// ------------------------------------------------------------------ 乐理

const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
} as const;
type Scale = readonly number[];

/** 音阶上第 d 级的音（d 可以超过 7 或为负，自动换八度） */
function deg(root: number, sc: Scale, d: number): number {
  const n = sc.length;
  const o = Math.floor(d / n);
  return root + o * 12 + sc[((d % n) + n) % n];
}

/** 以第 d 级为根音的三和弦 */
function triad(root: number, sc: Scale, d: number): number[] {
  return [deg(root, sc, d), deg(root, sc, d + 2), deg(root, sc, d + 4)];
}

/** 带种子的随机数 */
function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ 乐器

/** 一首曲子演奏时用到的输出：干声、混响送出，以及本小节的随机数 */
interface Out {
  c: BaseAudioContext;
  dry: AudioNode;
  wet: AudioNode;
  r: () => number;
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseOf(c: BaseAudioContext): AudioBuffer {
  let b = noiseCache.get(c);
  if (!b) {
    b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(c, b);
  }
  return b;
}

/** 生成混响（衰减的立体声噪声作为冲激响应） */
function makeReverb(c: BaseAudioContext, seconds = 2.2): ConvolverNode {
  const len = Math.floor(c.sampleRate * seconds);
  const ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
  }
  const conv = c.createConvolver();
  conv.buffer = ir;
  return conv;
}

/** 把一个声部接到干声与混响 */
function route(o: Out, node: AudioNode, wet: number) {
  node.connect(o.dry);
  if (wet > 0) {
    const s = o.c.createGain();
    s.gain.value = wet;
    node.connect(s).connect(o.wet);
  }
}

/** 包络：起音 a 秒升到 v，保持到 t+dur-rel，再 rel 秒释放 */
function envGain(o: Out, t: number, dur: number, v: number, a: number, rel: number): GainNode {
  const g = o.c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(v, t + a);
  g.gain.setValueAtTime(v, Math.max(t + a, t + dur - rel));
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  return g;
}

function osc(o: Out, type: OscillatorType, f: number, t: number, end: number, detune = 0): OscillatorNode {
  const n = o.c.createOscillator();
  n.type = type;
  n.frequency.setValueAtTime(f, t);
  n.detune.value = detune;
  n.start(t);
  n.stop(end + 0.05);
  return n;
}

/** 铺底和弦：每个音两只略微走音的锯齿波，低通滤掉毛刺，慢起慢收 */
function pad(o: Out, t: number, notes: number[], dur: number, v: number, cutoff = 1100, wet = 0.5, type: OscillatorType = 'sawtooth') {
  const f = o.c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  f.Q.value = 0.4;
  const g = envGain(o, t, dur, v, Math.min(0.8, dur * 0.3), Math.min(0.9, dur * 0.35));
  for (const n of notes) for (const d of [-8, 8]) osc(o, type, mtof(n), t, t + dur, d).connect(f);
  f.connect(g);
  route(o, g, wet);
}

/** 低音：三角波；长音再叠一个低八度的正弦 */
function bass(o: Out, t: number, n: number, dur: number, v: number) {
  const f = o.c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 520;
  const g = envGain(o, t, dur, v, 0.01, Math.min(0.15, dur * 0.4));
  osc(o, 'triangle', mtof(n), t, t + dur).connect(f);
  if (dur > 0.8) {
    const sub = osc(o, 'sine', mtof(n - 12), t, t + dur);
    const sg = o.c.createGain();
    sg.gain.value = 0.7;
    sub.connect(sg).connect(f);
  }
  f.connect(g);
  route(o, g, dur > 0.8 ? 0.05 : 0);
}

/** 拨弦（竖琴、鲁特琴）：三角波快速衰减，滤波从亮到暗 */
function pluck(o: Out, t: number, n: number, v: number, decay = 0.9, wet = 0.45, bright = 3200) {
  const f = o.c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(bright, t);
  f.frequency.exponentialRampToValueAtTime(500, t + decay);
  const g = o.c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  osc(o, 'triangle', mtof(n), t, t + decay).connect(f);
  f.connect(g);
  route(o, g, wet);
}

/** 铃：调频合成，长尾 */
function bell(o: Out, t: number, n: number, v: number, dur = 2.2, wet = 0.6) {
  const car = osc(o, 'sine', mtof(n), t, t + dur);
  const mod = osc(o, 'sine', mtof(n) * 3.5, t, t + dur);
  const mg = o.c.createGain();
  mg.gain.setValueAtTime(mtof(n) * 1.6, t);
  mg.gain.exponentialRampToValueAtTime(mtof(n) * 0.05, t + dur);
  mod.connect(mg).connect(car.frequency);
  const g = o.c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  car.connect(g);
  route(o, g, wet);
}

/** 短促的弦乐 / 铜管和弦：滤波快速闭合 */
function stab(o: Out, t: number, notes: number[], dur: number, v: number, open = 2600, wet = 0.3) {
  const f = o.c.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 2;
  f.frequency.setValueAtTime(open, t);
  f.frequency.exponentialRampToValueAtTime(400, t + dur);
  const g = o.c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  notes.forEach((n, k) => osc(o, 'sawtooth', mtof(n), t, t + dur, k % 2 ? 7 : -7).connect(f));
  f.connect(g);
  route(o, g, wet);
}

/** 合唱：锯齿波经过两个“啊”音的共振峰，带一点颤音 */
function choir(o: Out, t: number, notes: number[], dur: number, v: number) {
  const g = envGain(o, t, dur, v, Math.min(1, dur * 0.35), Math.min(1, dur * 0.35));
  const mix = o.c.createGain();
  for (const [fq, q, gain] of [
    [720, 7, 1],
    [1150, 8, 0.6],
  ] as const) {
    const bp = o.c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = fq;
    bp.Q.value = q;
    const bg = o.c.createGain();
    bg.gain.value = gain * 2.2;
    mix.connect(bp).connect(bg).connect(g);
  }
  const lfo = osc(o, 'sine', 5.2, t, t + dur);
  const lg = o.c.createGain();
  lg.gain.value = 12;
  lfo.connect(lg);
  notes.forEach((n, k) => {
    const s = osc(o, 'sawtooth', mtof(n), t, t + dur, k % 2 ? 9 : -9);
    lg.connect(s.detune);
    s.connect(mix);
  });
  route(o, g, 0.7);
}

/** 低沉的持续音 */
function drone(o: Out, t: number, n: number, dur: number, v: number) {
  const f = o.c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 260;
  const g = envGain(o, t, dur, v, Math.min(1.2, dur * 0.4), Math.min(1.2, dur * 0.4));
  osc(o, 'sawtooth', mtof(n), t, t + dur, -4).connect(f);
  osc(o, 'sine', mtof(n), t, t + dur, 4).connect(f);
  f.connect(g);
  route(o, g, 0.3);
}

function noiseHit(o: Out, t: number, dur: number, v: number, type: BiquadFilterType, fq: number, q = 1, wet = 0.15) {
  const src = o.c.createBufferSource();
  src.buffer = noiseOf(o.c);
  const f = o.c.createBiquadFilter();
  f.type = type;
  f.frequency.value = fq;
  f.Q.value = q;
  const g = o.c.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g);
  route(o, g, wet);
  src.start(t, Math.random() * 1.5, dur + 0.05);
}

function kick(o: Out, t: number, v: number) {
  const s = osc(o, 'sine', 150, t, t + 0.35);
  s.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  const g = o.c.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  s.connect(g);
  route(o, g, 0);
}

function snare(o: Out, t: number, v: number) {
  noiseHit(o, t, 0.16, v, 'bandpass', 1900, 0.8, 0.2);
  const s = osc(o, 'triangle', 190, t, t + 0.1);
  const g = o.c.createGain();
  g.gain.setValueAtTime(v * 0.6, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  s.connect(g);
  route(o, g, 0.1);
}

const hat = (o: Out, t: number, v: number, open = false) => noiseHit(o, t, open ? 0.18 : 0.045, v, 'highpass', 7200, 0.7, 0);

/** 定音鼓 / 战鼓 */
function tom(o: Out, t: number, n: number, v: number) {
  const s = osc(o, 'sine', mtof(n), t, t + 0.6);
  s.frequency.exponentialRampToValueAtTime(mtof(n) * 0.72, t + 0.5);
  const g = o.c.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  s.connect(g);
  route(o, g, 0.3);
  noiseHit(o, t, 0.12, v * 0.4, 'lowpass', 900, 0.7, 0.2);
}

/** 嗡嗡的锯齿短音（蜂巢） */
function buzz(o: Out, t: number, n: number, dur: number, v: number) {
  const f = o.c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = mtof(n) * 3;
  f.Q.value = 3;
  const g = o.c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc(o, 'sawtooth', mtof(n), t, t + dur).connect(f).connect(g);
  route(o, g, 0.2);
}

// ------------------------------------------------------------------ 曲目

interface Track {
  bpm: number;
  /** 演奏第 i 小节：t 为开始时间，b 为一拍的秒数 */
  bar(o: Out, i: number, t: number, b: number): void;
}

interface Key {
  root: number;
  sc: Scale;
  prog: number[];
}

/** 各区域的调式与和弦进行（地图与战斗共用，战斗时换成小调色彩更重的音阶） */
const ZONE_KEYS: Record<string, Key> = {
  overgrowth: { root: 50, sc: SCALES.dorian, prog: [0, 3, 0, 6] },
  underdocks: { root: 45, sc: SCALES.harmonic, prog: [0, 5, 3, 4] },
  hive: { root: 52, sc: SCALES.phrygian, prog: [0, 1, 0, 6] },
  glory: { root: 48, sc: SCALES.lydian, prog: [0, 1, 5, 4] },
};

/** 地图：琶音与铺底，每个区域加一点自己的音色 */
function mapTrack(zone: string): Track {
  const k = ZONE_KEYS[zone] ?? ZONE_KEYS.overgrowth;
  const bpm = { overgrowth: 76, underdocks: 70, hive: 84, glory: 72 }[zone] ?? 76;
  return {
    bpm,
    bar(o, i, t, b) {
      const d = k.prog[i % k.prog.length];
      const ch = triad(k.root + 12, k.sc, d);
      pad(o, t, ch, b * 4, 0.022, zone === 'glory' ? 1500 : 1000);
      bass(o, t, ch[0] - 12, b * 2, 0.11);
      bass(o, t + b * 2, (o.r() < 0.5 ? ch[0] : ch[2]) - 12, b * 2, 0.09);
      // 八分音符琶音，走向每小节随机
      const tones = [ch[0], ch[1], ch[2], ch[0] + 12, ch[1] + 12];
      const up = o.r() < 0.5;
      for (let s = 0; s < 8; s++) {
        if (o.r() > 0.78) continue;
        const idx = up ? s % tones.length : (tones.length - 1 - (s % tones.length));
        pluck(o, t + s * b * 0.5, tones[idx] + 12, 0.05, 0.9);
      }
      if (i % 4 === 0) bell(o, t, ch[2] + 24, 0.025);
      if (zone === 'underdocks') {
        // 滴水声
        for (let s = 0; s < 4; s++) if (o.r() < 0.3) bell(o, t + (s + o.r() * 0.5) * b, deg(k.root + 36, k.sc, Math.floor(o.r() * 7)), 0.018, 1.2, 0.8);
        if (i % 4 === 0) drone(o, t, k.root - 12, b * 16, 0.05);
      }
      if (zone === 'hive') for (let s = 0; s < 16; s++) if (s % 4 !== 3) buzz(o, t + s * b * 0.25, ch[0], b * 0.2, 0.012);
      if (zone === 'glory') {
        if (i % 2 === 0) tom(o, t, k.root - 12, 0.12);
        stab(o, t + b * 3, ch.map((n) => n + 12), b, 0.012, 1800, 0.5);
      }
      if (zone === 'overgrowth') hat(o, t + b * (1.5 + Math.floor(o.r() * 2)), 0.012);
    },
  };
}

/** 普通战斗与精英战：鼓组、八分音符低音、和弦短奏与间或出现的旋律 */
function combatTrack(zone: string, elite: boolean): Track {
  const base = ZONE_KEYS[zone] ?? ZONE_KEYS.overgrowth;
  // 战斗一律用小调色彩：大调式的区域换成和声小调
  const sc = base.sc === SCALES.lydian || base.sc === SCALES.major ? SCALES.harmonic : base.sc;
  const prog = [0, 5, 2, 6];
  return {
    bpm: elite ? 124 : 112,
    bar(o, i, t, b) {
      const d = prog[i % 4];
      const ch = triad(base.root, sc, d);
      // 鼓
      kick(o, t, 0.32);
      kick(o, t + b * 1.5, 0.22);
      kick(o, t + b * 2, 0.3);
      if (elite || i % 2 === 1) kick(o, t + b * 3.5, 0.2);
      snare(o, t + b, 0.11);
      snare(o, t + b * 3, 0.12);
      if (elite) snare(o, t + b * 3.75, 0.05);
      for (let s = 0; s < 8; s++) hat(o, t + s * b * 0.5, s % 2 ? 0.03 : 0.016);
      // 每 8 小节最后一拍用战鼓加花
      if (i % 8 === 7 || (elite && i % 4 === 3)) [3, 3.25, 3.5, 3.75].forEach((x, k2) => tom(o, t + b * x, base.root - 12 + [7, 5, 3, 0][k2], 0.16));
      // 八分音符低音
      const pat = [0, 0, 12, 0, 0, 7, 12, 7];
      for (let s = 0; s < 8; s++) bass(o, t + s * b * 0.5, ch[0] - 12 + pat[s], b * 0.42, 0.1);
      // 和弦短奏
      const hits = elite ? [0, 0.75, 1.5, 2.5, 3] : [0, 1.5, 2.5];
      for (const x of hits) stab(o, t + b * x, ch.map((n) => n + 12), b * 0.45, 0.016);
      // 旋律：每四小节的后两小节出现
      if (i % 4 >= 2) {
        const start = 7 + Math.floor(o.r() * 3);
        const shape = [0, 1, 2, 1, 0, -1, 0, 2];
        for (let s = 0; s < 8; s++) {
          if (o.r() < 0.25) continue;
          pluck(o, t + s * b * 0.5, deg(base.root + 12, sc, start + shape[s]), 0.045, 0.5, 0.35, 4200);
        }
      }
    },
  };
}

/** 首领战：四四拍底鼓、合唱、切分的铜管和弦、战鼓 */
function bossTrack(zone: string): Track {
  const base = ZONE_KEYS[zone] ?? ZONE_KEYS.overgrowth;
  const sc = SCALES.harmonic;
  const prog = [0, 5, 3, 4];
  return {
    bpm: 128,
    bar(o, i, t, b) {
      const d = prog[i % 4];
      const ch = triad(base.root, sc, d);
      for (let s = 0; s < 4; s++) kick(o, t + s * b, 0.3);
      kick(o, t + b * 3.5, 0.2);
      snare(o, t + b, 0.12);
      snare(o, t + b * 3, 0.13);
      for (let s = 0; s < 8; s++) hat(o, t + s * b * 0.5, s % 2 ? 0.03 : 0.014, s === 7);
      for (let s = 0; s < 8; s++) bass(o, t + s * b * 0.5, ch[0] - 12 + (s % 2 ? 12 : 0), b * 0.42, 0.11);
      choir(o, t, ch.map((n) => n + 12), b * 4, 0.022);
      const hits = i % 2 ? [0, 0.75, 1.5, 3] : [0, 1, 2.5, 3.25];
      for (const x of hits) stab(o, t + b * x, [ch[0], ch[1], ch[2], ch[0] + 12], b * 0.5, 0.02, 3000, 0.35);
      if (i % 4 === 3) for (let s = 0; s < 8; s++) tom(o, t + b * 2 + s * b * 0.25, base.root - 12 + (s % 2 ? 7 : 0), 0.12 + s * 0.01);
      if (i % 2 === 1) {
        const top = deg(base.root + 24, sc, d + 4);
        [0, 0.5, 1, 1.5, 2].forEach((x, k2) => bell(o, t + b * x, top - [0, 1, 3, 4, 7][k2], 0.022, 1.2, 0.4));
      }
    },
  };
}

/** 商店：轻快的摇摆节奏，行走低音，反拍的拨弦和弦 */
const shopTrack: Track = {
  bpm: 100,
  bar(o, i, t, b) {
    const root = 55;
    const sc = SCALES.major;
    const d = [0, 5, 3, 4][i % 4];
    const ch = triad(root, sc, d);
    const sw = (x: number) => (x % 1 === 0.5 ? x + 0.16 : x);
    [0, 1, 2, 3].forEach((x, k2) => bass(o, t + b * x, deg(root - 12, sc, d + [0, 2, 4, 5][k2]), b * 0.8, 0.09));
    for (const x of [0.5, 1.5, 2.5, 3.5]) for (const n of ch) pluck(o, t + b * sw(x), n + 12, 0.022, 0.35, 0.25, 2600);
    kick(o, t, 0.16);
    kick(o, t + b * 2, 0.14);
    for (let s = 0; s < 8; s++) hat(o, t + b * sw(s * 0.5), 0.012);
    const pent = [0, 2, 4, 7, 9];
    for (let s = 0; s < 8; s++) if (o.r() < 0.35) bell(o, t + b * sw(s * 0.5), root + 24 + pent[Math.floor(o.r() * 5)], 0.018, 0.9, 0.4);
  },
};

/** 篝火：慢速、温暖的铺底和缓慢的拨弦 */
const restTrack: Track = {
  bpm: 58,
  bar(o, i, t, b) {
    const root = 53;
    const sc = SCALES.major;
    const d = [0, 2, 3, 0][i % 4];
    const ch = triad(root, sc, d);
    pad(o, t, ch, b * 4, 0.02, 760, 0.5, 'triangle');
    bass(o, t, ch[0] - 12, b * 4, 0.07);
    const order = o.r() < 0.5 ? [0, 1, 2, 1] : [0, 2, 1, 2];
    order.forEach((k2, s) => pluck(o, t + s * b, ch[k2] + 12, 0.045, 1.6, 0.5, 2200));
    if (o.r() < 0.4) pluck(o, t + b * 3.5, ch[2] + 24, 0.025, 1.4, 0.6, 2400);
  },
};

/** 事件：神秘的铺底与随机的铃声 */
const eventTrack: Track = {
  bpm: 64,
  bar(o, i, t, b) {
    const root = 57;
    const sc = SCALES.minor;
    const d = [0, 5, 0, 3][i % 4];
    const ch = triad(root, sc, d);
    pad(o, t, [ch[0], ch[2], ch[0] + 14], b * 4, 0.02, 900, 0.6);
    if (i % 2 === 0) drone(o, t, root - 24, b * 8, 0.06);
    for (let s = 0; s < 4; s++) if (o.r() < 0.4) bell(o, t + (s + o.r() * 0.5) * b, deg(root + 24, sc, Math.floor(o.r() * 8)), 0.02, 2, 0.7);
  },
};

/** 先古之民：空灵的合唱与缓慢的琶音铃声 */
const ancientTrack: Track = {
  bpm: 56,
  bar(o, i, t, b) {
    const root = 52;
    const sc = SCALES.lydian;
    const d = [0, 1, 4, 0][i % 4];
    const ch = triad(root, sc, d);
    choir(o, t, ch.map((n) => n + 12), b * 4, 0.02);
    [0, 1, 2, 1].forEach((k2, s) => bell(o, t + s * b, ch[k2] + 24, 0.02, 2.4, 0.7));
    bass(o, t, ch[0] - 12, b * 4, 0.05);
  },
};

/** 主菜单：低沉的持续音、铺底与缓慢的竖琴 */
const menuTrack: Track = {
  bpm: 66,
  bar(o, i, t, b) {
    const root = 50;
    const sc = SCALES.minor;
    const d = [0, 5, 2, 6][i % 4];
    const ch = triad(root + 12, sc, d);
    if (i % 4 === 0) drone(o, t, root - 12, b * 16, 0.06);
    pad(o, t, ch, b * 4, 0.022, 950, 0.6);
    for (let s = 0; s < 8; s++) if (o.r() < 0.55) pluck(o, t + s * b * 0.5, [ch[0], ch[1], ch[2], ch[0] + 12][s % 4] + 12, 0.04, 1.2, 0.6);
    if (i % 2 === 0) bell(o, t, ch[2] + 24, 0.02, 2.6, 0.7);
  },
};

/** 失败：只剩铺底和几声低沉的铃 */
const gameoverTrack: Track = {
  bpm: 50,
  bar(o, i, t, b) {
    const root = 50;
    const sc = SCALES.minor;
    const d = [0, 5, 3, 0][i % 4];
    const ch = triad(root + 12, sc, d);
    pad(o, t, ch, b * 4, 0.032, 760, 0.7);
    if (i % 2 === 0) bell(o, t + b, ch[0], 0.035, 3, 0.8);
  },
};

function makeTrack(id: string): Track {
  const [kind, zone = 'overgrowth'] = id.split(':');
  switch (kind) {
    case 'combat':
      return combatTrack(zone, false);
    case 'elite':
      return combatTrack(zone, true);
    case 'boss':
      return bossTrack(zone);
    case 'map':
      return mapTrack(zone);
    case 'shop':
      return shopTrack;
    case 'rest':
      return restTrack;
    case 'event':
      return eventTrack;
    case 'ancient':
      return ancientTrack;
    case 'gameover':
      return gameoverTrack;
    default:
      return menuTrack;
  }
}

// ------------------------------------------------------------------ 播放

interface Playing {
  id: string;
  track: Track;
  /** 这首曲子自己的干声、混响送出，用来淡入淡出 */
  dry: GainNode;
  wet: GainNode;
  nextBar: number;
  bar: number;
  seed: number;
}

let playing: Playing | null = null;
let wanted = 'menu';
let reverb: ConvolverNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

const LOOKAHEAD = 1.0;
const FADE = 1.6;

function musicVolume(): number {
  const v = state.profile.settings.musicVolume;
  return typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.5;
}

function enabled(): boolean {
  return !!state.profile.settings.music && musicVolume() > 0;
}

function fadeOut(p: Playing, c: BaseAudioContext) {
  const now = c.currentTime;
  for (const g of [p.dry, p.wet]) {
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(0.0001, now + FADE);
  }
  setTimeout(() => {
    p.dry.disconnect();
    p.wet.disconnect();
  }, FADE * 1000 + 200);
}

function start(id: string) {
  const c = audioCtx();
  const out = musicBus();
  if (!c || !out) return;
  if (!reverb) {
    reverb = makeReverb(c);
    const rg = c.createGain();
    rg.gain.value = 0.55;
    reverb.connect(rg).connect(out);
  }
  if (playing) fadeOut(playing, c);
  const dry = c.createGain();
  const wet = c.createGain();
  const now = c.currentTime;
  for (const g of [dry, wet]) {
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(1, now + FADE);
  }
  dry.connect(out);
  wet.connect(reverb);
  playing = { id, track: makeTrack(id), dry, wet, nextBar: now + 0.15, bar: 0, seed: Math.floor(Math.random() * 1e6) };
}

function tick() {
  const c = audioCtx();
  const out = musicBus();
  if (!c || !out) return;
  // 音量跟随设置
  const target = enabled() ? musicVolume() * 0.85 : 0;
  if (Math.abs(out.gain.value - target) > 0.001) out.gain.setTargetAtTime(target, c.currentTime, 0.25);
  if (!enabled()) {
    if (playing) {
      fadeOut(playing, c);
      playing = null;
    }
    return;
  }
  if (c.state !== 'running') return;
  if (!playing || playing.id !== wanted) start(wanted);
  const p = playing;
  if (!p) return;
  const b = 60 / p.track.bpm;
  // 主线程卡得太久、错过了时间：从现在重新对齐
  if (p.nextBar < c.currentTime - 0.05) p.nextBar = c.currentTime + 0.05;
  while (p.nextBar < c.currentTime + LOOKAHEAD) {
    const o: Out = { c, dry: p.dry, wet: p.wet, r: rng(p.seed + p.bar * 7919) };
    try {
      p.track.bar(o, p.bar, p.nextBar, b);
    } catch {
      /* 某一小节出错就跳过 */
    }
    p.nextBar += b * 4;
    p.bar++;
  }
}

/** 切换到某首曲子（同一首则继续播放）。真正开始要等用户第一次点击之后。 */
export function setMusic(id: string) {
  wanted = id;
  if (timer) tick();
}

/** 根据当前画面选择曲目 */
export function musicFor(): string {
  const st = state;
  const run = st.run;
  if (st.view !== 'run' || !run) return 'menu';
  const sc = run.screen;
  const zone = run.zone;
  switch (sc.s) {
    case 'combat':
      return sc.kind === 'boss' ? `boss:${zone}` : sc.kind === 'elite' ? `elite:${zone}` : `combat:${zone}`;
    case 'shop':
      return 'shop';
    case 'rest':
      return 'rest';
    case 'event':
      return 'event';
    case 'ancient':
      return 'ancient';
    case 'gameover':
      return sc.win ? 'ancient' : 'gameover';
    default:
      return `map:${zone}`;
  }
}

let installed = false;

export function installMusic() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  onAudioUnlock(() => {
    if (!timer) timer = setInterval(tick, 150);
    tick();
  });
}

/** 调试：把一首曲子离线渲染若干小节（检查响度、有没有爆音） */
export async function renderMusic(id: string, bars = 8): Promise<{ peak: number; rms: number; seconds: number }> {
  const track = makeTrack(id);
  const b = 60 / track.bpm;
  const seconds = bars * b * 4 + 3;
  const off = new OfflineAudioContext(2, Math.floor(44100 * seconds), 44100);
  const out = off.createGain();
  out.gain.value = 0.85 * 0.5;
  out.connect(off.destination);
  const rv = makeReverb(off);
  const rg = off.createGain();
  rg.gain.value = 0.55;
  rv.connect(rg).connect(out);
  const dry = off.createGain();
  const wet = off.createGain();
  dry.connect(out);
  wet.connect(rv);
  for (let i = 0; i < bars; i++) track.bar({ c: off, dry, wet, r: rng(1234 + i * 7919) }, i, 0.05 + i * b * 4, b);
  const buf = await off.startRendering();
  let peak = 0;
  let sum = 0;
  let n = 0;
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) {
      const v = Math.abs(d[i]);
      if (v > peak) peak = v;
      sum += v * v;
      n++;
    }
  }
  return { peak, rms: Math.sqrt(sum / n), seconds };
}

/** 调试：当前在放哪首、放到第几小节 */
export function musicState(): { id: string | null; bar: number; wanted: string } {
  return { id: playing?.id ?? null, bar: playing?.bar ?? 0, wanted };
}

export const MUSIC_IDS = ['menu', 'map:overgrowth', 'map:underdocks', 'map:hive', 'map:glory', 'combat:overgrowth', 'combat:underdocks', 'combat:hive', 'combat:glory', 'elite:hive', 'boss:overgrowth', 'boss:glory', 'shop', 'rest', 'event', 'ancient', 'gameover'];
