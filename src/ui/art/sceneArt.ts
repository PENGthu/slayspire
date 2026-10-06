/**
 * 场景背景：分层的绘画风环境（远景剪影、光束、雾、地面、前景框景）。
 * 画布 1600×900，人物站立的地面线在 y=SCENE_GROUND。
 */
import { INK, glow, hash, line, memo, mix, rand } from './kit';

const W = 1600;
const H = 900;
export const SCENE_GROUND = 525;
const GROUND = SCENE_GROUND;

type R = () => number;

function gradRect(id: string, stops: [number, string, number?][], y = 0, h = H, x1 = 0, y1 = 0, x2 = 0, y2 = 1): string {
  const s = stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op !== undefined ? ` stop-opacity="${op}"` : ''}/>`).join('');
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${s}</linearGradient><rect x="0" y="${y}" width="${W}" height="${h}" fill="url(#${id})"/>`;
}

/** 起伏的剪影带 */
function ridge(y: number, amp: number, col: string, r: R, step = 80, opacity = 1): string {
  let d = `M0 ${H} L0 ${y}`;
  for (let x = 0; x <= W + step; x += step) d += ` Q${x - step / 2} ${(y - amp * r()).toFixed(1)} ${x} ${(y - amp * 0.4 * r()).toFixed(1)}`;
  d += ` L${W} ${H} Z`;
  return `<path d="${d}" fill="${col}"${opacity < 1 ? ` opacity="${opacity}"` : ''}/>`;
}

/** 光束 */
function shaft(x: number, w: number, slant: number, col: string, op: number, id: string): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity="${op}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient><path d="M${x} -20 L${x + w} -20 L${x + w + slant} ${GROUND + 40} L${x + slant - w * 0.6} ${GROUND + 40} Z" fill="url(#${id})"/>`;
}

function fog(y: number, h: number, col: string, op: number, id: string): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity="0"/><stop offset="0.5" stop-color="${col}" stop-opacity="${op}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient><rect x="0" y="${y}" width="${W}" height="${h}" fill="url(#${id})"/>`;
}

/** 透视地面网格线 */
function floorLines(col: string, op: number, vx = 800, vy = 380, n = 22, rows = 9): string {
  let s = '';
  for (let i = 0; i <= n; i++) {
    const bx = -800 + (i * (W + 1600)) / n;
    const t = (GROUND - vy) / (H - vy);
    const sx = vx + (bx - vx) * t;
    s += `<path d="M${sx.toFixed(1)} ${GROUND} L${bx.toFixed(1)} ${H}" stroke="${col}" stroke-width="2" opacity="${op}"/>`;
  }
  let y = GROUND;
  let gap = 10;
  for (let i = 0; i < rows; i++) {
    y += gap;
    gap *= 1.45;
    if (y > H) break;
    s += `<path d="M0 ${y.toFixed(1)} L${W} ${y.toFixed(1)}" stroke="${col}" stroke-width="2" opacity="${op}"/>`;
  }
  return s;
}

function trunk(x: number, w: number, top: number, col: string, lean = 0): string {
  return `<path d="M${x - w / 2} ${GROUND + 20} C${x - w / 2 + lean * 0.3} ${GROUND - 200} ${x - w * 0.4 + lean} ${top + 100} ${x - w * 0.3 + lean} ${top} L${x + w * 0.3 + lean} ${top} C${x + w * 0.4 + lean} ${top + 100} ${x + w / 2 + lean * 0.3} ${GROUND - 200} ${x + w / 2} ${GROUND + 20} C${x + w} ${GROUND + 30} ${x - w} ${GROUND + 30} ${x - w / 2} ${GROUND + 20} Z" fill="${col}"/>`;
}

function blob(cx: number, cy: number, rx: number, ry: number, col: string, r: R, op = 1): string {
  let d = '';
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 0.8 + r() * 0.35;
    const x = cx + Math.cos(a) * rx * k;
    const y = cy + Math.sin(a) * ry * k;
    d += i === 0 ? `M${x.toFixed(1)} ${y.toFixed(1)}` : ` Q${(cx + Math.cos(a - 0.35) * rx * 1.15).toFixed(1)} ${(cy + Math.sin(a - 0.35) * ry * 1.15).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `<path d="${d} Z" fill="${col}"${op < 1 ? ` opacity="${op}"` : ''}/>`;
}

function motes(n: number, col: string, r: R, y0 = 0, y1 = GROUND): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = r() * W;
    const y = y0 + r() * (y1 - y0);
    const rr = 1.5 + r() * 3;
    s += glow(x, y, rr * 4, col, 0.5) + `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(1)}" fill="${col}" opacity="0.9"/>`;
  }
  return s;
}

function vignette(op = 0.8): string {
  return `<radialGradient id="svig" cx="50%" cy="45%" r="75%"><stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${op}"/></radialGradient><rect width="${W}" height="${H}" fill="url(#svig)"/>`;
}

function brush(r: R, cols: string[], n: number, y0: number, y1: number, op = 0.12): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    const y = y0 + r() * (y1 - y0);
    s += line(`M${(-100 + r() * 300).toFixed(0)} ${y.toFixed(0)} C${(400 + r() * 300).toFixed(0)} ${(y - 40 + r() * 80).toFixed(0)} ${(900 + r() * 300).toFixed(0)} ${(y - 40 + r() * 80).toFixed(0)} ${(1500 + r() * 300).toFixed(0)} ${(y - 20 + r() * 40).toFixed(0)}`, cols[i % cols.length], 20 + r() * 50, op);
  }
  return s;
}

// ---------------------------------------------------------------- 蔓生密林

function overgrowth(): string {
  const r = rand(hash('overgrowth'));
  let s = gradRect('og-sky', [
    [0, '#0b1610'],
    [0.45, '#1d3324'],
    [0.66, '#2b4630'],
    [1, '#0c140d'],
  ]);
  s += glow(1100, 260, 520, '#c8e89a', 0.25, 360);
  s += brush(r, ['#2f4c34', '#16261a'], 10, 40, 560, 0.18);
  // 远景树干
  for (let i = 0; i < 12; i++) s += trunk(60 + i * 140 + r() * 60, 40 + r() * 30, -50, mix('#2c4632', '#3c5a40', r()), (r() - 0.5) * 40);
  s += fog(240, 280, '#5a7a5a', 0.35, 'og-f1');
  s += shaft(980, 90, -160, '#e8f4b0', 0.22, 'og-s1') + shaft(1180, 60, -140, '#e8f4b0', 0.16, 'og-s2') + shaft(560, 50, -120, '#e8f4b0', 0.12, 'og-s3');
  // 中景树干与树根
  for (let i = 0; i < 6; i++) {
    const x = 40 + i * 300 + r() * 80;
    s += trunk(x, 70 + r() * 40, -60, mix('#1a2a1c', '#22361f', r()), (r() - 0.5) * 60);
    s += `<path d="M${x - 70} ${GROUND + 30} C${x - 40} ${GROUND - 10} ${x - 30} ${GROUND - 40} ${x} ${GROUND - 60} C${x + 30} ${GROUND - 40} ${x + 50} ${GROUND - 10} ${x + 90} ${GROUND + 30} Z" fill="#18261a"/>`;
  }
  // 树冠
  for (let i = 0; i < 14; i++) s += blob(r() * W, -20 + r() * 90, 120 + r() * 100, 60 + r() * 40, mix('#14261a', '#1f3a22', r()), r);
  // 垂藤
  for (let i = 0; i < 16; i++) {
    const x = r() * W;
    const len = 120 + r() * 260;
    s += line(`M${x.toFixed(0)} 0 C${(x + 20).toFixed(0)} ${(len * 0.4).toFixed(0)} ${(x - 20).toFixed(0)} ${(len * 0.7).toFixed(0)} ${(x + 6).toFixed(0)} ${len.toFixed(0)}`, '#2a4a28', 4 + r() * 4, 0.85);
    for (let k = 0; k < 4; k++) s += `<ellipse cx="${(x + (r() - 0.5) * 16).toFixed(0)}" cy="${(len * (0.25 + k * 0.2)).toFixed(0)}" rx="7" ry="4" fill="#3a6a34" opacity="0.8"/>`;
  }
  // 远处的石拱
  s += `<path d="M640 ${GROUND - 10} L640 290 C640 190 960 190 960 290 L960 ${GROUND - 10} L910 ${GROUND - 10} L910 300 C910 240 690 240 690 300 L690 ${GROUND - 10} Z" fill="#3a4a3e" opacity="0.55"/>`;
  s += fog(400, 160, '#7a9a72', 0.3, 'og-f2');
  // 地面
  s += gradRect('og-g', [
    [0, '#3a5232'],
    [0.25, '#26381f'],
    [1, '#0c140a'],
  ], GROUND, H - GROUND);
  s += floorLines('#0e180c', 0.35);
  s += brush(r, ['#4a6a3a', '#1a2a14'], 8, GROUND + 10, H, 0.2);
  // 苔藓与发光蘑菇
  for (let i = 0; i < 18; i++) s += blob(r() * W, GROUND + 10 + r() * 60, 40 + r() * 60, 8 + r() * 8, '#4a7a3a', r, 0.55);
  for (let i = 0; i < 10; i++) {
    const x = r() * W;
    const y = GROUND + 6 + r() * 40;
    s += glow(x, y - 6, 26, '#9af0c0', 0.4) + `<path d="M${x - 6} ${y} L${x - 3} ${y - 10} L${x + 3} ${y - 10} L${x + 6} ${y} Z" fill="#d8f0d0"/><ellipse cx="${x}" cy="${y - 11}" rx="9" ry="5" fill="#7ad0a8"/>`;
  }
  s += motes(28, '#e0f8a0', r, 120, GROUND);
  // 前景框景
  s += `<path d="M0 0 L180 0 C120 120 140 260 60 420 C40 470 20 520 0 560 Z" fill="#070d08"/>`;
  s += `<path d="M${W} 0 L${W - 200} 0 C${W - 130} 140 ${W - 160} 300 ${W - 70} 460 C${W - 40} 520 ${W - 20} 560 ${W} 600 Z" fill="#070d08"/>`;
  s += vignette(0.75);
  return s;
}

// ---------------------------------------------------------------- 地下船坞

function underdocks(): string {
  const r = rand(hash('underdocks'));
  let s = gradRect('ud-sky', [
    [0, '#060c10'],
    [0.5, '#12262e'],
    [0.66, '#1a3640'],
    [1, '#05090c'],
  ]);
  s += brush(r, ['#1a3038', '#0a161a'], 10, 30, 560, 0.2);
  // 砖砌拱廊
  for (let i = 0; i < 5; i++) {
    const x = -80 + i * 380;
    s += `<path d="M${x} ${GROUND} L${x} 260 C${x} 120 ${x + 340} 120 ${x + 340} 260 L${x + 340} ${GROUND} L${x + 300} ${GROUND} L${x + 300} 270 C${x + 300} 170 ${x + 40} 170 ${x + 40} 270 L${x + 40} ${GROUND} Z" fill="#1c2c30" opacity="0.9"/>`;
    for (let k = 0; k < 8; k++) s += line(`M${x} ${300 + k * 36} L${x + 40} ${300 + k * 36} M${x + 300} ${300 + k * 36} L${x + 340} ${300 + k * 36}`, '#0e1a1e', 2, 0.8);
  }
  // 远处的水面与船骸
  s += gradRect('ud-w', [
    [0, '#1f4a52'],
    [1, '#0a1c22'],
  ], 400, 130);
  s += `<path d="M980 400 C1020 330 1200 310 1320 350 L1360 400 Z" fill="#14242a"/><path d="M1180 340 L1186 180 L1194 180 L1200 340 Z" fill="#14242a"/><path d="M1190 190 L1260 230 L1190 250 Z" fill="#1e3238" opacity="0.8"/>`;
  for (let i = 0; i < 14; i++) s += line(`M${(r() * W).toFixed(0)} ${(410 + r() * 100).toFixed(0)} l${(40 + r() * 80).toFixed(0)} 0`, '#6ac8d0', 2, 0.35);
  // 吊灯
  for (let i = 0; i < 5; i++) {
    const x = 160 + i * 320 + r() * 60;
    const y = 130 + r() * 100;
    s += line(`M${x} 0 L${x} ${y - 18}`, '#0a1214', 3) + glow(x, y, 110, '#ffb050', 0.42) + `<path d="M${x - 12} ${y - 18} L${x + 12} ${y - 18} L${x + 10} ${y + 16} L${x - 10} ${y + 16} Z" fill="#ffd890" stroke="${INK}" stroke-width="3"/>`;
    s += line(`M${x - 40} ${GROUND + 70} l80 0 M${x - 26} ${GROUND + 90} l52 0`, '#ffb050', 3, 0.25);
  }
  // 绳索
  for (let i = 0; i < 4; i++) {
    const x = r() * W;
    s += line(`M${x} 40 Q${x + 160} ${140 + r() * 80} ${x + 340} 30`, '#3a3024', 4, 0.9);
  }
  s += fog(320, 240, '#4a8a90', 0.25, 'ud-f1');
  // 码头木板
  s += gradRect('ud-g', [
    [0, '#5a4430'],
    [0.3, '#3a2a1c'],
    [1, '#120c08'],
  ], GROUND, H - GROUND);
  let y = GROUND;
  let gap = 12;
  for (let i = 0; i < 10; i++) {
    y += gap;
    gap *= 1.35;
    if (y > H) break;
    s += `<path d="M0 ${y.toFixed(1)} L${W} ${y.toFixed(1)}" stroke="#1a120a" stroke-width="3" opacity="0.8"/>`;
    for (let k = 0; k < 6; k++) s += `<circle cx="${(r() * W).toFixed(0)}" cy="${(y - gap * 0.4).toFixed(0)}" r="2.4" fill="#1a120a" opacity="0.8"/>`;
  }
  s += brush(r, ['#6a5038', '#20160c'], 8, GROUND + 10, H, 0.18);
  // 木桩
  for (const x of [120, 470, 1130, 1480]) s += `<path d="M${x - 24} ${GROUND + 40} L${x - 20} 270 L${x + 20} 270 L${x + 24} ${GROUND + 40} Z" fill="#2a1e14" stroke="${INK}" stroke-width="3"/>` + line(`M${x - 24} 340 L${x + 24} 350 M${x - 24} 380 L${x + 24} 390`, '#5a6a5a', 4, 0.8);
  s += motes(16, '#8ae8f0', r, 200, GROUND);
  s += `<path d="M0 0 L${W} 0 L${W} 60 C1200 90 400 90 0 60 Z" fill="#05090b"/>`;
  s += vignette(0.8);
  return s;
}

// ---------------------------------------------------------------- 嗡鸣蜂巢

function hex(cx: number, cy: number, rr: number): string {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
  }
  return d + 'Z';
}

function hive(): string {
  const r = rand(hash('hive'));
  let s = gradRect('hv-sky', [
    [0, '#1e1206'],
    [0.5, '#5a3610'],
    [0.66, '#7a4a16'],
    [1, '#140a02'],
  ]);
  s += glow(800, 360, 620, '#ffb84a', 0.3, 340);
  // 蜂巢墙
  const rr = 46;
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 22; col++) {
      const cx = col * rr * 1.74 + (row % 2) * rr * 0.87 - 20;
      const cy = row * rr * 1.5 - 20;
      if (cy > GROUND + 10) continue;
      const depth = Math.abs(cx - 800) / 800;
      const fillc = mix('#6a4414', '#2a1806', Math.min(1, 0.25 + depth * 0.6 + r() * 0.25));
      s += `<path d="${hex(cx, cy, rr - 3)}" fill="${fillc}" stroke="#1e1004" stroke-width="5"/>`;
      if (r() < 0.07) s += `<path d="${hex(cx, cy, rr - 14)}" fill="#ffc860" opacity="0.6"/>` + glow(cx, cy, rr * 1.4, '#ffd070', 0.25);
      else if (r() < 0.3) s += `<path d="${hex(cx, cy + 4, rr - 12)}" fill="#1a0e02" opacity="0.55"/>`;
    }
  }
  s += glow(1100, 320, 520, '#120802', 0.55, 240);
  s += fog(220, 300, '#ffb050', 0.16, 'hv-f1');
  // 滴落的蜂蜜
  for (let i = 0; i < 18; i++) {
    const x = r() * W;
    const len = 40 + r() * 180;
    s += `<path d="M${x - 10} 0 L${x + 10} 0 L${x + 4} ${len} C${x + 8} ${len + 14} ${x - 8} ${len + 14} ${x - 4} ${len} Z" fill="#ffb030" stroke="${INK}" stroke-width="2.4" opacity="0.92"/>` + `<circle cx="${x - 2}" cy="${len * 0.5}" r="2" fill="#fff4c0" opacity="0.8"/>`;
  }
  // 有机支柱
  for (const x of [140, 1460]) s += `<path d="M${x - 90} ${GROUND + 30} C${x - 40} 400 ${x - 120} 200 ${x - 60} 0 L${x + 60} 0 C${x + 120} 200 ${x + 40} 400 ${x + 90} ${GROUND + 30} Z" fill="#2a1806"/>`;
  // 地面
  s += gradRect('hv-g', [
    [0, '#9a6a24'],
    [0.3, '#5a3a12'],
    [1, '#140a02'],
  ], GROUND, H - GROUND);
  s += floorLines('#2a1806', 0.4);
  for (let i = 0; i < 9; i++) s += blob(r() * W, GROUND + 20 + r() * 100, 60 + r() * 90, 10 + r() * 10, '#ffb030', r, 0.5);
  s += brush(r, ['#b07a2a', '#2a1806'], 8, GROUND + 10, H, 0.2);
  s += motes(24, '#ffe08a', r, 80, GROUND);
  s += vignette(0.75);
  return s;
}

// ---------------------------------------------------------------- 荣光之巅

function glory(): string {
  const r = rand(hash('glory'));
  let s = gradRect('gl-sky', [
    [0, '#2a1a4a'],
    [0.35, '#6a4a8a'],
    [0.58, '#e8b878'],
    [0.66, '#f6d898'],
    [1, '#2a1a20'],
  ]);
  s += glow(800, 360, 600, '#fff2c0', 0.5, 260);
  // 光芒
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI + (i / 13) * Math.PI;
    s += `<path d="M800 400 L${(800 + Math.cos(a - 0.04) * 1400).toFixed(0)} ${(400 + Math.sin(a - 0.04) * 1400).toFixed(0)} L${(800 + Math.cos(a + 0.04) * 1400).toFixed(0)} ${(400 + Math.sin(a + 0.04) * 1400).toFixed(0)} Z" fill="#fff6d8" opacity="0.07"/>`;
  }
  // 云
  for (let i = 0; i < 16; i++) s += blob(r() * W, 320 + r() * 150, 140 + r() * 120, 30 + r() * 20, mix('#f8e8d0', '#c8a8c8', r()), r, 0.65);
  // 远处的尖塔
  s += `<path d="M800 70 L812 250 L832 260 L840 420 L760 420 L768 260 L788 250 Z" fill="#c8a868" opacity="0.7"/>` + glow(800, 66, 30, '#fff6d0', 0.9);
  // 柱廊
  for (let i = 0; i < 8; i++) {
    const x = 40 + i * 220;
    if (x > 600 && x < 1000) continue;
    s += `<path d="M${x - 30} ${GROUND} L${x - 26} 150 L${x + 26} 150 L${x + 30} ${GROUND} Z" fill="#efe4d0" stroke="${INK}" stroke-width="3"/>`;
    s += `<path d="M${x + 4} 150 L${x + 26} 150 L${x + 30} ${GROUND} L${x + 6} ${GROUND} Z" fill="#000" opacity="0.18"/>`;
    s += `<path d="M${x - 44} 130 L${x + 44} 130 L${x + 38} 156 L${x - 38} 156 Z" fill="#e8d8b8" stroke="${INK}" stroke-width="3"/>`;
    s += line(`M${x - 12} 170 L${x - 12} ${GROUND - 10} M${x + 2} 170 L${x + 2} ${GROUND - 10}`, '#c8b898', 2, 0.6);
  }
  // 旗帜
  for (const x of [260, 1340]) s += `<path d="M${x - 40} 160 L${x + 40} 160 L${x + 40} 360 L${x} 330 L${x - 40} 360 Z" fill="#a8302a" stroke="${INK}" stroke-width="3"/><path d="M${x} 210 L${x + 12} 240 L${x} 270 L${x - 12} 240 Z" fill="#e8c060"/>`;
  s += fog(400, 150, '#fff0d0', 0.4, 'gl-f1');
  // 大理石地面
  s += gradRect('gl-g', [
    [0, '#e8dcc8'],
    [0.3, '#a89a88'],
    [1, '#2a2420'],
  ], GROUND, H - GROUND);
  s += floorLines('#6a5a48', 0.45, 800, 380, 26, 10);
  s += `<path d="M0 ${GROUND} L${W} ${GROUND}" stroke="#c8a040" stroke-width="5"/>`;
  s += brush(r, ['#fff6e0', '#4a3a2a'], 6, GROUND + 10, H, 0.15);
  s += motes(26, '#fff6c8', r, 60, GROUND);
  s += vignette(0.6);
  return s;
}

// ---------------------------------------------------------------- 主菜单

function menu(): string {
  const r = rand(hash('menu'));
  let s = gradRect('mn-sky', [
    [0, '#05060c'],
    [0.5, '#141a30'],
    [0.75, '#2a2440'],
    [1, '#07080c'],
  ]);
  for (let i = 0; i < 160; i++) s += `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * 560).toFixed(0)}" r="${(0.6 + r() * 1.8).toFixed(1)}" fill="#fff" opacity="${(0.3 + r() * 0.7).toFixed(2)}"/>`;
  s += glow(800, 120, 420, '#e2b04a', 0.18, 300);
  s += brush(r, ['#2a2a48', '#0a0a14'], 10, 100, 700, 0.18);
  s += ridge(640, 140, '#121628', r, 120);
  s += fog(560, 200, '#3a3a5a', 0.4, 'mn-f');
  s += ridge(720, 100, '#090b14', r, 100);
  s += vignette(0.7);
  return s;
}

const SCENES: Record<string, () => string> = { overgrowth, underdocks, hive, glory, menu };

export function sceneSvg(kind: string): string {
  const fn = SCENES[kind] ?? SCENES.menu;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMax slice">${fn()}</svg>`;
}

const cache = memo((kind: string) => sceneSvg(kind));

export function sceneUrl(kind: string): string {
  return cache(kind);
}

