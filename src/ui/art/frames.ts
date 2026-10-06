/**
 * 卡框素材：卷轴式标题缎带、卡面纹理。以 data URI 的形式注入为 CSS 变量。
 */
import { toUri } from './kit';
import { parchmentUrl } from './mapArt';
import { rasterize } from './raster';

const RIBBONS: Record<string, [string, string, string]> = {
  // 主色、暗部、高光
  basic: ['#7c7e86', '#45464c', '#c8cad2'],
  common: ['#7c7e86', '#45464c', '#c8cad2'],
  uncommon: ['#3f78b8', '#1f3f66', '#9cc8f0'],
  rare: ['#cf9a32', '#7a5212', '#ffe49a'],
  special: ['#3f9a8f', '#1c4f4a', '#a8eee2'],
  curse: ['#5a2a68', '#2a1032', '#c08ad6'],
  status: ['#55585f', '#2a2c30', '#a8acb4'],
};

function ribbon([main, dark, light]: [string, string, string]): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 36" preserveAspectRatio="none">
<g transform="translate(0 1.6)" opacity="0.45" fill="#000"><path d="M1 11 L20 11 L20 34 L1 34 L9 22.5 Z M199 11 L180 11 L180 34 L199 34 L191 22.5 Z M13 5 Q100 -1 187 5 L187 29 Q100 23 13 29 Z"/></g>
<path d="M1 11 L20 11 L20 34 L1 34 L9 22.5 Z" fill="${dark}" stroke="#120c08" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M199 11 L180 11 L180 34 L199 34 L191 22.5 Z" fill="${dark}" stroke="#120c08" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M14 28 L20 34 L20 28 Z M186 28 L180 34 L180 28 Z" fill="#000" opacity="0.5"/>
<path d="M13 5 Q100 -1 187 5 L187 29 Q100 23 13 29 Z" fill="${main}" stroke="#120c08" stroke-width="2" stroke-linejoin="round"/>
<path d="M16 8 Q100 2 184 8" fill="none" stroke="${light}" stroke-width="1.6" opacity="0.7"/>
<path d="M16 26 Q100 20 184 26" fill="none" stroke="#000" stroke-width="2" opacity="0.25"/>
</svg>`;
}

function texture(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
<filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" seed="4" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.9 -0.25"/></filter>
<filter id="m" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="3" seed="9" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 1.2 -0.35"/></filter>
<rect width="180" height="180" filter="url(#m)"/><rect width="180" height="180" filter="url(#n)" opacity="0.55"/>
</svg>`;
}

/** 注入卡框相关的 CSS 变量；纹理和缎带随后换成位图（见 raster.ts） */
export function installArtStyles(): void {
  if (typeof document === 'undefined' || document.getElementById('art-styles')) return;
  const tex = toUri(texture());
  const paper = parchmentUrl();
  const ribbons = Object.entries(RIBBONS).map(([k, v]) => [k, toUri(ribbon(v)), v] as const);
  const build = (url: (svg: string) => string) => {
    let css = `:root{--tex:url("${url(tex)}");--paper:url("${url(paper)}");}`;
    for (const [k, svg, v] of ribbons) css += `.card.r-${k}{--ribbon:url("${url(svg)}");--rim:${v[0]};--rim-light:${v[2]};--rim-dark:${v[1]};}`;
    return css;
  };
  const el = document.createElement('style');
  el.id = 'art-styles';
  el.textContent = build((s) => s);
  document.head.appendChild(el);
  const sizes = new Map<string, [number, number]>([
    [tex, [180, 180]],
    [paper, [420, 420]],
    ...ribbons.map(([, svg]) => [svg, [200, 36]] as [string, [number, number]]),
  ]);
  void Promise.all([...sizes].map(([svg, [w, h]]) => rasterize(svg, w, h).then((b) => [svg, b] as const))).then((pairs) => {
    const m = new Map(pairs);
    el.textContent = build((s) => m.get(s) ?? s);
  });
}
