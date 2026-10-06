import { describe, expect, it } from 'vitest';
import '../src/game/content';
import { Combat } from '../src/game/combat';
import { POTIONS, RELICS } from '../src/game/registry';
import { Run } from '../src/game/run';
import { Rng } from '../src/core/rng';
import { botPlayerTurn, resolvePending, resolveSelection } from '../src/game/bot';
import type { CharId } from '../src/game/types';

Combat.strict = true;

const charFor = (c?: CharId): CharId => c ?? 'ironclad';

describe('遗物：拾取并在战斗中生效', () => {
  for (const r of Object.values(RELICS)) {
    it(r.id, () => {
      const run = Run.create(charFor(r.char), 77);
      run.screen = { s: 'map' };
      run.obtainRelic(r.id, true);
      resolveSelection(run, new Rng(1));
      const g = new Combat(run, ['nibbit', 'leaf_slime_s']);
      g.start();
      const rng = new Rng(2);
      for (let t = 0; t < 4 && !g.over; t++) {
        resolvePending(g, rng);
        botPlayerTurn(g, rng, { smart: true });
        g.runEnemyPhase();
        resolvePending(g, rng);
      }
      expect(g.errors).toEqual([]);
    });
  }
});

describe('药水：战斗中使用', () => {
  for (const p of Object.values(POTIONS)) {
    it(p.id, () => {
      const run = Run.create(charFor(p.char), 78);
      run.screen = { s: 'map' };
      const g = new Combat(run, ['nibbit', 'leaf_slime_s']);
      g.start();
      g.channel('lightning');
      run.potions[0] = p.id;
      if (p.onDeath) {
        g.player.hp = 1;
        g.enemyAttack(g.enemies[0], 50);
        expect(g.player.hp).toBeGreaterThan(0);
        expect(run.potions[0]).toBeNull();
        return;
      }
      g.usePotion(0, g.enemies[0]);
      resolvePending(g, new Rng(3));
      // 混沌佳酿会把空出来的栏位重新填满
      if (p.id !== 'entropic_brew') expect(run.potions[0]).toBeNull();
      expect(g.errors).toEqual([]);
    });
  }
  it('可在战斗外使用的药水', () => {
    for (const p of Object.values(POTIONS).filter((x) => x.outOfCombat)) {
      const run = Run.create(charFor(p.char), 79);
      run.potions[0] = p.id;
      run.usePotionOutside(0);
      expect(run.potions[0]).not.toBe(p.id);
    }
  });
});
