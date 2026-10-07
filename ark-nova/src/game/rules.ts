// 规则常量与纯函数（按原版基础游戏）：收入表、计分、声望范围、行动卡数值、奖励。
import type { ActionId } from './types';

export const START_MONEY = 25;
export const START_REP = 1;
export const MAX_X = 5;
export const MAX_WORKERS = 4;
export const MAX_REP = 15;
/** 卡牌行动升级之前，声望最高只能到 9 */
export const REP_CAP_BASIC = 9;
export const MAX_PARTNERS = 4;
export const MAX_UNIS = 3;
export const BASE_HAND_LIMIT = 3;
export const DISPLAY_SIZE = 6;
/** 两个标记相遇：吸引力 + 保护点数的分值 ≥ 100 */
export const END_THRESHOLD = 100;

/** 单人挑战：6 轮，每轮的回合数 */
export const SOLO_ROUNDS = [7, 6, 5, 4, 3, 2];

export function breakLength(players: number): number {
  // 5 人为扩展玩法（原作 1–4 人），按每多一人 +3 格延长
  return [0, 9, 10, 13, 16, 19][players] ?? 19;
}

/** 保护点数对应的分值：起点 −14，前 10 点每点 2 分，之后每点 3 分 */
export function cpPoints(cp: number): number {
  return cp <= 10 ? cp * 2 - 14 : 6 + (cp - 10) * 3;
}

/** 两个标记的位置之和：≥ 100 即相遇 */
export function progress(appeal: number, cp: number): number {
  return appeal + cpPoints(cp);
}

/** 得分 = 两个标记交错的距离 */
export function finalScore(appeal: number, cp: number): number {
  return progress(appeal, cp) - END_THRESHOLD;
}

/** 吸引力对应的休息收入（原版计分轨上的收入表） */
const INCOME_STEPS: [number, number][] = [
  [0, 5], [1, 6], [2, 7], [3, 8], [4, 9], [5, 10], [7, 11], [9, 12], [11, 13], [13, 14], [15, 15], [17, 16], [20, 17], [23, 18],
  [26, 19], [29, 20], [32, 21], [36, 22], [40, 23], [44, 24], [48, 25], [52, 26], [56, 27], [61, 28], [66, 29], [71, 30],
  [76, 31], [81, 32], [86, 33], [91, 34], [96, 35], [102, 36], [108, 37],
];

export function appealIncome(a: number): number {
  let m = 5;
  for (const [from, inc] of INCOME_STEPS) if (a >= from) m = inc;
  return m;
}

/** 声望范围：可以拿取的展示区位置数量 */
export function repRange(rep: number): number {
  if (rep <= 1) return 1;
  if (rep <= 3) return 2;
  if (rep <= 6) return 3;
  if (rep <= 9) return 4;
  if (rep <= 12) return 5;
  return 6;
}

/** 卡牌行动：抽几张、弃几张 */
export function cardsDraw(str: number, up: boolean): { draw: number; discard: number } {
  const s = Math.max(1, Math.min(5, str));
  const tableI = [
    [1, 1],
    [1, 0],
    [2, 1],
    [2, 0],
    [3, 1],
  ];
  const tableII = [
    [1, 0],
    [2, 1],
    [2, 0],
    [3, 1],
    [4, 1],
  ];
  const [draw, discard] = (up ? tableII : tableI)[s - 1];
  return { draw, discard };
}

/** 卡牌行动：改为从展示区精选 1 张需要的强度 */
export function snapStrength(up: boolean): number {
  return up ? 3 : 5;
}

export const CARDS_BREAK = 2;

/** 动物行动：最多打出几只动物 */
export function animalsCount(str: number, up: boolean): number {
  if (up) return str >= 3 ? 2 : str >= 1 ? 1 : 0;
  return str >= 5 ? 2 : str >= 2 ? 1 : 0;
}

/** 升级的动物行动在强度 5 时获得声望 +1 */
export function animalsRep(str: number, up: boolean): number {
  return up && str >= 5 ? 1 : 0;
}

export const BUILD_COST_PER_CELL = 2;

/** 协会任务的价值 */
export const TASK_VALUE = { rep: 2, partner: 3, university: 4, project: 5 } as const;

/** 捐款费用（依次） */
export const DONATION_COSTS = [2, 5, 5, 7, 7, 10, 10, 12];

export function donationCost(step: number): number {
  return DONATION_COSTS[Math.min(step, DONATION_COSTS.length - 1)];
}

export interface University {
  id: string;
  name: string;
  emoji: string;
  science: number;
  rep: number;
  handLimit: number;
  text: string;
}

export const UNIVERSITIES: University[] = [
  { id: 'u_hand', name: '综合大学', emoji: '🏛️', science: 0, rep: 1, handLimit: 5, text: '手牌上限变为 5，声望 +1' },
  { id: 'u_sci', name: '理工大学', emoji: '⚗️', science: 2, rep: 0, handLimit: 0, text: '2 个研究图标' },
  { id: 'u_rep', name: '研究型大学', emoji: '🎓', science: 1, rep: 2, handLimit: 0, text: '1 个研究图标，声望 +2' },
];

export function university(id: string): University {
  return UNIVERSITIES.find((u) => u.id === id)!;
}

/** 保护点数轨上的奖励：2 升级或工人；5、8 拿 5 元或一块奖励板块；10 所有人弃掉 1 张终局计分卡 */
export const CP_BONUSES = [2, 5, 8, 10];

/** 声望轨奖励 */
export type RepBonus = 'upgrade' | 'worker' | 'card' | 'cp' | 'x';
export const REP_BONUSES: { at: number; bonus: RepBonus; text: string }[] = [
  { at: 5, bonus: 'upgrade', text: '升级 1 张行动卡' },
  { at: 8, bonus: 'worker', text: '获得 1 名协会工人' },
  { at: 10, bonus: 'card', text: '从声望范围内或牌库拿 1 张牌' },
  { at: 11, bonus: 'cp', text: '获得 1 保护点数' },
  { at: 12, bonus: 'x', text: '获得 1 个 X 标记' },
  { at: 13, bonus: 'card', text: '从声望范围内或牌库拿 1 张牌' },
  { at: 14, bonus: 'cp', text: '获得 1 保护点数' },
  { at: 15, bonus: 'x', text: '获得 1 个 X 标记（之后每点声望改为 1 点吸引力）' },
];

export interface BonusTile {
  id: string;
  name: string;
  emoji: string;
  text: string;
}

/** 保护点数 5 和 8 旁边的奖励板块：原版共 9 块，每局随机摆出 4 块（5、8 各 2 块），每块只能被一位玩家拿走 */
export const TILES: BonusTile[] = [
  { id: 't_money', name: '10 元', emoji: '💰', text: '获得 10 元' },
  { id: 't_rep', name: '声望', emoji: '🎓', text: '声望 +2' },
  { id: 't_x', name: 'X 标记', emoji: '✖️', text: '获得 3 个 X 标记' },
  { id: 't_enclosure', name: '围栏', emoji: '🏗️', text: '免费建造 1 座 3 格标准围栏' },
  { id: 't_cards', name: '3 张牌', emoji: '🃏', text: '执行 3 次：从声望范围内或牌库拿 1 张牌' },
  { id: 't_mult', name: '倍增', emoji: '✖️2', text: '在任意一张行动卡上放 1 个倍增标记' },
  { id: 't_uni', name: '大学', emoji: '🏛️', text: '拿 1 所还没有的大学' },
  { id: 't_partner', name: '合作动物园', emoji: '🤝', text: '结交 1 个合作动物园（协会未升级时不能拿第 3 个）' },
  { id: 't_wild', name: '任意图标', emoji: '🃏', text: '支持基础保护项目时，可以把这块板块当作任意 1 个图标（用后翻面）' },
];

export function tile(id: string): BonusTile {
  return TILES.find((t) => t.id === id)!;
}

export const ACTION_INFO: Record<ActionId, { name: string; emoji: string; color: string }> = {
  animals: { name: '动物', emoji: '🦁', color: '#c0602b' },
  build: { name: '建造', emoji: '🏗️', color: '#6f6a5c' },
  cards: { name: '卡牌', emoji: '🃏', color: '#2f6f9c' },
  association: { name: '协会', emoji: '🤝', color: '#7a4f9a' },
  sponsors: { name: '赞助', emoji: '💼', color: '#b08a1e' },
};

/** 行动卡说明（I / II 面） */
export const ACTION_TEXT: Record<ActionId, [string, string]> = {
  animals: [
    '从手牌打出动物。强度 1：0 只；2–4：1 只；5：2 只。',
    '从手牌或声望范围内的展示区打出动物（展示区额外付位置编号的钱）。强度 1–2：1 只；3–4：2 只；5：2 只并声望 +1。',
  ],
  build: [
    '建造 1 座建筑，格数不超过强度，每格 2 元。可建：标准围栏、售货亭、凉亭、儿童动物园。不能建在 II 格上。',
    '建造 1 座或多座不同的建筑，总格数不超过强度，每格 2 元。新增：爬行馆、大型鸟舍；可以建在 II 格上。',
  ],
  cards: [
    '休息标记前进 2 格。强度 1：抽 1 弃 1；2：抽 1；3：抽 2 弃 1；4：抽 2；5：抽 3 弃 1，或改为从声望范围内精选 1 张。',
    '休息标记前进 2 格。可从声望范围内或牌库拿牌。强度 1：拿 1；2：拿 2 弃 1；3：拿 2；4：拿 3 弃 1；5：拿 4 弃 1；强度 3+ 也可改为精选 1 张。',
  ],
  association: [
    '完成 1 项价值不超过强度的协会任务：2 声望 +2；3 合作动物园；4 大学；5 支持保护项目。已有工人的任务需要 2 名工人。',
    '完成 1 项或多项不同的任务，总价值不超过强度；另外可以捐款 1 次（1 保护点数）；可从声望范围内的展示区打出保护项目（额外付位置编号的钱）。',
  ],
  sponsors: [
    '从手牌打出 1 张等级不超过强度的赞助卡；或者改为休息标记前进强度格，获得等于强度的钱。',
    '从手牌或声望范围内（额外付位置编号的钱）打出 1 张或多张赞助卡，总等级不超过强度 + 1；或者改为休息标记前进强度格，获得 2 倍强度的钱。',
  ],
};
