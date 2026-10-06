/**
 * 按需加载 Firebase SDK（只有在玩家登录或已有登录会话时才下载，不影响游戏本体的体积）。
 */
import type * as AppNS from 'firebase/app';
import type * as AuthNS from 'firebase/auth';
import type * as StoreNS from 'firebase/firestore/lite';
import { FIREBASE_VERSION, cloudConfig } from './config';

export interface Sdk {
  auth: AuthNS.Auth;
  db: StoreNS.Firestore;
  A: typeof AuthNS;
  S: typeof StoreNS;
}

let loading: Promise<Sdk> | null = null;

export function loadSdk(): Promise<Sdk> {
  if (!loading) {
    loading = init().catch((e) => {
      loading = null;
      throw e;
    });
  }
  return loading;
}

async function init(): Promise<Sdk> {
  const cfg = cloudConfig();
  if (!cfg.firebase) throw new Error('未配置 Firebase');
  const base = cfg.sdkBase ?? `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/`;
  const [app, A, S] = (await Promise.all([
    import(/* @vite-ignore */ `${base}firebase-app.js`),
    import(/* @vite-ignore */ `${base}firebase-auth.js`),
    import(/* @vite-ignore */ `${base}firebase-firestore-lite.js`),
  ])) as [typeof AppNS, typeof AuthNS, typeof StoreNS];
  const fb = app.getApps().length ? app.getApp() : app.initializeApp(cfg.firebase);
  const auth = A.getAuth(fb);
  auth.languageCode = 'zh-CN';
  const db = S.getFirestore(fb);
  if (cfg.emulator) {
    A.connectAuthEmulator(auth, cfg.emulator.auth, { disableWarnings: true });
    S.connectFirestoreEmulator(db, cfg.emulator.firestoreHost, cfg.emulator.firestorePort);
  }
  return { auth, db, A, S };
}

/** 把 Firebase 的错误码翻译成玩家能看懂的话 */
export function authErrorText(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return '邮箱格式不正确。';
    case 'auth/missing-password':
    case 'auth/weak-password':
      return '密码至少需要 6 位。';
    case 'auth/email-already-in-use':
      return '这个邮箱已经注册过了，请直接登录。';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return '邮箱或密码不正确。';
    case 'auth/user-disabled':
      return '这个账号已被停用。';
    case 'auth/too-many-requests':
      return '尝试次数过多，请稍后再试。';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return '已取消登录。';
    case 'auth/popup-blocked':
      return '浏览器拦截了登录弹窗，请允许弹窗后重试。';
    case 'auth/network-request-failed':
      return '网络连接失败。如果你在中国大陆，Google 服务可能需要代理。';
    case 'auth/unauthorized-domain':
      return '当前网址没有在 Firebase 中获得授权。';
    case 'auth/operation-not-allowed':
      return '这种登录方式还没有在 Firebase 中启用。';
    case 'auth/account-exists-with-different-credential':
      return '这个邮箱已经用另一种方式注册过了。';
    case 'auth/missing-email':
      return '请先填写邮箱。';
    case 'auth/internal-error':
      return '登录服务暂时无法连接，请检查网络后重试。';
    default: {
      const msg = (e as Error)?.message ?? String(e);
      if (/Failed to fetch|NetworkError|dynamically imported module|import/i.test(msg)) return '无法连接登录服务，请检查网络后重试。';
      return code ? `登录失败（${code}）。` : `出错了：${msg}`;
    }
  }
}
