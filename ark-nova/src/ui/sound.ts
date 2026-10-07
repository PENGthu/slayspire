// 合成音效（Web Audio，无需音频文件）。设置里可以关闭。
import { state } from './store';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!state.settings.sound) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.08, slide = 0) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + start;
  const o = c.createOscillator();
  const gn = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export type Sfx = 'click' | 'build' | 'animal' | 'appeal' | 'cp' | 'coin' | 'card' | 'error' | 'end';

export function sfx(kind: Sfx) {
  switch (kind) {
    case 'click':
      tone(520, 0, 0.06, 'triangle', 0.04);
      break;
    case 'card':
      tone(700, 0, 0.05, 'triangle', 0.04);
      tone(900, 0.04, 0.06, 'triangle', 0.035);
      break;
    case 'build':
      tone(180, 0, 0.09, 'square', 0.035);
      tone(140, 0.08, 0.1, 'square', 0.03);
      break;
    case 'animal':
      tone(392, 0, 0.12, 'triangle', 0.06);
      tone(523, 0.09, 0.12, 'triangle', 0.06);
      tone(659, 0.18, 0.2, 'triangle', 0.06);
      break;
    case 'appeal':
      tone(660, 0, 0.12, 'sine', 0.05);
      tone(880, 0.08, 0.16, 'sine', 0.05);
      break;
    case 'cp':
      tone(523, 0, 0.14, 'sine', 0.06);
      tone(784, 0.1, 0.14, 'sine', 0.06);
      tone(1047, 0.2, 0.26, 'sine', 0.06);
      break;
    case 'coin':
      tone(988, 0, 0.07, 'square', 0.025);
      tone(1319, 0.06, 0.12, 'square', 0.025);
      break;
    case 'error':
      tone(160, 0, 0.16, 'sawtooth', 0.03, 0.7);
      break;
    case 'end':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.06));
      break;
  }
}
