import { describe, expect, it } from 'vitest';
import '../src/game/content';
import { Combat as StrictCombat } from '../src/game/combat';
StrictCombat.strict = true;
import { Run } from '../src/game/run';
import { Rng } from '../src/core/rng';
import { botRun } from '../src/game/bot';
import { ENCOUNTERS } from '../src/game/registry';
import type { CharId } from '../src/game/types';

const CHARS: CharId[] = ['ironclad', 'silent', 'regent', 'necrobinder', 'defect', 'claude'];

describe('完整流程模拟（无敌模式遍历全部内容）', () => {
  for (const ch of CHARS) {
    it(`${ch}：10 局完整通关不报错`, () => {
      for (let seed = 1; seed <= 10; seed++) {
        const run = Run.create(ch, seed * 7919, seed % 9);
        const res = botRun(run, new Rng(seed), { godMode: true, smart: true });
        expect(res.win, `种子 ${seed} 未能通关：楼层 ${res.floor}`).toBe(true);
        expect(run.act).toBe(3);
      }
    });
  }
});

describe('存档与读档', () => {
  it('任意时刻存档后读档，状态一致且可以继续游戏', () => {
    for (const ch of CHARS) {
      const run = Run.create(ch, 1234);
      const rng = new Rng(5);
      // 走几步后存档
      let snapshots = 0;
      for (let i = 0; i < 40 && run.screen.s !== 'gameover'; i++) {
        const json = JSON.stringify(run.toJSON());
        const loaded = Run.fromJSON(JSON.parse(json));
        expect(loaded.screen.s).toBe(run.screen.s);
        expect(loaded.deck.length).toBe(run.deck.length);
        expect(loaded.hp).toBe(run.hp);
        snapshots++;
        // 用读档后的副本继续一小段
        try {
          botRun(loaded, new Rng(i), { godMode: true, maxSteps: 3 });
        } catch {
          // 走不完很正常
        }
        try {
          botRun(run, rng, { godMode: true, maxSteps: 1 });
        } catch {
          // 继续
        }
      }
      expect(snapshots).toBeGreaterThan(5);
    }
  });
});

describe('普通模式机器人（平衡性冒烟测试）', () => {
  it('聪明机器人能打到第一幕中后段', () => {
    const floors: number[] = [];
    for (const ch of CHARS) {
      for (let seed = 1; seed <= 5; seed++) {
        const run = Run.create(ch, seed * 31);
        const res = botRun(run, new Rng(seed), { smart: true });
        floors.push(res.floor);
      }
    }
    const avg = floors.reduce((a, b) => a + b, 0) / floors.length;
    console.log('平均到达楼层', avg.toFixed(1), floors.join(','));
    expect(avg).toBeGreaterThan(4);
  });
});

describe('旧存档兼容', () => {
  /** 站在本幕地图最上面一行的存档 */
  function atTopRow(zone: 'underdocks' | 'overgrowth' = 'underdocks') {
    const run = Run.create('regent', 77);
    run.act = 1;
    run.zone = zone;
    const n = run.map.rows[14].find((x) => x)!;
    run.pos = { row: 14, col: n.col };
    run.path.push([14, n.col]);
    run.floor = 15;
    run.screen = { s: 'map' };
    return run;
  }

  it('首领已被删除（换阵容前开的局）：读档时换成本区域现有的首领，点击可以开战', () => {
    const json = atTopRow().toJSON();
    json.boss = 'u1_shark';
    const run = Run.fromJSON(json);
    expect(ENCOUNTERS[run.boss]).toBeDefined();
    expect(ENCOUNTERS[run.boss].zone).toBe('underdocks');
    expect(run.bossReachable).toBe(true);
    run.enterBoss();
    expect(run.screen.s).toBe('combat');
    expect(run.combat?.boss).toBe(true);
  });

  it('旧版本进首领房间失败后卡住的存档（位置在首领那一行、仍在地图上）：退回最上面一行', () => {
    const json = atTopRow().toJSON();
    json.boss = 'a3_doormaker';
    json.pos = { row: 15, col: 3 };
    json.floor = 16;
    const run = Run.fromJSON(json);
    expect(run.pos?.row).toBe(14);
    expect(run.floor).toBe(15);
    expect(run.bossReachable).toBe(true);
    run.enterBoss();
    expect(run.screen.s).toBe('combat');
  });

  it('即使首领无效，进入首领房间也不会把进度卡住', () => {
    const run = atTopRow();
    run.boss = 'u1_siren';
    run.enterBoss();
    expect(run.screen.s).toBe('combat');
    expect(run.pos?.row).toBe(15);
  });

  it('存档中的战斗里有已删除的敌人：读档后换成有效的遭遇', () => {
    const run = atTopRow();
    run.startCombat(ENCOUNTERS[Object.keys(ENCOUNTERS).find((k) => k.startsWith('u1_') && ENCOUNTERS[k].kind === 'weak')!], 'monster');
    const json = run.toJSON() as Record<string, unknown> & { screen: { enemies: string[] } };
    json.screen.enemies = ['old_removed_enemy'];
    const loaded = Run.fromJSON(json);
    expect(loaded.combat).toBeTruthy();
    expect(loaded.combat!.enemies.length).toBeGreaterThan(0);
  });

  it('已删除的卡牌、遗物、药水在读档时移除', () => {
    const json = atTopRow().toJSON() as Record<string, unknown> & { deck: Record<string, unknown>[]; relics: Record<string, unknown>[]; potions: (string | null)[] };
    json.deck = [...json.deck, { ...json.deck[0], id: 'removed_card', uid: 99999 }];
    json.relics = [...json.relics, { id: 'removed_relic', counter: 0 }];
    json.potions = ['removed_potion', null, null];
    const run = Run.fromJSON(json);
    expect(run.deck.some((c) => c.id === 'removed_card')).toBe(false);
    expect(run.relics.some((r) => r.id === 'removed_relic')).toBe(false);
    expect(run.potions[0]).toBeNull();
  });
});
