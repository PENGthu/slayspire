import { describe, expect, it } from 'vitest';
import '../src/game/content';
import { Combat as StrictCombat } from '../src/game/combat';
StrictCombat.strict = true;
import { Combat } from '../src/game/combat';
import { Run } from '../src/game/run';
import { makeCard } from '../src/game/cards';
import { generateMap } from '../src/game/map';
import { Rng } from '../src/core/rng';
import type { CharId } from '../src/game/types';

function setup(char: CharId = 'ironclad', enemies = ['nibbit']) {
  const run = Run.create(char, 99);
  run.screen = { s: 'map' };
  const g = new Combat(run, enemies);
  g.start();
  g.hand = [];
  g.energy = 10;
  return { run, g, e: g.enemies[0] };
}

function play(g: Combat, id: string, target = g.enemies[0], up = false) {
  const c = makeCard(id, up);
  g.hand.push(c);
  const ok = g.playCard(c, target);
  expect(ok, `${id} 应能打出`).toBe(true);
  return c;
}

describe('伤害计算', () => {
  it('打击造成 6 点伤害，力量与易伤正确叠加', () => {
    const { g, e } = setup();
    const hp = e.hp;
    play(g, 'strike_r');
    expect(e.hp).toBe(hp - 6);
    g.apply(g.player, 'strength', 2);
    g.apply(e, 'vulnerable', 1);
    const hp2 = e.hp;
    play(g, 'strike_r');
    expect(e.hp).toBe(hp2 - 12); // (6+2)*1.5
  });

  it('虚弱使伤害降低 25% 并向下取整', () => {
    const { g, e } = setup();
    g.apply(g.player, 'weak', 1, e);
    const hp = e.hp;
    play(g, 'strike_r');
    expect(e.hp).toBe(hp - 4);
  });

  it('格挡先吸收伤害，荆棘在攻击时反伤', () => {
    const { g, e } = setup();
    g.gainBlock(g.player, 5);
    g.apply(g.player, 'thorns', 3);
    const ehp = e.hp;
    const php = g.player.hp;
    g.enemyAttack(e, 8);
    expect(g.player.block).toBe(0);
    expect(g.player.hp).toBe(php - 3);
    expect(e.hp).toBe(ehp - 3);
  });

  it('脆弱与敏捷影响卡牌格挡', () => {
    const { g } = setup();
    g.apply(g.player, 'dexterity', 2);
    play(g, 'defend_r');
    expect(g.player.block).toBe(7);
    g.player.block = 0;
    g.apply(g.player, 'frail', 1, g.enemies[0]);
    play(g, 'defend_r');
    expect(g.player.block).toBe(5); // floor(7*0.75)
  });
});

describe('回合与持续效果', () => {
  it('玩家给予的 2 层易伤持续两个玩家回合', () => {
    const { g, e } = setup();
    g.apply(e, 'vulnerable', 2);
    g.endTurn();
    g.runEnemyPhase();
    expect(g.pw(e, 'vulnerable')).toBe(1);
    g.endTurn();
    g.runEnemyPhase();
    expect(g.pw(e, 'vulnerable')).toBe(0);
  });

  it('敌人在其回合施加的 1 层易伤会影响它下一次攻击', () => {
    const { g, e } = setup();
    g.phase = 'enemy';
    g.apply(g.player, 'vulnerable', 1, e);
    g.phase = 'player';
    // 施加的那一轮结束时不会衰减，因此下一次敌方攻击仍然有效
    g.endTurn();
    g.runEnemyPhase();
    expect(g.pw(g.player, 'vulnerable')).toBe(1);
    expect(g.player.justApplied.vulnerable).toBeUndefined();
    g.endTurn();
    g.runEnemyPhase();
    expect(g.pw(g.player, 'vulnerable')).toBe(0);
  });

  it('中毒在敌人回合开始时结算并减 1', () => {
    const { g, e } = setup();
    g.apply(e, 'poison', 5);
    const hp = e.hp;
    g.endTurn();
    g.stepEnemy();
    expect(e.hp).toBe(hp - 5);
    expect(g.pw(e, 'poison')).toBe(4);
  });

  it('灾厄不低于生命时，敌人在回合开始时死亡', () => {
    const { g, e } = setup('necrobinder');
    e.hp = 20;
    g.apply(e, 'doom', 20);
    g.endTurn();
    g.stepEnemy();
    expect(e.dead).toBe(true);
    expect(g.result).toBe('win');
  });

  it('回合结束时弃掉手牌，保留牌留下，虚无牌被消耗', () => {
    const { g } = setup();
    const a = makeCard('strike_r');
    const b = makeCard('regal_presence');
    const c = makeCard('carnage');
    g.hand.push(a, b, c);
    g.endTurn();
    expect(g.discardPile).toContain(a);
    expect(g.exhaustPile).toContain(c);
    g.runEnemyPhase();
    expect(g.hand).toContain(b);
  });
});

describe('角色机制', () => {
  it('奥斯提在格挡之后替玩家承受攻击伤害', () => {
    const { g, e } = setup('necrobinder');
    const osty = g.osty!;
    expect(osty.alive).toBe(true); // 初始遗物召唤
    const ohp = osty.hp;
    g.gainBlock(g.player, 2);
    const php = g.player.hp;
    g.enemyAttack(e, 4);
    expect(g.player.hp).toBe(php);
    expect(osty.hp).toBe(ohp - 2);
    g.enemyAttack(e, 20);
    expect(osty.alive).toBe(false);
    expect(g.player.hp).toBe(php - (20 - (ohp - 2)));
  });

  it('召唤叠加奥斯提的最大生命', () => {
    const { g } = setup('necrobinder');
    const before = g.osty!.maxHp;
    play(g, 'bodyguard');
    expect(g.osty!.maxHp).toBe(before + 5);
  });

  it('铸造会把君王之刃加入手牌并提高伤害', () => {
    const { g, e } = setup('regent');
    play(g, 'forge_ahead');
    const blade = g.hand.find((c) => c.id === 'sovereign_blade');
    expect(blade).toBeDefined();
    const hp = e.hp;
    g.playCard(blade!, e);
    expect(e.hp).toBe(hp - 15);
    // 再次铸造不会产生第二把剑
    play(g, 'forge_ahead');
    expect([...g.hand, ...g.discardPile].filter((c) => c.id === 'sovereign_blade').length).toBe(1);
  });

  it('星辰牌需要足够的星辰', () => {
    const { g } = setup('regent');
    g.stars = 1;
    const c = makeCard('falling_star');
    g.hand.push(c);
    expect(g.canPlay(c)).toBe('星辰不足');
    g.gainStars(1);
    expect(g.playCard(c, g.enemies[0])).toBe(true);
    expect(g.stars).toBe(0);
  });

  it('小刀可以由刀刃之舞生成并被消耗', () => {
    const { g } = setup('silent');
    play(g, 'blade_dance');
    const shivs = g.hand.filter((c) => c.id === 'shiv');
    expect(shivs.length).toBe(3);
    g.playCard(shivs[0], g.enemies[0]);
    expect(g.exhaustPile.some((c) => c.id === 'shiv')).toBe(true);
  });
});

describe('机巧与苦难', () => {
  it('机巧牌被丢弃时会免费打出', () => {
    const { g, e } = setup('silent');
    const sly = makeCard('sly_dagger');
    g.hand.push(sly, makeCard('defend_g'));
    const hp = e.hp;
    const energy = g.energy;
    play(g, 'survivor');
    // 生存者要求丢弃一张牌：选择机巧牌
    expect(g.pending).not.toBeNull();
    g.pending!.resolve([sly]);
    expect(e.hp).toBe(hp - 9);
    expect(g.energy).toBe(energy - 1);
    expect(g.discardPile).toContain(sly);
  });

  it('苦难：沉重使费用 +1，易碎使牌被消耗，汲取打出时失去生命', () => {
    const { g } = setup();
    const a = makeCard('strike_r');
    const b = makeCard('defend_r');
    const c = makeCard('defend_r');
    g.afflict(a, 'heavy');
    g.afflict(b, 'brittle');
    g.afflict(c, 'sapping');
    expect(g.costOf(a)).toBe(2);
    g.hand.push(b, c);
    g.playCard(b, null);
    expect(g.exhaustPile).toContain(b);
    const hp = g.player.hp;
    g.playCard(c, null);
    expect(g.player.hp).toBe(hp - 2);
  });
});

describe('敌人机制', () => {
  it('试验体会复活两次', () => {
    const { g, e } = setup('ironclad', ['test_subject']);
    for (let phase = 1; phase <= 3; phase++) {
      g.dealDamage(e, 9999, g.player, 'hploss');
      g.checkEnd();
      if (phase < 3) {
        expect(e.dead).toBe(false);
        g.endTurn();
        g.runEnemyPhase();
        expect(e.hp).toBeGreaterThan(100);
      }
    }
    expect(e.dead).toBe(true);
    expect(g.result).toBe('win');
  });

  it('首领死亡后仆从会逃跑', () => {
    const { g } = setup('ironclad', ['ovicopter']);
    g.endTurn();
    g.runEnemyPhase();
    expect(g.alive.filter((x) => x.minion).length).toBe(2);
    const mother = g.enemies.find((x) => x.defId === 'ovicopter')!;
    g.dealDamage(mother, 9999, g.player, 'hploss');
    g.checkEnd();
    expect(g.result).toBe('win');
  });
});

describe('地图', () => {
  it('每个起点都能走到首领', () => {
    for (let s = 1; s <= 30; s++) {
      const map = generateMap(new Rng(s), 1 + (s % 3));
      const start = map.rows[0].filter(Boolean);
      expect(start.length).toBeGreaterThanOrEqual(2);
      for (const row of map.rows) {
        for (const n of row) {
          if (!n) continue;
          if (n.row < 14) expect(n.next.length, `节点 ${n.row},${n.col}`).toBeGreaterThan(0);
          for (const c of n.next) expect(map.rows[n.row + 1][c]).not.toBeNull();
        }
      }
      expect(map.rows[8].filter(Boolean).every((n) => n!.kind === 'treasure')).toBe(true);
      expect(map.rows[14].filter(Boolean).every((n) => n!.kind === 'rest')).toBe(true);
      expect(map.rows.slice(0, 5).flat().some((n) => n && (n.kind === 'elite' || n.kind === 'rest'))).toBe(false);
    }
  });
});

describe('奖励与商店', () => {
  it('卡牌奖励不重复，商店有 7 张牌、3 件遗物、3 瓶药水', () => {
    const run = Run.create('silent', 5);
    for (let i = 0; i < 20; i++) {
      const cards = run.cardReward('normal');
      expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
    }
    run.openShop();
    const sc = run.screen;
    if (sc.s !== 'shop') throw new Error('not shop');
    expect(sc.shop.items.filter((i) => i.kind === 'card').length).toBe(7);
    expect(sc.shop.items.filter((i) => i.kind === 'relic').length).toBe(3);
    expect(sc.shop.items.filter((i) => i.kind === 'potion').length).toBe(3);
  });
});
