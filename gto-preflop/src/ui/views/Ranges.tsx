import { useEffect, useMemo, useState } from 'preact/hooks';
import { FAMILY_NAMES, POSITIONS, type Pos, defaultSixMax, nodeKey } from '../../engine/sixmax';
import { describeLine, freqAt, type SpotNode } from '../../engine/types';
import { HAND_COMBOS, HAND_LABELS } from '../../poker/cards';
import { exportNode, importNode } from '../../engine/rangeIO';
import { equityVsRange } from '../../poker/equity';
import { Legend, MixBar, RangeGrid, actionTotals } from '../components/RangeGrid';
import { type AppState, findNode, nodesOf, setState, useAppState } from '../store';

const FAMS = ['RFI', 'VO', 'V3', 'V4', 'V5'] as const;
type Fam = (typeof FAMS)[number];

const idx = (p: Pos) => POSITIONS.indexOf(p);
const openers = POSITIONS.filter((p) => p !== 'BB') as Pos[];

/** 某种场景下可选的"我的位置" */
function heroesFor(f: Fam): Pos[] {
  return f === 'RFI' || f === 'V3' || f === 'V5' ? openers : (POSITIONS.slice(1) as Pos[]);
}
/** 某种场景、某个位置下可选的对手位置 */
function villainsFor(f: Fam, hero: Pos): Pos[] {
  if (f === 'RFI') return [];
  if (f === 'VO' || f === 'V4') return openers.filter((p) => idx(p) < idx(hero));
  return POSITIONS.filter((p) => idx(p) > idx(hero)) as Pos[];
}
function keyFor(f: Fam, hero: Pos, villain: Pos | undefined): string {
  switch (f) {
    case 'RFI':
      return nodeKey.rfi(hero);
    case 'VO':
      return nodeKey.vo(hero, villain!);
    case 'V3':
      return nodeKey.v3(hero, villain!);
    case 'V4':
      return nodeKey.v4(hero, villain!);
    case 'V5':
      return nodeKey.v5(hero, villain!);
  }
}

export function Ranges() {
  const s = useAppState();
  const solverReady = !!s.solver.result;
  const source = s.rangesSource === 'solver' && solverReady ? 'solver' : 'sixmax';
  const nodes = nodesOf(s, source);
  let node = nodes.get(s.rangesKey);
  if (!node) node = source === 'solver' ? s.solver.result!.nodes[0] : s.tree.nodes.get('6max/RFI/CO')!;

  return (
    <div class="workbench three">
      <div class="stack">
        <div class="panel stack" style={{ gap: 12 }}>
          <div class="panel-title" style={{ margin: 0 }}>策略库</div>
          <div class="seg" role="group" aria-label="来源">
            <button type="button" aria-pressed={source === 'sixmax'} onClick={() => setState({ rangesSource: 'sixmax', rangesKey: '6max/RFI/CO' })}>
              6 人桌 100bb
            </button>
            <button
              type="button"
              aria-pressed={source === 'solver'}
              disabled={!solverReady}
              title={solverReady ? '' : '先在"求解器"页算出一个结果'}
              onClick={() => setState({ rangesSource: 'solver', rangesKey: s.solver.result!.nodes[0].key })}
            >
              求解器结果
            </button>
          </div>
          {source === 'sixmax' ? <SixMaxPicker node={node} /> : <SolverTree nodes={s.solver.result!.nodes} current={node.key} />}
        </div>
        {source === 'sixmax' && <AboutLibrary />}
      </div>
      <Explorer node={node} state={s} editable={source === 'sixmax'} />
    </div>
  );
}

function SixMaxPicker({ node }: { node: SpotNode }) {
  const fam = (FAMS as readonly string[]).includes(node.family) ? (node.family as Fam) : 'RFI';
  const hero = node.hero as Pos;
  const villain = node.villain as Pos | undefined;
  const go = (f: Fam, h: Pos, v?: Pos) => {
    const hs = heroesFor(f);
    const hh = hs.includes(h) ? h : hs[hs.length - 1];
    const vs = villainsFor(f, hh);
    const vv = v && vs.includes(v) ? v : vs[f === 'VO' || f === 'V4' ? vs.length - 1 : 0];
    setState({ rangesKey: keyFor(f, hh, vv) });
  };
  return (
    <>
      <div>
        <div class="small muted" style={{ marginBottom: 6 }}>场景</div>
        <div class="chips">
          {FAMS.map((f) => (
            <button type="button" class="chip" aria-pressed={f === fam} onClick={() => go(f, hero, villain)}>
              {FAMILY_NAMES[f]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div class="small muted" style={{ marginBottom: 6 }}>我的位置</div>
        <div class="chips">
          {heroesFor(fam).map((p) => (
            <button type="button" class="chip" aria-pressed={p === hero} onClick={() => go(fam, p, villain)}>
              {p}
            </button>
          ))}
        </div>
      </div>
      {fam !== 'RFI' && (
        <div>
          <div class="small muted" style={{ marginBottom: 6 }}>{fam === 'VO' || fam === 'V4' ? '开池者' : '3-Bet 者'}</div>
          <div class="chips">
            {villainsFor(fam, hero).map((p) => (
              <button type="button" class="chip" aria-pressed={p === villain} onClick={() => go(fam, hero, p)}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export function SolverTree({ nodes, current, onPick }: { nodes: SpotNode[]; current: string; onPick?: (key: string) => void }) {
  return (
    <div class="tree">
      {nodes.map((n) => {
        const depth = n.key.split('/')[1].split('.').length - 1;
        return (
          <button
            type="button"
            aria-pressed={n.key === current}
            style={{ paddingLeft: 8 + depth * 14, flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}
            onClick={() => (onPick ? onPick(n.key) : setState({ rangesKey: n.key }))}
          >
            <span>{n.title}</span>
            {n.line.length > 0 && <span class="small muted" style={{ fontWeight: 400 }}>{describeLine(n.line)}</span>}
          </button>
        );
      })}
    </div>
  );
}

function AboutLibrary() {
  return (
    <div class="panel note wide-only">
      <div class="panel-title">关于这套范围</div>
      <p>6 人桌现金局、100bb、开池 2.5bb（小盲 3bb），参照主流求解器的解整理，混合频率精确到 5%–10%。</p>
      <p>只覆盖单挑的行动线：跟注后不考虑身后玩家挤压，小盲只加注不平跟。</p>
      <p>你可以编辑任何一个场景，或者把自己求解器里的范围粘贴进来，训练会立刻改用你的版本。</p>
    </div>
  );
}

export function Explorer({ node, state, editable, onNavigate }: { node: SpotNode; state: AppState; editable: boolean; onNavigate?: (key: string) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [filter, setFilter] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setFilter(null);
    setSelected(null);
  }, [node.key]);
  useEffect(() => {
    if (!editable) setEditing(false);
  }, [editable]);

  const focus = hover ?? selected;
  const { reachCombos } = actionTotals(node);
  const line = describeLine(node.line);
  const children = node.actions
    .map((a, i) => ({ a, child: node.children[i] ? findNode(state, node.children[i]!) : undefined }))
    .filter((x) => x.child);
  const goChild = (key: string) => (onNavigate ? onNavigate(key) : setState({ rangesKey: key }));

  const [brush, setBrush] = useState<number[]>([]);
  useEffect(() => {
    const k = node.actions.length;
    setBrush(Array.from({ length: k }, (_, i) => (i === k - 1 ? 100 : 0)));
  }, [node.key, node.actions.length]);

  const paint = (h: number) => {
    if (node.heroReach[h] <= 0) return;
    const k = node.actions.length;
    const next = Float32Array.from(node.strategy);
    let used = 0;
    for (let a = 1; a < k; a++) {
      const f = Math.min(1 - used, (brush[a] ?? 0) / 100);
      next[h * k + a] = f;
      used += f;
    }
    next[h * k] = Math.max(0, 1 - used);
    setState((s) => ({ overrides: { ...s.overrides, [node.key]: next } }));
  };

  return (
    <>
      <div class="stack">
        <div class="panel stack" style={{ gap: 12 }}>
          <div class="scenario">
            <div style={{ minWidth: 0, flex: 1 }}>
              <div class="row" style={{ marginBottom: 6 }}>
                <span class="family-badge">{FAMILY_NAMES[node.family] ?? node.family}</span>
                <span class="small muted num">范围 {((reachCombos / 1326) * 100).toFixed(1)}% · {reachCombos.toFixed(0)} 组合</span>
                {state.overrides[node.key] && <span class="family-badge">已编辑</span>}
              </div>
              <h2>{node.title}</h2>
              <div class="line">{line || '前面的人都没有行动'}</div>
            </div>
            {editable && (
              <button type="button" class={`btn${editing ? ' primary' : ''}`} onClick={() => setEditing(!editing)}>
                {editing ? '完成编辑' : '编辑范围'}
              </button>
            )}
          </div>
          <RangeGrid
            node={node}
            selected={selected}
            filterAction={editing ? null : filter}
            onHover={editing ? undefined : setHover}
            onSelect={editing ? undefined : (h) => setSelected(selected === h ? null : h)}
            paint={editing ? paint : undefined}
          />
          <div class="small muted">
            {editing ? '按住拖动可以连续涂抹；只有到达这里的手牌（有颜色的格子）可以编辑。' : '格子里的颜色是各行动的频率，填充高度是这手牌到达这里的比例。点格子可以固定查看。'}
          </div>
        </div>
      </div>
      <div class="stack">
        {editing ? (
          <Editor node={node} brush={brush} setBrush={setBrush} state={state} />
        ) : (
          <>
            <div class="panel">
              <div class="panel-title">行动分布</div>
              <Legend node={node} active={filter} onToggle={setFilter} />
            </div>
            <HandDetail node={node} hand={focus} />
          </>
        )}
        {children.length > 0 && !editing && (
          <div class="panel">
            <div class="panel-title">沿着行动往下看</div>
            <div class="tree">
              {children.map(({ a, child }) => (
                <button type="button" onClick={() => goChild(child!.key)}>
                  <span class={`dot tone-${a.tone}`} />
                  <span>
                    {node.hero} {a.short} → {child!.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function HandDetail({ node, hand }: { node: SpotNode; hand: number | null }) {
  if (hand == null) {
    return (
      <div class="panel note">
        <div class="panel-title">手牌详情</div>
        <p>把鼠标移到格子上（手机上点一下）查看这手牌的频率{node.ev ? '和每个行动的期望值' : ''}。</p>
      </div>
    );
  }
  const k = node.actions.length;
  const reach = node.heroReach[hand];
  const eq = node.villainReach ? equityVsRange(hand, node.villainReach) : NaN;
  return (
    <div class="panel stack detail" style={{ gap: 10 }}>
      <div class="row">
        <h3>{HAND_LABELS[hand]}</h3>
        <span class="spacer" />
        <span class="small muted num">
          {HAND_COMBOS[hand]} 组合 · 到达 {(reach * 100).toFixed(0)}%
        </span>
      </div>
      {reach > 0 ? (
        <>
          <MixBar node={node} hand={hand} />
          <table class="mixtable">
            <tbody>
              {node.actions.map((a, i) => {
                const ev = node.ev?.[hand * k + i];
                return (
                  <tr>
                    <td>
                      <span class={`dot tone-${a.tone}`} />
                      {a.label}
                    </td>
                    {node.ev && <td class="r num">{ev != null && Number.isFinite(ev) ? `${ev >= 0 ? '+' : ''}${ev.toFixed(2)}bb` : '—'}</td>}
                    <td class="num">{(freqAt(node, hand, i) * 100).toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {Number.isFinite(eq) && (
            <div class="small">
              对抗 {node.villain} 当前范围的全下胜率 <b class="num">{(eq * 100).toFixed(1)}%</b>
            </div>
          )}
        </>
      ) : (
        <div class="small muted">这手牌在之前的行动中已经弃掉，不会走到这里。</div>
      )}
    </div>
  );
}

const PRESETS: { label: string; mix: (k: number) => number[] }[] = [
  { label: '全部弃牌', mix: (k) => new Array(k).fill(0) },
];

function Editor({ node, brush, setBrush, state }: { node: SpotNode; brush: number[]; setBrush: (b: number[]) => void; state: AppState }) {
  const k = node.actions.length;
  const nonFold = Array.from({ length: k - 1 }, (_, i) => i + 1);
  const fold = Math.max(0, 100 - nonFold.reduce((acc, a) => acc + (brush[a] ?? 0), 0));
  const setOne = (a: number, v: number) => {
    const b = [...brush];
    const others = nonFold.filter((x) => x !== a).reduce((acc, x) => acc + (b[x] ?? 0), 0);
    b[a] = Math.min(v, 100 - others);
    setBrush(b);
  };
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const exportText = useMemo(() => exportNode(node), [node]);
  useEffect(() => {
    setText(exportText);
    setMsg(null);
  }, [node.key]);

  const apply = () => {
    try {
      const strat = importNode(node, text);
      setState((s) => ({ overrides: { ...s.overrides, [node.key]: strat } }));
      setMsg({ ok: true, text: '已应用。' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };
  const copy = async (e: Event) => {
    const area = (e.currentTarget as HTMLElement).closest('.panel')?.querySelector('textarea');
    try {
      await navigator.clipboard.writeText(text);
      setMsg({ ok: true, text: '已复制到剪贴板。' });
    } catch {
      area?.select();
      setMsg({ ok: true, text: '已选中文本，按 Ctrl/⌘ + C 复制。' });
    }
  };
  const resetNode = () => {
    setState((s) => {
      const o = { ...s.overrides };
      delete o[node.key];
      return { overrides: o };
    });
    const def = defaultSixMax().nodes.get(node.key);
    if (def) setText(exportNode(def));
    setMsg({ ok: true, text: '已恢复为默认范围。' });
  };
  const edited = Object.keys(state.overrides).length;

  return (
    <>
      <div class="panel stack" style={{ gap: 10 }}>
        <div class="panel-title" style={{ margin: 0 }}>画笔</div>
        {nonFold.map((a) => (
          <label class="field">
            <span class="row">
              <span class={`dot tone-${node.actions[a].tone}`} />
              {node.actions[a].label}
              <span class="spacer" />
              <b class="num">{brush[a] ?? 0}%</b>
            </span>
            <input
              type="range"
              id={`brush-${a}`}
              min={0}
              max={100}
              step={5}
              value={brush[a] ?? 0}
              onInput={(e) => setOne(a, Number(e.currentTarget.value))}
            />
          </label>
        ))}
        <div class="row small">
          <span class="dot tone-fold" />
          弃牌 <b class="num">{fold}%</b>
        </div>
        <div class="chips">
          {nonFold.map((a) => (
            <button type="button" class="chip" onClick={() => setBrush(Array.from({ length: k }, (_, i) => (i === a ? 100 : 0)))}>
              {node.actions[a].short} 100%
            </button>
          ))}
          {nonFold.map((a) => (
            <button type="button" class="chip" onClick={() => setBrush(Array.from({ length: k }, (_, i) => (i === a ? 50 : 0)))}>
              {node.actions[a].short} 50%
            </button>
          ))}
          {PRESETS.map((p) => (
            <button type="button" class="chip" onClick={() => setBrush(p.mix(k))}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div class="panel stack" style={{ gap: 10 }}>
        <div class="panel-title" style={{ margin: 0 }}>导入 / 导出</div>
        <div class="small muted">每行一个行动："行动名: 范围"。没写到的手牌算弃牌。可以直接粘贴求解器导出的记法，例如 "3-Bet: QQ+, AKs, A5s:0.5"。</div>
        <textarea id="range-text" rows={7} value={text} onInput={(e) => setText(e.currentTarget.value)} spellcheck={false} />
        {msg && (
          <div class="small" style={{ color: msg.ok ? 'var(--good)' : 'var(--bad)' }}>
            {msg.text}
          </div>
        )}
        <div class="row">
          <button type="button" class="btn primary" onClick={apply}>
            应用
          </button>
          <button type="button" class="btn" onClick={copy}>
            复制
          </button>
          <button type="button" class="btn" onClick={() => setText(exportText)}>
            重新读取
          </button>
        </div>
      </div>
      <div class="panel stack" style={{ gap: 10 }}>
        <div class="row">
          <button type="button" class="btn" disabled={!state.overrides[node.key]} onClick={resetNode}>
            恢复这个场景的默认范围
          </button>
        </div>
        {edited > 0 &&
          (confirmAll ? (
            <div class="confirm">
              <span>确定把 {edited} 个已编辑的场景全部恢复默认？</span>
              <button
                type="button"
                class="btn danger"
                onClick={() => {
                  setState({ overrides: {} });
                  setConfirmAll(false);
                }}
              >
                全部恢复
              </button>
              <button type="button" class="btn" onClick={() => setConfirmAll(false)}>
                取消
              </button>
            </div>
          ) : (
            <button type="button" class="btn danger" onClick={() => setConfirmAll(true)}>
              恢复全部 {edited} 个已编辑场景
            </button>
          ))}
        <div class="small muted">编辑会影响后续场景的范围：例如改了 CO 的开池范围，CO 面对 3-Bet 时的手牌也会跟着变。</div>
      </div>
    </>
  );
}
