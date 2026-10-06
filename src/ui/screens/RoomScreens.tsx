import { useState } from 'preact/hooks';
import { CHARACTERS } from '../../game/characters';
import { ANCIENTS, EVENTS, POTIONS, RELICS } from '../../game/registry';
import type { Run } from '../../game/run';
import type { Card } from '../../game/types';
import { Portrait } from '../components/Art';
import { CardView, cardTips } from '../components/CardView';
import { hideTip, pointer, showTip, stageInfo, tipProps } from '../components/Tooltip';
import { act, deleteSave, state, refresh } from '../store';
import { eventArtUrl } from '../art/cardArt';
import { figureUrl } from '../art/figureArt';

export function relicTip(id: string) {
  const d = RELICS[id];
  return [{ title: d.name, body: d.desc }];
}

function cardHover(c: Card) {
  return {
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const t = cardTips(c);
      if (t.length) showTip(e.currentTarget as Element, t, 'right');
    },
    onPointerLeave: () => hideTip(),
  };
}

// ============================================================ 奖励
export function RewardScreen({ run }: { run: Run }) {
  const sc = run.screen;
  const [cardIdx, setCardIdx] = useState<number | null>(null);
  if (sc.s !== 'reward') return null;
  const rewards = sc.rewards;
  const pickCard = cardIdx !== null ? rewards[cardIdx] : null;
  return (
    <div class="room">
      <div class="rewards panel">
        <h2>战利品</h2>
        {rewards.map((r, i) => {
          if (r.taken) return null;
          if (r.type === 'gold')
            return (
              <button key={i} class="reward-item" onClick={() => act(() => run.takeReward(i))}>
                <span class="ri">🪙</span>
                <span class="num" style={{ color: 'var(--gold)' }}>
                  {r.n}
                </span>
                <span>金币</span>
              </button>
            );
          if (r.type === 'relic') {
            const d = RELICS[r.id];
            return (
              <button key={i} class="reward-item" onClick={() => act(() => run.takeReward(i))} {...tipProps(relicTip(r.id), 'right')}>
                <span class="ri">{d.art}</span>
                <span class="rt">
                  遗物：{d.name}
                  <small>{d.desc}</small>
                </span>
              </button>
            );
          }
          if (r.type === 'potion') {
            const d = POTIONS[r.id];
            return (
              <button
                key={i}
                class="reward-item"
                onClick={() => act(() => run.takeReward(i))}
                {...tipProps([{ title: d.name, body: d.desc }], 'right')}
              >
                <span class="ri">{d.art}</span>
                <span class="rt">
                  药水：{d.name}
                  <small>{d.desc}</small>
                </span>
                {run.potionSlotsFree === 0 && <span style={{ color: 'var(--bad)', fontSize: '13px', marginLeft: 'auto' }}>药水栏已满</span>}
              </button>
            );
          }
          return (
            <button key={i} class="reward-item" onClick={() => setCardIdx(i)}>
              <span class="ri">🂠</span>
              <span>将一张牌加入牌组</span>
            </button>
          );
        })}
        <button class="btn" style={{ marginTop: '10px' }} onClick={() => act(() => run.leaveRewards())}>
          {rewards.every((r) => r.taken) ? '继续' : '跳过剩余奖励'}
        </button>
      </div>
      {pickCard && pickCard.type === 'card' && (
        <div class="overlay">
          <h2>选择一张牌</h2>
          <div class="card-grid" style={{ alignContent: 'center', gap: stageInfo.w < stageInfo.h ? '12px' : '30px' }}>
            {pickCard.cards.map((c, j) => (
              <CardView
                key={c.uid}
                card={c}
                size={stageInfo.w < stageInfo.h ? 'md' : 'lg'}
                onClick={() => {
                  setCardIdx(null);
                  hideTip();
                  act(() => run.takeReward(cardIdx!, j));
                }}
                {...cardHover(c)}
              />
            ))}
          </div>
          <div class="overlay-actions">
            <button class="btn ghost" onClick={() => setCardIdx(null)}>
              返回
            </button>
            <button
              class="btn"
              onClick={() => {
                setCardIdx(null);
                act(() => run.takeReward(cardIdx!, -1));
              }}
            >
              跳过{run.hasRelic('singing_bowl') ? '（最大生命 +2）' : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================ 商店
export function ShopScreen({ run }: { run: Run }) {
  const sc = run.screen;
  const [armed, setArmed] = useState<number | null>(null);
  if (sc.s !== 'shop') return null;
  /** 触屏：第一次轻点查看说明，再点一次购买 */
  const buy = (i: number) => {
    if (pointer.touch && armed !== i) {
      setArmed(i);
      run.toast('再点一次购买');
      refresh();
      return;
    }
    setArmed(null);
    act(() => run.buy(i));
  };
  const shop = sc.shop;
  const cards = shop.items.map((it, i) => ({ it, i })).filter(({ it }) => it.kind === 'card');
  const relics = shop.items.map((it, i) => ({ it, i })).filter(({ it }) => it.kind === 'relic');
  const potions = shop.items.map((it, i) => ({ it, i })).filter(({ it }) => it.kind === 'potion');
  const removeCost = run.removeCost();
  const Price = ({ p }: { p: number }) => (
    <div class={`price ${run.gold < p ? 'poor' : ''}`}>
      🪙<span>{p}</span>
    </div>
  );
  return (
    <div class="shop">
      <div class="merchant">
        <div class="big-art">
          <img class="figure-img" src={figureUrl('merchant')!} alt="" draggable={false} />
        </div>
        <div class="speech">「随便看看，旅人。这些可都是我从尖塔里捡来的好东西。」</div>
        <button class="btn" onClick={() => act(() => run.leaveRoom())}>
          离开商店
        </button>
      </div>
      <div class="shop-goods">
        <div class="shop-label">卡牌</div>
        <div class="shop-row cards">
          {cards.map(({ it, i }) => (
            <div key={i} class={`shop-item ${it.sold ? 'sold' : ''}`}>
              {it.sale && !it.sold && <span class="sale-tag">半价</span>}
              <CardView card={it.card!} size="sm" cls={armed === i ? 'picked' : ''} onClick={() => buy(i)} {...cardHover(it.card!)} />
              <Price p={it.price} />
            </div>
          ))}
        </div>
        <div class="shop-row">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div class="shop-label">遗物</div>
            <div class="shop-row">
              {relics.map(({ it, i }) => (
                <div key={i} class={`shop-item ${it.sold ? 'sold' : ''}`}>
                  <div class="goods-tile" style={armed === i ? { outline: '2px solid var(--gold)' } : undefined} onClick={() => buy(i)} {...tipProps(relicTip(it.id!), 'top')}>
                    {RELICS[it.id!].art}
                  </div>
                  <Price p={it.price} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div class="shop-label">药水</div>
            <div class="shop-row">
              {potions.map(({ it, i }) => {
                const d = POTIONS[it.id!];
                return (
                  <div key={i} class={`shop-item ${it.sold ? 'sold' : ''}`}>
                    <div class="goods-tile" style={armed === i ? { outline: '2px solid var(--gold)' } : undefined} onClick={() => buy(i)} {...tipProps([{ title: d.name, body: d.desc }], 'top')}>
                      {d.art}
                    </div>
                    <Price p={it.price} />
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div class="shop-label">服务</div>
            <div class={`shop-item ${shop.removeUsed ? 'sold' : ''}`}>
              <div
                class="goods-tile"
                onClick={() => run.gold >= removeCost && act(() => run.buyRemoval())}
                {...tipProps([{ title: '移除卡牌', body: '从牌组中移除一张牌。每次使用后价格上涨。' }], 'top')}
              >
                ✂️
              </div>
              <Price p={removeCost} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================ 休息处
export function RestScreen({ run }: { run: Run }) {
  const sc = run.screen;
  if (sc.s !== 'rest') return null;
  const heal = run.restHealAmount();
  const opts: { id: 'rest' | 'smith' | 'lift' | 'toke' | 'dig'; ico: string; lbl: string; desc: string; ok: true | string }[] = [
    { id: 'rest', ico: '💤', lbl: '休息', desc: `回复 ${heal} 点生命`, ok: run.canRest() },
    { id: 'smith', ico: '⚒️', lbl: '锻造', desc: '升级一张牌', ok: run.canSmith() },
  ];
  const gi = run.relic('girya');
  if (gi) opts.push({ id: 'lift', ico: '🏋️', lbl: '举重', desc: `永久获得 1 点力量（${gi.counter}/3）`, ok: gi.counter < 3 ? true : '已用完' });
  if (run.hasRelic('peace_pipe')) opts.push({ id: 'toke', ico: '🚬', lbl: '吸烟', desc: '移除一张牌', ok: true });
  if (run.hasRelic('shovel')) opts.push({ id: 'dig', ico: '🪏', lbl: '挖掘', desc: '获得一件遗物', ok: true });
  return (
    <div class="room" style={{ flexDirection: 'column' }}>
      <div class="campfire">
        <img class="figure-img" src={figureUrl('campfire')!} alt="" draggable={false} />
      </div>
      <h2>休息处</h2>
      {!sc.done ? (
        <div class="rest-opts">
          {opts.map((o) => (
            <button key={o.id} class="rest-opt" disabled={o.ok !== true} title={o.ok === true ? '' : o.ok} onClick={() => act(() => run.restAction(o.id))}>
              <span class="ico">{o.ico}</span>
              <span class="lbl">{o.lbl}</span>
              <span class="desc">{o.ok === true ? o.desc : o.ok}</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div style={{ fontSize: '18px', color: 'var(--parchment-dim)' }}>{sc.note}</div>
          <button class="btn primary" onClick={() => act(() => run.leaveRoom())}>
            继续前进
          </button>
        </>
      )}
    </div>
  );
}

// ============================================================ 事件
export function EventScreen({ run }: { run: Run }) {
  const sc = run.screen;
  if (sc.s !== 'event') return null;
  const v = run.eventView();
  const def = EVENTS[sc.ev.id];
  if (!v) return null;
  return (
    <div class="event">
      <div class="event-art">
        <img src={eventArtUrl(def.id, def.art)} alt="" draggable={false} />
      </div>
      <div class="event-body">
        <h2>{def.name}</h2>
        <div class="event-text">{v.text}</div>
        <div class="event-opts">
          {v.options.map((o, i) => (
            <button key={i} class={`event-opt ${o.tone ?? ''}`} disabled={!!o.disabled} onClick={() => act(() => o.go())}>
              <span class="lbl">【{o.label}】</span>
              {(o.hint || o.disabled) && <span class="hint">{o.disabled ? o.disabled : o.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================ 宝箱
export function TreasureScreen({ run }: { run: Run }) {
  const sc = run.screen;
  if (sc.s !== 'treasure') return null;
  const names = { small: '小宝箱', medium: '宝箱', large: '大宝箱' };
  return (
    <div class="room" style={{ flexDirection: 'column' }}>
      <div class="big-art chest-art" style={{ '--sz': sc.size === 'large' ? '240px' : sc.size === 'medium' ? '210px' : '180px', cursor: sc.opened ? 'default' : 'pointer' } as Record<string, string>} onClick={() => act(() => run.openChest())}>
        <img class="figure-img" src={figureUrl(sc.opened ? 'chest_open' : 'chest_closed')!} alt="" draggable={false} />
      </div>
      <h2>{names[sc.size]}</h2>
      {!sc.opened ? (
        <button class="btn primary" onClick={() => act(() => run.openChest())}>
          打开
        </button>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '18px' }}>
            <span {...tipProps(relicTip(sc.relic), 'right')} style={{ fontSize: '40px' }}>
              {RELICS[sc.relic].art}
            </span>
            <span>获得「{RELICS[sc.relic].name}」</span>
            {sc.gold > 0 && !run.hasRelic('ectoplasm') && <span style={{ color: 'var(--gold)' }}>以及 {sc.gold} 金币</span>}
          </div>
          <button class="btn" onClick={() => act(() => run.leaveRoom())}>
            继续前进
          </button>
        </>
      )}
    </div>
  );
}

// ============================================================ 首领遗物
export function BossRelicScreen({ run }: { run: Run }) {
  const sc = run.screen;
  if (sc.s !== 'bossRelic') return null;
  return (
    <div class="room" style={{ flexDirection: 'column' }}>
      <h2>首领的宝藏</h2>
      <div style={{ color: 'var(--muted)' }}>选择一件首领遗物带往下一幕</div>
      <div style={{ display: 'flex', gap: '28px' }}>
        {sc.choices.map((id, i) => {
          const d = RELICS[id];
          return (
            <button key={id} class="rest-opt" style={{ width: '220px' }} onClick={() => act(() => run.pickBossRelic(i))}>
              <span class="ico" style={{ fontSize: '60px' }}>
                {d.art}
              </span>
              <span class="lbl">{d.name}</span>
              <span class="desc" style={{ whiteSpace: 'pre-line', fontSize: '14px', color: 'var(--parchment-dim)' }}>
                {d.desc}
              </span>
            </button>
          );
        })}
      </div>
      <button class="btn ghost" onClick={() => act(() => run.pickBossRelic(-1))}>
        不拿
      </button>
    </div>
  );
}

// ============================================================ 先古之民
export function AncientScreen({ run }: { run: Run }) {
  const sc = run.screen;
  if (sc.s !== 'ancient') return null;
  const anc = ANCIENTS[sc.id];
  const picked = sc.picked;
  return (
    <div class="ancient" style={{ '--ac': anc.color } as Record<string, string>}>
      <div class="ancient-figure">
        <div class="halo" />
        <div class="glyph">{figureUrl(anc.id) ? <img class="figure-img" src={figureUrl(anc.id)!} alt="" draggable={false} /> : anc.art}</div>
      </div>
      <div class="ancient-body">
        <div class="ttl">先古之民 · {anc.title}</div>
        <div class="nm">{anc.name}</div>
        <div class="event-text">{picked === undefined ? anc.intro : '「去吧。尖塔在等着你。」'}</div>
        <div class="event-opts">
          {sc.options.map((bid, i) => {
            const b = anc.blessings.find((x) => x.id === bid);
            if (!b) return null;
            return (
              <button
                key={bid}
                class={`blessing ${b.tone === 'trade' ? 'trade' : ''} ${picked === i ? 'chosen' : ''}`}
                disabled={picked !== undefined}
                onClick={() => act(() => run.chooseBlessing(i))}
              >
                <span class="lbl">{b.label}</span>
                <span class="desc">{b.desc}</span>
              </button>
            );
          })}
        </div>
        {picked !== undefined && (
          <div>
            <button class="btn primary" onClick={() => act(() => run.leaveAncient())}>
              启程
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================ 结束
export function GameOverScreen({ run }: { run: Run }) {
  const sc = run.screen;
  if (sc.s !== 'gameover') return null;
  const cd = CHARACTERS[run.char];
  const s = run.stats;
  const mins = Math.max(1, Math.round((Date.now() - s.startTime) / 60000));
  return (
    <div class="room gameover" style={{ flexDirection: 'column', gap: '18px' }}>
      <h1 style={{ color: sc.win ? 'var(--gold)' : 'var(--bad)' }}>{sc.win ? '登顶' : '倒下'}</h1>
      <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
        <Portrait char={run.char} size={1.2} />
        <div class="stats-table">
          <span class="k">角色</span>
          <span class="v" style={{ color: cd.color, fontFamily: 'var(--f-serif)' }}>{cd.name}</span>
          <span class="k">到达</span>
          <span class="v">
            第 {run.act} 幕 · 第 {run.floor} 层
          </span>
          <span class="k">进阶</span>
          <span class="v">{run.ascension}</span>
          <span class="k">击杀敌人</span>
          <span class="v">{s.kills}</span>
          <span class="k">击败精英</span>
          <span class="v">{s.elites}</span>
          <span class="k">击败首领</span>
          <span class="v">{s.bosses}</span>
          <span class="k">打出卡牌</span>
          <span class="v">{s.cardsPlayed}</span>
          <span class="k">受到伤害</span>
          <span class="v">{s.damageTaken}</span>
          <span class="k">获得金币</span>
          <span class="v">{s.goldEarned}</span>
          <span class="k">种子</span>
          <span class="v">{run.seed.toString(36).toUpperCase()}</span>
          <span class="k">用时</span>
          <span class="v">{mins} 分钟</span>
          <span class="k">分数</span>
          <span class="v" style={{ color: 'var(--gold)' }}>
            {run.score()}
          </span>
        </div>
      </div>
      {sc.win && run.ascension < 10 && <div style={{ color: 'var(--good)' }}>已为{cd.name}解锁进阶 {Math.min(10, run.ascension + 1)}！</div>}
      <div style={{ display: 'flex', gap: '16px' }}>
        <button
          class="btn"
          onClick={() => {
            deleteSave();
            state.run = null;
            state.view = 'menu';
            refresh();
          }}
        >
          返回主菜单
        </button>
        <button
          class="btn primary"
          onClick={() => {
            deleteSave();
            state.run = null;
            state.view = 'charSelect';
            refresh();
          }}
        >
          再来一局
        </button>
      </div>
    </div>
  );
}
