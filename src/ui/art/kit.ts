/**
 * 手绘风格的 SVG 美术工具：墨线描边 + 体积光照 + 画布颗粒。
 * 所有插画都生成为 SVG 字符串，再转成 data URI 交给 <img>，浏览器只需栅格化一次。
 */

export const INK = '#1a1110';

/** 字符串哈希（FNV-1a） */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 确定性随机数 */
export function rand(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parse(c: string): [number, number, number] {
  const h = c.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hex(r: number, g: number, b: number): string {
  const f = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}

/** 颜色混合，t=0 为 a，t=1 为 b */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  return hex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** 正数提亮、负数压暗 */
export function shade(c: string, amt: number): string {
  return amt >= 0 ? mix(c, '#fff8ec', amt) : mix(c, '#0a0608', -amt);
}

const f1 = (n: number) => (Math.round(n * 10) / 10).toString();

/** 带墨线描边的形状 */
export function ink(d: string, fill: string, sw = 3, extra = ''): string {
  return `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"${extra}/>`;
}

/** 无描边形状 */
export function fill(d: string, color: string, opacity = 1): string {
  return `<path d="${d}" fill="${color}"${opacity < 1 ? ` opacity="${opacity}"` : ''}/>`;
}

/** 线条（高光、纹理） */
export function line(d: string, color: string, w = 2, opacity = 1): string {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${opacity < 1 ? ` opacity="${opacity}"` : ''}/>`;
}

/** 带描边的粗线条（肢体、杆子） */
export function limb(d: string, color: string, w: number): string {
  return line(d, INK, w + 5) + line(d, color, w);
}

export function circle(cx: number, cy: number, r: number, color: string, sw = 3): string {
  return `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" fill="${color}"${sw ? ` stroke="${INK}" stroke-width="${sw}"` : ''}/>`;
}

export function dot(cx: number, cy: number, r: number, color: string, opacity = 1): string {
  return `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" fill="${color}"${opacity < 1 ? ` opacity="${opacity}"` : ''}/>`;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, color: string, sw = 3, rot = 0): string {
  return `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${color}"${sw ? ` stroke="${INK}" stroke-width="${sw}"` : ''}${rot ? ` transform="rotate(${rot} ${f1(cx)} ${f1(cy)})"` : ''}/>`;
}

let gid = 0;

/** 柔光晕（径向渐变） */
export function glow(cx: number, cy: number, r: number, color: string, opacity = 0.8, ry = r): string {
  const id = `gl${++gid}`;
  return (
    `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="1"/><stop offset="0.4" stop-color="${color}" stop-opacity="0.42"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>` +
    `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(r)}" ry="${f1(ry)}" fill="url(#${id})" opacity="${opacity}"/>`
  );
}

/** 线性渐变填充，返回 [定义, 引用] */
export function lin(stops: [number, string][], x1 = 0, y1 = 0, x2 = 0, y2 = 1): [string, string] {
  const id = `ln${++gid}`;
  const s = stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
  return [`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${s}</linearGradient>`, `url(#${id})`];
}

export function g(body: string, transform = '', extra = ''): string {
  return `<g${transform ? ` transform="${transform}"` : ''}${extra}>${body}</g>`;
}

/** 以 (cx,cy) 为中心旋转、缩放 */
export function place(body: string, cx: number, cy: number, s = 1, rot = 0, flip = false): string {
  return g(body, `translate(${f1(cx)} ${f1(cy)}) rotate(${f1(rot)}) scale(${flip ? -s : s} ${s})`);
}

/** 星形路径 */
export function starPath(cx: number, cy: number, r1: number, r2: number, n = 5, rot = -90): string {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    d += `${i ? 'L' : 'M'}${f1(cx + r * Math.cos(a))} ${f1(cy + r * Math.sin(a))} `;
  }
  return d + 'Z';
}

/** 不规则的爆裂形 */
export function burstPath(cx: number, cy: number, r1: number, r2: number, n: number, r: () => number): string {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const rr = (i % 2 ? r2 : r1) * (0.8 + r() * 0.4);
    const a = ((i * 180) / n + r() * 8) * (Math.PI / 180);
    d += `${i ? 'L' : 'M'}${f1(cx + rr * Math.cos(a))} ${f1(cy + rr * Math.sin(a))} `;
  }
  return d + 'Z';
}

/**
 * 公共滤镜：
 *  - paint：墨线轻微抖动 + 以轮廓为高度图的漫反射光照，给平涂色块加上体积
 *  - soft：模糊（光晕、烟雾）
 *  - grain：画布颗粒
 */
export function defs(seed = 3): string {
  return `<defs>
<radialGradient id="vig" cx="50%" cy="45%" r="75%"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.75"/></radialGradient>
<filter id="paint" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="${seed}" result="t"/>
<feDisplacementMap in="SourceGraphic" in2="t" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="d"/>
<feGaussianBlur in="SourceAlpha" stdDeviation="2.6" result="b"/>
<feDiffuseLighting in="b" surfaceScale="3.2" diffuseConstant="1" lighting-color="#fff" result="l"><feDistantLight azimuth="235" elevation="52"/></feDiffuseLighting>
<feComposite in="d" in2="l" operator="arithmetic" k1="1.28" k2="0" k3="0" k4="0" result="m"/>
<feComposite in="m" in2="d" operator="in"/>
</filter>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="soft2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>
<filter id="grain" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seed + 11}" stitchTiles="stitch"/>
<feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 1.4 -0.55"/>
</filter>
</defs>`;
}

/** 组装完整的 SVG 文档 */
export function doc(w: number, h: number, body: string, seed = 3): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">${defs(seed)}${body}</svg>`;
}

/** 画布颗粒层 */
export function grain(w: number, h: number, opacity = 0.35): string {
  return `<rect width="${w}" height="${h}" filter="url(#grain)" opacity="${opacity}" style="mix-blend-mode:overlay"/>`;
}

export function vignette(w: number, h: number, opacity = 1): string {
  return `<rect width="${w}" height="${h}" fill="url(#vig)" opacity="${opacity}"/>`;
}

export function toUri(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** 带缓存的 data URI 生成 */
export function memo<A extends unknown[]>(fn: (...a: A) => string): (...a: A) => string {
  const cache = new Map<string, string>();
  return (...a: A) => {
    const k = a.join('|');
    let v = cache.get(k);
    if (v === undefined) {
      v = toUri(fn(...a));
      cache.set(k, v);
    }
    return v;
  };
}
