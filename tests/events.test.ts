import { describe, expect, it } from 'vitest';
import '../src/game/content';
import { Combat } from '../src/game/combat';
import { ANCIENTS, EVENTS } from '../src/game/registry';
import { Run } from '../src/game/run';
import { Rng } from '../src/core/rng';
import { botCombat, resolveSelection } from '../src/game/bot';

Combat.strict = true;

function freshRun(act: number, zone?: string): Run {
  const run = Run.create('silent', 4242);
  if (act > 1) run.startAct(act);
  if (zone) run.zone = zone;
  run.gold = 500;
  run.screen = { s: 'map' };
  return run;
}

describe('事件：每个选项都能正常执行', () => {
  for (const ev of Object.values(EVENTS)) {
    it(ev.id, () => {
      const act = ev.acts[0];
      const zone = ev.zones?.[0];
      const probe = freshRun(act, zone);
      probe.startEvent(ev.id);
      const n = probe.eventView()!.options.length;
      expect(n).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        const run = freshRun(act, zone);
        run.startEvent(ev.id);
        const rng = new Rng(i);
        // 沿着页面最多走 6 步
        for (let step = 0; step < 6 && run.screen.s === 'event'; step++) {
          const v = run.eventView()!;
          const opts = v.options.filter((o) => !o.disabled);
          const o = step === 0 ? v.options[i] : opts[0];
          if (!o || o.disabled) break;
          o.go();
          resolveSelection(run, rng);
        }
        if (run.screen.s === 'combat') {
          const g = run.combat!;
          g.player.hp = g.player.maxHp = 3000;
          botCombat(g, rng, { smart: true }, 150);
          if (!g.over) g.escape();
          run.finishCombat();
          expect(['reward', 'map', 'gameover']).toContain(run.screen.s);
        }
      }
    });
  }
});

describe('先古之民：每个祝福都能正常执行', () => {
  for (const anc of Object.values(ANCIENTS)) {
    it(anc.id, () => {
      for (const b of anc.blessings) {
        const run = freshRun(anc.acts[0]);
        if (b.cond && !b.cond(run)) continue;
        b.apply(run);
        resolveSelection(run, new Rng(1));
        expect(run.selection).toBeNull();
      }
    });
  }
});
