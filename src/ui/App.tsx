import { useErrorBoundary, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
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
import { refresh, state, useStore } from './store';
import { sfxForScreen } from './sound';
import { SCENE_GROUND, sceneUrl } from './art/sceneArt';
import { CardReveal } from './components/CardReveal';
import { AchievementToasts } from './components/Achievements';
import { setRasterScale } from './art/raster';
import { Swap, installTransitions } from './transition';

/** 让场景的地面线对齐到人物站立的高度 */
function sceneOffset(d: Dims): number {
  const s = Math.max(d.W / 1600, d.H / 900);
  const target = d.portrait ? d.H * 0.45 : 432;
  return Math.round(Math.min(0, Math.max(d.H - 900 * s, target - SCENE_GROUND * s)));
}

const SCENE_OF: Record<string, string> = { 'bg-act1': 'overgrowth', 'bg-docks': 'underdocks', 'bg-act2': 'hive', 'bg-act3': 'glory', 'bg-menu': 'menu' };

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
  setRasterScale(dims.s);
  stageInfo.w = dims.W;
  stageInfo.h = dims.H;
  useLayoutEffect(() => {
    stageInfo.el = stageRef.current;
  });
  useLayoutEffect(() => (stageRef.current ? installTransitions(stageRef.current) : undefined), []);

  const run = st.run;
  const actBg = run && st.view === 'run' ? (run.zone === 'underdocks' ? 'bg-docks' : `bg-act${run.act}`) : 'bg-menu';
  useEffect(() => sfxForScreen(run?.screen.s ?? st.view), [run?.screen.s, st.view]);
  useEffect(() => hideTip(), [run?.screen.s, st.view, st.overlay, run?.selection]);

  return (
    <div class="viewport" ref={vpRef} onContextMenu={(e) => e.preventDefault()}>
      <div
        ref={stageRef}
        class={`stage ${dims.portrait ? 'portrait' : 'landscape'}${st.profile.settings.fast ? ' fast' : ''}`}
        style={{
          width: `${dims.W}px`,
          height: `${dims.H}px`,
          transform: `translate(${dims.ox}px, ${dims.oy}px) scale(${dims.s})`,
        }}
      >
        <div
          key={actBg}
          class={`bg ${actBg} ${run && st.view === 'run' && run.screen.s !== 'combat' ? 'bg-dim' : ''}`}
          style={{ backgroundImage: `url("${sceneUrl(SCENE_OF[actBg] ?? 'menu')}")`, backgroundSize: 'cover', backgroundPosition: `50% ${sceneOffset(dims)}px` }}
        />
        <Swap k={st.view} cls="screen">
          {st.view === 'menu' && <MenuScreen />}
          {st.view === 'charSelect' && <CharSelectScreen />}
          {st.view === 'compendium' && <Compendium />}
          {st.view === 'run' && run && (
            <ErrorGuard>
              <RunView run={run} />
            </ErrorGuard>
          )}
        </Swap>
        <Overlays />
        {run && run.selection && <SelectionOverlay run={run} />}
        {st.view === 'run' && run && <CardReveal run={run} />}
        <Toasts run={run} />
        <AchievementToasts />
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
      <Swap k={`${sc}-${run.act}-${run.floor}`} cls="run-body" appear={false}>
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
      </Swap>
    </div>
  );
}

/** 界面渲染出错时，提示并允许返回主菜单（存档不受影响） */
function ErrorGuard({ children }: { children: ComponentChildren }) {
  const [error, reset] = useErrorBoundary((e) => console.error(e));
  if (error) {
    return (
      <div class="screen" style={{ alignItems: 'center', justifyContent: 'center', gap: '16px', display: 'flex' }}>
        <h2 style={{ fontFamily: 'var(--f-serif)', margin: 0 }}>画面出了点问题</h2>
        <div style={{ color: 'var(--muted)', maxWidth: '60ch', textAlign: 'center' }}>
          {String((error as Error)?.message ?? error)}
          <br />
          进度已自动保存，返回主菜单后点击「继续攀登」即可接着玩。
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button class="btn" onClick={() => reset()}>
            重试
          </button>
          <button
            class="btn primary"
            onClick={() => {
              state.run = null;
              state.view = 'menu';
              reset();
              refresh();
            }}
          >
            返回主菜单
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
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
