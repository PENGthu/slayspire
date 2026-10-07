import { afterEach, describe, expect, it } from 'vitest';
import { aiMove } from '../src/game/ai';
import { apply, clone, createGame, decision } from '../src/game/engine';
import type { AiLevel, GameState, Move } from '../src/game/types';
import { fingerprint, packBig, unpackBig } from '../src/net/codec';
import { connectPacket, parsePackets, publishPacket, readPublish, type Bus, type Bytes, type Handler } from '../src/net/mqtt';
import { GuestRoom, HostRoom, TIMING, type Lobby } from '../src/net/room';

/** 内存里的“服务器”：支持保留消息，可以随机丢消息 */
class Broker {
  retained = new Map<string, Bytes>();
  subs = new Map<string, Set<{ h: Handler }>>();
  drop = 0;
  rnd = 1;
  /** 收到的同步请求数 */
  syncs = 0;
  random() {
    this.rnd = (this.rnd * 16807) % 2147483647;
    return this.rnd / 2147483647;
  }
  client(): Bus {
    const mine = new Map<string, { h: Handler }>();
    return {
      publish: (topic, payload, retain) => {
        if (topic.endsWith('/up') && new TextDecoder().decode(payload).includes('"t":"sync"')) this.syncs++;
        if (retain) {
          if (payload.length) this.retained.set(topic, payload);
          else this.retained.delete(topic);
        }
        for (const s of this.subs.get(topic) ?? []) {
          if (this.drop && this.random() < this.drop) continue;
          setTimeout(() => s.h(payload, topic, false), 0);
        }
      },
      subscribe: (topic, h) => {
        if (mine.has(topic)) {
          mine.get(topic)!.h = h;
          return;
        }
        const s = { h };
        mine.set(topic, s);
        if (!this.subs.has(topic)) this.subs.set(topic, new Set());
        this.subs.get(topic)!.add(s);
        const r = this.retained.get(topic);
        if (r) setTimeout(() => s.h(r, topic, true), 0);
      },
      unsubscribe: (topic) => {
        const s = mine.get(topic);
        if (s) this.subs.get(topic)?.delete(s);
        mine.delete(topic);
      },
      close: () => {
        for (const [t, s] of mine) this.subs.get(t)?.delete(s);
        mine.clear();
      },
    };
  }
}

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/** 等到条件成立（最多 ms 毫秒） */
async function until(cond: () => boolean, ms = 2000) {
  const t0 = Date.now();
  while (!cond() && Date.now() - t0 < ms) await tick(10);
}

interface Table {
  host: HostRoom;
  hostG: { g: GameState | null };
  guests: { room: GuestRoom; g: GameState | null; cid: string }[];
  rooms: { close(): void }[];
}

const open: { close(): void }[] = [];
afterEach(() => {
  for (const r of open.splice(0)) r.close();
});

function setupTable(broker: Broker, guests: number): Table {
  const hostG: { g: GameState | null } = { g: null };
  const host = new HostRoom(broker.client(), 'HOST', '房主', 'TEST01', {
    g: () => hostG.g,
    remoteMove: (m: Move, by: number) => {
      const g = hostG.g!;
      const f = decision(g);
      if (!f || f.p !== by) return '现在不是你的回合';
      const next = clone(g);
      try {
        apply(next, m);
      } catch (e) {
        return (e as Error).message;
      }
      hostG.g = next;
      host.moved(m, by, next, -1);
      return null;
    },
    remoteUndo: () => false,
    resume: () => undefined,
    changed: () => undefined,
  });
  open.push({ close: () => host.close() });
  const list: Table['guests'] = [];
  for (let i = 0; i < guests; i++) {
    const cid = `G${i}`;
    const entry = { room: null as unknown as GuestRoom, g: null as GameState | null, cid };
    entry.room = new GuestRoom(broker.client(), cid, `玩家${i}`, 'TEST01', {
      setG: (g) => {
        entry.g = g;
      },
      lobby: () => undefined,
      error: () => undefined,
      changed: () => undefined,
    });
    open.push({ close: () => entry.room.close(false) });
    list.push(entry);
  }
  return { host, hostG, guests: list, rooms: open };
}

describe('MQTT 编码', () => {
  it('连接与发布的包可以被正确拆开', () => {
    const c = connectPacket('abc', 60, { topic: 't/w', payload: new TextEncoder().encode('bye') });
    expect(c[0]).toBe(0x10);
    const big = new Uint8Array(70000).fill(7);
    const p1 = publishPacket('a/b', new TextEncoder().encode('hello'), true);
    const p2 = publishPacket('a/c', big, false);
    const joined = new Uint8Array([...p1, ...p2]);
    // 分两段到达
    const r1 = parsePackets(joined.slice(0, p1.length + 3));
    expect(r1.packets.length).toBe(1);
    const m1 = readPublish(r1.packets[0]);
    expect(m1.topic).toBe('a/b');
    expect(m1.retained).toBe(true);
    expect(new TextDecoder().decode(m1.payload)).toBe('hello');
    const r2 = parsePackets(new Uint8Array([...r1.rest, ...joined.slice(p1.length + 3)]));
    expect(r2.packets.length).toBe(1);
    const m2 = readPublish(r2.packets[0]);
    expect(m2.topic).toBe('a/c');
    expect(m2.payload.length).toBe(70000);
    expect(r2.rest.length).toBe(0);
  });

  it('快照压缩后可以还原，指纹与属性顺序无关', async () => {
    const g = createGame({ seed: 9, players: [{ name: 'A', ai: null, map: 'A' }, { name: 'B', ai: null, map: 'lake' }] });
    const packed = await packBig({ g });
    expect(packed[0]).toBe(0x1f);
    const back = await unpackBig<{ g: GameState }>(packed);
    expect(fingerprint(back!.g)).toBe(fingerprint(g));
    expect(fingerprint({ a: 1, b: [1, { c: 2, d: 3 }] })).toBe(fingerprint({ b: [1, { d: 3, c: 2 }], a: 1 }));
  });
});

describe('联机房间', () => {
  it('玩家入座、开局，三端完整打完一局且局面一致（含丢消息）', async () => {
    TIMING.snapDelay = 30;
    TIMING.confirm = 400;
    TIMING.syncRetry = 300;
    TIMING.heartbeat = 200;
    const broker = new Broker();
    const t = setupTable(broker, 3);
    t.host.setCount(4);
    await tick(20);
    t.guests[0].room.claim(1);
    t.guests[1].room.claim(2);
    await tick(20);
    // 第三位观战；第 4 个座位交给 AI
    t.host.setSeat(3, 'ai', 'easy');
    t.host.setShuffle(false);
    await tick(20);
    expect(t.host.openSeats()).toBe(0);
    await until(() => t.guests[0].room.lobby?.seats[3]?.kind === 'ai');
    const L: Lobby = t.host.lobby;
    expect(L.seats.map((s) => s.kind)).toEqual(['host', 'guest', 'guest', 'ai']);
    expect(t.guests[0].room.lobby?.seats[1].cid).toBe('G0');

    const { opts, owners } = t.host.prepare(77);
    expect(owners).toEqual(['HOST', 'G0', 'G1', null]);
    const players = opts.players.map((p) => ({ ...p, ai: null as AiLevel | null }));
    players[3].ai = 'easy';
    t.hostG.g = createGame({ ...opts, players });
    t.host.started(owners);
    await tick(30);
    for (const gst of t.guests) expect(gst.g && fingerprint(gst.g)).toBe(fingerprint(t.hostG.g));
    expect(t.guests[2].room.seat()).toBe(-1);

    const initialSyncs = broker.syncs;
    // 前 150 步不丢消息：局面应该完全靠重放保持一致，不需要额外同步
    let steps = 0;
    let stuck = 0;
    while (!t.hostG.g!.over && steps < 4000) {
      if (steps === 150) {
        expect(broker.syncs).toBe(initialSyncs);
        broker.drop = 0.03;
      }
      const g = t.hostG.g!;
      const f = decision(g)!;
      const owner = owners[f.p];
      if (owner === 'HOST' || owner === null) {
        // 房主自己（和 AI）直接在权威局面上走
        const m = aiMove(g, 'easy');
        const next = clone(g);
        apply(next, m);
        t.hostG.g = next;
        t.host.moved(m, f.p, next, -1);
        steps++;
      } else {
        const gst = t.guests.find((x) => x.cid === owner)!;
        const lg = gst.g;
        const lf = lg && decision(lg);
        if (gst.room.canAct() && lg && lf && lf.p === f.p && fingerprint(lg) === fingerprint(g)) {
          const m = aiMove(lg, 'easy');
          const next = clone(lg);
          apply(next, m);
          gst.g = next;
          gst.room.localMove(m, next);
          steps++;
          stuck = 0;
        } else stuck++;
      }
      await tick(stuck > 5 ? 20 : 0);
      if (stuck > 400) throw new Error(`卡住了：第 ${steps} 步`);
    }
    expect(t.hostG.g!.over).toBe(true);
    broker.drop = 0;
    // 等所有人追上
    for (let i = 0; i < 100; i++) {
      await tick(20);
      if (t.guests.every((x) => x.g && fingerprint(x.g) === fingerprint(t.hostG.g))) break;
    }
    for (const gst of t.guests) expect(fingerprint(gst.g!)).toBe(fingerprint(t.hostG.g));
  }, 120000);

  it('房主重新打开页面（序号可能落后）后，其他玩家重新对齐', async () => {
    TIMING.snapDelay = 30;
    const broker = new Broker();
    const t = setupTable(broker, 1);
    await tick(10);
    t.guests[0].room.claim(1);
    await tick(10);
    t.host.setShuffle(false);
    const { opts, owners } = t.host.prepare(11);
    t.hostG.g = createGame({ ...opts, players: opts.players.map((p) => ({ ...p, ai: null })) });
    t.host.started(owners);
    await tick(30);
    const gst = t.guests[0];
    // 房主走几步
    for (let i = 0; i < 3; i++) {
      const g = t.hostG.g!;
      if (decision(g)!.p !== 0) break;
      const m = aiMove(g, 'easy');
      const next = clone(g);
      apply(next, m);
      t.hostG.g = next;
      t.host.moved(m, 0, next, -1);
    }
    await tick(30);
    expect(fingerprint(gst.g!)).toBe(fingerprint(t.hostG.g));
    // 房主“刷新”：存档里的序号比玩家看到的小 1
    const save = JSON.parse(JSON.stringify(t.host.save()));
    save.seq -= 1;
    t.host.detach();
    const hostG = t.hostG;
    const host2 = new HostRoom(broker.client(), 'HOST', '房主', 'TEST01', {
      g: () => hostG.g,
      remoteMove: (m: Move, by: number) => {
        const next = clone(hostG.g!);
        try {
          apply(next, m);
        } catch (e) {
          return (e as Error).message;
        }
        hostG.g = next;
        host2.moved(m, by, next, -1);
        return null;
      },
      remoteUndo: () => false,
      resume: () => undefined,
      changed: () => undefined,
    }, save);
    open.push({ close: () => host2.close() });
    await tick(50);
    expect(gst.room.syncing).toBe(false);
    // 之后房主再走的每一步，玩家都要跟上
    let n = 0;
    while (n < 30 && !hostG.g!.over) {
      const g = hostG.g!;
      const f = decision(g)!;
      if (f.p === 0) {
        const m = aiMove(g, 'easy');
        const next = clone(g);
        apply(next, m);
        hostG.g = next;
        host2.moved(m, 0, next, -1);
      } else {
        if (!gst.room.canAct() || fingerprint(gst.g!) !== fingerprint(g)) {
          await tick(10);
          continue;
        }
        const m = aiMove(gst.g!, 'easy');
        const next = clone(gst.g!);
        apply(next, m);
        gst.g = next;
        gst.room.localMove(m, next);
      }
      n++;
      await tick(5);
    }
    await tick(50);
    expect(fingerprint(gst.g!)).toBe(fingerprint(hostG.g));
  });

  it('走法的序号对不上时被拒绝，玩家重新同步', async () => {
    TIMING.snapDelay = 30;
    const broker = new Broker();
    const t = setupTable(broker, 1);
    await tick(10);
    t.guests[0].room.claim(1);
    await tick(10);
    t.host.setShuffle(false);
    const { opts, owners } = t.host.prepare(5);
    t.hostG.g = createGame({ ...opts, players: opts.players.map((p) => ({ ...p, ai: null })) });
    t.host.started(owners);
    await tick(30);
    const gst = t.guests[0];
    expect(gst.g).not.toBeNull();
    // 房主先完成开局选牌，玩家在旧局面上走一步 → 被拒绝后同步到房主的局面
    const g = t.hostG.g!;
    const m = aiMove(g, 'easy');
    const next = clone(g);
    apply(next, m);
    t.hostG.g = next;
    t.host.moved(m, 0, next, -1);
    await tick(20);
    expect(fingerprint(gst.g!)).toBe(fingerprint(next));
    // 不是自己的回合时发出的走法会被拒绝
    const stale = clone(next);
    gst.room.localMove({ t: 'done' }, stale);
    for (let i = 0; i < 20 && (gst.room.syncing || fingerprint(gst.g!) !== fingerprint(next)); i++) await tick(20);
    expect(fingerprint(gst.g!)).toBe(fingerprint(next));
    expect(gst.room.syncing).toBe(false);
  });
});
