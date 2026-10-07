// 动物园地图：7 行 × 9 列的六边形网格。
// 每格两个字符：第一个是地形（. 空地  w 水域  r 岩石  2 需要升级建造才能建  # 不存在），
// 第二个是放置奖励（. 无  $ 5 元  c 抽 1 张牌  p 声望 +1  x X 标记 +1  u 升级行动卡  k 协会工人 +1）。
import { DIRS, offsetToAxial, type Axial } from './hex';

export const ROWS = 7;
export const COLS = 9;

export type Terrain = 'land' | 'water' | 'rock';
export type BonusId = 'money' | 'card' | 'rep' | 'x' | 'upgrade' | 'worker';

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
  /** 位于地图边缘 */
  border: boolean;
  nbrs: number[];
}

export type MapAbility =
  | { k: 'none' }
  | { k: 'waterBuild'; money: number }
  | { k: 'rockDiscount'; n: number }
  | { k: 'science' }
  | { k: 'kioskIncome'; n: number }
  | { k: 'projectMoney'; n: number }
  | { k: 'startMoney'; n: number };

export interface ZooMap {
  id: string;
  name: string;
  desc: string;
  ability: MapAbility;
  cells: (Cell | null)[];
  /** 存在的格子 */
  list: Cell[];
  byAxial: Map<string, number>;
}

export const BONUS_INFO: Record<BonusId, { label: string; icon: string }> = {
  money: { label: '获得 5 元', icon: '💰' },
  card: { label: '从牌库抽 1 张牌', icon: '🃏' },
  rep: { label: '声望 +1', icon: '⭐' },
  x: { label: '获得 1 个 X 标记', icon: '✖️' },
  upgrade: { label: '升级 1 张行动卡', icon: '⬆️' },
  worker: { label: '获得 1 名协会工人', icon: '👤' },
};

const BONUS_CODES: Record<string, BonusId> = { $: 'money', c: 'card', p: 'rep', x: 'x', u: 'upgrade', k: 'worker' };

interface MapSpec {
  id: string;
  name: string;
  desc: string;
  ability: MapAbility;
  rows: string[];
}

const SPECS: MapSpec[] = [
  {
    id: 'A',
    name: '地图 A · 入门园区',
    desc: '没有特殊能力，适合第一局。',
    ability: { k: 'none' },
    rows: [
      '2$ .. .. .. .. .. .. .. 2c',
      '.. .. w. w. .. .. r. .. 2.',
      '.x .. w. .. .. .. r. .. .p',
      '.. .. .. .. .$ .. .. .. ..',
      '.. r. .. .. .. .. .. w. ..',
      '.c r. .. .. .. .. w. w. 2.',
      '2x .. .. .p .. .. .. .. 2$',
    ],
  },
  {
    id: 'lake',
    name: '地图 1 · 湖畔园区',
    desc: '园区中央是一片大湖。每建造一座与水域相邻的建筑，获得 2 元。',
    ability: { k: 'waterBuild', money: 2 },
    rows: [
      '2. .. .. .$ .. .. .. .. 2x',
      '.. .. .. w. w. .. .. .p ..',
      '.c .. w. w. w. w. .. .. 2.',
      '.. .. .. w. w. .. .. r. ..',
      '.p .. .. .. .. .. .. r. .c',
      '2. r. .. .. .x .. .. .. ..',
      '2x .. .. .. .. .. .$ .. 2$',
    ],
  },
  {
    id: 'mountain',
    name: '地图 2 · 高山园区',
    desc: '岩石山脊纵横。打出需要岩石的动物时，费用减少 3 元。',
    ability: { k: 'rockDiscount', n: 3 },
    rows: [
      '2. .. r. r. .. .. .. .$ 2.',
      '.. .. .. r. .. .. w. .. ..',
      '.p .. .. .. .. .. w. .. .c',
      '.. .x .. .. r. r. .. .. 2.',
      '.. .. .. .. .. r. .. .. .p',
      '.$ .. w. .. .. .. .. r. ..',
      '2x .. w. .. .c .. .. r. 2$',
    ],
  },
  {
    id: 'research',
    name: '地图 3 · 研究园区',
    desc: '与大学合作的园区。你始终额外拥有 1 个研究图标。',
    ability: { k: 'science' },
    rows: [
      '## .. .. .. .$ .. .. .. ##',
      '2. .. w. .. .. .. r. .. 2.',
      '.p .. w. w. .. .. r. .. .c',
      '.. .. .. .. .. .. .. .. ..',
      '.x .. r. .. .. w. .. .. .p',
      '.. .. r. .. .. w. w. .. 2.',
      '2x .. .. .c .. .. .. .$ 2$',
    ],
  },
  {
    id: 'boulevard',
    name: '地图 4 · 观光大道',
    desc: '游客络绎不绝。休息时，你的每个售货亭额外获得 1 元。',
    ability: { k: 'kioskIncome', n: 1 },
    rows: [
      '2c .. .. .. .. .. .. .. 2$',
      '.. .. r. .. .. w. w. .. ..',
      '.. .. r. .. .p .. w. .. .x',
      '.$ .. .. .. .. .. .. .. ..',
      '.. .. .. w. .. .. r. .. .c',
      '2. .p .. w. w. .. r. .. ..',
      '2x .. .. .. .. .. .. .. 2$',
    ],
  },
  {
    id: 'conservation',
    name: '地图 5 · 保护中心',
    desc: '野生动物保护的前哨。每支持一个保护项目，获得 3 元。',
    ability: { k: 'projectMoney', n: 3 },
    rows: [
      '2. .. .. .p .. .. .. .. 2c',
      '.. w. .. .. .. r. r. .. ..',
      '.$ w. w. .. .. .. r. .. .x',
      '.. .. .. .. .c .. .. .. 2.',
      '.. .. .. r. .. .. .. w. .$',
      '2. .. .. r. .. .. w. w. ..',
      '2x .. .p .. .. .. .. .. 2$',
    ],
  },
];

function build(spec: MapSpec): ZooMap {
  const cells: (Cell | null)[] = new Array(ROWS * COLS).fill(null);
  const byAxial = new Map<string, number>();
  spec.rows.forEach((line, row) => {
    const toks = line.trim().split(/\s+/);
    if (toks.length !== COLS) throw new Error(`地图 ${spec.id} 第 ${row} 行应有 ${COLS} 格`);
    toks.forEach((tok, col) => {
      const t = tok[0];
      if (t === '#') return;
      const [q, r] = offsetToAxial(col, row);
      const i = row * COLS + col;
      const terrain: Terrain = t === 'w' ? 'water' : t === 'r' ? 'rock' : 'land';
      const b = tok[1];
      cells[i] = {
        i,
        col,
        row,
        q,
        r,
        terrain,
        bonus: b && b !== '.' ? BONUS_CODES[b] ?? null : null,
        upgrade: t === '2',
        border: false,
        nbrs: [],
      };
      byAxial.set(`${q},${r}`, i);
    });
  });
  for (const c of cells) {
    if (!c) continue;
    let missing = 0;
    for (const [dq, dr] of DIRS) {
      const n = byAxial.get(`${c.q + dq},${c.r + dr}`);
      if (n === undefined) missing++;
      else c.nbrs.push(n);
    }
    c.border = missing > 0;
  }
  return {
    id: spec.id,
    name: spec.name,
    desc: spec.desc,
    ability: spec.ability,
    cells,
    list: cells.filter((c): c is Cell => !!c),
    byAxial,
  };
}

export const MAPS: Record<string, ZooMap> = Object.fromEntries(SPECS.map((s) => [s.id, build(s)]));
export const MAP_IDS = SPECS.map((s) => s.id);

export function getMap(id: string): ZooMap {
  return MAPS[id] ?? MAPS.A;
}

/** 把形状（以 anchor 格为原点）放到地图上，返回格子下标；越界返回 null */
export function placeShape(map: ZooMap, anchor: number, shape: Axial[]): number[] | null {
  const a = map.cells[anchor];
  if (!a) return null;
  const out: number[] = [];
  for (const [dq, dr] of shape) {
    const i = map.byAxial.get(`${a.q + dq},${a.r + dr}`);
    if (i === undefined) return null;
    out.push(i);
  }
  return out;
}
