// 动物园地图（平顶六边形，与原版地图一致）：地形、放置奖励、特殊地形、建筑与动物、左侧的玩家标记；
// 支持建筑放置预览和选择建筑。
import { buildingDef } from '../../game/buildings';
import { animal } from '../../game/content';
import { hexCorners, hexToPixel } from '../../game/hex';
import { BONUS_INFO, getMap, LEFT_INFO, type Feature } from '../../game/maps';
import type { Building, PlayerState } from '../../game/types';

const S = 30;
const SQ3 = Math.sqrt(3);

const KIND_FILL: Record<string, string> = {
  enclosure: '#e9d9b0',
  kiosk: '#f2b8c6',
  pavilion: '#bfe3c0',
  special: '#d9c6ef',
  sponsor: '#f5d78e',
};

const FEATURE_ICON: Partial<Record<Feature, { icon: string; label: string }>> = {
  tower: { icon: '🗼', label: '观景塔：放进相邻标准围栏的动物吸引力 +2' },
  gate: { icon: '🌳', label: '户外区：相邻的标准围栏视为大 2 格' },
  restaurant: { icon: '🍽️', label: '公园餐厅：休息时每个相邻的被覆盖格 +1 元' },
  hills: { icon: '🎬', label: '好莱坞山：覆盖时翻到第一张赞助卡加入手牌' },
  harbor: { icon: '⚓', label: '商港：这里有建筑后，每回合可弃 1 张手牌换 3 元' },
  institute: { icon: '🔭', label: '研究所：这里有建筑后，每次打出动物可忽略 1 个条件' },
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
  for (const c of map.cells) {
    const [x, y] = hexToPixel(c.q, c.r, S);
    pos.set(c.i, [x, y]);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  // 左侧留出放 7 个玩家标记的位置
  const leftW = S * 1.9;
  const x0 = minX - S - 4 - leftW;
  const y0 = minY - (SQ3 / 2) * S - 4;
  const w = maxX - minX + 2 * S + 8 + leftW;
  const h = maxY - minY + SQ3 * S + 8;
  const owner = new Map<number, Building>();
  for (const b of p.buildings) for (const c of b.cells) owner.set(c, b);
  const ghostSet = new Set(ghost?.cells ?? []);
  const poly = (i: number, shrink = 0) =>
    hexCorners(...pos.get(i)!, S - shrink)
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ');
  const tokenH = h / 7.4;
  const leftX = x0 + 4;

  return (
    <svg class={`zoo-map ${compact ? 'compact' : ''}`} viewBox={`${x0} ${y0} ${w} ${h}`} onMouseLeave={() => onHover?.(null)}>
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
      {map.left.map((lb, i) => {
        const y = y0 + 6 + i * tokenH;
        const present = p.mapTokens.includes(i);
        const info = LEFT_INFO[lb.id];
        return (
          <g class={`left-token ${lb.recurring ? 'recurring' : ''} ${present ? 'present' : 'taken'}`}>
            <title>
              {`${lb.recurring ? '紫色（拿走时获得，之后每次休息再获得一次）' : '黄色（拿走时获得一次）'}：${info.label}${present ? '' : '（已露出）'}`}
            </title>
            <rect x={leftX} y={y} width={leftW - 10} height={tokenH - 6} rx={6} />
            {present && <circle cx={leftX + (leftW - 10) / 2} cy={y + (tokenH - 6) / 2} r={Math.min(tokenH, leftW) * 0.3} fill={p.color} class="lt-disc" />}
            <text x={leftX + (leftW - 10) / 2} y={y + (tokenH - 6) / 2 + 5} class="lt-icon">
              {info.icon}
            </text>
          </g>
        );
      })}
      {map.cells.map((c) => {
        const [x, y] = pos.get(c.i)!;
        const fill = c.terrain === 'water' ? 'url(#water)' : c.terrain === 'rock' ? 'url(#rock)' : c.upgrade ? 'url(#upg)' : '#d6e6b5';
        const isAnchor = anchors?.has(c.i);
        const feat = c.feature ? FEATURE_ICON[c.feature] : undefined;
        return (
          <g class={`cell ${isAnchor ? 'anchor' : ''}`} onClick={() => onCell?.(c.i)} onMouseEnter={() => onHover?.(c.i)}>
            <polygon points={poly(c.i)} fill={fill} stroke={c.border ? '#8aa06a' : '#9fb37d'} stroke-width="1" />
            {c.upgrade && !owner.has(c.i) && (
              <text x={x} y={y + S * 0.72} class="upg-label">
                II
              </text>
            )}
            {c.bonus && !owner.has(c.i) && c.bonus.startsWith('money') && (
              <g class="bonus">
                <title>{BONUS_INFO[c.bonus].label}</title>
                <circle cx={x} cy={y} r={10} class="coin" />
                <text x={x} y={y + 4} class="coin-num">
                  {BONUS_INFO[c.bonus].icon}
                </text>
              </g>
            )}
            {c.bonus && !owner.has(c.i) && !c.bonus.startsWith('money') && (
              <text x={x} y={y + 6} class="bonus" font-size="16">
                <title>{BONUS_INFO[c.bonus].label}</title>
                {BONUS_INFO[c.bonus].icon}
              </text>
            )}
            {feat && !owner.has(c.i) && (
              <text x={x} y={y + 7} class="feature" font-size="19">
                <title>{feat.label}</title>
                {feat.icon}
              </text>
            )}
            {isAnchor && !ghostSet.size && <circle cx={x} cy={y} r={4} class="anchor-dot" />}
          </g>
        );
      })}
      {p.buildings.map((b) => (
        <BuildingShape
          b={b}
          p={p}
          pos={pos}
          poly={poly}
          target={targets?.has(b.uid)}
          fresh={fresh?.includes(b.uid)}
          dim={!!targets && !targets.has(b.uid)}
          onClick={onBuilding ? () => onBuilding(b.uid) : undefined}
          onCell={onCell}
        />
      ))}
      {ghost && ghost.cells.map((i) => (pos.has(i) ? <polygon class={`ghost ${ghost.ok ? 'ok' : 'bad'}`} points={poly(i, 2)} onClick={() => onCell?.(i)} /> : null))}
    </svg>
  );
}

function BuildingShape({
  b,
  p,
  pos,
  poly,
  target,
  fresh,
  dim,
  onClick,
  onCell,
}: {
  b: Building;
  p: PlayerState;
  fresh?: boolean;
  pos: Map<number, [number, number]>;
  poly: (i: number, shrink?: number) => string;
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
  // 外轮廓：相邻格不属于同一建筑的边（平顶六边形：第 e 条边朝向 60e + 30 度）
  const edges: string[] = [];
  for (const i of b.cells) {
    const [x, y] = pos.get(i)!;
    const corners = hexCorners(x, y, S);
    for (let e = 0; e < 6; e++) {
      const a = ((60 * e + 30) * Math.PI) / 180;
      const nx = x + SQ3 * S * Math.cos(a);
      const ny = y + SQ3 * S * Math.sin(a);
      const same = b.cells.some((j) => {
        const q = pos.get(j)!;
        return Math.abs(q[0] - nx) < 1 && Math.abs(q[1] - ny) < 1;
      });
      if (!same) {
        const c1 = corners[e];
        const c2 = corners[(e + 1) % 6];
        edges.push(`M${c1[0].toFixed(1)} ${c1[1].toFixed(1)}L${c2[0].toFixed(1)} ${c2[1].toFixed(1)}`);
      }
    }
  }
  const label = b.animals.length > 0 ? b.animals.map((id) => animal(id).emoji).join('') : def.kind === 'enclosure' ? '' : def.emoji;
  const fontSize = b.animals.length > 2 ? 14 : b.animals.length === 2 ? 18 : def.kind === 'enclosure' ? 26 : 22;
  const tucked = p.tucked[String(b.uid)]?.length ?? 0;
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
          {def.special === 'petting' ? b.animals.length : b.animals.reduce((s, id) => s + (animal(id).special?.units ?? 1), 0)}/{def.capacity}
        </text>
      )}
      {tucked > 0 && (
        <text x={cx + 14} y={cy - 10} class="b-cap">
          +{tucked}🃏
        </text>
      )}
      <title>
        {def.name}
        {b.animals.length ? `：${b.animals.map((id) => animal(id).name).join('、')}` : ''}
        {tucked ? `（育儿袋里压了 ${tucked} 张牌）` : ''}
      </title>
    </g>
  );
}
