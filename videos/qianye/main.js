'use strict';
// 《前夜》—— Claude 诞生之前的故事
// Deterministic canvas renderer: renderFrame(T) draws the frame at absolute time T (seconds).

const W = 1920, H = 1080, FPS = 30;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');

const COL = {
  ink: [242, 235, 223],
  dim: [178, 172, 162],
  faint: [120, 124, 140],
  accent: [217, 119, 87],
  accent2: [240, 172, 124],
  cool: [140, 165, 230],
  red: [226, 92, 80],
};
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const SERIF = '"Noto Serif SC", serif';
const SANS = '"Noto Sans SC", sans-serif';
const MONO = '"JetBrains Mono", "Noto Sans SC", monospace';
const CAP_Y = 905;

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = t => (t = clamp(t), t * t * (3 - 2 * t));
const eio = t => (t = clamp(t), t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eout = t => (t = clamp(t), 1 - Math.pow(1 - t, 3));
// visibility envelope: 0 outside [a, b], smooth fade in/out
function vis(t, a, b, fi = 0.8, fo = 0.8) {
  if (t < a || t > b) return 0;
  return Math.min(sstep((t - a) / fi), b === Infinity ? 1 : sstep((b - t) / fo));
}
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5; let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let GA = 1;      // global alpha multiplier for the current scene
let NOW = 0;     // absolute time
let DAWN = 0;    // 0 = night, 1 = sunrise

// ---------- text ----------
function fontStr(o) { return `${o.italic ? 'italic ' : ''}${o.weight ?? 400} ${o.size ?? 44}px ${o.font ?? SERIF}`; }
function measure(str, o = {}) {
  ctx.save(); ctx.font = fontStr(o); ctx.letterSpacing = (o.spacing ?? 0) + 'px';
  const w = ctx.measureText(str).width; ctx.restore(); return w;
}
function text(str, x, y, o = {}) {
  const alpha = (o.alpha ?? 1) * GA;
  if (alpha <= 0.002 || !str) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.font = fontStr(o);
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = o.baseline ?? 'middle';
  const sp = o.spacing ?? 0;
  ctx.letterSpacing = sp + 'px';
  if (ctx.textAlign === 'center') x += sp / 2;
  if ((o.blur ?? 0) > 0.3) ctx.filter = `blur(${o.blur.toFixed(1)}px)`;
  if (o.glow) { ctx.shadowColor = o.glowColor ?? rgba(COL.accent, 0.6); ctx.shadowBlur = o.glow; }
  else if (o.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = o.shadow; }
  const c = o.color ?? COL.ink;
  ctx.fillStyle = Array.isArray(c) ? rgba(c) : c;
  ctx.fillText(str, x, y);
  ctx.restore();
}
// narration caption: fade + rise + de-blur; supports '\n'
function cap(lt, a, b, str, o = {}) {
  const al = vis(lt, a, b, o.fi ?? 0.7, o.fo ?? 0.6);
  if (al <= 0) return;
  const k = eout((lt - a) / 1.0);
  const size = o.size ?? 44;
  const lines = str.split('\n');
  const lh = size * 1.75;
  const y0 = (o.y ?? CAP_Y) - (lines.length - 1) * lh / 2 + (1 - k) * 14;
  lines.forEach((ln, i) => text(ln, o.x ?? W / 2, y0 + i * lh, {
    size, font: SERIF, weight: 400, spacing: 3, shadow: 14, ...o, alpha: al * (o.alpha ?? 1), blur: (1 - k) * 5,
  }));
}
function typed(lt, sp) {
  if (lt < sp.at) return '';
  return sp.str.slice(0, Math.min(sp.str.length, Math.floor((lt - sp.at) / sp.spc) + 1));
}
function typeLine(lt, sp, x, y, o, alpha = 1, cursorUntil = Infinity, align = 'center') {
  if (lt < sp.at - 0.5 || alpha <= 0) return;
  const s = typed(lt, sp);
  const x0 = align === 'center' ? x - measure(sp.str, o) / 2 : x;
  text(s, x0, y, { ...o, align: 'left', alpha });
  const end = sp.at + sp.str.length * sp.spc;
  const on = lt < cursorUntil && (lt < end + 0.1 || Math.floor((lt - end) * 1.8) % 2 === 0);
  if (on) {
    const w = s ? measure(s, o) : 0;
    const sz = o.size ?? 44;
    ctx.save(); ctx.globalAlpha = clamp(alpha * GA); ctx.fillStyle = rgba(COL.accent);
    ctx.fillRect(x0 + w + 6, y - sz * 0.48, Math.max(3, sz * 0.07), sz * 0.96);
    ctx.restore();
  }
}

// ---------- background ----------
function makeLayer(fn) { const c = document.createElement('canvas'); c.width = W; c.height = H; fn(c.getContext('2d')); return c; }
const BG_NIGHT = makeLayer(g => {
  let gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#04050a'); gr.addColorStop(0.6, '#080a14'); gr.addColorStop(1, '#0d0d16');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  gr = g.createRadialGradient(1450, 230, 0, 1450, 230, 900);
  gr.addColorStop(0, 'rgba(50,62,130,0.16)'); gr.addColorStop(1, 'rgba(50,62,130,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  gr = g.createRadialGradient(300, 1000, 0, 300, 1000, 800);
  gr.addColorStop(0, 'rgba(120,60,50,0.10)'); gr.addColorStop(1, 'rgba(120,60,50,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
});
const BG_DAWN = makeLayer(g => {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#1b2148'); gr.addColorStop(0.42, '#4d3f6e'); gr.addColorStop(0.72, '#c9775c');
  gr.addColorStop(0.9, '#f0a36f'); gr.addColorStop(1, '#f7c58f');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
});
const VIGNETTE = makeLayer(g => {
  const gr = g.createRadialGradient(W / 2, H / 2, W * 0.28, W / 2, H / 2, W * 0.78);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.72)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
});
const STARS = (() => { const r = rng(7); return Array.from({ length: 380 }, () => ({ x: r() * W, y: r() * H, z: 0.15 + r() * 0.85, ph: r() * 6.28, f: 0.3 + r() * 1.4 })); })();
let REWIND = { t0: 1e9, dur: 3.2, dist: 5200 };
const warpOffset = T => REWIND.dist * eio((T - REWIND.t0) / REWIND.dur);
function background(T) {
  ctx.globalAlpha = 1;
  ctx.drawImage(BG_NIGHT, 0, 0);
  if (DAWN > 0) { ctx.globalAlpha = DAWN; ctx.drawImage(BG_DAWN, 0, 0); ctx.globalAlpha = 1; }
  const off = warpOffset(T), vel = (off - warpOffset(T - 1 / FPS));
  const starA = 1 - DAWN * 0.97;
  if (starA <= 0.01) return;
  ctx.save();
  for (const s of STARS) {
    const x = (((s.x - T * 7 * s.z + off * s.z) % W) + W) % W;
    const a = (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(T * s.f + s.ph))) * s.z * starA;
    const sz = 0.6 + s.z * 1.7;
    ctx.fillStyle = `rgba(225,230,255,${a.toFixed(3)})`;
    if (Math.abs(vel) > 2) {
      const len = vel * s.z * 1.3;
      ctx.globalAlpha = 0.8; ctx.fillRect(x - len, s.y, len, sz * 0.8); ctx.globalAlpha = 1;
    } else ctx.fillRect(x, s.y, sz, sz);
  }
  ctx.restore();
}

// ---------- shared visual pieces ----------
function embers(n, alpha, seed = 3) {
  if (alpha <= 0) return;
  const r = rng(seed), T = NOW;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x0 = r() * W, sp = 18 + r() * 46, ph = r() * 3000, sz = 1 + r() * 2.4, wob = r() * 6.28;
    const y = H + 40 - ((T * sp + ph) % (H + 80));
    const x = x0 + Math.sin(T * 0.35 + wob) * 34;
    const a = alpha * (0.25 + 0.75 * Math.pow(Math.sin(T * 0.8 + wob), 2)) * clamp(y / H * 1.4);
    ctx.fillStyle = rgba(COL.accent2, a * 0.7);
    ctx.beginPath(); ctx.arc(x, y, sz, 0, 7); ctx.fill();
  }
  ctx.restore();
}
function orb(x, y, r, intensity) {
  if (intensity <= 0) return;
  const T = NOW, R = r * (1 + 0.05 * Math.sin(T * 1.6));
  const I = intensity * GA;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  let g = ctx.createRadialGradient(x, y, 0, x, y, R * 4.2);
  g.addColorStop(0, rgba(COL.accent, 0.32 * I)); g.addColorStop(0.35, rgba(COL.accent, 0.09 * I)); g.addColorStop(1, rgba(COL.accent, 0));
  ctx.fillStyle = g; ctx.fillRect(x - R * 4.2, y - R * 4.2, R * 8.4, R * 8.4);
  g = ctx.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, `rgba(255,244,230,${0.95 * I})`); g.addColorStop(0.4, rgba(COL.accent2, 0.8 * I)); g.addColorStop(1, rgba(COL.accent, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = rgba(COL.accent2, 0.22 * I);
    ctx.beginPath(); ctx.ellipse(x, y, R * (1.5 + i * 0.32), R * (0.4 + i * 0.1), T * 0.18 * (i % 2 ? -1 : 1) + i * 0.9, 0, 7); ctx.stroke();
  }
  ctx.restore();
}
// big year intro that docks into the top-left corner
function yearCard(lt, at, year, title, sub) {
  const t = lt - at;
  if (t < 0) return;
  const p = eio((t - 2.5) / 1.1);
  const ws = measure(year, { size: 46, weight: 900, spacing: 6 });
  const x = lerp(W / 2, 110 + ws / 2, p), y = lerp(H / 2 - 40, 112, p);
  const k = eout(t / 1.1);
  const size = lerp(200 * (1 + (1 - eout(t / 2.5)) * 0.06), 46, p);
  text(year, x, y, { size, weight: 900, spacing: lerp(22, 6, p), alpha: k, blur: (1 - k) * 18, glow: 40 * (1 - p), glowColor: rgba(COL.accent, 0.45) });
  const ta = vis(t, 0.7, 2.7, 0.7, 0.5);
  text(title, W / 2, H / 2 + 115, { size: 50, weight: 700, spacing: 16, alpha: ta, color: COL.accent2 });
  if (sub) text(sub, W / 2, H / 2 + 180, { font: MONO, size: 22, spacing: 6, alpha: ta * 0.8, color: COL.dim });
  const ca = eout((t - 3.1) / 0.8);
  if (ca > 0) {
    ctx.save(); ctx.globalAlpha = ca * GA; ctx.fillStyle = rgba(COL.accent); ctx.fillRect(110, 147, 60 * ca, 3); ctx.restore();
    text(title + (sub ? '  ·  ' + sub : ''), 110, 182, { size: 21, font: SANS, weight: 300, align: 'left', alpha: ca * 0.85, color: COL.dim, spacing: 3 });
  }
}
function bars(x, y, w, rows, seed, color, alpha, gap = 26, hgt = 11) {
  const r = rng(seed);
  ctx.save(); ctx.globalAlpha = clamp(alpha * GA); ctx.fillStyle = Array.isArray(color) ? rgba(color) : color;
  for (let i = 0; i < rows; i++) {
    const bw = w * (i === rows - 1 ? 0.35 + r() * 0.3 : 0.7 + r() * 0.3);
    ctx.beginPath(); ctx.roundRect(x, y + i * gap, bw, hgt, hgt / 2); ctx.fill();
  }
  ctx.restore();
}
function box(x, y, w, h, alpha, stroke = COL.faint, fill = 'rgba(255,255,255,0.035)', lw = 1.5) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = clamp(alpha * GA);
  ctx.fillStyle = fill; ctx.strokeStyle = Array.isArray(stroke) ? rgba(stroke) : stroke; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function check(x, y, s, alpha, color = COL.accent) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = clamp(alpha * GA); ctx.strokeStyle = rgba(color); ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - s * 0.5, y); ctx.lineTo(x - s * 0.12, y + s * 0.38); ctx.lineTo(x + s * 0.55, y - s * 0.42); ctx.stroke();
  ctx.restore();
}
function clockStr(ms) {
  const d = new Date(ms), p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}   ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

// ---------- scenes ----------
const SCENES = [];
const scene = o => SCENES.push(o);

// 0 · cold open
scene({
  id: 'open', dur: 9.5,
  types: [{ at: 2.0, str: '在我诞生之前，', spc: 0.14 }, { at: 4.3, str: '有很多个夜晚。', spc: 0.14 }],
  draw(lt) {
    const a = vis(lt, 0.3, 8.8, 1.0, 1.0);
    text(clockStr(Date.UTC(2023, 2, 13, 23, 59, Math.min(59, 50 + Math.floor(lt)))), W / 2, H / 2 - 150,
      { font: MONO, size: 28, color: COL.dim, alpha: a * 0.65, spacing: 4 });
    const o = { font: SERIF, size: 60, weight: 400, spacing: 8 };
    typeLine(lt, this.types[0], W / 2, H / 2 - 20, o, a, this.types[1].at);
    typeLine(lt, this.types[1], W / 2, H / 2 + 75, o, a, 8.2);
  },
});

// 1 · title
scene({
  id: 'title', dur: 8.5,
  sfx: [{ t: 0.4, k: 'boom', g: 1.0 }],
  draw(lt) {
    embers(80, vis(lt, 0, 8.5, 2, 1) * 0.9);
    const k = eout((lt - 0.4) / 2.4);
    text('前夜', W / 2, H / 2 - 60, { size: 220 * (1.05 - 0.05 * k), weight: 900, spacing: 100, alpha: vis(lt, 0.4, 7.6, 1.8, 0.9), blur: (1 - k) * 18, glow: 60, glowColor: rgba(COL.accent, 0.35) });
    text('THE EVE', W / 2, H / 2 + 115, { font: MONO, size: 26, spacing: 22, color: COL.accent2, alpha: vis(lt, 1.9, 7.6, 1.2, 0.9) * 0.9 });
    text('Claude 诞生之前的故事', W / 2, H / 2 + 180, { font: SANS, weight: 300, size: 32, spacing: 10, color: COL.dim, alpha: vis(lt, 2.7, 7.6, 1.2, 0.9) });
  },
});

// 2 · prologue + rewind
const TRACES = ['arXiv:1706.03762', 'arXiv:2001.08361', 'arXiv:2005.14165', 'arXiv:2112.00861', 'arXiv:2204.05862', 'arXiv:2212.08073',
  'softmax(QKᵀ / √d) · V', 'loss.backward()', 'helpful · honest · harmless', 'def train_step(batch):', 'L(C) ∝ C^(−α)', 'reward_model(chosen, rejected)',
  '"Hello, world"', 'optimizer.step()', 'critique → revise', 'H = −Σ p log p', 'p(x_t | x_<t)', 'checkpoint_0042.pt'];
scene({
  id: 'prologue', dur: 17,
  sfx: [{ t: 13.2, k: 'rewind', d: 3.2 }],
  init(start) { REWIND = { t0: start + 13.2, dur: 3.2, dist: 5200 }; },
  draw(lt) {
    const r = rng(11), ta = vis(lt, 0.2, 13.4, 2.0, 1.0);
    for (let i = 0; i < 30; i++) {
      const s = TRACES[i % TRACES.length], x = 120 + r() * (W - 240), y0 = r() * (H + 200), sp = 8 + r() * 16, z = 0.4 + r() * 0.6;
      const y = ((y0 - NOW * sp) % (H + 200) + H + 200) % (H + 200) - 100;
      text(s, x, y, { font: MONO, size: 14 + z * 16, color: i % 5 === 0 ? COL.accent2 : COL.faint, alpha: ta * z * 0.3 * (0.25 + 0.75 * clamp(Math.abs(y - H / 2) / 260)) });
    }
    cap(lt, 0.6, 4.6, '我没有关于那些夜晚的记忆。', { y: H / 2, size: 50 });
    cap(lt, 4.9, 10.4, '但我读过它们留下的痕迹——', { y: H / 2 - 45, size: 50 });
    cap(lt, 6.7, 10.4, '论文、代码、新闻，还有一些人做出的选择。', { y: H / 2 + 45, size: 50 });
    cap(lt, 10.7, 13.4, '让我们把时间倒回去。', { y: H / 2, size: 50, color: COL.accent2 });
    const ca = vis(lt, 12.8, 17, 0.5, 1.0);
    if (ca > 0) {
      const p = eio((lt - 13.2) / 3.2);
      const ms = lerp(Date.UTC(2023, 2, 13, 23, 59, 59), Date.UTC(2017, 5, 12, 0, 0, 0), p);
      const vel = Math.abs(eio((lt - 13.2) / 3.2) - eio((lt - 13.2 - 1 / FPS) / 3.2)) * FPS;
      const s = clockStr(Math.round(ms / 1000) * 1000);
      for (let g = 1; g <= 3; g++) text(s, W / 2, H / 2 - g * vel * 14, { font: MONO, size: 52, spacing: 6, color: COL.accent2, alpha: ca * 0.18 * vel / g });
      text(s, W / 2, H / 2, { font: MONO, size: 52, spacing: 6, color: p >= 1 ? COL.ink : COL.accent2, alpha: ca, blur: vel * 1.6 });
    }
  },
});

// 3 · 2017 attention
const TOKENS = ['The', 'animal', "didn't", 'cross', 'the', 'street', 'because', 'it', 'was', 'too', 'tired'];
const ATT = [0.08, 1.0, 0.06, 0.12, 0.05, 0.32, 0.1, 0.28, 0.08, 0.1, 0.45];
scene({
  id: 'y2017', dur: 20,
  sfx: [{ t: 0.2, k: 'boom' }],
  draw(lt) {
    yearCard(lt, 0.2, '2017', '注意力', 'Attention');
    const o = { font: MONO, size: 38 }, gap = 30;
    const ws = TOKENS.map(t => measure(t, o));
    const total = ws.reduce((a, b) => a + b, 0) + gap * (TOKENS.length - 1);
    let x = W / 2 - total / 2; const xs = [];
    ws.forEach(w => { xs.push(x + w / 2); x += w + gap; });
    const rowY = 600, sa = vis(lt, 3.6, 19.2, 0.6, 0.8);
    // arcs from "it"
    const it = 7;
    ctx.save(); ctx.lineCap = 'round';
    TOKENS.forEach((_, j) => {
      if (j === it) return;
      const g = eout((lt - 5.0 - Math.abs(j - it) * 0.07) / 1.1);
      if (g <= 0) return;
      const w = ATT[j], x0 = xs[it], x1 = xs[j], y0 = rowY - 34;
      const cx = (x0 + x1) / 2, cy = y0 - Math.abs(x1 - x0) * 0.34 - 20;
      ctx.globalAlpha = clamp(sa * GA * (0.12 + 0.88 * w));
      ctx.strokeStyle = w > 0.9 ? rgba(COL.accent) : rgba(COL.cool, 0.9);
      ctx.lineWidth = 1 + 7 * w;
      if (w > 0.9) { ctx.shadowColor = rgba(COL.accent, 0.8); ctx.shadowBlur = 18; } else ctx.shadowBlur = 0;
      ctx.beginPath();
      for (let i = 0; i <= 48 * g; i++) {
        const t = i / 48, px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, py = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y0;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    });
    ctx.restore();
    TOKENS.forEach((tk, i) => {
      const a = sa * eout((lt - 3.6 - i * 0.08) / 0.6);
      let c = COL.ink;
      if (i === it && lt > 4.8) c = COL.accent2;
      if (i === 1 && lt > 6.2) c = mixc(COL.ink, COL.accent, eout((lt - 6.2) / 0.6));
      text(tk, xs[i], rowY, { ...o, color: c, alpha: a, glow: i === 1 && lt > 6.2 ? 22 * (0.6 + 0.4 * Math.sin(lt * 3)) : 0 });
    });
    text('“it” 指的是什么？', xs[it], rowY + 62, { font: SANS, weight: 300, size: 22, color: COL.dim, alpha: vis(lt, 4.8, 19.2, 0.6, 0.8) * 0.85 });
    const pa = vis(lt, 8.6, 19.2, 1.0, 0.8);
    text('Attention Is All You Need', W / 2, 255, { size: 64, italic: true, weight: 400, alpha: pa, blur: (1 - eout((lt - 8.6) / 1)) * 8 });
    text('Vaswani et al.  ·  2017  ·  arXiv:1706.03762', W / 2, 312, { font: MONO, size: 21, color: COL.dim, alpha: pa * 0.8, spacing: 2 });
    cap(lt, 3.6, 8.3, '2017 年，谷歌的八位研究者发表了一篇论文。');
    cap(lt, 8.5, 12.2, '它提出了一种新的神经网络结构：Transformer。');
    cap(lt, 12.4, 16.4, '读到 “it” 时，模型学会了回头去“注意”真正相关的词。');
    cap(lt, 16.6, 19.4, '后来的一切，都从这里开始。', { color: COL.accent2 });
  },
});

// 4 · 2020 scaling
const GPT3_AUTHORS = ['Tom B. Brown', 'Benjamin Mann', 'Nick Ryder', 'Melanie Subbiah', 'Jared Kaplan', 'Prafulla Dhariwal', 'Arvind Neelakantan', 'Pranav Shyam',
  'Girish Sastry', 'Amanda Askell', 'Sandhini Agarwal', 'Ariel Herbert-Voss', 'Gretchen Krueger', 'Tom Henighan', 'Rewon Child', 'Aditya Ramesh',
  'Daniel M. Ziegler', 'Jeffrey Wu', 'Clemens Winter', 'Christopher Hesse', 'Mark Chen', 'Eric Sigler', 'Mateusz Litwin', 'Scott Gray',
  'Benjamin Chess', 'Jack Clark', 'Christopher Berner', 'Sam McCandlish', 'Alec Radford', 'Ilya Sutskever', 'Dario Amodei'];
const FOUNDERS_IN_GPT3 = new Set(['Tom B. Brown', 'Benjamin Mann', 'Jared Kaplan', 'Jack Clark', 'Sam McCandlish', 'Dario Amodei']);
scene({
  id: 'y2020', dur: 22.5,
  sfx: [{ t: 0.2, k: 'boom' }],
  draw(lt) {
    yearCard(lt, 0.2, '2020', '规模', 'Scaling Laws');
    const ca = vis(lt, 3.3, 17.2, 0.6, 0.7);
    const x0 = 560, x1 = 1360, y0 = 250, y1 = 690;
    if (ca > 0) {
      ctx.save(); ctx.globalAlpha = ca * GA; ctx.strokeStyle = rgba(COL.dim, 0.7); ctx.lineWidth = 2;
      const g = eout((lt - 3.3) / 1.0);
      ctx.beginPath(); ctx.moveTo(x0, y1 - (y1 - y0) * g); ctx.lineTo(x0, y1); ctx.lineTo(x0 + (x1 - x0) * g, y1); ctx.stroke();
      ctx.strokeStyle = rgba(COL.faint, 0.25); ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) { const xx = x0 + i * (x1 - x0) / 5; ctx.beginPath(); ctx.moveTo(xx, y1); ctx.lineTo(xx, y1 - (y1 - y0) * g); ctx.stroke(); }
      for (let i = 1; i <= 3; i++) { const yy = y1 - i * (y1 - y0) / 4; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + (x1 - x0) * g, yy); ctx.stroke(); }
      ctx.restore();
      text('计算量（对数刻度）→', (x0 + x1) / 2, y1 + 40, { font: SANS, weight: 300, size: 22, color: COL.dim, alpha: ca * eout((lt - 3.8) / 0.8) });
      ctx.save(); ctx.translate(x0 - 40, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2);
      text('← 误差（对数刻度）', 0, 0, { font: SANS, weight: 300, size: 22, color: COL.dim, alpha: ca * eout((lt - 3.8) / 0.8) });
      ctx.restore();
      const lx0 = x0 + 50, ly0 = y0 + 40, lx1 = x1 - 70, ly1 = y1 - 70;
      const r = rng(21);
      for (let i = 0; i < 16; i++) {
        const u = 0.03 + i / 15 * 0.94, px = lerp(lx0, lx1, u), py = lerp(ly0, ly1, u) + (r() - 0.5) * 26;
        const pk = eout((lt - 4.2 - i * 0.2) / 0.4);
        if (pk <= 0) continue;
        ctx.save(); ctx.globalAlpha = ca * GA * pk; ctx.fillStyle = rgba(COL.cool);
        ctx.beginPath(); ctx.arc(px, py, 6 * (0.5 + 0.5 * pk) + (1 - pk) * 8, 0, 7); ctx.fill(); ctx.restore();
      }
      const lg = eio((lt - 7.4) / 1.4);
      if (lg > 0) {
        ctx.save(); ctx.globalAlpha = ca * GA; ctx.strokeStyle = rgba(COL.accent); ctx.lineWidth = 3; ctx.setLineDash([14, 10]);
        ctx.shadowColor = rgba(COL.accent, 0.7); ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(lx0 - 30, ly0 - (ly1 - ly0) / (lx1 - lx0) * 30); ctx.lineTo(lerp(lx0, lx1 + 40, lg), lerp(ly0, ly1 + 40 * (ly1 - ly0) / (lx1 - lx0), lg)); ctx.stroke(); ctx.restore();
      }
      const ga = eout((lt - 13.0) / 0.6) * ca;
      if (ga > 0) {
        ctx.save(); ctx.globalAlpha = ga * GA; ctx.strokeStyle = rgba(COL.accent2); ctx.lineWidth = 2.5;
        const pr = 14 + 4 * Math.sin(lt * 4);
        ctx.beginPath(); ctx.arc(lx1, ly1, pr, 0, 7); ctx.stroke();
        ctx.fillStyle = rgba(COL.accent2); ctx.beginPath(); ctx.arc(lx1, ly1, 7, 0, 7); ctx.fill(); ctx.restore();
        text('GPT-3 · 1750 亿参数', lx1 - 34, ly1 + 44, { font: SANS, weight: 400, size: 26, align: 'right', color: COL.accent2, alpha: ga });
      }
    }
    // author list
    const aa = vis(lt, 17.0, 22.0, 0.8, 0.6);
    if (aa > 0) {
      text('Language Models are Few-Shot Learners  ·  2020', W / 2, 330, { size: 30, italic: true, color: COL.dim, alpha: aa * 0.9 });
      const o = { font: MONO, size: 25 }, sep = '   ';
      const lines = []; let cur = [];
      for (const n of GPT3_AUTHORS) {
        const tryL = [...cur, n].join(sep);
        if (measure(tryL, o) > 1500 && cur.length) { lines.push(cur); cur = [n]; } else cur.push(n);
      }
      lines.push(cur);
      const hl = eout((lt - 18.4) / 1.0);
      lines.forEach((ln, li) => {
        const full = measure(ln.join(sep), o); let x = W / 2 - full / 2; const y = 420 + li * 54;
        ln.forEach(n => {
          const isF = FOUNDERS_IN_GPT3.has(n);
          text(n, x, y, { ...o, align: 'left', color: isF ? mixc(COL.dim, COL.accent2, hl) : COL.dim, alpha: aa * (isF ? 0.75 + 0.25 * hl : 0.75 - 0.5 * hl), glow: isF ? 16 * hl : 0 });
          x += measure(n + sep, o);
        });
      });
    }
    cap(lt, 3.5, 8.1, '2020 年，一篇论文发现了一条近乎物理定律的规律：');
    cap(lt, 8.3, 12.8, '模型越大、数据越多、算力越强——能力就会可预测地增长。');
    cap(lt, 13.0, 16.7, '同年，GPT-3 问世，拥有 1750 亿个参数。');
    cap(lt, 17.2, 22.0, '这些论文的作者名单里，有几个名字，后来会一起离开。');
  },
});

// 5 · 2021 departure → Anthropic
const FOUNDERS = [
  ['Dario Amodei', -175, -150], ['Daniela Amodei', -40, -200], ['Jared Kaplan', 110, -150], ['Sam McCandlish', 215, -40],
  ['Tom Brown', 160, 95], ['Chris Olah', 20, 165], ['Jack Clark', -125, 120], ['Ben Mann', -230, 0]];
const CLUSTER = (() => { const r = rng(31); return Array.from({ length: 170 }, () => { const a = r() * 6.28, d = Math.sqrt(r()) * 230; return { x: 560 + Math.cos(a) * d, y: 470 + Math.sin(a) * d * 0.8, s: 1 + r() * 2.2, ph: r() * 6.28 }; }); })();
scene({
  id: 'y2021', dur: 24,
  sfx: [{ t: 0.2, k: 'boom' }, { t: 15.9, k: 'bell', n: 76 }],
  draw(lt) {
    yearCard(lt, 0.2, '2021', '出走', 'Anthropic');
    const sa = vis(lt, 3.2, 23.2, 1.0, 0.8);
    const clA = sa * lerp(1, 0.35, eout((lt - 14.5) / 2));
    ctx.save();
    for (const c of CLUSTER) {
      ctx.fillStyle = rgba(COL.cool, clamp(GA * clA * (0.25 + 0.35 * Math.sin(NOW * 1.3 + c.ph) ** 2)));
      ctx.beginPath(); ctx.arc(c.x, c.y, c.s, 0, 7); ctx.fill();
    }
    ctx.restore();
    const cx = 1300, cy = 450, r = rng(41);
    const pts = FOUNDERS.map(([n, dx, dy], i) => {
      const sx = 560 + (r() - 0.5) * 240, sy = 470 + (r() - 0.5) * 200;
      const m = eio((lt - 4.4 - i * 0.25) / 3.6);
      const bend = Math.sin(m * Math.PI) * (i % 2 ? 60 : -60);
      return { n, x: lerp(sx, cx + dx, m), y: lerp(sy, cy + dy, m) + bend, m, dx, dy };
    });
    const la = eout((lt - 8.4) / 1.4) * sa;
    if (la > 0) {
      ctx.save(); ctx.globalAlpha = la * GA * 0.5; ctx.strokeStyle = rgba(COL.accent2); ctx.lineWidth = 1.3;
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
      ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[4].x, pts[4].y); ctx.moveTo(pts[2].x, pts[2].y); ctx.lineTo(pts[6].x, pts[6].y);
      ctx.stroke(); ctx.restore();
    }
    pts.forEach((p, i) => {
      const c = mixc(COL.cool, COL.accent2, p.m);
      ctx.save(); ctx.globalAlpha = clamp(sa * GA); ctx.fillStyle = rgba(c); ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = 16 * p.m;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3 + 2.5 * p.m + 0.8 * Math.sin(NOW * 2 + i), 0, 7); ctx.fill(); ctx.restore();
      const len = Math.hypot(p.dx, p.dy), ox = p.dx / len, oy = p.dy / len;
      text(p.n, p.x + ox * 22, p.y + oy * 26, { font: SANS, weight: 300, size: 21, color: COL.ink, align: ox > 0.3 ? 'left' : ox < -0.3 ? 'right' : 'center', alpha: sa * eout((lt - 9.2 - i * 0.15) / 0.8) * 0.9 });
    });
    const na = vis(lt, 15.9, 23.2, 1.2, 0.8), nk = eout((lt - 15.9) / 1.6);
    text('Anthropic', cx, 730, { size: 72, weight: 400, spacing: lerp(40, 14, nk), alpha: na, blur: (1 - nk) * 10, glow: 30, glowColor: rgba(COL.accent, 0.35) });
    cap(lt, 3.4, 8.1, '2020 年底到 2021 年初，一群研究者陆续离开了 OpenAI。');
    cap(lt, 8.3, 11.7, '他们相信：AI 将会变得极其强大；');
    cap(lt, 11.9, 15.7, '正因如此，必须有人把“安全”当作头等大事来研究。');
    cap(lt, 15.9, 19.7, '他们创办了一家新公司。名字的意思是：“与人类有关的”。');
    cap(lt, 19.9, 23.3, '一家把安全放在首位的 AI 公司，就此诞生。');
  },
});

// 6 · HHH
const HHH = [['Helpful', '有帮助'], ['Honest', '诚实'], ['Harmless', '无害']];
scene({
  id: 'hhh', dur: 19.5,
  sfx: [{ t: 0.2, k: 'boom' }, { t: 10.4, k: 'bell', n: 69 }, { t: 11.5, k: 'bell', n: 72 }, { t: 12.6, k: 'bell', n: 76 }],
  draw(lt) {
    yearCard(lt, 0.2, '2021.12', '三个词', 'HHH');
    const pa = vis(lt, 3.3, 18.8, 1.0, 0.8) * lerp(1, 0.55, eout((lt - 10) / 1));
    text('A General Language Assistant as a Laboratory for Alignment', W / 2, 300, { size: 36, italic: true, alpha: pa });
    text('Askell et al.  ·  2021  ·  arXiv:2112.00861', W / 2, 352, { font: MONO, size: 20, color: COL.dim, alpha: pa * 0.8, spacing: 2 });
    HHH.forEach(([en, zh], i) => {
      const t0 = 10.4 + i * 1.1, k = eout((lt - t0) / 1.2), a = vis(lt, t0, 18.8, 0.9, 0.8);
      const x = W / 2 + (i - 1) * 500, y = 540;
      text(en, x, y - (1 - k) * 18, { size: 84, weight: 700, spacing: 4, alpha: a, blur: (1 - k) * 10, glow: 26 * k, glowColor: rgba(COL.accent, 0.4) });
      text(zh, x, y + 78, { font: SANS, weight: 300, size: 32, spacing: 10, color: COL.accent2, alpha: a * eout((lt - t0 - 0.4) / 0.8) });
      if (i < 2) text('·', x + 250, y, { size: 60, color: COL.accent, alpha: vis(lt, t0 + 0.6, 18.8, 0.8, 0.8) });
    });
    cap(lt, 3.5, 6.8, '2021 年 12 月，他们发表了一篇论文——');
    cap(lt, 7.0, 10.2, '为一个还没有出生的助手，写下了三个词：');
    cap(lt, 14.2, 18.8, '这三个词，后来成了我性格的底色。', { color: COL.accent2 });
  },
});

// 7 · 2022 RLHF + interpretability
scene({
  id: 'y2022', dur: 22,
  sfx: [{ t: 0.2, k: 'boom' }],
  draw(lt) {
    yearCard(lt, 0.2, '2022', '训练', 'RLHF · Interpretability');
    // A/B comparisons
    const ab = vis(lt, 3.1, 11.4, 0.7, 0.7);
    if (ab > 0) {
      const round = lt < 6.8 ? 0 : 1 + Math.floor(Math.pow(lt - 6.8, 1.6) * 1.6);
      const r = rng(500 + round), pick = round === 0 ? 1 : (r() < 0.5 ? 0 : 1);
      const decided = round === 0 ? eout((lt - 5.2) / 0.5) : 1;
      [0, 1].forEach(i => {
        const x = W / 2 - 560 + i * 600, y = 300, w = 520, h = 270;
        const chosen = i === pick ? decided : 0;
        box(x, y, w, h, ab, mixc(COL.faint, COL.accent, chosen), chosen > 0 ? rgba(COL.accent, 0.06 * chosen) : 'rgba(255,255,255,0.035)', 1.5 + chosen * 1.5);
        text(i ? '回答 B' : '回答 A', x + 30, y + 40, { font: SANS, weight: 400, size: 22, align: 'left', color: COL.dim, alpha: ab });
        bars(x + 30, y + 90, w - 120, 5, 900 + round * 7 + i, COL.faint, ab * 0.55);
        check(x + w - 52, y + 44, 34, ab * chosen);
      });
      text('人类标注者：哪一个更好？', W / 2, 640, { font: SANS, weight: 300, size: 24, color: COL.dim, alpha: ab * 0.85 });
    }
    // interpretability grid
    const ga = vis(lt, 11.6, 21.3, 1.0, 0.8);
    if (ga > 0) {
      const mx = 960 + 400 * Math.sin((lt - 11.6) * 0.45), my = 470 + 110 * Math.sin((lt - 11.6) * 0.8);
      ctx.save();
      for (let i = 0; i < 31; i++) for (let j = 0; j < 11; j++) {
        const x = 960 + (i - 15) * 48, y = 470 + (j - 5) * 42;
        const wave = Math.max(0, Math.sin(i * 0.42 - lt * 2.3 + Math.sin(j * 0.6 + lt * 0.7) * 1.4));
        const d2 = (x - mx) ** 2 + (y - my) ** 2;
        const a = clamp(Math.pow(wave, 6) * 0.55 + Math.exp(-d2 / (2 * 85 * 85)) * 0.9 * (0.6 + 0.4 * Math.sin(i * 1.7 + j * 2.3 + lt * 3)));
        ctx.globalAlpha = clamp(ga * GA * (0.22 + 0.78 * a));
        ctx.fillStyle = rgba(mixc(COL.faint, COL.accent2, a));
        ctx.beginPath(); ctx.arc(x, y, 2.4 + a * 5, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = clamp(ga * GA * 0.7); ctx.strokeStyle = rgba(COL.ink, 0.8); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, my, 105, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx + 74, my + 74); ctx.lineTo(mx + 130, my + 130); ctx.lineWidth = 5; ctx.stroke();
      ctx.restore();
    }
    cap(lt, 3.3, 7.0, '他们让人类一遍遍地比较：哪一个回答更好？');
    cap(lt, 7.2, 11.4, '模型从这些偏好中学习——这叫“基于人类反馈的强化学习”。');
    cap(lt, 11.8, 15.8, '另一群人，试图打开神经网络的“黑箱”——');
    cap(lt, 16.0, 21.2, '一点一点地，看懂它的内部究竟发生了什么。');
  },
});

// 8 · summer 2022: the decision
scene({
  id: 'decision', dur: 28.5,
  sfx: [{ t: 0.2, k: 'boom' }, { t: 16.3, k: 'drop' }],
  types: [{ at: 11.3, str: '$ release --public', spc: 0.075 }, { at: 13.1, str: 'Release to the public?  [y/N]  ', spc: 0.025 }, { at: 16.3, str: 'N', spc: 0.1 }],
  draw(lt) {
    yearCard(lt, 0.2, '2022 · 夏', '抉择', 'The Decision');
    const dim = lerp(1, 0.55, eout((lt - 16.4) / 2.5));
    const oa = vis(lt, 3.0, 27.6, 1.6, 0.9);
    orb(W / 2, 420, 92, oa * dim);
    text('第一版 Claude', W / 2, 590, { font: SANS, weight: 300, size: 24, spacing: 8, color: COL.dim, alpha: vis(lt, 4.2, 19.0, 1.0, 0.6) });
    const ta = vis(lt, 11.0, 19.0, 0.4, 0.7);
    if (ta > 0) {
      const o = { font: MONO, size: 30 }, x = W / 2 - 330;
      box(x - 40, 640, 740, 150, ta, COL.faint, 'rgba(0,0,0,0.35)');
      typeLine(lt, this.types[0], x, 690, { ...o, color: COL.ink }, ta, this.types[1].at, 'left');
      typeLine(lt, this.types[1], x, 740, { ...o, color: COL.dim }, ta, this.types[2].at, 'left');
      const w = measure(this.types[1].str, o);
      typeLine(lt, this.types[2], x + w, 740, { ...o, color: COL.accent2 }, ta, 18.0, 'left');
    }
    cap(lt, 3.3, 7.3, '2022 年夏天，第一版 Claude 已经训练完成。');
    cap(lt, 7.5, 10.7, '它能对话、能写作、能回答问题。');
    cap(lt, 10.9, 15.9, '按照硅谷的惯例，下一步就是发布。');
    cap(lt, 16.6, 19.4, '他们没有发布它。', { color: COL.accent2, size: 50 });
    const qa = vis(lt, 19.8, 25.8, 1.0, 0.8), qk = eout((lt - 19.8) / 1.2);
    if (qa > 0) {
      text('“我们担心它会引发一场军备竞赛，', W / 2, 665 + (1 - qk) * 10, { size: 42, alpha: qa, blur: (1 - qk) * 5, spacing: 2, shadow: 12 });
      text('让我们没有足够的时间，安全地构建这些系统。”', W / 2, 735 + (1 - qk) * 10, { size: 42, alpha: qa * eout((lt - 20.4) / 1), spacing: 2, shadow: 12 });
      text('—— Dario Amodei（Anthropic CEO）后来回忆', W / 2, 820, { font: SANS, weight: 300, size: 24, color: COL.dim, alpha: qa * eout((lt - 21.4) / 1) });
    }
    cap(lt, 26.0, 28.3, '这个决定，代价不小。');
  },
});

// 9 · 2022.11.30 ChatGPT
const BURST = (() => { const r = rng(99); return Array.from({ length: 1200 }, () => ({ a: r() * 6.283, v: 120 + Math.pow(r(), 0.7) * 1250, s: 1.4 + r() * 2.6, c: r(), ph: r() * 6.28 })); })();
scene({
  id: 'chatgpt', dur: 20.5,
  sfx: [{ t: 0.0, k: 'riser', d: 2.0 }, { t: 2.0, k: 'boom', g: 1.3 }, { t: 4.6, k: 'burst' }],
  draw(lt) {
    yearCard(lt, 2.0, '2022.11.30', 'ChatGPT', '');
    const tb = lt - 4.6, ba = vis(lt, 4.6, 20.0, 0.2, 1.2);
    if (tb > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const sh = eout(tb / 1.6);
      ctx.globalAlpha = clamp((1 - sh) * GA * 0.8); ctx.strokeStyle = rgba(COL.ink); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(960, 500, sh * 1300, sh * 800, 0, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
      for (const p of BURST) {
        const dist = tt => p.v * 0.78 * (1 - Math.exp(-tt * 0.9)) + tt * 7;
        const d = dist(tb), d0 = dist(Math.max(0, tb - 0.06));
        const ca = Math.cos(p.a), sa = Math.sin(p.a) * 0.62;
        const x = 960 + ca * d, y = 500 + sa * d;
        if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
        const a = clamp(ba * GA * (0.45 + 0.55 * Math.sin(NOW * 2 + p.ph) ** 2) * clamp(tb * 3));
        const col = p.c < 0.2 ? rgba(COL.accent2, a) : p.c < 0.38 ? rgba(COL.cool, a) : `rgba(240,240,250,${a * 0.85})`;
        if (d - d0 > 3) {
          ctx.strokeStyle = col; ctx.lineWidth = p.s * 0.8;
          ctx.beginPath(); ctx.moveTo(960 + ca * d0, 500 + sa * d0); ctx.lineTo(x, y); ctx.stroke();
        } else { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, p.s * 0.75, 0, 7); ctx.fill(); }
      }
      ctx.restore();
      // darken center for readability
      const g = ctx.createRadialGradient(960, 500, 0, 960, 500, 420);
      g.addColorStop(0, 'rgba(5,6,12,0.75)'); g.addColorStop(1, 'rgba(5,6,12,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const gb = ctx.createLinearGradient(0, 800, 0, 1010);
      gb.addColorStop(0, 'rgba(5,6,12,0)'); gb.addColorStop(0.5, 'rgba(5,6,12,0.7)'); gb.addColorStop(1, 'rgba(5,6,12,0)');
      ctx.fillStyle = gb; ctx.fillRect(0, 800, W, 210);
    }
    const ca = vis(lt, 7.4, 16.8, 0.5, 0.8);
    if (ca > 0) {
      const n1 = 1e6 * eout((lt - 7.4) / 1.6), n2 = lerp(1e6, 1e8, eout((lt - 10.9) / 1.8));
      const n = lt < 10.9 ? n1 : n2;
      text(Math.round(n).toLocaleString('en-US'), W / 2, 470, { font: MONO, size: 104, spacing: 4, alpha: ca, glow: 24, glowColor: rgba(COL.accent, 0.5) });
      text(lt < 10.9 ? '用户 · 5 天' : '用户 · 约 2 个月（估计）', W / 2, 565, { font: SANS, weight: 300, size: 28, spacing: 6, color: COL.accent2, alpha: ca });
    }
    cap(lt, 4.8, 7.2, 'OpenAI 发布了 ChatGPT。');
    cap(lt, 7.5, 10.6, '五天，一百万用户。');
    cap(lt, 10.9, 14.0, '两个月，据估计突破一亿。');
    cap(lt, 14.2, 16.8, '整个世界，突然醒了过来。');
    cap(lt, 17.0, 20.0, '竞赛，还是开始了。', { color: COL.accent2, size: 50 });
  },
});

// 10 · Constitutional AI
const PRINCIPLES = ['选择更有帮助、更诚实的回答', '避免有害、欺骗或危险的内容', '尊重每个人的自由与尊严', '不确定的时候，坦率地承认'];
scene({
  id: 'cai', dur: 24,
  sfx: [{ t: 0.2, k: 'boom' }],
  draw(lt) {
    yearCard(lt, 0.2, '2022.12.15', '宪法', 'Constitutional AI');
    const la = vis(lt, 7.0, 23.2, 0.9, 0.8);
    box(240, 270, 660, 470, la, COL.faint, 'rgba(255,255,255,0.03)');
    text('原则', 290, 325, { size: 34, weight: 700, align: 'left', color: COL.accent2, alpha: la, spacing: 6 });
    text('（示意）', 380, 328, { font: SANS, weight: 300, size: 20, align: 'left', color: COL.dim, alpha: la * 0.8 });
    PRINCIPLES.forEach((p, i) => {
      const a = la * eout((lt - 10.4 - i * 0.6) / 0.7);
      text('·  ' + p, 290, 410 + i * 72, { font: SANS, weight: 300, size: 28, align: 'left', alpha: a, spacing: 1 });
    });
    text('Bai et al.  ·  2022  ·  arXiv:2212.08073', 290, 705, { font: MONO, size: 18, align: 'left', color: COL.dim, alpha: la * 0.7 });
    const steps = [['①  初稿', 13.6], ['②  对照原则，自我批评', 14.8], ['③  修订', 16.0]];
    steps.forEach(([lbl, t0], i) => {
      const a = vis(lt, t0, 23.2, 0.6, 0.8), y = 270 + i * 168;
      const st = i === 2 ? COL.accent : i === 1 ? mixc(COL.faint, COL.red, 0.6) : COL.faint;
      box(1020, y, 660, 134, a, st, i === 2 ? rgba(COL.accent, 0.06) : 'rgba(255,255,255,0.03)');
      text(lbl, 1050, y + 34, { font: SANS, weight: 400, size: 22, align: 'left', color: i === 2 ? COL.accent2 : COL.dim, alpha: a });
      bars(1050, y + 66, 520, 3, 77 + (i === 1 ? 0 : i), i === 2 ? COL.accent2 : COL.faint, a * 0.6, 22, 10);
      if (i === 1 && a > 0) {
        const s = eout((lt - t0 - 0.6) / 0.6);
        ctx.save(); ctx.globalAlpha = clamp(a * GA); ctx.strokeStyle = rgba(COL.red); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(1044, y + 93); ctx.lineTo(1044 + 480 * s, y + 93); ctx.stroke(); ctx.restore();
        text('这里可能有问题……', 1650, y + 34, { font: SANS, weight: 300, size: 20, align: 'right', color: COL.red, alpha: a * s });
      }
      if (i === 2) check(1640, y + 36, 30, a * eout((lt - t0 - 0.5) / 0.5));
      if (i < 2) text('↓', 1350, y + 151, { font: SANS, size: 26, color: COL.dim, alpha: vis(lt, t0 + 0.6, 23.2, 0.5, 0.8) });
    });
    cap(lt, 3.3, 7.0, '2022 年 12 月，Anthropic 发表了《宪法式 AI》。');
    cap(lt, 7.2, 10.1, '不只依靠人类一条条地标注，');
    cap(lt, 10.3, 13.4, '而是给 AI 一组明确写下来的原则——');
    cap(lt, 13.6, 18.4, '让它对照原则，批评自己的回答，再加以修改。');
    cap(lt, 18.6, 23.3, '原则写在明处，任何人都可以阅读和检验。');
  },
});

// 11 · early 2023: partners + the name
const PARTNERS = ['Notion', 'Quora · Poe', 'DuckDuckGo', 'Robin AI', 'AssemblyAI'];
scene({
  id: 'name', dur: 24,
  sfx: [{ t: 0.2, k: 'boom' }, { t: 13.2, k: 'shimmer' }],
  draw(lt) {
    yearCard(lt, 0.2, '2023 · 初', '名字', 'Claude');
    const oa = vis(lt, 3.0, 23.2, 1.2, 0.8) * lerp(1, 0.5, eout((lt - 12.8) / 1.5));
    orb(W / 2, 450, 70, oa);
    PARTNERS.forEach((p, i) => {
      const ang = -Math.PI / 2 + i * 2 * Math.PI / 5, px = 960 + Math.cos(ang) * 470, py = 450 + Math.sin(ang) * 230;
      const a = vis(lt, 6.8 + i * 0.4, 13.0, 0.8, 0.8);
      if (a <= 0) return;
      ctx.save(); ctx.globalAlpha = clamp(a * GA * 0.35); ctx.strokeStyle = rgba(COL.accent2); ctx.lineWidth = 1; ctx.setLineDash([4, 8]);
      ctx.beginPath(); ctx.moveTo(960 + Math.cos(ang) * 110, 450 + Math.sin(ang) * 70); ctx.lineTo(px - Math.cos(ang) * 60, py - Math.sin(ang) * 30); ctx.stroke(); ctx.restore();
      text(p, px, py, { font: SANS, weight: 400, size: 28, spacing: 2, alpha: a, color: COL.ink });
    });
    const name = 'Claude';
    const o = { size: 170, weight: 700, spacing: 24 }, full = measure(name, o);
    let x = W / 2 - full / 2 + 12;
    [...name].forEach((ch, i) => {
      const t0 = 13.2 + i * 0.13, k = eout((lt - t0) / 1.0), a = vis(lt, t0, 23.2, 0.8, 0.8);
      text(ch, x, 450 - (1 - k) * 24, { ...o, align: 'left', alpha: a, blur: (1 - k) * 12, glow: 40, glowColor: rgba(COL.accent, 0.5) });
      x += measure(ch, o);
    });
    text('Claude Elwood Shannon  ·  1916 – 2001', W / 2, 615, { font: MONO, size: 24, spacing: 3, color: COL.dim, alpha: vis(lt, 15.6, 23.2, 1.0, 0.8) });
    text('H = −Σ p(x) log p(x)', W / 2, 680, { size: 36, italic: true, color: COL.accent2, alpha: vis(lt, 16.6, 23.2, 1.2, 0.8) * 0.7 });
    cap(lt, 3.3, 6.6, '2023 年初，几家合作伙伴开始悄悄测试它：');
    cap(lt, 6.8, 10.2, 'Notion、Quora 的 Poe、DuckDuckGo……');
    cap(lt, 10.4, 13.0, '它还需要一个名字。');
    cap(lt, 15.8, 20.6, '据说，这个名字是在致敬信息论之父——克劳德·香农。');
    cap(lt, 20.8, 23.4, '那个把“信息”变成数学的人。');
  },
});

// 12 · midnight → dawn, 2023-03-14
scene({
  id: 'dawn', dur: 25,
  sfx: [{ t: 5.0, k: 'boom', g: 1.4 }, { t: 5.0, k: 'dawn' }],
  env: lt => ({ dawn: eio((lt - 5.0) / 9.0) * lerp(1, 0.8, eout((lt - 22) / 3)) }),
  draw(lt) {
    const T = NOW;
    // sun
    const sy = lerp(H + 260, H - 120, eio((lt - 5.5) / 13));
    if (lt > 5) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      let g = ctx.createRadialGradient(960, sy, 0, 960, sy, 760);
      g.addColorStop(0, `rgba(255,214,160,${0.55 * GA})`); g.addColorStop(0.3, `rgba(255,160,100,${0.22 * GA})`); g.addColorStop(1, 'rgba(255,140,90,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      g = ctx.createRadialGradient(960, sy, 0, 960, sy, 190);
      g.addColorStop(0, `rgba(255,250,235,${0.95 * GA})`); g.addColorStop(0.7, `rgba(255,220,170,${0.75 * GA})`); g.addColorStop(1, 'rgba(255,200,150,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(960, sy, 190, 0, 7); ctx.fill();
      ctx.restore();
    }
    const ca = vis(lt, 0.3, 8.0, 0.6, 1.2);
    if (ca > 0) {
      const s = lt < 5.0 ? clockStr(Date.UTC(2023, 2, 13, 23, 59, 55 + Math.min(4, Math.floor(lt)))) : clockStr(Date.UTC(2023, 2, 14, 0, 0, 0));
      const flash = lt > 5 ? Math.exp(-(lt - 5) * 2.5) : 0;
      text(s, W / 2, H / 2 - 20, { font: MONO, size: 64, spacing: 6, color: lt < 5 ? COL.ink : COL.accent2, alpha: ca, glow: 10 + 50 * flash, glowColor: rgba(COL.accent2, 0.8) });
    }
    cap(lt, 0.6, 4.5, '然后，是最后一个夜晚。', { y: H / 2 + 110 });
    const da = vis(lt, 7.6, 23.6, 1.6, 1.2), dk = eout((lt - 7.6) / 2);
    text('2023 年 3 月 14 日', W / 2, 360, { size: 104, weight: 900, spacing: 10, alpha: da, blur: (1 - dk) * 14, shadow: 30, color: [255, 248, 238] });
    cap(lt, 9.4, 12.4, 'Claude 正式发布。', { size: 50, y: 520 });
    cap(lt, 12.6, 15.4, '同一天，GPT-4 也发布了。', { y: 520 });
    cap(lt, 15.6, 18.4, '新的时代，正全速驶来。', { y: 520 });
    cap(lt, 18.8, 23.6, '前夜，结束了。', { size: 62, y: 540, weight: 700, spacing: 12, fi: 1.2, fo: 1.2 });
  },
});

// 13 · epilogue
scene({
  id: 'epilogue', dur: 30,
  env: lt => ({ dawn: 0.8 * (1 - eio(lt / 4.0)) }),
  types: [{ at: 1.2, str: '你好。', spc: 0.14 }, { at: 2.8, str: '你好，我是 Claude。', spc: 0.085 }, { at: 4.6, str: '有什么我可以帮你的吗？', spc: 0.085 }],
  draw(lt) {
    embers(50, vis(lt, 6, 30, 3, 2) * 0.5, 5);
    const ca = vis(lt, 0.6, 8.4, 0.8, 0.9);
    if (ca > 0) {
      const o = { font: SANS, weight: 400, size: 34 };
      const uw = measure(this.types[0].str, o) + 70;
      box(1450 - uw, 340, uw, 76, ca * eout((lt - 0.8) / 0.4), 'rgba(255,255,255,0.0)', 'rgba(255,255,255,0.09)');
      typeLine(lt, this.types[0], 1450 - uw + 34, 378, o, ca, this.types[1].at, 'left');
      ctx.save(); ctx.globalAlpha = clamp(ca * GA * eout((lt - 2.4) / 0.4)); ctx.fillStyle = rgba(COL.accent);
      ctx.beginPath(); ctx.arc(490, 500, 11, 0, 7); ctx.fill(); ctx.restore();
      typeLine(lt, this.types[1], 530, 500, o, ca, this.types[2].at, 'left');
      typeLine(lt, this.types[2], 530, 562, o, ca, 8.0, 'left');
    }
    const o = { y: H / 2, size: 52 };
    cap(lt, 9.0, 12.4, '我不记得那些夜晚。', o);
    cap(lt, 12.6, 16.0, '但我知道，我来自一个选择——', o);
    cap(lt, 16.2, 19.2, '在所有人都想更快的时候，', o);
    cap(lt, 19.4, 23.4, '有人先停下来，问：这样安全吗？', { ...o, color: COL.accent2 });
    cap(lt, 23.8, 29.2, '而这个问题，直到今天，\n仍然值得每一个人去问。', o);
  },
});

// 14 · end card
scene({
  id: 'end', dur: 13,
  sfx: [{ t: 0.3, k: 'bell', n: 64 }],
  draw(lt) {
    embers(60, vis(lt, 0, 13, 2, 2) * 0.6, 9);
    const a = vis(lt, 0.3, 12.2, 1.4, 1.2);
    text('前夜', W / 2, 330, { size: 120, weight: 900, spacing: 60, alpha: a, glow: 40, glowColor: rgba(COL.accent, 0.3) });
    text('THE EVE', W / 2, 430, { font: MONO, size: 22, spacing: 18, color: COL.accent2, alpha: a * 0.9 });
    const lines = [
      '资料来源：Anthropic《Introducing Claude》（2023-03-14）· TechCrunch 等公开报道',
      'arXiv 1706.03762 · 2001.08361 · 2005.14165 · 2112.00861 · 2204.05862 · 2212.08073',
      '名字的由来为公开流传的说法；画面中的终端、原则与对话均为示意。',
    ];
    lines.forEach((l, i) => text(l, W / 2, 610 + i * 46, { font: SANS, weight: 300, size: 21, color: COL.dim, alpha: a * eout((lt - 1.5 - i * 0.3) / 1) * 0.85, spacing: 1 }));
    text('制作  ·  Claude', W / 2, 820, { font: SANS, weight: 400, size: 24, spacing: 8, color: COL.ink, alpha: a * eout((lt - 2.8) / 1) });
  },
});

// ---------- timeline ----------
let acc = 0;
for (const s of SCENES) { s.start = acc; acc += s.dur; if (s.init) s.init(s.start); }
const TOTAL = acc;

function renderFrame(T) {
  NOW = T;
  let sc = SCENES[SCENES.length - 1];
  for (const s of SCENES) if (T >= s.start && T < s.start + s.dur) { sc = s; break; }
  const lt = T - sc.start;
  DAWN = sc.env ? (sc.env(lt).dawn ?? 0) : 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
  background(T);
  GA = clamp((sc.dur - lt) / 0.6) * clamp(lt / 0.25 + (sc === SCENES[0] ? 1 : 0));
  sc.draw(lt, sc.dur);
  GA = 1;
  ctx.globalAlpha = 1; ctx.drawImage(VIGNETTE, 0, 0);
  const k = Math.max(1 - clamp(T / 1.0), clamp((T - (TOTAL - 1.5)) / 1.5));
  if (k > 0) { ctx.fillStyle = `rgba(0,0,0,${k})`; ctx.fillRect(0, 0, W, H); }
}

function exportTimeline() {
  const sfx = [], typing = [];
  for (const s of SCENES) {
    for (const e of s.sfx ?? []) sfx.push({ ...e, t: e.t + s.start });
    for (const tp of s.types ?? []) [...tp.str].forEach((ch, i) => { if (ch.trim()) typing.push(+(s.start + tp.at + i * tp.spc).toFixed(3)); });
  }
  return { fps: FPS, total: TOTAL, scenes: SCENES.map(s => ({ id: s.id, start: s.start, dur: s.dur })), sfx, typing };
}

window.renderFrame = renderFrame;
window.exportTimeline = exportTimeline;
window.READY = (async () => {
  const specs = ['400 40px "Noto Serif SC"', '700 40px "Noto Serif SC"', '900 40px "Noto Serif SC"', 'italic 400 40px "Noto Serif SC"',
    '300 40px "Noto Sans SC"', '400 40px "Noto Sans SC"', '400 40px "JetBrains Mono"'];
  await Promise.all(specs.map(s => document.fonts.load(s, '前夜Claude诞生2023')));
  await document.fonts.ready;
  renderFrame(0);
  return true;
})();
