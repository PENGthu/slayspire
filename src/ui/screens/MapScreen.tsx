import { useEffect, useRef } from 'preact/hooks';
import { MAP_H, MAP_W, ROOM_NAMES, ZONE_NAMES } from '../../game/map';
import { ENCOUNTERS, ENEMIES } from '../../game/registry';
import type { Run } from '../../game/run';
import type { MapNode, RoomKind } from '../../game/types';
import { stageInfo, tipProps } from '../components/Tooltip';
import { act } from '../store';
import { enemyArtUrl } from '../art/enemyArt';
import { mapIconUrl } from '../art/mapArt';

export function MapScreen({ run, readonly = false }: { run: Run; readonly?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const portrait = stageInfo.w < stageInfo.h;
  const colGap = Math.min(110, (stageInfo.w - 100) / (MAP_W - 1));
  const rowGap = portrait ? 80 : 92;
  const padTop = 210;
  const padBottom = 90;
  const side = portrait ? 50 : 80;
  const width = (MAP_W - 1) * colGap + side * 2;
  const height = padTop + (MAP_H - 1) * rowGap + padBottom;
  const pos = (n: MapNode) => ({
    x: side + (n.col + n.dx) * colGap,
    y: padTop + (MAP_H - 1 - n.row) * rowGap + n.dy * rowGap,
  });
  const reach = readonly ? [] : run.reachable();
  const reachSet = new Set(reach.map((n) => `${n.row}-${n.col}`));
  const curRow = run.pos?.row ?? -1;
  const visitedSet = new Set(run.path.map(([r, c]) => `${r}-${c}`));
  const edgeSet = new Set(run.path.slice(1).map(([r, c], i) => `${run.path[i][0]}-${run.path[i][1]}-${c}-${r}`));
  const boss = ENCOUNTERS[run.boss];
  const bossArt = boss && Array.isArray(boss.enemies) ? enemyArtUrl([...boss.enemies].sort((a, b) => (ENEMIES[b]?.size ?? 1) - (ENEMIES[a]?.size ?? 1))[0]) : null;
  const bossX = width / 2;
  const bossY = 110;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const targetRow = Math.max(0, curRow);
    const y = padTop + (MAP_H - 1 - targetRow) * rowGap;
    el.scrollTop = Math.max(0, y - el.clientHeight * 0.65);
  }, [run.act, curRow]);

  const lines: preact.JSX.Element[] = [];
  for (const row of run.map.rows) {
    for (const n of row) {
      if (!n) continue;
      const a = pos(n);
      for (const c of n.next) {
        const m = run.map.rows[n.row + 1]?.[c];
        if (!m) continue;
        const b = pos(m);
        const travelled = edgeSet.has(`${n.row}-${n.col}-${c}-${m.row}`);
        lines.push(
          <line
            key={`${n.row}-${n.col}-${c}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={travelled ? '#7a1e14' : '#4a3420'}
            stroke-width={travelled ? 4 : 3}
            stroke-dasharray={travelled ? '0' : '2 9'}
            opacity={travelled ? 0.9 : 0.7}
            stroke-linecap="round"
          />,
        );
      }
      if (n.row === MAP_H - 1) {
        lines.push(
          <line key={`${n.row}-${n.col}-boss`} x1={a.x} y1={a.y} x2={bossX} y2={bossY + 60} stroke="#4a3420" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round" opacity="0.7" />,
        );
      }
    }
  }

  return (
    <div class="screen" style={{ position: 'relative' }}>
      <div class="map-title">
        {ZONE_NAMES[run.zone]?.name}
        <small>
          第 {run.act} 幕 · {ZONE_NAMES[run.zone]?.en}
        </small>
      </div>
      <div class="map-legend panel">
        {(['monster', 'elite', 'rest', 'shop', 'event', 'treasure'] as RoomKind[]).map((k) => (
          <div class="row" key={k}>
            <img class="legend-icon" src={mapIconUrl(k)} alt="" draggable={false} />
            <span>{ROOM_NAMES[k]}</span>
          </div>
        ))}
      </div>
      <div class="map-wrap" ref={wrapRef}>
        <div class="map-inner" style={{ width: `${width}px`, height: `${height}px` }}>
          <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
            {lines}
          </svg>
          <div
            class={`map-boss ${!readonly && run.bossReachable ? 'reachable' : ''}`}
            style={{ left: `${bossX}px`, top: `${bossY}px` }}
            onClick={() => !readonly && run.bossReachable && act(() => run.enterBoss())}
          >
            <div class="face">{bossArt ? <img src={bossArt} alt="" draggable={false} /> : (boss?.art ?? '💀')}</div>
            <div class="label">首领：{boss?.name}</div>
          </div>
          {run.map.rows.flat().map((n) => {
            if (!n) return null;
            const p = pos(n);
            const key = `${n.row}-${n.col}`;
            const reachable = reachSet.has(key);
            const isCur = run.pos?.row === n.row && run.pos?.col === n.col;
            const visited = visitedSet.has(key);
            return (
              <div
                key={key}
                class={`map-node k-${n.kind} ${reachable ? 'reachable' : ''} ${isCur ? 'current' : ''} ${visited && !isCur ? 'visited' : ''} ${!reachable && !visited && !readonly ? 'unreach' : ''}`}
                style={{ left: `${p.x}px`, top: `${p.y}px` }}
                onClick={() => reachable && act(() => run.enterNode(n.row, n.col))}
                {...tipProps([{ title: ROOM_NAMES[n.kind], body: roomDesc(n.kind) }], 'right')}
              >
                <img src={mapIconUrl(n.kind)} alt="" draggable={false} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function roomDesc(k: RoomKind): string {
  switch (k) {
    case 'monster':
      return '与普通敌人战斗。';
    case 'elite':
      return '与强大的精英敌人战斗，获胜可获得遗物。';
    case 'rest':
      return '休息以回复生命，或锻造升级一张牌。';
    case 'shop':
      return '购买卡牌、遗物和药水，或移除卡牌。';
    case 'event':
      return '未知的遭遇。可能是事件、战斗或其他。';
    case 'treasure':
      return '打开宝箱获得遗物。';
    default:
      return '';
  }
}
