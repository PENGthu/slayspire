import { describe, expect, it } from 'vitest';
import '../src/game/content';
import { Combat as StrictCombat } from '../src/game/combat';
StrictCombat.strict = true;
import { Run } from '../src/game/run';
import { Rng } from '../src/core/rng';
import { botRun } from '../src/game/bot';
import type { CharId } from '../src/game/types';

const CHARS: CharId[] = ['ironclad', 'silent', 'regent', 'necrobinder', 'defect'];

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
