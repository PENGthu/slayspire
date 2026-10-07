import { render } from 'preact';
import './ui/styles.css';
import { App } from './ui/App';
import { aiMove } from './game/ai';
import { act, canUndo, debugState, state, undo } from './ui/store';
import { myDecision } from './ui/interact';
import { autoJoinFromLink } from './ui/screens/Online';
import { current } from './net/online';

// 打开邀请链接（#join=房间号）时直接进入联机
autoJoinFromLink();
render(<App />, document.getElementById('app')!);

// 调试入口：浏览器控制台中可通过 __ark 查看界面与对局状态
(window as unknown as Record<string, unknown>).__ark = debugState;
/** 调试：轮到本机玩家时，让 AI 替他走一步 */
(window as unknown as Record<string, unknown>).__arkAuto = (level: 'easy' | 'normal' | 'hard' = 'normal') => {
  const g = state.g;
  if (!g || !myDecision(g)) return false;
  return act(aiMove(g, level));
};
/** 调试：撤销 */
(window as unknown as Record<string, unknown>).__arkUndo = () => {
  if (!canUndo()) return false;
  undo();
  return true;
};
/** 调试：联机房间 */
(window as unknown as Record<string, unknown>).__arkNet = () => {
  const c = current();
  if (!c) return null;
  const r = c.host ?? c.guest!;
  return { role: c.role, seq: r.seq, syncing: c.guest?.syncing, hostOnline: c.guest?.hostOnline(), undoSeat: r.undoSeat, lobby: r.lobby };
};
