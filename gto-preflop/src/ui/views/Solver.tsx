import { useEffect, useRef, useState } from 'preact/hooks';
import { ALLIN_ANYWHERE_STACK, DEFAULT_CONFIG, MAX_RAISE_FRACTION, type SolverConfig } from '../../engine/solver';
import { type SolveJob, startSolve } from '../../engine/solverClient';
import { fmtBB } from '../../engine/types';
import { getState, setState, useAppState } from '../store';
import { Explorer, SolverTree } from './Ranges';

const PRESETS: { label: string; cfg: Partial<SolverConfig> }[] = [
  { label: '推弃 10bb', cfg: { format: 'hu', stack: 10, pushFold: true, ante: 0 } },
  { label: '单挑 25bb', cfg: { format: 'hu', stack: 25, pushFold: false, openSize: 2, threeBetSize: 6, fourBetSize: 14, ante: 0 } },
  { label: '单挑 100bb', cfg: { format: 'hu', stack: 100, pushFold: false, openSize: 2.5, threeBetSize: 9, fourBetSize: 22, ante: 0 } },
  { label: '盲注对抗 100bb', cfg: { format: 'bvb', stack: 100, pushFold: false, openSize: 3, threeBetSize: 9, fourBetSize: 22, ante: 0 } },
];

let job: SolveJob | null = null;

function run(config: SolverConfig) {
  job?.cancel();
  setState((s) => ({ solver: { ...s.solver, config, running: true, progress: [], error: null } }));
  const j = startSolve(config, (p) => setState((s) => ({ solver: { ...s.solver, progress: [...s.solver.progress, p] } })));
  job = j;
  j.promise.then(
    (result) => {
      if (job !== j) return;
      job = null;
      setState((s) => ({ solver: { ...s.solver, result, running: false } }));
    },
    (err: Error) => {
      if (job !== j) return;
      job = null;
      setState((s) => ({ solver: { ...s.solver, running: false, error: err.message === 'cancelled' ? null : err.message } }));
    },
  );
}

function stop() {
  const j = job;
  job = null;
  j?.cancel();
  setState((s) => ({ solver: { ...s.solver, running: false } }));
}

export function Solver() {
  const s = useAppState();
  const sv = s.solver;
  const [key, setKey] = useState<string | null>(null);
  const started = useRef(false);

  // 第一次打开时直接用默认参数算一遍，让页面一开始就有结果可看
  useEffect(() => {
    if (!started.current && !getState().solver.result && !getState().solver.running) {
      started.current = true;
      run(getState().solver.config);
    }
  }, []);
  useEffect(() => setKey(null), [sv.result]);

  const result = sv.result;
  const node = result ? (result.nodes.find((n) => n.key === key) ?? result.nodes[0]) : null;

  return (
    <div class="workbench three">
      <div class="stack">
        <ConfigPanel />
        {result && (
          <div class="panel">
            <div class="panel-title">博弈树</div>
            <SolverTree nodes={result.nodes} current={node!.key} onPick={setKey} />
          </div>
        )}
      </div>
      {node && result ? (
        <Explorer node={node} state={s} editable={false} onNavigate={setKey} />
      ) : (
        <div class="panel empty-note" style={{ gridColumn: 'span 2' }}>
          {sv.running ? '正在求解……' : sv.error ? `求解出错：${sv.error}` : '设置参数后点"开始求解"。'}
        </div>
      )}
    </div>
  );
}

function ConfigPanel() {
  const s = useAppState();
  const sv = s.solver;
  const c = sv.config;
  const set = (patch: Partial<SolverConfig>) => setState((st) => ({ solver: { ...st.solver, config: { ...st.solver.config, ...patch } } }));
  const num = (v: string, fallback: number) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : fallback;
  };
  const last = sv.progress[sv.progress.length - 1];
  const r = sv.result;
  const pot = 1.5 + 2 * (r?.config.ante ?? c.ante);
  const maxRaise = c.stack * MAX_RAISE_FRACTION;
  const sizeNote = (v: number) => (v > maxRaise ? '超过筹码的 45%，改为只能全下' : '');

  return (
    <div class="panel stack" style={{ gap: 12 }}>
      <div class="panel-title" style={{ margin: 0 }}>单挑翻前求解器</div>
      <div class="chips">
        {PRESETS.map((p) => (
          <button type="button" class="chip" disabled={sv.running} onClick={() => set({ ...p.cfg })}>
            {p.label}
          </button>
        ))}
      </div>
      <div class="seg" role="group" aria-label="场景">
        <button type="button" aria-pressed={c.format === 'hu'} onClick={() => set({ format: 'hu' })}>
          单挑（SB 是按钮）
        </button>
        <button type="button" aria-pressed={c.format === 'bvb'} onClick={() => set({ format: 'bvb' })}>
          盲注对抗
        </button>
      </div>
      <label class="field">
        <span class="row">
          有效筹码
          <span class="spacer" />
          <b class="num">{c.stack}bb</b>
        </span>
        <input type="range" id="cfg-stack" min={5} max={150} step={1} value={c.stack} onInput={(e) => set({ stack: Number(e.currentTarget.value) })} />
      </label>
      <label class="toggle">
        <input type="checkbox" id="cfg-pushfold" checked={c.pushFold} onChange={(e) => set({ pushFold: e.currentTarget.checked })} />
        <span>
          <b>只推或弃</b>
          <span>小盲只能全下或弃牌，结果是精确的纳什均衡</span>
        </span>
      </label>
      <div class="form-grid">
        <label class="field">
          小盲加注到
          <input type="number" id="cfg-open" min={1.5} step={0.5} value={c.openSize} disabled={c.pushFold} onChange={(e) => set({ openSize: num(e.currentTarget.value, c.openSize) })} />
        </label>
        <label class="field">
          大盲 3-Bet 到
          <input type="number" id="cfg-3b" min={3} step={0.5} value={c.threeBetSize} disabled={c.pushFold} onChange={(e) => set({ threeBetSize: num(e.currentTarget.value, c.threeBetSize) })} />
        </label>
        <label class="field">
          小盲 4-Bet 到
          <input type="number" id="cfg-4b" min={6} step={1} value={c.fourBetSize} disabled={c.pushFold} onChange={(e) => set({ fourBetSize: num(e.currentTarget.value, c.fourBetSize) })} />
        </label>
        <label class="field">
          每人前注
          <input type="number" id="cfg-ante" min={0} max={1} step={0.05} value={c.ante} onChange={(e) => set({ ante: Math.max(0, num(e.currentTarget.value, c.ante)) })} />
        </label>
        {!c.pushFold && [c.openSize, c.threeBetSize, c.fourBetSize].some((v) => sizeNote(v)) && (
          <div class="full small muted">加注额超过有效筹码 45% 的那一级会被去掉，只保留全下。</div>
        )}
        <label class="field full">
          <span class="row">
            翻后无位置的劣势
            <span class="spacer" />
            <b class="num">{c.realization.toFixed(2)}</b>
          </span>
          <input type="range" id="cfg-real" min={0} max={0.6} step={0.05} value={c.realization} onInput={(e) => set({ realization: Number(e.currentTarget.value) })} />
        </label>
        <label class="field full">
          迭代次数
          <select id="cfg-iters" value={c.iterations} onChange={(e) => set({ iterations: Number(e.currentTarget.value) })}>
            {[300, 600, 1000, 2000].map((n) => (
              <option value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <div class="row">
        {sv.running ? (
          <button type="button" class="btn" onClick={stop}>
            停止
          </button>
        ) : (
          <button type="button" class="btn primary" onClick={() => run(getState().solver.config)}>
            开始求解
          </button>
        )}
        <button type="button" class="btn" disabled={sv.running} onClick={() => set({ ...DEFAULT_CONFIG })}>
          恢复默认
        </button>
      </div>
      {(sv.running || sv.progress.length > 0) && (
        <div class="stack" style={{ gap: 6 }}>
          <div class="progress">
            <span style={{ width: `${last ? (last.iteration / last.total) * 100 : 0}%` }} />
          </div>
          <div class="row small num">
            <span>
              迭代 {last?.iteration ?? 0} / {last?.total ?? c.iterations}
            </span>
            <span class="spacer" />
            {last && (
              <span>
                可剥削度 {(last.exploitability * 1000).toFixed(2)} mbb/手（{((last.exploitability / pot) * 100).toFixed(3)}% 底池）
              </span>
            )}
          </div>
          <Spark values={sv.progress.map((p) => p.exploitability)} />
        </div>
      )}
      {r && !sv.running && (
        <div class="stack" style={{ gap: 8 }}>
          <div class="facts">
            <span>
              SB 期望 <b class="num">{r.sbEv >= 0 ? '+' : ''}{r.sbEv.toFixed(3)}bb/手</b>
            </span>
            <span>
              {r.config.format === 'hu' ? '单挑' : '盲注对抗'} · {fmtBB(r.config.stack)}bb{r.config.pushFold ? ' · 推弃' : ''}
            </span>
          </div>
          <button type="button" class="btn primary" onClick={() => setState({ view: 'train', trainSource: 'solver' })}>
            用这个结果做训练
          </button>
        </div>
      )}
      <div class="note">
        <p>全下被跟注时按两手牌的真实胜率结算，所以"只推或弃"的结果是精确的纳什均衡（筹码 EV，不含 ICM）。</p>
        <p>
          加注被跟注后不再往下求解翻后，而是用"权益实现"模型估算：没有位置的一方只能实现部分胜率，筹码越深损失越大。深筹码的结果是近似值，适合理解趋势。有效筹码不超过 {ALLIN_ANYWHERE_STACK}bb 时，每一步都可以全下。
        </p>
      </div>
    </div>
  );
}

/** 可剥削度随迭代下降的小折线图（对数纵轴） */
function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 300;
  const h = 64;
  const logs = values.map((v) => Math.log10(Math.max(v, 1e-6)));
  const max = Math.max(...logs);
  const min = Math.min(...logs);
  const span = Math.max(max - min, 0.1);
  const pts = logs.map((v, i) => [4 + (i / (values.length - 1)) * (w - 8), 6 + ((max - v) / span) * (h - 12)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const lastPt = pts[pts.length - 1];
  return (
    <svg class="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="可剥削度随迭代下降">
      <line x1="0" x2={w} y1={h - 6} y2={h - 6} stroke="var(--line)" stroke-width="1" />
      <path d={`${d}L${lastPt[0]},${h - 6}L4,${h - 6}Z`} fill="var(--accent-soft)" stroke="none" />
      <path d={d} fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="3" fill="var(--accent)" />
    </svg>
  );
}
