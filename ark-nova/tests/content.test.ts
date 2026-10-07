import { describe, expect, it } from 'vitest';
import { aiMove } from '../src/game/ai';
import { BUILDINGS, BUILDABLE } from '../src/game/buildings';
import { ANIMALS, PROJECTS, SCORING, SPONSORS, baseProjects, deckCards } from '../src/game/content';
import { apply, createGame, decision } from '../src/game/engine';
import { MAPS, MAP_IDS } from '../src/game/maps';
import { CATEGORIES, CONTINENTS } from '../src/game/types';

describe('卡牌内容（原版基础游戏）', () => {
  it('数量与原版一致', () => {
    expect(ANIMALS.length).toBe(128);
    expect(SPONSORS.length).toBe(64);
    expect(PROJECTS.length).toBe(32);
    expect(baseProjects().length).toBe(12);
    expect(SCORING.length).toBe(11);
    expect(deckCards().length).toBe(212);
    expect(new Set(ANIMALS.map((a) => a.num)).size).toBe(128);
  });

  it('动物卡字段合法', () => {
    const icons = [...CONTINENTS, ...CATEGORIES, 'science', 'water', 'rock'];
    for (const a of ANIMALS) {
      expect(a.name, a.id).toBeTruthy();
      expect(a.emoji, a.id).toBeTruthy();
      expect(a.size, a.id).toBeGreaterThanOrEqual(1);
      expect(a.size, a.id).toBeLessThanOrEqual(5);
      expect(a.cost, a.id).toBeGreaterThan(0);
      expect(a.appeal, a.id).toBeGreaterThanOrEqual(0);
      expect(a.icons.length, a.id).toBeGreaterThan(0);
      for (const c of a.icons) expect(icons).toContain(c);
      if (a.noStandard) expect(a.special?.kind, `${a.id} 宠物只能进儿童动物园`).toBe('petting');
      if (a.special) expect(a.special.units, a.id).toBeLessThanOrEqual(5);
    }
  });

  it('每个大洲和种类都有动物', () => {
    for (const c of CONTINENTS) expect(ANIMALS.filter((a) => a.icons.includes(c)).length, c).toBeGreaterThanOrEqual(15);
    for (const c of CATEGORIES) expect(ANIMALS.filter((a) => a.icons.includes(c)).length, c).toBeGreaterThanOrEqual(5);
  });

  it('保护项目三档，保护点数从左到右不增加', () => {
    for (const p of PROJECTS) {
      expect(p.levels.length, p.id).toBe(3);
      if (p.goal.k === 'breed') continue;
      for (let i = 1; i < p.levels.length; i++) {
        expect(p.levels[i].cp, p.id).toBeLessThanOrEqual(p.levels[i - 1].cp);
        if (p.goal.k !== 'release') expect(p.levels[i].need, p.id).toBeLessThanOrEqual(p.levels[i - 1].need);
      }
    }
  });

  it('赞助卡等级 3–6，专属建筑都已注册', () => {
    for (const s of SPONSORS) {
      expect(s.level, s.id).toBeGreaterThanOrEqual(3);
      expect(s.level, s.id).toBeLessThanOrEqual(6);
      expect(s.text, s.id).toBeTruthy();
      if (s.building) expect(BUILDINGS[s.id], s.id).toBeDefined();
    }
    for (const t of BUILDABLE) expect(BUILDINGS[t]).toBeDefined();
  });
});

describe('地图', () => {
  it('10 张原版地图（0、A、1–8），每张都有可建造空间、水域、岩石、放置奖励和 7 个玩家标记', () => {
    expect(MAP_IDS).toEqual(['m0', 'mA', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8']);
    for (const id of MAP_IDS) {
      const m = MAPS[id];
      const land = m.cells.filter((c) => c.terrain === 'land');
      expect(land.length, id).toBeGreaterThanOrEqual(35);
      expect(m.cells.some((c) => c.terrain === 'water'), id).toBe(true);
      expect(m.cells.some((c) => c.terrain === 'rock'), id).toBe(true);
      expect(m.cells.filter((c) => c.bonus).length, id).toBeGreaterThanOrEqual(6);
      expect(m.left.length, id).toBe(7);
    }
  });
});

describe('AI', () => {
  it('简单 AI 两人局可以正常结束', () => {
    const g = createGame({
      seed: 3,
      players: [
        { name: 'A', ai: 'easy', map: 'mA' },
        { name: 'B', ai: 'easy', map: 'm1' },
      ],
    });
    let steps = 0;
    while (!g.over && steps < 6000) {
      const f = decision(g)!;
      apply(g, aiMove(g, g.players[f.p].ai!));
      steps++;
    }
    expect(g.over).toBe(true);
    for (const p of g.players) expect(p.final).toBeDefined();
  }, 120000);

  it('5 人扩展局可以正常结束', () => {
    const maps = ['m0', 'm2', 'm4', 'm6', 'm8'];
    const g = createGame({ seed: 8, players: maps.map((map, i) => ({ name: `P${i}`, ai: 'easy' as const, map })) });
    expect(g.breakMax).toBe(19);
    expect(new Set(g.players.map((p) => p.color)).size).toBe(5);
    let steps = 0;
    while (!g.over && steps < 12000) {
      decision(g);
      apply(g, aiMove(g, 'easy'));
      steps++;
    }
    expect(g.over).toBe(true);
  }, 240000);

  it('单人挑战：AI 能下完 6 轮', () => {
    const g = createGame({ seed: 5, soloAppeal: 10, players: [{ name: 'S', ai: 'easy', map: 'm3' }] });
    let steps = 0;
    while (!g.over && steps < 3000) {
      apply(g, aiMove(g, 'easy'));
      steps++;
    }
    expect(g.over).toBe(true);
    expect(g.breaks).toBe(6);
  }, 120000);
});
