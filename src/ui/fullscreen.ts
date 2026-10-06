/**
 * 全屏模式。
 *
 * 电脑和安卓浏览器用 Fullscreen API；iPhone 的 Safari 不支持网页全屏，只能“添加到主屏幕”后从
 * 图标打开（index.html 里的 apple-mobile-web-app-* 设置让它以全屏应用的样子启动）。
 * 全屏必须由一次点击或按键触发，所以“自动全屏”是在打开游戏后的第一次点击时进入。
 */
import { refresh, state } from './store';

interface FsDocument extends Document {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}
interface FsElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

const doc = () => document as FsDocument;

/** 浏览器是否允许网页进入全屏 */
export function canFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  return !!(doc().fullscreenEnabled || doc().webkitFullscreenEnabled);
}

export function isFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  return !!(doc().fullscreenElement || doc().webkitFullscreenElement);
}

/** 已经作为主屏幕应用打开（本身就是全屏，不需要按钮） */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mm = (q: string) => window.matchMedia?.(q).matches ?? false;
  // 用全屏按钮进入网页全屏时，Chrome 也会匹配 display-mode: fullscreen，所以要排除这种情况
  return (mm('(display-mode: fullscreen)') && !isFullscreen()) || mm('(display-mode: standalone)') || !!(navigator as { standalone?: boolean }).standalone;
}

/** iPhone / iPad 上不支持网页全屏、需要提示“添加到主屏幕”的情况 */
export function needsHomeScreen(): boolean {
  if (typeof navigator === 'undefined' || canFullscreen() || isStandalone()) return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** 是否显示全屏按钮 */
export function showFullscreenButton(): boolean {
  return canFullscreen() && !isStandalone();
}

export async function enterFullscreen(): Promise<boolean> {
  if (isFullscreen()) return true;
  const el = document.documentElement as FsElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else return false;
    return true;
  } catch {
    return false;
  }
}

export async function exitFullscreen(): Promise<void> {
  if (!isFullscreen()) return;
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else await doc().webkitExitFullscreen?.();
  } catch {
    /* 已经退出 */
  }
}

export function toggleFullscreen(): void {
  if (isFullscreen()) void exitFullscreen();
  else void enterFullscreen();
}

let installed = false;

/** 监听全屏状态变化、F 键切换，以及“自动全屏”的第一次点击 */
export function installFullscreen(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const onChange = () => refresh();
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if ((e.key === 'f' || e.key === 'F') && showFullscreenButton()) toggleFullscreen();
  });
  const auto = () => {
    window.removeEventListener('pointerup', auto, true);
    window.removeEventListener('keyup', auto, true);
    if (state.profile.settings.autoFullscreen && showFullscreenButton()) void enterFullscreen();
  };
  // 必须在用户手势里请求：用 pointerup / keyup（浏览器把它们算作一次“激活”）
  window.addEventListener('pointerup', auto, true);
  window.addEventListener('keyup', auto, true);
}
