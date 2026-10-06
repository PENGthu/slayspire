import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { CHARACTERS } from '../../game/characters';
import type { Combat } from '../../game/combat';
import { CARDS, ENEMIES, POTIONS, POWERS } from '../../game/registry';
import type { Run } from '../../game/run';
import type { Card, Creature, Enemy } from '../../game/types';
import { INTENT_DESC, IntentIcon, OrbArt, OstyArt, Portrait } from '../components/Art';
import { enemyArtUrl } from '../art/enemyArt';
import { ORBS } from '../../game/orbs';
import { CardView, cardTips } from '../components/CardView';
import { hideTip, rectInStage, showTip, stageInfo, tipProps, toStage, type TipData } from '../components/Tooltip';
import { playFx } from '../fx';
import { act, refresh, saveProfile, setOverlay, sleep, speed, state } from '../store';
import { sfx } from '../sound';

interface Drag {
  uid: number;
  sx: number;
  sy: number;
  x: number;
  y: number;
  moved: boolean;
}

const cardDefOf = (c: Card) => CARDS[c.id]?.type ?? 'skill';

function powerTips(c: Creature): TipData[] {
  return Object.entries(c.powers)
    .filter(([id]) => POWERS[id] && !POWERS[id].hidden)
    .map(([id, n]) => {
      const d = POWERS[id];
      return { title: `${d.art} ${d.name}`, body: d.desc(n, c), color: d.type === 'debuff' ? '#e8a0ff' : '#ffe08a' };
    });
}

function Powers({ c }: { c: Creature }) {
  const list = Object.entries(c.powers).filter(([id]) => POWERS[id] && !POWERS[id].hidden);
  return (
    <div class="powers" {...tipProps(() => powerTips(c), 'bottom')}>
      {list.map(([id, n]) => {
        const d = POWERS[id];
        const neg = d.type === 'debuff' || (d.negative && n < 0);
        return (
          <div key={id} class={`pw ${neg ? 'debuff' : ''}`}>
            {d.art}
            {!d.noStack && <span class="pn">{n}</span>}
          </div>
        );
      })}
    </div>
  );
}

function HpBar({ c, width = 130 }: { c: Creature; width?: number }) {
  const pct = c.maxHp > 0 ? Math.max(0, c.hp) / c.maxHp : 0;
  const doom = c.powers.doom ?? 0;
  const poison = c.powers.poison ?? 0;
  const doomPct = c.maxHp > 0 ? Math.min(doom, Math.max(0, c.hp)) / c.maxHp : 0;
  return (
    <div class={`hpbar ${c.block > 0 ? 'blocked' : ''}`} style={{ width: `${width}px` }}>
      <div class={`fill ${poison >= c.hp && c.hp > 0 ? 'poison' : ''}`} style={{ width: `${pct * 100}%` }} />
      {doomPct > 0 && <div class="ghost" style={{ left: 0, width: `${doomPct * 100}%` }} />}
      {c.block > 0 && <div class="block-badge">{c.block}</div>}
      <div class="txt">
        {Math.max(0, c.hp)}/{c.maxHp}
      </div>
    </div>
  );
}

function handPos(n: number, i: number, cw: number, maxW: number) {
  const spread = Math.min(maxW, n * cw * 0.86);
  const step = n > 1 ? Math.min(cw * 0.86, spread / (n - 1)) : 0;
  const mid = (n - 1) / 2;
  const t = n > 1 ? (i - mid) / mid : 0;
  return {
    x: (i - mid) * step,
    y: t * t * 22,
    rot: t * Math.min(14, n * 1.6),
  };
}

export function CombatScreen({ run }: { run: Run }) {
  const g = run.combat as Combat;
  const portrait = stageInfo.w < stageInfo.h;
  const cw = portrait ? 132 : 150;
  const [sel, setSel] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [aimEnemy, setAimEnemy] = useState<number | null>(null);
  const [picks, setPicks] = useState<number[]>([]);
  const [banner, setBanner] = useState<{ text: string; id: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const running = useRef(false);
  const ending = useRef(false);
  const lastPhase = useRef<string>('');
  const lastTurn = useRef(0);
  const dragRef = useRef<Drag | null>(null);
  const hoverRef = useRef<number | null>(null);
  dragRef.current = drag;

  const flash = (text: string) => setBanner({ text, id: Math.random() });

  // 特效
  useLayoutEffect(() => {
    const fx = g.takeFx();
    if (fx.length) playFx(fxRef.current, rootRef.current, fx, [g.player.uid, g.osty?.uid ?? -1]);
  });

  // 回合横幅
  useEffect(() => {
    if (g.phase === 'player' && (lastPhase.current !== 'player' || lastTurn.current !== g.turn) && !g.over) {
      if (lastTurn.current !== g.turn) {
        flash(g.turn === 1 ? '战斗开始' : `第 ${g.turn} 回合`);
        sfx('turn');
      }
      lastTurn.current = g.turn;
    }
    lastPhase.current = g.phase;
  });

  // 敌方回合
  useEffect(() => {
    if (g.phase !== 'enemy' || running.current) return;
    running.current = true;
    (async () => {
      flash('敌方回合');
      await sleep(speed(500));
      let more = true;
      while (more) {
        more = g.stepEnemy();
        refresh();
        await sleep(speed(more ? 520 : 200));
      }
      running.current = false;
      refresh();
    })();
  });

  // 战斗结束
  useEffect(() => {
    if (!g.over || ending.current) return;
    ending.current = true;
    (async () => {
      if (g.result === 'win') flash('胜利！');
      else if (g.result === 'escape') flash('逃离战斗');
      else flash('你倒下了……');
      await sleep(speed(g.result === 'lose' ? 1600 : 1100));
      act(() => run.finishCombat());
    })();
  });

  // 选择模式切换时清空
  useEffect(() => {
    setPicks([]);
  }, [g.pending]);

  // 键盘快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (state.overlay) return;
      if (e.key === 'e' || e.key === 'E') endTurn();
      if (e.key === 'Escape') {
        setSel(null);
        state.ui.potionTarget = null;
        refresh();
      }
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && g.hand[n - 1]) clickCard(g.hand[n - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const pending = g.pending;
  const canAct = g.phase === 'player' && !pending && !g.over;
  const potionTarget = state.ui.potionTarget;

  function endTurn() {
    if (!canAct) return;
    setSel(null);
    hideTip();
    act(() => g.endTurn());
  }

  function tryPlay(c: Card, target: Enemy | null) {
    const ok = g.canPlay(c);
    if (ok !== true) {
      run.toast(ok);
      refresh();
      return;
    }
    if (g.needsTarget(c) && !target) {
      if (g.alive.length === 1) target = g.alive[0];
      else return;
    }
    setSel(null);
    setHover(null);
    hideTip();
    sfx('card');
    flyCard(c, cardDefOf(c));
    act(() => g.playCard(c, target));
  }

  function clickCard(c: Card) {
    if (pending?.mode === 'hand') {
      if (!pending.cards.includes(c)) return;
      togglePick(c);
      return;
    }
    if (!canAct) return;
    if (sel === c.uid) {
      if (!g.needsTarget(c) || g.alive.length === 1) tryPlay(c, null);
      else setSel(null);
      return;
    }
    const ok = g.canPlay(c);
    if (ok !== true) {
      run.toast(ok);
      refresh();
      return;
    }
    setSel(c.uid);
  }

  function togglePick(c: Card) {
    if (!pending) return;
    const has = picks.includes(c.uid);
    let next = has ? picks.filter((u) => u !== c.uid) : [...picks, c.uid];
    if (next.length > pending.max) next = next.slice(next.length - pending.max);
    if (pending.mode === 'grid' && pending.max === 1 && pending.min === 1) {
      resolvePending([c.uid]);
      return;
    }
    setPicks(next);
  }

  function resolvePending(uids: number[]) {
    const p = g.pending;
    if (!p) return;
    const chosen = p.cards.filter((c) => uids.includes(c.uid));
    if (chosen.length < p.min) return;
    setPicks([]);
    act(() => p.resolve(chosen));
  }

  function clickEnemy(e: Enemy) {
    if (potionTarget !== null) {
      state.ui.potionTarget = null;
      act(() => g.usePotion(potionTarget, e));
      return;
    }
    if (sel !== null) {
      const c = g.hand.find((x) => x.uid === sel);
      if (c && g.needsTarget(c)) tryPlay(c, e);
    }
  }

  // ---------------- 拖拽 ----------------
  function onCardDown(c: Card, ev: PointerEvent) {
    if (pending || !canAct) return;
    if (ev.button !== 0) return;
    const p = toStage(ev.clientX, ev.clientY);
    const d: Drag = { uid: c.uid, sx: p.x, sy: p.y, x: p.x, y: p.y, moved: false };
    setDrag(d);
    dragRef.current = d;
    const move = (e: PointerEvent) => {
      const q = toStage(e.clientX, e.clientY);
      const cur = dragRef.current;
      if (!cur) return;
      const moved = cur.moved || Math.hypot(q.x - cur.sx, q.y - cur.sy) > 12;
      const nd = { ...cur, x: q.x, y: q.y, moved };
      dragRef.current = nd;
      setDrag(nd);
      setPointer(q);
      if (moved) {
        hideTip();
        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-enemy]');
        setAimEnemy(el ? Number(el.getAttribute('data-enemy')) : null);
      }
    };
    const up = (e: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const cur = dragRef.current;
      setDrag(null);
      dragRef.current = null;
      setAimEnemy(null);
      if (!cur) return;
      if (!cur.moved) {
        clickCard(c);
        return;
      }
      const q = toStage(e.clientX, e.clientY);
      if (g.needsTarget(c)) {
        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-enemy]');
        const target = el ? g.alive.find((x) => x.uid === Number(el.getAttribute('data-enemy'))) : null;
        if (target) tryPlay(c, target);
        else if (g.alive.length === 1 && q.y < stageInfo.h - 260) tryPlay(c, g.alive[0]);
        else setSel(null);
      } else if (q.y < stageInfo.h - 250) {
        tryPlay(c, null);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  const selCard = sel !== null ? g.hand.find((c) => c.uid === sel) ?? null : null;
  const dragCard = drag ? g.hand.find((c) => c.uid === drag.uid) ?? null : null;
  const activeCard = dragCard ?? selCard;
  const aiming = !!activeCard && g.needsTarget(activeCard) && (drag?.moved || sel !== null);
  const targetEnemyUid =
    aimEnemy ?? (aiming && g.alive.length === 1 ? g.alive[0].uid : null);
  const targetEnemy = g.alive.find((e) => e.uid === targetEnemyUid) ?? null;

  const cd = CHARACTERS[run.char];
  const n = g.hand.length;
  const maxW = Math.min(stageInfo.w * (portrait ? 0.86 : 0.6), 900);

  return (
    <div
      class="combat"
      ref={rootRef}
      onPointerMove={(e) => {
        if (sel !== null || potionTarget !== null) setPointer(toStage(e.clientX, e.clientY));
      }}
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (state.ui.potionMenu !== null) {
          state.ui.potionMenu = null;
          refresh();
        }
        if (!t.closest('.card') && !t.closest('[data-enemy]') && sel !== null && selCard && !g.needsTarget(selCard)) {
          // 点空白处打出无目标牌
          if (toStage(e.clientX, e.clientY).y < stageInfo.h - 250) tryPlay(selCard, null);
        } else if (!t.closest('.card') && !t.closest('[data-enemy]')) {
          setSel(null);
        }
      }}
    >
      <div class="battlefield">
        <div class="side-player">
          <div class="creature player" data-cuid={g.player.uid}>
            {g.orbSlots > 0 && (
              <div class="orbs">
                {Array.from({ length: g.orbSlots }, (_, i) => {
                  const o = g.orbs[i];
                  if (!o) return <div key={`e${i}`} class="orb empty" {...tipProps([{ title: '空的充能球栏位', body: '生成的充能球会放在这里。' }], 'top')} />;
                  const d = ORBS[o.id];
                  const val = o.id === 'dark' ? d.evokeVal(g, o) : d.passiveVal(g, o);
                  return (
                    <div key={i} class="orb" {...tipProps(() => [{ title: d.name, body: d.desc(g, o), color: d.color }], 'top')}>
                      <OrbArt color={d.color} art={d.art} />
                      <span class="ov">{val}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div class="sprite">
              <span class="shadow" />
              <Portrait char={run.char} size={portrait ? 1.05 : 1.25} />
            </div>
            <HpBar c={g.player} width={150} />
            <Powers c={g.player} />
          </div>
          {g.osty && (
            <div
              class={`creature osty ${g.osty.alive ? '' : 'absent'}`}
              data-cuid={g.osty.uid}
              {...tipProps(
                [
                  {
                    title: '奥斯提',
                    body: g.osty.alive
                      ? `你的骸骨伙伴。会在格挡之后替你承受攻击伤害。\n当前生命 ${g.osty.hp}/${g.osty.maxHp}。`
                      : '奥斯提尚未被召唤。使用「召唤」卡牌唤醒它。',
                  },
                ],
                'top',
              )}
            >
              <div class="sprite">
                <span class="shadow" />
                <OstyArt size={portrait ? 0.75 : 0.9} />
              </div>
              {g.osty.alive ? <HpBar c={g.osty} width={96} /> : <div class="cname">未召唤</div>}
            </div>
          )}
        </div>
        <div class="side-enemies">
          {g.enemies.map((e) => (
            <EnemyView
              key={e.uid}
              g={g}
              e={e}
              targeted={targetEnemyUid === e.uid || (potionTarget !== null && aimEnemy === e.uid)}
              targetable={aiming || potionTarget !== null}
              onClick={() => clickEnemy(e)}
              onHover={(on) => (aiming || potionTarget !== null) && setAimEnemy(on ? e.uid : null)}
            />
          ))}
        </div>
      </div>

      {/* 能量 / 星辰 */}
      <div
        class={`energy-orb ${g.energy === 0 ? 'empty' : ''}`}
        style={{ '--pc': cd.color } as Record<string, string>}
        {...tipProps([{ title: '能量', body: '打出卡牌需要消耗能量。每回合开始时恢复。' }], 'right')}
      >
        <span class="num">
          {g.energy}/{g.maxEnergy}
        </span>
      </div>
      {run.char === 'regent' && (
        <div class="stars" {...tipProps([{ title: '星辰', body: '储君的资源，在回合之间保留。部分卡牌需要花费星辰才能打出。' }], 'right')}>
          <div class="star-ico" />
          <span>{g.stars}</span>
        </div>
      )}

      {/* 牌堆 */}
      <button class="pile-btn draw" onClick={() => setOverlay({ kind: 'deck', pile: 'draw' })} {...tipProps([{ title: '抽牌堆', body: '点击查看抽牌堆（顺序已打乱）。' }], 'top')}>
        🂠<span class="num">{g.drawPile.length}</span>
      </button>
      <button class="pile-btn discard" onClick={() => setOverlay({ kind: 'deck', pile: 'discard' })} {...tipProps([{ title: '弃牌堆', body: '抽牌堆耗尽时，弃牌堆会洗入抽牌堆。' }], 'top')}>
        🗑️<span class="num">{g.discardPile.length}</span>
      </button>
      {g.exhaustPile.length > 0 && (
        <button class="pile-btn exhaust" onClick={() => setOverlay({ kind: 'deck', pile: 'exhaust' })} {...tipProps([{ title: '消耗堆', body: '被消耗的牌在本场战斗中不会再出现。' }], 'top')}>
          🔥<span class="num">{g.exhaustPile.length}</span>
        </button>
      )}
      <button
        class={`btn end-turn ${canAct && !g.hand.some((c) => g.canPlay(c) === true) ? 'pulse' : ''}`}
        disabled={!canAct}
        onClick={endTurn}
      >
        {g.phase === 'enemy' ? '敌方回合' : '结束回合'}
      </button>

      {/* 手牌 */}
      <div class="hand" style={{ '--draw-x': `${-(stageInfo.w / 2 - 60)}px` } as Record<string, string>}>
        {g.hand.map((c, i) => {
          const pos = handPos(n, i, cw, maxW);
          const isSel = sel === c.uid;
          const isDrag = drag?.uid === c.uid && drag.moved;
          const isHover = hover === c.uid && !drag;
          const playable = canAct && g.canPlay(c) === true;
          const inPick = pending?.mode === 'hand';
          const pickable = inPick && pending.cards.includes(c);
          const picked = picks.includes(c.uid);
          let x = pos.x;
          let y = pos.y + (portrait ? 18 : 14);
          let rot = pos.rot;
          let scale = 1;
          let z = i + 1;
          if (hover !== null && !isHover && !isSel && !drag) {
            const hi = g.hand.findIndex((h) => h.uid === hover);
            if (hi >= 0) x += i < hi ? -26 : 26;
          }
          if (isHover || isSel || (drag?.uid === c.uid && !drag.moved)) {
            y = -(portrait ? 70 : 96);
            rot = 0;
            scale = portrait ? 1.35 : 1.28;
            z = 40;
          }
          if (picked) {
            y = -40;
            rot = 0;
          }
          if (isDrag && dragCard) {
            if (g.needsTarget(c)) {
              // 瞄准时卡牌停留在手牌位置上方，避免挡住敌人
              y = -(portrait ? 70 : 96);
              rot = 0;
              scale = portrait ? 1.35 : 1.28;
            } else {
              x = drag!.x - stageInfo.w / 2;
              y = drag!.y - stageInfo.h + (cw * 1.4) / 2;
              rot = 0;
              scale = 1.1;
            }
            z = 60;
          }
          return (
            <CardView
              key={c.uid}
              card={c}
              g={g}
              dataUid
              target={isSel || isDrag ? targetEnemy : null}
              cls={`${playable && !inPick ? 'playable' : ''} ${!playable && !inPick ? 'unplayable-now' : ''} ${inPick && !pickable ? 'dim' : ''} ${picked || isSel ? 'picked' : ''} ${isHover ? 'hovered' : ''} ${isDrag ? 'dragging' : ''} ${isSel && aiming ? 'aiming' : ''}`}
              style={{
                transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`,
                zIndex: z,
                bottom: '0px',
              }}
              onPointerDown={(e) => {
                if (pending?.mode === 'hand') return;
                onCardDown(c, e);
              }}
              onClick={(e) => {
                if (pending?.mode === 'hand') {
                  e.stopPropagation();
                  clickCard(c);
                }
              }}
              onPointerEnter={(e) => {
                if (e.pointerType === 'touch') return;
                setHover(c.uid);
                hoverRef.current = c.uid;
                const tips = cardTips(c);
                const el = e.currentTarget as Element;
                // 等卡牌放大动画结束后再定位提示框，避免挡住卡面
                if (tips.length) setTimeout(() => hoverRef.current === c.uid && !dragRef.current && showTip(el, tips, 'right'), 200);
              }}
              onPointerLeave={() => {
                setHover((h) => (h === c.uid ? null : h));
                if (hoverRef.current === c.uid) hoverRef.current = null;
                hideTip();
              }}
            />
          );
        })}
      </div>

      {/* 瞄准箭头 */}
      {(aiming || potionTarget !== null) && (pointer || drag) && (
        <TargetArrow
          from={activeCard ? { x: stageInfo.w / 2 + handPos(n, g.hand.indexOf(activeCard), cw, maxW).x, y: stageInfo.h - (portrait ? 300 : 360) } : { x: stageInfo.w * 0.3, y: 80 }}
          to={drag?.moved ? { x: drag.x, y: drag.y } : pointer!}
          hot={targetEnemyUid !== null}
        />
      )}

      {/* 手牌选择栏 */}
      {pending?.mode === 'hand' && (
        <div class="choice-bar panel">
          <span class="title">{pending.title}</span>
          <button
            class="btn small primary"
            disabled={picks.length < pending.min || picks.length > pending.max}
            onClick={() => resolvePending(picks)}
          >
            确认（{picks.length}/{pending.max}）
          </button>
        </div>
      )}
      {potionTarget !== null && (
        <div class="choice-bar panel">
          <span class="title">选择「{POTIONS[run.potions[potionTarget] ?? '']?.name ?? ''}」的目标</span>
          <button
            class="btn small ghost"
            onClick={() => {
              state.ui.potionTarget = null;
              refresh();
            }}
          >
            取消
          </button>
        </div>
      )}
      {pending?.mode === 'grid' && (
        <div class="overlay">
          <h2>{pending.title}</h2>
          <div class="card-grid">
            {pending.cards.map((c) => (
              <CardView
                key={c.uid}
                card={c}
                g={g}
                size="sm"
                cls={picks.includes(c.uid) ? 'picked' : ''}
                onClick={() => togglePick(c)}
                {...tipHandlers(c)}
              />
            ))}
          </div>
          {!(pending.max === 1 && pending.min === 1) && (
            <div class="overlay-actions">
              <button
                class="btn primary"
                disabled={picks.length < pending.min || picks.length > pending.max}
                onClick={() => resolvePending(picks)}
              >
                确认（{picks.length}/{pending.max}）
              </button>
            </div>
          )}
        </div>
      )}

      {!state.profile.tutorialSeen && g.phase === 'player' && !pending && (
        <div class="tutorial panel">
          <h3>如何战斗</h3>
          <ul>
            <li>把卡牌拖到敌人身上打出；也可以先点卡牌，再点目标。不需要目标的牌点两次即可。</li>
            <li>敌人头顶的图标是它下回合的<b>意图</b>：剑代表攻击及伤害数值，盾代表格挡。</li>
            <li>左下角是<b>能量</b>，每回合恢复。格挡只持续到你的下个回合。</li>
            <li>出完牌后点「结束回合」或按 E。悬停（或长按）任何东西都能看到说明。</li>
          </ul>
          <div>
            <button
              class="btn small primary"
              onClick={() => {
                state.profile.tutorialSeen = true;
                saveProfile();
                refresh();
              }}
            >
              知道了
            </button>
          </div>
        </div>
      )}
      <div class="fx-layer" ref={fxRef} />
      {banner && (
        <div class="turn-banner" key={banner.id}>
          {banner.text}
        </div>
      )}
    </div>
  );
}

/** 打出卡牌时的飞行动画：从手牌飞到画面中央，再缩小飞向弃牌堆/消失 */
function flyCard(c: Card, type: string) {
  const el = document.querySelector(`.hand [data-card="${c.uid}"]`) as HTMLElement | null;
  const layer = document.querySelector('.combat .fx-layer') as HTMLElement | null;
  if (!el || !layer || typeof el.animate !== 'function') return;
  const r = rectInStage(el);
  const ghost = el.cloneNode(true) as HTMLElement;
  ghost.className = el.className.replace(/hovered|dragging|playable|picked/g, '') + ' card-ghost';
  ghost.style.transform = '';
  ghost.style.left = '0px';
  ghost.style.top = '0px';
  ghost.style.bottom = '';
  ghost.style.marginLeft = '0px';
  layer.appendChild(ghost);
  const w = ghost.offsetWidth;
  const h = ghost.offsetHeight;
  const sx = (r.l + r.r) / 2 - w / 2;
  const sy = (r.t + r.b) / 2 - h / 2;
  const cx = stageInfo.w / 2 - w / 2;
  const cy = stageInfo.h * 0.42 - h / 2;
  const ex = type === 'power' ? cx : stageInfo.w - 60 - w / 2;
  const ey = type === 'power' ? cy - 60 : stageInfo.h - 50 - h / 2;
  const anim = ghost.animate(
    [
      { transform: `translate(${sx}px, ${sy}px) scale(1.15)`, opacity: 1, offset: 0 },
      { transform: `translate(${cx}px, ${cy}px) scale(1.1)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${cx}px, ${cy}px) scale(1.1)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${ex}px, ${ey}px) scale(${type === 'power' ? 1.4 : 0.25})`, opacity: 0, offset: 1 },
    ],
    { duration: 620, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' },
  );
  anim.onfinish = () => ghost.remove();
  setTimeout(() => ghost.remove(), 900);
}

function tipHandlers(c: Card) {
  return {
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const tips = cardTips(c);
      if (tips.length) showTip(e.currentTarget as Element, tips, 'right');
    },
    onPointerLeave: () => hideTip(),
  };
}

function EnemyView({
  g,
  e,
  targeted,
  targetable,
  onClick,
  onHover,
}: {
  g: Combat;
  e: Enemy;
  targeted: boolean;
  targetable: boolean;
  onClick: () => void;
  onHover: (on: boolean) => void;
}) {
  const def = ENEMIES[e.defId];
  const m = g.moveOf(e);
  const intent = g.intentDamage(e);
  const fontSize = Math.round(118 * e.size);
  const artUrl = enemyArtUrl(e.defId);
  const artSize = Math.round(146 * e.size);
  const reviving = !!e.powers.revive_pending;
  const enemyTips = (): TipData[] => {
    const tips: TipData[] = [
      { title: e.name + (e.minion ? '（仆从）' : ''), body: `生命 ${Math.max(0, e.hp)}/${e.maxHp}${e.block ? `，格挡 ${e.block}` : ''}${def.desc ? `\n${def.desc}` : ''}` },
    ];
    if (m) {
      let body = INTENT_DESC[m.intent];
      if (intent) body += `\n将造成 ${intent.dmg} 点伤害${intent.hits > 1 ? ` ×${intent.hits} 次` : ''}。`;
      tips.push({ title: `意图：${m.name}`, body });
    }
    return [...tips.filter((t) => t.body), ...powerTips(e)];
  };
  return (
    <div
      class={`creature enemy ${e.dead ? 'dead' : ''} ${e.escaped ? 'escaped' : ''} ${targeted ? 'targeted' : ''} ${targetable ? 'targetable' : ''} ${!e.minion && g.boss ? 'is-boss' : !e.minion && g.elite ? 'is-elite' : ''}`}
      data-cuid={e.uid}
      data-enemy={e.dead || e.escaped ? undefined : e.uid}
      onClick={(ev) => {
        ev.stopPropagation();
        onClick();
      }}
      onPointerEnter={(ev) => {
        onHover(true);
        if (ev.pointerType !== 'touch') showTip(ev.currentTarget as Element, enemyTips(), 'left');
      }}
      onPointerLeave={() => {
        onHover(false);
        hideTip();
      }}
      onContextMenu={(ev) => {
        ev.preventDefault();
        showTip(ev.currentTarget as Element, enemyTips(), 'left');
      }}
    >
      {m && !e.dead && !e.escaped && g.phase !== 'over' && (
        <div class="intent" style={{ top: `${-34 - 0}px` }}>
          <IntentIcon kind={m.intent} dmg={intent ? intent.dmg * intent.hits : 0} />
          {intent && (
            <span class="dmg">
              {intent.dmg}
              {intent.hits > 1 ? `×${intent.hits}` : ''}
            </span>
          )}
        </div>
      )}
      <div class="sprite" style={{ fontSize: `${fontSize}px`, opacity: reviving ? 0.45 : 1 }}>
        {artUrl ? (
          <img class="enemy-img" src={artUrl} width={artSize} height={artSize} alt="" draggable={false} />
        ) : (
          <>
            <span class="shadow" />
            <span>{e.art}</span>
          </>
        )}
      </div>
      <HpBar c={e} width={Math.round(100 + 40 * e.size)} />
      <Powers c={e} />
      <div class="cname">
        {e.name}
        {e.minion ? '（仆从）' : ''}
        {reviving ? '（复苏中）' : ''}
      </div>
    </div>
  );
}

function TargetArrow({ from, to, hot }: { from: { x: number; y: number }; to: { x: number; y: number }; hot: boolean }) {
  const mx = (from.x + to.x) / 2;
  const my = Math.min(from.y, to.y) - 120;
  const color = hot ? '#ff6b5a' : '#e2b04a';
  // 箭头方向
  const ang = Math.atan2(to.y - my, to.x - mx);
  const ah = 18;
  const p1 = { x: to.x - ah * Math.cos(ang - 0.45), y: to.y - ah * Math.sin(ang - 0.45) };
  const p2 = { x: to.x - ah * Math.cos(ang + 0.45), y: to.y - ah * Math.sin(ang + 0.45) };
  return (
    <svg class="target-arrow" width={stageInfo.w} height={stageInfo.h}>
      <path
        d={`M${from.x},${from.y} Q${mx},${my} ${to.x},${to.y}`}
        stroke={color}
        stroke-width="7"
        fill="none"
        stroke-dasharray="2 12"
        stroke-linecap="round"
        opacity="0.95"
      />
      <path d={`M${to.x},${to.y} L${p1.x},${p1.y} L${p2.x},${p2.y} Z`} fill={color} />
    </svg>
  );
}
