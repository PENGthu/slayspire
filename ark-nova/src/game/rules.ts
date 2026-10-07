// 规则常量与纯函数：收入表、计分换算、声望范围、行动卡数值、奖励门槛。
import type { ActionId, Gain } from './types';

export const START_MONEY = 25;
export const START_REP = 1;
export const MAX_X = 5;
export const MAX_WORKERS = 4;
export const MAX_REP = 15;
/** 卡牌行动升级之前，声望最高只能到 9 */
export const REP_CAP_BASIC = 9;
export const MAX_PARTNERS = 4;
export const BASE_HAND_LIMIT = 3;
export const DISPLAY_SIZE = 6;
/** 两个标记相遇：吸引力 + 保护点数换算分 ≥ 100 */
export const END_THRESHOLD = 100;
/** 单人挑战：第几次休息结束后游戏结束 */
export const SOLO_BREAKS = 5;

export function breakLength(players: number, solo: boolean): number {
  if (solo) return 12;
  return [0, 9, 10, 13, 16][players] ?? 16;
}

/** 保护点数换算成分数：前 10 点每点 2 分，之后每点 3 分 */
export function cpPoints(cp: number): number {
  return cp <= 10 ? cp * 2 : 20 + (cp - 10) * 3;
}

export function progress(appeal: number, cp: number): number {
  return appeal + cpPoints(cp);
}

export function finalScore(appeal: number, cp: number): number {
  return progress(appeal, cp) - END_THRESHOLD;
}

/** 吸引力对应的休息收入 */
export function appealIncome(a: number): number {
  if (a <= 10) return 5 + a;
  if (a <= 40) return 15 + Math.floor((a - 10) / 2);
  if (a <= 70) return 30 + Math.floor((a - 40) / 3);
  return Math.min(45, 40 + Math.floor((a - 70) / 4));
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

/** 卡牌行动：从展示区直接拿 1 张（抢先）需要的强度 */
export function snapStrength(up: boolean): number {
  return up ? 3 : 5;
}

export const CARDS_BREAK = 2;

/** 动物行动：可以打出几只动物 */
export function animalsCount(str: number, up: boolean): number {
  if (up) return str >= 4 ? 2 : str >= 1 ? 1 : 0;
  return str >= 5 ? 2 : str >= 2 ? 1 : 0;
}

/** 升级的动物行动在强度 5 时额外获得的声望 */
export function animalsRep(str: number, up: boolean): number {
  return up && str >= 5 ? 1 : 0;
}

export const BUILD_COST_PER_CELL = 2;

/** 协会任务的价值 */
export const TASK_VALUE = { rep: 2, partner: 3, university: 4, project: 5 } as const;

export const DONATION_COSTS = [2, 5, 7, 10, 12, 15, 17, 20, 22, 25];

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
  { id: 'u_rep', name: '综合大学', emoji: '🏛️', science: 1, rep: 2, handLimit: 0, text: '1 个研究图标，声望 +2' },
  { id: 'u_hand', name: '农林大学', emoji: '🌱', science: 1, rep: 0, handLimit: 2, text: '1 个研究图标，手牌上限 +2' },
  { id: 'u_sci', name: '理工大学', emoji: '⚗️', science: 2, rep: 0, handLimit: 0, text: '2 个研究图标' },
];

export function university(id: string): University {
  return UNIVERSITIES.find((u) => u.id === id)!;
}

/** 保护点数轨上的奖励：2 升级或工人；5、8 拿 5 元或一块奖励板块；10 所有人弃掉 1 张终局计分卡 */
export const CP_BONUSES = [2, 5, 8, 10];

/** 声望轨奖励（卡牌行动升级之前只能到 9） */
export const REP_BONUSES: { at: number; gain: Gain | 'display'; text: string }[] = [
  { at: 5, gain: { upgrade: 1 }, text: '升级 1 张行动卡' },
  { at: 8, gain: { worker: 1 }, text: '获得 1 名协会工人' },
  { at: 10, gain: { cp: 1 }, text: '获得 1 保护点数' },
  { at: 11, gain: 'display', text: '从展示区任意位置拿 1 张牌' },
  { at: 12, gain: { cp: 1 }, text: '获得 1 保护点数' },
  { at: 13, gain: { x: 1 }, text: '获得 1 个 X 标记' },
  { at: 14, gain: { cp: 1 }, text: '获得 1 保护点数' },
  { at: 15, gain: { cp: 1 }, text: '获得 1 保护点数（之后每点声望改为 1 点吸引力）' },
];

export interface BonusTile {
  id: string;
  name: string;
  emoji: string;
  text: string;
}

/** 保护点数 5 和 8 旁边的奖励板块：每局随机各摆 2 块，每块只能被一位玩家拿走 */
export const TILES: BonusTile[] = [
  { id: 't_money', name: '慈善拨款', emoji: '💰', text: '获得 10 元' },
  { id: 't_rep', name: '媒体报道', emoji: '📰', text: '声望 +2' },
  { id: 't_display', name: '优先引进', emoji: '🃏', text: '从展示区任意位置拿 2 张牌' },
  { id: 't_enclosure', name: '捐建围栏', emoji: '🏗️', text: '免费建造 1 座不超过 3 格的标准围栏' },
  { id: 't_appeal', name: '明星动物', emoji: '✨', text: '获得 3 点吸引力' },
  { id: 't_x', name: '专家顾问', emoji: '✖️', text: '获得 2 个 X 标记' },
  { id: 't_draw', name: '野外考察', emoji: '🔭', text: '从牌库抽 3 张牌' },
  { id: 't_kiosk', name: '游客设施', emoji: '🍦', text: '免费建造 1 个售货亭或凉亭' },
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
    '强度 2–4：打出 1 只动物；强度 5：打出 2 只。',
    '强度 1–3：打出 1 只动物；强度 4+：打出 2 只；强度 5+ 额外声望 +1。也可以从展示区（声望范围内）打出，额外支付位置编号的费用。',
  ],
  build: [
    '建造 1 座建筑，格数不超过强度，每格 2 元。不能建在标有 II 的格子上，不能建爬行馆和大型鸟舍。',
    '建造多座不同的建筑，总格数不超过强度，每格 2 元。可以建在 II 格上，可以建爬行馆和大型鸟舍。',
  ],
  cards: [
    '强度 1：抽 1 弃 1；2：抽 1；3：抽 2 弃 1；4：抽 2；5：抽 3 弃 1，或改为从声望范围内的展示区拿 1 张。休息标记前进 2 格。',
    '强度 1：抽 1；2：抽 2 弃 1；3：抽 2；4：抽 3 弃 1；5+：抽 4 弃 1。抽牌可以来自声望范围内的展示区；强度 3+ 也可改为从展示区拿 1 张。休息标记前进 2 格。',
  ],
  association: [
    '派出协会工人完成 1 项价值不超过强度的任务：2 声望 +2；3 合作动物园；4 大学；5 支持保护项目。已有工人的任务需要 2 名工人。',
    '完成多项不同的任务，总价值不超过强度；另外可以捐款 1 次（花钱换 1 保护点数）。',
  ],
  sponsors: [
    '打出 1 张等级不超过强度的赞助卡；或者改为获得等于强度的钱，并让休息标记前进相同格数。',
    '打出 1 张或多张赞助卡，总等级不超过强度 + 1，也可以从展示区（声望范围内）打出，额外支付位置编号的费用；或者改为获得 2 倍强度的钱，休息标记前进强度格。',
  ],
};
