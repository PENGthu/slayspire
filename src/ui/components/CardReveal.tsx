import { useEffect, useState } from 'preact/hooks';
import type { Reveal, RevealKind, Run } from '../../game/run';
import { refresh } from '../store';
import { CardView } from './CardView';
import { stageInfo } from './Tooltip';

const TITLES: Record<RevealKind, string> = {
  gain: '获得卡牌',
  upgrade: '卡牌升级',
  transform: '卡牌变化',
  enchant: '卡牌附魔',
};

/** 获得、升级、变化、附魔卡牌时，在画面中央展示这些牌（自动消失，点击可跳过） */
export function CardReveal({ run }: { run: Run }) {
  const rv: Reveal | undefined = run.reveals[0];
  const [leaving, setLeaving] = useState(false);
  if (rv) rv.shown = true;
  const close = () => {
    if (run.reveals[0] === rv) run.reveals.shift();
    setLeaving(false);
    refresh();
  };
  useEffect(() => {
    if (!rv) return;
    setLeaving(false);
    const hold = 1500 + rv.cards.length * 300 + (rv.from ? 600 : 0);
    const t1 = setTimeout(() => setLeaving(true), hold);
    const t2 = setTimeout(close, hold + 280);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [rv?.id]);
  if (!rv) return null;
  // 升级、变化一两张牌时并排展示「之前 → 之后」
  const pairs = !!rv.from && rv.from.length === rv.cards.length && (rv.kind === 'transform' || rv.cards.length <= 2);
  const portrait = stageInfo.w < stageInfo.h;
  const many = rv.cards.length > (portrait ? 2 : 3) || (pairs && rv.cards.length > 1) || (pairs && portrait);
  const size = many ? 'sm' : 'md';
  return (
    <div class={`card-reveal ${leaving ? 'leaving' : ''}`}>
      <div class="rv-panel" onClick={close}>
        <h3>{TITLES[rv.kind]}</h3>
        <div class="rv-cards">
          {rv.cards.map((c, i) =>
            pairs ? (
              <div class="rv-pair" key={i}>
                <CardView card={rv.from![i]} size={size} cls="rv-old" />
                <span class="rv-arrow">➜</span>
                <CardView card={c} size={size} />
              </div>
            ) : (
              <CardView key={i} card={c} size={size} />
            ),
          )}
        </div>
        <div class="rv-hint">点击继续</div>
      </div>
    </div>
  );
}
