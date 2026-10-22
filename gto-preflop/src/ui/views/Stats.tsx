import { useState } from 'preact/hooks';
import { FAMILY_NAMES, POSITIONS } from '../../engine/sixmax';
import { accuracy, emptyStats, mistakes, type Tally } from '../../engine/stats';
import { HAND_LABELS } from '../../poker/cards';
import { HandText } from '../components/PlayingCard';
import { setState, useAppState } from '../store';

const FAMS = ['RFI', 'VO', 'V3', 'V4', 'V5', 'VA'];
const pct = (t: Tally | undefined) => (t && t.n ? `${Math.round(accuracy(t) * 100)}%` : '—');

/** 正确率越低颜色越红，越高越绿；样本少时颜色变淡 */
function heatStyle(t: Tally | undefined) {
  if (!t || !t.n) return {};
  const a = accuracy(t);
  const tone = a >= 0.8 ? 'var(--good)' : a >= 0.6 ? 'var(--warn)' : 'var(--bad)';
  const strength = Math.min(1, t.n / 10) * 32 + 8;
  return { background: `color-mix(in srgb, ${tone} ${strength}%, var(--surface))` };
}

export function Stats() {
  const s = useAppState();
  const st = s.stats;
  const [confirm, setConfirm] = useState(false);
  const errs = mistakes(st);
  const usedFams = FAMS.filter((f) => st.byFamily[f]?.n);
  const heroes = [...POSITIONS].filter((p) => usedFams.some((f) => st.byFamilyHero[`${f}|${p}`]?.n));
  const weakest = Object.entries(st.byKey)
    .filter(([, t]) => t.n >= 3)
    .map(([key, t]) => ({ key, t, title: st.history.find((h) => h.key === key)?.title ?? key }))
    .sort((a, b) => accuracy(a.t) - accuracy(b.t))
    .slice(0, 6);

  const drill = () => {
    setState({ drill: errs.map((r) => ({ key: r.key, hand: r.hand })), view: 'train', trainSource: errs[0]?.source === 'solver' ? 'solver' : 'sixmax' });
  };

  if (!st.total.n) {
    return (
      <div class="panel empty-note">
        <p>还没有训练记录。</p>
        <p class="small">在"训练"页答几题，这里会按场景和位置统计你的正确率，并收集答错的题方便重练。</p>
        <button type="button" class="btn primary" onClick={() => setState({ view: 'train' })}>
          去训练
        </button>
      </div>
    );
  }

  return (
    <div class="workbench">
      <div class="stack">
        <div class="panel">
          <div class="kpis">
            <div class="kpi">
              <b class="num">{st.total.n}</b>
              <span>总手数</span>
            </div>
            <div class="kpi">
              <b class="num">{pct(st.total)}</b>
              <span>总正确率</span>
            </div>
            <div class="kpi">
              <b class="num">{st.streak}</b>
              <span>当前连对</span>
            </div>
            <div class="kpi">
              <b class="num">{st.bestStreak}</b>
              <span>最长连对</span>
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-title">按场景和位置</div>
          <div class="table-scroll">
            <table class="heat">
              <thead>
                <tr>
                  <th />
                  {heroes.map((p) => (
                    <th scope="col">{p}</th>
                  ))}
                  <th scope="col">合计</th>
                </tr>
              </thead>
              <tbody>
                {usedFams.map((f) => (
                  <tr>
                    <th scope="row">{FAMILY_NAMES[f]}</th>
                    {heroes.map((p) => {
                      const t = st.byFamilyHero[`${f}|${p}`];
                      return (
                        <td class="num" style={heatStyle(t)} title={t ? `${t.ok}/${t.n}` : ''}>
                          {pct(t)}
                        </td>
                      );
                    })}
                    <td class="num" style={heatStyle(st.byFamily[f])}>
                      {pct(st.byFamily[f])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div class="small muted" style={{ marginTop: 8 }}>
            颜色越深表示样本越多；鼠标停在格子上可以看到答对数 / 总数。
          </div>
        </div>
        {weakest.length > 0 && (
          <div class="panel">
            <div class="panel-title">最需要加强的场景（至少 3 手）</div>
            <div class="list">
              {weakest.map((w) => (
                <div>
                  <span class="num" style={{ fontWeight: 700, minWidth: 44 }}>
                    {pct(w.t)}
                  </span>
                  <span>{w.title}</span>
                  <button type="button" class="btn" onClick={() => setState({ view: 'ranges', rangesKey: w.key, rangesSource: w.key.startsWith('6max') ? 'sixmax' : 'solver' })}>
                    看范围
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div class="stack">
        <div class="panel">
          <div class="panel-title">
            <span>最近答错的题</span>
            {errs.length > 0 && (
              <button type="button" class="btn primary" style={{ letterSpacing: 0, textTransform: 'none' }} onClick={drill}>
                重练这 {errs.length} 题
              </button>
            )}
          </div>
          {errs.length === 0 ? (
            <div class="small muted">最近没有答错的题。</div>
          ) : (
            <div class="list">
              {errs.slice(0, 20).map((r) => {
                const best = r.freqs.indexOf(Math.max(...r.freqs));
                return (
                  <div>
                    <b>
                      <HandText cards={r.cards} />
                    </b>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block' }}>{r.title}</span>
                      <span class="small muted">
                        你选 {r.action}，GTO：{r.labels.map((l, i) => (r.freqs[i] >= 0.005 ? `${l} ${Math.round(r.freqs[i] * 100)}%` : null)).filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span class="small muted" title={HAND_LABELS[r.hand]}>
                      {r.labels[best]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div class="panel stack" style={{ gap: 8 }}>
          <div class="panel-title" style={{ margin: 0 }}>数据</div>
          <div class="small muted">记录只保存在这个浏览器里。</div>
          {confirm ? (
            <div class="confirm">
              <span>清空全部 {st.total.n} 手训练记录？</span>
              <button
                type="button"
                class="btn danger"
                onClick={() => {
                  setState({ stats: emptyStats() });
                  setConfirm(false);
                }}
              >
                清空
              </button>
              <button type="button" class="btn" onClick={() => setConfirm(false)}>
                取消
              </button>
            </div>
          ) : (
            <button type="button" class="btn danger" onClick={() => setConfirm(true)}>
              清空训练记录
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
