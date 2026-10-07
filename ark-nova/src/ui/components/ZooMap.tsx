// 动物园地图：六边形格子、地形、放置奖励、建筑与动物；支持建筑放置预览和选择建筑。
import { buildingDef } from '../../game/buildings';
import { animal } from '../../game/content';
import { hexCorners, hexToPixel } from '../../game/hex';
import { BONUS_INFO, getMap } from '../../game/maps';
import type { Building, PlayerState } from '../../game/types';

const S = 30;
const SQ3 = Math.sqrt(3);

const EDGE_DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
];

const KIND_FILL: Record<string, string> = {
  enclosure: '#e9d9b0',
  kiosk: '#f2b8c6',
  pavilion: '#bfe3c0',
  special: '#d9c6ef',
  sponsor: '#f5d78e',
};

interface Props {
  p: PlayerState;
  /** 刚刚变化的建筑（高亮动画） */
  fresh?: number[];
  /** 放置预览 */
  ghost?: { cells: number[]; ok: boolean } | null;
  /** 可以作为放置锚点的格子 */
  anchors?: Set<number>;
  /** 可以选择的建筑 */
  targets?: Set<number>;
  onCell?: (i: number) => void;
  onHover?: (i: number | null) => void;
  onBuilding?: (uid: number) => void;
  compact?: boolean;
}

export function ZooMap({ p, ghost, anchors, targets, onCell, onHover, onBuilding, compact, fresh }: Props) {
  const map = getMap(p.map);
  const pos = new Map<number, [number, number]>();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of map.list) {
    const [x, y] = hexToPixel(c.q, c.r, S);
    pos.set(c.i, [x, y]);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const pad = S * 1.05;
  const vb = `${minX - (SQ3 / 2) * S - 4} ${minY - S - 4} ${maxX - minX + SQ3 * S + 8} ${maxY - minY + 2 * S + 8}`;
  void pad;
  const owner = new Map<number, Building>();
  for (const b of p.buildings) for (const c of b.cells) owner.set(c, b);
  const ghostSet = new Set(ghost?.cells ?? []);
  const poly = (i: number, shrink = 0) =>
    hexCorners(...pos.get(i)!, S - shrink)
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ');

  return (
    <svg class={`zoo-map ${compact ? 'compact' : ''}`} viewBox={vb} onMouseLeave={() => onHover?.(null)}>
      <defs>
        <pattern id="water" width="12" height="8" patternUnits="userSpaceOnUse">
          <rect width="12" height="8" fill="#7fb8d8" />
          <path d="M0 5 Q3 2 6 5 T12 5" stroke="#d8eef8" stroke-width="1.2" fill="none" opacity="0.8" />
        </pattern>
        <pattern id="rock" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="#a3998a" />
          <path d="M1 8 L4 3 L7 8 Z" fill="#8a8072" />
        </pattern>
        <pattern id="upg" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#cfe0a8" />
          <rect width="2" height="6" fill="#bcd08f" />
        </pattern>
      </defs>
      {map.list.map((c) => {
        const [x, y] = pos.get(c.i)!;
        const fill = c.terrain === 'water' ? 'url(#water)' : c.terrain === 'rock' ? 'url(#rock)' : c.upgrade ? 'url(#upg)' : '#d6e6b5';
        const isAnchor = anchors?.has(c.i);
        return (
          <g
            class={`cell ${isAnchor ? 'anchor' : ''}`}
            onClick={() => onCell?.(c.i)}
            onMouseEnter={() => onHover?.(c.i)}
          >
            <polygon points={poly(c.i)} fill={fill} stroke="#9fb37d" stroke-width="1" />
            {c.upgrade && !owner.has(c.i) && (
              <text x={x} y={y + S * 0.62} class="upg-label">
                II
              </text>
            )}
            {c.bonus && !owner.has(c.i) && (
              <text x={x} y={y + 6} class="bonus" font-size="17">
                <title>{BONUS_INFO[c.bonus].label}</title>
                {BONUS_INFO[c.bonus].icon}
              </text>
            )}
            {isAnchor && !ghostSet.size && <circle cx={x} cy={y} r={4} class="anchor-dot" />}
          </g>
        );
      })}
      {p.buildings.map((b) => (
        <BuildingShape
          b={b}
          pos={pos}
          poly={poly}
          owner={owner}
          target={targets?.has(b.uid)}
          fresh={fresh?.includes(b.uid)}
          dim={!!targets && !targets.has(b.uid)}
          onClick={onBuilding ? () => onBuilding(b.uid) : undefined}
          onCell={onCell}
        />
      ))}
      {ghost &&
        ghost.cells.map((i) =>
          pos.has(i) ? <polygon class={`ghost ${ghost.ok ? 'ok' : 'bad'}`} points={poly(i, 2)} onClick={() => onCell?.(i)} /> : null,
        )}
    </svg>
  );
}

function BuildingShape({
  b,
  pos,
  poly,
  owner,
  target,
  fresh,
  dim,
  onClick,
  onCell,
}: {
  b: Building;
  fresh?: boolean;
  pos: Map<number, [number, number]>;
  poly: (i: number, shrink?: number) => string;
  owner: Map<number, Building>;
  target?: boolean;
  dim?: boolean;
  onClick?: () => void;
  onCell?: (i: number) => void;
}) {
  const def = buildingDef(b.type);
  const fill = b.animals.length && def.kind === 'enclosure' ? '#e2c98f' : KIND_FILL[def.kind];
  const centers = b.cells.map((i) => pos.get(i)!);
  const cx = centers.reduce((s, c) => s + c[0], 0) / centers.length;
  const cy = centers.reduce((s, c) => s + c[1], 0) / centers.length;
  // 外轮廓：相邻格不属于同一建筑的边
  const edges: string[] = [];
  for (const i of b.cells) {
    const [x, y] = pos.get(i)!;
    const corners = hexCorners(x, y, S);
    for (let e = 0; e < 6; e++) {
      const [dq, dr] = EDGE_DIRS[e];
      const [px, py] = hexToPixel(dq, dr, S);
      const nx = x + px;
      const ny = y + py;
      let same = false;
      for (const j of b.cells) {
        const q = pos.get(j)!;
        if (Math.abs(q[0] - nx) < 1 && Math.abs(q[1] - ny) < 1) same = true;
      }
      if (!same) {
        const a = corners[e];
        const c2 = corners[(e + 1) % 6];
        edges.push(`M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${c2[0].toFixed(1)} ${c2[1].toFixed(1)}`);
      }
    }
  }
  void owner;
  const label =
    b.animals.length > 0
      ? b.animals.map((id) => animal(id).emoji).join('')
      : def.kind === 'enclosure'
        ? ''
        : def.emoji;
  const fontSize = b.animals.length > 2 ? 15 : b.animals.length === 2 ? 19 : def.kind === 'enclosure' ? 26 : 22;
  return (
    <g class={`building ${target ? 'target' : ''} ${dim ? 'dim' : ''} ${fresh ? 'fresh' : ''} ${def.kind}`} onClick={onClick}>
      {b.cells.map((i) => (
        <polygon points={poly(i)} fill={fill} stroke={fill} stroke-width="1" onClick={() => !onClick && onCell?.(i)} />
      ))}
      <path d={edges.join('')} class="b-outline" />
      {def.kind === 'enclosure' && b.animals.length === 0 && (
        <text x={cx} y={cy + 6} class="b-size">
          {b.cells.length}
        </text>
      )}
      {label && (
        <text x={cx} y={cy + fontSize * 0.36} font-size={fontSize} class="b-label">
          {label}
        </text>
      )}
      {def.kind === 'special' && def.capacity && (
        <text x={cx} y={cy + 22} class="b-cap">
          {b.animals.reduce((s, id) => s + (animal(id).special?.units ?? 1), 0)}/{def.capacity}
        </text>
      )}
      <title>
        {def.name}
        {b.animals.length ? `：${b.animals.map((id) => animal(id).name).join('、')}` : ''}
      </title>
    </g>
  );
}
