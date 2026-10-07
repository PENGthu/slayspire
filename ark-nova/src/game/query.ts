// 只读查询：图标统计、费用、各类合法性检查，以及给 AI / 界面用的候选枚举。
import { BUILDINGS, BUILDABLE, buildingDef, enclosureSize, type BuildingDef } from './buildings';
import { animal, card, project, sponsor } from './content';
import { hexDistance, orientations, type Axial } from './hex';
import { featureCells, getMap, placeShape, type ZooMap } from './maps';
import {
  BASE_HAND_LIMIT,
  BUILD_COST_PER_CELL,
  MAX_PARTNERS,
  MAX_UNIS,
  TASK_VALUE,
  UNIVERSITIES,
  donationCost,
  repRange,
  snapStrength,
  university,
} from './rules';
import type {
  AnimalCard,
  Building,
  Category,
  Continent,
  Frame,
  GameState,
  Icon,
  Move,
  PlayerState,
  ProjectCard,
  Requirement,
  SponsorCard,
  TaskId,
} from './types';
import { CATEGORIES, CONTINENTS } from './types';

export const ALL_ICONS: Icon[] = [...CONTINENTS, ...CATEGORIES, 'science', 'water', 'rock'];

export function mapOf(p: PlayerState): ZooMap {
  return getMap(p.map);
}

export function has(p: PlayerState, sponsorId: string): boolean {
  return p.sponsors.includes(sponsorId);
}

// ———————————————————————————————————————————— 动物园内容

export function zooAnimals(p: PlayerState): { card: AnimalCard; b: Building }[] {
  const out: { card: AnimalCard; b: Building }[] = [];
  for (const b of p.buildings) for (const id of b.animals) out.push({ card: animal(id), b });
  return out;
}

export function isSmall(a: AnimalCard): boolean {
  return a.size <= 2;
}

export function isLarge(a: AnimalCard): boolean {
  return a.size >= 4;
}

/** 一张卡（动物或赞助）提供的图标，含水 / 岩石要求图标 */
export function cardIcons(id: string): Icon[] {
  const c = card(id);
  if (c.kind === 'animal') {
    const out = [...c.icons];
    for (let i = 0; i < (c.water ?? 0); i++) out.push('water');
    for (let i = 0; i < (c.rock ?? 0); i++) out.push('rock');
    return out;
  }
  if (c.kind === 'sponsor') {
    const out = [...c.icons];
    for (let i = 0; i < (c.building?.water ?? 0); i++) out.push('water');
    for (let i = 0; i < (c.building?.rock ?? 0); i++) out.push('rock');
    return out;
  }
  return [];
}

export function iconCounts(p: PlayerState): Record<Icon, number> {
  const c = {} as Record<Icon, number>;
  for (const i of ALL_ICONS) c[i] = 0;
  for (const b of p.buildings) for (const id of b.animals) for (const x of cardIcons(id)) c[x]++;
  for (const id of p.sponsors) for (const x of cardIcons(id)) c[x]++;
  for (const cont of p.partners) c[cont]++;
  for (const u of p.unis) c.science += university(u).science;
  return c;
}

export function iconCount(p: PlayerState, icon: Icon): number {
  return iconCounts(p)[icon];
}

export function kinds(p: PlayerState, of: 'category' | 'continent'): number {
  const c = iconCounts(p);
  return (of === 'category' ? CATEGORIES : CONTINENTS).filter((x) => c[x] > 0).length;
}

export function smallCount(p: PlayerState): number {
  return zooAnimals(p).filter((x) => isSmall(x.card)).length;
}

export function largeCount(p: PlayerState): number {
  return zooAnimals(p).filter((x) => isLarge(x.card)).length;
}

export function coveredCells(p: PlayerState): Set<number> {
  const s = new Set<number>();
  for (const b of p.buildings) for (const c of b.cells) s.add(c);
  return s;
}

/** 与至少一座建筑相邻的格子 */
export function connectedCells(p: PlayerState): Set<number> {
  const map = mapOf(p);
  const covered = coveredCells(p);
  const s = new Set<number>();
  for (const i of covered) for (const n of map.cells[i].nbrs) s.add(n);
  return s;
}

/** 水域 / 岩石格：与建筑相邻的个数、不相邻的个数 */
export function terrainConnection(p: PlayerState, t: 'water' | 'rock'): { connected: number; unconnected: number } {
  const map = mapOf(p);
  const conn = connectedCells(p);
  let connected = 0;
  let unconnected = 0;
  for (const c of map.cells) {
    if (c.terrain !== t || c.feature) continue;
    if (conn.has(c.i)) connected++;
    else unconnected++;
  }
  return { connected, unconnected };
}

/** 可建造的空格（陆地、没有建筑） */
export function emptyBuildable(p: PlayerState): number {
  const covered = coveredCells(p);
  return mapOf(p).cells.filter((c) => c.terrain === 'land' && !isBlockedFeature(c.feature) && !covered.has(c.i)).length;
}

export function allBorderCovered(p: PlayerState): boolean {
  const covered = coveredCells(p);
  return mapOf(p).cells.every((c) => !c.border || c.terrain !== 'land' || isBlockedFeature(c.feature) || covered.has(c.i));
}

export function mapFullyCovered(p: PlayerState): boolean {
  const covered = coveredCells(p);
  return mapOf(p).cells.every((c) => c.terrain !== 'land' || isBlockedFeature(c.feature) || covered.has(c.i));
}

function isBlockedFeature(f: string | null): boolean {
  return f === 'tower' || f === 'gate' || f === 'restaurant';
}

export function handLimit(p: PlayerState): number {
  return p.unis.some((u) => university(u).handLimit) ? 5 : BASE_HAND_LIMIT;
}

export function range(p: PlayerState): number {
  return repRange(p.rep);
}

export function freeWorkers(g: GameState, pi: number): number {
  let used = 0;
  for (const t of Object.values(g.tasks)) used += t.filter((x) => x === pi).length;
  return g.players[pi].workers - used;
}

export function workersNeeded(g: GameState, task: TaskId): number {
  return g.tasks[task].length > 0 ? 2 : 1;
}

/** 协会任务的价值（兽医：支持项目只需 4） */
export function taskValue(p: PlayerState, task: TaskId): number {
  if (task === 'project' && has(p, 's203')) return 4;
  return TASK_VALUE[task];
}

/** 一个条件还差多少（0 = 已满足）；动物的合作动物园条件需要传入动物卡 */
export function reqShort(p: PlayerState, r: Requirement, icons: Record<Icon, number>, a?: AnimalCard): number {
  switch (r.k) {
    case 'icon':
      return Math.max(0, r.n - icons[r.icon]);
    case 'partner':
      return a && a.icons.some((i) => p.partners.includes(i as Continent)) ? 0 : 1;
    case 'partners':
      return Math.max(0, r.n - p.partners.length);
    case 'upgrade':
      return p.upgraded[r.action] ? 0 : 1;
    case 'rep':
      return p.rep >= r.n ? 0 : 1;
    case 'appealMax':
      return p.appeal <= r.n ? 0 : 1;
  }
}

export function reqMet(p: PlayerState, reqs: Requirement[] | undefined): boolean {
  if (!reqs) return true;
  const icons = iconCounts(p);
  return reqs.every((r) => reqShort(p, r, icons) === 0);
}

export function reqLabel(r: Requirement): string {
  switch (r.k) {
    case 'icon':
      return `${r.n} 个${iconName(r.icon)}图标`;
    case 'partner':
      return '同大洲的合作动物园';
    case 'partners':
      return `${r.n} 个合作动物园`;
    case 'upgrade':
      return r.action === 'sponsors' ? '升级的赞助行动' : '升级的动物行动';
    case 'rep':
      return `声望 ${r.n}`;
    case 'appealMax':
      return `吸引力不超过 ${r.n}`;
  }
}

// ———————————————————————————————————————————— 建造

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
  /** 免费放置时忽略建筑本身的升级要求（如霸主能力、地图奖励） */
  ignoreTypeUpgrade?: boolean;
}

export function adjacentTerrain(p: PlayerState, cells: number[], terrain: 'water' | 'rock'): number {
  const map = mapOf(p);
  const seen = new Set<number>();
  for (const i of cells) for (const n of map.cells[i].nbrs) if (map.cells[n].terrain === terrain && !cells.includes(n)) seen.add(n);
  return seen.size;
}

/** 检查能否在这些格子上放置建筑（不含费用），返回错误原因或 null */
export function placementError(p: PlayerState, type: string, cells: number[], opts: PlaceOpts = {}): string | null {
  const def = BUILDINGS[type];
  if (!def) return '未知建筑';
  const map = mapOf(p);
  if (cells.length !== def.shape.length || new Set(cells).size !== cells.length) return '形状不对';
  const covered = coveredCells(p);
  const overTerrain = has(p, 's219');
  for (const i of cells) {
    const c = map.cells[i];
    if (!c) return '超出地图';
    if (isBlockedFeature(c.feature)) return '这里不能建造';
    if (c.terrain !== 'land' && !overTerrain) return c.terrain === 'water' ? '不能建在水域上' : '不能建在岩石上';
    if (covered.has(i)) return '格子已被占用';
    if (c.upgrade && !p.upgraded.build) return '标有 II 的格子需要升级的建造行动';
  }
  if (!keysFor(def).has(shapeKey(cells.map((i) => [map.cells[i].q, map.cells[i].r])))) return '形状不对';
  if (def.needsUpgrade && !p.upgraded.build && !opts.ignoreTypeUpgrade) return `${def.name}需要升级的建造行动`;
  if (def.unique && p.buildings.some((b) => b.type === type)) return `每座动物园只能有一座${def.name}`;
  const sp = def.kind === 'sponsor' ? sponsor(type).building : undefined;
  if (!sp?.free) {
    const touches = cells.some((i) => map.cells[i].border || map.cells[i].nbrs.some((n) => covered.has(n)));
    if (!touches) return '必须与地图边缘或已有建筑相邻';
  }
  if (def.kind === 'kiosk') {
    for (const b of p.buildings) {
      if (b.type !== 'kiosk') continue;
      const a = map.cells[b.cells[0]];
      const c = map.cells[cells[0]];
      if (hexDistance([a.q, a.r], [c.q, c.r]) < 3) return '售货亭之间至少相隔 2 格';
    }
  }
  if (sp) {
    if (sp.water && adjacentTerrain(p, cells, 'water') < sp.water) return `必须与至少 ${sp.water} 个水域格相邻`;
    if (sp.rock && adjacentTerrain(p, cells, 'rock') < sp.rock) return `必须与至少 ${sp.rock} 个岩石格相邻`;
    if (sp.border && cells.filter((i) => map.cells[i].border).length < sp.border) return `至少 ${sp.border} 格要在地图边缘`;
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
    for (const c of map.cells) {
      const cells = placeShape(map, o, c.i);
      if (!cells) continue;
      const k = [...cells].sort((a, b) => a - b).join(',');
      if (seen.has(k)) continue;
      seen.add(k);
      if (placementError(p, type, cells, opts) === null) out.push(cells);
    }
  }
  return out;
}

export function hasPlacement(p: PlayerState, type: string, opts: PlaceOpts = {}): boolean {
  const def = BUILDINGS[type];
  if (!def) return false;
  if (def.unique && p.buildings.some((b) => b.type === type)) return false;
  if (def.needsUpgrade && !p.upgraded.build && !opts.ignoreTypeUpgrade) return false;
  const map = mapOf(p);
  for (const o of orientations(def.shape)) {
    for (const c of map.cells) {
      const cells = placeShape(map, o, c.i);
      if (cells && placementError(p, type, cells, opts) === null) return true;
    }
  }
  return false;
}

export function buildCost(type: string): number {
  return buildingDef(type).shape.length * BUILD_COST_PER_CELL;
}

/** 建造行动中当前可以选择的建筑类型 */
export function buildableTypes(p: PlayerState, f: Extract<Frame, { k: 'build' }>): string[] {
  return BUILDABLE.filter((t) => {
    const def = buildingDef(t);
    if (f.engineer) {
      // 工程师：再建 1 座同种建筑（特殊场馆除外），不受强度限制
      return f.built.includes(t) && def.kind !== 'special' && p.money >= buildCost(t);
    }
    if (def.shape.length > f.budget) return false;
    if (f.built.includes(t)) return false;
    if (def.needsUpgrade && !f.up) return false;
    if (def.unique && p.buildings.some((b) => b.type === t)) return false;
    if (p.money < buildCost(t)) return false;
    return true;
  });
}

// ———————————————————————————————————————————— 动物

/** 标准围栏的有效大小（户外区旁 +2） */
export function effectiveSize(p: PlayerState, b: Building): number {
  const base = enclosureSize(b.type);
  if (!base) return 0;
  const map = mapOf(p);
  const gate = featureCells(map, 'gate');
  if (gate.length && b.cells.some((i) => map.cells[i].nbrs.some((n) => gate.includes(n)))) return base + 2;
  return base;
}

export function animalCost(g: GameState, p: PlayerState, a: AnimalCard, from: number): number {
  let cost = a.cost;
  if (a.icons.some((c) => p.partners.includes(c as Continent))) cost -= 3;
  if (has(p, 's229') && isSmall(a)) cost -= 3;
  if (has(p, 's230') && isLarge(a)) cost -= 4;
  if (from >= 0) cost += from + 1;
  void g;
  return Math.max(0, cost);
}

/** 动物能否放进这座建筑（只看大小 / 容量） */
export function fitsSpace(p: PlayerState, a: AnimalCard, b: Building): boolean {
  const def = buildingDef(b.type);
  if (def.kind === 'enclosure') {
    if (a.noStandard || effectiveSize(p, b) < a.size) return false;
    if (b.animals.length === 0) return true;
    // 群居动物：可以与一只食草动物合住
    const flock = a.abilities?.some((x) => x.k === 'flock');
    return !!flock && b.animals.length === 1 && animal(b.animals[0]).icons.includes('herbivore');
  }
  if (def.kind === 'special') {
    if (!a.special || a.special.kind !== def.special) return false;
    const used = b.animals.reduce((s, id) => s + (animal(id).special?.units ?? 1), 0);
    if (def.special === 'petting') return b.animals.length < (def.capacity ?? 0);
    return used + a.special.units <= (def.capacity ?? 0);
  }
  return false;
}

/** 动物在这座建筑里还差的条件（每个缺少的图标、水域 / 岩石格都算 1 个条件） */
export function unmetConditions(p: PlayerState, a: AnimalCard, b: Building): string[] {
  const out: string[] = [];
  const def = buildingDef(b.type);
  if (def.kind === 'enclosure' && !has(p, 's219')) {
    const w = (a.water ?? 0) - adjacentTerrain(p, b.cells, 'water');
    for (let i = 0; i < w; i++) out.push(`需要与 ${a.water} 个水域格相邻`);
    const r = (a.rock ?? 0) - adjacentTerrain(p, b.cells, 'rock');
    for (let i = 0; i < r; i++) out.push(`需要与 ${a.rock} 个岩石格相邻`);
  }
  const icons = iconCounts(p);
  for (const r of a.req ?? []) {
    const short = reqShort(p, r, icons, a);
    for (let i = 0; i < short; i++) out.push(`需要${reqLabel(r)}`);
  }
  return out;
}

/** 打出这只动物时可以忽略的条件数（研究所、WAZA 大型动物计划、奖励板块） */
export function ignorable(p: PlayerState, a: AnimalCard): number {
  let n = p.ignoreTokens > 0 ? 3 : 0;
  if (instituteActive(p)) n++;
  if (has(p, 's263') && isLarge(a)) n++;
  return n;
}

export function instituteActive(p: PlayerState): boolean {
  const map = mapOf(p);
  const spot = featureCells(map, 'institute');
  if (!spot.length) return false;
  const covered = coveredCells(p);
  return spot.some((i) => covered.has(i));
}

export function harborActive(p: PlayerState): boolean {
  const map = mapOf(p);
  const spot = featureCells(map, 'harbor');
  if (!spot.length) return false;
  const covered = coveredCells(p);
  return spot.some((i) => covered.has(i));
}

/** WAZA 特别任务禁止的类型 */
export function wazaBlocked(p: PlayerState, a: AnimalCard): boolean {
  if (p.waza === 'small') return isLarge(a);
  if (p.waza === 'large') return isSmall(a);
  return false;
}

/** 打出动物的错误原因（null 表示可以） */
export function animalError(g: GameState, pi: number, cardId: string, from: number, uid: number, up: boolean, onlySmall = false): string | null {
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
  if (onlySmall && !isSmall(c)) return '这次只能打出小型动物';
  if (wazaBlocked(p, c)) return p.waza === 'small' ? '世界动物园协会特别任务：你不能再打出大型动物' : '世界动物园协会特别任务：你不能再打出小型动物';
  const b = p.buildings.find((x) => x.uid === uid);
  if (!b) return '没有这座建筑';
  if (!fitsSpace(p, c, b)) return '无法放进这座建筑';
  const unmet = unmetConditions(p, c, b);
  if (unmet.length > ignorable(p, c)) return unmet[0];
  if (animalCost(g, p, c, from) > p.money) return '钱不够';
  return null;
}

export interface AnimalOption {
  card: string;
  from: number;
  building: number;
  cost: number;
  /** 忽略了几个条件 */
  ignored: number;
}

export function animalOptions(g: GameState, pi: number, up: boolean, onlySmall = false): AnimalOption[] {
  const p = g.players[pi];
  const out: AnimalOption[] = [];
  const sources: [string, number][] = p.hand.map((id) => [id, -1]);
  if (up) g.display.forEach((id, i) => i < range(p) && sources.push([id, i]));
  for (const [id, from] of sources) {
    const c = card(id);
    if (c.kind !== 'animal') continue;
    for (const b of p.buildings) {
      if (animalError(g, pi, id, from, b.uid, up, onlySmall) === null)
        out.push({ card: id, from, building: b.uid, cost: animalCost(g, p, c, from), ignored: unmetConditions(p, c, b).length });
    }
  }
  return out;
}

// ———————————————————————————————————————————— 赞助

/** 赞助卡的有效等级（好莱坞山 3 个 H 格都覆盖后 −1） */
export function sponsorLevel(p: PlayerState, c: SponsorCard): number {
  return Math.max(0, c.level - (hillsDone(p) ? 1 : 0));
}

export function hillsDone(p: PlayerState): boolean {
  const map = mapOf(p);
  const h = featureCells(map, 'hills');
  if (!h.length) return false;
  const covered = coveredCells(p);
  return h.every((i) => covered.has(i));
}

export function sponsorError(
  g: GameState,
  pi: number,
  f: { up: boolean; budget: number } | null,
  cardId: string,
  from: number,
  cells?: number[],
): string | null {
  const p = g.players[pi];
  const c = card(cardId);
  if (c.kind !== 'sponsor') return '不是赞助卡';
  if (from < 0) {
    if (!p.hand.includes(cardId)) return '不在手牌中';
  } else {
    if (f && !f.up) return '需要升级的赞助行动才能从展示区打出';
    if (g.display[from] !== cardId) return '展示区没有这张牌';
    if (from >= range(p)) return '超出声望范围';
    if (p.money < from + 1) return '钱不够';
  }
  if (f && sponsorLevel(p, c) > f.budget) return '等级超过行动强度';
  const icons = iconCounts(p);
  for (const r of c.req ?? []) if (reqShort(p, r, icons) > 0) return `需要${reqLabel(r)}`;
  if (c.building) {
    if (!cells) return '需要选择建筑位置';
    const err = placementError(p, c.id, cells);
    if (err) return err;
  }
  return null;
}

/** 赞助卡是否有地方放（专属建筑） */
export function sponsorPlaceable(p: PlayerState, c: SponsorCard): boolean {
  return !c.building || hasPlacement(p, c.id);
}

// ———————————————————————————————————————————— 协会与保护项目

/** 放归项目每档对体型的要求 */
export function releaseSizeOk(level: number, size: number): boolean {
  if (level === 0) return size >= 4;
  if (level === 1) return size === 3;
  return size <= 2;
}

export function releaseLabel(level: number): string {
  return ['体型 ≥4', '体型 3', '体型 ≤2'][level] ?? '';
}

/** 项目进度：图标 / 种类 / 动物数量 */
export function projectProgress(p: PlayerState, c: ProjectCard): number {
  switch (c.goal.k) {
    case 'icon':
      return iconCount(p, c.goal.icon);
    case 'kinds':
      return kinds(p, c.goal.of);
    case 'small':
      return smallCount(p);
    case 'large':
      return largeCount(p);
    case 'release':
      return zooAnimals(p).filter((x) => x.card.icons.includes(c.goal.k === 'release' ? c.goal.icon : 'science')).length;
    case 'breed':
      return breedOk(p, c.goal.cat) ? 1 : 0;
  }
}

export function breedOk(p: PlayerState, cat: Category): boolean {
  return zooAnimals(p).some((x) => x.card.icons.includes(cat) && x.card.icons.some((i) => p.partners.includes(i as Continent)));
}

/** 可放归的动物 */
export function releaseCandidates(p: PlayerState, c: ProjectCard, level: number): { uid: number; card: string }[] {
  if (c.goal.k !== 'release') return [];
  const icon = c.goal.icon;
  return zooAnimals(p)
    .filter((x) => x.card.icons.includes(icon) && releaseSizeOk(level, x.card.size))
    .map((x) => ({ uid: x.b.uid, card: x.card.id }));
}

/** 繁育合作 / 育种计划卡上的标记（可当任意图标支持基础项目） */
export function wildTokens(p: PlayerState): string[] {
  return ['s215', 's218'].filter((id) => (p.cardTokens[id] ?? 0) > 0);
}

export function supportedTimes(p: PlayerState, id: string): number {
  return p.supported.filter((x) => x.id === id).length;
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
  wild: string[] = [],
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
  const repeat = c.goal.k === 'release' && has(p, 's224');
  if (!repeat && supportedTimes(p, projectId) > 0) return '你已经支持过这个项目';
  if (level < 0 || level >= c.levels.length) return '没有这一档';
  if (slots[level] !== null) return '这一档已被占据';
  if (wild.length) {
    if (!c.base) return '标记只能用于基础保护项目';
    const avail = wildTokens(p);
    if (wild.length > 1 || !wild.every((w) => avail.includes(w))) return '没有可用的标记';
  }
  if (c.goal.k === 'release') {
    if (!release) return '需要选择放归的动物';
    const ok = releaseCandidates(p, c, level).some((x) => x.uid === release.uid && x.card === release.card);
    if (!ok) return '这只动物不符合条件';
  } else if (c.goal.k === 'breed') {
    if (!breedOk(p, c.goal.cat)) return `需要 1 只${categoryName(c.goal.cat)}以及与它同大洲的合作动物园`;
  } else if (projectProgress(p, c) + wild.length < c.levels[level].need) return '未达到要求';
  return null;
}

export function assocMoves(g: GameState, pi: number, f: Extract<Frame, { k: 'assoc' }>): Move[] {
  const p = g.players[pi];
  const out: Move[] = [];
  const free = freeWorkers(g, pi);
  const can = (task: TaskId) => taskValue(p, task) <= f.budget && !f.used.includes(task) && free >= workersNeeded(g, task);
  if (can('rep')) out.push({ t: 'assoc', task: 'rep' });
  if (can('partner') && p.partners.length < MAX_PARTNERS && (p.partners.length < 2 || p.upgraded.association)) {
    for (const c of CONTINENTS) if (!p.partners.includes(c)) out.push({ t: 'assoc', task: 'partner', continent: c });
  }
  if (can('university') && p.unis.length < MAX_UNIS) {
    for (const u of UNIVERSITIES) if (!p.unis.includes(u.id)) out.push({ t: 'assoc', task: 'university', uni: u.id });
  }
  if (can('project')) {
    const wilds = wildTokens(p);
    const consider = (id: string, fromHand: boolean, display?: number) => {
      const c = project(id);
      for (let lv = 0; lv < c.levels.length; lv++) {
        if (c.goal.k === 'release') {
          const seen = new Set<string>();
          for (const r of releaseCandidates(p, c, lv)) {
            if (seen.has(r.card)) continue;
            seen.add(r.card);
            if (supportError(g, pi, id, lv, fromHand, r, display, f.up) === null)
              out.push({ t: 'assoc', task: 'project', project: id, level: lv, fromHand, release: r, display });
          }
        } else if (supportError(g, pi, id, lv, fromHand, undefined, display, f.up) === null)
          out.push({ t: 'assoc', task: 'project', project: id, level: lv, fromHand, display });
        else if (wilds.length && supportError(g, pi, id, lv, fromHand, undefined, display, f.up, [wilds[0]]) === null)
          out.push({ t: 'assoc', task: 'project', project: id, level: lv, fromHand, display, wild: [wilds[0]] });
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

export function canSnap(str: number, up: boolean): boolean {
  return str >= snapStrength(up);
}

export function continentName(c: Continent): string {
  return { africa: '非洲', europe: '欧洲', asia: '亚洲', americas: '美洲', australia: '大洋洲' }[c];
}

export function categoryName(c: Category): string {
  return { predator: '食肉类', herbivore: '食草类', bird: '鸟类', reptile: '爬行类', primate: '灵长类', bear: '熊', petting: '萌宠' }[c];
}

export function iconName(i: Icon): string {
  if (i === 'science') return '研究';
  if (i === 'water') return '水';
  if (i === 'rock') return '岩石';
  if ((CONTINENTS as string[]).includes(i)) return continentName(i as Continent);
  return categoryName(i as Category);
}
