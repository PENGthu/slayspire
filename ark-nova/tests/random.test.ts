import { describe, expect, it } from 'vitest';
import { apply, createGame, decision } from '../src/game/engine';
import { legalMoves } from '../src/game/moves';
import { Rng } from '../src/core/rng';
import { MAP_IDS } from '../src/game/maps';

function randomGame(seed: number, n: number) {
  const rng = new Rng(seed);
  const g = createGame({
    seed,
    players: Array.from({ length: n }, (_, i) => ({ name: `P${i}`, ai: null, map: MAP_IDS[(seed + i) % MAP_IDS.length] })),
  });
  let steps = 0;
  while (!g.over && steps < 20000) {
    const f = decision(g);
    expect(f).not.toBeNull();
    const moves = legalMoves(g, () => rng.next());
    expect(moves.length).toBeGreaterThan(0);
    // 偏向有实际效果的走法，避免一直结束行动
    const useful = moves.filter((m) => m.t !== 'done' && m.t !== 'xaction');
    const pool = useful.length && rng.chance(0.85) ? useful : moves;
    const m = rng.pick(pool);
    apply(g, m);
    steps++;
    for (const p of g.players) {
      expect(p.money).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(5);
      expect(p.workers).toBeLessThanOrEqual(4);
      expect(new Set(p.actions).size).toBe(5);
    }
  }
  return { g, steps };
}

describe('随机走法', () => {
  for (const n of [1, 2, 3, 4]) {
    it(`${n} 人对局可以走到结束`, () => {
      for (let s = 1; s <= 3; s++) {
        const { g } = randomGame(s * 31 + n, n);
        expect(g.over).toBe(true);
      }
    });
  }
});
