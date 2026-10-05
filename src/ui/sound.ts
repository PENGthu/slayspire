import { state } from './store';

/** 极简 WebAudio 合成音效：不依赖任何音频文件 */
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (!state.profile.settings.sound) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur: number, vol: number, hp = 800, delay = 0) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0);
}

export type Sfx = 'card' | 'hit' | 'block' | 'buff' | 'debuff' | 'heal' | 'turn' | 'win' | 'lose' | 'gold' | 'click' | 'die';

let last: Record<string, number> = {};

export function sfx(name: Sfx) {
  const now = performance.now();
  if (now - (last[name] ?? 0) < 40) return;
  last[name] = now;
  switch (name) {
    case 'card':
      noise(0.12, 0.08, 2500);
      break;
    case 'hit':
      tone(140, 0.16, 'square', 0.08, -80);
      noise(0.1, 0.12, 600);
      break;
    case 'block':
      tone(880, 0.12, 'triangle', 0.06, 200);
      tone(1320, 0.1, 'triangle', 0.03, 0, 0.03);
      break;
    case 'buff':
      tone(520, 0.12, 'sine', 0.06, 300);
      break;
    case 'debuff':
      tone(300, 0.18, 'sawtooth', 0.04, -150);
      break;
    case 'heal':
      tone(660, 0.18, 'sine', 0.06, 220);
      break;
    case 'turn':
      tone(392, 0.16, 'triangle', 0.05);
      tone(523, 0.2, 'triangle', 0.05, 0, 0.08);
      break;
    case 'win':
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.06, 0, i * 0.1));
      break;
    case 'lose':
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, 'sine', 0.06, 0, i * 0.16));
      break;
    case 'gold':
      tone(1200, 0.08, 'square', 0.03);
      tone(1600, 0.1, 'square', 0.03, 0, 0.05);
      break;
    case 'die':
      tone(200, 0.4, 'sawtooth', 0.05, -150);
      break;
    case 'click':
      tone(700, 0.04, 'square', 0.02);
      break;
  }
}

export function sfxForScreen(s: string) {
  if (s === 'reward') sfx('win');
  if (s === 'gameover') sfx(state.run?.screen.s === 'gameover' && state.run.screen.win ? 'win' : 'lose');
  if (s === 'shop' || s === 'treasure') sfx('gold');
  return undefined;
}

export function resetSfx() {
  last = {};
}
