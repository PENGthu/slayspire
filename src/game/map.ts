import { Rng } from '../core/rng';
import type { MapData, MapNode, RoomKind } from './types';

export const MAP_W = 7;
export const MAP_H = 15;
const PATHS = 6;

/** 按照《杀戮尖塔》的规则生成一层地图：6 条不交叉的路径，再分配房间类型。 */
export function generateMap(rng: Rng, act: number, ascension = 0): MapData {
  const edges: Set<string>[][] = [];
  for (let r = 0; r < MAP_H; r++) {
    edges.push([]);
    for (let c = 0; c < MAP_W; c++) edges[r].push(new Set());
  }
  const has = (r: number, c: number, nc: number) => edges[r]?.[c]?.has(String(nc));

  const starts: number[] = [];
  for (let p = 0; p < PATHS; p++) {
    let col = rng.int(0, MAP_W - 1);
    if (p === 1) {
      let guard = 0;
      while (col === starts[0] && guard++ < 20) col = rng.int(0, MAP_W - 1);
    }
    starts.push(col);
    for (let r = 0; r < MAP_H - 1; r++) {
      const options = [col - 1, col, col + 1].filter((nc) => {
        if (nc < 0 || nc >= MAP_W) return false;
        // 不允许与已有路径交叉
        if (nc === col - 1 && has(r, col - 1, col)) return false;
        if (nc === col + 1 && has(r, col + 1, col)) return false;
        return true;
      });
      const nc = rng.pick(options.length ? options : [col]);
      edges[r][col].add(String(nc));
      col = nc;
    }
    // 最后一行（营火）指向 Boss
    edges[MAP_H - 1][col].add('boss');
  }

  // 生成节点
  const rows: (MapNode | null)[][] = [];
  for (let r = 0; r < MAP_H; r++) {
    rows.push([]);
    for (let c = 0; c < MAP_W; c++) {
      const out = edges[r][c];
      const incoming = r === 0 ? true : edges[r - 1].some((s) => s.has(String(c)));
      if (out.size === 0 || !incoming) {
        rows[r].push(null);
        continue;
      }
      rows[r].push({
        row: r,
        col: c,
        kind: 'monster',
        next: [...out].filter((x) => x !== 'boss').map(Number).sort((a, b) => a - b),
        dx: (rng.next() - 0.5) * 0.5,
        dy: (rng.next() - 0.5) * 0.4,
      });
    }
  }

  assignRooms(rng, rows, act, ascension);
  return { rows, width: MAP_W, height: MAP_H };
}

function parentsOf(rows: (MapNode | null)[][], node: MapNode): MapNode[] {
  if (node.row === 0) return [];
  return rows[node.row - 1].filter((p): p is MapNode => !!p && p.next.includes(node.col));
}

function assignRooms(rng: Rng, rows: (MapNode | null)[][], act: number, ascension: number) {
  const bag: [RoomKind, number][] = [
    ['shop', 5],
    ['rest', 12],
    ['event', 22],
    ['elite', (act === 1 ? 8 : 10) * (ascension >= 1 ? 1.6 : 1)],
    ['monster', 45],
  ];
  const special = new Set<RoomKind>(['elite', 'rest', 'shop', 'treasure']);
  for (let r = 0; r < MAP_H; r++) {
    for (const node of rows[r]) {
      if (!node) continue;
      if (r === 0) {
        node.kind = 'monster';
        continue;
      }
      if (r === 8) {
        node.kind = 'treasure';
        continue;
      }
      if (r === MAP_H - 1) {
        node.kind = 'rest';
        continue;
      }
      const parents = parentsOf(rows, node);
      const siblings = parents.flatMap((p) => p.next.map((c) => rows[r][c])).filter((n): n is MapNode => !!n && n !== node);
      let chosen: RoomKind = 'monster';
      for (let tries = 0; tries < 12; tries++) {
        const k = rng.weighted(bag);
        if ((k === 'elite' || k === 'rest') && r < 5) continue;
        if (k === 'rest' && r >= MAP_H - 2) continue;
        if (special.has(k) && parents.some((p) => p.kind === k)) continue;
        if (k !== 'monster' && siblings.some((s) => s.kind === k && s.col < node.col)) continue;
        chosen = k;
        break;
      }
      node.kind = chosen;
    }
  }
}

/** 起始可选节点（第 0 行） */
export function startNodes(map: MapData): MapNode[] {
  return map.rows[0].filter((n): n is MapNode => !!n);
}

export function nodeAt(map: MapData, row: number, col: number): MapNode | null {
  return map.rows[row]?.[col] ?? null;
}

export const ZONE_NAMES: Record<string, { name: string; en: string }> = {
  overgrowth: { name: '蔓生密林', en: 'THE OVERGROWTH' },
  underdocks: { name: '地下船坞', en: 'THE UNDERDOCKS' },
  hive: { name: '嗡鸣蜂巢', en: 'THE HIVE' },
  glory: { name: '荣光之巅', en: 'THE GLORY' },
};

export const ROOM_NAMES: Record<RoomKind, string> = {
  monster: '敌人',
  elite: '精英',
  rest: '休息处',
  shop: '商人',
  event: '未知',
  treasure: '宝箱',
  boss: '首领',
  ancient: '先古之民',
};
