// 动物园地图（按原版地图转录）：9 列平顶六边形，偶数列 6 格、奇数列 7 格，共 58 格。
// 每列一行，用空格分隔各格的记号：
//   .  空地      W 水域      R 岩石      II 需要升级的建造行动才能建（可与奖励连写，如 II$）
//   放置奖励：x X 标记  c 拿 1 张牌（声望范围内或牌库）  5 5 元  T 10 元  $ 2 元  r1/r2 声望 +1/+2
//             a 任一行动卡放到 1 号位  w 协会工人  p 合作动物园  s 打出 1 张赞助卡（付等级数的钱）
//             m 倍增标记  u 大学  k 免费售货亭
//   特殊地形：TOWER 观景塔（岩石）  GATE 户外区（水域）  REST 公园餐厅（岩石）  H 好莱坞山的 H 格
//             K / E 开局就有的售货亭 / 3 格围栏（地图 A）  HARBOR / INST 商港、研究所旁的连接格
import { DIRS, offsetToAxial } from './hex';

export const COLS = 9;

export type Terrain = 'land' | 'water' | 'rock';
export type BonusId = 'x' | 'card' | 'money5' | 'money10' | 'money2' | 'rep1' | 'rep2' | 'slot1' | 'worker' | 'partner' | 'sponsor' | 'mult' | 'uni' | 'kiosk';
export type Feature = 'tower' | 'gate' | 'restaurant' | 'hills' | 'startKiosk' | 'startEnclosure' | 'harbor' | 'institute';

export interface Cell {
  i: number;
  col: number;
  row: number;
  q: number;
  r: number;
  terrain: Terrain;
  bonus: BonusId | null;
  /** 需要升级后的建造行动 */
  upgrade: boolean;
  feature: Feature | null;
  /** 位于地图边缘 */
  border: boolean;
  nbrs: number[];
}

/** 地图左侧的玩家标记奖励：支持保护项目时拿走一个；recurring 的在每次休息时还会再给一次 */
export type LeftBonusId =
  | 'draw'
  | 'enc2'
  | 'money5'
  | 'cp1'
  | 'sponsor'
  | 'worker'
  | 'money12'
  | 'x3'
  | 'rep2'
  | 'extraAction'
  | 'uni'
  | 'special'
  | 'slot1x2'
  | 'pouch2'
  | 'partner';

export interface LeftBonus {
  id: LeftBonusId;
  recurring: boolean;
}

export interface ZooMap {
  id: string;
  name: string;
  /** 地图能力说明 */
  desc: string;
  cells: Cell[];
  byAxial: Map<string, number>;
  left: LeftBonus[];
}

export const BONUS_INFO: Record<BonusId, { label: string; icon: string }> = {
  x: { label: '获得 1 个 X 标记', icon: '✖️' },
  card: { label: '从声望范围内或牌库拿 1 张牌', icon: '🃏' },
  money5: { label: '获得 5 元', icon: '5' },
  money10: { label: '获得 10 元', icon: '10' },
  money2: { label: '获得 2 元', icon: '2' },
  rep1: { label: '声望 +1', icon: '🎓' },
  rep2: { label: '声望 +2', icon: '🎓' },
  slot1: { label: '把任一行动卡放到 1 号位', icon: '↩️' },
  worker: { label: '获得 1 名协会工人', icon: '👤' },
  partner: { label: '结交 1 个合作动物园', icon: '🤝' },
  sponsor: { label: '打出 1 张赞助卡（支付等级数的钱）', icon: '💼' },
  mult: { label: '在任一行动卡上放 1 个倍增标记', icon: '×2' },
  uni: { label: '拿 1 所大学', icon: '🏛️' },
  kiosk: { label: '免费建造 1 个售货亭', icon: '🍦' },
};

export const LEFT_INFO: Record<LeftBonusId, { label: string; icon: string }> = {
  draw: { label: '从牌库抽 1 张牌', icon: '🃏' },
  enc2: { label: '免费建造 1 座 2 格标准围栏', icon: '⬡2' },
  money5: { label: '获得 5 元', icon: '5' },
  cp1: { label: '获得 1 保护点数', icon: '🌿' },
  sponsor: { label: '打出 1 张赞助卡（支付等级数的钱）', icon: '💼' },
  worker: { label: '获得 1 名协会工人', icon: '👤' },
  money12: { label: '获得 12 元', icon: '12' },
  x3: { label: '获得 3 个 X 标记', icon: '✖️3' },
  rep2: { label: '声望 +2', icon: '🎓2' },
  extraAction: { label: '再执行 1 个行动', icon: '🔁' },
  uni: { label: '拿 1 所大学', icon: '🏛️' },
  special: { label: '免费建造爬行馆或大型鸟舍（不需要升级）', icon: '🏚️' },
  slot1x2: { label: '执行 2 次：把任一行动卡放到 1 号位', icon: '↩️×2' },
  pouch2: { label: '最多把 2 张手牌压到地图下，每张吸引力 +2', icon: '👝' },
  partner: { label: '结交 1 个合作动物园（协会未升级时不能拿第 3 个）', icon: '🤝' },
};

const BONUS_CODES: Record<string, BonusId> = {
  x: 'x',
  c: 'card',
  '5': 'money5',
  T: 'money10',
  $: 'money2',
  r1: 'rep1',
  r2: 'rep2',
  a: 'slot1',
  w: 'worker',
  p: 'partner',
  s: 'sponsor',
  m: 'mult',
  u: 'uni',
  k: 'kiosk',
};

interface MapSpec {
  id: string;
  name: string;
  desc: string;
  extra: LeftBonus[];
  /** 下组（只给一次）的第一项；其余固定为 工人、12 元、3 X */
  first?: LeftBonusId;
  cols: string[];
}

const P = (id: LeftBonusId): LeftBonus => ({ id, recurring: true });

const SPECS: MapSpec[] = [
  {
    id: 'm0',
    name: '地图 0',
    desc: '没有特殊能力。',
    extra: [P('cp1')],
    cols: [
      'W W . . r2 R',
      'W c . . . W R',
      'R . c W . .',
      'W R . . x . c',
      'x . T . . .',
      '. . W a R x R',
      '. R II . R R',
      '. 5 II . . r2 W',
      '. . . 5 W W',
    ],
  },
  {
    id: 'mA',
    name: '地图 A',
    desc: '入门地图：开局时左下角已有 1 座空的 3 格围栏和 1 个售货亭。没有特殊能力。',
    extra: [P('cp1')],
    first: 'rep2',
    cols: [
      'r2 x . K E E',
      'R R . . . E R',
      'W R c . 5 W',
      'R 5 . . . . W',
      'W . . x . .',
      'x . R c W c .',
      '. . . W R .',
      'W w . . . r2 II',
      'W W T . . II',
    ],
  },
  {
    id: 'm1',
    name: '地图 1 · 观景塔',
    desc: '观景塔：每当你把动物放进与观景塔所在格相邻的标准围栏，吸引力 +2。',
    extra: [P('sponsor')],
    cols: [
      'x . R R R 5',
      'R . . TOWER . . .',
      'R . . . . .',
      'R . II c . R R',
      'a . W II . r1',
      '. . . W II . W',
      '. . 5 W . .',
      '. c . W x . x',
      '. . W W . .',
    ],
  },
  {
    id: 'm2',
    name: '地图 2 · 户外区',
    desc: '户外区：与户外区所在水域格相邻的标准围栏视为大 2 格。',
    extra: [],
    first: 'cp1',
    cols: [
      'R R r1 . R R',
      'II p R . . R s',
      'II . . . . .',
      '. . . II W . .',
      'R . . x W W',
      'R c . II GATE W .',
      'W . . . . .',
      'W c . x . . .',
      '. . R . . a',
    ],
  },
  {
    id: 'm3',
    name: '地图 3 · 银湖',
    desc: '湖边有许多 2 元的放置奖励。没有其他特殊能力。',
    extra: [],
    first: 'extraAction',
    cols: [
      'II r1 $ $ . W',
      'II II$ II$ W $ . c',
      'II$ W W W $ .',
      '. $ $ $ $ . R',
      '. . . . r1 R',
      'R a . c . W W',
      'W R . . W x',
      'R s . . . . .',
      '. . R R x .',
    ],
  },
  {
    id: 'm4',
    name: '地图 4 · 商港',
    desc: '商港：左下角的连接格上有建筑后激活——每回合一次，你可以随时弃 1 张手牌换 3 元。',
    extra: [],
    first: 'uni',
    cols: [
      '. . r1 . W HARBOR',
      '. x W . . . W',
      '. W W . a .',
      '. x W c R R .',
      '. . . . . .',
      'W . x . . . R',
      'c II R R . .',
      '. R m . . R .',
      'W W II II II 5',
    ],
  },
  {
    id: 'm5',
    name: '地图 5 · 公园餐厅',
    desc: '公园餐厅：休息时，与餐厅相邻的每个被建筑覆盖的格子带来 1 元收入。',
    extra: [],
    first: 'special',
    cols: [
      '. . W . . .',
      'x II W x R II .',
      '. R R s W .',
      '. . . . . . .',
      'a W REST . c .',
      '. . . . W W II',
      'R c . c R 5',
      '. . R W . . .',
      '. r1 . W . .',
    ],
  },
  {
    id: 'm6',
    name: '地图 6 · 研究所',
    desc: '研究所：左下角的连接格上有建筑后激活——每次打出动物，可以忽略它的 1 个条件。',
    extra: [P('slot1x2')],
    cols: [
      'W W . . . INST',
      '. x . . a . .',
      '. . 5 R R .',
      'x . . R R c .',
      'R II . . . .',
      'R c II . . W W',
      'II . . . . r1',
      'II u W W . R .',
      'W W . 5 . W',
    ],
  },
  {
    id: 'm7',
    name: '地图 7 · 冰淇淋店',
    desc: '冰淇淋店：覆盖全部售货亭奖励格之后，休息时每个售货亭额外带来 1 元。',
    extra: [P('pouch2')],
    cols: [
      'R R r1 . . .',
      '. k . . R r1 .',
      '. . . . R .',
      '. c R s II II II',
      'R R . c R c',
      '. . k . R k .',
      '. . . . . .',
      'W x W a . W 5',
      'W W W . x W',
    ],
  },
  {
    id: 'm8',
    name: '地图 8 · 好莱坞山',
    desc: '好莱坞山：每覆盖一个 H 格，从牌库依次翻牌，把第一张赞助卡加入手牌。3 个 H 格都覆盖后，你打出的赞助卡等级 −1。',
    extra: [],
    first: 'partner',
    cols: [
      '. . . a R R',
      'W x W . . H R',
      '. . W II . R',
      'x . . II . II R',
      '. W x . R H',
      '. W W . . . R',
      '5 W . . H R',
      '. . c . . R .',
      '. . . . r1 .',
    ],
  },
];

function parseCell(tok: string): { terrain: Terrain; bonus: BonusId | null; upgrade: boolean; feature: Feature | null } {
  let terrain: Terrain = 'land';
  let upgrade = false;
  let feature: Feature | null = null;
  let rest = tok;
  if (rest.startsWith('II')) {
    upgrade = true;
    rest = rest.slice(2);
  }
  switch (rest) {
    case '':
    case '.':
      return { terrain, bonus: null, upgrade, feature };
    case 'W':
      return { terrain: 'water', bonus: null, upgrade, feature };
    case 'R':
      return { terrain: 'rock', bonus: null, upgrade, feature };
    case 'TOWER':
      return { terrain: 'rock', bonus: null, upgrade, feature: 'tower' };
    case 'GATE':
      return { terrain: 'water', bonus: null, upgrade, feature: 'gate' };
    case 'REST':
      return { terrain: 'rock', bonus: null, upgrade, feature: 'restaurant' };
    case 'H':
      return { terrain, bonus: null, upgrade, feature: 'hills' };
    case 'K':
      feature = 'startKiosk';
      return { terrain, bonus: null, upgrade, feature };
    case 'E':
      return { terrain, bonus: null, upgrade, feature: 'startEnclosure' };
    case 'HARBOR':
      return { terrain, bonus: null, upgrade, feature: 'harbor' };
    case 'INST':
      return { terrain, bonus: null, upgrade, feature: 'institute' };
  }
  const bonus = BONUS_CODES[rest];
  if (!bonus) throw new Error(`地图记号无法识别：${tok}`);
  terrain = 'land';
  return { terrain, bonus, upgrade, feature };
}

function build(spec: MapSpec): ZooMap {
  if (spec.cols.length !== COLS) throw new Error(`${spec.id}: 需要 ${COLS} 列`);
  const cells: Cell[] = [];
  const byAxial = new Map<string, number>();
  spec.cols.forEach((line, col) => {
    const toks = line.trim().split(/\s+/);
    const want = col % 2 === 0 ? 6 : 7;
    if (toks.length !== want) throw new Error(`${spec.id} 第 ${col} 列应有 ${want} 格，实际 ${toks.length}`);
    toks.forEach((tok, row) => {
      const [q, r] = offsetToAxial(col, row);
      const i = cells.length;
      cells.push({ i, col, row, q, r, ...parseCell(tok), border: false, nbrs: [] });
      byAxial.set(`${q},${r}`, i);
    });
  });
  for (const c of cells) {
    let outside = 0;
    for (const [dq, dr] of DIRS) {
      const j = byAxial.get(`${c.q + dq},${c.r + dr}`);
      if (j === undefined) outside++;
      else c.nbrs.push(j);
    }
    c.border = outside > 0;
  }
  const left: LeftBonus[] = [P('draw'), P('enc2'), P('money5'), ...spec.extra];
  const lower: LeftBonusId[] = [...(spec.first ? [spec.first] : []), 'worker', 'money12', 'x3'];
  if (spec.id === 'mA') lower.splice(1, 1);
  for (const id of lower) left.push({ id, recurring: false });
  if (left.length !== 7) throw new Error(`${spec.id}: 左侧奖励应为 7 个，实际 ${left.length}`);
  return { id: spec.id, name: spec.name, desc: spec.desc, cells, byAxial, left };
}

export const MAPS: Record<string, ZooMap> = {};
for (const s of SPECS) MAPS[s.id] = build(s);
export const MAP_IDS = SPECS.map((s) => s.id);

export function getMap(id: string): ZooMap {
  const m = MAPS[id];
  if (!m) throw new Error(`未知地图 ${id}`);
  return m;
}

/** 把形状放到锚点上，返回格子下标（越界返回 null） */
export function placeShape(map: ZooMap, shape: [number, number][], anchor: number): number[] | null {
  const a = map.cells[anchor];
  if (!a) return null;
  const out: number[] = [];
  for (const [dq, dr] of shape) {
    const j = map.byAxial.get(`${a.q + dq},${a.r + dr}`);
    if (j === undefined) return null;
    out.push(j);
  }
  return out;
}

/** 某地图特殊地形所在的格子 */
export function featureCells(map: ZooMap, f: Feature): number[] {
  return map.cells.filter((c) => c.feature === f).map((c) => c.i);
}
