// 全局状态：设置、编辑过的范围、训练记录、求解结果。设置与记录保存在浏览器本地。
import { useEffect, useState } from 'preact/hooks';
import { buildSixMax, type Overrides, type SixMaxTree } from '../engine/sixmax';
import { DEFAULT_CONFIG, type SolverConfig, type SolverResult } from '../engine/solver';
import { emptyStats, parseStats, type Stats } from '../engine/stats';
import type { SpotNode } from '../engine/types';

export type View = 'train' | 'ranges' | 'solver' | 'stats';
export type Source = 'sixmax' | 'solver';

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  fourColor: boolean;
  rngMode: boolean;
  focus: boolean;
  autoNext: boolean;
  families: string[];
  heroes: string[];
  /** 求解器结果用的场景筛选（位置只有 SB / BB） */
  solverFamilies: string[];
  solverHeroes: string[];
}

export interface SolverState {
  config: SolverConfig;
  result: SolverResult | null;
  running: boolean;
  progress: { iteration: number; total: number; exploitability: number }[];
  error: string | null;
}

export interface AppState {
  view: View;
  settings: Settings;
  overrides: Overrides;
  tree: SixMaxTree;
  stats: Stats;
  solver: SolverState;
  trainSource: Source;
  rangesSource: Source;
  /** 范围页正在查看的决策点 */
  rangesKey: string;
  /** 错题重练：待练的 [决策点, 手牌] 队列 */
  drill: { key: string; hand: number }[] | null;
}

const KEYS = {
  settings: 'gto-preflop/settings',
  overrides: 'gto-preflop/overrides',
  stats: 'gto-preflop/stats',
  solver: 'gto-preflop/solver-config',
};

function load<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 无痕窗口或存储被禁用：只在本次会话中生效
  }
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fourColor: true,
  rngMode: false,
  focus: true,
  autoNext: false,
  families: ['RFI', 'VO', 'V3', 'V4'],
  heroes: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  solverFamilies: ['RFI', 'VO', 'V3', 'V4', 'VA'],
  solverHeroes: ['SB', 'BB'],
};

function loadOverrides(): Overrides {
  const raw = load<Record<string, number[]>>(KEYS.overrides);
  if (!raw || typeof raw !== 'object') return {};
  const out: Overrides = {};
  for (const [k, v] of Object.entries(raw)) if (Array.isArray(v)) out[k] = v;
  return out;
}

const initialOverrides = loadOverrides();

let state: AppState = {
  view: 'train',
  settings: { ...DEFAULT_SETTINGS, ...(load<Partial<Settings>>(KEYS.settings) ?? {}) },
  overrides: initialOverrides,
  tree: buildSixMax(initialOverrides),
  stats: parseStats(load(KEYS.stats)) ?? emptyStats(),
  solver: {
    config: { ...DEFAULT_CONFIG, ...(load<Partial<SolverConfig>>(KEYS.solver) ?? {}) },
    result: null,
    running: false,
    progress: [],
    error: null,
  },
  trainSource: 'sixmax',
  rangesSource: 'sixmax',
  rangesKey: '6max/RFI/CO',
  drill: null,
};

const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  const prev = state;
  state = { ...state, ...p };
  if (p.overrides && p.overrides !== prev.overrides) {
    state.tree = buildSixMax(state.overrides);
    save(KEYS.overrides, Object.fromEntries(Object.entries(state.overrides).map(([k, v]) => [k, Array.from(v, (x) => Math.round(x * 1000) / 1000)])));
  }
  if (p.settings && p.settings !== prev.settings) save(KEYS.settings, state.settings);
  if (p.stats && p.stats !== prev.stats) save(KEYS.stats, state.stats);
  if (p.solver && p.solver.config !== prev.solver.config) save(KEYS.solver, state.solver.config);
  for (const l of listeners) l();
}

export function updateSettings(patch: Partial<Settings>) {
  setState((s) => ({ settings: { ...s.settings, ...patch } }));
}

export function useAppState(): AppState {
  const [, setTick] = useState(0);
  useEffect(() => {
    const force = () => setTick((x) => x + 1);
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);
  return state;
}

/** 某个来源的全部决策点 */
export function nodesOf(s: AppState, source: Source): Map<string, SpotNode> {
  if (source === 'solver') return new Map((s.solver.result?.nodes ?? []).map((n) => [n.key, n]));
  return s.tree.nodes;
}

export function findNode(s: AppState, key: string): SpotNode | undefined {
  return s.tree.nodes.get(key) ?? s.solver.result?.nodes.find((n) => n.key === key);
}
