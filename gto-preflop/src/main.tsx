import { render } from 'preact';
import { App } from './ui/App';
import './ui/styles.css';
import { getState, setState, type View } from './ui/store';

interface HotData {
  view?: View;
  rangesKey?: string;
}
interface Hot {
  data?: HotData;
  snapshot?: (fn: () => HotData) => void;
  ready?: (start: (data: HotData) => void) => void;
}

function start(data: HotData) {
  if (data?.view) setState({ view: data.view, rangesKey: data.rangesKey ?? getState().rangesKey });
  render(<App />, document.getElementById('app')!);
}

// 发布为 Artifact 后页面更新时，回到更新前所在的页面
const hot = (window as unknown as { claude?: { hot?: Hot } }).claude?.hot;
hot?.snapshot?.(() => ({ view: getState().view, rangesKey: getState().rangesKey }));
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});
