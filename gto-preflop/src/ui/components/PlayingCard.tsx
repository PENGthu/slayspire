import { type Card, RANKS, SUIT_SYMBOLS, cardRank, cardSuit } from '../../poker/cards';

export function PlayingCard({ card, back }: { card?: Card; back?: boolean }) {
  if (back || card == null) return <div class="pcard back" aria-label="背面朝上的牌" />;
  const s = cardSuit(card);
  const r = RANKS[cardRank(card)];
  return (
    <div class={`pcard s${s}`} aria-label={`${r}${SUIT_SYMBOLS[s]}`}>
      <span class="r">{r === 'T' ? '10' : r}</span>
      <span class="s">{SUIT_SYMBOLS[s]}</span>
    </div>
  );
}

/** 行内文字形式的两张牌，例如 A♠K♦ */
export function HandText({ cards }: { cards: [Card, Card] }) {
  return (
    <span class="hand-text">
      {cards.map((c) => (
        <span class={`s${cardSuit(c)}`}>
          {RANKS[cardRank(c)]}
          {SUIT_SYMBOLS[cardSuit(c)]}
        </span>
      ))}
    </span>
  );
}
