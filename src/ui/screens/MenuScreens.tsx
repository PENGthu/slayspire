import { useState } from 'preact/hooks';
import { hashSeed, randomSeed } from '../../core/rng';
import { CHAR_ORDER, CHARACTERS } from '../../game/characters';
import { RELICS } from '../../game/registry';
import { Run } from '../../game/run';
import type { CharId } from '../../game/types';
import { Portrait, RelicIcon } from '../components/Art';
import { tipProps } from '../components/Tooltip';
import { confirm, deleteSave, loadRun, refresh, setOverlay, startNewRun, state } from '../store';
import { AccountChip } from '../components/Account';
import { cloud } from '../../cloud/sync';

export const ASC_DESC = [
  '标准难度。',
  '精英出现得更频繁。',
  '普通敌人生命 +10%。',
  '精英生命 +10%。',
  '首领生命 +10%。',
  '幕间只回复 75% 的已损失生命。',
  '以 90% 的生命开始。',
  '初始牌组中加入诅咒「攀登者之祸」。',
  '敌人攻击伤害 +10%。',
  '卡牌奖励的升级几率减半。',
  '商店价格 +10%。',
];

function SpireBackdrop() {
  return (
    <svg class="spire-silhouette" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="spg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#e2b04a" stop-opacity="0.55" />
          <stop offset="1" stop-color="#e2b04a" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M640 40 L652 150 L668 160 L676 300 L700 316 L712 520 L746 540 L760 720 L520 720 L534 540 L568 520 L580 316 L604 300 L612 160 L628 150 Z"
        fill="#06070a"
        stroke="url(#spg)"
        stroke-width="2"
      />
      <circle cx="640" cy="34" r="6" fill="#ffe08a" />
      <circle cx="640" cy="34" r="22" fill="#ffe08a" opacity="0.15" />
      <path d="M0 720 L0 640 Q200 600 380 650 T760 640 T1280 620 L1280 720 Z" fill="#05060a" />
    </svg>
  );
}

/** 种子：纯数字或 36 进制字符串直接解析，其他文本取哈希 */
export function parseSeed(t: string): number {
  if (/^[0-9a-z]{1,7}$/i.test(t)) return parseInt(t, 36) >>> 0;
  return hashSeed(t);
}

export function seedText(seed: number): string {
  return seed.toString(36).toUpperCase();
}

export function MenuScreen() {
  const p = state.profile;
  return (
    <div class="menu">
      <SpireBackdrop />
      <div class="menu-account">
        <AccountChip />
      </div>
      <div style={{ position: 'relative', textAlign: 'center' }}>
        <div class="logo">尖塔重铸</div>
        <div class="logo-sub">Spire · Reforged</div>
      </div>
      <div class="menu-buttons" style={{ position: 'relative' }}>
        {state.hasSave && (
          <button
            class="btn primary"
            onClick={() => {
              const run = loadRun();
              if (run) startNewRun(run);
              else refresh();
            }}
          >
            继续攀登
          </button>
        )}
        <button
          class={`btn ${state.hasSave ? '' : 'primary'}`}
          onClick={() => {
            if (state.hasSave)
              confirm('开始新的攀登会覆盖当前存档，确定吗？', '开始新游戏', () => {
                deleteSave();
                state.view = 'charSelect';
                refresh();
              });
            else {
              state.view = 'charSelect';
              refresh();
            }
          }}
        >
          新的攀登
        </button>
        <button
          class="btn ghost"
          onClick={() => {
            state.view = 'compendium';
            refresh();
          }}
        >
          卡牌图鉴
        </button>
        <button class="btn ghost" onClick={() => setOverlay({ kind: 'settings' })}>
          设置
        </button>
      </div>
      <div class="menu-foot">
        {p.runs > 0 && (
          <div style={{ marginBottom: '6px' }}>
            攀登 {p.runs} 次 · 登顶 {p.wins} 次 · 最高分 {p.bestScore}
          </div>
        )}
        致敬《杀戮尖塔 2》的同人卡牌构筑游戏 ·{' '}
        {cloud.user ? '进度已同步到你的账号' : cloud.available ? '未登录时进度只保存在这台设备上' : '进度只保存在这台设备的浏览器里'}
      </div>
    </div>
  );
}

export function CharSelectScreen() {
  const [sel, setSel] = useState<CharId>('ironclad');
  const maxAsc = state.profile.maxAsc[sel] ?? 0;
  const [asc, setAsc] = useState(0);
  const [seedText, setSeedText] = useState('');
  const a = Math.min(asc, maxAsc);
  const cd = CHARACTERS[sel];
  const seed = () => (seedText.trim() ? parseSeed(seedText.trim()) : randomSeed());
  return (
    <div class="charselect">
      <h1>选择你的角色</h1>
      <div class="char-row">
        {CHAR_ORDER.map((id) => {
          const c = CHARACTERS[id];
          const r = RELICS[c.relic];
          return (
            <div
              key={id}
              class={`char-card ${sel === id ? 'sel' : ''}`}
              style={{ '--pc': c.color } as Record<string, string>}
              onClick={() => setSel(id)}
              onDblClick={() => startNewRun(Run.create(id, seed(), Math.min(asc, state.profile.maxAsc[id] ?? 0)))}
            >
              <div class="portrait">
                <Portrait char={id} size={1.05} />
              </div>
              <h3 class={c.name.length > 6 ? 'long' : ''}>{c.name}</h3>
              <div class="title">{c.title}</div>
              <div class="mech">{c.mechanic}</div>
              <div class="desc">{c.desc}</div>
              <div class="meta">
                <span>❤️ {c.hp}</span>
                <span>🪙 {c.gold}</span>
                <span {...tipProps([{ title: r.name, sub: '初始遗物', body: r.desc }], 'top')}><RelicIcon id={c.relic} /> {r.name}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div class="asc-row">
        <span>进阶</span>
        <button class="btn small ghost" disabled={a <= 0} onClick={() => setAsc(a - 1)}>
          −
        </button>
        <span class="num" style={{ fontSize: '22px', minWidth: '28px', textAlign: 'center' }}>
          {a}
        </span>
        <button class="btn small ghost" disabled={a >= maxAsc} onClick={() => setAsc(a + 1)}>
          ＋
        </button>
      </div>
      <div class="asc-desc">
        {a === 0
          ? maxAsc > 0
            ? `已解锁至进阶 ${maxAsc}。进阶难度会叠加生效。`
            : '以任意难度通关即可为该角色解锁下一级进阶。'
          : `进阶 ${a}：${ASC_DESC[a]}（包含之前所有进阶效果）`}
      </div>
      <div class="cs-actions">
        <button
          class="btn ghost"
          onClick={() => {
            state.view = 'menu';
            refresh();
          }}
        >
          返回
        </button>
        <input
          id="seed-input"
          class="seed-input"
          placeholder="种子（可选）"
          value={seedText}
          maxLength={13}
          onInput={(e) => setSeedText((e.target as HTMLInputElement).value)}
          aria-label="随机种子"
        />
        <button class="btn primary" style={{ minWidth: '200px' }} onClick={() => startNewRun(Run.create(sel, seed(), a))}>
          以{cd.name}出发
        </button>
      </div>
    </div>
  );
}
