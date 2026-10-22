import { describe, expect, test } from 'vitest';
import { exportNode, importNode } from '../src/engine/rangeIO';
import { buildSixMax, nodeKey } from '../src/engine/sixmax';
import { deal, eligibleNodes, grade, handWeights, isBorderline, rngAction } from '../src/engine/trainer';
import { emptyStats, mistakes, record } from '../src/engine/stats';
import { describeLine, tableState, type SpotNode } from '../src/engine/types';
import { HAND_COMBOS, handIndex } from '../src/poker/cards';

const { nodes, warnings } = buildSixMax();
const h = handIndex;
const node = (k: string) => nodes.get(k)!;

function share(n: SpotNode, a: number) {
  const k = n.actions.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < 169; i++) {
    const w = n.heroReach[i] * HAND_COMBOS[i];
    num += w * n.strategy[i * k + a];
    den += w;
  }
  return num / den;
}

describe('6 人桌策略库', () => {
  test('数据没有频率之和超过 100% 的手牌', () => {
    expect(warnings).toEqual([]);
  });

  test('决策点数量：5 开池 + 15 面对开池 + 15×3 后续', () => {
    expect(nodes.size).toBe(65);
    for (const n of nodes.values()) for (const c of n.children) if (c) expect(nodes.has(c)).toBe(true);
  });

  test('每手牌的频率和为 1', () => {
    for (const n of nodes.values()) {
      const k = n.actions.length;
      for (let i = 0; i < 169; i++) {
        let s = 0;
        for (let a = 0; a < k; a++) s += n.strategy[i * k + a];
        expect(s).toBeCloseTo(1, 5);
      }
    }
  });

  test('开池范围随位置变宽', () => {
    const open = ['UTG', 'HJ', 'CO', 'BTN'].map((p) => share(node(nodeKey.rfi(p as 'UTG')), 1));
    for (let i = 1; i < open.length; i++) expect(open[i]).toBeGreaterThan(open[i - 1]);
    expect(open[0]).toBeGreaterThan(0.15);
    expect(open[0]).toBeLessThan(0.21);
    expect(open[3]).toBeGreaterThan(0.4);
    expect(open[3]).toBeLessThan(0.5);
  });

  test('强牌从不弃牌，垃圾牌不开池', () => {
    for (const n of nodes.values()) {
      const k = n.actions.length;
      if (n.heroReach[h('AA')] > 0) expect(n.strategy[h('AA') * k]).toBe(0);
    }
    expect(node(nodeKey.rfi('UTG')).strategy[h('72o') * 2 + 1]).toBe(0);
    expect(node(nodeKey.rfi('BTN')).strategy[h('72o') * 2 + 1]).toBe(0);
  });

  test('后续节点的范围来自前面的行动', () => {
    const v3 = node(nodeKey.v3('CO', 'BTN'));
    const rfi = node(nodeKey.rfi('CO'));
    for (let i = 0; i < 169; i++) expect(v3.heroReach[i]).toBeCloseTo(rfi.strategy[i * 2 + 1], 6);
    // 不在开池范围里的手牌不会走到面对 3-Bet
    expect(v3.heroReach[h('72o')]).toBe(0);
    const v4 = node(nodeKey.v4('BTN', 'CO'));
    const vo = node(nodeKey.vo('BTN', 'CO'));
    expect(v4.heroReach[h('A5s')]).toBeCloseTo(vo.strategy[h('A5s') * 3 + 2], 6);
  });

  test('大盲防守比其他位置宽', () => {
    const bb = node(nodeKey.vo('BB', 'BTN'));
    const sb = node(nodeKey.vo('SB', 'BTN'));
    expect(1 - share(bb, 0)).toBeGreaterThan(1 - share(sb, 0));
    expect(share(sb, 1)).toBe(0); // 小盲面对开池只 3-Bet 或弃牌
  });

  test('牌桌状态：底池与需跟注额', () => {
    const v3 = node(nodeKey.v3('CO', 'BTN'));
    const st = tableState(v3);
    expect(st.pot).toBeCloseTo(0.5 + 1 + 2.5 + 7.5);
    expect(st.toCall).toBeCloseTo(5);
    expect(st.folded.has('UTG')).toBe(true);
    expect(describeLine(v3.line)).toBe('UTG、HJ 弃牌 · CO 加注 2.5 · BTN 3-Bet 7.5 · SB、BB 弃牌');
    const rfi = tableState(node(nodeKey.rfi('UTG')));
    expect(rfi.pot).toBe(1.5);
    expect(rfi.toCall).toBe(1);
  });

  test('编辑开池范围会影响后续节点', () => {
    const k = nodeKey.rfi('CO');
    const s = Float32Array.from(node(k).strategy);
    s[h('72o') * 2] = 0;
    s[h('72o') * 2 + 1] = 1;
    const edited = buildSixMax({ [k]: s });
    expect(edited.nodes.get(nodeKey.v3('CO', 'BTN'))!.heroReach[h('72o')]).toBe(1);
  });
});

describe('导入导出', () => {
  test('导出后再导入，策略不变', () => {
    for (const k of [nodeKey.vo('BB', 'BTN'), nodeKey.v3('SB', 'BB'), nodeKey.rfi('UTG')]) {
      const n = node(k);
      const back = importNode(n, exportNode(n));
      const kk = n.actions.length;
      for (let i = 0; i < 169; i++) {
        if (n.heroReach[i] <= 0) continue;
        for (let a = 0; a < kk; a++) expect(back[i * kk + a]).toBeCloseTo(n.strategy[i * kk + a], 2);
      }
    }
  });

  test('行动名不对或频率超过 100% 时报错', () => {
    const n = node(nodeKey.vo('BTN', 'CO'));
    expect(() => importNode(n, '加注到底: AA')).toThrow();
    expect(() => importNode(n, '3-Bet: AA\n跟注: AA')).toThrow();
    const s = importNode(n, '3bet: QQ+, AKs\ncall: JJ:0.5');
    expect(s[h('JJ') * 3 + 1]).toBeCloseTo(0.5);
    expect(s[h('JJ') * 3]).toBeCloseTo(0.5);
  });
});

describe('训练', () => {
  const filter = { families: ['RFI', 'VO', 'V3', 'V4'], heroes: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'], focus: true };

  test('筛选场景与位置', () => {
    const e = eligibleNodes(nodes.values(), { ...filter, families: ['RFI'], heroes: ['BTN'] });
    expect(e.map((n) => n.key)).toEqual([nodeKey.rfi('BTN')]);
  });

  test('抽到的手牌一定在范围内', () => {
    const e = eligibleNodes(nodes.values(), filter);
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 300; i++) {
      const d = deal(e, filter, rnd)!;
      expect(d.node.heroReach[d.hand]).toBeGreaterThan(0);
      expect(d.rng).toBeGreaterThanOrEqual(0);
      expect(d.rng).toBeLessThan(100);
    }
  });

  test('边缘牌优先会降低一眼牌的权重', () => {
    const n = node(nodeKey.rfi('UTG'));
    expect(isBorderline(n, h('72o'))).toBe(false);
    expect(isBorderline(n, h('A9o'))).toBe(true); // 紧挨着 ATo（混合）
    const w = handWeights(n, true);
    const raw = handWeights(n, false);
    expect(w[h('72o')] / raw[h('72o')]).toBeLessThan(0.2);
    expect(w[h('KJo')]).toBe(raw[h('KJo')]);
  });

  test('评分：纯策略、混合策略与随机数模式', () => {
    const n = node(nodeKey.rfi('UTG'));
    expect(grade(n, h('AA'), 1, false, 0).grade).toBe('best');
    expect(grade(n, h('AA'), 0, false, 0).grade).toBe('wrong');
    // KJo 开池 70%：加注最好，弃牌 30% 也算可以
    expect(grade(n, h('KJo'), 1, false, 0).grade).toBe('best');
    expect(grade(n, h('KJo'), 0, false, 0)).toMatchObject({ grade: 'good', correct: true });
    // 随机数：加注占 0–69，弃牌占 70–99
    expect(rngAction([0.3, 0.7], 10)).toBe(1);
    expect(rngAction([0.3, 0.7], 69)).toBe(1);
    expect(rngAction([0.3, 0.7], 70)).toBe(0);
    expect(grade(n, h('KJo'), 0, true, 85).correct).toBe(true);
    expect(grade(n, h('KJo'), 0, true, 20).correct).toBe(false);
  });

  test('训练记录与错题', () => {
    let s = emptyStats();
    const base = { t: 0, key: 'k', title: 't', family: 'RFI', hero: 'CO', source: 'sixmax' as const, cards: [0, 4] as [number, number], action: '弃牌', labels: ['弃牌', '加注'], freqs: [0, 1] };
    s = record(s, { ...base, hand: 1, grade: 'wrong', correct: false });
    s = record(s, { ...base, hand: 2, grade: 'best', correct: true });
    s = record(s, { ...base, hand: 1, grade: 'wrong', correct: false });
    expect(s.total).toEqual({ n: 3, ok: 1 });
    expect(s.byFamilyHero['RFI|CO']).toEqual({ n: 3, ok: 1 });
    expect(s.bestStreak).toBe(1);
    expect(s.streak).toBe(0);
    expect(mistakes(s)).toHaveLength(1);
  });
});
