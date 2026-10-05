import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Run } from '../game/run';
import { Compendium, Overlays, SelectionOverlay } from './components/Overlays';
import { TooltipLayer, hideTip, stageInfo } from './components/Tooltip';
import { TopBar } from './components/TopBar';
import { CombatScreen } from './screens/CombatScreen';
import { MapScreen } from './screens/MapScreen';
import { CharSelectScreen, MenuScreen } from './screens/MenuScreens';
import {
  AncientScreen,
  BossRelicScreen,
  EventScreen,
  GameOverScreen,
  RestScreen,
  RewardScreen,
  ShopScreen,
  TreasureScreen,
} from './screens/RoomScreens';
import { refresh, useStore } from './store';
import { sfxForScreen } from './sound';

interface Dims {
  W: number;
  H: number;
  s: number;
  ox: number;
  oy: number;
  portrait: boolean;
}

/** 根据视口计算逻辑舞台尺寸：横屏约 1280 宽，竖屏 500 宽 */
function computeDims(vw: number, vh: number): Dims {
  const aspect = vw / Math.max(1, vh);
  let W: number;
  let H: number;
  let portrait = false;
  if (aspect >= 1.15) {
    H = 720;
    W = Math.round(720 * aspect);
    if (W < 1180) {
      W = 1180;
      H = Math.round(1180 / aspect);
    }
    if (W > 1700) W = 1700;
  } else {
    portrait = true;
    W = 500;
    H = Math.round(500 / aspect);
    if (H < 820) H = 820;
  }
  const s = Math.min(vw / W, vh / H);
  return { W, H, s, ox: (vw - W * s) / 2, oy: (vh - H * s) / 2, portrait };
}

export function App() {
  const st = useStore();
  const vpRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<Dims>(() => computeDims(window.innerWidth, window.innerHeight));

  useLayoutEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    const update = () => setDims(computeDims(el.clientWidth, el.clientHeight));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  stageInfo.el = stageRef.current;
  stageInfo.scale = dims.s;
  stageInfo.w = dims.W;
  stageInfo.h = dims.H;
  useLayoutEffect(() => {
    stageInfo.el = stageRef.current;
  });

  const run = st.run;
  const actBg = run && st.view === 'run' ? `bg-act${run.act}` : 'bg-menu';
  useEffect(() => sfxForScreen(run?.screen.s ?? st.view), [run?.screen.s, st.view]);

  return (
    <div class="viewport" ref={vpRef} onContextMenu={(e) => e.preventDefault()}>
      <div
        ref={stageRef}
        class={`stage ${dims.portrait ? 'portrait' : 'landscape'}`}
        style={{
          width: `${dims.W}px`,
          height: `${dims.H}px`,
          transform: `translate(${dims.ox}px, ${dims.oy}px) scale(${dims.s})`,
        }}
      >
        <div class={`bg ${actBg}`} />
        {st.view === 'menu' && (
          <div class="screen">
            <MenuScreen />
          </div>
        )}
        {st.view === 'charSelect' && (
          <div class="screen">
            <CharSelectScreen />
          </div>
        )}
        {st.view === 'compendium' && <Compendium />}
        {st.view === 'run' && run && <RunView run={run} />}
        <Overlays />
        {run && run.selection && <SelectionOverlay run={run} />}
        <Toasts run={run} />
        <TooltipLayer />
      </div>
    </div>
  );
}

function RunView({ run }: { run: Run }) {
  const sc = run.screen.s;
  return (
    <div class="screen" onPointerDown={() => hideTip()}>
      <TopBar run={run} />
      {sc === 'combat' && run.combat && <CombatScreen key={`${run.floor}-${run.act}`} run={run} />}
      {sc === 'map' && <MapScreen run={run} />}
      {sc === 'reward' && <RewardScreen run={run} />}
      {sc === 'shop' && <ShopScreen run={run} />}
      {sc === 'rest' && <RestScreen run={run} />}
      {sc === 'event' && <EventScreen run={run} />}
      {sc === 'treasure' && <TreasureScreen run={run} />}
      {sc === 'bossRelic' && <BossRelicScreen run={run} />}
      {sc === 'ancient' && <AncientScreen run={run} />}
      {sc === 'gameover' && <GameOverScreen run={run} />}
    </div>
  );
}

function Toasts({ run }: { run: Run | null }) {
  const toasts = run?.toasts ?? [];
  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => {
      run!.toasts.shift();
      refresh();
    }, 2600);
    return () => clearTimeout(t);
  }, [toasts.length, toasts[0]?.id]);
  if (!toasts.length) return null;
  return (
    <div class="toasts">
      {toasts.map((t) => (
        <div class="toast" key={t.id}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
