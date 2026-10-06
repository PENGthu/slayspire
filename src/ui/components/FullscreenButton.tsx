import { isFullscreen, showFullscreenButton, toggleFullscreen } from '../fullscreen';
import { tipProps } from './Tooltip';

/** 四角箭头图标：进入全屏向外，退出全屏向内 */
function FsIcon({ exit }: { exit: boolean }) {
  const d = exit
    ? 'M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6'
    : 'M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6';
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** 顶栏 / 主菜单上的全屏切换按钮；浏览器不支持或已是主屏幕应用时不显示 */
export function FullscreenButton({ cls = 'tb-btn' }: { cls?: string }) {
  if (!showFullscreenButton()) return null;
  const on = isFullscreen();
  return (
    <button
      class={`${cls} fs-btn`}
      aria-label={on ? '退出全屏' : '全屏'}
      {...tipProps([{ title: on ? '退出全屏' : '全屏', body: on ? '按 F 或 Esc 也可以退出。' : '铺满整个屏幕。按 F 也可以切换。' }], 'bottom')}
      onClick={toggleFullscreen}
    >
      <FsIcon exit={on} />
    </button>
  );
}
