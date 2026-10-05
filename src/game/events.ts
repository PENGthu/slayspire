import type { Run } from './run';

/** 事件进度（可存档） */
export interface EventState {
  id: string;
  page: string;
  vars: Record<string, number>;
  /** 上一步的结果描述 */
  note?: string;
}

export interface EventOption {
  label: string;
  hint?: string;
  /** 不可选时显示的原因 */
  disabled?: string | false;
  tone?: 'good' | 'bad' | 'neutral';
  go: () => void;
}

export interface EventView {
  text: string;
  options: EventOption[];
}

export interface EventDef {
  id: string;
  name: string;
  art: string;
  acts: number[];
  /** 仅在这些区域出现 */
  zones?: string[];
  cond?: (run: Run) => boolean;
  init?: (run: Run, ev: EventState) => void;
  view: (run: Run, ev: EventState) => EventView;
}
