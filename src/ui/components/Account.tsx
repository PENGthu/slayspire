import { useEffect, useState } from 'preact/hooks';
import { cloud, chooseCloudRun, chooseLocalRun, prepareCloud, registerWithEmail, sendReset, signInWithEmail, signInWithGoogle, signOutCloud, syncNow } from '../../cloud/sync';
import { authErrorText } from '../../cloud/firebase';
import { CHARACTERS } from '../../game/characters';
import type { RunMeta } from '../store';
import { refresh, setOverlay, state } from '../store';

function syncText(): string {
  switch (cloud.sync) {
    case 'pending':
    case 'saving':
      return '同步中…';
    case 'saved':
      return '已同步到云端';
    case 'error':
      return '同步失败';
    default:
      return '已登录';
  }
}

function Avatar({ size = 30 }: { size?: number }) {
  const u = cloud.user;
  if (!u) return null;
  return u.photo ? (
    <img class="avatar" src={u.photo} alt="" width={size} height={size} referrerpolicy="no-referrer" />
  ) : (
    <span class="avatar" style={{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.48)}px` }}>
      {u.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** 主菜单右上角的账号入口 */
export function AccountChip() {
  if (!cloud.available) return null;
  if (cloud.phase === 'signedIn' && cloud.user) {
    return (
      <button class={`account-chip sync-${cloud.sync}`} onClick={() => setOverlay({ kind: 'account' })}>
        <Avatar />
        <span class="ac-text">
          <span class="ac-name">{cloud.user.name}</span>
          <span class="ac-sub">{syncText()}</span>
        </span>
      </button>
    );
  }
  return (
    <button class="account-chip" disabled={cloud.phase === 'loading'} onClick={() => setOverlay({ kind: 'login' })}>
      <span class="ac-icon" aria-hidden="true">
        ☁
      </span>
      <span class="ac-text">
        <span class="ac-name">{cloud.phase === 'loading' ? '正在连接…' : '登录 / 注册'}</span>
        <span class="ac-sub">云端保存进度</span>
      </span>
    </button>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-16.7z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/** 登录 / 注册 */
export function LoginOverlay() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const close = () => setOverlay(null);

  useEffect(() => prepareCloud(), []);

  // 登录成功后自动关闭
  useEffect(() => {
    if (cloud.phase === 'signedIn' && state.overlay?.kind === 'login') close();
  });

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    setInfo('');
    try {
      await fn();
    } catch (e) {
      setErr(authErrorText(e));
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const submit = (e: Event) => {
    e.preventDefault();
    if (tab === 'register') {
      if (pw !== pw2) {
        setErr('两次输入的密码不一致。');
        return;
      }
      void run(() => registerWithEmail(email, pw, name));
    } else void run(() => signInWithEmail(email, pw));
  };

  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && !busy && close()}>
      <div class="modal panel login-panel">
        <h2>{tab === 'login' ? '登录' : '创建账号'}</h2>
        <div class="login-lead">登录后，解锁的进阶、成就和进行中的攀登会保存到云端，换一台设备也能继续；还能使用 3 个云端存档位。</div>
        <button class="btn google-btn" disabled={busy || cloud.phase === 'loading'} onClick={() => void run(signInWithGoogle)}>
          <GoogleLogo />
          {cloud.phase === 'loading' ? '正在连接登录服务…' : `使用 Google 账号${tab === 'login' ? '登录' : '注册'}`}
        </button>
        <div class="login-or">
          <span>或使用邮箱 / 用户名</span>
        </div>
        <div class="login-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'login'} class={tab === 'login' ? 'on' : ''} onClick={() => (setTab('login'), setErr(''), setInfo(''))}>
            已有账号
          </button>
          <button role="tab" aria-selected={tab === 'register'} class={tab === 'register' ? 'on' : ''} onClick={() => (setTab('register'), setErr(''), setInfo(''))}>
            注册新账号
          </button>
        </div>
        <form class="login-form" onSubmit={submit}>
          {tab === 'register' && (
            <label>
              <span>昵称</span>
              <input id="acc-name" value={name} maxLength={20} autocomplete="nickname" placeholder="显示在游戏里的名字（可选）" onInput={(e) => setName((e.target as HTMLInputElement).value)} />
            </label>
          )}
          <label>
            <span>邮箱或用户名</span>
            <input
              id="acc-email"
              type="text"
              required
              value={email}
              autocapitalize="off"
              autocorrect="off"
              spellcheck={false}
              autocomplete="username"
              placeholder={tab === 'login' ? 'you@example.com 或用户名' : '邮箱，或 3–20 位英文用户名'}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            />
          </label>
          <label>
            <span>密码</span>
            <input
              id="acc-pw"
              type="password"
              required
              minLength={6}
              value={pw}
              autocomplete={tab === 'login' ? 'current-password' : 'new-password'}
              placeholder={tab === 'login' ? '' : '至少 6 位'}
              onInput={(e) => setPw((e.target as HTMLInputElement).value)}
            />
          </label>
          {tab === 'register' && (
            <label>
              <span>确认密码</span>
              <input id="acc-pw2" type="password" required minLength={6} value={pw2} autocomplete="new-password" onInput={(e) => setPw2((e.target as HTMLInputElement).value)} />
            </label>
          )}
          {(err || (!busy && cloud.error && cloud.phase !== 'signedIn' ? cloud.error : '')) && <div class="login-msg bad">{err || cloud.error}</div>}
          {info && <div class="login-msg good">{info}</div>}
          <button class="btn primary" type="submit" disabled={busy}>
            {busy ? '请稍候…' : tab === 'login' ? '登录' : '注册并登录'}
          </button>
        </form>
        <div class="login-foot">
          {tab === 'login' && (
            <button
              class="link-btn"
              disabled={busy}
              onClick={() => {
                if (!email.trim()) {
                  setErr('请先在上面填写邮箱。');
                  return;
                }
                if (!email.includes('@')) {
                  setErr('用户名账号没有绑定邮箱，无法通过邮件重置密码。');
                  return;
                }
                void run(async () => {
                  await sendReset(email);
                  setInfo('重置密码的邮件已发送，请查收。');
                });
              }}
            >
              忘记密码？
            </button>
          )}
          <button class="link-btn" disabled={busy} onClick={close}>
            暂不登录
          </button>
        </div>
      </div>
    </div>
  );
}

function fmtTime(t: number): string {
  if (!t) return '';
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 已登录：账号信息 */
export function AccountOverlay() {
  const [busy, setBusy] = useState(false);
  const u = cloud.user;
  const close = () => setOverlay(null);
  if (!u) {
    return null;
  }
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="modal panel login-panel">
        <div class="acc-head">
          <Avatar size={56} />
          <div>
            <div class="acc-name">{u.name}</div>
            <div class="acc-mail">{u.email ?? (u.username ? `用户名：${u.username}` : '')}</div>
            <div class="acc-mail">{u.provider === 'google' ? '通过 Google 登录' : u.username ? '用户名账号' : u.provider === 'password' ? '邮箱账号' : '已登录'}</div>
          </div>
        </div>
        <div class={`acc-sync sync-${cloud.sync}`}>
          {syncText()}
          {cloud.lastSync > 0 && cloud.sync === 'saved' && <span>（{fmtTime(cloud.lastSync)}）</span>}
          {cloud.sync === 'error' && cloud.error && <div class="login-msg bad">{cloud.error}</div>}
        </div>
        <div class="login-lead">进度会在每次离开战斗、进入新房间时自动保存到云端。在其他设备上登录同一个账号即可继续攀登。</div>
        <div class="overlay-actions">
          <button class="btn" disabled={busy} onClick={() => setOverlay({ kind: 'slots' })}>
            存档位
          </button>
          <button
            class="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await syncNow();
              setBusy(false);
            }}
          >
            立即同步
          </button>
          <button
            class="btn ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await signOutCloud();
              setBusy(false);
              close();
            }}
          >
            退出登录
          </button>
          <button class="btn primary" onClick={close}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

function MetaCard({ title, m, action, onPick }: { title: string; m: RunMeta | null; action: string; onPick: () => void }) {
  const c = m ? CHARACTERS[m.char] : null;
  return (
    <div class="conflict-card">
      <div class="cc-title">{title}</div>
      {m && c ? (
        <>
          <div class="cc-char" style={{ color: c.color }}>
            {c.name}
          </div>
          <div>
            第 {m.act} 幕 · 第 {m.floor} 层{m.ascension ? ` · 进阶 ${m.ascension}` : ''}
          </div>
          <div class="cc-time">{m.savedAt ? `保存于 ${fmtTime(m.savedAt)}` : ''}</div>
        </>
      ) : (
        <div>（无法读取存档信息）</div>
      )}
      <button class="btn primary" onClick={onPick}>
        {action}
      </button>
    </div>
  );
}

/** 本机与云端各有一份不同的进行中存档 */
export function ConflictOverlay() {
  const c = cloud.conflict;
  if (!c) return null;
  return (
    <div class="overlay">
      <div class="modal panel login-panel" style={{ maxWidth: '620px' }}>
        <h2>选择要继续的存档</h2>
        <div class="login-lead">这台设备上的存档和云端的存档不一样。选择一份继续，另一份会被覆盖。</div>
        <div class="conflict-row">
          <MetaCard title="云端存档" m={c.cloud} action="使用云端存档" onPick={chooseCloudRun} />
          <MetaCard title="这台设备上的存档" m={c.local} action="使用本机存档" onPick={chooseLocalRun} />
        </div>
      </div>
    </div>
  );
}
