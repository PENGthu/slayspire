import { useEffect, useState } from 'preact/hooks';
import { SLOT_COUNT, type SlotData, cloud, deleteSlot, reloadSlots, saveSlot } from '../../cloud/sync';
import { authErrorText } from '../../cloud/firebase';
import { CHARACTERS } from '../../game/characters';
import { Portrait } from './Art';
import { localRunRaw, refresh, resumeFromRaw, setOverlay, state } from '../store';

const ZONE_NAMES: Record<string, string> = { overgrowth: '蔓生密林', underdocks: '地下船坞', hive: '嗡鸣蜂巢', glory: '荣光之巅' };

function fmtTime(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Ask = { i: number; what: 'save' | 'load' | 'delete' } | null;

/** 已登录账号的 3 个云端存档位 */
export function SlotsOverlay() {
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [ask, setAsk] = useState<Ask>(null);
  const close = () => setOverlay(null);
  const signedIn = !!cloud.user;

  useEffect(() => {
    if (signedIn && !cloud.slotsLoaded) void reloadSlots().catch((e) => setErr(authErrorText(e)));
  }, [signedIn]);

  // 当前进度就是自动存档（每次操作后都会更新；战斗中是进入这场战斗前的进度）
  const run = state.view === 'run' ? state.run : null;
  const current = localRunRaw();
  const inCombat = run?.screen.s === 'combat';

  const doIt = async (i: number, what: 'save' | 'load' | 'delete') => {
    setAsk(null);
    setErr('');
    setMsg('');
    if (what === 'load') {
      const d = cloud.slots[i];
      if (!d) return;
      if (!resumeFromRaw(d.raw)) setErr('这份存档已损坏，无法读取。');
      return;
    }
    setBusy(i);
    try {
      if (what === 'save' && current) {
        await saveSlot(i, current);
        setMsg(`已保存到存档位 ${i + 1}。`);
      } else if (what === 'delete') {
        await deleteSlot(i);
        setMsg(`存档位 ${i + 1} 已清空。`);
      }
    } catch (e) {
      setErr(authErrorText(e));
    } finally {
      setBusy(null);
      refresh();
    }
  };

  if (!signedIn) {
    return (
      <div class="overlay" onClick={(e) => e.target === e.currentTarget && close()}>
        <div class="modal panel login-panel">
          <h2>存档位</h2>
          <div class="login-lead">登录账号后可以使用 3 个云端存档位，随时保存和读取进度，换一台设备也能读取。</div>
          <div class="overlay-actions">
            <button class="btn ghost" onClick={close}>
              返回
            </button>
            <button class="btn primary" onClick={() => setOverlay({ kind: 'login' })}>
              登录 / 注册
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && busy === null && close()}>
      <div class="panel slots-panel">
        <h2>存档位</h2>
        <div class="login-lead">
          {current
            ? inCombat
              ? '保存的是进入这场战斗之前的进度。'
              : '可以把当前进度保存到任意存档位，之后随时读取。'
            : '现在没有进行中的攀登。开始一局后就能保存到这里。'}
          存档位保存在你的账号里（{cloud.user!.name}）。
        </div>
        <div class="slots-row">
          {Array.from({ length: SLOT_COUNT }, (_, i) => (
            <SlotCard
              key={i}
              i={i}
              d={cloud.slots[i]}
              loaded={cloud.slotsLoaded}
              busy={busy === i}
              disabled={busy !== null}
              canSave={!!current}
              ask={ask?.i === i ? ask.what : null}
              onAsk={(what) => {
                setErr('');
                setMsg('');
                const d = cloud.slots[i];
                // 空位直接保存；读取时如果没有当前进度也不必确认
                if (what === 'save' && !d) void doIt(i, 'save');
                else if (what === 'load' && !current) void doIt(i, 'load');
                else setAsk({ i, what });
              }}
              onYes={() => ask && void doIt(ask.i, ask.what)}
              onNo={() => setAsk(null)}
            />
          ))}
        </div>
        {err && <div class="login-msg bad">{err}</div>}
        {msg && <div class="login-msg good">{msg}</div>}
        <div class="overlay-actions">
          <button class="btn" disabled={busy !== null} onClick={close}>
            返回
          </button>
        </div>
      </div>
    </div>
  );
}

const ASK_TEXT = {
  save: '覆盖这个存档位里的进度？',
  load: '读取后，当前进度会被替换（没有存进存档位的部分会丢失）。',
  delete: '清空这个存档位？',
};
const ASK_YES = { save: '覆盖', load: '读取', delete: '清空' };

function SlotCard(props: {
  i: number;
  d: SlotData | null;
  loaded: boolean;
  busy: boolean;
  disabled: boolean;
  canSave: boolean;
  ask: 'save' | 'load' | 'delete' | null;
  onAsk: (what: 'save' | 'load' | 'delete') => void;
  onYes: () => void;
  onNo: () => void;
}) {
  const { i, d, loaded, busy, disabled, canSave, ask } = props;
  const m = d?.meta;
  const c = m ? CHARACTERS[m.char] : null;
  return (
    <div class={`slot-card ${d ? 'filled' : 'empty'}`} data-slot={i + 1}>
      <div class="slot-title">存档位 {i + 1}</div>
      {!loaded ? (
        <div class="slot-empty">正在读取…</div>
      ) : m && c ? (
        <div class="slot-body">
          <div class="slot-portrait">
            <Portrait char={m.char} size={0.5} />
          </div>
          <div class="slot-info">
            <div class="slot-char" style={{ color: c.color }}>
              {c.name}
            </div>
            <div>
              第 {m.act} 幕 · 第 {m.floor} 层{m.zone && ZONE_NAMES[m.zone] ? ` · ${ZONE_NAMES[m.zone]}` : ''}
            </div>
            <div class="slot-stats">
              <span>❤ {m.hp}/{m.maxHp}</span>
              <span>🪙 {m.gold}</span>
              <span>🂠 {m.deck} 张</span>
              {m.ascension > 0 && <span>进阶 {m.ascension}</span>}
            </div>
            <div class="slot-time">{fmtTime(m.savedAt)}</div>
          </div>
        </div>
      ) : (
        <div class="slot-empty">空</div>
      )}
      {ask ? (
        <div class="slot-ask">
          <div>{ASK_TEXT[ask]}</div>
          <div class="slot-btns">
            <button class="btn small ghost" onClick={props.onNo}>
              取消
            </button>
            <button class={`btn small ${ask === 'load' ? 'primary' : 'danger'}`} onClick={props.onYes}>
              {ASK_YES[ask]}
            </button>
          </div>
        </div>
      ) : (
        <div class="slot-btns">
          <button class="btn small" disabled={disabled || !loaded || !canSave} onClick={() => props.onAsk('save')}>
            {busy ? '保存中…' : '保存到这里'}
          </button>
          {d && (
            <button class="btn small primary" disabled={disabled} onClick={() => props.onAsk('load')}>
              读取
            </button>
          )}
          {d && (
            <button class="btn small ghost" disabled={disabled} onClick={() => props.onAsk('delete')}>
              删除
            </button>
          )}
        </div>
      )}
    </div>
  );
}
