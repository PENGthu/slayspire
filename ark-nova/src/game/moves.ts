// 枚举当前决定的合法走法（随机测试与 AI 使用）。选牌类决定只给出有代表性的若干组合。
import { card, sponsor } from './content';
import { decision } from './engine';
import {
  animalOptions,
  assocMoves,
  buildableTypes,
  canIgnoreCondition,
  canSnap,
  placements,
  range,
  sponsorError,
} from './query';
import { cardsDraw } from './rules';
import type { GameState, Move } from './types';
import { ACTIONS } from './types';

export function legalMoves(g: GameState, rnd: () => number = Math.random): Move[] {
  const f = decision(g);
  if (!f) return [];
  const p = g.players[f.p];
  const out: Move[] = [];
  switch (f.k) {
    case 'turn':
      for (const a of ACTIONS) {
        for (let x = 0; x <= p.x; x++) out.push({ t: 'action', action: a, x });
        out.push({ t: 'xaction', action: a });
      }
      break;
    case 'build':
      for (const t of buildableTypes(p, f)) for (const cells of placements(p, t)) out.push({ t: 'build', type: t, cells });
      out.push({ t: 'done' });
      break;
    case 'animals':
      if (f.left > 0) for (const o of animalOptions(g, f.p, f.up, canIgnoreCondition(f))) out.push({ t: 'animal', card: o.card, from: o.from, building: o.building });
      out.push({ t: 'done' });
      break;
    case 'cards': {
      const { draw } = cardsDraw(f.str, f.up);
      const r = Math.min(range(p), g.display.length);
      out.push({ t: 'draw', display: [] });
      if (f.up) for (let i = 0; i < r; i++) out.push({ t: 'draw', display: [i] });
      if (f.up && draw >= 2) for (let i = 0; i < r; i++) for (let j = i + 1; j < r; j++) out.push({ t: 'draw', display: [i, j] });
      if (canSnap(p, f.str, f.up)) for (let i = 0; i < r; i++) out.push({ t: 'snap', slot: i });
      break;
    }
    case 'assoc':
      out.push(...assocMoves(g, f.p, f));
      out.push({ t: 'done' });
      break;
    case 'sponsors': {
      const sources: [string, number][] = p.hand.map((id) => [id, -1]);
      if (f.up) g.display.forEach((id, i) => i < range(p) && sources.push([id, i]));
      for (const [id, from] of sources) {
        const c = card(id);
        if (c.kind !== 'sponsor') continue;
        if (c.building) {
          if (sponsorError(g, f.p, f, id, from, placements(p, id)[0] ?? []) !== null) continue;
          for (const cells of placements(p, id)) out.push({ t: 'sponsor', card: id, from, cells });
        } else if (sponsorError(g, f.p, f, id, from) === null) out.push({ t: 'sponsor', card: id, from });
      }
      if (f.played === 0) out.push({ t: 'sponsorMoney' });
      out.push({ t: 'done' });
      break;
    }
    case 'pick': {
      const pool = f.cards.length ? f.cards : p.hand;
      let eligible = pool;
      if (f.purpose === 'keepAnimal') eligible = pool.filter((id) => card(id).kind === 'animal');
      const min = Math.min(f.min, pool.length);
      const max = Math.min(f.max, eligible.length);
      for (let n = min; n <= max; n++) {
        for (let k = 0; k < 3; k++) {
          const s = [...eligible].sort(() => rnd() - 0.5).slice(0, n);
          out.push({ t: 'cards', cards: s });
        }
      }
      break;
    }
    case 'choose':
      f.opts.forEach((_, i) => out.push({ t: 'choose', i }));
      break;
    case 'place':
      for (const t of f.types) for (const cells of placements(p, t, { ignoreTypeUpgrade: true })) out.push({ t: 'build', type: t, cells });
      out.push({ t: 'done' });
      break;
    case 'display':
      g.display.forEach((_, i) => {
        if (f.any || i < range(p)) out.push({ t: 'take', slot: i });
      });
      out.push({ t: 'done' });
      break;
  }
  return out;
}

export { sponsor };
