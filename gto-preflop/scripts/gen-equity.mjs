// 生成 169×169 起手牌类别之间的全下胜率表（含平局按一半计），写入 src/data/equity.ts。
//
//   node scripts/gen-equity.mjs [每对样本数，默认 60000]
//
// 每一对类别（如 AKs 对 QQ）在所有互不冲突的具体组合之间均匀抽样，再随机发 5 张公共牌，
// 用蒙特卡洛估计胜率。固定种子，结果可复现；4 个线程约需一两分钟。
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync } from 'node:fs';
import { cpus } from 'node:os';

// ---------- 起手牌类别：与 src/poker/cards.ts 一致，行列 0 = A，r<c 同花，r>c 杂色 ----------
// 评估器里的点数 0 = 2 … 12 = A，牌 = 点数 * 4 + 花色
function classCombos(idx) {
  const r = Math.floor(idx / 13);
  const c = idx % 13;
  const out = [];
  if (r === c) {
    const k = 12 - r;
    for (let s1 = 0; s1 < 4; s1++) for (let s2 = s1 + 1; s2 < 4; s2++) out.push([k * 4 + s1, k * 4 + s2]);
  } else if (r < c) {
    const hi = 12 - r;
    const lo = 12 - c;
    for (let s = 0; s < 4; s++) out.push([hi * 4 + s, lo * 4 + s]);
  } else {
    const hi = 12 - c;
    const lo = 12 - r;
    for (let s1 = 0; s1 < 4; s1++) for (let s2 = 0; s2 < 4; s2++) if (s1 !== s2) out.push([hi * 4 + s1, lo * 4 + s2]);
  }
  return out;
}

// ---------- 7 张牌评估器 ----------
const STRAIGHT = new Int32Array(8192); // 掩码 → 顺子最高点数 + 1（0 表示没有顺子）
const TOP5 = new Int32Array(8192); // 掩码 → 最高 5 张的踢脚编码
for (let m = 0; m < 8192; m++) {
  for (let top = 12; top >= 4; top--) {
    const need = 0b11111 << (top - 4);
    if ((m & need) === need) {
      STRAIGHT[m] = top + 1;
      break;
    }
  }
  if (!STRAIGHT[m] && (m & 0b1000000001111) === 0b1000000001111) STRAIGHT[m] = 4; // A-2-3-4-5
  let v = 0;
  let n = 0;
  for (let r = 12; r >= 0 && n < 5; r--) {
    if (m & (1 << r)) {
      v = (v << 4) | r;
      n++;
    }
  }
  TOP5[m] = v << (4 * (5 - n));
}
const POP = new Uint8Array(8192);
for (let m = 1; m < 8192; m++) POP[m] = POP[m >> 1] + (m & 1);

const suitMask = new Int32Array(4);
const counts = new Uint8Array(13);
function eval7(c0, c1, c2, c3, c4, c5, c6) {
  suitMask[0] = suitMask[1] = suitMask[2] = suitMask[3] = 0;
  counts.fill(0);
  const cs = [c0, c1, c2, c3, c4, c5, c6];
  for (let i = 0; i < 7; i++) {
    const c = cs[i];
    suitMask[c & 3] |= 1 << (c >> 2);
    counts[c >> 2]++;
  }
  for (let s = 0; s < 4; s++) {
    const m = suitMask[s];
    if (POP[m] >= 5) {
      const sf = STRAIGHT[m];
      if (sf) return (8 << 20) | sf;
      return (5 << 20) | TOP5[m];
    }
  }
  const all = suitMask[0] | suitMask[1] | suitMask[2] | suitMask[3];
  let quad = -1;
  let trip1 = -1;
  let trip2 = -1;
  let pair1 = -1;
  let pair2 = -1;
  for (let r = 12; r >= 0; r--) {
    const n = counts[r];
    if (n === 4) quad = r;
    else if (n === 3) {
      if (trip1 < 0) trip1 = r;
      else if (trip2 < 0) trip2 = r;
    } else if (n === 2) {
      if (pair1 < 0) pair1 = r;
      else if (pair2 < 0) pair2 = r;
    }
  }
  if (quad >= 0) {
    const rest = all & ~(1 << quad);
    return (7 << 20) | (quad << 16) | ((TOP5[rest] >> 16) << 12);
  }
  if (trip1 >= 0 && (trip2 >= 0 || pair1 >= 0)) {
    const p = Math.max(trip2, pair1);
    return (6 << 20) | (trip1 << 16) | (p << 12);
  }
  const st = STRAIGHT[all];
  if (st) return (4 << 20) | st;
  if (trip1 >= 0) {
    const rest = all & ~(1 << trip1);
    return (3 << 20) | (trip1 << 16) | ((TOP5[rest] >> 12) << 8);
  }
  if (pair1 >= 0 && pair2 >= 0) {
    const rest = all & ~(1 << pair1) & ~(1 << pair2);
    return (2 << 20) | (pair1 << 16) | (pair2 << 12) | ((TOP5[rest] >> 16) << 8);
  }
  if (pair1 >= 0) {
    const rest = all & ~(1 << pair1);
    return (1 << 20) | (pair1 << 16) | ((TOP5[rest] >> 8) << 4);
  }
  return TOP5[all];
}

// ---------- 抽样 ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function equityOf(a, b, samples, seed) {
  const pairs = [];
  for (const x of classCombos(a))
    for (const y of classCombos(b)) {
      if (x[0] === y[0] || x[0] === y[1] || x[1] === y[0] || x[1] === y[1]) continue;
      pairs.push([x[0], x[1], y[0], y[1]]);
    }
  const rnd = mulberry32(seed);
  const used = new Uint8Array(52);
  const board = [0, 0, 0, 0, 0];
  let score = 0;
  for (let i = 0; i < samples; i++) {
    // 依次轮换组合对，保证每个组合对的样本数几乎相同（分层抽样，方差更小）
    const p = pairs[i % pairs.length];
    used.fill(0);
    used[p[0]] = used[p[1]] = used[p[2]] = used[p[3]] = 1;
    for (let k = 0; k < 5; k++) {
      let c;
      do c = (rnd() * 52) | 0;
      while (used[c]);
      used[c] = 1;
      board[k] = c;
    }
    const h = eval7(p[0], p[1], board[0], board[1], board[2], board[3], board[4]);
    const v = eval7(p[2], p[3], board[0], board[1], board[2], board[3], board[4]);
    score += h > v ? 2 : h === v ? 1 : 0;
  }
  return score / (2 * samples);
}

if (isMainThread) {
  const samples = Number(process.argv[2] ?? 60000);
  const jobs = [];
  for (let a = 0; a < 169; a++) for (let b = a + 1; b < 169; b++) jobs.push([a, b]);
  const threads = Math.max(1, Math.min(8, cpus().length));
  const out = new Uint16Array(jobs.length);
  const t0 = Date.now();
  let done = 0;
  await Promise.all(
    Array.from({ length: threads }, (_, w) => {
      const mine = jobs.map((j, i) => [i, ...j]).filter((_, i) => i % threads === w);
      return new Promise((resolve, reject) => {
        const worker = new Worker(new URL(import.meta.url), { workerData: { mine, samples } });
        worker.on('message', (msg) => {
          for (const [i, eq] of msg) out[i] = Math.round(eq * 65535);
          done += msg.length;
          process.stdout.write(`\r${done}/${jobs.length}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
        });
        worker.on('error', reject);
        worker.on('exit', resolve);
      });
    }),
  );
  const b64 = Buffer.from(out.buffer).toString('base64');
  const file = `// 由 scripts/gen-equity.mjs 生成，请勿手改。
// 169 个起手牌类别两两全下的胜率（平局计一半），每对 ${samples} 次蒙特卡洛抽样。
// 只存上三角（a < b），每项为 Uint16 小端：胜率 × 65535。
export const EQUITY_SAMPLES = ${samples};
export const EQUITY_B64 =
  '${b64}';
`;
  writeFileSync(new URL('../src/data/equity.ts', import.meta.url), file);
  console.log(`\n写入 src/data/equity.ts（${(b64.length / 1024).toFixed(0)} KB），用时 ${((Date.now() - t0) / 1000).toFixed(0)}s`);
} else {
  const { mine, samples } = workerData;
  let batch = [];
  for (const [i, a, b] of mine) {
    batch.push([i, equityOf(a, b, samples, 0x9e3779b9 ^ (a * 169 + b))]);
    if (batch.length >= 50) {
      parentPort.postMessage(batch);
      batch = [];
    }
  }
  if (batch.length) parentPort.postMessage(batch);
}
