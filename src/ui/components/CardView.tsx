import type { CSSProperties, JSX } from 'preact';
import {
  AFFLICTIONS,
  KEYWORDS,
  TYPE_NAMES,
  baseCost,
  cardDef,
  cardKeywords,
  cardName,
  cardText,
  displayCost,
  isUnplayable,
  isX,
  starCost,
} from '../../game/cards';
import type { Combat } from '../../game/combat';
import { ENCHANTS } from '../../game/registry';
import type { Card, Enemy } from '../../game/types';
import { cardArtUrl } from '../art/cardArt';
import type { TipData } from './Tooltip';

export interface CardViewProps {
  card: Card;
  g?: Combat | null;
  target?: Enemy | null;
  size?: 'sm' | 'md' | 'lg';
  cls?: string;
  style?: CSSProperties;
  onClick?: (e: MouseEvent) => void;
  onPointerDown?: (e: PointerEvent) => void;
  onPointerEnter?: (e: PointerEvent) => void;
  onPointerLeave?: (e: PointerEvent) => void;
  dataUid?: boolean;
}

export function cardTips(c: Card): TipData[] {
  const tips: TipData[] = [];
  for (const k of cardKeywords(c)) {
    if (KEYWORDS[k]) tips.push({ title: k, body: KEYWORDS[k] });
  }
  if (c.ench) {
    const e = ENCHANTS[c.ench.id];
    if (e) tips.push({ title: `附魔：${e.name}`, body: e.desc(c.ench.n), color: e.color });
  }
  if (c.afflict && AFFLICTIONS[c.afflict]) {
    const a = AFFLICTIONS[c.afflict];
    tips.push({ title: `苦难：${a.name}`, body: a.desc, color: '#d68cff' });
  }
  return tips;
}

export function CardView(p: CardViewProps) {
  const { card: c, g = null, target = null } = p;
  const d = cardDef(c);
  const segs = cardText(c, g, target);
  const sizeCls = p.size === 'sm' ? 'sm' : p.size === 'lg' ? 'lg' : '';
  let costEl: JSX.Element | null = null;
  if (!isUnplayable(c)) {
    if (isX(c)) costEl = <div class="card-cost">X</div>;
    else {
      const cost = g ? g.costOf(c) : displayCost(c);
      const base = baseCost(c);
      costEl = (
        <div class={`card-cost ${cost < base ? 'cheaper' : cost > base ? 'pricier' : ''}`}>{cost}</div>
      );
    }
  }
  const sc = starCost(c);
  const ench = c.ench ? ENCHANTS[c.ench.id] : null;
  return (
    <div
      class={`card t-${d.type} c-${d.color} r-${d.rarity} ${c.up ? 'up' : ''} ${sizeCls} ${p.cls ?? ''}`}
      style={p.style}
      onClick={p.onClick}
      onPointerDown={p.onPointerDown}
      onPointerEnter={p.onPointerEnter}
      onPointerLeave={p.onPointerLeave}
      data-card={p.dataUid ? c.uid : undefined}
    >
      <div class="card-frame">
        <div class="card-title">{cardName(c)}</div>
        <div class="card-art">
          <img src={cardArtUrl(d)} alt="" draggable={false} />
        </div>
        <div class="card-type">{TYPE_NAMES[d.type]}</div>
        <div class="card-desc">
          <div>
            {segs.map((s, i) =>
              s.k === 'br' ? (
                <br key={i} />
              ) : s.k === 'n' ? (
                <span key={i} class={`n ${s.mod > 0 ? 'up' : s.mod < 0 ? 'down' : ''}`}>
                  {s.s}
                </span>
              ) : s.k === 'kw' ? (
                <span key={i} class="kw">
                  {s.s}
                </span>
              ) : (
                <span key={i}>{s.s}</span>
              ),
            )}
          </div>
        </div>
      </div>
      {costEl}
      {sc > 0 && <div class="card-star">{g ? g.starCostOf(c) : sc}</div>}
      {ench && (
        <div class="card-ench" style={{ '--ec': ench.color } as CSSProperties}>
          {ench.name}
        </div>
      )}
      {c.afflict && AFFLICTIONS[c.afflict] && <div class="card-afflict">{AFFLICTIONS[c.afflict].name}</div>}
    </div>
  );
}
