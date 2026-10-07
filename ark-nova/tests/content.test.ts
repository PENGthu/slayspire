import { describe, expect, it } from 'vitest';
import { ANIMALS, PROJECTS, SCORING, SPONSORS, deckCards } from '../src/game/content';
import { BUILDINGS, BUILDABLE } from '../src/game/buildings';
import { MAPS, MAP_IDS } from '../src/game/maps';
import { CATEGORIES, CONTINENTS } from '../src/game/types';
import { apply, createGame, decision } from '../src/game/engine';
import { aiMove } from '../src/game/ai';

describe('卡牌内容', () => {
  it('数量接近原作规模', () => {
    expect(ANIMALS.length).toBeGreaterThanOrEqual(120);
    expect(SPONSORS.length).toBeGreaterThanOrEqual(50);
    expect(PROJECTS.length).toBeGreaterThanOrEqual(20);
    expect(SCORING.length).toBeGreaterThanOrEqual(11);
    expect(deckCards().length).toBeGreaterThan(190);
  });

  it('动物卡字段合法', () => {
    for (const a of ANIMALS) {
      expect(a.name, a.id).toBeTruthy();
      expect(a.emoji, a.id).toBeTruthy();
      expect(a.size, a.id).toBeGreaterThanOrEqual(0);
      expect(a.size, a.id).toBeLessThanOrEqual(5);
      expect(a.cost, a.id).toBeGreaterThan(0);
      expect(a.appeal, a.id).toBeGreaterThanOrEqual(1);
      expect(a.categories.length, a.id).toBeGreaterThan(0);
      for (const c of a.continents) expect(CONTINENTS).toContain(c);
      for (const c of a.categories) expect(CATEGORIES).toContain(c);
      if (a.size === 0) expect(a.special?.kind, `${a.id} 宠物只能进儿童动物园`).toBe('petting');
    }
  });

  it('每个大洲和种类都有足够的动物', () => {
    for (const c of CONTINENTS) expect(ANIMALS.filter((a) => a.continents.includes(c)).length, c).toBeGreaterThanOrEqual(12);
    for (const c of CATEGORIES) expect(ANIMALS.filter((a) => a.categories.includes(c)).length, c).toBeGreaterThanOrEqual(6);
  });

  it('保护项目的档位从高到低', () => {
    for (const p of PROJECTS) {
      expect(p.levels.length, p.id).toBe(3);
      for (let i = 1; i < p.levels.length; i++) {
        expect(p.levels[i].need, p.id).toBeLessThanOrEqual(p.levels[i - 1].need);
        expect(p.levels[i].cp, p.id).toBeLessThanOrEqual(p.levels[i - 1].cp);
      }
    }
  });

  it('赞助卡的专属建筑都已注册', () => {
    for (const s of SPONSORS) if (s.building) expect(BUILDINGS[s.id], s.id).toBeDefined();
    for (const t of BUILDABLE) expect(BUILDINGS[t]).toBeDefined();
  });
});

describe('地图', () => {
  it('每张地图都有足够的可建造空间与水域、岩石', () => {
    for (const id of MAP_IDS) {
      const m = MAPS[id];
      const land = m.list.filter((c) => c.terrain === 'land');
      expect(land.length, id).toBeGreaterThanOrEqual(45);
      expect(m.list.some((c) => c.terrain === 'water'), id).toBe(true);
      expect(m.list.some((c) => c.terrain === 'rock'), id).toBe(true);
      expect(m.list.filter((c) => c.bonus).length, id).toBeGreaterThanOrEqual(6);
    }
  });
});

describe('AI', () => {
  it('简单 AI 两人局可以正常结束', () => {
    const g = createGame({ seed: 3, players: [{ name: 'A', ai: 'easy', map: 'A' }, { name: 'B', ai: 'easy', map: 'lake' }] });
    let steps = 0;
    while (!g.over && steps < 6000) {
      const f = decision(g)!;
      apply(g, aiMove(g, g.players[f.p].ai!));
      steps++;
    }
    expect(g.over).toBe(true);
    for (const p of g.players) expect(p.final).toBeDefined();
  });

  it('5 人扩展局可以正常结束', () => {
    const maps = ['A', 'lake', 'mountain', 'research', 'boulevard'];
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
  }, 60000);
});
