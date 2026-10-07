// 对局中的各个面板：玩家概况、行动卡、手牌、展示区、协会版图、日志。
import { useEffect, useRef } from 'preact/hooks';
import { card, project } from '../../game/content';
import { breakIncome, scoringMetric } from '../../game/effects';
import { decision } from '../../game/engine';
import { ALL_ICONS, handLimit, iconCounts, range, sponsorLevel, taskValue, workersNeeded } from '../../game/query';
import {
  ACTION_INFO,
  ACTION_TEXT,
  DONATION_COSTS,
  MAX_X,
  SOLO_ROUNDS,
  UNIVERSITIES,
  appealIncome,
  cpPoints,
  repRange,
  tile,
} from '../../game/rules';
import type { ActionId, CardTokens, GameState, TaskId } from '../../game/types';
import { CONTINENTS } from '../../game/types';
import {
  animalPlayable,
  cardsInfo,
  clickAnimal,
  clickProjectLevel,
  clickSponsor,
  myDecision,
  projectLevelMoves,
  sponsorPlayable,
  toggleDisplayPick,
} from '../interact';
import { CONT_COLOR, CONT_SHORT, IconBadge } from '../meta';
import { act, me, refresh, set, state, toast } from '../store';
import { lobby } from '../../net/online';
import { CardView, levelNeedText } from './CardView';
import { ScoreBar, ScoringCardView, Stat } from './Common';

// ———————————————————————————————————————————— 玩家

/** 联机时：玩家是否在线 */
function netDot(i: number) {
  const L = state.net ? lobby() : null;
  const owner = L?.owners[i];
  if (!L || !owner) return null;
  const on = L.online.includes(owner);
  return <span class={`dot ${on ? 'on' : ''}`} title={on ? '在线' : '离线'} />;
}

export function PlayerChips({ g }: { g: GameState }) {
  const f = decision(g);
  return (
    <div class="player-chips">
      {g.players.map((p, i) => (
        <button
          class={`pchip ${state.view === i ? 'viewing' : ''} ${f?.p === i ? 'acting' : ''}`}
          style={{ '--pc': p.color }}
          onClick={() => set({ view: i })}
          title={`查看 ${p.name} 的动物园`}
        >
          <span class="pname">
            {netDot(i)}
            {p.ai ? '🤖' : '🧑'} {p.name}
            {g.first === i && <span class="first" title="起始玩家">①</span>}
          </span>
          <ScoreBar p={p} thin />
          <span class="pnums">
            <span class="g-appeal">{p.appeal}</span>
            <span class="g-cp">{p.cp}</span>
            <span class="g-money">{p.money}元</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function PlayerStats({ g, pi }: { g: GameState; pi: number }) {
  const p = g.players[pi];
  const icons = iconCounts(p);
  const inc = breakIncome(g, pi);
  const used = Object.values(g.tasks).reduce((s, t) => s + t.filter((x) => x === pi).length, 0);
  return (
    <div class="player-stats" style={{ '--pc': p.color }}>
      <div class="ps-row main">
        <Stat icon="💰" value={p.money} num={p.money} owner={pi} title="钱" cls="money" />
        <Stat icon="🎟️" value={p.appeal} num={p.appeal} owner={pi} title={`吸引力（休息收入 ${appealIncome(p.appeal)} 元）`} cls="appeal" />
        <Stat icon="🌿" value={p.cp} num={p.cp} owner={pi} title={`保护点数（${cpPoints(p.cp)} 分）`} cls="cp" />
        <Stat icon="⭐" value={p.rep} num={p.rep} owner={pi} title={`声望（展示区范围 ${range(p)}）`} cls="rep" />
        <Stat icon="✖️" value={`${p.x}/${MAX_X}`} title="X 标记：每个可以让行动强度 +1" />
        <Stat icon="👤" value={`${p.workers - used}/${p.workers}`} title="协会工人（空闲/总数）" />
        <Stat icon="🃏" value={`${p.hand.length}/${handLimit(p)}`} title="手牌（休息时的上限）" />
      </div>
      <ScoreBar p={p} />
      <div class="ps-row icons">
        {ALL_ICONS.map((i) => (icons[i] ? <IconBadge icon={i} size={22} count={icons[i]} /> : null))}
      </div>
      <div class="ps-row small">
        <span title="休息时的收入">下次休息收入：{inc.total} 元</span>
        <span>展示区范围：{repRange(p.rep)}{range(p) > repRange(p.rep) ? `+${range(p) - repRange(p.rep)}` : ''}</span>
        {p.partners.length > 0 && (
          <span>
            合作动物园：
            {p.partners.map((c) => (
              <b style={{ color: CONT_COLOR[c] }}>{CONT_SHORT[c]}</b>
            ))}
          </span>
        )}
        {p.unis.length > 0 && <span>大学：{p.unis.map((u) => UNIVERSITIES.find((x) => x.id === u)!.emoji).join('')}</span>}
        {p.waza && <span title="世界动物园协会特别任务">📝 只打{p.waza === 'small' ? '小型' : '大型'}动物</span>}
        {Object.entries(p.cardTokens)
          .filter(([, n]) => n > 0)
          .map(([id, n]) => (
            <span title={id === 't_wild' ? '任意图标奖励板块：支持基础保护项目时当作任意 1 个图标' : card(id).name}>
              {id === 't_wild' ? '🃏 任意图标' : `${card(id).emoji} 标记 ×${n}`}
            </span>
          ))}
        {(p.tucked.map?.length ?? 0) > 0 && <span title="压在地图下的牌">👝 地图下 {p.tucked.map!.length} 张</span>}
      </div>
    </div>
  );
}

// ———————————————————————————————————————————— 行动卡

export function ActionRow({ g, pi }: { g: GameState; pi: number }) {
  const p = g.players[pi];
  const f = myDecision(g);
  const choosing = (f?.k === 'turn' || f?.k === 'extra') && f.p === pi;
  const allowed = (a: ActionId) => f?.k !== 'extra' || ((!f.only || f.only === a) && (!f.except || f.except !== a));
  return (
    <div class={`action-row ${choosing ? 'choosing' : ''}`}>
      {p.actions.map((a, i) => (
        <ActionCard
          a={a}
          slot={i + 1}
          up={p.upgraded[a]}
          tokens={p.tokens[a]}
          selected={choosing && state.sel.action === a}
          onClick={
            choosing && allowed(a)
              ? () => {
                  state.sel.action = state.sel.action === a ? null : a;
                  state.sel.x = 0;
                  refresh();
                }
              : undefined
          }
        />
      ))}
    </div>
  );
}

function ActionCard({ a, slot, up, tokens, selected, onClick }: { a: ActionId; slot: number; up: boolean; tokens?: CardTokens; selected?: boolean; onClick?: () => void }) {
  const info = ACTION_INFO[a];
  return (
    <div
      class={`action-card ${up ? 'up' : ''} ${selected ? 'selected' : ''} ${onClick ? 'clickable' : ''}`}
      style={{ '--ac': info.color }}
      onClick={onClick}
      title={ACTION_TEXT[a][up ? 1 : 0]}
    >
      <span class="slot">{slot}</span>
      <span class="ac-emoji">{info.emoji}</span>
      <span class="ac-name">{info.name}</span>
      {up && <span class="ac-up">II</span>}
      {(tokens?.venom || tokens?.constrict || tokens?.mult) && (
        <span class="ac-tokens">
          {tokens.venom ? <i title="毒液标记：使用其他行动卡时要付 2 元；使用这张卡时移除">☠️</i> : null}
          {tokens.constrict ? <i title="绞杀标记：使用这张卡时强度 −2">🪢</i> : null}
          {tokens.mult ? <i title="倍增标记：使用这张卡时可以执行 2 次">×2</i> : null}
        </span>
      )}
    </div>
  );
}

// ———————————————————————————————————————————— 手牌

export function HandPanel({ g, pi }: { g: GameState; pi: number }) {
  const p = g.players[pi];
  const f = myDecision(g);
  const hidden = pi !== me() && !g.over;
  if (hidden) {
    return (
      <div class="hand hidden-hand">
        {p.hand.map(() => (
          <div class="card card-back card-sm" />
        ))}
        {!p.hand.length && <span class="empty">没有手牌</span>}
      </div>
    );
  }
  return (
    <div class="hand">
      {p.hand.map((id) => {
        const c = card(id);
        let playable = false;
        let onClick: (() => void) | undefined;
        if (f && f.p === pi) {
          if (f.k === 'animals' && c.kind === 'animal') {
            playable = animalPlayable(g, f, id, -1) === null;
            onClick = () => clickAnimal(id, -1);
          } else if ((f.k === 'sponsors' || f.k === 'sponsorPay') && c.kind === 'sponsor') {
            playable = sponsorPlayable(g, f, id, -1) === null;
            onClick = () => clickSponsor(id, -1);
          } else if (f.k === 'dig') {
            playable = true;
            onClick = () => act({ t: 'cards', cards: [id] });
          } else if (f.k === 'assoc' && c.kind === 'project') {
            playable = c.levels.some((_, lv) => projectLevelMoves(g, id, lv, true).length > 0);
            onClick = () => set({ modal: { k: 'project', id, fromHand: true } });
          }
        }
        return (
          <CardView
            id={id}
            size="sm"
            playable={playable}
            selected={state.sel.card === id && state.sel.cardFrom === -1}
            dim={!!f && f.p === pi && ['animals', 'sponsors', 'sponsorPay', 'assoc'].includes(f.k) && !playable}
            badge={f?.k === 'sponsorPay' && c.kind === 'sponsor' ? `${sponsorLevel(p, c)}元` : undefined}
            onClick={onClick ?? (() => set({ modal: { k: 'card', id } }))}
            onInfo={() => set({ modal: { k: 'card', id } })}
          />
        );
      })}
      {!p.hand.length && <span class="empty">没有手牌</span>}
    </div>
  );
}

// ———————————————————————————————————————————— 展示区

export function DisplayPanel({ g }: { g: GameState }) {
  const f = myDecision(g);
  const viewer = f ? g.players[f.p] : g.players[me()];
  const r = range(viewer);
  const info = cardsInfo(g);
  return (
    <div class="display">
      <div class="panel-title">
        展示区 <small>声望范围内（前 {r} 张）可以拿取</small>
      </div>
      <div class="display-row">
        {g.display.map((id, i) => {
          const inRange = i < r;
          const c = card(id);
          let playable = false;
          let onClick: (() => void) | undefined;
          let badge = `${i + 1}`;
          if (f) {
            if (f.k === 'animals' && f.up && c.kind === 'animal' && inRange) {
              playable = animalPlayable(g, f, id, i) === null;
              onClick = () => clickAnimal(id, i);
              badge = `${i + 1} · +${i + 1}元`;
            } else if (f.k === 'sponsors' && f.up && c.kind === 'sponsor' && inRange) {
              playable = sponsorPlayable(g, f, id, i) === null;
              onClick = () => clickSponsor(id, i);
              badge = `${i + 1} · +${i + 1}元`;
            } else if (f.k === 'assoc' && f.up && c.kind === 'project' && inRange) {
              playable = c.levels.some((_, lv) => projectLevelMoves(g, id, lv, false, i).length > 0);
              onClick = () => set({ modal: { k: 'project', id, fromHand: false, display: i } });
              badge = `${i + 1} · +${i + 1}元`;
            } else if (f.k === 'display' && (f.any || inRange) && displayOk(f.filter, id)) {
              playable = true;
              onClick = () => act({ t: 'take', slot: i });
            } else if (f.k === 'dig') {
              playable = true;
              onClick = () => act({ t: 'take', slot: i });
              badge = `${i + 1} · 弃掉`;
            } else if (info && inRange) {
              if (info.snap) {
                playable = true;
                onClick = () => act({ t: 'snap', slot: i });
              } else if (info.up) {
                playable = true;
                onClick = () => toggleDisplayPick(i);
              }
            }
          }
          return (
            <div class={`display-slot ${inRange ? 'in-range' : ''}`}>
              <CardView
                id={id}
                size="md"
                playable={playable}
                selected={state.sel.displayPicks.includes(i) || (state.sel.card === id && state.sel.cardFrom === i)}
                badge={badge}
                onClick={onClick ?? (() => set({ modal: { k: 'card', id } }))}
                onInfo={() => set({ modal: { k: 'card', id } })}
              />
              {info && inRange && info.snap && info.up && (
                <button class="mini" onClick={() => toggleDisplayPick(i)}>
                  {state.sel.displayPicks.includes(i) ? '取消' : '计入抽牌'}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div class="deck-info">
        牌库 {g.deck.length} 张 · 弃牌堆 {g.discard.length} 张
      </div>
    </div>
  );
}

function displayOk(filter: 'sponsor' | 'small' | undefined, id: string): boolean {
  const c = card(id);
  if (filter === 'sponsor') return c.kind === 'sponsor';
  if (filter === 'small') return c.kind === 'animal' && c.size <= 2;
  return true;
}

// ———————————————————————————————————————————— 协会版图

const TASK_LABEL: Record<TaskId, string> = { rep: '声望 +2', partner: '合作动物园', university: '大学', project: '保护项目' };

export function AssocPanel({ g }: { g: GameState }) {
  const f = myDecision(g);
  const assoc = f?.k === 'assoc' ? f : null;
  const pi = f ? f.p : me();
  const p = g.players[pi];
  return (
    <div class="assoc">
      <div class="panel-title">协会版图</div>
      <div class="tasks">
        {(['rep', 'partner', 'university', 'project'] as TaskId[]).map((t) => (
          <div class={`task ${assoc && taskValue(p, t) <= assoc.budget && !assoc.used.includes(t) ? 'avail' : ''}`}>
            <span class="tv">{taskValue(p, t)}</span>
            <span class="tl">{TASK_LABEL[t]}</span>
            <span class="workers">
              {g.tasks[t].map((w) => (
                <i style={{ background: g.players[w].color }} />
              ))}
            </span>
            <small>需要 {workersNeeded(g, t)} 名工人</small>
          </div>
        ))}
      </div>
      <div class="sub-title">合作动物园（打出该洲动物便宜 3 元，提供大洲图标）</div>
      <div class="partners">
        {CONTINENTS.map((c) => (
          <span class="partner" style={{ '--cc': CONT_COLOR[c] }}>
            <b>{CONT_SHORT[c]}</b>
            {g.players.map((pl) => (pl.partners.includes(c) ? <i style={{ background: pl.color }} /> : null))}
          </span>
        ))}
      </div>
      <div class="sub-title">大学</div>
      <div class="unis">
        {UNIVERSITIES.map((u) => (
          <span class="uni" title={u.text}>
            {u.emoji} {u.name}
            <small>{u.text}</small>
            {g.players.map((pl) => (pl.unis.includes(u.id) ? <i style={{ background: pl.color }} /> : null))}
          </span>
        ))}
      </div>
      <div class="sub-title">保护项目</div>
      <div class="projects">
        {g.projects.map((bp) => {
          const c = project(bp.id);
          return (
            <div class={`proj ${c.base ? 'base' : ''}`}>
              <div class="proj-head" onClick={() => set({ modal: { k: 'card', id: bp.id } })}>
                <span class="emoji">{c.emoji}</span>
                <b>{c.name}</b>
                {c.goal.k === 'icon' && <IconBadge icon={c.goal.icon} size={18} />}
                {(c.goal.k === 'release' || c.goal.k === 'breed') && <IconBadge icon={c.goal.k === 'release' ? c.goal.icon : c.goal.cat} size={18} />}
                {p.supported.some((x) => x.id === bp.id) && <span class="done">已支持</span>}
              </div>
              <div class="proj-levels">
                {c.levels.map((lv, i) => {
                  const by = bp.slots[i];
                  const legal = !!assoc && projectLevelMoves(g, bp.id, i, false).length > 0;
                  return (
                    <button
                      class={`lvl ${legal ? 'legal' : ''} ${by !== null ? 'taken' : ''}`}
                      disabled={!assoc || by !== null}
                      style={by !== null ? { '--pc': g.players[by].color } : undefined}
                      onClick={() => clickProjectLevel(bp.id, i, false)}
                      title={`${c.goal.k === 'release' ? `放归${levelNeedText(c, i)}的动物` : c.goal.k === 'breed' ? `第 ${i + 1} 档` : `需要 ${lv.need} 个`}：获得 ${lv.cp} 保护点数${lv.rep ? `、声望 +${lv.rep}` : ''}`}
                    >
                      <span>{c.goal.k === 'breed' ? (lv.rep ? `+${lv.rep}⭐` : '') : levelNeedText(c, i)}</span>
                      <b class="r-cp">{lv.cp}</b>
                      {by !== null && <i style={{ background: g.players[by].color }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div class="sub-title">捐款（升级的协会行动，每次 1 保护点数）</div>
      <div class="donations">
        {DONATION_COSTS.slice(0, 8).map((c, i) => (
          <span class={`don ${i < g.donationStep ? 'used' : i === g.donationStep ? 'next' : ''}`}>{c}</span>
        ))}
      </div>
      <div class="sub-title">保护点数奖励板块（到达 5 / 8 时可选，每块限一人）</div>
      <div class="tiles">
        {g.tiles.map((t) => (
          <span class={`tile ${t.by !== null ? 'taken' : ''}`} title={tile(t.id).text}>
            <b class="tile-at">{t.at}</b>
            {tile(t.id).emoji} {tile(t.id).name}
            {t.by !== null && <i style={{ background: g.players[t.by].color }} />}
          </span>
        ))}
      </div>
    </div>
  );
}

// ———————————————————————————————————————————— 玩家详情

export function PlayerDetail({ g, pi }: { g: GameState; pi: number }) {
  const p = g.players[pi];
  const showScoring = pi === me() || g.over;
  return (
    <div class="player-detail">
      <PlayerStats g={g} pi={pi} />
      <div class="sub-title">行动卡</div>
      <div class="action-row small">
        {p.actions.map((a, i) => (
          <ActionCard a={a} slot={i + 1} up={p.upgraded[a]} />
        ))}
      </div>
      <div class="sub-title">赞助卡（{p.sponsors.length}）</div>
      <div class="mini-cards">
        {p.sponsors.map((id) => (
          <CardView id={id} size="sm" onClick={() => set({ modal: { k: 'card', id } })} />
        ))}
        {!p.sponsors.length && <span class="empty">还没有</span>}
      </div>
      <div class="sub-title">终局计分卡</div>
      <div class="mini-cards">
        {showScoring ? p.scoring.map((id) => <ScoringCardView id={id} current={scoringMetric(g, pi, id)} />) : <span class="empty">{p.scoring.length} 张（保密）</span>}
      </div>
    </div>
  );
}

// ———————————————————————————————————————————— 日志

export function LogPanel({ g }: { g: GameState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [g.log.length]);
  return (
    <div class="log" ref={ref}>
      {g.log.slice(-250).map((l) => (
        <div class="log-line">
          {l.p !== null ? (
            <b style={{ color: g.players[l.p].color }}>{g.players[l.p].name}</b>
          ) : (
            <b class="sys">●</b>
          )}{' '}
          {l.text}
        </div>
      ))}
    </div>
  );
}

export function BreakTrack({ g }: { g: GameState }) {
  if (g.solo) {
    return (
      <div class="break-track" title="单人挑战：共 6 轮，每轮结束时休息">
        <span>☕ 第 {Math.min(g.solo.round + 1, SOLO_ROUNDS.length)}/{SOLO_ROUNDS.length} 轮</span>
        <div class="bt">
          {Array.from({ length: SOLO_ROUNDS[g.solo.round] ?? 0 }, (_, i) => (
            <i class={i < (SOLO_ROUNDS[g.solo!.round] ?? 0) - g.solo!.left ? 'on' : ''} />
          ))}
        </div>
        <small>本轮还剩 {g.solo.left} 个回合</small>
      </div>
    );
  }
  return (
    <div class="break-track" title={`休息标记 ${g.breakPos}/${g.breakMax}：到达终点时触发休息（收入、弃牌到上限、工人回收、展示区更新）`}>
      <span>☕ 休息</span>
      <div class="bt">
        {Array.from({ length: g.breakMax }, (_, i) => (
          <i class={i < g.breakPos ? 'on' : ''} />
        ))}
      </div>
      <small>
        {g.breakPos}/{g.breakMax}
        {g.breaks ? ` · 已休息 ${g.breaks} 次` : ''}
      </small>
    </div>
  );
}

export { toast };
