import { describe, expect, it } from 'vitest';
import { apply, createGame, decision, run } from '../src/game/engine';
import { getMap, placeShape } from '../src/game/maps';
import { orientations } from '../src/game/hex';
import { BUILDINGS } from '../src/game/buildings';
import { animalError, placementError, placements } from '../src/game/query';
import { breakLength, cpPoints, END_THRESHOLD } from '../src/game/rules';
import type { GameState } from '../src/game/types';

/** 两人局，跳过开局选牌，直接到玩家 0 的第一个回合 */
function setup(maps = ['A', 'A']): GameState {
  const g = createGame({ seed: 7, players: maps.map((m, i) => ({ name: `P${i}`, ai: null, map: m })) });
  while (decision(g)?.k === 'pick') {
    const f = decision(g)!;
    if (f.k !== 'pick') break;
    apply(g, { t: 'cards', cards: f.cards.slice(0, f.min) });
  }
  expect(decision(g)?.k).toBe('turn');
  return g;
}

/** 在地图上找一个能放下该建筑的位置 */
function spot(g: GameState, pi: number, type: string): number[] {
  const ps = placements(g.players[pi], type);
  expect(ps.length).toBeGreaterThan(0);
  return ps[0];
}

describe('开局', () => {
  it('每人 25 元、4 张手牌、2 张终局计分卡，后手有吸引力补偿', () => {
    const g = setup();
    g.players.forEach((p, i) => {
      expect(p.money).toBe(25);
      expect(p.hand.length).toBe(4);
      expect(p.scoring.length).toBe(2);
      expect(p.appeal).toBe(i);
      expect(p.actions[0]).toBe('animals');
    });
    expect(g.display.length).toBe(6);
    expect(g.breakMax).toBe(breakLength(2, false));
  });
});

describe('行动卡轮转', () => {
  it('用过的卡回到 1 号位，左边的卡右移', () => {
    const g = setup();
    const p = g.players[0];
    const before = [...p.actions];
    const used = before[2];
    apply(g, { t: 'action', action: used, x: 0 });
    while (decision(g)?.p === 0 && decision(g)?.k !== 'turn') apply(g, { t: 'done' });
    expect(p.actions).toEqual([used, before[0], before[1], before[3], before[4]]);
  });

  it('X 行动：移到 1 号位并获得 X 标记，X 标记可以提高强度', () => {
    const g = setup();
    const p = g.players[0];
    const a = p.actions[3];
    apply(g, { t: 'xaction', action: a });
    expect(p.actions[0]).toBe(a);
    expect(p.x).toBe(1);
  });
});

describe('建造', () => {
  it('不能建在水域、岩石和需要升级的格子上，必须与边缘或建筑相邻', () => {
    const g = setup();
    const p = g.players[0];
    const map = getMap(p.map);
    const water = map.list.find((c) => c.terrain === 'water')!;
    const rock = map.list.find((c) => c.terrain === 'rock')!;
    const upg = map.list.find((c) => c.upgrade)!;
    const inner = map.list.find((c) => !c.border && c.terrain === 'land' && !c.upgrade)!;
    expect(placementError(p, 'E1', [water.i])).toMatch('水域');
    expect(placementError(p, 'E1', [rock.i])).toMatch('岩石');
    expect(placementError(p, 'E1', [upg.i])).toMatch('II');
    expect(placementError(p, 'E1', [inner.i])).toMatch('相邻');
    p.upgraded.build = true;
    expect(placementError(p, 'E1', [upg.i])).toBeNull();
  });

  it('建筑形状必须与模板一致（允许旋转翻转）', () => {
    const g = setup();
    const p = g.players[0];
    const map = getMap(p.map);
    for (const o of orientations(BUILDINGS.E3.shape)) {
      for (const c of map.list) {
        const cells = placeShape(map, c.i, o);
        if (cells && placementError(p, 'E3', cells) === null) {
          expect(cells.length).toBe(3);
        }
      }
    }
    const border = map.list.filter((c) => c.border && c.terrain === 'land' && !c.upgrade);
    // 两个不相邻的格子不能组成 2 格围栏
    const a = border[0];
    const b = border.find((c) => !a.nbrs.includes(c.i) && c.i !== a.i)!;
    expect(placementError(p, 'E2', [a.i, b.i])).toBe('形状不对');
  });

  it('售货亭之间至少相隔 2 格', () => {
    const g = setup();
    const p = g.players[0];
    const first = spot(g, 0, 'kiosk');
    p.buildings.push({ uid: 99, type: 'kiosk', cells: first, animals: [] });
    const near = getMap(p.map).cells[first[0]]!.nbrs[0];
    expect(placementError(p, 'kiosk', [near])).toMatch('售货亭');
  });

  it('建造 I 只能建一座建筑，花费每格 2 元，凉亭 +1 吸引力', () => {
    const g = setup();
    const p = g.players[0];
    p.actions = ['animals', 'cards', 'association', 'sponsors', 'build'];
    apply(g, { t: 'action', action: 'build', x: 0 });
    const cells = spot(g, 0, 'pavilion');
    const appeal = p.appeal;
    const money = p.money;
    apply(g, { t: 'build', type: 'pavilion', cells });
    expect(p.appeal).toBeGreaterThanOrEqual(appeal + 1);
    expect(p.money).toBeLessThanOrEqual(money - 2 + 5);
    expect(decision(g)?.p).not.toBe(0);
  });
});

describe('动物', () => {
  function withEnclosure(g: GameState, size: number) {
    const p = g.players[0];
    const cells = spot(g, 0, `E${size}`);
    p.buildings.push({ uid: 500 + size, type: `E${size}`, cells, animals: [] });
    return 500 + size;
  }

  it('需要足够大的空围栏，费用从钱里扣，获得吸引力', () => {
    const g = setup();
    const p = g.players[0];
    const uid = withEnclosure(g, 3);
    p.hand = ['zebra'];
    p.money = 50;
    p.actions = ['cards', 'build', 'association', 'animals', 'sponsors'];
    apply(g, { t: 'action', action: 'animals', x: 0 });
    expect(animalError(g, 0, 'zebra', -1, uid, false)).toBeNull();
    const appeal = p.appeal;
    apply(g, { t: 'animal', card: 'zebra', from: -1, building: uid });
    expect(p.appeal).toBeGreaterThan(appeal);
    expect(p.money).toBeLessThan(50);
    expect(p.buildings.find((b) => b.uid === uid)!.animals).toEqual(['zebra']);
  });

  it('体型超过围栏、或条件不满足时不能打出', () => {
    const g = setup();
    const p = g.players[0];
    const uid = withEnclosure(g, 2);
    p.money = 50;
    p.hand = ['lion'];
    expect(animalError(g, 0, 'lion', -1, uid, false)).toMatch('无法放进');
    p.hand = ['hippo'];
    const big = withEnclosure(g, 4);
    expect(animalError(g, 0, 'hippo', -1, big, false) ?? '').not.toBe('');
  });

  it('动物行动 I 强度 5 只打 1 只时可以忽略 1 个条件', () => {
    const g = setup();
    const p = g.players[0];
    const uid = withEnclosure(g, 5);
    p.hand = ['african_elephant']; // 需要升级的动物行动
    p.money = 60;
    p.actions = ['cards', 'build', 'association', 'sponsors', 'animals'];
    apply(g, { t: 'action', action: 'animals', x: 0 });
    expect(animalError(g, 0, 'african_elephant', -1, uid, false)).not.toBeNull();
    apply(g, { t: 'animal', card: 'african_elephant', from: -1, building: uid });
    expect(p.buildings.find((b) => b.uid === uid)!.animals).toEqual(['african_elephant']);
    // 忽略条件后本次行动结束
    expect(decision(g)?.k === 'animals' && decision(g)?.p === 0).toBe(false);
  });
});

describe('协会', () => {
  it('同一任务已有工人时需要 2 名工人', () => {
    const g = setup();
    const p = g.players[0];
    p.workers = 1;
    g.tasks.rep = [1];
    p.actions = ['cards', 'build', 'animals', 'sponsors', 'association'];
    apply(g, { t: 'action', action: 'association', x: 0 });
    expect(() => apply(g, { t: 'assoc', task: 'rep' })).toThrow('2 名');
  });

  it('第 2 个合作动物园升级行动卡，第 3 个需要升级的协会行动', () => {
    const g = setup();
    const p = g.players[0];
    p.workers = 4;
    p.partners = ['africa'];
    p.actions = ['cards', 'build', 'animals', 'sponsors', 'association'];
    apply(g, { t: 'action', action: 'association', x: 0 });
    apply(g, { t: 'assoc', task: 'partner', continent: 'asia' });
    const f = decision(g)!;
    expect(f.k).toBe('choose');
    if (f.k === 'choose') expect(f.opts.every((o) => o.k === 'upgrade')).toBe(true);
    apply(g, { t: 'choose', i: 0 });
    expect(Object.values(p.upgraded).filter(Boolean).length).toBe(1);
    // 下一回合：没有升级协会时不能拿第 3 个
    p.upgraded = { animals: true, build: false, cards: false, association: false, sponsors: false };
    g.tasks = { rep: [], partner: [], university: [], project: [] };
    while (decision(g)?.p !== 0 || decision(g)?.k !== 'turn') {
      const d = decision(g)!;
      if (d.k === 'turn') apply(g, { t: 'xaction', action: g.players[d.p].actions[0] });
      else apply(g, { t: 'done' });
    }
    p.actions = ['cards', 'build', 'animals', 'sponsors', 'association'];
    apply(g, { t: 'action', action: 'association', x: 0 });
    expect(() => apply(g, { t: 'assoc', task: 'partner', continent: 'europe' })).toThrow('升级');
  });
});

describe('奖励与上限', () => {
  it('卡牌行动升级前声望最高 9', () => {
    const g = setup();
    const p = g.players[0];
    p.rep = 8;
    p.actions = ['cards', 'build', 'animals', 'sponsors', 'association'];
    p.workers = 2;
    apply(g, { t: 'action', action: 'association', x: 0 });
    apply(g, { t: 'assoc', task: 'rep' });
    while (decision(g)?.p === 0 && decision(g)?.k !== 'turn') {
      const d = decision(g)!;
      apply(g, d.k === 'choose' ? { t: 'choose', i: 0 } : d.k === 'display' ? { t: 'take', slot: 0 } : { t: 'done' });
    }
    expect(p.rep).toBe(9);
  });

  it('第一位达到保护点数 10 时，所有人保留 1 张终局计分卡', () => {
    const g = setup();
    const p = g.players[0];
    p.cp = 9;
    p.cpBonuses = [2, 5, 8];
    p.actions = ['cards', 'build', 'animals', 'sponsors', 'association'];
    p.upgraded.association = true;
    apply(g, { t: 'action', action: 'association', x: 0 });
    apply(g, { t: 'donate' });
    expect(g.cp10).toBe(true);
    let picks = 0;
    while (decision(g)?.k === 'pick') {
      const f = decision(g)!;
      if (f.k !== 'pick') break;
      expect(f.purpose).toBe('scoringKeep');
      apply(g, { t: 'cards', cards: [f.cards[0]] });
      picks++;
    }
    expect(picks).toBe(2);
    expect(g.players.every((x) => x.scoring.length === 1)).toBe(true);
  });
});

describe('休息与终局', () => {
  it('休息标记到终点：弃牌到上限、拿收入、工人回收、触发者得 X 标记', () => {
    const g = setup();
    const p = g.players[0];
    g.breakPos = g.breakMax - 1;
    g.tasks.rep = [0];
    p.hand = [...p.hand, ...g.deck.splice(0, 4)];
    p.actions = ['animals', 'build', 'association', 'sponsors', 'cards'];
    const money = p.money;
    apply(g, { t: 'action', action: 'cards', x: 0 });
    while (decision(g) && decision(g)!.k !== 'turn') {
      const f = decision(g)!;
      const owner = g.players[f.p];
      if (f.k === 'cards') apply(g, { t: 'draw', display: [] });
      else if (f.k === 'pick') apply(g, { t: 'cards', cards: (f.cards.length ? f.cards : owner.hand).slice(0, f.min) });
      else apply(g, { t: 'done' });
    }
    run(g);
    expect(g.breaks).toBe(1);
    expect(g.breakPos).toBe(0);
    expect(p.hand.length).toBeLessThanOrEqual(3);
    expect(p.money).toBeGreaterThan(money);
    expect(g.tasks.rep).toEqual([]);
    expect(p.x).toBe(1);
  });

  it('两个标记相遇后，其他玩家再走一回合，然后计分', () => {
    const g = setup();
    const p = g.players[0];
    p.appeal = END_THRESHOLD - cpPoints(p.cp);
    apply(g, { t: 'xaction', action: p.actions[0] });
    expect(g.endBy).toBe(0);
    expect(g.over).toBe(false);
    const d = decision(g)!;
    expect(d.p).toBe(1);
    apply(g, { t: 'xaction', action: g.players[1].actions[0] });
    expect(g.over).toBe(true);
    expect(g.players[0].final).toBeDefined();
  });
});
