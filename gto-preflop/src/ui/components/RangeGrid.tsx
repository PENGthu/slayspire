import { useRef } from 'preact/hooks';
import { HAND_COMBOS, HAND_COUNT, HAND_LABELS } from '../../poker/cards';
import { freqAt, type SpotNode } from '../../engine/types';

interface Props {
  node: SpotNode;
  /** 当前题目的手牌（黑框） */
  highlight?: number;
  /** 选中查看的手牌（金框） */
  selected?: number | null;
  /** 只突出采取这个行动的手牌 */
  filterAction?: number | null;
  compact?: boolean;
  onHover?: (h: number | null) => void;
  onSelect?: (h: number) => void;
  /** 提供时可以按住拖动来涂抹 */
  paint?: (h: number) => void;
}

/** 13×13 策略矩阵：每格按行动频率分色（激进在左、弃牌在右），填充高度表示到达此处的比例 */
export function RangeGrid({ node, highlight, selected, filterAction, compact, onHover, onSelect, paint }: Props) {
  const k = node.actions.length;
  const painting = useRef(false);
  const last = useRef(-1);

  const cellAt = (e: PointerEvent): number | null => {
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const h = el?.closest<HTMLElement>('[data-h]')?.dataset.h;
    return h == null ? null : Number(h);
  };
  const handlers = paint
    ? {
        onPointerDown: (e: PointerEvent) => {
          const h = cellAt(e);
          if (h == null) return;
          painting.current = true;
          last.current = h;
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          paint(h);
        },
        onPointerMove: (e: PointerEvent) => {
          if (!painting.current) return;
          const h = cellAt(e);
          if (h == null || h === last.current) return;
          last.current = h;
          paint(h);
        },
        onPointerUp: () => {
          painting.current = false;
          last.current = -1;
        },
        onPointerCancel: () => {
          painting.current = false;
        },
      }
    : {};

  return (
    <div
      class={`grid${compact ? ' compact' : ''}${paint ? ' painting' : ''}`}
      onPointerLeave={() => onHover?.(null)}
      {...handlers}
    >
      {Array.from({ length: HAND_COUNT }, (_, h) => {
        const reach = node.heroReach[h];
        const none = reach <= 1e-4;
        const usesFilter = filterAction != null && !none && freqAt(node, h, filterAction) > 0.005;
        const cls = ['cell'];
        if (none) cls.push('none');
        if (h === highlight) cls.push('hl');
        if (h === selected) cls.push('sel');
        if (filterAction != null && !usesFilter) cls.push('dim');
        return (
          <div
            class={cls.join(' ')}
            data-h={h}
            title={compact ? undefined : HAND_LABELS[h]}
            onPointerEnter={() => onHover?.(h)}
            onClick={() => onSelect?.(h)}
          >
            {!none && (
              <div class="fill" style={{ height: `${Math.max(8, reach * 100)}%` }}>
                {Array.from({ length: k }, (_, i) => k - 1 - i).map((a) => {
                  const f = freqAt(node, h, a);
                  return f > 0.001 ? <span class={`tone-${node.actions[a].tone}`} style={{ width: `${f * 100}%` }} /> : null;
                })}
              </div>
            )}
            <span class="lab">{HAND_LABELS[h]}</span>
          </div>
        );
      })}
    </div>
  );
}

export interface ActionTotal {
  combos: number;
  share: number;
}

/** 每个行动在到达范围中所占的组合数与比例 */
export function actionTotals(node: SpotNode): { totals: ActionTotal[]; reachCombos: number } {
  const k = node.actions.length;
  const c = new Array(k).fill(0);
  let reach = 0;
  for (let h = 0; h < HAND_COUNT; h++) {
    const w = node.heroReach[h] * HAND_COMBOS[h];
    if (w <= 0) continue;
    reach += w;
    for (let a = 0; a < k; a++) c[a] += w * freqAt(node, h, a);
  }
  return { totals: c.map((combos) => ({ combos, share: reach > 0 ? combos / reach : 0 })), reachCombos: reach };
}

/** 图例：点击某个行动只突出这些手牌 */
export function Legend({ node, active, onToggle }: { node: SpotNode; active: number | null; onToggle: (a: number | null) => void }) {
  const { totals } = actionTotals(node);
  const order = node.actions.map((_, i) => node.actions.length - 1 - i);
  return (
    <div class="legend">
      {order.map((a) => (
        <button type="button" aria-pressed={active === a} onClick={() => onToggle(active === a ? null : a)}>
          <span class={`sw tone-${node.actions[a].tone}`} />
          <span>{node.actions[a].label}</span>
          <span class="num">{(totals[a].share * 100).toFixed(1)}%</span>
          <span class="cmb num">{totals[a].combos.toFixed(0)} 组合</span>
        </button>
      ))}
    </div>
  );
}

/** 单手牌的混合频率条 */
export function MixBar({ node, hand }: { node: SpotNode; hand: number }) {
  const k = node.actions.length;
  return (
    <div class="mixbar" aria-hidden="true">
      {Array.from({ length: k }, (_, i) => k - 1 - i).map((a) => {
        const f = freqAt(node, hand, a);
        return f > 0.001 ? <span class={`tone-${node.actions[a].tone}`} style={{ width: `${f * 100}%` }} /> : null;
      })}
    </div>
  );
}
