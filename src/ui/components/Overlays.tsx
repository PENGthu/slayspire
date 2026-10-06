import { useState } from 'preact/hooks';
import { cardDef, makeCard, upgradeCard } from '../../game/cards';
import { CARDS, RELICS } from '../../game/registry';
import type { Run } from '../../game/run';
import type { Card } from '../../game/types';
import { MapScreen } from '../screens/MapScreen';
import { act, refresh, saveProfile, saveRun, setOverlay, state } from '../store';
import { CardView, cardTips } from './CardView';
import { TIER_NAMES } from './TopBar';
import { CHARACTERS } from '../../game/characters';
import { hideTip, showTip, tipProps } from './Tooltip';
import { RelicIcon } from './Art';
import { AccountOverlay, ConflictOverlay, LoginOverlay } from './Account';
import { cloud } from '../../cloud/sync';

const TYPE_ORDER: Record<string, number> = { attack: 0, skill: 1, power: 2, status: 3, curse: 4 };

function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const da = cardDef(a);
    const db = cardDef(b);
    return TYPE_ORDER[da.type] - TYPE_ORDER[db.type] || da.name.localeCompare(db.name, 'zh') || Number(b.up) - Number(a.up);
  });
}

function hover(c: Card) {
  return {
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const t = cardTips(c);
      if (t.length) showTip(e.currentTarget as Element, t, 'right');
    },
    onPointerLeave: () => hideTip(),
  };
}

export function Overlays() {
  const o = state.overlay;
  const run = state.run;
  if (!o) return null;
  const close = () => setOverlay(null);
  if (o.kind === 'deck' && run) {
    const g = run.combat;
    let cards: Card[] = run.deck;
    let title = `牌组（${run.deck.length} 张）`;
    if (o.pile === 'draw' && g) {
      cards = sortCards(g.drawPile);
      title = `抽牌堆（${cards.length} 张）`;
    } else if (o.pile === 'discard' && g) {
      cards = [...g.discardPile].reverse();
      title = `弃牌堆（${cards.length} 张）`;
    } else if (o.pile === 'exhaust' && g) {
      cards = g.exhaustPile;
      title = `消耗堆（${cards.length} 张）`;
    } else cards = sortCards(cards);
    return (
      <div class="overlay" onClick={(e) => e.target === e.currentTarget && close()}>
        <h2>{title}</h2>
        {o.pile === 'draw' && <div class="sub">抽牌堆按类型排列，不代表实际顺序</div>}
        <div class="card-grid">
          {cards.map((c) => (
            <CardView key={c.uid} card={c} g={o.pile === 'deck' ? null : g} size="sm" {...hover(c)} />
          ))}
          {!cards.length && <div style={{ color: 'var(--muted)', marginTop: '40px' }}>空空如也</div>}
        </div>
        <div class="overlay-actions">
          <button class="btn" onClick={close}>
            关闭
          </button>
        </div>
      </div>
    );
  }
  if (o.kind === 'map' && run) {
    return (
      <div class="overlay" style={{ padding: 0, background: 'rgba(5,6,10,0.94)' }}>
        <MapScreen run={run} readonly />
        <div class="overlay-actions" style={{ position: 'absolute', bottom: '18px', right: '24px' }}>
          <button class="btn" onClick={close}>
            关闭地图
          </button>
        </div>
      </div>
    );
  }
  if (o.kind === 'settings') return <Settings />;
  if (o.kind === 'login') return <LoginOverlay />;
  if (o.kind === 'account') return <AccountOverlay />;
  if (o.kind === 'syncConflict') return <ConflictOverlay />;
  if (o.kind === 'confirm') {
    return (
      <div class="overlay">
        <div class="modal panel">
          <div style={{ fontSize: '18px', lineHeight: 1.6 }}>{o.text}</div>
          <div class="overlay-actions">
            <button class="btn ghost" onClick={close}>
              取消
            </button>
            <button
              class="btn danger"
              onClick={() => {
                close();
                o.onYes();
              }}
            >
              {o.yes}
            </button>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

function Settings() {
  const s = state.profile.settings;
  const run = state.run;
  const close = () => setOverlay(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="modal panel" style={{ minWidth: '380px' }}>
        <h2>设置</h2>
        <label class="toggle-row" for="opt-fast">
          <span>快速模式（加快动画）</span>
          <input
            id="opt-fast"
            type="checkbox"
            checked={s.fast}
            onChange={(e) => {
              s.fast = (e.target as HTMLInputElement).checked;
              saveProfile();
              refresh();
            }}
          />
        </label>
        <label class="toggle-row" for="opt-sound">
          <span>音效</span>
          <input
            id="opt-sound"
            type="checkbox"
            checked={s.sound}
            onChange={(e) => {
              s.sound = (e.target as HTMLInputElement).checked;
              saveProfile();
              refresh();
            }}
          />
        </label>
        {cloud.available && (
          <div class="toggle-row">
            <span>
              账号：{cloud.user ? `${cloud.user.name}（${cloud.sync === 'error' ? '同步失败' : '已开启云存档'}）` : '未登录，进度只保存在本机'}
            </span>
            <button class="btn small" onClick={() => setOverlay({ kind: cloud.user ? 'account' : 'login' })}>
              {cloud.user ? '管理' : '登录'}
            </button>
          </div>
        )}
        <div style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.6, textAlign: 'left' }}>
          操作：拖动卡牌到敌人身上打出，或先点击卡牌再点击目标。按 E 结束回合，数字键 1–9 选牌，Esc 取消。
          右键（或长按）敌人、遗物可以查看详细说明。
        </div>
        {run && (
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            本局种子：<span class="num" style={{ color: 'var(--parchment)', userSelect: 'text' }}>{run.seed.toString(36).toUpperCase()}</span>
          </div>
        )}
        {run && run.screen.s !== 'gameover' && (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              class="btn ghost"
              onClick={() => {
                saveRun();
                state.run = null;
                state.view = 'menu';
                state.overlay = null;
                refresh();
              }}
            >
              保存并返回主菜单
            </button>
            {!confirmAbandon ? (
              <button class="btn danger" onClick={() => setConfirmAbandon(true)}>
                放弃本局
              </button>
            ) : (
              <button
                class="btn danger"
                onClick={() => {
                  state.overlay = null;
                  act(() => {
                    run.combat = null;
                    run.screen = { s: 'gameover', win: false };
                  });
                }}
              >
                确定放弃？
              </button>
            )}
          </div>
        )}
        <button class="btn" onClick={close}>
          关闭
        </button>
      </div>
    </div>
  );
}

/** 战斗外的卡牌选择（升级、移除、变化等） */
export function SelectionOverlay({ run }: { run: Run }) {
  const s = run.selection;
  const [picked, setPicked] = useState<number[]>([]);
  const [hoverUid, setHoverUid] = useState<number | null>(null);
  if (!s) return null;
  const single = s.min === 1 && s.max === 1;
  const done = (sel: Card[]) => {
    setPicked([]);
    hideTip();
    act(() => run.resolveSelection(sel));
  };
  return (
    <div class="overlay">
      <h2>{s.title}</h2>
      {s.preview === 'upgrade' && <div class="sub">将鼠标移到卡牌上可预览升级效果</div>}
      <div class="card-grid">
        {sortCards(s.cards).map((c) => {
          let shown = c;
          if (s.preview === 'upgrade' && hoverUid === c.uid) {
            shown = { ...makeCard(c.id), uid: c.uid, ench: c.ench, misc: c.misc };
            upgradeCard(shown);
          }
          return (
            <CardView
              key={c.uid}
              card={shown}
              size="sm"
              cls={picked.includes(c.uid) ? 'picked' : ''}
              onClick={() => {
                if (single) return done([c]);
                setPicked((p) => (p.includes(c.uid) ? p.filter((u) => u !== c.uid) : p.length < s.max ? [...p, c.uid] : p));
              }}
              onPointerEnter={(e) => {
                setHoverUid(c.uid);
                if (e.pointerType !== 'touch') {
                  const t = cardTips(shown);
                  if (t.length) showTip(e.currentTarget as Element, t, 'right');
                }
              }}
              onPointerLeave={() => {
                setHoverUid(null);
                hideTip();
              }}
            />
          );
        })}
      </div>
      <div class="overlay-actions">
        {s.canCancel && (
          <button
            class="btn ghost"
            onClick={() => {
              setPicked([]);
              act(() => run.resolveSelection(null));
            }}
          >
            取消
          </button>
        )}
        {!single && (
          <button
            class="btn primary"
            disabled={picked.length < s.min || picked.length > s.max}
            onClick={() => done(s.cards.filter((c) => picked.includes(c.uid)))}
          >
            确认（{picked.length}/{s.max}）
          </button>
        )}
      </div>
    </div>
  );
}

/** 卡牌图鉴 */
export function Compendium() {
  const tabs = [
    { id: 'ironclad', name: '铁甲战士' },
    { id: 'silent', name: '静默猎手' },
    { id: 'regent', name: '储君' },
    { id: 'necrobinder', name: '亡灵契约师' },
    { id: 'defect', name: '故障机器人' },
    { id: 'claude', name: 'Claude' },
    { id: 'colorless', name: '无色' },
    { id: 'curse', name: '诅咒' },
    { id: 'relics', name: '遗物' },
  ];
  const [tab, setTab] = useState('ironclad');
  const [up, setUp] = useState(false);
  const rarityOrder: Record<string, number> = { basic: 0, special: 1, common: 2, uncommon: 3, rare: 4, curse: 5, status: 6 };
  const cards =
    tab === 'relics'
      ? []
      : Object.values(CARDS)
          .filter((d) => d.color === tab || (tab === 'curse' && d.color === 'status'))
          .sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity] || TYPE_ORDER[a.type] - TYPE_ORDER[b.type])
          .map((d) => {
            const c = makeCard(d.id);
            if (up) upgradeCard(c);
            return c;
          });
  return (
    <div class="screen" style={{ padding: '18px 24px 10px', gap: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
        {tabs.map((t) => (
          <button key={t.id} class={`btn small ${tab === t.id ? 'primary' : 'ghost'}`} onClick={() => setTab(t.id)}>
            {t.name}
          </button>
        ))}
        {tab !== 'relics' && (
          <label style={{ marginLeft: '12px', display: 'flex', gap: '6px', alignItems: 'center' }} for="opt-up">
            <input id="opt-up" type="checkbox" checked={up} onChange={(e) => setUp((e.target as HTMLInputElement).checked)} />
            显示升级后
          </label>
        )}
      </div>
      {tab === 'relics' ? (
        <div class="card-grid" style={{ gap: '10px' }}>
          {Object.values(RELICS)
            .filter((r) => r.tier !== 'event' || r.id !== 'circlet')
            .map((r) => (
              <div key={r.id} class="relic" style={{ width: '54px', height: '54px', fontSize: '30px' }} {...tipProps([{ title: r.name, sub: `${TIER_NAMES[r.tier] ?? r.tier}${r.char ? ` · ${CHARACTERS[r.char].name}专属` : ''}`, body: r.desc }], 'right')}>
                <RelicIcon id={r.id} />
              </div>
            ))}
        </div>
      ) : (
        <div class="card-grid">
          {cards.map((c) => (
            <CardView key={c.uid} card={c} size="sm" {...hover(c)} />
          ))}
        </div>
      )}
      <button
        class="btn"
        onClick={() => {
          state.view = 'menu';
          refresh();
        }}
      >
        返回
      </button>
    </div>
  );
}
