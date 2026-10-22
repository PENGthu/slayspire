import { describe, expect, test } from 'vitest';
import { DEFAULT_CONFIG, PreflopSolver, type SolverConfig } from '../src/engine/solver';
import { HAND_COMBOS, handIndex } from '../src/poker/cards';
import type { SpotNode } from '../src/engine/types';

function solve(cfg: Partial<SolverConfig>, iters = 400) {
  const s = new PreflopSolver({ ...DEFAULT_CONFIG, ...cfg });
  s.run(iters);
  return s.result();
}

/** 某个行动占到达范围的比例 */
function share(n: SpotNode, actionId: string): number {
  const a = n.actions.findIndex((x) => x.id === actionId);
  const k = n.actions.length;
  let num = 0;
  let den = 0;
  for (let h = 0; h < 169; h++) {
    const w = n.heroReach[h] * HAND_COMBOS[h];
    num += w * n.strategy[h * k + a];
    den += w;
  }
  return num / den;
}

describe('只推或弃（精确纳什均衡）', () => {
  const r = solve({ stack: 10, pushFold: true }, 600);
  const [push, call] = r.nodes;

  test('树只有小盲推、 大盲跟两层', () => {
    expect(r.nodes).toHaveLength(2);
    expect(push.actions.map((a) => a.id)).toEqual(['fold', 'allin']);
    expect(call.actions.map((a) => a.id)).toEqual(['fold', 'call']);
  });

  test('收敛到很低的可剥削度', () => {
    expect(r.exploitability).toBeLessThan(0.0005);
  });

  test('10bb 时的推、跟范围与公认的纳什解一致', () => {
    // 公认的单挑 10bb 纳什解：小盲约推 58%，大盲约跟 37%
    expect(share(push, 'allin')).toBeGreaterThan(0.55);
    expect(share(push, 'allin')).toBeLessThan(0.61);
    expect(share(call, 'call')).toBeGreaterThan(0.34);
    expect(share(call, 'call')).toBeLessThan(0.4);
    const k = 2;
    const f = (n: SpotNode, label: string) => n.strategy[handIndex(label) * k + 1];
    expect(f(push, 'AA')).toBeCloseTo(1, 2);
    expect(f(push, 'K2o')).toBeCloseTo(1, 2);
    expect(f(push, '72o')).toBeCloseTo(0, 2);
    expect(f(call, 'A2o')).toBeCloseTo(1, 2);
    expect(f(call, 'T8s')).toBeCloseTo(0, 2);
  });

  test('弃牌的期望值就是盲注', () => {
    const k = 2;
    for (let h = 0; h < 169; h++) {
      expect(push.ev![h * k]).toBeCloseTo(-0.5, 6);
      expect(call.ev![h * k]).toBeCloseTo(-1, 6);
    }
  });

  test('筹码越深，推的范围越窄', () => {
    const deeper = solve({ stack: 20, pushFold: true }, 400).nodes[0];
    expect(share(deeper, 'allin')).toBeLessThan(share(push, 'allin'));
  });
});

describe('完整翻前树', () => {
  test('深筹码：只在面对 4-Bet 时才能全下，结果收敛', () => {
    const r = solve({ stack: 100, openSize: 2.5, threeBetSize: 9, fourBetSize: 22 }, 400);
    const root = r.nodes[0];
    expect(root.actions.map((a) => a.id)).toEqual(['fold', 'raise']);
    const vsOpen = r.nodes.find((n) => n.key.endsWith('open.r2.5'))!;
    expect(vsOpen.actions.map((a) => a.id)).toEqual(['fold', 'call', 'raise']);
    const vs4 = r.nodes.find((n) => n.family === 'V4')!;
    expect(vs4.actions.map((a) => a.id)).toEqual(['fold', 'call', 'allin']);
    expect(r.exploitability).toBeLessThan(0.005);
    // 小盲是按钮位，开池范围应当很宽
    expect(share(root, 'raise')).toBeGreaterThan(0.6);
    // AA 不会弃牌
    const k = root.actions.length;
    expect(root.strategy[handIndex('AA') * k]).toBeLessThan(0.01);
  });

  test('策略合法：频率和为 1，子节点都存在', () => {
    const r = solve({ stack: 30 }, 200);
    const keys = new Set(r.nodes.map((n) => n.key));
    for (const n of r.nodes) {
      const k = n.actions.length;
      for (let h = 0; h < 169; h++) {
        let s = 0;
        for (let a = 0; a < k; a++) s += n.strategy[h * k + a];
        expect(s).toBeCloseTo(1, 5);
      }
      for (const c of n.children) if (c) expect(keys.has(c)).toBe(true);
    }
  });

  test('盲注对抗时小盲没有位置，开池比单挑更紧', () => {
    const hu = solve({ stack: 100, openSize: 3, threeBetSize: 9, fourBetSize: 22 }, 300).nodes[0];
    const bvb = solve({ stack: 100, format: 'bvb', openSize: 3, threeBetSize: 9, fourBetSize: 22 }, 300).nodes[0];
    expect(share(bvb, 'raise')).toBeLessThan(share(hu, 'raise'));
  });
});
