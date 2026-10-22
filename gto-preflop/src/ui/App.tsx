import { useEffect, useState } from 'preact/hooks';
import { type View, setState, updateSettings, useAppState } from './store';
import { Ranges } from './views/Ranges';
import { Solver } from './views/Solver';
import { Stats } from './views/Stats';
import { Trainer } from './views/Trainer';

const TABS: { id: View; label: string }[] = [
  { id: 'train', label: '训练' },
  { id: 'ranges', label: '范围' },
  { id: 'solver', label: '求解器' },
  { id: 'stats', label: '统计' },
];

export function App() {
  const s = useAppState();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (s.settings.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = s.settings.theme;
    root.dataset.deck = s.settings.fourColor ? '4' : '2';
  }, [s.settings.theme, s.settings.fourColor]);

  return (
    <>
      <header class="topbar">
        <div class="topbar-inner">
          <div class="brand">
            <span class="brand-mark" aria-hidden="true" />
            <span class="brand-name">
              GTO 翻前实验室<small>6-max · 100bb</small>
            </span>
          </div>
          <nav class="tabs" role="tablist">
            {TABS.map((t) => (
              <button type="button" role="tab" class="tab" aria-selected={s.view === t.id} onClick={() => setState({ view: t.id })}>
                {t.label}
              </button>
            ))}
          </nav>
          <button type="button" class="icon-btn" aria-label="设置" onClick={() => setSettingsOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </button>
        </div>
      </header>
      <main class="page">
        {s.view === 'train' && <Trainer />}
        {s.view === 'ranges' && <Ranges />}
        {s.view === 'solver' && <Solver />}
        {s.view === 'stats' && <Stats />}
      </main>
      {settingsOpen && <SettingsDrawer onClose={() => setSettingsOpen(false)} />}
    </>
  );
}

function SettingsDrawer({ onClose }: { onClose: () => void }) {
  const s = useAppState();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="drawer" role="dialog" aria-modal="true" aria-label="设置">
        <div class="row">
          <h2 style={{ font: '800 26px/1 var(--font-display)' }}>设置</h2>
          <span class="spacer" />
          <button type="button" class="btn" onClick={onClose}>
            关闭
          </button>
        </div>
        <div>
          <div class="small muted" style={{ marginBottom: 6 }}>外观</div>
          <div class="seg" role="group" aria-label="外观">
            {(
              [
                ['system', '跟随系统'],
                ['light', '浅色'],
                ['dark', '深色'],
              ] as const
            ).map(([v, l]) => (
              <button type="button" aria-pressed={s.settings.theme === v} onClick={() => updateSettings({ theme: v })}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="set-deck" checked={s.settings.fourColor} onChange={(e) => updateSettings({ fourColor: e.currentTarget.checked })} />
          <span>
            <b>四色牌</b>
            <span>方块蓝色、梅花绿色，更容易分清同花</span>
          </span>
        </label>
        <div class="note">
          <div class="panel-title">快捷键</div>
          <p>
            <kbd>F</kbd> 弃牌 · <kbd>C</kbd> 跟注 · <kbd>R</kbd> 加注 / 3-Bet / 4-Bet · <kbd>A</kbd> 全下
          </p>
          <p>
            <kbd>1</kbd>–<kbd>4</kbd> 按按钮顺序选择 · <kbd>空格</kbd> / <kbd>Enter</kbd> 下一手
          </p>
        </div>
        <div class="note">
          <div class="panel-title">评分规则</div>
          <p>频率最高或 ≥ 50% 的行动为"正确"；20%–50% 为"可以（混合策略）"，也算答对；5%–20% 为"不够准确"；低于 5% 为"错误"。</p>
          <p>随机数模式下，按"全下 → 加注 → 跟注 → 弃牌"的顺序把频率排在 0–99 上，随机数落在哪一段，哪个行动才算对。</p>
        </div>
      </div>
    </div>
  );
}
