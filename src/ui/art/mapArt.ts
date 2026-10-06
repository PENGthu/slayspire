/**
 * 地图：羊皮纸纹理与墨水绘制的房间图标。
 */
import type { RoomKind } from '../../game/types';
import { memo, starPath } from './kit';

const INKC = '#3a2616';
const RED = '#7a1e14';

function icon(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-32 -32 64 64" width="64" height="64"><filter id="w"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="1.6" xChannelSelector="R" yChannelSelector="G"/></filter><g filter="url(#w)" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
}

const p = (d: string, fill = 'none', stroke = INKC, w = 3) => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;

const ICONS: Record<string, () => string> = {
  // 普通敌人：獠牙怪物的头
  monster: () =>
    p('M-18 -10 C-20 -24 -8 -28 0 -28 C8 -28 20 -24 18 -10 C18 4 12 14 0 18 C-12 14 -18 4 -18 -10 Z', '#c8b088') +
    p('M-18 -16 L-26 -26 L-14 -22 M18 -16 L26 -26 L14 -22', 'none') +
    p('M-11 -8 L-3 -4 L-11 -1 Z', INKC, INKC, 2) +
    p('M11 -8 L3 -4 L11 -1 Z', INKC, INKC, 2) +
    p('M-9 6 L-6 13 L-3 7 L0 13 L3 7 L6 13 L9 6', 'none', INKC, 2.4),
  // 精英：长角的恶魔面具
  elite: () =>
    p('M-14 -14 C-26 -20 -30 -30 -26 -34 C-18 -26 -12 -22 -6 -20 Z', RED, INKC, 2.4) +
    p('M14 -14 C26 -20 30 -30 26 -34 C18 -26 12 -22 6 -20 Z', RED, INKC, 2.4) +
    p('M-20 -12 C-20 -26 20 -26 20 -12 C22 6 12 20 0 24 C-12 20 -22 6 -20 -12 Z', '#b0583a') +
    p('M-13 -6 L-3 -1 L-12 2 Z', INKC, INKC, 2) +
    p('M13 -6 L3 -1 L12 2 Z', INKC, INKC, 2) +
    p('M-10 10 C-4 15 4 15 10 10 L7 17 C2 19 -2 19 -7 17 Z', INKC, INKC, 2),
  // 休息处：篝火
  rest: () =>
    p('M-22 20 L22 12 M-22 12 L22 20', 'none', INKC, 4) +
    p('M0 14 C-14 14 -16 2 -12 -6 C-10 -12 -6 -14 -6 -22 C0 -16 2 -12 2 -8 C4 -14 8 -18 8 -24 C16 -14 18 -2 14 6 C12 12 6 14 0 14 Z', '#d8742a') +
    p('M0 12 C-6 12 -8 6 -6 0 C-4 -4 -2 -6 -2 -10 C2 -6 4 -2 4 2 C6 0 8 -2 8 -4 C10 2 10 8 6 10 C4 12 2 12 0 12 Z', '#f2c048', 'none', 0),
  // 商人：钱袋
  shop: () =>
    p('M-8 -18 L8 -18 L4 -10 C18 -6 24 8 20 18 C16 26 -16 26 -20 18 C-24 8 -18 -6 -4 -10 Z', '#c8a060') +
    p('M-10 -24 C-6 -18 6 -18 10 -24', 'none') +
    p('M-6 -10 L6 -10', 'none') +
    `<text x="0" y="14" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="18" fill="${INKC}">$</text>`,
  // 未知：问号
  event: () =>
    p('M-9 -12 C-9 -26 13 -26 13 -12 C13 -2 2 0 2 10', 'none', INKC, 5.5) +
    `<circle cx="2" cy="20" r="3.6" fill="${INKC}"/>`,
  // 宝箱
  treasure: () =>
    p('M-22 -4 L22 -4 L22 20 L-22 20 Z', '#b07a3a') +
    p('M-22 -4 C-22 -20 22 -20 22 -4 Z', '#c8904a') +
    p('M-22 4 L22 4', 'none', INKC, 2.4) +
    p('M-4 -2 L4 -2 L4 10 L-4 10 Z', '#e8c060', INKC, 2) +
    p('M-14 -12 L-14 20 M14 -12 L14 20', 'none', INKC, 2),
  ancient: () => `<path d="${starPath(0, 0, 22, 8, 4)}" fill="#e8c060" stroke="${INKC}" stroke-width="3"/>`,
  boss: () => p('M-20 -6 C-22 -26 22 -26 20 -6 C20 10 12 18 0 20 C-12 18 -20 10 -20 -6 Z', '#c8b088') + `<circle cx="-8" cy="-6" r="5" fill="${INKC}"/><circle cx="8" cy="-6" r="5" fill="${INKC}"/>`,
};

const iconCache = memo((k: string) => icon((ICONS[k] ?? ICONS.event)()));

export function mapIconUrl(k: RoomKind | string): string {
  return iconCache(k);
}

/** 羊皮纸纹理 */
function parchment(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">
<filter id="st" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="7" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.28  0 0 0 0 0.12  0 0 0 2.2 -1.05"/></filter>
<filter id="fi" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.06" numOctaves="2" seed="2" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.24  0 0 0 0 0.12  0 0 0 1.6 -0.8"/></filter>
<filter id="gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="5" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.2  0 0 0 0 0.1  0 0 0 0.9 -0.35"/></filter>
<rect width="420" height="420" fill="#e4d2a8"/>
<rect width="420" height="420" filter="url(#st)" opacity="0.55"/>
<rect width="420" height="420" filter="url(#fi)" opacity="0.35"/>
<rect width="420" height="420" filter="url(#gr)" opacity="0.5"/>
</svg>`;
}

const paperCache = memo(() => parchment());

export function parchmentUrl(): string {
  return paperCache();
}
