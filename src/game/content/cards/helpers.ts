import { cardBlk, cardDef, cardDmg, cardMag, cardMag2 } from '../../cards';
import type { Combat } from '../../combat';
import type { Card, Enemy } from '../../types';

export const D = (g: Combat, c: Card) => cardDmg(g, c);
export const B = (g: Combat, c: Card) => cardBlk(g, c);
export const M = (c: Card) => cardMag(c);
export const N = (c: Card) => cardMag2(c);

/** 对目标造成卡牌伤害 hits 次 */
export function hit(g: Combat, c: Card, t: Enemy | null, hits = 1) {
  let killed = false;
  for (let i = 0; i < hits; i++) {
    if (!t || t.dead) break;
    killed = g.attack(t, D(g, c), c).killed || killed;
  }
  return killed;
}

export function hitAll(g: Combat, c: Card, hits = 1) {
  for (let i = 0; i < hits; i++) g.attackAll(D(g, c), c);
}

export function hitRandom(g: Combat, c: Card, hits = 1) {
  for (let i = 0; i < hits; i++) {
    const e = g.randomEnemy();
    if (!e) break;
    g.attack(e, D(g, c), c);
  }
}

export const isType = (c: Card, t: string) => cardDef(c).type === t;
