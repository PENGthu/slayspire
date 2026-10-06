import { describe, expect, it } from 'vitest';
import '../src/game/content';
import { Combat as StrictCombat } from '../src/game/combat';
StrictCombat.strict = true;
import { Combat } from '../src/game/combat';
import { Run } from '../src/game/run';
import { makeCard } from '../src/game/cards';
import { ENCOUNTERS, ENEMIES } from '../src/game/registry';

function setup(enemies: string[]) {
  const run = Run.create('ironclad', 99);
  run.screen = { s: 'map' };
  const g = new Combat(run, enemies);
  g.start();
  g.hand = [];
  g.energy = 10;
  return { run, g, e: g.enemies[0] };
}

/** 结束回合并跑完敌方回合 */
function pass(g: Combat) {
  g.endTurn();
  g.runEnemyPhase();
}

describe('原版阵容', () => {
  it('四个区域的普通怪、精英与首领齐全', () => {
    const ids = (act: number, zone: string | undefined, kind: string) =>
      Object.values(ENCOUNTERS)
        .filter((x) => x.act === act && (x.zone ?? (act === 1 ? 'overgrowth' : undefined)) === zone && x.kind === kind && !x.char)
        .map((x) => x.id);
    expect(ids(1, 'overgrowth', 'elite').sort()).toEqual(['a1_byrdonis', 'a1_effigy', 'a1_phrog']);
    expect(ids(1, 'underdocks', 'boss').sort()).toEqual(['u1_fysh', 'u1_giant', 'u1_matriarch']);
    expect(ids(3, undefined, 'boss').sort()).toEqual(['a3_aeonglass', 'a3_queen', 'a3_subject']);
    for (const id of ['cubex_construct', 'flyconid', 'fogmog', 'mawler', 'snapping_jaxfruit', 'slithering_strangler', 'vine_shambler',
      'corpse_slug', 'two_tailed_rat', 'bowlbug_rock', 'louse_progenitor', 'the_obscura', 'owl_magistrate', 'frog_knight', 'fabricator']) {
      expect(ENEMIES[id], id).toBeDefined();
    }
    for (const id of ['twig_cultist', 'shroomling', 'sentinel', 'dock_rat', 'hive_guard', 'seraph', 'doormaker']) {
      expect(ENEMIES[id], id).toBeUndefined();
    }
  });
});

describe('新怪物机制', () => {
  it('寄生蛙死亡时钻出 4 只蠕虫，蠕虫出生回合不行动', () => {
    const { g, e } = setup(['phrog_parasite']);
    g.dealDamage(e, 999, g.player, 'hploss');
    g.checkEnd();
    expect(g.result).toBeNull();
    const worms = g.alive.filter((x) => x.defId === 'wriggler');
    expect(worms.length).toBe(4);
    expect(worms.every((w) => w.move === 'spawned')).toBe(true);
    const hp = g.player.hp;
    pass(g);
    expect(g.player.hp).toBe(hp);
  });

  it('长牙之眼被击败后下回合复原；雾菇怪死亡时战斗结束', () => {
    const { g } = setup(['fogmog']);
    pass(g); // 雾菇怪召唤长牙之眼
    const eye = g.alive.find((x) => x.defId === 'eye_with_teeth')!;
    expect(eye).toBeDefined();
    g.dealDamage(eye, 99, g.player);
    expect(eye.dead).toBe(false);
    expect(eye.move).toBe('revive');
    pass(g);
    expect(eye.hp).toBe(eye.maxHp);
    const fog = g.enemies.find((x) => x.defId === 'fogmog')!;
    g.dealDamage(fog, 999, g.player, 'hploss');
    g.checkEnd();
    expect(g.result).toBe('win');
  });

  it('缠绞蛇的勒紧在回合结束时扣血，它死后解除', () => {
    const { g, e } = setup(['slithering_strangler']);
    g.player.block = 0;
    pass(g); // 勒紧 3
    expect(g.pw(g.player, 'constrict')).toBe(3);
    const hp = g.player.hp;
    g.endTurn();
    expect(g.player.hp).toBe(hp - 3);
    g.runEnemyPhase();
    g.dealDamage(e, 999, g.player, 'hploss');
    expect(g.has(g.player, 'constrict')).toBe(false);
  });

  it('外骨骼虫每次至多失去 9 点生命', () => {
    const { g, e } = setup(['exoskeleton']);
    e.hp = e.maxHp = 50;
    g.attack(e, 30);
    expect(e.hp).toBe(41);
  });

  it('潜行群落每回合至多失去 20 点生命，下回合重置', () => {
    const { g, e } = setup(['skulking_colony']);
    g.attack(e, 15);
    g.attack(e, 15);
    expect(e.hp).toBe(e.maxHp - 20);
    g.player.hp = g.player.maxHp = 999;
    pass(g);
    e.block = 0;
    g.attack(e, 15);
    expect(e.hp).toBe(e.maxHp - 35);
  });

  it('石碗虫的头槌被完全格挡后会晕头转向', () => {
    const { g, e } = setup(['bowlbug_rock']);
    g.endTurn();
    g.player.block = 50;
    g.runEnemyPhase();
    expect(e.move).toBe('dizzy');
  });

  it('拉格夫林女族长被打醒后眩晕一回合，灵魂虹吸削减力量和敏捷', () => {
    const { g, e } = setup(['lagavulin_matriarch']);
    expect(e.move).toBe('sleep');
    g.attack(e, 20);
    expect(e.move).toBe('stir');
    g.player.hp = g.player.maxHp = 999;
    for (let i = 0; i < 5; i++) pass(g);
    expect(e.history).toContain('siphon');
    expect(g.pw(g.player, 'strength')).toBe(-2);
    expect(g.pw(g.player, 'dexterity')).toBe(-2);
  });

  it('瀑布巨人的高压水枪造成等于蒸汽层数的伤害', () => {
    const { g, e } = setup(['waterfall_giant']);
    g.player.hp = g.player.maxHp = 999;
    for (let i = 0; i < 4; i++) pass(g);
    expect(e.move).toBe('gun');
    const steam = g.pw(e, 'steam');
    expect(steam).toBeGreaterThan(10);
    expect(g.intentDamage(e)!.dmg).toBe(steam);
  });

  it('永恒沙漏：你每打出 6 张牌，手里多一张凋零', () => {
    const { g } = setup(['aeonglass']);
    for (let i = 0; i < 6; i++) {
      const c = makeCard('defend_r');
      g.hand.push(c);
      g.playCard(c, null);
    }
    expect(g.hand.map((c) => c.id)).toContain('withered');
  });

  it('枭法官飞翔时受到的攻击伤害减半', () => {
    const { g, e } = setup(['owl_magistrate']);
    g.apply(e, 'soar', 1, e);
    g.attack(e, 20);
    expect(e.hp).toBe(e.maxHp - 10);
  });

  it('恐惧鳗半血后先被震晕，然后施加 99 层易伤', () => {
    const { g, e } = setup(['terror_eel']);
    g.player.hp = g.player.maxHp = 999;
    g.dealDamage(e, 80, g.player, 'hploss');
    pass(g);
    expect(e.move).toBe('stunned');
    pass(g);
    pass(g);
    expect(g.pw(g.player, 'vulnerable')).toBeGreaterThan(90);
  });

  it('地精佣兵偷走的金币在击败它后夺回', () => {
    const { g, run, e } = setup(['gremlin_merc']);
    run.gold = 100;
    pass(g);
    expect(run.gold).toBeLessThan(100);
    g.dealDamage(e, 999, g.player, 'hploss');
    g.checkEnd();
    expect(g.bonusGold).toBe(100 - run.gold);
  });
});

describe('怪物图鉴', () => {
  it('每个敌人都归入至少一个区域，召唤物标明召唤者', async () => {
    const { bestiary } = await import('../src/game/bestiary');
    const list = bestiary();
    expect(list.length).toBe(Object.keys(ENEMIES).length);
    for (const e of list) {
      expect(e.regions.length, e.def.id).toBeGreaterThan(0);
      expect(e.moves.length, e.def.id).toBeGreaterThan(0);
      if (e.rank === 'summon') expect(e.summoner, e.def.id).toBeTruthy();
    }
    const get = (id: string) => list.find((x) => x.def.id === id)!;
    expect(get('gemini_pro').regions).toEqual(['claude']);
    expect(get('cubex_construct').regions.sort()).toEqual(['glory', 'overgrowth']);
    expect(get('phrog_parasite').rank).toBe('elite');
    expect(get('kin_follower').rank).toBe('follower');
    expect(get('eye_with_teeth').summoner).toBe('雾菇怪');
    expect(get('slithering_strangler').powers.map((p) => p.id)).toContain('constrictor');
    expect(get('axe_raider').regions).toEqual(['overgrowth']);
  });
});

describe('平衡调整', () => {
  it('腐尸蛞蝓在同伴死后先花一回合吞食残骸，再获得力量', () => {
    const { g } = setup(['corpse_slug', 'corpse_slug']);
    const [a, b] = g.enemies;
    g.dealDamage(a, 999, g.player, 'hploss');
    expect(b.move).toBe('devour');
    expect(g.pw(b, 'strength')).toBe(0);
    pass(g);
    expect(g.pw(b, 'strength')).toBe(4);
    expect(b.move).not.toBe('devour');
  });

  it('仪式在施加的那个回合不生效', () => {
    const { g, e } = setup(['calcified_cultist']);
    pass(g);
    expect(g.pw(e, 'strength')).toBe(0);
    pass(g);
    expect(g.pw(e, 'strength')).toBe(2);
  });

  it('藤缠让本回合的攻击牌费用 +1', () => {
    const { g } = setup(['vine_shambler']);
    g.apply(g.player, 'tangled', 1);
    expect(g.costOf(makeCard('strike_r'))).toBe(2);
    expect(g.costOf(makeCard('defend_r'))).toBe(1);
  });
});
