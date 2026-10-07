import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/game/buildings';
import { animal } from '../src/game/content';
import { endgameBreakdown, scoringCp } from '../src/game/effects';
import { apply, createGame, decision, run } from '../src/game/engine';
import { orientations } from '../src/game/hex';
import { featureCells, getMap, placeShape } from '../src/game/maps';
import { animalCost, animalError, iconCounts, placementError, placements, supportError } from '../src/game/query';
import { breakLength, cpPoints, END_THRESHOLD, SOLO_ROUNDS } from '../src/game/rules';
import type { ActionId, GameState, Move } from '../src/game/types';

/** 跳过开局选牌，直接到玩家 0 的第一个回合 */
function setup(maps = ['m0', 'm0'], soloAppeal?: number): GameState {
  const g = createGame({ seed: 7, soloAppeal, players: maps.map((m, i) => ({ name: `P${i}`, ai: null, map: m })) });
  while (decision(g)?.k === 'pick') {
    const f = decision(g)!;
    if (f.k !== 'pick') break;
    apply(g, { t: 'cards', cards: f.cards.slice(0, f.min) });
  }
  expect(decision(g)?.k).toBe('turn');
  return g;
}

/** 把某张行动卡放到指定位置（下标 0–4） */
function slot(g: GameState, pi: number, a: ActionId, at: number) {
  const p = g.players[pi];
  p.actions = p.actions.filter((x) => x !== a);
  p.actions.splice(at, 0, a);
}

function spot(g: GameState, pi: number, type: string): number[] {
  const ps = placements(g.players[pi], type);
  expect(ps.length).toBeGreaterThan(0);
  return ps[0];
}

function addEnclosure(g: GameState, pi: number, size: number): number {
  const cells = spot(g, pi, `E${size}`);
  const uid = 900 + g.players[pi].buildings.length;
  g.players[pi].buildings.push({ uid, type: `E${size}`, cells, animals: [] });
  return uid;
}

/** 当前玩家把剩下的子决定都跳过（keepMain：遇到行动本身的决定时停下） */
function finish(g: GameState, pi: number, keepMain = false) {
  let guard = 0;
  while (decision(g)?.p === pi && decision(g)?.k !== 'turn' && guard++ < 50) {
    const f = decision(g)!;
    if (keepMain && ['build', 'animals', 'cards', 'assoc', 'sponsors'].includes(f.k)) return;
    let m: Move = { t: 'done' };
    if (f.k === 'cards') m = { t: 'draw', display: [] };
    if (f.k === 'choose') m = { t: 'choose', i: f.opts.length - 1 };
    else if (f.k === 'pick') m = { t: 'cards', cards: (f.cards.length ? f.cards : g.players[pi].hand).slice(0, f.min) };
    apply(g, m);
  }
}

describe('开局', () => {
  it('25 元、4 张手牌、2 张终局计分卡、座次补偿吸引力、动物卡在 1 号位', () => {
    const g = setup();
    g.players.forEach((p, i) => {
      expect(p.money).toBe(25);
      expect(p.hand.length).toBe(4);
      expect(p.scoring.length).toBe(2);
      expect(p.appeal).toBe(i);
      expect(p.actions[0]).toBe('animals');
      expect(p.mapTokens).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(p.workers).toBe(1);
    });
    expect(g.display.length).toBe(6);
    expect(g.projects.length).toBe(3);
    expect(g.baseUnused.length).toBe(9);
    expect(g.tiles.map((t) => t.at)).toEqual([5, 5, 8, 8]);
    expect(g.breakMax).toBe(breakLength(2));
  });

  it('地图 A 开局已有售货亭和空的 3 格围栏', () => {
    const g = setup(['mA', 'm1']);
    const types = g.players[0].buildings.map((b) => b.type).sort();
    expect(types).toEqual(['E3', 'kiosk']);
    expect(g.players[1].buildings.length).toBe(0);
  });
});

describe('行动卡轮转', () => {
  it('用过的卡回到 1 号位，左边的卡右移', () => {
    const g = setup();
    const p = g.players[0];
    const before = [...p.actions];
    const used = before[2];
    apply(g, { t: 'action', action: used, x: 0 });
    finish(g, 0);
    expect(p.actions).toEqual([used, before[0], before[1], before[3], before[4]]);
  });

  it('X 行动：移到 1 号位并获得 X 标记', () => {
    const g = setup();
    const p = g.players[0];
    const a = p.actions[3];
    apply(g, { t: 'xaction', action: a });
    expect(p.actions[0]).toBe(a);
    expect(p.x).toBe(1);
  });
});

describe('地图（平顶六边形）', () => {
  it('每张地图 58 格，偶数列 6 格、奇数列 7 格，邻格互相对称', () => {
    for (const id of ['m0', 'mA', 'm1', 'm8']) {
      const m = getMap(id);
      expect(m.cells.length).toBe(58);
      for (let col = 0; col < 9; col++) expect(m.cells.filter((c) => c.col === col).length).toBe(col % 2 ? 7 : 6);
      for (const c of m.cells) for (const n of c.nbrs) expect(m.cells[n].nbrs).toContain(c.i);
    }
  });
});

describe('建造', () => {
  it('不能建在水域、岩石和 II 格上，必须与边缘或建筑相邻', () => {
    const g = setup();
    const p = g.players[0];
    const map = getMap(p.map);
    const water = map.cells.find((c) => c.terrain === 'water')!;
    const rock = map.cells.find((c) => c.terrain === 'rock')!;
    const upg = map.cells.find((c) => c.upgrade)!;
    const inner = map.cells.find((c) => !c.border && c.terrain === 'land' && !c.upgrade && !c.nbrs.some((n) => map.cells[n].upgrade))!;
    expect(placementError(p, 'E1', [water.i])).toMatch('水域');
    expect(placementError(p, 'E1', [rock.i])).toMatch('岩石');
    expect(placementError(p, 'E1', [upg.i])).toMatch('II');
    expect(placementError(p, 'E1', [inner.i])).toMatch('相邻');
  });

  it('建筑形状允许旋转翻转，不相连的格子不行', () => {
    const g = setup();
    const p = g.players[0];
    const map = getMap(p.map);
    let ok = 0;
    for (const o of orientations(BUILDINGS.E4.shape)) {
      for (const c of map.cells) {
        const cells = placeShape(map, o, c.i);
        if (cells && placementError(p, 'E4', cells) === null) ok++;
      }
    }
    expect(ok).toBeGreaterThan(0);
    const border = map.cells.filter((c) => c.border && c.terrain === 'land' && !c.upgrade);
    const a = border[0];
    const b = border.find((c) => !a.nbrs.includes(c.i) && c.i !== a.i)!;
    expect(placementError(p, 'E2', [a.i, b.i])).toBe('形状不对');
  });

  it('售货亭之间至少隔 2 格', () => {
    const g = setup();
    const p = g.players[0];
    const first = spot(g, 0, 'kiosk');
    p.buildings.push({ uid: 99, type: 'kiosk', cells: first, animals: [] });
    const near = getMap(p.map).cells[first[0]].nbrs.find((n) => getMap(p.map).cells[n].terrain === 'land')!;
    expect(placementError(p, 'kiosk', [near])).toMatch('售货亭');
  });

  it('建造 I 只建 1 座；建造 II 可以建多座不同建筑；覆盖奖励格获得奖励', () => {
    const g = setup();
    const p = g.players[0];
    slot(g, 0, 'build', 4);
    p.money = 40;
    apply(g, { t: 'action', action: 'build', x: 0 });
    const cells = spot(g, 0, 'pavilion');
    apply(g, { t: 'build', type: 'pavilion', cells });
    expect(p.appeal).toBeGreaterThanOrEqual(1);
    finish(g, 0);
    expect(decision(g)?.p).toBe(1);

    const g2 = setup();
    const q = g2.players[0];
    q.upgraded.build = true;
    q.money = 40;
    slot(g2, 0, 'build', 4);
    apply(g2, { t: 'action', action: 'build', x: 0 });
    apply(g2, { t: 'build', type: 'E2', cells: spot(g2, 0, 'E2') });
    finish(g2, 0, true);
    // 预算还剩 3 格，同一种建筑不能再建
    expect(decision(g2)?.k).toBe('build');
    expect(() => apply(g2, { t: 'build', type: 'E2', cells: spot(g2, 0, 'E2') })).toThrow();
    apply(g2, { t: 'build', type: 'E3', cells: spot(g2, 0, 'E3') });
    expect(q.buildings.length).toBe(2);
  });

  it('放置奖励：覆盖 5 元格获得 5 元', () => {
    const g = setup();
    const p = g.players[0];
    const map = getMap(p.map);
    const cell = map.cells.find((c) => c.bonus === 'money5' && c.border)!;
    slot(g, 0, 'build', 4);
    apply(g, { t: 'action', action: 'build', x: 0 });
    const money = p.money;
    apply(g, { t: 'build', type: 'E1', cells: [cell.i] });
    expect(p.money).toBe(money - 2 + 5);
  });
});

describe('动物', () => {
  it('动物行动 I：强度 1 不能打出，强度 2 可以打 1 只；费用、吸引力、图标', () => {
    const g = setup();
    const p = g.players[0];
    const uid = addEnclosure(g, 0, 2);
    p.hand = ['a419'];
    p.money = 30;
    slot(g, 0, 'animals', 1);
    apply(g, { t: 'action', action: 'animals', x: 0 });
    expect(decision(g)?.k).toBe('animals');
    expect(animalError(g, 0, 'a419', -1, uid, false)).toBeNull();
    apply(g, { t: 'animal', card: 'a419', from: -1, building: uid });
    expect(p.money).toBe(25);
    expect(p.appeal).toBe(3);
    expect(iconCounts(p).europe).toBe(1);
    expect(iconCounts(p).predator).toBe(1);
  });

  it('条件：升级要求、合作动物园、水域相邻；合作动物园便宜 3 元', () => {
    const g = setup();
    const p = g.players[0];
    p.money = 60;
    const big = addEnclosure(g, 0, 5);
    p.hand = ['a411', 'a403'];
    p.partners = [];
    expect(animalError(g, 0, 'a411', -1, big, false)).toMatch('需要');
    expect(animalError(g, 0, 'a403', -1, big, false)).toMatch('合作动物园');
    p.partners = ['africa'];
    expect(animalCost(g, p, animal('a403'), -1)).toBe(17);
  });

  it('动物行动 II 可以从声望范围内的展示区打出，额外付位置编号的钱', () => {
    const g = setup();
    const p = g.players[0];
    p.upgraded.animals = true;
    p.money = 50;
    const uid = addEnclosure(g, 0, 2);
    g.display[0] = 'a419';
    expect(animalError(g, 0, 'a419', 0, uid, false)).toMatch('升级');
    expect(animalError(g, 0, 'a419', 0, uid, true)).toBeNull();
    slot(g, 0, 'animals', 1);
    apply(g, { t: 'action', action: 'animals', x: 0 });
    apply(g, { t: 'animal', card: 'a419', from: 0, building: uid });
    expect(p.money).toBe(50 - 6);
  });

  it('群居动物可以与食草动物合住；宠物只能住儿童动物园并按萌宠图标得吸引力', () => {
    const g = setup();
    const p = g.players[0];
    p.money = 80;
    const uid = addEnclosure(g, 0, 2);
    p.buildings.find((b) => b.uid === uid)!.animals.push('a450');
    p.hand = ['a439', 'a528'];
    expect(animalError(g, 0, 'a439', -1, uid, false)).toBeNull();
    const pet = spot(g, 0, 'petting');
    p.buildings.push({ uid: 777, type: 'petting', cells: pet, animals: ['a519'] });
    expect(animalError(g, 0, 'a528', -1, uid, false)).not.toBeNull();
    expect(animalError(g, 0, 'a528', -1, 777, false)).toBeNull();
    slot(g, 0, 'animals', 2);
    const appeal = p.appeal;
    apply(g, { t: 'action', action: 'animals', x: 0 });
    apply(g, { t: 'animal', card: 'a528', from: -1, building: 777 });
    finish(g, 0);
    // 2 个萌宠图标 × 3
    expect(p.appeal).toBe(appeal + 6);
  });

  it('毒液：吸引力更高的对手得到毒液标记，使用其他卡要付 2 元', () => {
    const g = setup();
    const p = g.players[0];
    const o = g.players[1];
    o.appeal = 20;
    p.money = 50;
    p.hand = ['a449'];
    // 鸭嘴兽需要水域：直接放一个与水相邻的围栏
    const map = getMap(p.map);
    const wet = placements(p, 'E2').find((cells) => cells.some((i) => map.cells[i].nbrs.some((n) => map.cells[n].terrain === 'water')))!;
    p.buildings = [{ uid: 1, type: 'E2', cells: wet, animals: [] }];
    slot(g, 0, 'animals', 1);
    apply(g, { t: 'action', action: 'animals', x: 0 });
    apply(g, { t: 'animal', card: 'a449', from: -1, building: 1 });
    finish(g, 0);
    const venomCard = o.actions.find((a) => o.tokens[a]?.venom);
    expect(venomCard).toBe(o.actions[0]);
    // 对手使用另一张卡：付 2 元
    const other = o.actions[4];
    const money = o.money;
    apply(g, { t: 'action', action: other, x: 0 });
    expect(o.money).toBe(money - 2);
  });

  it('倍增标记：同一行动执行两次', () => {
    const g = setup();
    const p = g.players[0];
    p.tokens.cards = { mult: 1 };
    slot(g, 0, 'cards', 1);
    const hand = p.hand.length;
    apply(g, { t: 'action', action: 'cards', x: 0, mult: true });
    apply(g, { t: 'draw', display: [] });
    // 强度 2：抽 1
    expect(decision(g)?.k).toBe('cards');
    apply(g, { t: 'draw', display: [] });
    expect(p.hand.length).toBe(hand + 2);
    expect(p.tokens.cards?.mult).toBeUndefined();
  });

  it('助推：行动结束后可以把行动卡放到 5 号位', () => {
    const g = setup();
    const p = g.players[0];
    p.money = 30;
    const uid = addEnclosure(g, 0, 2);
    p.hand = ['a419'];
    slot(g, 0, 'animals', 1);
    apply(g, { t: 'action', action: 'animals', x: 0 });
    apply(g, { t: 'animal', card: 'a419', from: -1, building: uid });
    const f = decision(g)!;
    expect(f.k).toBe('choose');
    if (f.k !== 'choose') return;
    const i = f.opts.findIndex((o) => o.k === 'slot' && o.to === 4);
    apply(g, { t: 'choose', i });
    expect(p.actions[4]).toBe('animals');
  });
});

describe('赞助卡', () => {
  it('专属建筑：游乐园必须与岩石相邻，立即吸引力 +4', () => {
    const g = setup();
    const p = g.players[0];
    p.hand = ['s255'];
    slot(g, 0, 'sponsors', 2);
    apply(g, { t: 'action', action: 'sponsors', x: 0 });
    const cells = placements(p, 's255')[0];
    const appeal = p.appeal;
    apply(g, { t: 'sponsor', card: 's255', from: -1, cells });
    expect(p.appeal).toBe(appeal + 4);
    expect(p.buildings.some((b) => b.type === 's255')).toBe(true);
  });

  it('专家：任何动物园打出对应图标都得 3 元；联邦资助金提供休息收入', () => {
    const g = setup();
    const o = g.players[1];
    o.sponsors = ['s239', 's220'];
    const p = g.players[0];
    p.money = 30;
    const uid = addEnclosure(g, 0, 2);
    p.hand = ['a419'];
    slot(g, 0, 'animals', 1);
    const money = o.money;
    apply(g, { t: 'action', action: 'animals', x: 0 });
    apply(g, { t: 'animal', card: 'a419', from: -1, building: uid });
    finish(g, 0);
    expect(o.money).toBe(money + 3);
  });

  it('赞助行动可以改为拿钱并推进休息标记', () => {
    const g = setup();
    const p = g.players[0];
    slot(g, 0, 'sponsors', 3);
    apply(g, { t: 'action', action: 'sponsors', x: 0 });
    apply(g, { t: 'sponsorMoney' });
    expect(p.money).toBe(29);
    expect(g.breakPos).toBe(4);
  });
});

describe('协会', () => {
  it('同一任务已有工人时需要 2 名工人', () => {
    const g = setup();
    g.tasks.rep = [1];
    slot(g, 0, 'association', 4);
    apply(g, { t: 'action', action: 'association', x: 0 });
    expect(() => apply(g, { t: 'assoc', task: 'rep' })).toThrow('2 名');
  });

  it('第 2 个合作动物园升级行动卡，第 3 个需要升级的协会行动', () => {
    const g = setup();
    const p = g.players[0];
    p.workers = 4;
    p.partners = ['africa'];
    slot(g, 0, 'association', 4);
    apply(g, { t: 'action', action: 'association', x: 0 });
    apply(g, { t: 'assoc', task: 'partner', continent: 'asia' });
    const f = decision(g)!;
    expect(f.k).toBe('choose');
    if (f.k === 'choose') expect(f.opts.every((o) => o.k === 'upgrade')).toBe(true);
    apply(g, { t: 'choose', i: 1 });
    expect(Object.values(p.upgraded).filter(Boolean).length).toBe(1);
    expect(supportError).toBeDefined();
  });

  it('支持保护项目：拿走地图左侧的标记并获得奖励', () => {
    const g = setup();
    const p = g.players[0];
    g.projects[0] = { id: 'p132', slots: [null, null, null] };
    p.unis = ['u_sci'];
    slot(g, 0, 'association', 4);
    apply(g, { t: 'action', action: 'association', x: 0 });
    apply(g, { t: 'assoc', task: 'project', project: 'p132', level: 2, fromHand: false });
    expect(p.cp).toBe(2);
    const f = decision(g)!;
    expect(f.k).toBe('choose');
    if (f.k !== 'choose') return;
    expect(f.opts.length).toBe(7);
    const money = p.money;
    const i = f.opts.findIndex((o) => o.k === 'mapToken' && getMap(p.map).left[o.i].id === 'money12');
    apply(g, { t: 'choose', i });
    expect(p.money).toBe(money + 12);
    expect(p.mapTokens.length).toBe(6);
  });

  it('放归项目：失去动物和它的吸引力，按体型分档', () => {
    const g = setup();
    const p = g.players[0];
    const uid = addEnclosure(g, 0, 2);
    p.buildings.find((b) => b.uid === uid)!.animals.push('a419');
    p.appeal = 3;
    p.hand.push('p113');
    slot(g, 0, 'association', 4);
    apply(g, { t: 'action', action: 'association', x: 0 });
    expect(supportError(g, 0, 'p113', 0, true, { uid, card: 'a419' })).not.toBeNull();
    apply(g, { t: 'assoc', task: 'project', project: 'p113', level: 2, fromHand: true, release: { uid, card: 'a419' } });
    expect(p.appeal).toBe(0);
    expect(p.cp).toBe(3);
    expect(p.buildings.find((b) => b.uid === uid)!.animals).toEqual([]);
    expect(g.projects.some((x) => x.id === 'p113')).toBe(true);
  });

  it('捐款需要升级的协会行动，每次 1 保护点数', () => {
    const g = setup();
    const p = g.players[0];
    p.upgraded.association = true;
    slot(g, 0, 'association', 1);
    apply(g, { t: 'action', action: 'association', x: 0 });
    apply(g, { t: 'donate' });
    expect(p.cp).toBe(1);
    expect(g.donationStep).toBe(1);
  });
});

describe('奖励与上限', () => {
  it('卡牌行动升级前声望最高 9', () => {
    const g = setup();
    const p = g.players[0];
    p.rep = 8;
    p.repBonuses = [5, 8];
    slot(g, 0, 'association', 4);
    apply(g, { t: 'action', action: 'association', x: 0 });
    apply(g, { t: 'assoc', task: 'rep' });
    finish(g, 0);
    expect(p.rep).toBe(9);
  });

  it('第一位达到保护点数 10 时，所有人各弃 1 张终局计分卡', () => {
    const g = setup();
    const p = g.players[0];
    p.cp = 9;
    p.cpBonuses = [2, 5, 8];
    p.upgraded.association = true;
    slot(g, 0, 'association', 1);
    apply(g, { t: 'action', action: 'association', x: 0 });
    apply(g, { t: 'donate' });
    expect(g.cp10).toBe(true);
    let picks = 0;
    while (decision(g)?.k === 'pick') {
      const f = decision(g)!;
      if (f.k !== 'pick') break;
      expect(f.purpose).toBe('scoringDrop');
      apply(g, { t: 'cards', cards: [f.cards[0]] });
      picks++;
    }
    expect(picks).toBe(2);
    expect(g.players.every((x) => x.scoring.length === 1)).toBe(true);
  });
});

describe('休息与终局', () => {
  it('休息：弃牌到上限、收入、工人回收、清除标记、触发者得 X 标记', () => {
    const g = setup();
    const p = g.players[0];
    g.breakPos = g.breakMax - 1;
    g.tasks.rep = [0];
    p.tokens.build = { venom: 1 };
    p.hand = [...p.hand, ...g.deck.splice(0, 4)];
    slot(g, 0, 'cards', 4);
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
    expect(p.money).toBeGreaterThan(money - 2);
    expect(g.tasks.rep).toEqual([]);
    expect(p.tokens.build?.venom).toBeUndefined();
    expect(p.x).toBe(1);
  });

  it('两个标记相遇后，其他玩家再走一回合，然后计分', () => {
    const g = setup();
    const p = g.players[0];
    p.appeal = END_THRESHOLD - cpPoints(p.cp);
    apply(g, { t: 'xaction', action: p.actions[0] });
    expect(g.endBy).toBe(0);
    expect(g.over).toBe(false);
    expect(decision(g)!.p).toBe(1);
    apply(g, { t: 'xaction', action: g.players[1].actions[0] });
    expect(g.over).toBe(true);
    expect(g.players[0].final).toBeDefined();
  });

  it('终局计分卡：大型动物园按大型动物数量计分', () => {
    const g = setup();
    const p = g.players[0];
    const uid = addEnclosure(g, 0, 5);
    p.buildings.find((b) => b.uid === uid)!.animals.push('a417');
    p.scoring = ['e001'];
    expect(scoringCp(g, 0, 'e001')).toBe(1);
    expect(endgameBreakdown(g, 0)[0].cp).toBe(1);
  });
});

describe('单人挑战', () => {
  it('6 轮（7/6/5/4/3/2 个回合），每轮后休息，最后一轮之后结束', () => {
    const g = setup(['m0'], 12);
    expect(g.players[0].appeal).toBe(12);
    const total = SOLO_ROUNDS.reduce((s, x) => s + x, 0);
    let turns = 0;
    while (!g.over && turns < 100) {
      const p = g.players[0];
      apply(g, { t: 'xaction', action: p.actions[4] });
      while (decision(g) && decision(g)!.k !== 'turn') {
        const f = decision(g)!;
        if (f.k === 'pick') apply(g, { t: 'cards', cards: (f.cards.length ? f.cards : p.hand).slice(0, f.min) });
        else if (f.k === 'choose') apply(g, { t: 'choose', i: 0 });
        else apply(g, { t: 'done' });
      }
      turns++;
      if (turns === 7) expect(g.breaks).toBe(1);
    }
    expect(turns).toBe(total);
    expect(g.breaks).toBe(6);
    expect(g.over).toBe(true);
  });
});

describe('特殊地图', () => {
  it('研究所：连接格有建筑后，打出动物可以忽略 1 个条件', () => {
    const g = setup(['m6', 'm0']);
    const p = g.players[0];
    const map = getMap('m6');
    const inst = featureCells(map, 'institute');
    expect(inst.length).toBe(1);
    p.money = 60;
    // 花豹：需要同大洲的合作动物园，并且围栏要与 1 个岩石格相邻
    const cells = placements(p, 'E3').find((cs) => cs.some((i) => map.cells[i].nbrs.some((n) => map.cells[n].terrain === 'rock')))!;
    p.buildings.push({ uid: 60, type: 'E3', cells, animals: [] });
    p.hand = ['a403'];
    expect(animalError(g, 0, 'a403', -1, 60, false)).toMatch('合作动物园');
    p.buildings.push({ uid: 50, type: 'E1', cells: inst, animals: [] });
    expect(animalError(g, 0, 'a403', -1, 60, false)).toBeNull();
  });
});
