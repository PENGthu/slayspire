// 通用小组件：终局计分卡、玩家标记条、按钮组、弹窗外壳。
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { SCORING_CARDS } from '../../game/content';
import { cpPoints, END_THRESHOLD } from '../../game/rules';
import type { PlayerState } from '../../game/types';

export function ScoringCardView({ id, selected, onClick, current }: { id: string; selected?: boolean; onClick?: () => void; current?: number }) {
  const s = SCORING_CARDS[id];
  return (
    <div class={`scoring-card ${selected ? 'selected' : ''} ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div class="sc-head">
        <span class="emoji">{s.emoji}</span>
        <b>{s.name}</b>
      </div>
      <div class="sc-text">终局计分：{s.text}</div>
      <div class="sc-tiers">
        {s.tiers.map(([need, cp]) => (
          <span class={current !== undefined && current >= need ? 'hit' : ''}>
            ≥{need} → <b class="r-cp">{cp}</b>
          </span>
        ))}
      </div>
      {current !== undefined && <div class="sc-cur">当前：{current}</div>}
    </div>
  );
}

/** 两个标记相向而行：吸引力从左，保护点数换算分从右，交错部分就是得分 */
export function ScoreBar({ p, thin }: { p: PlayerState; thin?: boolean }) {
  const max = END_THRESHOLD + 30;
  const a = Math.min(max, p.appeal);
  const c = Math.min(max, cpPoints(p.cp));
  const cpStart = END_THRESHOLD - c;
  const overlap = a - cpStart;
  return (
    <div class={`score-bar ${thin ? 'thin' : ''}`} title={`吸引力 ${p.appeal}，保护点数 ${p.cp}（${cpPoints(p.cp)} 分）。两者相加 ≥ ${END_THRESHOLD} 时标记相遇。`}>
      <div class="sb-track">
        <div class="sb-appeal" style={{ width: `${(a / max) * 100}%` }} />
        <div class="sb-cp" style={{ left: `${(Math.max(0, cpStart) / max) * 100}%`, width: `${((END_THRESHOLD - Math.max(0, cpStart)) / max) * 100}%` }} />
        <div class="sb-goal" style={{ left: `${(END_THRESHOLD / max) * 100}%` }} />
        <div class="sb-mark a" style={{ left: `${(a / max) * 100}%`, background: p.color }} />
        <div class="sb-mark c" style={{ left: `${(Math.max(0, cpStart) / max) * 100}%`, borderColor: p.color }} />
      </div>
      {!thin && (
        <div class="sb-score">
          {overlap >= 0 ? <b class="pos">+{overlap}</b> : <b class="neg">{overlap}</b>}
        </div>
      )}
    </div>
  );
}

export function Modal({ title, children, onClose, wide }: { title?: ComponentChildren; children: ComponentChildren; onClose?: () => void; wide?: boolean }) {
  return (
    <div class="modal-bg" onClick={onClose}>
      <div class={`modal ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        {(title || onClose) && (
          <div class="modal-head">
            <h3>{title}</h3>
            {onClose && (
              <button class="x" onClick={onClose} title="关闭">
                ✕
              </button>
            )}
          </div>
        )}
        <div class="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Stat({
  icon,
  value,
  title,
  cls,
  num,
  owner,
}: {
  icon: string;
  value: ComponentChildren;
  title: string;
  cls?: string;
  /** 数值：变化时浮出 +n / −n */
  num?: number;
  /** 数值属于谁（切换查看的玩家时不显示变化） */
  owner?: number;
}) {
  const prev = useRef<{ num?: number; owner?: number }>({ num, owner });
  const [deltas, setDeltas] = useState<{ key: number; d: number }[]>([]);
  useEffect(() => {
    const p = prev.current;
    if (num !== undefined && p.num !== undefined && p.owner === owner && num !== p.num) {
      const key = Date.now() + Math.random();
      const d = num - p.num;
      setDeltas((xs) => [...xs, { key, d }]);
      setTimeout(() => setDeltas((xs) => xs.filter((x) => x.key !== key)), 1600);
    }
    prev.current = { num, owner };
  }, [num, owner]);
  return (
    <span class={`stat ${cls ?? ''}`} title={title}>
      <i>{icon}</i>
      {value}
      {deltas.map((x) => (
        <em class={`delta ${x.d > 0 ? 'up' : 'down'}`} key={x.key}>
          {x.d > 0 ? `+${x.d}` : x.d}
        </em>
      ))}
    </span>
  );
}
