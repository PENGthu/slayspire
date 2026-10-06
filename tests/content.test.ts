import { describe, expect, it } from 'vitest';
import '../src/game/content';
import { Combat as StrictCombat } from '../src/game/combat';
StrictCombat.strict = true;
import { ANCIENTS, CARDS, ENCOUNTERS, ENEMIES, EVENTS, POTIONS, POWERS, RELICS } from '../src/game/registry';
import { CHARACTERS } from '../src/game/characters';
import { cardDef, cardText, makeCard, rawText } from '../src/game/cards';
import { Run } from '../src/game/run';
import { Combat } from '../src/game/combat';
import { Rng } from '../src/core/rng';
import { botCombat, resolvePending } from '../src/game/bot';

describe('内容完整性', () => {
  it('所有角色的初始牌组和遗物都存在', () => {
    for (const c of Object.values(CHARACTERS)) {
      for (const id of c.deck) expect(CARDS[id], id).toBeDefined();
      expect(RELICS[c.relic], c.relic).toBeDefined();
    }
  });

  it('每个角色的卡池数量充足', () => {
    for (const ch of Object.keys(CHARACTERS)) {
      for (const r of ['common', 'uncommon', 'rare']) {
        const n = Object.values(CARDS).filter((d) => d.color === ch && d.rarity === r && !d.noPool).length;
        expect(n, `${ch} ${r}`).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it('卡牌描述只使用合法占位符', () => {
    for (const d of Object.values(CARDS)) {
      for (const up of [false, true]) {
        const c = makeCard(d.id, up);
        const t = rawText(c);
        const bad = t.match(/\{[^DBMN}]*\}/g);
        expect(bad, `${d.id}: ${t}`).toBeNull();
        if (t.includes('{D}')) expect(d.dmg !== undefined || !!d.dmgFn, d.id).toBe(true);
        if (t.includes('{B}')) expect(d.blk !== undefined || !!d.blkFn, d.id).toBe(true);
        if (t.includes('{M}')) expect(d.mag !== undefined, d.id).toBe(true);
        expect(cardText(c, null).length).toBeGreaterThan(0);
      }
    }
  });

  it('遭遇中的敌人都存在，且 AI 返回合法行动', () => {
    for (const enc of Object.values(ENCOUNTERS)) {
      const ids = typeof enc.enemies === 'function' ? enc.enemies(new Rng(1)) : enc.enemies;
      for (const id of ids) expect(ENEMIES[id], `${enc.id}: ${id}`).toBeDefined();
    }
    const run = Run.create('ironclad', 1);
    for (const def of Object.values(ENEMIES)) {
      const g = new Combat(run, [def.id]);
      g.start();
      const e = g.enemies[0];
      expect(def.moves[e.move!], `${def.id} 首个行动 ${e.move}`).toBeDefined();
    }
  });

  it('每一幕都有各类遭遇与首领', () => {
    for (const act of [1, 2, 3]) {
      for (const kind of ['weak', 'strong', 'elite', 'boss']) {
        const n = Object.values(ENCOUNTERS).filter((e) => e.act === act && e.kind === kind).length;
        expect(n, `第${act}幕 ${kind}`).toBeGreaterThan(0);
      }
    }
  });

  it('其他注册表非空', () => {
    expect(Object.keys(POWERS).length).toBeGreaterThan(40);
    expect(Object.keys(RELICS).length).toBeGreaterThan(60);
    expect(Object.keys(POTIONS).length).toBeGreaterThan(25);
    expect(Object.keys(EVENTS).length).toBeGreaterThan(15);
    expect(Object.keys(ANCIENTS).length).toBeGreaterThan(4);
  });
});

describe('逐张卡牌打出', () => {
  for (const ch of Object.keys(CHARACTERS) as (keyof typeof CHARACTERS)[]) {
    it(`${CHARACTERS[ch].name}：所有可打出的牌都能正常打出`, () => {
      const run = Run.create(ch, 42);
      run.screen = { s: 'map' };
      const ids = Object.values(CARDS)
        .filter((d) => d.color === ch || d.color === 'colorless' || d.color === 'status' || d.color === 'curse')
        .map((d) => d.id);
      for (const id of ids) {
        for (const up of [false, true]) {
          const g = new Combat(run, ['nibbit', 'shroomling', 'ceremonial_beast']);
          g.start();
          resolvePending(g, new Rng(1));
          g.summon(10);
          g.gainStars(10);
          g.energy = 10;
          const c = makeCard(id, up);
          g.hand.push(c);
          const ok = g.canPlay(c);
          if (ok === true) {
            const played = g.playCard(c, g.alive[0]);
            expect(played, id).toBe(true);
            resolvePending(g, new Rng(2));
            expect(g.phase === 'player' || g.over, `${id} 打出后阶段 ${g.phase}`).toBe(true);
          }
          // 结束回合以触发回合结束效果
          g.endTurn();
          resolvePending(g, new Rng(3));
          g.runEnemyPhase();
          resolvePending(g, new Rng(4));
          void cardDef(id);
        }
      }
    });
  }
});

describe('每个遭遇的随机战斗', () => {
  for (const enc of Object.values(ENCOUNTERS)) {
    it(`${enc.id}`, () => {
      for (const ch of ['ironclad', 'silent', 'regent', 'necrobinder', 'defect', 'claude'] as const) {
        const run = Run.create(ch, 7);
        run.maxHp = 3000;
        run.hp = 3000;
        const ids = typeof enc.enemies === 'function' ? enc.enemies(new Rng(3)) : enc.enemies;
        const g = new Combat(run, ids, { boss: enc.kind === 'boss', elite: enc.kind === 'elite' });
        g.start();
        const turns = botCombat(g, new Rng(9), { smart: true }, 120);
        // 精英/首领可能有持续削弱效果，机器人打不完也可以；但不能出错
        if (enc.kind === 'weak' || enc.kind === 'strong') expect(g.over, `${enc.id} 未在 ${turns} 回合内结束`).toBe(true);
      }
    });
  }
});
