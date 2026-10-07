// 枚举当前决定的合法走法（随机测试与 AI 使用）。选牌类决定只给出有代表性的若干组合。
import { card, sponsor } from './content';
import { decision } from './engine';
import { animalOptions, assocMoves, buildableTypes, canSnap, harborActive, isSmall, placements, range, sponsorError, sponsorLevel } from './query';
import { cardsDraw } from './rules';
import type { GameState, Move, PlayerState } from './types';
import { ACTIONS } from './types';

function actionMoves(p: PlayerState, only: string | null, except: string | null): Move[] {
  const out: Move[] = [];
  for (const a of ACTIONS) {
    if (only && a !== only) continue;
    if (except && a === except) continue;
    for (let x = 0; x <= p.x; x++) {
      out.push({ t: 'action', action: a, x });
      if (p.tokens[a]?.mult) out.push({ t: 'action', action: a, x, mult: true });
    }
  }
  return out;
}

/** 某张赞助卡所有可以打出的方式（含专属建筑的位置） */
export function sponsorMoves(g: GameState, pi: number, f: { up: boolean; budget: number } | null, id: string, from: number): Move[] {
  const p = g.players[pi];
  const c = sponsor(id);
  if (c.building) {
    const spots = placements(p, id);
    if (!spots.length || sponsorError(g, pi, f, id, from, spots[0]) !== null) return [];
    return spots.map((cells) => ({ t: 'sponsor', card: id, from, cells }) as Move);
  }
  return sponsorError(g, pi, f, id, from) === null ? [{ t: 'sponsor', card: id, from }] : [];
}

export function legalMoves(g: GameState, rnd: () => number = Math.random): Move[] {
  const f = decision(g);
  if (!f) return [];
  const p = g.players[f.p];
  const out: Move[] = [];
  switch (f.k) {
    case 'turn':
      out.push(...actionMoves(p, null, null));
      for (const a of ACTIONS) out.push({ t: 'xaction', action: a });
      if (f.p === g.current && harborActive(p) && p.harborTurn !== g.turn && p.hand.length) out.push({ t: 'harbor', card: p.hand[0] });
      break;
    case 'extra':
      out.push(...actionMoves(p, f.only, f.except));
      out.push({ t: 'done' });
      break;
    case 'build':
      for (const t of buildableTypes(p, f)) for (const cells of placements(p, t)) out.push({ t: 'build', type: t, cells });
      out.push({ t: 'done' });
      break;
    case 'animals':
      if (f.left > 0) for (const o of animalOptions(g, f.p, f.up, f.onlySmall)) out.push({ t: 'animal', card: o.card, from: o.from, building: o.building });
      out.push({ t: 'done' });
      break;
    case 'cards': {
      const { draw } = cardsDraw(f.str, f.up);
      const r = Math.min(range(p), g.display.length);
      out.push({ t: 'draw', display: [] });
      if (f.up) for (let i = 0; i < r; i++) out.push({ t: 'draw', display: [i] });
      if (f.up && draw >= 2) for (let i = 0; i < r; i++) for (let j = i + 1; j < r; j++) out.push({ t: 'draw', display: [i, j] });
      if (canSnap(f.str, f.up)) for (let i = 0; i < r; i++) out.push({ t: 'snap', slot: i });
      break;
    }
    case 'assoc':
      out.push(...assocMoves(g, f.p, f));
      out.push({ t: 'done' });
      break;
    case 'sponsors': {
      const sources: [string, number][] = p.hand.map((id) => [id, -1]);
      if (f.up) g.display.forEach((id, i) => i < range(p) && sources.push([id, i]));
      for (const [id, from] of sources) if (card(id).kind === 'sponsor') out.push(...sponsorMoves(g, f.p, f, id, from));
      if (f.played === 0) out.push({ t: 'sponsorMoney' });
      out.push({ t: 'done' });
      break;
    }
    case 'sponsorPay':
      for (const id of p.hand) {
        const c = card(id);
        if (c.kind !== 'sponsor' || sponsorLevel(p, c) > p.money) continue;
        out.push(...sponsorMoves(g, f.p, null, id, -1));
      }
      out.push({ t: 'done' });
      break;
    case 'pick': {
      const pool = f.cards.length ? f.cards : p.hand;
      const eligible = f.purpose === 'keepAnimal' ? pool.filter((id) => card(id).kind === 'animal') : pool;
      const min = Math.min(f.min, eligible.length);
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
      for (const t of f.types) for (const cells of placements(p, t, { ignoreTypeUpgrade: f.ignoreUpgrade })) out.push({ t: 'build', type: t, cells });
      out.push({ t: 'done' });
      break;
    case 'display':
      g.display.forEach((id, i) => {
        if (!f.any && i >= range(p)) return;
        const c = card(id);
        if (f.filter === 'sponsor' && c.kind !== 'sponsor') return;
        if (f.filter === 'small' && !(c.kind === 'animal' && isSmall(c))) return;
        out.push({ t: 'take', slot: i });
      });
      if (f.deck && (g.deck.length || g.discard.length)) out.push({ t: 'take', slot: -1 });
      out.push({ t: 'done' });
      break;
    case 'dig':
      g.display.forEach((_, i) => out.push({ t: 'take', slot: i }));
      for (const id of p.hand) out.push({ t: 'cards', cards: [id] });
      out.push({ t: 'done' });
      break;
  }
  return out;
}
