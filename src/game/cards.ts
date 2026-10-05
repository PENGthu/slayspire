import { nextUid } from '../core/util';
import { CARDS, ENCHANTS } from './registry';
import type { Card, CardDef, Enemy, UV } from './types';
import { COST_X, UNPLAYABLE } from './types';
import type { Combat } from './combat';

export function uv<T>(v: UV<T> | undefined, up: boolean): T | undefined {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) return (up ? v[1] : v[0]) as T;
  return v as T;
}

export function cardDef(c: Card | string): CardDef {
  const id = typeof c === 'string' ? c : c.id;
  const d = CARDS[id];
  if (!d) throw new Error(`未知卡牌: ${id}`);
  return d;
}

export function makeCard(id: string, up = false): Card {
  cardDef(id);
  return { uid: nextUid(), id, up, misc: 0 };
}

/** 复制为战斗中的卡牌副本 */
export function combatCopy(c: Card): Card {
  return { uid: nextUid(), id: c.id, up: c.up, misc: c.misc, ench: c.ench ? { ...c.ench } : undefined, deckUid: c.uid };
}

/** 战斗中生成的复制品（保留临时费用等） */
export function duplicateCard(c: Card): Card {
  return { ...c, uid: nextUid(), deckUid: undefined, ench: c.ench ? { ...c.ench } : undefined, played: 0 };
}

export function canUpgrade(c: Card): boolean {
  if (c.up) return false;
  const d = cardDef(c);
  if (d.type === 'curse') return false;
  if (d.type === 'status' && !Array.isArray(d.text)) return false;
  return true;
}

export function upgradeCard(c: Card) {
  if (canUpgrade(c)) c.up = true;
}

export function cardName(c: Card): string {
  return cardDef(c).name + (c.up ? '+' : '');
}

export function baseCost(c: Card): number {
  return uv(cardDef(c).cost, c.up) ?? 0;
}

export function starCost(c: Card): number {
  return uv(cardDef(c).star, c.up) ?? 0;
}

/** 卡牌在牌组/商店中显示的费用（含附魔与永久修改，不含战斗内修正） */
export function displayCost(c: Card): number {
  const b = baseCost(c);
  if (b < 0) return b;
  let cost = c.costCombat ?? b;
  if (c.costTurn !== undefined) cost = c.costTurn;
  const e = c.ench && ENCHANTS[c.ench.id];
  if (e?.costAdd) cost += e.costAdd(c.ench!.n);
  return Math.max(0, cost);
}

export function isX(c: Card): boolean {
  return baseCost(c) === COST_X;
}
export function isUnplayable(c: Card): boolean {
  return baseCost(c) === UNPLAYABLE;
}

export function cardDmg(g: Combat | null, c: Card): number {
  const d = cardDef(c);
  let v = d.dmgFn ? d.dmgFn(g, c) : (uv(d.dmg, c.up) ?? 0);
  v += c.tmpDmg ?? 0;
  const e = c.ench && ENCHANTS[c.ench.id];
  if (e?.dmgAdd) v += e.dmgAdd(c.ench!.n);
  return v;
}

export function cardBlk(g: Combat | null, c: Card): number {
  const d = cardDef(c);
  let v = d.blkFn ? d.blkFn(g, c) : (uv(d.blk, c.up) ?? 0);
  v += c.tmpBlk ?? 0;
  const e = c.ench && ENCHANTS[c.ench.id];
  if (e?.blkAdd) v += e.blkAdd(c.ench!.n);
  return v;
}

export function cardMag(c: Card): number {
  return uv(cardDef(c).mag, c.up) ?? 0;
}
export function cardMag2(c: Card): number {
  return uv(cardDef(c).mag2, c.up) ?? 0;
}

export function isExhaust(c: Card): boolean {
  return !!uv(cardDef(c).exhaust, c.up);
}
export function isEthereal(c: Card): boolean {
  return !!uv(cardDef(c).ethereal, c.up);
}
export function isInnate(c: Card): boolean {
  const e = c.ench && ENCHANTS[c.ench.id];
  return !!uv(cardDef(c).innate, c.up) || !!e?.innate;
}
export function isRetain(c: Card): boolean {
  const e = c.ench && ENCHANTS[c.ench.id];
  return !!uv(cardDef(c).retain, c.up) || !!c.retainOnce || !!e?.retain;
}

export function hasTag(c: Card | CardDef, tag: string): boolean {
  const d = 'color' in c ? c : cardDef(c);
  return !!d.tags?.includes(tag);
}

// ---------------------------------------------------------------------------
// 描述文本
// ---------------------------------------------------------------------------

export type TextSeg =
  | { k: 't'; s: string }
  | { k: 'n'; s: string; mod: 0 | 1 | -1 }
  | { k: 'kw'; s: string }
  | { k: 'br' };

/** 关键词与其解释 */
export const KEYWORDS: Record<string, string> = {
  消耗: '打出后移出本场战斗。',
  虚无: '若回合结束时仍在手牌中，则将其消耗。',
  保留: '回合结束时不会被丢弃。',
  固有: '每场战斗开始时必定在手牌中。',
  不能被打出: '这张牌无法被打出。',
  力量: '攻击伤害提高等量数值。',
  敏捷: '卡牌获得的格挡提高等量数值。',
  易伤: '受到的攻击伤害提高 50%。',
  虚弱: '造成的攻击伤害降低 25%。',
  脆弱: '从卡牌获得的格挡降低 25%。',
  中毒: '回合开始时失去等量生命，然后层数减 1。',
  格挡: '在下个回合开始前，抵挡伤害。',
  人工制品: '抵消下一次受到的负面效果。',
  荆棘: '受到攻击时，对攻击者造成伤害。',
  活力: '下一张攻击牌额外造成等量伤害。',
  升级: '升级后卡牌效果增强。',
  小刀: '0 费攻击牌：造成 4 点伤害。消耗。',
  星辰: '储君的资源，回合之间保留。部分卡牌需要花费星辰。',
  铸造: '若君王之刃不在你的牌堆中，将其加入手牌；所有君王之刃伤害提高。',
  君王之刃: '2 费攻击牌：造成伤害。保留。可通过铸造强化。',
  召唤: '若奥斯提不在场，以该数值的生命召唤它；否则提高其最大生命并回复等量生命。',
  奥斯提: '亡灵契约师的骸骨伙伴。会替你承受攻击伤害（在格挡之后）。',
  灾厄: '敌人回合开始时，若灾厄不低于其当前生命，则其立即死亡。',
  灵魂: '0 费技能牌：抽 2 张牌。消耗。',
  无实体: '受到的伤害和生命流失降低为 1。',
  缓冲: '阻止下一次失去生命。',
  再生: '回合结束时回复等量生命，然后层数减 1。',
  金属化: '回合结束时获得等量格挡。',
  多层护甲: '回合结束时获得等量格挡。受到攻击伤害会减少层数。',
  伤口: '不能被打出的状态牌。',
  晕眩: '不能被打出。虚无。',
  灼伤: '不能被打出。回合结束时若在手牌中，受到 2 点伤害。',
  变化: '将卡牌随机替换为同角色的另一张牌。',
  生成: '将一个充能球放入空栏位。若栏位已满，先激发最左侧的充能球。',
  激发: '移除最左侧的充能球并触发其激发效果。',
  充能球: '故障机器人的力量来源。被动效果在回合结束时触发（等离子在回合开始时触发）。',
  闪电: '充能球。被动：对随机敌人造成 3 点伤害。激发：造成 8 点伤害。',
  冰霜: '充能球。被动：获得 2 点格挡。激发：获得 5 点格挡。',
  黑暗: '充能球。被动：激发伤害提高 6。激发：对生命最低的敌人造成累积的伤害。',
  等离子: '充能球。被动：回合开始时获得 1 点能量。激发：获得 2 点能量。',
  集中: '提高充能球的效果（等离子除外）。',
};

const KW_RE = new RegExp(`(${Object.keys(KEYWORDS).sort((a, b) => b.length - a.length).join('|')})`, 'g');

export function rawText(c: Card): string {
  return uv(cardDef(c).text, c.up) ?? '';
}

/** 卡牌中出现的关键词（用于提示框） */
export function cardKeywords(c: Card): string[] {
  const text = rawText(c);
  const set = new Set<string>();
  for (const m of text.matchAll(KW_RE)) set.add(m[1]);
  const d = cardDef(c);
  if (isExhaust(c)) set.add('消耗');
  if (isEthereal(c)) set.add('虚无');
  if (isRetain(c)) set.add('保留');
  if (isInnate(c)) set.add('固有');
  if (d.tags?.includes('osty')) set.add('奥斯提');
  return [...set].filter((k) => k !== '格挡' && k !== '升级');
}

function numSeg(v: number, base: number): TextSeg {
  return { k: 'n', s: String(v), mod: v > base ? 1 : v < base ? -1 : 0 };
}

function pushText(out: TextSeg[], s: string) {
  if (!s) return;
  let last = 0;
  for (const m of s.matchAll(KW_RE)) {
    if (m.index! > last) out.push({ k: 't', s: s.slice(last, m.index) });
    out.push({ k: 'kw', s: m[1] });
    last = m.index! + m[1].length;
  }
  if (last < s.length) out.push({ k: 't', s: s.slice(last) });
}

/** 生成卡牌描述片段。g 存在时计算力量/虚弱等修正，target 存在时计算易伤。 */
export function cardText(c: Card, g: Combat | null, target: Enemy | null = null): TextSeg[] {
  const d = cardDef(c);
  let text = rawText(c);
  const out: TextSeg[] = [];
  // 附加关键词行
  const prefix: string[] = [];
  const suffix: string[] = [];
  if (isInnate(c) && !text.includes('固有')) prefix.push('固有。');
  if (isRetain(c) && !text.includes('保留')) prefix.push('保留。');
  if (isEthereal(c) && !text.includes('虚无')) prefix.push('虚无。');
  if (isExhaust(c) && !text.includes('消耗。')) suffix.push('消耗。');
  if (prefix.length) text = prefix.join(' ') + '\n' + text;
  if (suffix.length) text = text + '\n' + suffix.join(' ');
  const parts = text.split(/(\{[DBMN]\}|\n)/);
  for (const p of parts) {
    if (p === '\n') out.push({ k: 'br' });
    else if (p === '{D}') {
      const base = cardDmg(g, c);
      const v = g ? g.previewDamage(c, target) : base;
      out.push(numSeg(v, base));
    } else if (p === '{B}') {
      const base = cardBlk(g, c);
      const v = g ? g.previewBlock(base) : base;
      out.push(numSeg(v, base));
    } else if (p === '{M}') out.push(numSeg(cardMag(c), cardMag(c)));
    else if (p === '{N}') out.push(numSeg(cardMag2(c), cardMag2(c)));
    else pushText(out, p);
  }
  void d;
  return out;
}

/** 纯文本描述（测试、日志用） */
export function cardPlainText(c: Card): string {
  return cardText(c, null)
    .map((s) => (s.k === 'br' ? ' ' : s.s))
    .join('');
}

export const TYPE_NAMES: Record<string, string> = {
  attack: '攻击',
  skill: '技能',
  power: '能力',
  status: '状态',
  curse: '诅咒',
};

export const RARITY_NAMES: Record<string, string> = {
  basic: '基础',
  common: '普通',
  uncommon: '罕见',
  rare: '稀有',
  special: '特殊',
  curse: '诅咒',
  status: '状态',
};
