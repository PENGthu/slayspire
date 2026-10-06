import { useState } from 'preact/hooks';
import { ACH_BY_ID, ACH_CATEGORIES, ACHIEVEMENTS, type AchCategory } from '../../game/achievements';
import { cloud } from '../../cloud/sync';
import { setOverlay, state, useStore } from '../store';

function fmtDate(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

/** 成就一览 */
export function AchievementsOverlay() {
  const a = state.profile.ach;
  const [cat, setCat] = useState<AchCategory | 'all'>('all');
  const total = ACHIEVEMENTS.length;
  const got = ACHIEVEMENTS.filter((x) => a.unlocked[x.id]).length;
  const list = ACHIEVEMENTS.filter((x) => cat === 'all' || x.cat === cat);
  const close = () => setOverlay(null);
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="panel ach-panel">
        <div class="ach-head">
          <h2>成就</h2>
          <div class="ach-total">
            <span class="num">{got}</span> / {total}
            <div class="ach-bar">
              <div style={{ width: `${(got / total) * 100}%` }} />
            </div>
          </div>
        </div>
        <div class="ach-tabs">
          <button class={`btn small ${cat === 'all' ? 'primary' : 'ghost'}`} onClick={() => setCat('all')}>
            全部
          </button>
          {ACH_CATEGORIES.map((c) => {
            const n = ACHIEVEMENTS.filter((x) => x.cat === c.id);
            return (
              <button key={c.id} class={`btn small ${cat === c.id ? 'primary' : 'ghost'}`} onClick={() => setCat(c.id)}>
                {c.name}
                <span class="ach-count">
                  {n.filter((x) => a.unlocked[x.id]).length}/{n.length}
                </span>
              </button>
            );
          })}
        </div>
        <div class="ach-grid">
          {list.map((x) => {
            const at = a.unlocked[x.id];
            const secret = x.hidden && !at;
            const prog = x.progress && x.goal ? Math.min(x.goal, x.progress(a)) : null;
            return (
              <div key={x.id} class={`ach-item ${at ? 'got' : 'locked'}`}>
                <div class="ach-icon">{secret ? '❔' : x.icon}</div>
                <div class="ach-body">
                  <div class="ach-name">{secret ? '隐藏成就' : x.name}</div>
                  <div class="ach-desc">{secret ? '达成后才会揭晓。' : x.desc}</div>
                  {at ? (
                    <div class="ach-date">{fmtDate(at)} 解锁</div>
                  ) : (
                    prog !== null &&
                    x.goal && (
                      <div class="ach-prog">
                        <div class="ach-bar">
                          <div style={{ width: `${(prog / x.goal) * 100}%` }} />
                        </div>
                        <span class="num">
                          {prog}/{x.goal}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div class="ach-foot">
          <span>{cloud.user ? '成就会同步到你的账号，换设备登录也在。' : '成就记录在这台设备上；登录后会同步到你的账号。'}</span>
          <button class="btn" onClick={close}>
            返回
          </button>
        </div>
      </div>
    </div>
  );
}

/** 解锁成就时右上角弹出的提示 */
export function AchievementToasts() {
  const st = useStore();
  if (!st.achToasts.length) return null;
  return (
    <div class="ach-toasts">
      {st.achToasts.map((t) => {
        const x = ACH_BY_ID[t.id];
        if (!x) return null;
        return (
          <div key={t.key} class="ach-toast">
            <div class="ach-icon">{x.icon}</div>
            <div>
              <div class="ach-toast-title">成就解锁</div>
              <div class="ach-name">{x.name}</div>
              <div class="ach-desc">{x.desc}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
