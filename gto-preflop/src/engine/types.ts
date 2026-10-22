// 训练器、范围浏览器和求解器共用的"决策点"描述。

export type ActionKind = 'fold' | 'call' | 'raise' | 'allin';
/** 决定颜色：开池/3-Bet 用 raise，4-Bet 及更大用 raise2 */
export type ActionTone = 'fold' | 'call' | 'raise' | 'raise2' | 'allin';

export interface ActionDef {
  id: string;
  kind: ActionKind;
  /** 按钮上的文字，如 "3-Bet 7.5" */
  label: string;
  /** 矩阵图例里的短名，如 "3-Bet" */
  short: string;
  /** 行动后的总下注额（bb） */
  to?: number;
  tone: ActionTone;
  /** 键盘快捷键 */
  key: string;
}

export interface LineStep {
  pos: string;
  kind: ActionKind;
  /** 加注/全下后的总下注额；跟注时为跟到的金额 */
  to?: number;
  /** 文字描述用的行动名（如 "3-Bet"） */
  name?: string;
}

export interface SpotNode {
  key: string;
  source: 'sixmax' | 'solver';
  /** 场景类型：RFI / VO（面对开池）/ V3 / V4 / V5，求解器节点也沿用这些名字 */
  family: string;
  title: string;
  hero: string;
  villain?: string;
  /** 按座位顺序排列的位置（决定牌桌布局） */
  seats: string[];
  /** 起始筹码（bb） */
  stack: number;
  /** 每位玩家的前注（bb） */
  ante: number;
  /** 盲注：位置 → 金额 */
  blinds: Record<string, number>;
  /** 轮到我之前发生的行动 */
  line: LineStep[];
  actions: ActionDef[];
  /** 169 × 行动数：每手牌各行动的频率，和为 1 */
  strategy: Float32Array;
  /** 我到达此处的范围权重（0–1） */
  heroReach: Float32Array;
  /** 对手到达此处的范围权重 */
  villainReach?: Float32Array;
  /** 169 × 行动数：每个行动的期望值（bb，相对于本手开始）；只有求解器节点有 */
  ev?: Float32Array;
  /** 每个行动之后的下一个决策点 */
  children: (string | null)[];
}

export const freqAt = (n: SpotNode, hand: number, a: number) => n.strategy[hand * n.actions.length + a];

export function handFreqs(n: SpotNode, hand: number): number[] {
  const k = n.actions.length;
  return Array.from(n.strategy.subarray(hand * k, hand * k + k));
}

/** 牌桌状态：根据行动线算出每个人的下注、是否已弃牌、底池 */
export interface TableState {
  bets: Record<string, number>;
  folded: Set<string>;
  pot: number;
  toCall: number;
  heroBet: number;
}

export function tableState(n: SpotNode): TableState {
  const bets: Record<string, number> = {};
  for (const p of n.seats) bets[p] = n.blinds[p] ?? 0;
  const folded = new Set<string>();
  let maxBet = Math.max(0, ...Object.values(bets));
  for (const s of n.line) {
    if (s.kind === 'fold') folded.add(s.pos);
    else if (s.kind === 'call') bets[s.pos] = maxBet;
    else if (s.to != null) {
      bets[s.pos] = s.to;
      maxBet = Math.max(maxBet, s.to);
    }
  }
  const pot = Object.values(bets).reduce((a, b) => a + b, 0) + n.ante * n.seats.length;
  const heroBet = bets[n.hero] ?? 0;
  return { bets, folded, pot, toCall: Math.max(0, maxBet - heroBet), heroBet };
}

const KIND_TEXT: Record<ActionKind, string> = { fold: '弃牌', call: '跟注', raise: '加注', allin: '全下' };

/** 行动线的文字描述，连续弃牌合并："UTG、HJ 弃牌 · CO 加注 2.5 · BTN 3-Bet 7.5" */
export function describeLine(line: LineStep[]): string {
  const parts: string[] = [];
  let folds: string[] = [];
  const flush = () => {
    if (folds.length) parts.push(`${folds.join('、')} 弃牌`);
    folds = [];
  };
  for (const s of line) {
    if (s.kind === 'fold') {
      folds.push(s.pos);
      continue;
    }
    flush();
    const name = s.name ?? KIND_TEXT[s.kind];
    parts.push(s.kind === 'call' ? `${s.pos} ${name}` : `${s.pos} ${name} ${fmtBB(s.to ?? 0)}`);
  }
  flush();
  return parts.join(' · ');
}

export function fmtBB(x: number): string {
  return Number.isInteger(x) ? String(x) : x.toFixed(x * 10 === Math.round(x * 10) ? 1 : 2);
}
