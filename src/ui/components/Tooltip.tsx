import { useEffect, useState } from 'preact/hooks';

export interface TipData {
  title?: string;
  sub?: string;
  body: string;
  color?: string;
}

interface TipState {
  tips: TipData[];
  x: number;
  y: number;
  /** 锚点矩形（舞台坐标） */
  rect: { l: number; t: number; r: number; b: number };
  prefer: 'right' | 'left' | 'top' | 'bottom';
}

let cur: TipState | null = null;
const subs = new Set<() => void>();

/** 舞台信息：用于把屏幕坐标转换为舞台坐标 */
export const stageInfo = { el: null as HTMLElement | null, scale: 1, w: 1280, h: 720 };

export function toStage(clientX: number, clientY: number): { x: number; y: number } {
  const el = stageInfo.el;
  if (!el) return { x: clientX, y: clientY };
  const r = el.getBoundingClientRect();
  return { x: (clientX - r.left) / stageInfo.scale, y: (clientY - r.top) / stageInfo.scale };
}

export function rectInStage(el: Element) {
  const r = el.getBoundingClientRect();
  const a = toStage(r.left, r.top);
  const b = toStage(r.right, r.bottom);
  return { l: a.x, t: a.y, r: b.x, b: b.y };
}

export function showTip(el: Element, tips: TipData[], prefer: TipState['prefer'] = 'right') {
  if (!tips.length) return hideTip();
  const rect = rectInStage(el);
  cur = { tips, x: 0, y: 0, rect, prefer };
  subs.forEach((f) => f());
}

export function hideTip() {
  if (!cur) return;
  cur = null;
  subs.forEach((f) => f());
}

/** 给元素绑定悬停提示 */
export function tipProps(tips: TipData[] | (() => TipData[]), prefer: TipState['prefer'] = 'right') {
  return {
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      showTip(e.currentTarget as Element, typeof tips === 'function' ? tips() : tips, prefer);
    },
    onPointerLeave: () => hideTip(),
    onContextMenu: (e: Event) => {
      e.preventDefault();
      showTip(e.currentTarget as Element, typeof tips === 'function' ? tips() : tips, prefer);
    },
  };
}

export function TooltipLayer() {
  const [, set] = useState(0);
  useEffect(() => {
    const f = () => set((x) => x + 1);
    subs.add(f);
    const hide = () => hideTip();
    window.addEventListener('pointerdown', hide);
    return () => {
      subs.delete(f);
      window.removeEventListener('pointerdown', hide);
    };
  }, []);
  if (!cur) return null;
  const { rect, prefer, tips } = cur;
  const W = 290;
  const estH = tips.reduce((s, t) => s + 34 + Math.ceil(t.body.length / 17) * 21, 0);
  let x = 0;
  let y = 0;
  if (prefer === 'right' || prefer === 'left') {
    x = prefer === 'right' ? rect.r + 10 : rect.l - W - 10;
    if (x + W > stageInfo.w - 6) x = rect.l - W - 10;
    if (x < 6) x = Math.min(rect.r + 10, stageInfo.w - W - 6);
    y = rect.t;
  } else {
    x = (rect.l + rect.r) / 2 - W / 2;
    y = prefer === 'top' ? rect.t - estH - 10 : rect.b + 10;
    if (y < 6) y = rect.b + 10;
  }
  x = Math.max(6, Math.min(stageInfo.w - W - 6, x));
  y = Math.max(6, Math.min(stageInfo.h - estH - 6, y));
  return (
    <div class="tooltip" style={{ left: `${x}px`, top: `${y}px`, width: `${W}px` }}>
      {tips.map((t, i) => (
        <div class="tip" key={i}>
          {t.title && <h4 style={t.color ? { color: t.color } : undefined}>{t.title}</h4>}
          {t.sub && <div class="sub">{t.sub}</div>}
          <p>{t.body}</p>
        </div>
      ))}
    </div>
  );
}
