// 联机房间协议。房主的浏览器保存权威局面、运行 AI、检查走法；其他玩家把走法发给房主，
// 房主按顺序广播（带序号和局面指纹），各端用同一个规则引擎重放。丢消息或对不上时，从房主的快照重新同步。
//
// 话题：lobby（保留，房间与座位）、snap（保留，整局快照）、ev（房主广播）、up（玩家发给房主）。
import { apply, clone } from '../game/engine';
import type { AiLevel, GameOptions, GameState, Move } from '../game/types';
import { decodeJson, encodeJson, fingerprint, packBig, unpackBig } from './codec';
import type { Bus, Bytes } from './mqtt';

export const MAX_SEATS = 5;

export interface Seat {
  kind: 'host' | 'open' | 'guest' | 'ai';
  ai?: AiLevel;
  cid?: string;
  name: string;
  map: string;
}

export interface Lobby {
  v: 1;
  room: string;
  host: string;
  hostName: string;
  seats: Seat[];
  shuffle: boolean;
  started: boolean;
  /** 第几局（同一房间可以再来一局） */
  game: number;
  /** 房主这次打开页面的标识：房主刷新或换设备后会变，其他人据此重新同步 */
  epoch: string;
  /** 开局后：玩家序号 → 控制它的设备（AI 为 null） */
  owners: (string | null)[];
  /** 在线的设备 */
  online: string[];
  closed?: boolean;
}

export interface Snap {
  e: string;
  game: number;
  seq: number;
  g: GameState;
  /** 现在可以撤销的玩家（-1 表示没有） */
  u: number;
}

export type Up = { cid: string; name?: string } & (
  | { t: 'hello' }
  | { t: 'hb' }
  | { t: 'bye' }
  | { t: 'claim'; seat: number }
  | { t: 'leave' }
  | { t: 'map'; seat: number; map: string }
  | { t: 'mv'; game: number; seq: number; m: Move }
  | { t: 'sync' }
  | { t: 'undo' }
  | { t: 'resume' }
);

export type Ev =
  | { t: 'mv'; e: string; game: number; seq: number; m: Move; h: string; by: number; u: number }
  | { t: 'reset'; e: string; game: number; seq: number }
  | { t: 'err'; to: string; text: string }
  | { t: 'hb'; e: string; game: number; seq: number }
  /** 房主关掉或刷新了页面 */
  | { t: 'bye'; e: string };

export function topics(room: string) {
  const b = `pengthu-arknova/v1/${room}`;
  return { lobby: `${b}/lobby`, snap: `${b}/snap`, ev: `${b}/ev`, up: `${b}/up` };
}

/** 时间参数（毫秒）；测试里可以调短 */
export const TIMING = {
  heartbeat: 8000,
  offlineAfter: 30000,
  /** 房主多久没消息算离线（后台标签页的定时器可能被浏览器放慢到每分钟一次） */
  hostOfflineAfter: 70000,
  /** 房主在最后一步之后多久发布快照 */
  snapDelay: 2500,
  /** 自己的走法多久没被确认就重新同步 */
  confirm: 9000,
  /** 同步请求多久没结果就重试 */
  syncRetry: 6000,
};

// ———————————————————————————————————————————— 房主

export interface HostHooks {
  g(): GameState | null;
  /** 执行远程玩家的走法，成功返回 null，否则返回原因 */
  remoteMove(m: Move, by: number): string | null;
  /** 远程玩家请求撤销自己的上一步 */
  remoteUndo(by: number): boolean;
  /** 远程玩家回来了，取消 AI 托管 */
  resume(by: number): void;
  /** 房间信息变了（刷新界面、存档） */
  changed(): void;
}

export interface HostSave {
  lobby: Lobby;
  seq: number;
}

export class HostRoom {
  lobby: Lobby;
  seq = 0;
  undoSeat = -1;
  private t: ReturnType<typeof topics>;
  private seen = new Map<string, number>();
  private names = new Map<string, string>();
  private hb: ReturnType<typeof setInterval>;
  private lobbyTimer: ReturnType<typeof setTimeout> | null = null;
  private snapTimer: ReturnType<typeof setTimeout> | null = null;
  private snapChain: Promise<void> = Promise.resolve();

  constructor(
    private bus: Bus,
    readonly cid: string,
    name: string,
    room: string,
    private hooks: HostHooks,
    saved?: HostSave,
  ) {
    this.t = topics(room);
    this.lobby = saved?.lobby ?? {
      v: 1,
      room,
      host: cid,
      hostName: name,
      seats: [
        { kind: 'host', cid, name, map: 'A' },
        { kind: 'open', name: '', map: 'lake' },
      ],
      shuffle: true,
      started: false,
      game: 0,
      epoch: '',
      owners: [],
      online: [cid],
    };
    this.lobby.epoch = Math.random().toString(36).slice(2, 10);
    if (saved) this.seq = saved.seq;
    this.lobby.online = [cid];
    bus.subscribe(this.t.up, (b) => {
      const msg = decodeJson<Up>(b);
      if (msg && typeof msg.cid === 'string') this.onUp(msg);
    });
    this.hb = setInterval(() => this.tick(), TIMING.heartbeat);
    this.publishLobby();
    if (this.lobby.started) this.publishSnap();
  }

  save(): HostSave {
    return { lobby: this.lobby, seq: this.seq };
  }

  /** 网络重新连上后：重发保留消息 */
  reconnected() {
    this.publishLobby();
    if (this.lobby.started) this.publishSnap();
  }

  // —— 房主在大厅里的操作
  setCount(n: number) {
    if (this.lobby.started) return;
    n = Math.max(2, Math.min(MAX_SEATS, n));
    const maps = ['A', 'lake', 'mountain', 'research', 'boulevard'];
    while (this.lobby.seats.length < n) this.lobby.seats.push({ kind: 'open', name: '', map: maps[this.lobby.seats.length] ?? 'A' });
    this.lobby.seats = this.lobby.seats.slice(0, n);
    this.lobbyChanged();
  }

  setSeat(i: number, kind: 'open' | 'ai', ai?: AiLevel) {
    const s = this.lobby.seats[i];
    if (!s || s.kind === 'host' || this.lobby.started) return;
    this.lobby.seats[i] = kind === 'ai' ? { kind, ai: ai ?? 'normal', name: AI_NAMES[i % AI_NAMES.length], map: s.map } : { kind, name: '', map: s.map };
    this.lobbyChanged();
  }

  setMap(i: number, map: string) {
    const s = this.lobby.seats[i];
    if (!s || this.lobby.started) return;
    s.map = map;
    this.lobbyChanged();
  }

  setName(i: number, name: string) {
    const s = this.lobby.seats[i];
    if (!s || this.lobby.started) return;
    s.name = name;
    if (s.kind === 'host') this.lobby.hostName = name;
    this.lobbyChanged();
  }

  setShuffle(b: boolean) {
    this.lobby.shuffle = b;
    this.lobbyChanged();
  }

  openSeats(): number {
    return this.lobby.seats.filter((s) => s.kind === 'open').length;
  }

  /** 开局：返回建局参数与座位归属；由调用方创建局面后再调用 started() */
  prepare(seed: number): { opts: GameOptions; owners: (string | null)[] } {
    let seats = this.lobby.seats.map((s, i) => ({ s, i }));
    if (this.lobby.shuffle) seats = seats.map((x) => ({ x, r: Math.random() })).sort((a, b) => a.r - b.r).map((y) => y.x);
    const used = new Set<string>();
    const players = seats.map(({ s, i }) => {
      let name = (s.name || `玩家 ${i + 1}`).trim().slice(0, 10);
      while (used.has(name)) name += '′';
      used.add(name);
      return { name, ai: s.kind === 'ai' ? (s.ai ?? 'normal') : null, map: s.map };
    });
    const owners = seats.map(({ s }) => (s.kind === 'host' ? this.cid : s.kind === 'guest' ? s.cid! : null));
    return { opts: { players, seed }, owners };
  }

  started(owners: (string | null)[]) {
    this.lobby.started = true;
    this.lobby.game++;
    this.lobby.owners = owners;
    this.seq = 0;
    this.undoSeat = -1;
    this.publishLobby();
    this.publishSnap();
  }

  /** 回到大厅（再来一局） */
  backToLobby() {
    this.lobby.started = false;
    this.lobby.owners = [];
    this.lobbyChanged();
    this.bus.publish(this.t.snap, new Uint8Array(0), true);
  }

  close() {
    this.lobby.closed = true;
    this.bus.publish(this.t.lobby, encodeJson(this.lobby), true);
    this.bus.publish(this.t.snap, new Uint8Array(0), true);
    clearInterval(this.hb);
    if (this.lobbyTimer) clearTimeout(this.lobbyTimer);
    if (this.snapTimer) clearTimeout(this.snapTimer);
    this.bus.unsubscribe(this.t.up);
  }

  /** 暂停主持（离开页面），保留房间以便之后继续 */
  detach() {
    clearInterval(this.hb);
    if (this.lobbyTimer) clearTimeout(this.lobbyTimer);
    if (this.snapTimer) clearTimeout(this.snapTimer);
    this.bus.unsubscribe(this.t.up);
  }

  // —— 对局中的广播
  moved(m: Move, by: number, next: GameState, u: number) {
    this.seq++;
    this.undoSeat = u;
    const ev: Ev = { t: 'mv', e: this.lobby.epoch, game: this.lobby.game, seq: this.seq, m, h: fingerprint(next), by, u };
    this.bus.publish(this.t.ev, encodeJson(ev));
    this.scheduleSnap();
  }

  /** 局面整体替换（撤销、托管切换）：让所有人重新同步 */
  reset(u: number) {
    this.seq++;
    this.undoSeat = u;
    this.bus.publish(this.t.ev, encodeJson({ t: 'reset', e: this.lobby.epoch, game: this.lobby.game, seq: this.seq } satisfies Ev));
    this.publishSnap();
    this.hooks.changed();
  }

  isOnline(cid: string | null): boolean {
    if (!cid) return false;
    return this.lobby.online.includes(cid);
  }

  watchers(): number {
    const owners = new Set([...this.lobby.owners, ...this.lobby.seats.map((s) => s.cid)].filter(Boolean));
    return this.lobby.online.filter((c) => !owners.has(c)).length;
  }

  private lastHb = 0;

  /** 房主暂时离开（关掉或刷新页面）：通知其他人 */
  bye() {
    this.bus.publish(this.t.ev, encodeJson({ t: 'bye', e: this.lobby.epoch } satisfies Ev));
  }

  private tick() {
    this.lastHb = Date.now();
    this.bus.publish(this.t.ev, encodeJson({ t: 'hb', e: this.lobby.epoch, game: this.lobby.game, seq: this.seq } satisfies Ev));
    this.refreshOnline();
  }

  private refreshOnline() {
    const now = Date.now();
    const online = [this.cid, ...[...this.seen].filter(([, t]) => now - t < TIMING.offlineAfter).map(([c]) => c)];
    if (online.join() !== this.lobby.online.join()) {
      this.lobby.online = online;
      this.lobbyChanged();
    }
  }

  private seat(cid: string): number {
    return this.lobby.seats.findIndex((s) => s.cid === cid);
  }

  private onUp(msg: Up) {
    if (msg.cid === this.cid) return;
    if (msg.t === 'bye') this.seen.delete(msg.cid);
    else this.seen.set(msg.cid, Date.now());
    if (msg.name) this.names.set(msg.cid, msg.name.slice(0, 10));
    // 页面在后台时定时器会被放慢：收到消息时顺便补发心跳
    if (Date.now() - this.lastHb > TIMING.heartbeat) this.tick();
    const L = this.lobby;
    switch (msg.t) {
      case 'hello':
        this.refreshOnline();
        this.publishLobby();
        if (L.started) this.publishSnap();
        return;
      case 'hb':
      case 'bye':
        this.refreshOnline();
        return;
      case 'claim': {
        if (L.started) return;
        const s = L.seats[msg.seat];
        if (!s || (s.kind !== 'open' && !(s.kind === 'guest' && s.cid === msg.cid))) return this.lobbyChanged();
        const old = this.seat(msg.cid);
        if (old >= 0 && old !== msg.seat) L.seats[old] = { kind: 'open', name: '', map: L.seats[old].map };
        L.seats[msg.seat] = { kind: 'guest', cid: msg.cid, name: (msg.name || '玩家').slice(0, 10), map: s.map };
        this.lobbyChanged();
        return;
      }
      case 'leave': {
        if (L.started) return;
        const i = this.seat(msg.cid);
        if (i >= 0 && L.seats[i].kind === 'guest') L.seats[i] = { kind: 'open', name: '', map: L.seats[i].map };
        this.lobbyChanged();
        return;
      }
      case 'map': {
        if (L.started) return;
        const s = L.seats[msg.seat];
        if (s && s.cid === msg.cid) {
          s.map = msg.map;
          this.lobbyChanged();
        }
        return;
      }
      case 'sync':
        if (L.started) this.publishSnap();
        else this.publishLobby();
        return;
      case 'mv': {
        const g = this.hooks.g();
        if (!L.started || !g || msg.game !== L.game) return this.err(msg.cid, '');
        if (msg.seq !== this.seq) return this.err(msg.cid, '');
        const by = L.owners.indexOf(msg.cid);
        if (by < 0) return this.err(msg.cid, '你不在这局游戏的座位上');
        const why = this.hooks.remoteMove(msg.m, by);
        if (why !== null) this.err(msg.cid, why);
        return;
      }
      case 'undo': {
        const by = L.owners.indexOf(msg.cid);
        if (by < 0 || !this.hooks.remoteUndo(by)) this.err(msg.cid, '现在不能撤销');
        return;
      }
      case 'resume': {
        const by = L.owners.indexOf(msg.cid);
        if (by >= 0) this.hooks.resume(by);
        return;
      }
    }
  }

  private err(to: string, text: string) {
    this.bus.publish(this.t.ev, encodeJson({ t: 'err', to, text } satisfies Ev));
  }

  private lobbyChanged() {
    this.hooks.changed();
    if (this.lobbyTimer) return;
    this.lobbyTimer = setTimeout(() => {
      this.lobbyTimer = null;
      this.publishLobby();
    }, 60);
  }

  private publishLobby() {
    this.bus.publish(this.t.lobby, encodeJson(this.lobby), true);
  }

  private scheduleSnap() {
    if (this.snapTimer) clearTimeout(this.snapTimer);
    this.snapTimer = setTimeout(() => {
      this.snapTimer = null;
      this.publishSnap();
    }, TIMING.snapDelay);
  }

  /** 发布整局快照（保留消息）。按顺序发布，避免旧快照覆盖新快照 */
  publishSnap() {
    const g = this.hooks.g();
    if (!g || !this.lobby.started) return;
    if (this.snapTimer) clearTimeout(this.snapTimer);
    this.snapTimer = null;
    const snap: Snap = { e: this.lobby.epoch, game: this.lobby.game, seq: this.seq, g, u: this.undoSeat };
    this.snapChain = this.snapChain.then(async () => {
      this.bus.publish(this.t.snap, await packBig(snap), true);
    });
  }
}

export const AI_NAMES = ['小熊猫园长', '企鹅园长', '树懒园长', '狐獴园长', '水豚园长'];

// ———————————————————————————————————————————— 其他玩家

export interface GuestHooks {
  /** 局面变了：别人的走法（m、by），或者整体同步（m 为空） */
  setG(g: GameState, m?: Move, by?: number): void;
  /** 房间信息变了 */
  lobby(l: Lobby | null): void;
  error(text: string): void;
  changed(): void;
}

export class GuestRoom {
  lobby: Lobby | null = null;
  g: GameState | null = null;
  game = -1;
  epoch = '';
  seq = -1;
  undoSeat = -1;
  syncing = false;
  hostSeen = Date.now();
  private pending: { seq: number; h: string }[] = [];
  private buffer = new Map<number, Extract<Ev, { t: 'mv' }>>();
  /** 收到 reset 后，快照至少要到这个序号 */
  private minSeq = 0;
  private t: ReturnType<typeof topics>;
  private hb: ReturnType<typeof setInterval>;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private pendTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private bus: Bus,
    readonly cid: string,
    public name: string,
    room: string,
    private hooks: GuestHooks,
  ) {
    this.t = topics(room);
    bus.subscribe(this.t.lobby, (b) => this.onLobby(decodeJson<Lobby>(b)));
    bus.subscribe(this.t.ev, (b) => {
      const ev = decodeJson<Ev>(b);
      if (ev) this.onEv(ev);
    });
    this.hb = setInterval(() => this.send({ t: 'hb' }), TIMING.heartbeat);
    this.send({ t: 'hello' });
  }

  /** 我在这局里的玩家序号（观战为 -1） */
  seat(): number {
    if (!this.lobby?.started) return -1;
    return this.lobby.owners.indexOf(this.cid);
  }

  lobbySeat(): number {
    return this.lobby?.seats.findIndex((s) => s.cid === this.cid) ?? -1;
  }

  hostOnline(): boolean {
    return Date.now() - this.hostSeen < TIMING.hostOfflineAfter;
  }

  canAct(): boolean {
    return !this.syncing && !!this.g;
  }

  private lastHb = 0;

  private send(x: Record<string, unknown> & { t: Up['t'] }) {
    if (x.t === 'hb') this.lastHb = Date.now();
    this.bus.publish(this.t.up, encodeJson({ ...x, cid: this.cid, name: this.name }));
  }

  claim(seat: number) {
    this.send({ t: 'claim', seat });
  }

  leaveSeat() {
    this.send({ t: 'leave' });
  }

  setMap(seat: number, map: string) {
    this.send({ t: 'map', seat, map });
  }

  requestUndo() {
    if (this.pending.length) return;
    this.send({ t: 'undo' });
  }

  resume() {
    this.send({ t: 'resume' });
  }

  /** 网络重新连上后：打招呼并重新同步 */
  reconnected() {
    this.send({ t: 'hello' });
    if (this.lobby?.started) this.resync();
  }

  /** 页面要关掉了（不离开座位） */
  bye() {
    this.send({ t: 'bye' });
  }

  close(leave: boolean) {
    if (leave && this.lobby && !this.lobby.started) this.send({ t: 'leave' });
    this.send({ t: 'bye' });
    clearInterval(this.hb);
    if (this.syncTimer) clearTimeout(this.syncTimer);
    if (this.pendTimer) clearTimeout(this.pendTimer);
    this.bus.unsubscribe(this.t.lobby);
    this.bus.unsubscribe(this.t.ev);
    this.bus.unsubscribe(this.t.snap);
  }

  /** 本地已经执行了自己的走法（乐观更新），发给房主确认 */
  localMove(m: Move, next: GameState) {
    if (!this.lobby?.started) return;
    const base = this.seq;
    this.seq++;
    this.g = next;
    this.pending.push({ seq: this.seq, h: fingerprint(next) });
    this.bus.publish(this.t.up, encodeJson({ t: 'mv', cid: this.cid, game: this.game, seq: base, m } satisfies Up));
    if (this.pendTimer) clearTimeout(this.pendTimer);
    this.pendTimer = setTimeout(() => {
      this.pendTimer = null;
      if (this.pending.length) this.resync();
    }, TIMING.confirm);
  }

  private onLobby(l: Lobby | null) {
    if (!l) return;
    this.hostSeen = Date.now();
    this.lobby = l;
    this.hooks.lobby(l);
    if (l.closed) return;
    if (l.started && (l.game !== this.game || l.epoch !== this.epoch)) {
      // 新的一局，或者房主重新打开了页面：序号从头对齐
      if (l.game !== this.game) this.g = null;
      this.game = l.game;
      this.epoch = l.epoch;
      this.seq = -1;
      this.pending = [];
      this.buffer.clear();
      this.minSeq = 0;
      this.syncing = false;
      this.resync();
    }
    if (!l.started) {
      this.g = null;
      this.syncing = false;
      this.bus.unsubscribe(this.t.snap);
    }
    this.hooks.changed();
  }

  private onEv(ev: Ev) {
    this.hostSeen = Date.now();
    if (ev.t !== 'err' && ev.e !== this.epoch) return;
    switch (ev.t) {
      case 'bye':
        this.hostSeen = 0;
        this.hooks.changed();
        return;
      case 'hb':
        if (Date.now() - this.lastHb > TIMING.heartbeat) this.send({ t: 'hb' });
        // 心跳带着房主的进度：落后了（比如漏掉了最后一条消息）就同步
        if (ev.game === this.game && this.lobby?.started && !this.syncing && !this.pending.length && ev.seq > this.seq) this.resync();
        return;
      case 'err':
        if (ev.to !== this.cid) return;
        if (ev.text) this.hooks.error(ev.text);
        if (this.lobby?.started) this.resync();
        return;
      case 'reset':
        if (ev.game !== this.game) return;
        this.minSeq = Math.max(this.minSeq, ev.seq);
        if (this.seq < ev.seq) this.resync();
        return;
      case 'mv':
        if (ev.game !== this.game) return;
        this.onMove(ev);
        return;
    }
  }

  private onMove(ev: Extract<Ev, { t: 'mv' }>) {
    this.undoSeat = ev.u;
    if (this.syncing || !this.g) {
      this.buffer.set(ev.seq, ev);
      return;
    }
    if (ev.seq <= this.seq) {
      // 自己刚走的一步被确认
      const i = this.pending.findIndex((p) => p.seq === ev.seq);
      if (i < 0) return;
      if (this.pending[i].h !== ev.h) return this.resync();
      this.pending.splice(0, i + 1);
      if (!this.pending.length && this.pendTimer) {
        clearTimeout(this.pendTimer);
        this.pendTimer = null;
      }
      this.hooks.changed();
      return;
    }
    if (ev.seq > this.seq + 1 || this.pending.length) {
      this.buffer.set(ev.seq, ev);
      return this.resync();
    }
    if (!this.step(ev)) this.resync();
  }

  /** 重放一步；局面对不上就返回 false */
  private step(ev: Extract<Ev, { t: 'mv' }>): boolean {
    const next = clone(this.g!);
    try {
      apply(next, ev.m);
    } catch {
      return false;
    }
    if (fingerprint(next) !== ev.h) return false;
    this.seq = ev.seq;
    this.g = next;
    this.hooks.setG(next, ev.m, ev.by);
    return true;
  }

  private resync() {
    if (!this.lobby?.started) return;
    const first = !this.syncing;
    this.syncing = true;
    this.pending = [];
    if (first) {
      this.hooks.changed();
      this.bus.subscribe(this.t.snap, (b, _t, retained) => void this.onSnap(b, retained));
    }
    this.send({ t: 'sync' });
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      if (this.syncing) {
        this.syncing = false;
        this.resync();
      }
    }, TIMING.syncRetry);
  }

  private async onSnap(b: Bytes, _retained: boolean) {
    const snap = await unpackBig<Snap>(b);
    if (!snap || !this.syncing || snap.game !== this.game || snap.e !== this.epoch) return;
    if (snap.seq < this.minSeq) return;
    // 缓冲区里还有更早的缺口：等更新的快照
    const firstBuffered = Math.min(...this.buffer.keys());
    if (this.buffer.size && firstBuffered > snap.seq + 1) return;
    this.g = snap.g;
    this.seq = snap.seq;
    this.undoSeat = snap.u;
    this.pending = [];
    for (const k of [...this.buffer.keys()]) if (k <= snap.seq) this.buffer.delete(k);
    let ok = true;
    while (this.buffer.has(this.seq + 1)) {
      const ev = this.buffer.get(this.seq + 1)!;
      this.buffer.delete(ev.seq);
      if (!this.step(ev)) {
        ok = false;
        break;
      }
    }
    if (!ok) return; // 等下一份快照
    this.buffer.clear();
    this.syncing = false;
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = null;
    this.bus.unsubscribe(this.t.snap);
    this.hooks.setG(this.g!);
    this.hooks.changed();
  }
}
