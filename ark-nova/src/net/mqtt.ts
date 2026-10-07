// 极简 MQTT 3.1.1 客户端（走 WebSocket）：只用 QoS 0，支持保留消息、遗嘱、心跳与断线重连。
// 联机对局通过公共 MQTT 服务器转发消息，网页本身仍然是静态文件。

export type LinkStatus = 'connecting' | 'online' | 'offline';

export type Bytes = Uint8Array<ArrayBuffer>;

export type Handler = (payload: Bytes, topic: string, retained: boolean) => void;

/** 联机逻辑只依赖这个接口，测试时可以换成内存实现 */
export interface Bus {
  publish(topic: string, payload: Bytes, retain?: boolean): void;
  subscribe(topic: string, h: Handler): void;
  unsubscribe(topic: string): void;
  close(): void;
}

export interface MqttOptions {
  url: string;
  clientId: string;
  /** 心跳间隔（秒） */
  keepalive?: number;
  will?: { topic: string; payload: Bytes };
  onStatus?: (s: LinkStatus) => void;
  /** 连接尝试（含重连）的超时，毫秒 */
  timeout?: number;
}

const enc = new TextEncoder();

function str(s: string): Bytes {
  const b = enc.encode(s);
  return cat(new Uint8Array([b.length >> 8, b.length & 255]), b);
}

function cat(...parts: Bytes[]): Bytes {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function lengthBytes(n: number): Bytes {
  const out: number[] = [];
  do {
    let b = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) b |= 128;
    out.push(b);
  } while (n > 0);
  return new Uint8Array(out);
}

export function packet(head: number, body: Bytes): Bytes {
  return cat(new Uint8Array([head]), lengthBytes(body.length), body);
}

export function connectPacket(clientId: string, keepalive: number, will?: MqttOptions['will']): Bytes {
  let flags = 0x02; // clean session
  if (will) flags |= 0x04;
  const head = cat(str('MQTT'), new Uint8Array([4, flags, keepalive >> 8, keepalive & 255]));
  const parts = [head, str(clientId)];
  if (will) parts.push(str(will.topic), new Uint8Array([will.payload.length >> 8, will.payload.length & 255]), will.payload);
  return packet(0x10, cat(...parts));
}

export function publishPacket(topic: string, payload: Bytes, retain: boolean): Bytes {
  return packet(0x30 | (retain ? 1 : 0), cat(str(topic), payload));
}

export interface Parsed {
  type: number;
  flags: number;
  body: Bytes;
}

/** 从缓冲区里切出完整的包，返回剩余的字节 */
export function parsePackets(buf: Bytes): { packets: Parsed[]; rest: Bytes } {
  const packets: Parsed[] = [];
  let i = 0;
  for (;;) {
    if (buf.length - i < 2) break;
    let len = 0;
    let mul = 1;
    let j = i + 1;
    let ok = false;
    for (let k = 0; k < 4 && j < buf.length; k++, j++) {
      len += (buf[j] & 127) * mul;
      mul *= 128;
      if (!(buf[j] & 128)) {
        ok = true;
        j++;
        break;
      }
    }
    if (!ok || buf.length - j < len) break;
    packets.push({ type: buf[i] >> 4, flags: buf[i] & 15, body: buf.slice(j, j + len) });
    i = j + len;
  }
  return { packets, rest: buf.slice(i) };
}

export function readPublish(p: Parsed): { topic: string; payload: Bytes; retained: boolean; qos: number; pid: number } {
  const b = p.body;
  const tl = (b[0] << 8) | b[1];
  const topic = new TextDecoder().decode(b.subarray(2, 2 + tl));
  let o = 2 + tl;
  const qos = (p.flags >> 1) & 3;
  let pid = 0;
  if (qos > 0) {
    pid = (b[o] << 8) | b[o + 1];
    o += 2;
  }
  return { topic, payload: b.slice(o), retained: (p.flags & 1) === 1, qos, pid };
}

export class Mqtt implements Bus {
  status: LinkStatus = 'connecting';
  private ws: WebSocket | null = null;
  private buf: Bytes = new Uint8Array(0);
  private subs = new Map<string, Handler>();
  private queue: Bytes[] = [];
  private pid = 1;
  private ping: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retry = 0;
  private closed = false;
  private onVisible = () => {
    if (document.visibilityState === 'visible' && this.status !== 'online' && !this.closed) this.reconnectNow();
  };

  constructor(private opts: MqttOptions) {
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisible);
    this.open();
  }

  private setStatus(s: LinkStatus) {
    if (this.status === s) return;
    this.status = s;
    this.opts.onStatus?.(s);
  }

  private open() {
    if (this.closed) return;
    this.setStatus('connecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.opts.url, 'mqtt');
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws = ws;
    ws.binaryType = 'arraybuffer';
    const timer = setTimeout(() => {
      if (this.ws === ws && this.status !== 'online') ws.close();
    }, this.opts.timeout ?? 8000);
    ws.onopen = () => {
      ws.send(connectPacket(this.opts.clientId, this.opts.keepalive ?? 120, this.opts.will));
    };
    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      const data = new Uint8Array(e.data as ArrayBuffer);
      const merged = this.buf.length ? cat(this.buf, data) : data;
      const { packets, rest } = parsePackets(merged);
      this.buf = rest;
      for (const p of packets) this.handle(p, ws, timer);
    };
    ws.onclose = () => {
      clearTimeout(timer);
      if (this.ws !== ws) return;
      this.ws = null;
      this.buf = new Uint8Array(0);
      if (this.ping) clearInterval(this.ping);
      this.ping = null;
      this.setStatus('offline');
      this.scheduleRetry();
    };
    ws.onerror = () => {
      /* onclose 会接着触发 */
    };
  }

  private handle(p: Parsed, ws: WebSocket, timer: ReturnType<typeof setTimeout>) {
    switch (p.type) {
      case 2: {
        // CONNACK
        clearTimeout(timer);
        if (p.body[1] !== 0) {
          ws.close();
          return;
        }
        this.retry = 0;
        for (const t of this.subs.keys()) ws.send(this.subPacket(t));
        for (const q of this.queue) ws.send(q);
        this.queue = [];
        const ka = (this.opts.keepalive ?? 120) * 1000;
        this.ping = setInterval(() => {
          if (this.ws === ws && ws.readyState === 1) ws.send(new Uint8Array([0xc0, 0]));
        }, Math.max(1000, ka * 0.4));
        this.setStatus('online');
        return;
      }
      case 3: {
        // PUBLISH
        const m = readPublish(p);
        if (m.qos === 1) ws.send(new Uint8Array([0x40, 2, m.pid >> 8, m.pid & 255]));
        const h = this.subs.get(m.topic);
        if (h) {
          try {
            h(m.payload, m.topic, m.retained);
          } catch (e) {
            console.error(e);
          }
        }
        return;
      }
      default:
        // SUBACK / UNSUBACK / PINGRESP
        return;
    }
  }

  private scheduleRetry() {
    if (this.closed || this.retryTimer) return;
    const delay = Math.min(8000, 400 * 2 ** this.retry);
    this.retry++;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.open();
    }, delay);
  }

  /** 立即重连（比如手机切回前台时） */
  reconnectNow() {
    if (this.closed) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.retry = 0;
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      ws.onclose = null;
      ws.close();
    }
    if (this.ping) clearInterval(this.ping);
    this.ping = null;
    this.open();
  }

  private nextPid(): number {
    this.pid = (this.pid % 65535) + 1;
    return this.pid;
  }

  private subPacket(topic: string): Bytes {
    const id = this.nextPid();
    return packet(0x82, cat(new Uint8Array([id >> 8, id & 255]), str(topic), new Uint8Array([0])));
  }

  private send(pkt: Bytes) {
    if (this.ws && this.status === 'online' && this.ws.readyState === 1) this.ws.send(pkt);
    else {
      this.queue.push(pkt);
      if (this.queue.length > 60) this.queue.shift();
    }
  }

  publish(topic: string, payload: Bytes, retain = false) {
    this.send(publishPacket(topic, payload, retain));
  }

  subscribe(topic: string, h: Handler) {
    const had = this.subs.has(topic);
    this.subs.set(topic, h);
    if (!had && this.ws && this.status === 'online') this.ws.send(this.subPacket(topic));
  }

  unsubscribe(topic: string) {
    if (!this.subs.delete(topic)) return;
    if (this.ws && this.status === 'online') {
      const id = this.nextPid();
      this.ws.send(packet(0xa2, cat(new Uint8Array([id >> 8, id & 255]), str(topic))));
    }
  }

  close() {
    this.closed = true;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisible);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.ping) clearInterval(this.ping);
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      try {
        if (ws.readyState === 1) {
          for (const q of this.queue) ws.send(q);
          ws.send(new Uint8Array([0xe0, 0]));
        }
      } catch {
        /* 忽略 */
      }
      ws.onclose = null;
      // 留一点时间把最后的消息发出去
      setTimeout(() => ws.close(), 300);
    }
    this.setStatus('offline');
  }
}
