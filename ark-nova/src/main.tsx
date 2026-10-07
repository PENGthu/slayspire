import { render } from 'preact';
import './ui/styles.css';
import { App } from './ui/App';
import { aiMove } from './game/ai';
import { decision } from './game/engine';
import { act, debugState, state } from './ui/store';

render(<App />, document.getElementById('app')!);

// 调试入口：浏览器控制台中可通过 __ark 查看界面与对局状态
(window as unknown as Record<string, unknown>).__ark = debugState;
/** 调试：让 AI 替当前玩家走一步 */
(window as unknown as Record<string, unknown>).__arkAuto = () => {
  const g = state.g;
  if (!g || !decision(g)) return false;
  return act(aiMove(g, 'normal'));
};
