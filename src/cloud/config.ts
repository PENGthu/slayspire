/**
 * 登录与云存档的配置。
 *
 * 云存档使用 Firebase（Google 登录 + 邮箱密码账号 + Firestore 数据库）。
 * 下面的网页应用配置不是密钥，可以公开；数据由 firestore.rules 保护，
 * 每个玩家只能读写自己的存档。设为 null 时不显示登录入口，游戏照常只在本机存档。
 */
import type { FirebaseOptions } from 'firebase/app';

export const FIREBASE_VERSION = '12.19.0';

export interface CloudConfig {
  firebase: FirebaseOptions | null;
  /** 只在这些域名下启用登录（需与 Firebase 控制台里的“已获授权的网域”一致） */
  hosts: string[];
  /** 本地模拟器（仅测试用） */
  emulator?: { auth: string; firestoreHost: string; firestorePort: number };
  /** Firebase SDK 的加载地址（默认 Google CDN） */
  sdkBase?: string;
}

export const CLOUD_CONFIG: CloudConfig = {
  firebase: {
    apiKey: 'AIzaSyCIAizE1YAFSGFOlKQuLD3hkH2GLqihguQ',
    authDomain: 'blissful-flames-410309.firebaseapp.com',
    projectId: 'blissful-flames-410309',
    storageBucket: 'blissful-flames-410309.firebasestorage.app',
    messagingSenderId: '876719903199',
    appId: '1:876719903199:web:61964fffdbcef2a68db46a',
  },
  hosts: ['pengthu.github.io', 'localhost', '127.0.0.1'],
};

/** 测试时可通过 window.__SPIRE_CLOUD__ 覆盖配置 */
export function cloudConfig(): CloudConfig {
  const w = typeof window !== 'undefined' ? (window as unknown as { __SPIRE_CLOUD__?: Partial<CloudConfig> }) : null;
  return { ...CLOUD_CONFIG, ...(w?.__SPIRE_CLOUD__ ?? {}) };
}

/** 当前页面是否可以使用云存档 */
export function cloudAvailable(): boolean {
  if (typeof window === 'undefined' || typeof location === 'undefined') return false;
  const c = cloudConfig();
  if (!c.firebase) return false;
  if (location.protocol !== 'https:' && location.protocol !== 'http:') return false;
  return c.hosts.includes(location.hostname);
}
