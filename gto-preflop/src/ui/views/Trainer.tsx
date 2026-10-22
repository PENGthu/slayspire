import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { FAMILY_NAMES, POSITIONS } from '../../engine/sixmax';
import { record } from '../../engine/stats';
import { type Deal, GRADE_TEXT, type Verdict, deal, dealFrom, eligibleNodes, grade } from '../../engine/trainer';
import { describeLine, fmtBB, type SpotNode, tableState } from '../../engine/types';
import { HAND_LABELS } from '../../poker/cards';
import { equityVsRange } from '../../poker/equity';
import { HandText } from '../components/PlayingCard';
import { PokerTable } from '../components/PokerTable';
import { MixBar, RangeGrid } from '../components/RangeGrid';
import { type AppState, getState, nodesOf, setState, updateSettings, useAppState } from '../store';

interface Answer {
  action: number;
  verdict: Verdict;
}

const SIXMAX_FAMILIES = ['RFI', 'VO', 'V3', 'V4', 'V5'];
const SOLVER_FAMILIES = ['RFI', 'VO', 'V3', 'V4', 'VA'];

function filterFor(s: AppState) {
  const solver = s.trainSource === 'solver' && !!s.solver.result;
  return {
    solver,
    families: solver ? s.settings.solverFamilies : s.settings.families,
    heroes: solver ? s.settings.solverHeroes : s.settings.heroes,
    focus: s.settings.focus,
  };
}

export function Trainer() {
  const s = useAppState();
  const f = filterFor(s);
  const nodes = nodesOf(s, f.solver ? 'solver' : 'sixmax');
  const eligible = useMemo(() => eligibleNodes(nodes.values(), f), [nodes, f.families.join(), f.heroes.join(), f.focus]);
  const [cur, setCur] = useState<Deal | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [session, setSession] = useState({ n: 0, ok: 0, streak: 0, best: 0 });
  const timer = useRef<number | undefined>(undefined);

  const next = useCallback(() => {
    clearTimeout(timer.current);
    const st = getState();
    const src = nodesOf(st, filterFor(st).solver ? 'solver' : 'sixmax');
    let d: Deal | null = null;
    if (st.drill?.length) {
      const queue = [...st.drill];
      while (queue.length && !d) {
        const item = queue.shift()!;
        const node = src.get(item.key);
        if (node && node.heroReach[item.hand] > 0) d = dealFrom(node, item.hand);
      }
      setState({ drill: queue.length ? queue : null });
    }
    d ??= deal(eligibleNodes(src.values(), filterFor(st)), filterFor(st));
    setCur(d);
    setAnswer(null);
  }, []);

  // 第一次进入、或筛选条件变化导致当前题目不再符合时，换一题
  useEffect(() => {
    if (!cur || !eligible.some((n) => n.key === cur.node.key)) {
      if (!getState().drill) next();
    }
  }, [eligible]);
  useEffect(() => {
    if (s.drill?.length) next();
  }, [s.drill === null]);

  const choose = useCallback(
    (a: number) => {
      if (!cur || answer) return;
      const st = getState();
      const v = grade(cur.node, cur.hand, a, st.settings.rngMode, cur.rng);
      setAnswer({ action: a, verdict: v });
      setSession((x) => {
        const streak = v.correct ? x.streak + 1 : 0;
        return { n: x.n + 1, ok: x.ok + (v.correct ? 1 : 0), streak, best: Math.max(x.best, streak) };
      });
      setState({
        stats: record(st.stats, {
          t: Date.now(),
          key: cur.node.key,
          title: cur.node.title,
          family: cur.node.family,
          hero: cur.node.hero,
          source: cur.node.source,
          hand: cur.hand,
          cards: cur.cards,
          action: cur.node.actions[a].label,
          grade: v.grade,
          correct: v.correct,
          labels: cur.node.actions.map((x) => x.label),
          freqs: v.freqs.map((x) => Math.round(x * 1000) / 1000),
        }),
      });
      if (st.settings.autoNext && v.correct) timer.current = window.setTimeout(next, 1100);
    },
    [cur, answer, next],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select')) return;
      if (answer) {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'n') {
          e.preventDefault();
          next();
        }
        return;
      }
      if (!cur) return;
      const acts = cur.node.actions;
      let idx = acts.findIndex((x) => x.key === e.key.toLowerCase());
      if (idx < 0 && /^[1-9]$/.test(e.key)) idx = Number(e.key) - 1;
      if (idx >= 0 && idx < acts.length) {
        e.preventDefault();
        choose(idx);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cur, answer, choose, next]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div class="workbench">
      <div class="stack">
        {cur ? (
          <Spot deal={cur} answer={answer} onChoose={choose} onNext={next} rngMode={s.settings.rngMode} />
        ) : (
          <div class="panel empty-note">
            <p>没有符合当前筛选条件的场景。</p>
            <p class="small">在右侧"练习哪些场景"里至少选一种场景和一个位置。</p>
          </div>
        )}
      </div>
      <div class="stack">
        {cur && answer && <Feedback deal={cur} answer={answer} rngMode={s.settings.rngMode} />}
        {!answer && <HowTo />}
        <SessionPanel session={session} drillLeft={s.drill?.length ?? 0} />
        <FilterPanel />
      </div>
    </div>
  );
}

function Spot({ deal: d, answer, onChoose, onNext, rngMode }: { deal: Deal; answer: Answer | null; onChoose: (a: number) => void; onNext: () => void; rngMode: boolean }) {
  const n = d.node;
  const st = tableState(n);
  const line = describeLine(n.line);
  return (
    <div class="panel stack">
      <div class="scenario">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div class="row" style={{ marginBottom: 6 }}>
            <span class="family-badge">{FAMILY_NAMES[n.family] ?? n.family}</span>
            <span class="small muted">
              {n.source === 'solver' ? `求解器 · ${n.seats.length === 2 ? '单挑' : ''} ${fmtBB(n.stack)}bb` : `6 人桌 · ${n.stack}bb`}
            </span>
          </div>
          <h2>{n.title}</h2>
          <div class="line">{line || '前面的人还没有行动'}</div>
        </div>
        {rngMode && (
          <div style={{ textAlign: 'right' }}>
            <div class="small muted">随机数</div>
            <div class="num" style={{ font: '800 34px/1 var(--font-display)' }}>
              {d.rng}
            </div>
          </div>
        )}
      </div>
      <PokerTable node={n} cards={d.cards} />
      <div class="facts">
        <span>
          手牌 <b><HandText cards={d.cards} /></b>（{HAND_LABELS[d.hand]}）
        </span>
        <span>
          底池 <b class="num">{fmtBB(st.pot)}bb</b>
        </span>
        <span>
          需跟注 <b class="num">{fmtBB(st.toCall)}bb</b>
        </span>
        {st.toCall > 0 && (
          <span>
            底池赔率 <b class="num">{((st.toCall / (st.pot + st.toCall)) * 100).toFixed(0)}%</b>
          </span>
        )}
      </div>
      <div class="actions">
        {n.actions.map((a, i) => {
          const f = answer?.verdict.freqs[i];
          return (
            <button
              type="button"
              class={`act-btn tone-${a.tone}${answer?.action === i ? ' chosen' : ''}`}
              disabled={!!answer}
              onClick={() => onChoose(i)}
            >
              {f != null && <span class="fill" style={{ height: `${f * 100}%` }} />}
              <span class="lbl">{a.label}</span>
              {f != null ? <span class="pct num">{(f * 100).toFixed(0)}%</span> : <kbd>{a.key.toUpperCase()}</kbd>}
            </button>
          );
        })}
      </div>
      {answer && (
        <button type="button" class="btn primary" onClick={onNext}>
          下一手 <kbd style={{ background: 'transparent', color: 'inherit' }}>空格</kbd>
        </button>
      )}
    </div>
  );
}

function Feedback({ deal: d, answer, rngMode }: { deal: Deal; answer: Answer; rngMode: boolean }) {
  const n = d.node;
  const v = answer.verdict;
  const k = n.actions.length;
  const eq = n.villainReach ? equityVsRange(d.hand, n.villainReach) : NaN;
  const evs = n.ev ? Array.from(n.ev.subarray(d.hand * k, d.hand * k + k)) : null;
  const openInRanges = () => setState({ view: 'ranges', rangesKey: n.key, rangesSource: n.source === 'solver' ? 'solver' : 'sixmax' });
  return (
    <div class={`panel stack pop`} key={`${n.key}-${d.hand}-${d.cards.join()}`}>
      <div class={`verdict ${v.grade}`}>
        <span class="verdict-mark">{GRADE_TEXT[v.grade]}</span>
      </div>
      <div class="small" style={{ color: 'var(--ink-2)' }}>
        {explain(n, d, answer, rngMode)}
      </div>
      <MixBar node={n} hand={d.hand} />
      <table class="mixtable">
        <tbody>
          {n.actions.map((a, i) => (
            <tr class={i === answer.action ? 'picked' : ''}>
              <td>
                <span class={`dot tone-${a.tone}`} />
                {a.label}
                {i === answer.action && <span class="muted">（你的选择）</span>}
                {rngMode && v.rngAction === i && <span class="muted">（随机数指向）</span>}
              </td>
              {evs && <td class="r num">{Number.isFinite(evs[i]) ? `${evs[i] >= 0 ? '+' : ''}${evs[i].toFixed(2)}bb` : '—'}</td>}
              <td class="num">{(v.freqs[i] * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div class="facts">
        {Number.isFinite(eq) && (
          <span>
            对抗 {n.villain} 范围的胜率 <b class="num">{(eq * 100).toFixed(1)}%</b>
          </span>
        )}
        {v.evLoss != null && (
          <span>
            EV 损失 <b class="num">{v.evLoss.toFixed(2)}bb</b>
          </span>
        )}
      </div>
      <div>
        <div class="panel-title" style={{ marginBottom: 6 }}>
          <span>这个场景的完整范围</span>
          <button type="button" class="btn" style={{ padding: '3px 8px', fontSize: 12, letterSpacing: 0, textTransform: 'none' }} onClick={openInRanges}>
            放大查看
          </button>
        </div>
        <RangeGrid node={n} highlight={d.hand} compact onSelect={openInRanges} />
      </div>
    </div>
  );
}

function explain(n: SpotNode, d: Deal, answer: Answer, rngMode: boolean): string {
  const v = answer.verdict;
  const label = HAND_LABELS[d.hand];
  const parts = n.actions
    .map((a, i) => ({ a, f: v.freqs[i] }))
    .filter((x) => x.f >= 0.005)
    .sort((x, y) => y.f - x.f)
    .map((x) => `${x.a.short} ${(x.f * 100).toFixed(0)}%`);
  const mix = parts.length > 1 ? `混合策略：${parts.join('，')}` : `纯策略：${parts[0]}`;
  if (rngMode && v.rngAction != null) {
    const target = n.actions[v.rngAction].short;
    return `${label} 在这里是${mix}。随机数 ${d.rng} 落在"${target}"的区间，所以这一手应该${target}。`;
  }
  if (v.grade === 'good') return `${label} 在这里是${mix}。你的选择是 GTO 会采用的打法之一。`;
  return `${label} 在这里是${mix}。`;
}

function HowTo() {
  return (
    <div class="panel note">
      <div class="panel-title">怎么练</div>
      <p>看清位置和前面的行动，选出你的打法。答完后会显示这手牌的 GTO 频率和整个范围。</p>
      <p>
        快捷键：<kbd>F</kbd> 弃牌 · <kbd>C</kbd> 跟注 · <kbd>R</kbd> 加注 · <kbd>A</kbd> 全下 · <kbd>空格</kbd> 下一手
      </p>
      <p>频率 ≥ 20% 的行动都算对（混合策略）；打开"随机数模式"后，混合手牌要按随机数选出唯一正确的行动。</p>
    </div>
  );
}

function SessionPanel({ session, drillLeft }: { session: { n: number; ok: number; streak: number; best: number }; drillLeft: number }) {
  return (
    <div class="panel">
      <div class="panel-title">
        <span>本次练习</span>
        {drillLeft > 0 && <span class="family-badge">错题重练 · 剩 {drillLeft} 题</span>}
      </div>
      <div class="kpis">
        <div class="kpi">
          <b class="num">{session.n}</b>
          <span>手数</span>
        </div>
        <div class="kpi">
          <b class="num">{session.n ? `${Math.round((session.ok / session.n) * 100)}%` : '—'}</b>
          <span>正确率</span>
        </div>
        <div class="kpi">
          <b class="num">{session.streak}</b>
          <span>连对</span>
        </div>
        <div class="kpi">
          <b class="num">{session.best}</b>
          <span>最长连对</span>
        </div>
      </div>
    </div>
  );
}

function FilterPanel() {
  const s = useAppState();
  const solverReady = !!s.solver.result;
  const useSolver = s.trainSource === 'solver' && solverReady;
  const fams = useSolver ? SOLVER_FAMILIES : SIXMAX_FAMILIES;
  const heroes = useSolver ? ['SB', 'BB'] : [...POSITIONS];
  const selFam = useSolver ? s.settings.solverFamilies : s.settings.families;
  const selHero = useSolver ? s.settings.solverHeroes : s.settings.heroes;
  const toggle = (list: string[], x: string) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  const setFam = (x: string) => updateSettings(useSolver ? { solverFamilies: toggle(selFam, x) } : { families: toggle(selFam, x) });
  const setHero = (x: string) => updateSettings(useSolver ? { solverHeroes: toggle(selHero, x) } : { heroes: toggle(selHero, x) });
  return (
    <div class="panel stack" style={{ gap: 12 }}>
      <div class="panel-title" style={{ margin: 0 }}>练习哪些场景</div>
      <div class="seg" role="group" aria-label="题目来源">
        <button type="button" aria-pressed={!useSolver} onClick={() => setState({ trainSource: 'sixmax' })}>
          6 人桌 100bb
        </button>
        <button
          type="button"
          aria-pressed={useSolver}
          disabled={!solverReady}
          title={solverReady ? '' : '先在"求解器"页算出一个结果'}
          onClick={() => setState({ trainSource: 'solver' })}
        >
          求解器结果
        </button>
      </div>
      <div>
        <div class="small muted" style={{ marginBottom: 6 }}>场景</div>
        <div class="chips">
          {fams.map((x) => (
            <button type="button" class="chip" aria-pressed={selFam.includes(x)} onClick={() => setFam(x)}>
              {FAMILY_NAMES[x]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div class="small muted" style={{ marginBottom: 6 }}>我的位置</div>
        <div class="chips">
          {heroes.map((x) => (
            <button type="button" class="chip" aria-pressed={selHero.includes(x)} onClick={() => setHero(x)}>
              {x}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label class="toggle">
          <input type="checkbox" id="opt-focus" checked={s.settings.focus} onChange={(e) => updateSettings({ focus: e.currentTarget.checked })} />
          <span>
            <b>边缘牌优先</b>
            <span>多出范围边缘和混合频率的手牌，少出一眼能判断的牌</span>
          </span>
        </label>
        <label class="toggle">
          <input type="checkbox" id="opt-rng" checked={s.settings.rngMode} onChange={(e) => updateSettings({ rngMode: e.currentTarget.checked })} />
          <span>
            <b>随机数模式</b>
            <span>混合策略按 0–99 的随机数决定唯一正确的行动</span>
          </span>
        </label>
        <label class="toggle">
          <input type="checkbox" id="opt-auto" checked={s.settings.autoNext} onChange={(e) => updateSettings({ autoNext: e.currentTarget.checked })} />
          <span>
            <b>答对自动下一手</b>
            <span>答错时停下来，方便看范围</span>
          </span>
        </label>
      </div>
    </div>
  );
}
