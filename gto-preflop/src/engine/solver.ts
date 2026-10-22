// 单挑翻前求解器（CFR+）。
//
// 博弈树：小盲先行动（弃牌 / 加注 / 全下），大盲回应（弃牌 / 跟注 / 3-Bet / 全下），依此类推到 4-Bet。
// 全下被跟注时按两手牌的全下胜率结算，所以"只推或弃"模式得到的是精确的纳什均衡（筹码 EV）。
// 加注被跟注、进入翻牌时不再往下求解，而是用"权益实现"模型近似翻后的结果：
// 无位置一方只能实现一部分胜率，筹码越深、两手牌胜率越接近，损失越大；同花、连张更容易实现。
// 这部分是启发式近似，深筹码的结果仅供参考。
//
// 169 个起手牌类别之间的对局按互不冲突的组合对数量加权（考虑卡牌移除），策略也以类别为单位。

import { HAND_COUNT, handKind, handRanks, pairWeights } from '../poker/cards';
import { equityMatrix } from '../poker/equity';
import type { ActionDef, LineStep, SpotNode } from './types';

export interface SolverConfig {
  /** 有效筹码（bb，不含前注） */
  stack: number;
  /** 每人前注（bb） */
  ante: number;
  /** hu：单挑，小盲是按钮，翻后有位置；bvb：6 人桌盲注对抗，小盲翻后没有位置 */
  format: 'hu' | 'bvb';
  /** 只允许全下或弃牌 */
  pushFold: boolean;
  /** 小盲加注到（bb） */
  openSize: number;
  /** 大盲 3-Bet 到（bb） */
  threeBetSize: number;
  /** 小盲 4-Bet 到（bb） */
  fourBetSize: number;
  /** 翻后无位置的劣势强度（0 = 双方都实现全部胜率） */
  realization: number;
  iterations: number;
}

export const DEFAULT_CONFIG: SolverConfig = {
  stack: 25,
  ante: 0,
  format: 'hu',
  pushFold: false,
  openSize: 2,
  threeBetSize: 6,
  fourBetSize: 14,
  realization: 0.3,
  iterations: 600,
};

/** 加注额超过有效筹码的这一比例时不再提供，只能全下 */
export const MAX_RAISE_FRACTION = 0.45;
/** 有效筹码不超过此值时，每个决策点都可以全下 */
export const ALLIN_ANYWHERE_STACK = 40;
const N = HAND_COUNT;
const NN = N * N;
const PLAYERS = ['SB', 'BB'] as const;

interface Terminal {
  kind: 'fold' | 'showdown' | 'flop';
  /** 两位玩家各自的 cfv 矩阵：v_p = A_p · reach_opp */
  mat: [Float32Array, Float32Array];
}

interface Decision {
  id: number;
  player: 0 | 1;
  key: string;
  family: string;
  actions: ActionDef[];
  children: TreeNode[];
  line: LineStep[];
  bets: [number, number];
  regret: Float64Array;
  stratSum: Float64Array;
}

type TreeNode = { t: Terminal } | { d: Decision };

/** 手牌在翻后的"可玩性"：同花、连张、对子更容易实现胜率 */
export function playability(h: number): number {
  const kind = handKind(h);
  const [hi, lo] = handRanks(h);
  if (kind === 'pair') return 0.3;
  const gap = lo - hi - 1;
  let p = kind === 'suited' ? 0.35 : 0;
  p += gap === 0 ? 0.25 : gap === 1 ? 0.15 : gap === 2 ? 0.05 : -0.1;
  if (lo <= 4) p += 0.1;
  if (kind === 'offsuit' && hi >= 5) p -= 0.15;
  return p;
}
const PLAY_WEIGHT = 0.12;

/** 无位置一方（手牌 i）对有位置一方（手牌 j）在翻后能拿走的底池份额 */
/** 胜率领先的一方实现得更多、落后的一方更少（强牌能拿到价值，弱牌常被迫放弃） */
const STRENGTH_WEIGHT = 1.2;
function oopShareMatrix(spr: number, lambda: number): Float64Array {
  const e = equityMatrix();
  const play = Array.from({ length: N }, (_, h) => playability(h));
  const g = Math.min(1, spr / 4);
  const s = new Float64Array(NN);
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const eq = e[i * N + j];
      const v = eq + g * eq * (1 - eq) * (-lambda + STRENGTH_WEIGHT * (2 * eq - 1) + PLAY_WEIGHT * (play[i] - play[j]));
      s[i * N + j] = Math.min(1, Math.max(0, v));
    }
  return s;
}

const act = {
  fold: (): ActionDef => ({ id: 'fold', kind: 'fold', label: '弃牌', short: '弃牌', tone: 'fold', key: 'f' }),
  call: (): ActionDef => ({ id: 'call', kind: 'call', label: '跟注', short: '跟注', tone: 'call', key: 'c' }),
  raise: (level: number, to: number): ActionDef => {
    const short = level === 0 ? '加注' : `${level + 2}-Bet`;
    return { id: 'raise', kind: 'raise', label: `${short} ${to}`, short, to, tone: level >= 2 ? 'raise2' : 'raise', key: 'r' };
  },
  allin: (to: number): ActionDef => ({ id: 'allin', kind: 'allin', label: `全下 ${to}`, short: '全下', to, tone: 'allin', key: 'a' }),
};

const FAMILY_BY_LEVEL = ['RFI', 'VO', 'V3', 'V4'];

export class PreflopSolver {
  readonly cfg: SolverConfig;
  readonly root: TreeNode;
  readonly decisions: Decision[] = [];
  readonly totalWeight: number;
  iteration = 0;
  private readonly W: Float64Array;

  constructor(cfg: SolverConfig) {
    this.cfg = cfg;
    this.W = pairWeights();
    let t = 0;
    for (let i = 0; i < NN; i++) t += this.W[i];
    this.totalWeight = t;
    this.root = this.build(0, [0.5, 1], 0, [], 'open', false);
  }

  /** 第 level 次加注（0 = 开池）的尺度；超过筹码上限时返回 null */
  private raiseSize(level: number): number | null {
    const c = this.cfg;
    if (c.pushFold) return null;
    const size = [c.openSize, c.threeBetSize, c.fourBetSize][level];
    if (size == null || size > c.stack * MAX_RAISE_FRACTION) return null;
    return size;
  }

  /** 深筹码时，能做常规加注的地方不提供全下（与常见求解器的博弈树一致）；浅筹码时每一步都可以全下 */
  private allinAllowed(level: number): boolean {
    if (this.cfg.pushFold || this.cfg.stack <= ALLIN_ANYWHERE_STACK) return true;
    return this.raiseSize(level) == null;
  }

  private build(player: 0 | 1, bets: [number, number], level: number, line: LineStep[], key: string, facingAllin: boolean): TreeNode {
    const c = this.cfg;
    const opp = (1 - player) as 0 | 1;
    const facing = bets[opp];
    const actions: ActionDef[] = [act.fold()];
    const children: TreeNode[] = [];
    const pos = PLAYERS[player];
    children.push(this.terminal('fold', bets, player));

    if (facingAllin) {
      actions.push(act.call());
      children.push(this.terminal('showdown', [c.stack, c.stack], player));
    } else {
      if (level > 0) {
        // 面对加注时可以跟注进入翻牌
        actions.push(act.call());
        const b = facing;
        children.push(this.terminal('flop', [b, b], player));
      }
      const size = this.raiseSize(level);
      if (size != null && size > facing) {
        const a = act.raise(level, size);
        actions.push(a);
        const nb: [number, number] = [...bets];
        nb[player] = size;
        children.push(
          this.build(opp, nb, level + 1, [...line, { pos, kind: 'raise', to: size, name: a.short }], `${key}.r${size}`, false),
        );
      }
      if (this.allinAllowed(level)) {
      actions.push(act.allin(c.stack));
      const nb: [number, number] = [...bets];
      nb[player] = c.stack;
      children.push(this.build(opp, nb, level + 1, [...line, { pos, kind: 'allin', to: c.stack }], `${key}.ai`, true));
      }
    }

    const d: Decision = {
      id: this.decisions.length,
      player,
      key,
      family: facingAllin ? 'VA' : FAMILY_BY_LEVEL[level] ?? 'V4',
      actions,
      children,
      line,
      bets,
      regret: new Float64Array(N * actions.length),
      stratSum: new Float64Array(N * actions.length),
    };
    this.decisions.push(d);
    return { d };
  }

  /** 终局：预先算好双方的 cfv 矩阵 */
  private terminal(kind: Terminal['kind'], bets: [number, number], actor: 0 | 1): TreeNode {
    const c = this.cfg;
    const W = this.W;
    const E = equityMatrix();
    const inv0 = bets[0] + c.ante;
    const inv1 = bets[1] + c.ante;
    const pot = inv0 + inv1;
    const m0 = new Float32Array(NN);
    const m1 = new Float32Array(NN);
    // 小盲的收益 u0(i, j)，i 为小盲手牌；大盲的收益为 -u0
    let share: ((i: number, j: number) => number) | null = null;
    if (kind === 'showdown') share = (i, j) => E[i * N + j];
    if (kind === 'flop') {
      const spr = (c.stack - bets[0]) / pot;
      const S = oopShareMatrix(spr, c.realization);
      // hu：大盲没有位置；bvb：小盲没有位置
      share = c.format === 'hu' ? (i, j) => 1 - S[j * N + i] : (i, j) => S[i * N + j];
    }
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        const w = W[i * N + j];
        if (!w) continue;
        let u0: number;
        if (kind === 'fold') u0 = actor === 0 ? -inv0 : inv1;
        else u0 = share!(i, j) * pot - inv0;
        m0[i * N + j] = w * u0;
        m1[j * N + i] = -w * u0;
      }
    return { t: { kind, mat: [m0, m1] } };
  }

  /** 当前策略（遗憾匹配） */
  private current(d: Decision): Float64Array {
    const k = d.actions.length;
    const s = new Float64Array(N * k);
    for (let h = 0; h < N; h++) {
      let sum = 0;
      for (let a = 0; a < k; a++) sum += d.regret[h * k + a];
      for (let a = 0; a < k; a++) s[h * k + a] = sum > 0 ? d.regret[h * k + a] / sum : 1 / k;
    }
    return s;
  }

  /** 平均策略（最终输出的均衡策略） */
  average(d: Decision): Float64Array {
    const k = d.actions.length;
    const s = new Float64Array(N * k);
    for (let h = 0; h < N; h++) {
      let sum = 0;
      for (let a = 0; a < k; a++) sum += d.stratSum[h * k + a];
      for (let a = 0; a < k; a++) s[h * k + a] = sum > 0 ? d.stratSum[h * k + a] / sum : 1 / k;
    }
    return s;
  }

  private static matvec(m: Float32Array, v: Float64Array): Float64Array {
    const out = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      let s = 0;
      const row = i * N;
      for (let j = 0; j < N; j++) s += m[row + j] * v[j];
      out[i] = s;
    }
    return out;
  }

  private cfr(node: TreeNode, p: 0 | 1, reachSelf: Float64Array, reachOpp: Float64Array, weight: number): Float64Array {
    if ('t' in node) return PreflopSolver.matvec(node.t.mat[p], reachOpp);
    const d = node.d;
    const k = d.actions.length;
    const sigma = this.current(d);
    const v = new Float64Array(N);
    if (d.player === p) {
      const vals: Float64Array[] = [];
      for (let a = 0; a < k; a++) {
        const r = new Float64Array(N);
        for (let h = 0; h < N; h++) r[h] = reachSelf[h] * sigma[h * k + a];
        vals.push(this.cfr(d.children[a], p, r, reachOpp, weight));
      }
      for (let h = 0; h < N; h++) {
        let s = 0;
        for (let a = 0; a < k; a++) s += sigma[h * k + a] * vals[a][h];
        v[h] = s;
        for (let a = 0; a < k; a++) {
          const i = h * k + a;
          d.regret[i] = Math.max(0, d.regret[i] + vals[a][h] - s);
          d.stratSum[i] += weight * reachSelf[h] * sigma[i];
        }
      }
    } else {
      for (let a = 0; a < k; a++) {
        const r = new Float64Array(N);
        for (let h = 0; h < N; h++) r[h] = reachOpp[h] * sigma[h * k + a];
        const va = this.cfr(d.children[a], p, reachSelf, r, weight);
        for (let h = 0; h < N; h++) v[h] += va[h];
      }
    }
    return v;
  }

  /** 迭代 n 次（交替更新两位玩家） */
  run(n: number) {
    const ones = new Float64Array(N).fill(1);
    for (let i = 0; i < n; i++) {
      this.iteration++;
      for (const p of [0, 1] as const) this.cfr(this.root, p, ones, ones, this.iteration);
    }
  }

  private bestResponse(node: TreeNode, p: 0 | 1, reachOpp: Float64Array, avg: Map<Decision, Float64Array>): Float64Array {
    if ('t' in node) return PreflopSolver.matvec(node.t.mat[p], reachOpp);
    const d = node.d;
    const k = d.actions.length;
    if (d.player === p) {
      const v = new Float64Array(N).fill(-Infinity);
      for (let a = 0; a < k; a++) {
        const va = this.bestResponse(d.children[a], p, reachOpp, avg);
        for (let h = 0; h < N; h++) if (va[h] > v[h]) v[h] = va[h];
      }
      return v;
    }
    const s = avg.get(d)!;
    const v = new Float64Array(N);
    for (let a = 0; a < k; a++) {
      const r = new Float64Array(N);
      for (let h = 0; h < N; h++) r[h] = reachOpp[h] * s[h * k + a];
      const va = this.bestResponse(d.children[a], p, r, avg);
      for (let h = 0; h < N; h++) v[h] += va[h];
    }
    return v;
  }

  /** 可剥削度（bb/手）：双方最佳应对的平均收益，0 表示精确均衡 */
  exploitability(): number {
    const avg = new Map(this.decisions.map((d) => [d, this.average(d)]));
    const ones = new Float64Array(N).fill(1);
    let total = 0;
    for (const p of [0, 1] as const) {
      const v = this.bestResponse(this.root, p, ones, avg);
      total += v.reduce((a, b) => a + b, 0) / this.totalWeight;
    }
    return total / 2;
  }

  /** 按平均策略给出每个决策点：双方范围、各行动频率与期望值 */
  result(): SolverResult {
    const avg = new Map(this.decisions.map((d) => [d, this.average(d)]));
    // 先序遍历：父节点在前，子节点按行动顺序排在后面
    const out: (SpotNode | null)[] = [];
    const c = this.cfg;
    const W = this.W;
    const prefix = `${c.format}${c.stack}`;
    const walk = (node: TreeNode, reach: [Float64Array, Float64Array]): [Float64Array, Float64Array] => {
      // 返回双方在此子树中的 cfv
      if ('t' in node) {
        return [PreflopSolver.matvec(node.t.mat[0], reach[1]), PreflopSolver.matvec(node.t.mat[1], reach[0])];
      }
      const d = node.d;
      const k = d.actions.length;
      const s = avg.get(d)!;
      const p = d.player;
      const o = 1 - p;
      const slot = out.length;
      out.push(null);
      const childVals: [Float64Array, Float64Array][] = [];
      for (let a = 0; a < k; a++) {
        const r = new Float64Array(N);
        for (let h = 0; h < N; h++) r[h] = reach[p][h] * s[h * k + a];
        const nr: [Float64Array, Float64Array] = p === 0 ? [r, reach[1]] : [reach[0], r];
        childVals.push(walk(d.children[a], nr));
      }
      // 每个行动的期望值：cfv ÷ 对手到达此处的组合权重
      const ev = new Float32Array(N * k);
      for (let h = 0; h < N; h++) {
        let den = 0;
        for (let j = 0; j < N; j++) den += W[h * N + j] * reach[o][j];
        for (let a = 0; a < k; a++) ev[h * k + a] = den > 0 ? childVals[a][p][h] / den : NaN;
      }
      const v0 = new Float64Array(N);
      const v1 = new Float64Array(N);
      for (let a = 0; a < k; a++) {
        const [c0, c1] = childVals[a];
        for (let h = 0; h < N; h++) {
          if (p === 0) {
            v0[h] += s[h * k + a] * c0[h];
            v1[h] += c1[h];
          } else {
            v0[h] += c0[h];
            v1[h] += s[h * k + a] * c1[h];
          }
        }
      }
      out[slot] = {
        key: `${prefix}/${d.key}`,
        source: 'solver',
        family: d.family,
        title: nodeTitle(d, c.format),
        hero: PLAYERS[p],
        villain: PLAYERS[o],
        seats: ['SB', 'BB'],
        stack: c.stack,
        ante: c.ante,
        blinds: { SB: 0.5, BB: 1 },
        line: d.line,
        actions: d.actions,
        strategy: Float32Array.from(s),
        heroReach: Float32Array.from(reach[p]),
        villainReach: Float32Array.from(reach[o]),
        ev,
        children: d.children.map((ch) => ('d' in ch ? `${prefix}/${ch.d.key}` : null)),
      };
      return [v0, v1];
    };
    const ones = new Float64Array(N).fill(1);
    const [v0] = walk(this.root, [ones, ones]);
    const sbEv = v0.reduce((a, b) => a + b, 0) / this.totalWeight;
    return { config: c, nodes: out as SpotNode[], iterations: this.iteration, exploitability: this.exploitability(), sbEv };
  }
}

function nodeTitle(d: Decision, format: SolverConfig['format']): string {
  const sb = format === 'hu' ? 'SB（按钮）' : 'SB';
  const who = d.player === 0 ? sb : 'BB';
  const last = d.line[d.line.length - 1];
  if (!last) return `${who} 开池`;
  const lastName = last.kind === 'allin' ? '全下' : last.name ?? '加注';
  return `${who} 面对${lastName === '加注' ? '开池' : ` ${lastName}`}`;
}

export interface SolverResult {
  config: SolverConfig;
  nodes: SpotNode[];
  iterations: number;
  /** bb/手 */
  exploitability: number;
  /** 小盲的期望收益（bb/手） */
  sbEv: number;
}
