// 只读查询：图标统计、指标、费用、各类合法性检查，以及给 AI / 界面用的候选枚举。
import { BUILDINGS, BUILDABLE, buildingDef, enclosureSize, type BuildingDef } from './buildings';
import { animal, card, project, sponsor } from './content';
import { hexDistance, orientations, type Axial } from './hex';
import { getMap, placeShape, type ZooMap } from './maps';
import {
  BASE_HAND_LIMIT,
  BUILD_COST_PER_CELL,
  MAX_PARTNERS,
  TASK_VALUE,
  UNIVERSITIES,
  donationCost,
  repRange,
  snapStrength,
  university,
} from './rules';
import type {
  AnimalCard,
  AnimalFilter,
  Building,
  Category,
  Continent,
  Frame,
  GameState,
  Icon,
  Metric,
  Move,
  PlayerState,
  ProjectCard,
  Requirement,
  SponsorCard,
  TaskId,
} from './types';
import { CATEGORIES, CONTINENTS } from './types';

export function mapOf(p: PlayerState): ZooMap {
  return getMap(p.map);
}

// ———————————————————————————————————————————— 动物园内容

export function zooAnimals(p: PlayerState): { card: AnimalCard; b: Building }[] {
  const out: { card: AnimalCard; b: Building }[] = [];
  for (const b of p.buildings) for (const id of b.animals) out.push({ card: animal(id), b });
  return out;
}

export function iconCounts(p: PlayerState): Record<Icon, number> {
  const c = {} as Record<Icon, number>;
  for (const i of [...CONTINENTS, ...CATEGORIES, 'science'] as Icon[]) c[i] = 0;
  for (const b of p.buildings) {
    for (const id of b.animals) {
      const a = animal(id);
      for (const x of a.continents) c[x]++;
      for (const x of a.categories) c[x]++;
    }
  }
  for (const id of p.sponsors) for (const i of sponsor(id).icons) c[i]++;
  for (const cont of p.partners) c[cont]++;
  for (const u of p.unis) c.science += university(u).science;
  if (mapOf(p).ability.k === 'science') c.science++;
  return c;
}

export function iconCount(p: PlayerState, icon: Icon): number {
  return iconCounts(p)[icon];
}

export function matchesFilter(a: AnimalCard, f?: AnimalFilter): boolean {
  if (!f) return true;
  if (f.cat && !a.categories.includes(f.cat)) return false;
  if (f.cont && !a.continents.includes(f.cont)) return false;
  if (f.minSize !== undefined && a.size < f.minSize) return false;
  if (f.maxSize !== undefined && a.size > f.maxSize) return false;
  return true;
}

function adjacentTerrain(p: PlayerState, b: Building, terrain: 'water' | 'rock'): number {
  const map = mapOf(p);
  const seen = new Set<number>();
  for (const i of b.cells) for (const n of map.cells[i]!.nbrs) if (map.cells[n]!.terrain === terrain) seen.add(n);
  return seen.size;
}

export function buildingAdjacent(p: PlayerState, cells: number[], terrain: 'water' | 'rock'): number {
  return adjacentTerrain(p, { uid: 0, type: '', cells, animals: [] }, terrain);
}

export function metric(g: GameState, p: PlayerState, m: Metric): number {
  switch (m.m) {
    case 'icon':
      return iconCount(p, m.icon);
    case 'animals':
      return zooAnimals(p).filter((x) => matchesFilter(x.card, m.filter)).length;
    case 'kiosks':
      return p.buildings.filter((b) => b.type === 'kiosk').length;
    case 'pavilions':
      return p.buildings.filter((b) => b.type === 'pavilion').length;
    case 'partners':
      return p.partners.length;
    case 'universities':
      return p.unis.length;
    case 'partnersUnis':
      return p.partners.length + p.unis.length;
    case 'sponsors':
      return p.sponsors.length;
    case 'projects':
      return p.projects.length;
    case 'catKinds': {
      const c = iconCounts(p);
      return CATEGORIES.filter((x) => c[x] > 0).length;
    }
    case 'contKinds': {
      const c = iconCounts(p);
      return CONTINENTS.filter((x) => c[x] > 0).length;
    }
    case 'rep':
      return p.rep;
    case 'covered':
      return p.buildings.reduce((s, b) => s + b.cells.length, 0);
    case 'fullEnclosures':
      return p.buildings.filter((b) => buildingDef(b.type).kind === 'enclosure' && b.animals.length > 0).length;
    case 'waterAnimals':
      return p.buildings.filter((b) => b.animals.length && adjacentTerrain(p, b, 'water') > 0).reduce((s, b) => s + b.animals.length, 0);
    case 'rockAnimals':
      return p.buildings.filter((b) => b.animals.length && adjacentTerrain(p, b, 'rock') > 0).reduce((s, b) => s + b.animals.length, 0);
    case 'specialAnimals':
      return p.buildings.filter((b) => buildingDef(b.type).kind === 'special').reduce((s, b) => s + b.animals.length, 0);
    case 'upgrades':
      return Object.values(p.upgraded).filter(Boolean).length;
    case 'money':
      return p.money;
  }
  void g;
  return 0;
}

export function handLimit(p: PlayerState): number {
  let n = BASE_HAND_LIMIT;
  for (const u of p.unis) n += university(u).handLimit;
  for (const id of p.sponsors) for (const e of sponsor(id).effects ?? []) if (e.k === 'handLimit') n += e.n;
  return n;
}

export function range(p: PlayerState): number {
  let r = repRange(p.rep);
  for (const id of p.sponsors) for (const e of sponsor(id).effects ?? []) if (e.k === 'range') r += e.n;
  return Math.min(6, r);
}

export function actionSlot(p: PlayerState, a: string): number {
  return p.actions.indexOf(a as PlayerState['actions'][number]) + 1;
}

export function freeWorkers(g: GameState, pi: number): number {
  let used = 0;
  for (const t of Object.values(g.tasks)) used += t.filter((x) => x === pi).length;
  return g.players[pi].workers - used;
}

export function workersNeeded(g: GameState, task: TaskId): number {
  return g.tasks[task].length > 0 ? 2 : 1;
}

export function reqMet(p: PlayerState, reqs: Requirement[] | undefined): boolean {
  if (!reqs) return true;
  const icons = iconCounts(p);
  return reqs.every((r) => {
    switch (r.k) {
      case 'icon':
        return icons[r.icon] >= r.n;
      case 'rep':
        return p.rep >= r.n;
      case 'upgrade':
        return p.upgraded[r.action];
      case 'partner':
        return p.partners.includes(r.continent);
    }
    return true;
  });
}

// ———————————————————————————————————————————— 建造

export function coveredCells(p: PlayerState): Set<number> {
  const s = new Set<number>();
  for (const b of p.buildings) for (const c of b.cells) s.add(c);
  return s;
}

function shapeKey(cells: Axial[]): string {
  const minR = Math.min(...cells.map((c) => c[1]));
  const minQ = Math.min(...cells.filter((c) => c[1] === minR).map((c) => c[0]));
  return cells
    .map(([q, r]) => [q - minQ, r - minR])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0])
    .map((c) => c.join(','))
    .join(';');
}

const shapeKeys = new Map<string, Set<string>>();
function keysFor(def: BuildingDef): Set<string> {
  let s = shapeKeys.get(def.id);
  if (!s) {
    s = new Set(orientations(def.shape).map(shapeKey));
    shapeKeys.set(def.id, s);
  }
  return s;
}

export interface PlaceOpts {
  /** 免费放置时忽略建筑本身的升级要求（如霸主能力） */
  ignoreTypeUpgrade?: boolean;
}

/** 检查能否在这些格子上放置建筑（不含费用），返回错误原因或 null */
export function placementError(p: PlayerState, type: string, cells: number[], opts: PlaceOpts = {}): string | null {
  const def = BUILDINGS[type];
  if (!def) return '未知建筑';
  const map = mapOf(p);
  if (cells.length !== def.shape.length || new Set(cells).size !== cells.length) return '形状不对';
  const covered = coveredCells(p);
  for (const i of cells) {
    const c = map.cells[i];
    if (!c) return '超出地图';
    if (c.terrain !== 'land') return c.terrain === 'water' ? '不能建在水域上' : '不能建在岩石上';
    if (covered.has(i)) return '格子已被占用';
    if (c.upgrade && !p.upgraded.build) return '标有 II 的格子需要升级的建造行动';
  }
  if (!keysFor(def).has(shapeKey(cells.map((i) => [map.cells[i]!.q, map.cells[i]!.r])))) return '形状不对';
  if (def.needsUpgrade && !p.upgraded.build && !opts.ignoreTypeUpgrade) return `${def.name}需要升级的建造行动`;
  if (def.unique && p.buildings.some((b) => b.type === type)) return `每座动物园只能有一座${def.name}`;
  const touches = cells.some((i) => map.cells[i]!.border || map.cells[i]!.nbrs.some((n) => covered.has(n)));
  if (!touches) return '必须与地图边缘或已有建筑相邻';
  if (def.kind === 'kiosk') {
    for (const b of p.buildings) {
      if (b.type !== 'kiosk') continue;
      const a = map.cells[b.cells[0]]!;
      const c = map.cells[cells[0]]!;
      if (hexDistance([a.q, a.r], [c.q, c.r]) < 3) return '售货亭之间至少相隔 2 格';
    }
  }
  if (def.kind === 'sponsor') {
    const sp = sponsor(type);
    if (sp.building?.water && buildingAdjacent(p, cells, 'water') === 0) return '必须与水域相邻';
    if (sp.building?.rock && buildingAdjacent(p, cells, 'rock') === 0) return '必须与岩石相邻';
  }
  return null;
}

/** 列出某种建筑所有合法的放置位置 */
export function placements(p: PlayerState, type: string, opts: PlaceOpts = {}): number[][] {
  const def = BUILDINGS[type];
  if (!def) return [];
  if (def.unique && p.buildings.some((b) => b.type === type)) return [];
  if (def.needsUpgrade && !p.upgraded.build && !opts.ignoreTypeUpgrade) return [];
  const map = mapOf(p);
  const out: number[][] = [];
  const seen = new Set<string>();
  for (const o of orientations(def.shape)) {
    for (const c of map.list) {
      const cells = placeShape(map, c.i, o);
      if (!cells) continue;
      const k = [...cells].sort((a, b) => a - b).join(',');
      if (seen.has(k)) continue;
      if (placementError(p, type, cells, opts) === null) {
        seen.add(k);
        out.push(cells);
      }
    }
  }
  return out;
}

export function buildCost(type: string): number {
  return buildingDef(type).shape.length * BUILD_COST_PER_CELL;
}

/** 建造行动中当前可以选择的建筑类型 */
export function buildableTypes(p: PlayerState, f: Extract<Frame, { k: 'build' }>): string[] {
  return BUILDABLE.filter((t) => {
    const def = buildingDef(t);
    if (def.shape.length > f.budget) return false;
    if (f.up && f.built.includes(t)) return false;
    if (def.needsUpgrade && !f.up) return false;
    if (def.unique && p.buildings.some((b) => b.type === t)) return false;
    if (p.money < buildCost(t)) return false;
    return true;
  });
}

// ———————————————————————————————————————————— 动物

export function animalCost(g: GameState, p: PlayerState, a: AnimalCard, from: number): number {
  let cost = a.cost;
  if (a.continents.some((c) => p.partners.includes(c))) cost -= 3;
  for (const id of p.sponsors) {
    for (const e of sponsor(id).effects ?? []) if (e.k === 'discount' && matchesFilter(a, e.filter)) cost -= e.n;
  }
  const ab = mapOf(p).ability;
  if (ab.k === 'rockDiscount' && (a.rock ?? 0) > 0) cost -= ab.n;
  if (ab.k === 'waterDiscount' && (a.water ?? 0) > 0) cost -= ab.n;
  if (from >= 0) cost += from + 1;
  void g;
  return Math.max(0, cost);
}

/** 动物能否放进这座建筑（只看大小 / 容量） */
export function fitsSpace(a: AnimalCard, b: Building): boolean {
  const def = buildingDef(b.type);
  if (def.kind === 'enclosure') return a.size >= 1 && b.animals.length === 0 && enclosureSize(b.type) >= a.size;
  if (def.kind === 'special') {
    if (!a.special || a.special.kind !== def.special) return false;
    const used = b.animals.reduce((s, id) => s + (animal(id).special?.units ?? 1), 0);
    return used + a.special.units <= (def.capacity ?? 0);
  }
  return false;
}

/** 动物在这座建筑里不满足的条件（水域、岩石、卡上的要求） */
export function unmetConditions(p: PlayerState, a: AnimalCard, b: Building): string[] {
  const out: string[] = [];
  if ((a.water ?? 0) > adjacentTerrain(p, b, 'water')) out.push(`需要与 ${a.water} 格水域相邻`);
  if ((a.rock ?? 0) > adjacentTerrain(p, b, 'rock')) out.push(`需要与 ${a.rock} 格岩石相邻`);
  for (const r of a.req ?? []) if (!reqMet(p, [r])) out.push(reqLabel(r));
  return out;
}

function reqLabel(r: Requirement): string {
  switch (r.k) {
    case 'icon':
      return `需要 ${r.n} 个${iconName(r.icon)}图标`;
    case 'rep':
      return `需要声望 ${r.n}`;
    case 'upgrade':
      return '需要升级的行动卡';
    case 'partner':
      return `需要${continentName(r.continent)}合作动物园`;
  }
}

/** 动物能否放进这座建筑（含所有条件） */
export function fitsBuilding(p: PlayerState, a: AnimalCard, b: Building): boolean {
  return fitsSpace(a, b) && unmetConditions(p, a, b).length === 0;
}

/**
 * 打出动物的错误原因（null 表示可以）。
 * ignoreOne：动物行动 I 在可以打出 2 只时只打 1 只，可以忽略 1 个条件。
 */
export function animalError(g: GameState, pi: number, cardId: string, from: number, uid: number, up: boolean, ignoreOne = false): string | null {
  const p = g.players[pi];
  const c = card(cardId);
  if (c.kind !== 'animal') return '不是动物卡';
  if (from < 0) {
    if (!p.hand.includes(cardId)) return '不在手牌中';
  } else {
    if (!up) return '需要升级的动物行动才能从展示区打出';
    if (g.display[from] !== cardId) return '展示区没有这张牌';
    if (from >= range(p)) return '超出声望范围';
  }
  const b = p.buildings.find((x) => x.uid === uid);
  if (!b) return '没有这座建筑';
  if (!fitsSpace(c, b)) return '无法放进这座建筑';
  const unmet = unmetConditions(p, c, b);
  if (unmet.length > (ignoreOne ? 1 : 0)) return unmet[0];
  if (animalCost(g, p, c, from) > p.money) return '钱不够';
  return null;
}

export interface AnimalOption {
  card: string;
  from: number;
  building: number;
  cost: number;
  /** 忽略了 1 个条件 */
  ignore?: boolean;
}

/** 动物行动 I：本次可以打 2 只、还没打时，可以只打 1 只并忽略 1 个条件 */
export function canIgnoreCondition(f: Extract<Frame, { k: 'animals' }>): boolean {
  return !f.up && f.left >= 2 && f.played === 0;
}

export function animalOptions(g: GameState, pi: number, up: boolean, ignoreOne = false): AnimalOption[] {
  const p = g.players[pi];
  const out: AnimalOption[] = [];
  const sources: [string, number][] = p.hand.map((id) => [id, -1]);
  if (up) g.display.forEach((id, i) => i < range(p) && sources.push([id, i]));
  for (const [id, from] of sources) {
    const c = card(id);
    if (c.kind !== 'animal') continue;
    for (const b of p.buildings) {
      if (animalError(g, pi, id, from, b.uid, up) === null) out.push({ card: id, from, building: b.uid, cost: animalCost(g, p, c, from) });
      else if (ignoreOne && animalError(g, pi, id, from, b.uid, up, true) === null)
        out.push({ card: id, from, building: b.uid, cost: animalCost(g, p, c, from), ignore: true });
    }
  }
  return out;
}

// ———————————————————————————————————————————— 赞助

export function sponsorError(g: GameState, pi: number, f: Extract<Frame, { k: 'sponsors' }>, cardId: string, from: number, cells?: number[]): string | null {
  const p = g.players[pi];
  const c = card(cardId);
  if (c.kind !== 'sponsor') return '不是赞助卡';
  if (from < 0) {
    if (!p.hand.includes(cardId)) return '不在手牌中';
  } else {
    if (!f.up) return '需要升级的赞助行动才能从展示区打出';
    if (g.display[from] !== cardId) return '展示区没有这张牌';
    if (from >= range(p)) return '超出声望范围';
    if (p.money < from + 1) return '钱不够';
  }
  if (c.level > f.budget) return '等级超过行动强度';
  if (!reqMet(p, c.req)) return '未满足条件';
  if (c.building) {
    if (!cells) return '需要选择建筑位置';
    const err = placementError(p, c.id, cells);
    if (err) return err;
  }
  return null;
}

/** 赞助卡是否有地方放（专属建筑） */
export function sponsorPlaceable(p: PlayerState, c: SponsorCard): boolean {
  return !c.building || placements(p, c.id).length > 0;
}

// ———————————————————————————————————————————— 协会与保护项目

export function projectProgress(g: GameState, p: PlayerState, c: ProjectCard): number {
  switch (c.goal.k) {
    case 'icon':
      return iconCount(p, c.goal.icon);
    case 'metric':
      return metric(g, p, c.goal.metric);
    case 'release': {
      const f = c.goal.filter;
      return Math.max(0, ...zooAnimals(p).filter((x) => matchesFilter(x.card, f) && x.card.size > 0).map((x) => x.card.size));
    }
  }
}

/** 可放归的动物 */
export function releaseCandidates(p: PlayerState, c: ProjectCard, need: number): { uid: number; card: string }[] {
  if (c.goal.k !== 'release') return [];
  const f = c.goal.filter;
  return zooAnimals(p)
    .filter((x) => matchesFilter(x.card, f) && x.card.size >= need)
    .map((x) => ({ uid: x.b.uid, card: x.card.id }));
}

export function supportError(
  g: GameState,
  pi: number,
  projectId: string,
  level: number,
  fromHand: boolean,
  release?: { uid: number; card: string },
  display?: number,
  up = false,
): string | null {
  const p = g.players[pi];
  const c = card(projectId);
  if (c.kind !== 'project') return '不是保护项目';
  let slots: (number | null)[];
  if (display !== undefined) {
    if (!up) return '需要升级的协会行动才能从展示区打出项目';
    if (g.display[display] !== projectId) return '展示区没有这张牌';
    if (display >= range(p)) return '超出声望范围';
    if (p.money < display + 1) return '钱不够';
    slots = c.levels.map(() => null);
  } else if (fromHand) {
    if (!p.hand.includes(projectId)) return '不在手牌中';
    slots = c.levels.map(() => null);
  } else {
    const bp = g.projects.find((x) => x.id === projectId);
    if (!bp) return '协会版图上没有这个项目';
    slots = bp.slots;
  }
  if (p.projects.includes(projectId)) return '你已经支持过这个项目';
  if (level < 0 || level >= c.levels.length) return '没有这一档';
  if (slots[level] !== null) return '这一档已被占据';
  const need = c.levels[level].need;
  if (c.goal.k === 'release') {
    if (!release) return '需要选择放归的动物';
    const ok = releaseCandidates(p, c, need).some((x) => x.uid === release.uid && x.card === release.card);
    if (!ok) return '这只动物不符合条件';
  } else if (projectProgress(g, p, c) < need) return '未达到要求';
  return null;
}

export function assocMoves(g: GameState, pi: number, f: Extract<Frame, { k: 'assoc' }>): Move[] {
  const p = g.players[pi];
  const out: Move[] = [];
  const free = freeWorkers(g, pi);
  const can = (task: TaskId) => TASK_VALUE[task] <= f.budget && !f.used.includes(task) && free >= workersNeeded(g, task);
  if (can('rep')) out.push({ t: 'assoc', task: 'rep' });
  if (can('partner') && p.partners.length < MAX_PARTNERS && (p.partners.length < 2 || p.upgraded.association)) {
    for (const c of CONTINENTS) if (!p.partners.includes(c)) out.push({ t: 'assoc', task: 'partner', continent: c });
  }
  if (can('university')) {
    for (const u of UNIVERSITIES) if (!p.unis.includes(u.id)) out.push({ t: 'assoc', task: 'university', uni: u.id });
  }
  if (can('project')) {
    const consider = (id: string, fromHand: boolean, display?: number) => {
      const c = project(id);
      for (let lv = 0; lv < c.levels.length; lv++) {
        if (c.goal.k === 'release') {
          const seen = new Set<string>();
          for (const r of releaseCandidates(p, c, c.levels[lv].need)) {
            if (seen.has(r.card)) continue;
            seen.add(r.card);
            if (supportError(g, pi, id, lv, fromHand, r, display, f.up) === null)
              out.push({ t: 'assoc', task: 'project', project: id, level: lv, fromHand, release: r, display });
          }
        } else if (supportError(g, pi, id, lv, fromHand, undefined, display, f.up) === null)
          out.push({ t: 'assoc', task: 'project', project: id, level: lv, fromHand, display });
      }
    };
    for (const bp of g.projects) consider(bp.id, false);
    for (const id of p.hand) if (card(id).kind === 'project') consider(id, true);
    if (f.up) g.display.forEach((id, i) => i < range(p) && card(id).kind === 'project' && consider(id, false, i));
  }
  if (f.up && !f.donated && p.money >= donationCost(g.donationStep)) out.push({ t: 'donate' });
  return out;
}

// ———————————————————————————————————————————— 卡牌

export function canSnap(p: PlayerState, str: number, up: boolean): boolean {
  void p;
  return str >= snapStrength(up);
}

export function continentName(c: Continent): string {
  return { africa: '非洲', europe: '欧洲', asia: '亚洲', americas: '美洲', australia: '大洋洲' }[c];
}

export function categoryName(c: Category): string {
  return { predator: '捕食者', herbivore: '草食动物', bird: '鸟类', reptile: '爬行动物', primate: '灵长类', bear: '熊', petting: '宠物' }[c];
}

export function iconName(i: Icon): string {
  if (i === 'science') return '研究';
  if ((CONTINENTS as string[]).includes(i)) return continentName(i as Continent);
  return categoryName(i as Category);
}
