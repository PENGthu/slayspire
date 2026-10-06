import { describe, expect, it } from 'vitest';
import '../src/game/content';
import { Run } from '../src/game/run';
import { makeCard } from '../src/game/cards';

function fresh() {
  const run = Run.create('ironclad', 7);
  run.reveals = [];
  return run;
}

describe('获得 / 修改卡牌时的展示', () => {
  it('获得卡牌会展示；连续获得同类合并为一次', () => {
    const run = fresh();
    run.addCard('bite');
    run.addCard('bite');
    expect(run.reveals.length).toBe(1);
    expect(run.reveals[0].kind).toBe('gain');
    expect(run.reveals[0].cards.map((c) => c.id)).toEqual(['bite', 'bite']);
  });

  it('玩家刚点选的牌（奖励、商店）和静默加入的牌不再展示', () => {
    const run = fresh();
    run.addCard('bite', false, true);
    run.addCard('bite', true);
    expect(run.reveals).toEqual([]);
  });

  it('随机升级：展示升级前后', () => {
    const run = fresh();
    const up = run.upgradeRandom(1);
    expect(run.reveals.length).toBe(1);
    const rv = run.reveals[0];
    expect(rv.kind).toBe('upgrade');
    expect(rv.cards[0].id).toBe(up[0].id);
    expect(rv.cards[0].up).toBe(true);
    expect(rv.from![0].up).toBe(false);
  });

  it('变化：展示原来的牌和变成的牌', () => {
    const run = fresh();
    const old = run.deck[0];
    const nc = run.transformCard(old);
    expect(run.reveals.length).toBe(1);
    expect(run.reveals[0].kind).toBe('transform');
    expect(run.reveals[0].from![0].id).toBe(old.id);
    expect(run.reveals[0].cards[0].id).toBe(nc.id);
  });

  it('附魔：展示附魔后的牌；展示的是快照，不随原牌后续变化', () => {
    const run = fresh();
    const c = run.deck[0];
    run.enchant(c, 'sharp', 3);
    const shown = run.reveals[0].cards[0];
    expect(shown.ench).toEqual({ id: 'sharp', n: 3 });
    c.up = true;
    c.ench!.n = 9;
    expect(shown.up).toBe(false);
    expect(shown.ench!.n).toBe(3);
  });

  it('已开始展示的不再合并；队列有上限', () => {
    const run = fresh();
    run.addCard('bite');
    run.reveals[0].shown = true;
    run.addCard('bite');
    expect(run.reveals.length).toBe(2);
    for (let i = 0; i < 20; i++) {
      run.enchant(makeCard('bite'), 'sharp', 1);
      run.reveals[run.reveals.length - 1].shown = true;
    }
    expect(run.reveals.length).toBe(6);
  });
});
