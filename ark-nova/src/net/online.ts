// 联机控制：创建 / 加入房间，把房间协议接到界面状态上。
// 消息经公共 MQTT 服务器转发；房间号的第一个字符决定用哪台服务器。
import { createGame, STATE_VERSION } from '../game/engine';
import type { AiLevel, GameState } from '../game/types';
import {
  actRemote,
  beginOnlineGame,
  netHooks,
  quitToMenu,
  receive,
  refresh,
  set,
  setSeatAi,
  state,
  toast,
  undoFor,
  undoSeat,
} from '../ui/store';
import { encodeJson } from './codec';
import { Mqtt, type Bytes, type LinkStatus } from './mqtt';
import { GuestRoom, HostRoom, topics, type HostSave, type Lobby } from './room';

export interface Server {
  key: string;
  name: string;
  url: string;
}

export const SERVERS: Server[] = [
  { key: 'emqx', name: 'EMQX（全球）', url: 'wss://broker.emqx.io:8084/mqtt' },
  { key: 'emqx-cn', name: 'EMQX（国内）', url: 'wss://broker-cn.emqx.io:8084/mqtt' },
  { key: 'hivemq', name: 'HiveMQ', url: 'wss://broker.hivemq.com:8884/mqtt' },
  { key: 'mosquitto', name: 'Mosquitto', url: 'wss://test.mosquitto.org:8081/mqtt' },
];

const ALPHA = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LEN = 6;

const CID_KEY = 'ark-nova/cid';
const NAME_KEY = 'ark-nova/name';
const HOST_KEY = 'ark-nova/host';
const GUEST_KEY = 'ark-nova/guest';

function store(key: string, v: unknown) {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, typeof v === 'string' ? v : JSON.stringify(v));
  } catch {
    /* 忽略 */
  }
}

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function randomId(n: number): string {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return [...b].map((x) => ALPHA[x % ALPHA.length]).join('');
}

/** 本设备的身份（刷新页面后仍能回到原来的座位） */
export function myCid(): string {
  let c = load(CID_KEY);
  if (!c) {
    c = randomId(12);
    store(CID_KEY, c);
  }
  return c;
}

export function savedName(): string {
  return load(NAME_KEY) ?? '';
}

export function saveName(n: string) {
  store(NAME_KEY, n.trim().slice(0, 10));
}

/** 测试用：?mqtt=ws://localhost:1884 指定服务器 */
function override(): string | null {
  try {
    return new URLSearchParams(location.search).get('mqtt');
  } catch {
    return null;
  }
}

export function normalizeCode(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/[O]/g, '0')
    .replace(/[I]/g, '1')
    .slice(0, CODE_LEN);
}

export function validCode(code: string): boolean {
  return code.length === CODE_LEN && [...code].every((c) => ALPHA.includes(c));
}

function serverOf(code: string): Server {
  const o = override();
  if (o) return { key: 'custom', name: o, url: o };
  return SERVERS[ALPHA.indexOf(code[0]) % SERVERS.length] ?? SERVERS[0];
}

function codeFor(server: Server): string {
  const idx = SERVERS.indexOf(server);
  const firsts = [...ALPHA].filter((_, i) => idx < 0 || i % SERVERS.length === idx);
  const b = new Uint8Array(1);
  crypto.getRandomValues(b);
  return firsts[b[0] % firsts.length] + randomId(CODE_LEN - 1);
}

export function inviteLink(code: string): string {
  const base = location.href.split('#')[0];
  return `${base}#join=${code}`;
}

/** 链接里带的房间号（#join=XXXXXX） */
export function linkCode(): string | null {
  const m = /join=([0-9A-Za-z]+)/.exec(location.hash);
  if (!m) return null;
  const code = normalizeCode(m[1]);
  return validCode(code) ? code : null;
}

export function clearLinkCode() {
  if (location.hash) history.replaceState(null, '', location.href.split('#')[0]);
}

// ———————————————————————————————————————————— 当前房间

interface Ctl {
  role: 'host' | 'guest';
  code: string;
  server: Server;
  bus: Mqtt;
  host?: HostRoom;
  guest?: GuestRoom;
  /** 加入时找不到房间 */
  missing?: boolean;
  wakeLock?: { release(): Promise<void> } | null;
}

let ctl: Ctl | null = null;

export function current(): Ctl | null {
  return ctl;
}

export function lobby(): Lobby | null {
  return ctl?.host?.lobby ?? ctl?.guest?.lobby ?? null;
}

function setLink(s: LinkStatus) {
  if (!state.net) return;
  const was = state.net.link;
  state.net.link = s;
  if (s === 'online' && was !== 'online') {
    ctl?.host?.reconnected();
    ctl?.guest?.reconnected();
  }
  refresh();
}

/** MQTT 客户端 ID（不超过 23 个字符，兼容所有服务器） */
function clientId(): string {
  return `ark${myCid().slice(0, 8)}${randomId(6)}`;
}

function connect(server: Server, will?: { topic: string; payload: Bytes }): Mqtt {
  let bus: Mqtt | null = null;
  bus = new Mqtt({
    url: server.url,
    clientId: clientId(),
    keepalive: 90,
    will,
    onStatus: (s) => {
      if (bus && ctl?.bus === bus) setLink(s);
    },
  });
  return bus;
}

/** 同时连接几台服务器，用最先连上的那台 */
function race(timeoutMs = 9000): Promise<{ server: Server; bus: Mqtt }> {
  const o = override();
  const list = o ? [{ key: 'custom', name: o, url: o }] : SERVERS;
  return new Promise((resolve, reject) => {
    let done = false;
    const buses: Mqtt[] = [];
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      for (const b of buses) b.close();
      reject(new Error('连接不上联机服务器'));
    }, timeoutMs);
    list.forEach((server) => {
      const bus = new Mqtt({
        url: server.url,
        clientId: clientId(),
        keepalive: 90,
        timeout: timeoutMs,
        onStatus: (s) => {
          if (ctl?.bus === bus) setLink(s);
          if (s !== 'online' || done) return;
          done = true;
          clearTimeout(timer);
          for (const b of buses) if (b !== bus) b.close();
          resolve({ server, bus });
        },
      });
      buses.push(bus);
    });
  });
}

function installHooks() {
  netHooks.commit = (_prev, next, by, m, local) => {
    if (ctl?.host) ctl.host.moved(m, by, next, undoSeat());
    else if (ctl?.guest && local) ctl.guest.localMove(m, next);
  };
  netHooks.blocked = () => {
    if (!ctl) return '已经离开房间';
    if (state.net?.link !== 'online') return ctl.host ? null : '网络断开了，正在重新连接…';
    const gst = ctl.guest;
    if (gst) {
      if (gst.syncing) return '正在同步对局，请稍等…';
      if (!gst.hostOnline()) return '房主暂时不在线，等房主回来再继续';
    }
    return null;
  };
  netHooks.canUndo = () => {
    if (!ctl || !state.net || state.net.seat < 0) return false;
    if (ctl.host) return undoSeat() === state.net.seat;
    return ctl.guest!.undoSeat === state.net.seat && !ctl.guest!.syncing;
  };
  netHooks.undo = () => {
    if (!ctl || !state.net) return;
    if (ctl.host) {
      if (undoFor(state.net.seat)) ctl.host.reset(undoSeat());
    } else ctl.guest!.requestUndo();
  };
  netHooks.persist = () => persistHost();
}

function persistHost() {
  const h = ctl?.host;
  if (!h || !ctl) return;
  const g = state.g;
  store(HOST_KEY, { code: ctl.code, save: h.save(), g: h.lobby.started && g && !g.over ? g : null });
}

interface HostStore {
  code: string;
  save: HostSave;
  g: GameState | null;
}

export function savedHost(): HostStore | null {
  const raw = load(HOST_KEY);
  if (!raw) return null;
  try {
    const h = JSON.parse(raw) as HostStore;
    if (h.g && h.g.v !== STATE_VERSION) return null;
    return h;
  } catch {
    return null;
  }
}

export function savedGuest(): { code: string } | null {
  const raw = load(GUEST_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { code: string };
  } catch {
    return null;
  }
}

export function forgetSaved() {
  store(HOST_KEY, null);
  store(GUEST_KEY, null);
}

function hostHooks() {
  return {
    g: () => state.g,
    remoteMove: actRemote,
    remoteUndo: (by: number) => {
      if (!undoFor(by)) return false;
      ctl?.host?.reset(undoSeat());
      return true;
    },
    resume: (by: number) => {
      if (!state.g?.players[by]?.ai) return;
      setSeatAi(by, null);
      ctl?.host?.reset(-1);
      toast(`${state.g.players[by].name} 回来了，取消 AI 托管`);
    },
    changed: () => {
      persistHost();
      refresh();
    },
  };
}

/** 创建房间（serverKey 为空时自动选最快的服务器） */
export async function createRoom(name: string, serverKey: string | null): Promise<void> {
  leaveQuietly();
  saveName(name);
  state.net = { role: 'host', room: '', link: 'connecting', seat: 0 };
  set({ screen: 'lobby' });
  let picked: { server: Server; bus: Mqtt };
  try {
    if (serverKey && !override()) {
      const server = SERVERS.find((s) => s.key === serverKey) ?? SERVERS[0];
      picked = await raceOne(server);
    } else picked = await race();
  } catch (e) {
    state.net = null;
    set({ screen: 'online' });
    toast(`${(e as Error).message}，请换一个线路或稍后再试`, 'error');
    return;
  }
  const code = codeFor(picked.server);
  ctl = { role: 'host', code, server: picked.server, bus: picked.bus };
  installHooks();
  state.net = { role: 'host', room: code, link: 'online', seat: 0 };
  ctl.host = new HostRoom(picked.bus, myCid(), name, code, hostHooks());
  store(GUEST_KEY, null);
  persistHost();
  refresh();
}

function raceOne(server: Server): Promise<{ server: Server; bus: Mqtt }> {
  return new Promise((resolve, reject) => {
    let done = false;
    const bus = new Mqtt({
      url: server.url,
      clientId: clientId(),
      keepalive: 90,
      onStatus: (s) => {
        if (ctl?.bus === bus) setLink(s);
        if (s === 'online' && !done) {
          done = true;
          resolve({ server, bus });
        }
      },
    });
    setTimeout(() => {
      if (done) return;
      done = true;
      bus.close();
      reject(new Error('连接不上联机服务器'));
    }, 9000);
  });
}

/** 继续主持之前的房间（刷新页面或关掉后回来） */
export function resumeHost(): boolean {
  const h = savedHost();
  if (!h) return false;
  leaveQuietly();
  const server = serverOf(h.code);
  const bus = connect(server);
  ctl = { role: 'host', code: h.code, server, bus };
  installHooks();
  const cid = myCid();
  if (h.save.lobby.started && !h.g) h.save.lobby.started = false;
  state.net = { role: 'host', room: h.code, link: 'connecting', seat: -1 };
  // 先放好局面：房间一建好就会发布快照
  state.g = h.save.lobby.started ? h.g : null;
  ctl.host = new HostRoom(bus, cid, h.save.lobby.hostName, h.code, hostHooks(), h.save);
  if (h.save.lobby.started && h.g) {
    state.net.seat = h.save.lobby.owners.indexOf(cid);
    beginOnlineGame(h.g, state.net.seat);
    keepAwake();
  } else set({ screen: 'lobby' });
  return true;
}

/** 加入房间 */
export function joinRoom(code: string, name: string) {
  leaveQuietly();
  saveName(name);
  const server = serverOf(code);
  const cid = myCid();
  const t = topics(code);
  const bus = connect(server, { topic: t.up, payload: encodeJson({ t: 'bye', cid }) });
  ctl = { role: 'guest', code, server, bus };
  installHooks();
  state.net = { role: 'guest', room: code, link: 'connecting', seat: -1 };
  store(GUEST_KEY, { code });
  const c = ctl;
  c.guest = new GuestRoom(bus, cid, name, code, {
    setG: (g, m, by) => {
      if (ctl !== c || !state.net) return;
      state.net.seat = c.guest!.seat();
      if (state.screen !== 'game' || !state.g) {
        beginOnlineGame(g, state.net.seat);
        keepAwake();
      } else receive(g, m, by);
    },
    lobby: (l) => {
      if (ctl !== c) return;
      c.missing = false;
      if (l?.closed) {
        toast('房主关闭了房间');
        leaveRoom();
        return;
      }
      if (l && !l.started && state.screen === 'game') {
        state.g = null;
        set({ screen: 'lobby', modal: null });
      }
    },
    error: (text) => toast(text, 'error'),
    changed: () => {
      if (ctl !== c || !state.net) return;
      state.net.seat = c.guest!.seat();
      refresh();
    },
  });
  set({ screen: 'lobby' });
  // 一段时间收不到房间信息：多半是房间号错了
  setTimeout(() => {
    if (ctl === c && !c.guest?.lobby) {
      c.missing = true;
      refresh();
    }
  }, 10000);
}

/** 继续加入之前的房间 */
export function resumeGuest(): boolean {
  const s = savedGuest();
  if (!s) return false;
  joinRoom(s.code, savedName() || '玩家');
  return true;
}

// —— 房主的操作
export function hostStart() {
  const h = ctl?.host;
  if (!h || !state.net) return;
  if (h.openSeats() > 0) {
    toast('还有空座位：等玩家加入，或者把空位改成 AI', 'error');
    return;
  }
  const { opts, owners } = h.prepare((Math.random() * 2 ** 32) >>> 0);
  const g = createGame(opts);
  state.net.seat = owners.indexOf(h.cid);
  state.g = g;
  h.started(owners);
  beginOnlineGame(g, state.net.seat);
  keepAwake();
}

export function hostBackToLobby() {
  const h = ctl?.host;
  if (!h) return;
  h.backToLobby();
  state.g = null;
  persistHost();
  set({ screen: 'lobby', modal: null });
}

export function takeover(i: number, ai: AiLevel | null) {
  const h = ctl?.host;
  if (!h || !state.g) return;
  setSeatAi(i, ai);
  h.reset(-1);
}

export function resumeMySeat() {
  ctl?.guest?.resume();
}

function keepAwake() {
  const c = ctl;
  if (!c) return;
  const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } };
  if (!nav.wakeLock || c.wakeLock) return;
  nav.wakeLock
    .request('screen')
    .then((lock) => {
      if (ctl === c) c.wakeLock = lock;
      else void lock.release();
    })
    .catch(() => {
      /* 不支持或被拒绝 */
    });
}

if (typeof window !== 'undefined') {
  // 关掉或刷新页面：告诉其他人（房间保留，可以回来）
  window.addEventListener('pagehide', () => {
    ctl?.host?.bye();
    ctl?.guest?.bye();
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctl && state.screen === 'game') {
      ctl.wakeLock = null;
      keepAwake();
    }
  });
}

function leaveQuietly() {
  const c = ctl;
  if (!c) return;
  ctl = null;
  c.guest?.close(true);
  if (c.host) {
    c.host.bye();
    c.host.detach();
  }
  void c.wakeLock?.release().catch(() => undefined);
  c.bus.close();
}

/** 离开房间回到主菜单。房主离开时保留房间，之后可以继续主持；close 为真则解散房间 */
export function leaveRoom(close = false) {
  const c = ctl;
  if (c?.host && close) {
    c.host.close();
    store(HOST_KEY, null);
  }
  if (c?.guest) store(GUEST_KEY, null);
  leaveQuietly();
  quitToMenu();
}
