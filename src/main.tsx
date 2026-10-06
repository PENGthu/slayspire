import { render } from 'preact';
import './game/content';
import './ui/styles.css';
import { App } from './ui/App';
import { installArtStyles } from './ui/art/frames';
import { initCloud } from './cloud/sync';
import { act, loadRun, refresh, state } from './ui/store';

interface HotData {
  view?: string;
}
interface Hot {
  data?: HotData;
  snapshot?: (fn: () => HotData) => void;
  ready?: (start: (data: HotData) => void) => void;
}

/** 页面热更新后，回到更新前所在的界面（对局从存档恢复） */
function start(data: HotData) {
  if (data?.view === 'run') {
    const run = loadRun();
    if (run) {
      state.run = run;
      state.view = 'run';
    }
  } else if (data?.view === 'compendium' || data?.view === 'charSelect') {
    state.view = data.view;
  }
  installArtStyles();
  initCloud();
  render(<App />, document.getElementById('app')!);
}

const hot = (window as unknown as { claude?: { hot?: Hot } }).claude?.hot;
hot?.snapshot?.(() => ({ view: state.view }));
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});

// 调试入口：浏览器控制台中可通过 __spire 查看游戏状态
(window as unknown as Record<string, unknown>).__spire = { state, act, refresh };
