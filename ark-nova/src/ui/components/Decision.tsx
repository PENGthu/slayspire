// 底部的决定栏（当前该做什么、可以点的按钮），以及选牌、选项、项目、放归等弹窗。
import type { ComponentChildren } from 'preact';
import { BUILDABLE, buildingDef } from '../../game/buildings';
import { card, project, SCORING_CARDS } from '../../game/content';
import { decision, optText } from '../../game/engine';
import { animalOptions, assocMoves, buildCost, buildableTypes, canIgnoreCondition, freeWorkers, range, sponsorError, workersNeeded } from '../../game/query';
import {
  ACTION_INFO,
  ACTION_TEXT,
  TASK_VALUE,
  UNIVERSITIES,
  animalsCount,
  cardsDraw,
  donationCost,
  snapStrength,
} from '../../game/rules';
import type { ActionId, Continent, GameState, Move, TaskId } from '../../game/types';
import { CONTINENTS } from '../../game/types';
import { animal } from '../../game/content';
import {
  anyOrientationFits,
  cardsInfo,
  clickProjectLevel,
  myDecision,
  placingType,
  rotate,
  selectBuild,
  type Decision,
} from '../interact';
import { CONT_COLOR, actionName } from '../meta';
import { act, canUndo, refresh, set, state, undo } from '../store';
import { CardView } from './CardView';
import { Modal, ScoringCardView } from './Common';

export function DecisionBar({ g }: { g: GameState }) {
  const f = decision(g);
  const mine = myDecision(g);
  if (g.over) return <div class="decision-bar"><b>游戏结束</b></div>;
  if (!f) return <div class="decision-bar" />;
  if (!mine) {
    const p = g.players[f.p];
    return (
      <div class="decision-bar waiting">
        <span class="spinner" style={{ borderTopColor: p.color }} />
        <span>
          <b style={{ color: p.color }}>{p.name}</b> {p.ai ? '正在思考…' : '正在行动…'}
        </span>
      </div>
    );
  }
  return (
    <div class="decision-bar">
      <DecisionContent g={g} f={mine} />
      {canUndo() && (
        <button class="ghost undo" onClick={undo} title="撤销上一步（抽到新牌之后不能撤销）">
          ↶ 撤销
        </button>
      )}
    </div>
  );
}

/** 决定栏的统一结构：标题、说明、一排操作 */
function DB({ title, hint, children, color }: { title: ComponentChildren; hint?: ComponentChildren; children?: ComponentChildren; color?: string }) {
  return (
    <div class="db-main">
      <div class="db-title" style={color ? { color } : undefined}>
        {title}
      </div>
      {hint && <div class="db-hint">{hint}</div>}
      {children && <div class="db-controls">{children}</div>}
    </div>
  );
}

function DecisionContent({ g, f }: { g: GameState; f: Decision }) {
  const p = g.players[f.p];
  switch (f.k) {
    case 'turn':
      return <TurnChoice g={g} />;
    case 'build': {
      const types = buildableTypes(p, f);
      return (
        <DB title={`建造 · 强度 ${f.str}${f.up ? ' II' : ''} · 剩余 ${f.budget} 格`} hint={state.sel.build ? '在地图上点击放置（亮起的格子可以放），R 键或「旋转」改变朝向。' : '选择要建造的建筑（每格 2 元）。'}>
          <BuildPalette types={BUILDABLE} enabled={types} costOf={buildCost} />
          <PlacementTools g={g} />
          <button class="primary" onClick={() => act({ t: 'done' })}>
            {f.done ? '完成建造' : '不建造了'}
          </button>
        </DB>
      );
    }
    case 'place':
      return (
        <DB title={f.reason} hint="选择建筑，然后在地图上放置。">
          <BuildPalette types={f.types} enabled={f.types} costOf={() => 0} />
          <PlacementTools g={g} />
          <button onClick={() => act({ t: 'done' })}>跳过</button>
        </DB>
      );
    case 'animals':
      return (
        <DB
          title={`动物 · 强度 ${f.str}${f.up ? ' II' : ''} · 还可打出 ${f.left} 只`}
          hint={
            f.left > 0
              ? state.sel.card
                ? `把${animal(state.sel.card).name}放进哪座建筑？点击地图上高亮的建筑。`
                : `点击手牌${f.up ? '或声望范围内的展示区' : ''}中亮边的动物，再选择建筑。${canIgnoreCondition(f) ? '本次如果只打出 1 只，可以忽略它的 1 个条件。' : ''}`
              : '已达到本次行动可打出的数量。'
          }
        >
          {state.sel.card && (
            <button
              onClick={() => {
                state.sel.card = null;
                refresh();
              }}
            >
              换一只
            </button>
          )}
          <button class="primary" onClick={() => act({ t: 'done' })}>
            {f.played ? '结束行动' : '不打出动物'}
          </button>
        </DB>
      );
    case 'cards': {
      const info = cardsInfo(g)!;
      const picks = state.sel.displayPicks;
      return (
        <DB
          title={`卡牌 · 强度 ${f.str}${f.up ? ' II' : ''}`}
          hint={
            <>
              抽 {info.draw} 张{info.discard ? `，再弃 ${info.discard} 张` : ''}
              {info.up ? `；可以从展示区前 ${info.range} 张中选牌计入抽牌` : ''}
              {info.snap ? `；或点击展示区的牌直接拿走（抢先）` : ''}。休息标记 +2。
            </>
          }
        >
          <button class="primary" onClick={() => act({ t: 'draw', display: picks })}>
            抽牌{picks.length ? `（${picks.length} 张来自展示区）` : ''}
          </button>
        </DB>
      );
    }
    case 'assoc':
      return <AssocChoice g={g} f={f} />;
    case 'sponsors': {
      const money = f.up ? f.str * 2 : f.str;
      return (
        <DB
          title={`赞助 · 强度 ${f.str}${f.up ? ' II' : ''} · 剩余等级 ${f.budget}`}
          hint={state.sel.card ? `在地图上放置专属建筑「${card(state.sel.card).name}」。` : `点击亮边的赞助卡打出${f.up ? '（也可以从展示区打出，额外付位置编号的钱）' : ''}，或者改为拿钱。`}
        >
          {state.sel.card && <PlacementTools g={g} />}
          {state.sel.card && (
            <button
              onClick={() => {
                state.sel.card = null;
                refresh();
              }}
            >
              取消
            </button>
          )}
          {f.played === 0 && (
            <button onClick={() => act({ t: 'sponsorMoney' })} title="不打出赞助卡，改为拿钱；休息标记前进同样格数">
              改为拿 {money} 元（休息 +{f.str}）
            </button>
          )}
          <button class="primary" onClick={() => act({ t: 'done' })}>
            {f.played ? '结束行动' : '放弃'}
          </button>
        </DB>
      );
    }
    case 'display':
      return (
        <DB
          title={f.reason}
          hint={f.swap ? `用${card(f.swap).name}交换展示区（前 ${range(g.players[f.p])} 张）中的一张牌。` : `点击展示区${f.any ? '任意位置' : '声望范围内'}的牌拿走（${f.n} 张）。`}
        >
          <button onClick={() => act({ t: 'done' })}>{f.swap ? '不交换' : '跳过'}</button>
        </DB>
      );
    case 'pick':
      return <DB title="请在弹窗中选择" />;
    case 'choose':
      return <DB title={f.reason} />;
  }
}

function TurnChoice({ g }: { g: GameState }) {
  const f = myDecision(g)!;
  const p = g.players[f.p];
  const a = state.sel.action;
  if (!a) {
    return <DB title="轮到你了：选择一张行动卡" hint="行动卡所在的位置就是它的强度（1–5）。用过的卡回到 1 号位，其余的卡右移。" />;
  }
  const slot = p.actions.indexOf(a) + 1;
  const str = slot + state.sel.x;
  const up = p.upgraded[a];
  return (
    <DB
      color={ACTION_INFO[a].color}
      title={`${ACTION_INFO[a].emoji} ${ACTION_INFO[a].name}${up ? ' II' : ' I'} · 强度 ${str}`}
      hint={
        <>
          <ActionPreview g={g} a={a} str={str} /> {ACTION_TEXT[a][up ? 1 : 0]}
        </>
      }
    >
      {p.x > 0 && (
        <span class="stepper" title="每个 X 标记让强度 +1">
          X
          <button
            disabled={state.sel.x <= 0}
            onClick={() => {
              state.sel.x--;
              refresh();
            }}
          >
            −
          </button>
          <b>{state.sel.x}</b>
          <button
            disabled={state.sel.x >= p.x}
            onClick={() => {
              state.sel.x++;
              refresh();
            }}
          >
            +
          </button>
        </span>
      )}
      <button class="primary" onClick={() => act({ t: 'action', action: a, x: state.sel.x })}>
        执行（强度 {str}）
      </button>
      <button onClick={() => act({ t: 'xaction', action: a })} title="不执行行动：把这张卡移到 1 号位，获得 1 个 X 标记">
        改拿 X 标记
      </button>
    </DB>
  );
}

function ActionPreview({ g, a, str }: { g: GameState; a: ActionId; str: number }) {
  const f = myDecision(g)!;
  const p = g.players[f.p];
  const up = p.upgraded[a];
  let text = '';
  if (a === 'animals') {
    const n = animalsCount(str, up);
    const opts = n > 0 ? animalOptions(g, f.p, up, !up && n >= 2) : [];
    const kinds = new Set(opts.map((o) => o.card)).size;
    text = `可以打出 ${n} 只动物${n > 0 ? `（现在能打出的动物 ${kinds} 张）` : ''}。`;
  }
  if (a === 'cards') {
    const d = cardsDraw(str, up);
    text = `抽 ${d.draw} 张${d.discard ? `弃 ${d.discard} 张` : ''}${str >= snapStrength(up) ? '，或抢先拿 1 张' : ''}。`;
  }
  if (a === 'build') {
    const fake = { k: 'build' as const, p: f.p, str, up, budget: str, built: [], done: 0 };
    const types = buildableTypes(p, fake);
    text = `最多 ${str} 格${types.length ? '' : '（钱不够或放不下）'}。`;
  }
  if (a === 'association') {
    const fake = { k: 'assoc' as const, p: f.p, str, up, budget: str, used: [], donated: false };
    const moves = assocMoves(g, f.p, fake);
    const proj = moves.filter((m) => m.t === 'assoc' && m.task === 'project').length;
    text = `任务价值 ≤ ${str}，空闲工人 ${freeWorkers(g, f.p)}${proj ? `，可以支持 ${proj} 个项目档位` : ''}。`;
  }
  if (a === 'sponsors') {
    const budget = up ? str + 1 : str;
    const fake = { k: 'sponsors' as const, p: f.p, str, up, budget, played: 0 };
    const playable = p.hand.filter((id) => card(id).kind === 'sponsor' && sponsorError(g, f.p, fake, id, -1, []) !== '等级超过行动强度').filter((id) => {
      const c = card(id);
      return c.kind === 'sponsor' && c.level <= budget;
    }).length;
    text = `等级 ≤ ${budget}${playable ? `（手牌中 ${playable} 张够等级）` : ''}，或拿 ${up ? 2 * str : str} 元。`;
  }
  return <b class="preview">{text}</b>;
}

function BuildPalette({ types, enabled, costOf }: { types: string[]; enabled: string[]; costOf: (t: string) => number }) {
  return (
    <>
      {types.map((t) => {
        const def = buildingDef(t);
        const on = enabled.includes(t) && anyOrientationFits(state.g!, t);
        return (
          <button
            class={`pal ${state.sel.build === t ? 'selected' : ''}`}
            disabled={!on}
            onClick={() => selectBuild(state.sel.build === t ? null : t)}
            title={`${def.name}：${def.text}${costOf(t) ? `（${costOf(t)} 元）` : ''}`}
          >
            <span class="pal-shape">{def.kind === 'enclosure' ? `⬡${def.shape.length}` : def.emoji}</span>
            <span class="pal-name">{def.kind === 'enclosure' ? '围栏' : def.name}</span>
            {costOf(t) > 0 && <small>{costOf(t)}元</small>}
          </button>
        );
      })}
    </>
  );
}

function PlacementTools({ g }: { g: GameState }) {
  if (!placingType(g)) return null;
  return (
    <button onClick={rotate} title="旋转 / 翻转（快捷键 R）">
      ⟳ 旋转
    </button>
  );
}

function AssocChoice({ g, f }: { g: GameState; f: Extract<Decision, { k: 'assoc' }> }) {
  const moves = assocMoves(g, f.p, f);
  const has = (task: TaskId) => moves.some((m) => m.t === 'assoc' && m.task === task);
  const why = (task: TaskId): string => {
    if (TASK_VALUE[task] > f.budget) return `价值 ${TASK_VALUE[task]} 超过剩余强度`;
    if (f.used.includes(task)) return '本次已做过';
    if (freeWorkers(g, f.p) < workersNeeded(g, task)) return `需要 ${workersNeeded(g, task)} 名空闲工人`;
    return '没有可选的目标';
  };
  const partnerMoves = moves.filter((m) => m.t === 'assoc' && m.task === 'partner') as Extract<Move, { task: 'partner' }>[];
  const uniMoves = moves.filter((m) => m.t === 'assoc' && m.task === 'university') as Extract<Move, { task: 'university' }>[];
  return (
    <DB
      title={`协会 · 强度 ${f.str}${f.up ? ' II' : ''} · 剩余 ${f.budget} · 空闲工人 ${freeWorkers(g, f.p)}`}
      hint={has('project') ? '⑤ 保护项目：在协会版图上点击亮起的档位（或从手牌打出项目卡）。' : `⑤ 保护项目：${why('project')}`}
    >
      <button disabled={!has('rep')} title={has('rep') ? '声望 +2' : why('rep')} onClick={() => act({ t: 'assoc', task: 'rep' })}>
        ② 声望 +2
      </button>
      <span class="group" title={has('partner') ? '选择一个大洲' : why('partner')}>
        ③ 合作动物园
        {CONTINENTS.map((c: Continent) => {
          const ok = partnerMoves.some((m) => m.continent === c);
          return (
            <button class="cont" style={{ '--cc': CONT_COLOR[c] }} disabled={!ok} onClick={() => act({ t: 'assoc', task: 'partner', continent: c })}>
              {{ africa: '非洲', europe: '欧洲', asia: '亚洲', americas: '美洲', australia: '大洋洲' }[c]}
            </button>
          );
        })}
      </span>
      <span class="group" title={has('university') ? '选择一所大学' : why('university')}>
        ④ 大学
        {UNIVERSITIES.map((u) => {
          const ok = uniMoves.some((m) => m.uni === u.id);
          return (
            <button disabled={!ok} title={u.text} onClick={() => act({ t: 'assoc', task: 'university', uni: u.id })}>
              {u.emoji}
              {u.name}
            </button>
          );
        })}
      </span>
      {f.up && (
        <button disabled={!moves.some((m) => m.t === 'donate')} onClick={() => act({ t: 'donate' })}>
          捐款 {donationCost(g.donationStep)} 元 → 1 保护点数
        </button>
      )}
      <button class="primary" onClick={() => act({ t: 'done' })}>
        {f.used.length ? '结束行动' : '放弃'}
      </button>
    </DB>
  );
}

// ———————————————————————————————————————————— 弹窗

const PICK_TITLE: Record<string, (min: number, max: number) => string> = {
  discard: (n) => `弃掉 ${n} 张手牌`,
  keep: (n) => `保留 ${n} 张牌`,
  keepAnimal: () => '狩猎：可以保留其中 1 张动物卡',
  setup: () => '开局：从 8 张牌中保留 4 张',
  scoring: () => '选择 1 张终局计分卡（保密，游戏结束时计分）',
  scoringKeep: () => '有玩家达到保护点数 10：保留 1 张终局计分卡，弃掉其余的',
  sell: (_, max) => `日光浴：出售最多 ${max} 张手牌（每张 4 元）`,
  pouch: () => '育儿袋：可以把 1 张手牌放进育儿袋（+2 吸引力）',
  dig: (_, max) => `掘地：弃掉最多 ${max} 张手牌，再抽同样数量`,
  trade: () => '交换：选择 1 张手牌，用来交换展示区的牌',
};

export function PickModal({ g }: { g: GameState }) {
  const f = myDecision(g);
  if (!f || f.k !== 'pick') return null;
  const p = g.players[f.p];
  const pool = f.cards.length ? f.cards : p.hand;
  const min = Math.min(f.min, pool.length);
  const picks = state.sel.picks;
  const ok = picks.length >= min && picks.length <= f.max;
  const toggle = (id: string) => {
    if (picks.includes(id)) state.sel.picks = picks.filter((x) => x !== id);
    else if (picks.length < f.max) state.sel.picks = [...picks, id];
    else if (f.max === 1) state.sel.picks = [id];
    refresh();
  };
  const scoring = f.purpose === 'scoring' || f.purpose === 'scoringKeep';
  return (
    <Modal title={`${PICK_TITLE[f.purpose](min, f.max)}`} wide>
      {f.purpose === 'setup' && <p class="hint">开局选牌：建议保留便宜、能尽快打出的动物和有用的赞助卡。</p>}
      {f.purpose === 'discard' && <p class="hint">休息时手牌超过上限，或卡牌行动需要弃牌。</p>}
      <div class="pick-grid">
        {pool.map((id) =>
          scoring ? (
            <ScoringCardView id={id} selected={picks.includes(id)} onClick={() => toggle(id)} />
          ) : (
            <CardView
              id={id}
              size="md"
              selected={picks.includes(id)}
              dim={f.purpose === 'keepAnimal' && card(id).kind !== 'animal'}
              onClick={() => (f.purpose === 'keepAnimal' && card(id).kind !== 'animal' ? undefined : toggle(id))}
              onInfo={() => set({ modal: { k: 'card', id } })}
            />
          ),
        )}
      </div>
      <div class="modal-actions">
        <span>
          已选 {picks.length} / {min === f.max ? f.max : `${min}–${f.max}`}
        </span>
        <button class="primary" disabled={!ok} onClick={() => act({ t: 'cards', cards: picks })}>
          确定
        </button>
      </div>
    </Modal>
  );
}

export function ChooseModal({ g }: { g: GameState }) {
  const f = myDecision(g);
  if (!f || f.k !== 'choose') return null;
  return (
    <Modal title={f.reason}>
      <div class="choose-list">
        {f.opts.map((o, i) => (
          <button class="choice" onClick={() => act({ t: 'choose', i })}>
            {optText(g, o)}
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function ProjectModal({ g, id, fromHand, display }: { g: GameState; id: string; fromHand: boolean; display?: number }) {
  const c = project(id);
  const f = myDecision(g);
  const close = () => set({ modal: null });
  return (
    <Modal title={`${c.emoji} ${c.name}`} onClose={close}>
      <div class="project-modal">
        <CardView id={id} size="lg" />
        <div class="choose-list">
          {f?.k === 'assoc' ? (
            c.levels.map((lv, i) => (
              <button
                class="choice"
                onClick={() => {
                  state.modal = null;
                  clickProjectLevel(id, i, fromHand, display);
                }}
              >
                {display !== undefined ? `从展示区打出（${display + 1} 元）并支持` : fromHand ? '打出并支持' : '支持'}：{c.goal.k === 'release' ? `放归体型 ≥ ${lv.need}` : `需要 ${lv.need}`} → {lv.cp} 保护点数
              </button>
            ))
          ) : (
            <p class="hint">在协会行动中，用强度 5 的任务把它打出到协会版图上，并立即支持其中一档。</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function ReleaseModal({ g, id, level, fromHand, display }: { g: GameState; id: string; level: number; fromHand: boolean; display?: number }) {
  const f = myDecision(g);
  if (!f || f.k !== 'assoc') return null;
  const moves = assocMoves(g, f.p, f).filter(
    (m) => m.t === 'assoc' && m.task === 'project' && m.project === id && m.level === level && m.fromHand === fromHand && m.display === display,
  ) as Extract<Move, { task: 'project' }>[];
  return (
    <Modal title="选择要放归的动物（会失去它的吸引力）" onClose={() => set({ modal: null })}>
      <div class="pick-grid">
        {moves.map((m) => (
          <CardView
            id={m.release!.card}
            size="md"
            onClick={() => {
              state.modal = null;
              act(m);
            }}
          />
        ))}
      </div>
    </Modal>
  );
}

export function CardModal({ id }: { id: string }) {
  if (SCORING_CARDS[id]) {
    return (
      <Modal title="终局计分卡" onClose={() => set({ modal: null })}>
        <ScoringCardView id={id} />
      </Modal>
    );
  }
  return (
    <div class="modal-bg" onClick={() => set({ modal: null })}>
      <div class="card-zoom" onClick={(e) => e.stopPropagation()}>
        <CardView id={id} size="lg" />
        <button class="close-zoom" onClick={() => set({ modal: null })}>
          关闭
        </button>
      </div>
    </div>
  );
}

export { actionName };
