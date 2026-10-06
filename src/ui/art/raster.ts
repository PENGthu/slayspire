/**
 * 把带滤镜的 SVG（纸纹、缎带、卡牌插画、敌人立绘）栅格化成位图。
 *
 * 作为 <img> 或 CSS 背景使用的 SVG 是矢量图：浏览器每次重绘都会重新计算里面的
 * 噪声、模糊、光照滤镜。滚动图鉴、打开牌组时大量卡牌同时重绘，就会明显卡顿。
 * 先画成位图，之后重绘只是复制像素。
 *
 * 栅格化在空闲时排队进行，完成前先显示原来的 SVG；失败时（例如浏览器禁止）也继续用 SVG。
 */
import { useEffect, useState } from 'preact/hooks';

const done = new Map<string, string>();
const jobs = new Map<string, Promise<string>>();
const queue: (() => Promise<void>)[] = [];
let active = 0;
const PARALLEL = 2;

/** 位图的像素倍率：考虑屏幕像素密度和舞台缩放，最高 3 倍 */
let pixelScale = 2;
export function setRasterScale(stageScale: number) {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  pixelScale = Math.min(3, Math.max(1.5, dpr * stageScale * 1.25));
}

const supported = typeof document !== 'undefined' && typeof Image !== 'undefined' && typeof URL !== 'undefined' && !!URL.createObjectURL;

const idle = (fn: () => void) => {
  const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 300 });
  else setTimeout(fn, 16);
};

function pump() {
  while (active < PARALLEL && queue.length) {
    const job = queue.shift()!;
    active++;
    idle(() => {
      void job().finally(() => {
        active--;
        pump();
      });
    });
  }
}

async function render(uri: string, w: number, h: number, scale: number): Promise<string> {
  const img = new Image();
  img.decoding = 'async';
  img.src = uri;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  // WebP 体积约为 PNG 的五分之一（保留透明度）；不支持的浏览器会自动退回 PNG
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.9));
  if (!blob) throw new Error('toBlob failed');
  return URL.createObjectURL(blob);
}

/** 已经栅格化好的位图地址（没有就返回 undefined） */
export function bitmapOf(uri: string): string | undefined {
  return done.get(uri);
}

/**
 * 排队栅格化一张 SVG（w×h 为它的固有尺寸，即显示比例）。
 * 返回位图地址；失败时返回原来的 SVG 地址。
 */
export function rasterize(uri: string, w: number, h: number): Promise<string> {
  const hit = done.get(uri);
  if (hit) return Promise.resolve(hit);
  const running = jobs.get(uri);
  if (running) return running;
  if (!supported || !uri.startsWith('data:image/svg')) return Promise.resolve(uri);
  const p = new Promise<string>((resolve) => {
    queue.push(async () => {
      let out = uri;
      try {
        out = await render(uri, w, h, pixelScale);
      } catch {
        out = uri;
      }
      done.set(uri, out);
      jobs.delete(uri);
      resolve(out);
    });
    pump();
  });
  jobs.set(uri, p);
  return p;
}

/** 组件里使用：先返回 SVG，位图准备好后自动换成位图 */
export function useBitmap(uri: string | null, w: number, h: number): string | null {
  const [, bump] = useState(0);
  const ready = uri ? done.get(uri) : undefined;
  useEffect(() => {
    if (!uri || done.has(uri)) return;
    let live = true;
    void rasterize(uri, w, h).then(() => live && bump((x) => x + 1));
    return () => {
      live = false;
    };
  }, [uri]);
  return ready ?? uri;
}
