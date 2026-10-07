/**
 * 收获动画：拿到的东西从来源位置飞向顶栏（金币、药水栏、遗物栏、牌组），落地时目标轻轻弹一下。
 * 飞行的是来源元素的复制品，挂在舞台上、不响应点击，结束后移除。
 */
import { rectInStage, stageInfo } from './components/Tooltip';

/** 让元素弹一下（重复触发时从头播放） */
export function pop(el: Element) {
  el.classList.remove('gain-pop');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('gain-pop');
  setTimeout(() => el.classList.remove('gain-pop'), 500);
}

/**
 * 从 src 飞向 findTarget() 找到的元素。目标在这次操作渲染之后才出现（新遗物、刚放进栏位的药水），
 * 所以等两帧再找。
 */
export function flyGain(
  src: Element,
  findTarget: () => Element | null,
  opts: { endScale?: number; duration?: number; hideTarget?: boolean } = {},
) {
  const stage = stageInfo.el;
  if (!stage || typeof (src as HTMLElement).animate !== 'function') return;
  const from = rectInStage(src);
  const w = from.r - from.l;
  const h = from.b - from.t;
  if (w <= 0 || h <= 0) return;
  const ghost = src.cloneNode(true) as HTMLElement;
  ghost.classList.remove('hovered', 'picked', 'dragging');
  ghost.classList.add('gain-fly');
  ghost.removeAttribute('style');
  Object.assign(ghost.style, {
    position: 'absolute',
    left: `${from.l}px`,
    top: `${from.t}px`,
    width: `${w}px`,
    height: `${h}px`,
    margin: '0',
    zIndex: '400',
    pointerEvents: 'none',
  });
  stage.appendChild(ghost);
  const duration = opts.duration ?? 560;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const target = findTarget();
      if (!target) {
        ghost.remove();
        return;
      }
      // 新出现的遗物、药水先藏起来，等飞到了再显示，免得同时看到两个
      const hidden = opts.hideTarget ? ((target.querySelector('.item-icon') as HTMLElement | null) ?? (target as HTMLElement)) : null;
      if (hidden) hidden.style.visibility = 'hidden';
      const to = rectInStage(target);
      const dx = (to.l + to.r) / 2 - (from.l + from.r) / 2;
      const dy = (to.t + to.b) / 2 - (from.t + from.b) / 2;
      const s = opts.endScale ?? Math.min(1, Math.max(0.15, (to.r - to.l) / w));
      const anim = ghost.animate(
        [
          { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
          // 先略微抬起放大，再沿弧线落向目标
          { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 50}px) scale(${Math.max(s, 1) * 1.08})`, opacity: 1, offset: 0.35 },
          { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.85 },
        ],
        { duration, easing: 'cubic-bezier(0.4, 0, 0.25, 1)' },
      );
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        ghost.remove();
        if (hidden) hidden.style.visibility = '';
        pop(target);
      };
      anim.onfinish = finish;
      setTimeout(finish, duration + 250);
    }),
  );
}

/** 顶栏上的收获目标 */
export const gainTargets = {
  gold: () => document.querySelector('.topbar .tb-gold'),
  deck: () => document.querySelector('.topbar [aria-label="查看牌组"]'),
  potion: (slot: number) => () => document.querySelectorAll('.topbar .tb-potions .potion-slot')[slot] ?? null,
  relic: (id: string) => () => document.querySelector(`.relic-bar [data-relic="${id}"]`),
};
