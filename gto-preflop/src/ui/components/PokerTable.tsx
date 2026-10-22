import type { Card } from '../../poker/cards';
import { fmtBB, type SpotNode, tableState } from '../../engine/types';
import { PlayingCard } from './PlayingCard';

const rad = (deg: number) => (deg * Math.PI) / 180;

/** 椭圆牌桌：我坐在正下方，其他人按顺时针（行动顺序）排开 */
export function PokerTable({ node, cards }: { node: SpotNode; cards?: [Card, Card] }) {
  const st = tableState(node);
  const n = node.seats.length;
  const heroIdx = node.seats.indexOf(node.hero);
  const dealerPos = n === 2 ? 'SB' : 'BTN';
  const allinTo = node.stack;
  return (
    <div class="table-wrap" role="img" aria-label={`牌桌：${node.title}`}>
      <div class="felt">
        <div class="felt-logo">PREFLOP LAB</div>
      </div>
      <div class="pot">
        底池
        <b class="num">{fmtBB(st.pot)}bb</b>
      </div>
      {node.seats.map((pos, i) => {
        const k = (i - heroIdx + n) % n;
        const theta = rad(90 + (k * 360) / n);
        const x = 50 + 43 * Math.cos(theta);
        const y = 50 + 41 * Math.sin(theta);
        // 我的下注放在手牌右侧，避免被牌挡住
        const bx = k === 0 ? 64 : 50 + 26 * Math.cos(theta);
        const by = k === 0 ? 74 : 50 + 23 * Math.sin(theta);
        const isHero = pos === node.hero;
        const folded = st.folded.has(pos);
        const bet = st.bets[pos] ?? 0;
        const behind = node.stack - bet;
        const tone = bet >= allinTo ? 'var(--a-allin)' : bet > 1 ? 'var(--a-raise)' : 'var(--a-fold)';
        return (
          <>
            <div
              class={`seat${folded ? ' folded' : ''}${isHero ? ' hero acting' : ''}`}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {!isHero && !folded && (
                <div class="seat-cards" aria-hidden="true">
                  <PlayingCard back />
                  <PlayingCard back />
                </div>
              )}
              <div class="seat-plate">
                <div class="pos">{pos}</div>
                <div class="stk num">{behind <= 0 ? '全下' : `${fmtBB(behind)}bb`}</div>
              </div>
              {folded && <span class="seat-tag">弃牌</span>}
              {isHero && <span class="seat-tag">你</span>}
            </div>
            {bet > 0 && (
              <div class="bet num" style={{ left: `${bx}%`, top: `${by}%` }}>
                <span class="chipstack" style={{ '--chip': tone }} />
                {fmtBB(bet)}
              </div>
            )}
            {pos === dealerPos && (
              <div
                class="dealer"
                style={{ left: `${50 + 34 * Math.cos(theta - rad(14))}%`, top: `${50 + 32 * Math.sin(theta - rad(14))}%` }}
              >
                D
              </div>
            )}
          </>
        );
      })}
      {cards && (
        <div class="hero-cards pop" key={`${cards[0]}-${cards[1]}`}>
          <PlayingCard card={cards[0]} />
          <PlayingCard card={cards[1]} />
        </div>
      )}
    </div>
  );
}
