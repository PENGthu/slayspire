import { describe, expect, test } from 'vitest';
import { HAND_COMBOS, classOfCards, combosList, handIndex, handLabel, pairWeights } from '../src/poker/cards';
import { equity, equityVsRange } from '../src/poker/equity';
import { formatRange, parseRange, rangeCombos, RangeParseError } from '../src/poker/range';

const h = handIndex;

describe('起手牌类别', () => {
  test('标签与编号互逆，组合数合计 1326', () => {
    for (let i = 0; i < 169; i++) expect(handIndex(handLabel(i))).toBe(i);
    expect(HAND_COMBOS.reduce((a, b) => a + b, 0)).toBe(1326);
    expect(handLabel(h('AKs'))).toBe('AKs');
    expect(handLabel(h('KAo'))).toBe('AKo');
    expect(h('AA')).toBe(0);
    expect(h('AKs')).toBe(1);
    expect(h('AKo')).toBe(13);
  });

  test('具体组合属于自己的类别', () => {
    for (let i = 0; i < 169; i++) for (const [a, b] of combosList(i)) expect(classOfCards(a, b)).toBe(i);
  });

  test('卡牌移除后的组合对数量', () => {
    const w = pairWeights();
    expect(w[h('AA') * 169 + h('KK')]).toBe(36);
    expect(w[h('AA') * 169 + h('AKs')]).toBe(12);
    expect(w[h('AA') * 169 + h('AA')]).toBe(6);
    expect(w[h('AKo') * 169 + h('AKs')]).toBe(w[h('AKs') * 169 + h('AKo')]);
    let total = 0;
    for (const x of w) total += x;
    expect(total).toBe(1326 * 1225);
  });
});

describe('范围记法', () => {
  test('常见写法', () => {
    expect(rangeCombos(parseRange('22+'))).toBe(78);
    expect(rangeCombos(parseRange('A2s+'))).toBe(48);
    expect(rangeCombos(parseRange('KTo+'))).toBe(36);
    expect(rangeCombos(parseRange('99-66'))).toBe(24);
    expect(rangeCombos(parseRange('66-99'))).toBe(24);
    expect(rangeCombos(parseRange('ATs-A7s'))).toBe(16);
    expect(rangeCombos(parseRange('AK'))).toBe(16);
    expect(rangeCombos(parseRange('AKs:0.5, QQ:25%'))).toBeCloseTo(2 + 1.5);
  });

  test('错误的写法会报错', () => {
    expect(() => parseRange('AXs')).toThrow(RangeParseError);
    expect(() => parseRange('AKs:2.5%x')).toThrow(RangeParseError);
    expect(() => parseRange('AKs-QJs')).toThrow(RangeParseError);
  });

  test('压缩后再解析不变', () => {
    const text = 'TT+, 77-55, A2s+, K9s+, QJs, AJo+, KQo, A5s:0.5, 22:0.25, T9s:0.4';
    const r = parseRange(text);
    expect(Array.from(parseRange(formatRange(r)))).toEqual(Array.from(r));
    expect(formatRange(parseRange('22+'))).toBe('22+');
    expect(formatRange(parseRange('A2s+'))).toBe('A2s+');
  });
});

describe('胜率表', () => {
  test('与公认的全下胜率一致', () => {
    const cases: [string, string, number][] = [
      ['AA', 'KK', 0.819],
      ['AKs', 'QQ', 0.46],
      ['AKo', 'QQ', 0.432],
      ['22', 'AKo', 0.527],
      ['AA', '72o', 0.883],
      ['KK', 'AKo', 0.698],
      ['AKo', 'AQo', 0.743],
      ['JTs', '22', 0.534],
    ];
    for (const [a, b, e] of cases) {
      expect(equity(h(a), h(b))).toBeCloseTo(e, 2);
      expect(equity(h(a), h(b)) + equity(h(b), h(a))).toBeCloseTo(1, 6);
    }
    expect(equity(h('T9s'), h('T9s'))).toBe(0.5);
  });

  test('对抗范围的胜率', () => {
    const r = parseRange('AA');
    expect(equityVsRange(h('KK'), r)).toBeCloseTo(0.18, 2);
    expect(equityVsRange(h('AA'), parseRange('22+, A2s+, K2s+, Q2s+, J2s+, T2s+, 92s+, 82s+, 72s+, 62s+, 52s+, 42s+, 32s, A2o+, K2o+, Q2o+, J2o+, T2o+, 92o+, 82o+, 72o+, 62o+, 52o+, 42o+, 32o'))).toBeCloseTo(0.852, 2);
  });
});
