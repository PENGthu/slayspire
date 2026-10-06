/**
 * 账号与云存档同步。
 *
 * - 未登录：和以前一样，只在本机浏览器存档。
 * - 登录后：读取云端存档并与本机合并（成就取较大值；两边都有不同的进行中存档时让玩家选择），
 *   之后每次本机存档变化都会在约 1 秒后上传。
 */
import type { User } from 'firebase/auth';
import type { CharId } from '../game/types';
import { type Profile, type RunMeta, loadRun, localRunMeta, localRunRaw, persistHooks, refresh, runMetaOf, safeDel, safeGet, safeSet, saveProfile, setOverlay, state, writeLocalRun } from '../ui/store';
import { cloudAvailable } from './config';
import { type Sdk, authErrorText, loadSdk } from './firebase';

/** 上次登录过：下次打开页面时自动恢复会话 */
const SESSION_KEY = 'spire-reforged/cloud-session';
const COLLECTION = 'saves';

export interface CloudUser {
  uid: string;
  name: string;
  email: string | null;
  photo: string | null;
  provider: 'google' | 'password' | 'other';
}

interface CloudProfile {
  maxAsc: Partial<Record<CharId, number>>;
  wins: number;
  runs: number;
  bestScore: number;
  tutorialSeen: boolean;
}

interface CloudDoc {
  v: number;
  profile: CloudProfile;
  run: string | null;
  runMeta: RunMeta | null;
}

export const cloud = {
  /** 当前页面能否使用登录（已配置 Firebase 且域名受信任） */
  available: false,
  phase: 'idle' as 'idle' | 'loading' | 'signedOut' | 'signedIn',
  user: null as CloudUser | null,
  sync: 'idle' as 'idle' | 'pending' | 'saving' | 'saved' | 'error',
  lastSync: 0,
  error: '',
  /** 本机与云端各有一份不同的进行中存档，等待玩家选择 */
  conflict: null as null | { cloud: RunMeta | null; local: RunMeta | null; cloudRaw: string },
};

let sdk: Sdk | null = null;
let subscribed = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastPushedKey = '';
let pushing: Promise<void> | null = null;

export function initCloud() {
  cloud.available = cloudAvailable();
  if (!cloud.available) return;
  cloud.phase = 'signedOut';
  persistHooks.onChange = () => queuePush();
  if (safeGet(SESSION_KEY)) void ensure().catch((e) => fail(e));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
  window.addEventListener('online', () => {
    if (cloud.sync === 'error') queuePush(0);
  });
}

async function ensure(): Promise<Sdk> {
  if (sdk) return sdk;
  if (cloud.phase !== 'signedIn') {
    cloud.phase = 'loading';
    refresh();
  }
  try {
    sdk = await loadSdk();
  } catch (e) {
    cloud.phase = 'signedOut';
    throw e;
  }
  if (!subscribed) {
    subscribed = true;
    sdk.A.onAuthStateChanged(sdk.auth, (u) => void onUser(u));
    sdk.A.getRedirectResult(sdk.auth).catch((e) => fail(e));
  }
  return sdk;
}

function fail(e: unknown) {
  cloud.error = authErrorText(e);
  refresh();
}

function toUser(u: User): CloudUser {
  const google = u.providerData.some((p) => p.providerId === 'google.com');
  const pw = u.providerData.some((p) => p.providerId === 'password');
  return {
    uid: u.uid,
    name: u.displayName || (u.email ? u.email.split('@')[0] : '玩家'),
    email: u.email,
    photo: u.photoURL,
    provider: google ? 'google' : pw ? 'password' : 'other',
  };
}

async function onUser(u: User | null) {
  if (!u) {
    cloud.user = null;
    cloud.phase = 'signedOut';
    cloud.sync = 'idle';
    cloud.conflict = null;
    lastPushedKey = '';
    safeDel(SESSION_KEY);
    refresh();
    return;
  }
  cloud.user = toUser(u);
  cloud.phase = 'signedIn';
  cloud.error = '';
  safeSet(SESSION_KEY, '1');
  refresh();
  await pullAndMerge();
}

// ---------------------------------------------------------------- 登录、注册

/** 打开登录面板时预先加载 SDK，这样点击 Google 按钮时能立即打开弹窗（否则可能被浏览器拦截） */
export function prepareCloud() {
  if (cloud.available && !sdk) void ensure().catch((e) => fail(e));
}

export async function signInWithGoogle() {
  // SDK 已加载时不经过任何 await，保证弹窗仍在点击事件之内打开
  const s = sdk ?? (await ensure());
  const provider = new s.A.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await s.A.signInWithPopup(s.auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code;
    // 弹窗被拦截或环境不支持弹窗时，改为整页跳转登录
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await s.A.signInWithRedirect(s.auth, provider);
      return;
    }
    throw e;
  }
}

export async function signInWithEmail(email: string, password: string) {
  const s = await ensure();
  await s.A.signInWithEmailAndPassword(s.auth, email.trim(), password);
}

export async function registerWithEmail(email: string, password: string, name: string) {
  const s = await ensure();
  const cred = await s.A.createUserWithEmailAndPassword(s.auth, email.trim(), password);
  const nick = name.trim();
  if (nick) {
    await s.A.updateProfile(cred.user, { displayName: nick });
    if (cloud.user?.uid === cred.user.uid) {
      cloud.user = { ...cloud.user, name: nick };
      refresh();
    }
  }
}

export async function sendReset(email: string) {
  const s = await ensure();
  await s.A.sendPasswordResetEmail(s.auth, email.trim());
}

export async function signOutCloud() {
  await flush();
  if (sdk) await sdk.A.signOut(sdk.auth);
}

// ---------------------------------------------------------------- 同步

function profileForCloud(): CloudProfile {
  const p = state.profile;
  return { maxAsc: { ...p.maxAsc }, wins: p.wins, runs: p.runs, bestScore: p.bestScore, tutorialSeen: !!p.tutorialSeen };
}

/** 成就与解锁取两边的较大值 */
function mergeProfile(c: Partial<CloudProfile>) {
  const p: Profile = state.profile;
  for (const [k, v] of Object.entries(c.maxAsc ?? {})) {
    const id = k as CharId;
    p.maxAsc[id] = Math.max(p.maxAsc[id] ?? 0, Number(v) || 0);
  }
  p.wins = Math.max(p.wins, Number(c.wins) || 0);
  p.runs = Math.max(p.runs, Number(c.runs) || 0);
  p.bestScore = Math.max(p.bestScore, Number(c.bestScore) || 0);
  p.tutorialSeen = !!(p.tutorialSeen || c.tutorialSeen);
}

async function pullAndMerge() {
  const s = sdk;
  const user = cloud.user;
  if (!s || !user) return;
  cloud.sync = 'saving';
  refresh();
  try {
    const snap = await s.S.getDoc(s.S.doc(s.db, COLLECTION, user.uid));
    if (cloud.user?.uid !== user.uid) return;
    const data = snap.exists() ? (snap.data() as Partial<CloudDoc>) : null;
    if (data?.profile) {
      mergeProfile(data.profile);
      saveProfile();
    }
    const cloudRaw = data?.run ?? null;
    const localRaw = localRunRaw();
    if (cloudRaw && localRaw && cloudRaw !== localRaw) {
      cloud.conflict = { cloud: data?.runMeta ?? runMetaOf(cloudRaw), local: localRunMeta(), cloudRaw };
      cloud.sync = 'idle';
      setOverlay({ kind: 'syncConflict' });
      return;
    }
    if (cloudRaw && !localRaw) writeLocalRun(cloudRaw, data?.runMeta?.savedAt ?? Date.now());
    lastPushedKey = '';
    await push();
  } catch (e) {
    cloud.sync = 'error';
    cloud.error = authErrorText(e);
    refresh();
  }
}

/** 两边存档不同时：采用云端存档 */
export function chooseCloudRun() {
  const c = cloud.conflict;
  if (!c) return;
  cloud.conflict = null;
  writeLocalRun(c.cloudRaw, c.cloud?.savedAt ?? Date.now());
  if (state.view === 'run') {
    const run = loadRun();
    if (run) state.run = run;
  }
  state.overlay = null;
  lastPushedKey = '';
  void push();
  refresh();
}

/** 两边存档不同时：保留本机存档并覆盖云端 */
export function chooseLocalRun() {
  if (!cloud.conflict) return;
  cloud.conflict = null;
  state.overlay = null;
  lastPushedKey = '';
  void push();
  refresh();
}

export function queuePush(delay = 1200) {
  if (!cloud.user || cloud.conflict) return;
  cloud.sync = 'pending';
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void push();
  }, delay);
}

/** 立即上传尚未保存的改动 */
export async function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
    await push();
  } else if (pushing) await pushing;
}

async function push(): Promise<void> {
  if (pushing) {
    await pushing;
    return push();
  }
  const s = sdk;
  const user = cloud.user;
  if (!s || !user || cloud.conflict) return;
  const run = localRunRaw();
  const profile = profileForCloud();
  const key = `${run ?? ''}|${JSON.stringify(profile)}`;
  if (key === lastPushedKey) {
    cloud.sync = 'saved';
    return;
  }
  cloud.sync = 'saving';
  pushing = (async () => {
    try {
      const doc: CloudDoc & { updatedAt: unknown } = { v: 1, profile, run, runMeta: run ? localRunMeta() : null, updatedAt: s.S.serverTimestamp() };
      await s.S.setDoc(s.S.doc(s.db, COLLECTION, user.uid), doc);
      lastPushedKey = key;
      cloud.sync = 'saved';
      cloud.lastSync = Date.now();
      cloud.error = '';
    } catch (e) {
      cloud.sync = 'error';
      cloud.error = authErrorText(e);
    } finally {
      pushing = null;
      refresh();
    }
  })();
  await pushing;
}

/** 手动同步：重新拉取并合并 */
export async function syncNow() {
  if (!cloud.user) return;
  await flush();
  await pullAndMerge();
}

export { authErrorText };
