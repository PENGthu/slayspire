import { CHARACTERS } from '../../game/characters';
import { POTIONS, RELICS } from '../../game/registry';
import type { Run } from '../../game/run';
import { ZONE_NAMES } from '../../game/map';
import { act, refresh, setOverlay, state } from '../store';
import { tipProps } from './Tooltip';
import { PotionIcon, RelicIcon } from './Art';

export const TIER_NAMES: Record<string, string> = {
  starter: '初始遗物',
  common: '普通遗物',
  uncommon: '罕见遗物',
  rare: '稀有遗物',
  boss: '首领遗物',
  shop: '商店遗物',
  event: '事件遗物',
  ancient: '先古之民的赠礼',
};

const CHAR_BADGE: Record<string, string> = { ironclad: '⚔️', silent: '🗡️', regent: '👑', necrobinder: '💀', defect: '🤖' };

export function TopBar({ run }: { run: Run }) {
  const cd = CHARACTERS[run.char];
  const g = run.combat;
  const hp = g ? g.player.hp : run.hp;
  const maxHp = g ? g.player.maxHp : run.maxHp;
  const ui = state.ui;
  return (
    <>
      <div class="topbar">
        <div class="tb-char" style={{ color: cd.color }}>
          <div class="badge">{CHAR_BADGE[run.char]}</div>
          <span>{cd.name}</span>
        </div>
        <div class="tb-stat tb-hp" {...tipProps([{ title: '生命', body: `${hp} / ${maxHp}` }], 'bottom')}>
          <span class="ico">❤️</span>
          <span class="num">
            {hp}/{maxHp}
          </span>
        </div>
        <div class="tb-stat tb-gold" {...tipProps([{ title: '金币', body: '可以在商人处消费。' }], 'bottom')}>
          <span class="ico">🪙</span>
          <span class="num">{run.gold}</span>
        </div>
        <div class="tb-potions">
          {run.potions.map((p, i) => {
            const def = p ? POTIONS[p] : null;
            return (
              <div
                key={i}
                class={`potion-slot ${def ? 'filled' : ''} ${ui.potionMenu === i || ui.potionTarget === i ? 'active' : ''}`}
                style={def ? ({ '--potion': def.color } as Record<string, string>) : undefined}
                {...(def ? tipProps([{ title: def.name, body: def.desc }], 'bottom') : {})}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!def) return;
                  ui.potionTarget = null;
                  ui.potionMenu = ui.potionMenu === i ? null : i;
                  refresh();
                }}
              >
                {def ? <PotionIcon id={p!} /> : ''}
                {ui.potionMenu === i && def && <PotionMenu run={run} slot={i} />}
              </div>
            );
          })}
        </div>
        <div class="tb-spacer" />
        <div class="tb-floor">
          <span class="lbl">第 {run.act} 幕 · {ZONE_NAMES[run.zone]?.name} · </span>
          <span>第 {run.floor} 层</span>
          {run.ascension > 0 && <span> · 进阶 {run.ascension}</span>}
        </div>
        <button
          class="tb-btn"
          aria-label="查看地图"
          {...tipProps([{ title: '地图', body: '查看本幕地图。' }], 'bottom')}
          onClick={() => setOverlay(state.overlay?.kind === 'map' ? null : { kind: 'map' })}
        >
          🗺️
        </button>
        <button
          class="tb-btn"
          aria-label="查看牌组"
          {...tipProps([{ title: '牌组', body: '查看你的全部卡牌。' }], 'bottom')}
          onClick={() => setOverlay({ kind: 'deck', pile: 'deck' })}
        >
          🂠 <span class="num">{run.deck.length}</span>
        </button>
        <button class="tb-btn" aria-label="设置" onClick={() => setOverlay({ kind: 'settings' })}>
          ⚙️
        </button>
      </div>
      <div class="relic-bar">
        {run.relics.map((r) => {
          const d = RELICS[r.id];
          if (!d) return null;
          const showCounter = d.counter && r.counter > 0;
          return (
            <div
              key={r.id}
              class={`relic ${r.used ? 'used' : ''}`}
              {...tipProps([{ title: d.name, sub: TIER_NAMES[d.tier], body: d.desc + (d.flavor ? `\n\n${d.flavor}` : '') }], 'bottom')}
            >
              <RelicIcon id={r.id} />
              {showCounter && <span class="rc">{r.counter}</span>}
            </div>
          );
        })}
      </div>
    </>
  );
}

function PotionMenu({ run, slot }: { run: Run; slot: number }) {
  const id = run.potions[slot]!;
  const def = POTIONS[id];
  const g = run.combat;
  let canUse = false;
  let why = '';
  if (def.onDeath) why = '濒死时自动使用';
  else if (g && !g.over) {
    canUse = g.canUsePotion(slot);
    if (!canUse) why = '现在不能使用';
  } else if (def.outOfCombat) canUse = true;
  else why = '只能在战斗中使用';
  return (
    <div
      class="panel"
      style={{ position: 'absolute', top: '42px', left: '-10px', zIndex: 50, padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', width: '200px', fontSize: '14px', textAlign: 'left', cursor: 'default' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontFamily: 'var(--f-serif)', fontWeight: 700, color: def.color }}>{def.name}</div>
      <div style={{ color: 'var(--parchment-dim)', lineHeight: 1.5 }}>{def.desc}</div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          class="btn small primary"
          disabled={!canUse}
          title={why}
          onClick={() => {
            state.ui.potionMenu = null;
            if (g && !g.over) {
              if (def.target === 'enemy' && g.alive.length > 1) {
                state.ui.potionTarget = slot;
                refresh();
                return;
              }
              act(() => g.usePotion(slot, g.alive[0] ?? null));
            } else {
              act(() => run.usePotionOutside(slot));
            }
          }}
        >
          使用
        </button>
        <button
          class="btn small ghost"
          onClick={() => {
            state.ui.potionMenu = null;
            act(() => run.discardPotion(slot));
          }}
        >
          丢弃
        </button>
      </div>
      {why && <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{why}</div>}
    </div>
  );
}
