// 把当前的决定翻译成界面上的可交互元素：哪些手牌能点、地图上哪里能放、协会版图上哪些档位能选。
import { BUILDINGS, buildingDef } from '../game/buildings';
import { card, project, sponsor } from '../game/content';
import { decision } from '../game/engine';
import { orientations } from '../game/hex';
import { placeShape } from '../game/maps';
import {
  animalError,
  assocMoves,
  buildCost,
  buildableTypes,
  canSnap,
  mapOf,
  placementError,
  range,
  releaseCandidates,
  sponsorError,
  sponsorLevel,
  supportError,
} from '../game/query';
import { cardsDraw } from '../game/rules';
import type { Frame, GameState, Move } from '../game/types';
import { act, me, refresh, state, toast } from './store';

export type Decision = NonNullable<ReturnType<typeof decision>>;

export function myDecision(g: GameState): Decision | null {
  const f = decision(g);
  if (!f || g.players[f.p].ai || state.cover !== null) return null;
  if (state.net && f.p !== state.net.seat) return null;
  if (f.p !== me()) return null;
  return f;
}

/** 当前正在放置的建筑类型（建造、免费放置、赞助卡专属建筑） */
export function placingType(g: GameState): string | null {
  const f = myDecision(g);
  if (!f) return null;
  if (f.k === 'build' || f.k === 'place') return state.sel.build;
  if ((f.k === 'sponsors' || f.k === 'sponsorPay') && state.sel.card && sponsor(state.sel.card).building) return state.sel.card;
  return null;
}

export function shapeFor(type: string, orient: number) {
  const os = orientations(BUILDINGS[type].shape);
  return os[((orient % os.length) + os.length) % os.length];
}

export function placementCheck(g: GameState, type: string, cells: number[] | null): string | null {
  const f = myDecision(g);
  if (!f || !cells) return '超出地图';
  const p = g.players[f.p];
  if (f.k === 'build') {
    if (!buildableTypes(p, f).includes(type)) return p.money < buildCost(type) ? '钱不够' : '现在不能建造这种建筑';
    return placementError(p, type, cells);
  }
  if (f.k === 'place') return placementError(p, type, cells, { ignoreTypeUpgrade: f.ignoreUpgrade });
  if (f.k === 'sponsors') return sponsorError(g, f.p, f, type, state.sel.cardFrom, cells);
  if (f.k === 'sponsorPay') return sponsorError(g, f.p, null, type, -1, cells);
  return '现在不能放置建筑';
}

export function ghostCells(g: GameState): { cells: number[]; ok: boolean; err: string | null } | null {
  const type = placingType(g);
  const f = myDecision(g);
  if (!type || !f || state.sel.anchor === null) return null;
  const p = g.players[f.p];
  const cells = placeShape(mapOf(p), shapeFor(type, state.sel.orient), state.sel.anchor);
  const err = placementCheck(g, type, cells);
  return { cells: cells ?? [state.sel.anchor], ok: err === null, err };
}

export function validAnchors(g: GameState): Set<number> {
  const type = placingType(g);
  const f = myDecision(g);
  const out = new Set<number>();
  if (!type || !f) return out;
  const p = g.players[f.p];
  const map = mapOf(p);
  const shape = shapeFor(type, state.sel.orient);
  for (const c of map.cells) {
    const cells = placeShape(map, shape, c.i);
    if (cells && placementCheck(g, type, cells) === null) out.add(c.i);
  }
  return out;
}

/** 当前朝向放不下时，自动找一个能放的朝向 */
export function anyOrientationFits(g: GameState, type: string): boolean {
  const f = myDecision(g);
  if (!f) return false;
  const p = g.players[f.p];
  const map = mapOf(p);
  const os = orientations(BUILDINGS[type].shape);
  for (let o = 0; o < os.length; o++) {
    for (const c of map.cells) {
      const cells = placeShape(map, os[o], c.i);
      if (cells && placementCheck(g, type, cells) === null) return true;
    }
  }
  return false;
}

export function selectBuild(type: string | null) {
  const g = state.g!;
  state.sel.build = type;
  state.sel.anchor = null;
  if (type) {
    // 选一个当前能放下的朝向
    const os = orientations(BUILDINGS[type].shape);
    const f = myDecision(g)!;
    const map = mapOf(g.players[f.p]);
    let found = false;
    for (let o = 0; o < os.length && !found; o++) {
      for (const c of map.cells) {
        const cells = placeShape(map, os[o], c.i);
        if (cells && placementCheck(g, type, cells) === null) {
          state.sel.orient = o;
          found = true;
          break;
        }
      }
    }
    if (!found) state.sel.orient = 0;
  }
  refresh();
}

export function rotate() {
  state.sel.orient++;
  refresh();
}

export function onMapHover(i: number | null) {
  if (!placingType(state.g!)) return;
  if (matchMedia('(hover: none)').matches) return;
  if (state.sel.anchor === i) return;
  state.sel.anchor = i;
  refresh();
}

export function onMapCell(i: number) {
  const g = state.g!;
  const type = placingType(g);
  if (!type) return;
  const f = myDecision(g)!;
  const touch = matchMedia('(hover: none)').matches;
  if (touch && state.sel.anchor !== i) {
    state.sel.anchor = i;
    refresh();
    return;
  }
  const p = g.players[f.p];
  const cells = placeShape(mapOf(p), shapeFor(type, state.sel.orient), state.sel.anchor ?? i);
  const err = placementCheck(g, type, cells);
  if (err || !cells) {
    toast(err ?? '放不下', 'error');
    return;
  }
  confirmPlacement(cells);
}

export function confirmPlacement(cells: number[]) {
  const g = state.g!;
  const f = myDecision(g)!;
  const type = placingType(g)!;
  if (f.k === 'sponsors' || f.k === 'sponsorPay') act({ t: 'sponsor', card: type, from: f.k === 'sponsorPay' ? -1 : state.sel.cardFrom, cells });
  else act({ t: 'build', type, cells });
}

// ———————————————————————————————————————————— 打出动物

export function animalTargets(g: GameState): Set<number> {
  const f = myDecision(g);
  const out = new Set<number>();
  if (!f || f.k !== 'animals' || !state.sel.card) return out;
  for (const b of g.players[f.p].buildings) {
    if (animalError(g, f.p, state.sel.card, state.sel.cardFrom, b.uid, f.up, f.onlySmall) === null) out.add(b.uid);
  }
  return out;
}

export function animalPlayable(g: GameState, f: Extract<Frame, { k: 'animals' }>, id: string, from: number): string | null {
  if (f.left <= 0) return '本次行动不能再打出动物';
  const p = g.players[f.p];
  let last = '没有能放下它的建筑';
  for (const b of p.buildings) {
    const err = animalError(g, f.p, id, from, b.uid, f.up, f.onlySmall);
    if (err === null) return null;
    if (err !== '无法放进这座建筑') last = err;
  }
  return last;
}

export function clickAnimal(id: string, from: number) {
  const g = state.g!;
  const f = myDecision(g);
  if (!f || f.k !== 'animals') return;
  const err = animalPlayable(g, f, id, from);
  if (err) {
    toast(err, 'error');
    return;
  }
  if (state.sel.card === id && state.sel.cardFrom === from) {
    state.sel.card = null;
    refresh();
    return;
  }
  state.sel.card = id;
  state.sel.cardFrom = from;
  const targets = animalTargets(g);
  if (targets.size === 1) {
    act({ t: 'animal', card: id, from, building: [...targets][0] });
    return;
  }
  state.mobileTab = 'zoo';
  refresh();
}

export function placeAnimal(uid: number) {
  const g = state.g!;
  const f = myDecision(g);
  if (!f || f.k !== 'animals' || !state.sel.card) return;
  act({ t: 'animal', card: state.sel.card, from: state.sel.cardFrom, building: uid });
}

// ———————————————————————————————————————————— 赞助

export function sponsorPlayable(g: GameState, f: Extract<Frame, { k: 'sponsors' | 'sponsorPay' }>, id: string, from: number): string | null {
  const c = sponsor(id);
  const fr = f.k === 'sponsors' ? f : null;
  if (f.k === 'sponsorPay') {
    if (from !== -1) return '只能从手牌打出';
    if (sponsorLevel(g.players[f.p], c) > g.players[f.p].money) return '钱不够';
  }
  if (c.building) {
    const p = g.players[f.p];
    const map = mapOf(p);
    for (const shape of orientations(c.building.shape)) {
      for (const cell of map.cells) {
        const cells = placeShape(map, shape, cell.i);
        if (cells && sponsorError(g, f.p, fr, id, from, cells) === null) return null;
      }
    }
    const err = sponsorError(g, f.p, fr, id, from, []);
    return err === '形状不对' || err === '需要选择建筑位置' ? '没有地方放它的专属建筑' : err;
  }
  return sponsorError(g, f.p, fr, id, from);
}

export function clickSponsor(id: string, from: number) {
  const g = state.g!;
  const f = myDecision(g);
  if (!f || (f.k !== 'sponsors' && f.k !== 'sponsorPay')) return;
  const fr = f.k === 'sponsors' ? f : null;
  const err = sponsorPlayable(g, f, id, from);
  if (err) {
    toast(err, 'error');
    return;
  }
  if (sponsor(id).building) {
    state.sel.card = id;
    state.sel.cardFrom = from;
    state.sel.anchor = null;
    state.sel.orient = 0;
    // 找一个能放的朝向
    const p = g.players[f.p];
    const map = mapOf(p);
    const os = orientations(BUILDINGS[id].shape);
    outer: for (let o = 0; o < os.length; o++) {
      for (const c of map.cells) {
        const cells = placeShape(map, os[o], c.i);
        if (cells && sponsorError(g, f.p, fr, id, from, cells) === null) {
          state.sel.orient = o;
          break outer;
        }
      }
    }
    state.mobileTab = 'zoo';
    toast(`在地图上放置「${sponsor(id).name}」`, 'info');
    refresh();
    return;
  }
  act({ t: 'sponsor', card: id, from });
}

/** 当前是否在为赞助卡（专属建筑）选位置 */
export function sponsorPlacing(g: GameState): boolean {
  const f = myDecision(g);
  return !!f && (f.k === 'sponsors' || f.k === 'sponsorPay') && !!state.sel.card && !!sponsor(state.sel.card).building;
}

// ———————————————————————————————————————————— 协会

export function assocOptions(g: GameState): Move[] {
  const f = myDecision(g);
  if (!f || f.k !== 'assoc') return [];
  return assocMoves(g, f.p, f);
}

export function projectLevelMoves(g: GameState, id: string, level: number, fromHand: boolean, display?: number): Move[] {
  return assocOptions(g).filter(
    (m) => m.t === 'assoc' && m.task === 'project' && m.project === id && m.level === level && m.fromHand === fromHand && m.display === display,
  );
}

export function clickProjectLevel(id: string, level: number, fromHand: boolean, display?: number) {
  const g = state.g!;
  const moves = projectLevelMoves(g, id, level, fromHand, display);
  if (!moves.length) {
    const f = myDecision(g);
    if (f && f.k === 'assoc') {
      const c = project(id);
      const err =
        c.goal.k === 'release'
          ? releaseCandidates(g.players[f.p], c, level).length
            ? null
            : '没有符合条件的动物'
          : supportError(g, f.p, id, level, fromHand, undefined, display, f.up);
      toast(err ?? '现在不能支持这个项目', 'error');
    }
    return;
  }
  if (project(id).goal.k === 'release' && moves.length > 1) {
    state.modal = { k: 'release', id, level, fromHand, display };
    refresh();
    return;
  }
  act(moves[0]);
}

// ———————————————————————————————————————————— 卡牌行动 / 展示区

export function cardsInfo(g: GameState) {
  const f = myDecision(g);
  if (!f || f.k !== 'cards') return null;
  const p = g.players[f.p];
  const { draw, discard } = cardsDraw(f.str, f.up);
  return { draw, discard, up: f.up, snap: canSnap(f.str, f.up), range: Math.min(range(p), g.display.length) };
}

export function toggleDisplayPick(slot: number) {
  const info = cardsInfo(state.g!);
  if (!info || !info.up) return;
  const s = state.sel.displayPicks;
  if (s.includes(slot)) state.sel.displayPicks = s.filter((x) => x !== slot);
  else if (s.length < info.draw) state.sel.displayPicks = [...s, slot];
  else toast(`最多从展示区拿 ${info.draw} 张`, 'error');
  refresh();
}

export function buildingLabel(type: string): string {
  return buildingDef(type).name;
}

export { card };
