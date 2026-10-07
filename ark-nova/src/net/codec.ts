// 联机消息编码：普通消息是 JSON 文本；整局快照较大，浏览器支持时用 gzip 压缩。

import type { Bytes } from './mqtt';

const enc = new TextEncoder();
const dec = new TextDecoder();

export function encodeJson(x: unknown): Bytes {
  return enc.encode(JSON.stringify(x));
}

export function decodeJson<T>(b: Bytes): T | null {
  if (!b.length) return null;
  try {
    return JSON.parse(dec.decode(b)) as T;
  } catch {
    return null;
  }
}

async function pipe(b: Bytes, stream: CompressionStream | DecompressionStream): Promise<Bytes> {
  const out = new Response(new Blob([b as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** 压缩成 gzip（首字节 0x1f）；不支持时原样返回 JSON 文本（首字节是“{”） */
export async function packBig(x: unknown): Promise<Bytes> {
  const raw = encodeJson(x);
  if (typeof CompressionStream === 'undefined') return raw;
  try {
    return await pipe(raw, new CompressionStream('gzip'));
  } catch {
    return raw;
  }
}

export async function unpackBig<T>(b: Bytes): Promise<T | null> {
  if (!b.length) return null;
  if (b[0] !== 0x1f) return decodeJson<T>(b);
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    return decodeJson<T>(await pipe(b, new DecompressionStream('gzip')));
  } catch {
    return null;
  }
}

/** 键按字母排序的 JSON（同一个局面无论属性创建顺序如何，结果都一样） */
function canonical(x: unknown): string {
  if (x === null || typeof x !== 'object') return JSON.stringify(x) ?? 'null';
  if (Array.isArray(x)) return `[${x.map((v) => (v === undefined ? 'null' : canonical(v))).join(',')}]`;
  const o = x as Record<string, unknown>;
  const keys = Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
}

/** 对局状态的指纹（FNV-1a），用来确认各端的局面一致 */
export function fingerprint(x: unknown): string {
  const s = canonical(x);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0).toString(36) + s.length.toString(36)).slice(0, 12);
}
