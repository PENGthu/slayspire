/**
 * 界面切换的过渡。
 *
 * 切换画面、关闭弹窗、换幕时，Preact 直接把旧 DOM 换掉，画面会“跳”一下。这里监听舞台上的
 * DOM 变化：带过渡标记的元素被移除时，把它原样放回原处（不再响应点击，也不再更新），淡出后
 * 再真正移除；新画面同时淡入。于是旧画面渐隐、新画面渐显，交叉过渡。
 *
 * 处理三类元素：
 * - `.xfade`：可切换的画面（由 `Swap` 生成），放回时沿用接替它的新画面的位置与尺寸；
 * - `.overlay`：各种弹窗（铺满定位父元素，原样放回即可）；
 * - `.bg`：场景背景（同上），新背景在下，旧背景淡出，形成交叉淡化。
 */
import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';

/** 被移除时需要淡出的元素 */
const EXIT_SEL = ['xfade', 'overlay', 'bg'];
/** 淡出的最长时长（毫秒）；动画事件丢失时按这个时间兜底移除 */
const MAX_EXIT_MS = 1000;

/** 记录各滚动区域最后的滚动位置：元素移出文档后滚动位置会归零，放回时需要恢复 */
const scrolls = new WeakMap<Element, [number, number]>();

function isExiting(n: Node): n is HTMLElement {
  if (!(n instanceof HTMLElement) || n.classList.contains('xf-ghost')) return false;
  return EXIT_SEL.some((c) => n.classList.contains(c));
}

function restoreScroll(root: HTMLElement) {
  const all = [root, ...root.querySelectorAll('*')];
  for (const el of all) {
    const s = scrolls.get(el);
    if (s) {
      el.scrollLeft = s[0];
      el.scrollTop = s[1];
    }
  }
}

/** 把已被移除的元素作为“残影”放回原处并淡出 */
function ghost(el: HTMLElement, parent: Node, before: Node | null, added: HTMLElement[]) {
  if (!parent.isConnected) return;
  el.classList.add('xf-ghost');
  el.classList.remove('xfade-in');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('inert', '');
  if (el.classList.contains('xfade')) {
    // 画面在文档流中，放回时改为绝对定位，占据接替它的新画面的位置
    const next = added.find((a) => a.parentNode === parent && a.classList.contains('xfade'));
    const box = next ?? (parent as HTMLElement);
    Object.assign(el.style, {
      position: 'absolute',
      left: `${next ? next.offsetLeft : 0}px`,
      top: `${next ? next.offsetTop : 0}px`,
      width: `${box.offsetWidth}px`,
      height: `${box.offsetHeight}px`,
      margin: '0',
    });
  }
  parent.insertBefore(el, before && before.parentNode === parent ? before : null);
  restoreScroll(el);
  // 重新插入文档会让里面的 CSS 动画从头播放（如「战斗开始」横幅、抽牌飞入），
  // 一次性的动画直接跳到结束状态，保持移除前的样子
  for (const a of el.getAnimations?.({ subtree: true }) ?? []) {
    if ((a as CSSAnimation).animationName === 'xf-out') continue;
    if (a.effect?.getComputedTiming().endTime !== Infinity) a.finish();
  }
  let done = false;
  const remove = () => {
    if (done) return;
    done = true;
    el.remove();
  };
  el.addEventListener('animationend', (e) => e.target === el && remove());
  setTimeout(remove, MAX_EXIT_MS);
}

/** 在舞台上启用过渡；返回停止函数 */
export function installTransitions(stage: HTMLElement): () => void {
  const onScroll = (e: Event) => {
    const t = e.target;
    if (t instanceof Element) scrolls.set(t, [t.scrollLeft, t.scrollTop]);
  };
  stage.addEventListener('scroll', onScroll, true);
  const mo = new MutationObserver((records) => {
    const added: HTMLElement[] = [];
    for (const r of records) for (const n of r.addedNodes) if (n instanceof HTMLElement) added.push(n);
    for (const r of records) {
      for (const n of r.removedNodes) {
        if (isExiting(n) && !n.isConnected) ghost(n, r.target, r.nextSibling, added);
      }
    }
  });
  mo.observe(stage, { childList: true, subtree: true });
  return () => {
    mo.disconnect();
    stage.removeEventListener('scroll', onScroll, true);
  };
}

/**
 * 可切换的画面容器：k 变化时换成新的容器（新画面淡入，旧画面由上面的监听淡出）。
 * appear=false 时，第一次出现不做淡入（例如外层已经在淡入）。
 */
export function Swap({ k, cls, appear = true, children }: { k: string; cls: string; appear?: boolean; children: ComponentChildren }) {
  const firstKey = useRef(k);
  const animate = appear || k !== firstKey.current;
  return (
    <div key={k} class={`xfade ${cls}${animate ? ' xfade-in' : ''}`}>
      {children}
    </div>
  );
}
