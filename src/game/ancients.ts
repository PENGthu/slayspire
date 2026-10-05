import type { Run } from './run';

/** 先古之民提供的祝福 */
export interface BlessingDef {
  id: string;
  label: string;
  desc: string;
  /** trade: 有代价的强力祝福 */
  tone?: 'good' | 'trade';
  cond?: (run: Run) => boolean;
  apply: (run: Run) => void;
}

/** 先古之民：每幕开始时出现，提供三选一的祝福（《杀戮尖塔 2》新机制） */
export interface AncientDef {
  id: string;
  name: string;
  title: string;
  art: string;
  color: string;
  acts: number[];
  intro: string;
  blessings: BlessingDef[];
}
