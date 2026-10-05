import { render } from 'preact';
import './game/content';
import './ui/styles.css';
import { App } from './ui/App';
import { act, refresh, state } from './ui/store';

render(<App />, document.getElementById('app')!);

// 调试入口：浏览器控制台中可通过 __spire 查看游戏状态
(window as unknown as Record<string, unknown>).__spire = { state, act, refresh };
