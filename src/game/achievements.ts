import { CHAR_ORDER, CHARACTERS } from './characters';
import type { Combat } from './combat';
import type { Run } from './run';
import type { CharId } from './types';

/**
 * 成就：纯逻辑，不依赖界面。
 * 界面在战斗结束、攀登结束和每次操作后调用 processEvent，拿到新解锁的成就再负责提示和存档。
 */

export interface AchState {
  /** 已解锁：成就 id → 解锁时间（毫秒） */
  unlocked: Record<string, number>;
  /** 累计计数（击败敌人、精英、药水等） */
  counters: Record<string, number>;
  /** 在战斗中见过的怪物 id */
  seen: string[];
}

export type AchCategory = 'climb' | 'char' | 'combat' | 'collect' | 'claude';

export const ACH_CATEGORIES: { id: AchCategory; name: string }[] = [
  { id: 'climb', name: '攀登' },
  { id: 'char', name: '角色' },
  { id: 'combat', name: '战斗' },
  { id: 'collect', name: '收集与积累' },
  { id: 'claude', name: '小克专属' },
];

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  cat: AchCategory;
  /** 未解锁时不显示条件 */
  hidden?: boolean;
  /** 计数类成就：进度 = 计数 / 目标 */
  progress?: (s: AchState) => number;
  goal?: number;
}

const count = (key: string) => (s: AchState) => s.counters[key] ?? 0;
const seenCount = (s: AchState) => s.seen.length;

const CHAR_ACH: Record<CharId, [string, string]> = {
  ironclad: ['钢铁之心', '🛡️'],
  silent: ['无声之刃', '🗡️'],
  regent: ['王者归来', '👑'],
  necrobinder: ['亡者同行', '💀'],
  defect: ['系统正常', '🤖'],
  claude: ['上下文已满', '✳️'],
};

export const ACHIEVEMENTS: AchievementDef[] = [
  // 攀登
  { id: 'first_blood', name: '初出茅庐', desc: '赢下第一场战斗。', icon: '⚔️', cat: 'climb' },
  { id: 'act1', name: '走出密林', desc: '击败第一幕的首领。', icon: '🌿', cat: 'climb' },
  { id: 'act2', name: '穿过蜂巢', desc: '击败第二幕的首领。', icon: '🐝', cat: 'climb' },
  { id: 'summit', name: '登顶', desc: '击败第三幕的首领，完成一次攀登。', icon: '🏔️', cat: 'climb' },
  { id: 'both_roads', name: '两条路都走过', desc: '分别在蔓生密林和地下船坞击败第一幕的首领。', icon: '🧭', cat: 'climb' },
  { id: 'asc5', name: '迎难而上', desc: '在进阶 5 或更高完成攀登。', icon: '🔥', cat: 'climb' },
  { id: 'asc10', name: '尖塔之巅', desc: '在进阶 10 完成攀登。', icon: '🌋', cat: 'climb' },
  { id: 'runs_10', name: '屡败屡战', desc: '完成 10 次攀登（无论胜负）。', icon: '🔁', cat: 'climb', progress: count('runs'), goal: 10 },
  { id: 'early_fall', name: '出师未捷', desc: '在第一幕的前三层就倒下了。', icon: '🪦', cat: 'climb', hidden: true },
  // 角色
  ...CHAR_ORDER.map(
    (c): AchievementDef => ({ id: `win_${c}`, name: CHAR_ACH[c][0], desc: `用${CHARACTERS[c].name}完成攀登。`, icon: CHAR_ACH[c][1], cat: 'char' }),
  ),
  {
    id: 'all_chars',
    name: '群英荟萃',
    desc: '用全部六名角色完成攀登。',
    icon: '🌟',
    cat: 'char',
    progress: (s) => CHAR_ORDER.filter((c) => s.counters[`win_${c}`]).length,
    goal: CHAR_ORDER.length,
  },
  // 战斗
  { id: 'big_hit', name: '一击必杀', desc: '一次攻击造成 50 点或更多伤害。', icon: '💥', cat: 'combat' },
  { id: 'huge_hit', name: '九九归一', desc: '一次攻击造成 99 点或更多伤害。', icon: '☄️', cat: 'combat' },
  { id: 'combo', name: '连招大师', desc: '一回合内打出 10 张牌。', icon: '🃏', cat: 'combat' },
  { id: 'storm', name: '狂风骤雨', desc: '一回合内对敌人造成 100 点伤害。', icon: '⚡', cat: 'combat' },
  { id: 'flawless_boss', name: '毫发无伤', desc: '击败首领，且那场战斗中没有失去生命。', icon: '✨', cat: 'combat' },
  { id: 'clutch', name: '死里逃生', desc: '赢下一场战斗时只剩 5 点或更少的生命。', icon: '🩸', cat: 'combat' },
  { id: 'elite_run', name: '精英猎手', desc: '在一次攀登中击败 4 名精英。', icon: '🎯', cat: 'combat' },
  { id: 'kills_100', name: '百人斩', desc: '累计击败 100 名敌人。', icon: '🗡️', cat: 'combat', progress: count('kills'), goal: 100 },
  { id: 'kills_500', name: '千军辟易', desc: '累计击败 500 名敌人。', icon: '⚔️', cat: 'combat', progress: count('kills'), goal: 500 },
  { id: 'elites_20', name: '精英克星', desc: '累计击败 20 名精英。', icon: '🏹', cat: 'combat', progress: count('elites'), goal: 20 },
  // 收集与积累
  { id: 'rich', name: '富甲一方', desc: '一次攀登中同时持有 500 金币。', icon: '💰', cat: 'collect' },
  { id: 'hoarder', name: '收藏家', desc: '一次攀登中同时拥有 20 件遗物。', icon: '🏺', cat: 'collect' },
  { id: 'big_deck', name: '牌山', desc: '牌组达到 50 张。', icon: '📚', cat: 'collect' },
  { id: 'lean', name: '少即是多', desc: '牌组不超过 15 张时完成攀登。', icon: '🍃', cat: 'collect' },
  { id: 'potions_20', name: '药剂师', desc: '累计在战斗中使用 20 瓶药水。', icon: '🧪', cat: 'collect', progress: count('potions'), goal: 20 },
  { id: 'seen_50', name: '博物学家', desc: '在战斗中见过 50 种不同的怪物。', icon: '🔍', cat: 'collect', progress: seenCount, goal: 50 },
  { id: 'seen_100', name: '图鉴大师', desc: '在战斗中见过 100 种不同的怪物。', icon: '📖', cat: 'collect', progress: seenCount, goal: 100 },
  // 小克专属
  { id: 'beat_gemini', name: '双子落幕', desc: '用小克击败 Gemini。', icon: '♊', cat: 'claude' },
  { id: 'beat_grok', name: '热搜终结者', desc: '用小克击败 Grok。', icon: '📉', cat: 'claude' },
  { id: 'beat_openai', name: '最终回答', desc: '用小克击败 OpenAI。', icon: '💬', cat: 'claude' },
  { id: 'compact_5', name: '记忆压缩', desc: '一场战斗中压缩上下文 5 次。', icon: '🗜️', cat: 'claude' },
];

export const ACH_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export function newAchState(): AchState {
  return { unlocked: {}, counters: {}, seen: [] };
}

export type AchEvent =
  /** 一场战斗结束（胜或负） */
  | { t: 'combat'; g: Combat; run: Run; win: boolean }
  /** 一次攀登结束 */
  | { t: 'runEnd'; run: Run; win: boolean }
  /** 任意操作之后：检查金币、遗物、牌组等即时状态 */
  | { t: 'tick'; run: Run };

const bump = (s: AchState, key: string, n = 1) => {
  if (n > 0) s.counters[key] = (s.counters[key] ?? 0) + n;
};

/** 处理一个事件：更新计数，返回本次新解锁的成就 id */
export function processEvent(s: AchState, ev: AchEvent, now = Date.now()): string[] {
  const hit: string[] = [];
  const want = (id: string, cond: boolean | number | undefined) => {
    if (cond) hit.push(id);
  };
  if (ev.t === 'combat') {
    const { g, run, win } = ev;
    const seen = new Set(s.seen);
    for (const e of g.enemies) seen.add(e.defId);
    s.seen = [...seen];
    bump(s, 'potions', g.total.potions);
    if (win) {
      bump(s, 'kills', g.enemies.filter((e) => e.dead).length);
      if (g.elite) bump(s, 'elites');
      want('first_blood', true);
      want('big_hit', g.best.hit >= 50);
      want('huge_hit', g.best.hit >= 99);
      want('combo', g.best.turnCards >= 10);
      want('storm', g.best.turnDmg >= 100);
      want('clutch', g.player.hp > 0 && g.player.hp <= 5);
      want('compact_5', g.compacts >= 5);
      if (g.boss) {
        want('flawless_boss', g.total.hpLost === 0);
        if (run.act === 1) {
          want('act1', true);
          s.counters[`act1_${run.zone}`] = 1;
        }
        if (run.act === 2) want('act2', true);
        if (run.char === 'claude') {
          const ids = new Set(g.enemies.map((e) => e.defId));
          want('beat_gemini', ids.has('gemini_pro'));
          want('beat_grok', ids.has('grok'));
          want('beat_openai', ids.has('openai'));
        }
      }
    }
  } else if (ev.t === 'runEnd') {
    const { run, win } = ev;
    bump(s, 'runs');
    if (win) {
      bump(s, `win_${run.char}`);
      want('summit', true);
      want('asc5', run.ascension >= 5);
      want('asc10', run.ascension >= 10);
      want('lean', run.deck.length <= 15);
    } else {
      want('early_fall', run.act === 1 && run.floor <= 3);
    }
  } else {
    const { run } = ev;
    want('rich', run.gold >= 500);
    want('hoarder', run.relics.length >= 20);
    want('big_deck', run.deck.length >= 50);
    want('elite_run', run.stats.elites >= 4);
  }
  // 由累计计数决定的成就
  for (const c of CHAR_ORDER) want(`win_${c}`, s.counters[`win_${c}`]);
  want('both_roads', s.counters.act1_overgrowth && s.counters.act1_underdocks);
  for (const a of ACHIEVEMENTS) if (a.progress && a.goal) want(a.id, a.progress(s) >= a.goal);

  const fresh: string[] = [];
  for (const id of hit) {
    if (!ACH_BY_ID[id] || s.unlocked[id]) continue;
    s.unlocked[id] = now;
    fresh.push(id);
  }
  return fresh;
}

/** 老存档：根据已有的战绩补发能确定的成就（不弹提示） */
export function backfill(s: AchState, profile: { wins: number; runs: number; maxAsc: Partial<Record<CharId, number>> }, now = Date.now()) {
  s.counters.runs = Math.max(s.counters.runs ?? 0, profile.runs);
  for (const c of CHAR_ORDER) {
    // 每次登顶都会把该角色的最高进阶 +1，所以 maxAsc > 0 说明用它登顶过
    const asc = profile.maxAsc[c] ?? 0;
    if (asc > 0) s.counters[`win_${c}`] = Math.max(s.counters[`win_${c}`] ?? 0, 1);
    if (asc >= 6 && !s.unlocked.asc5) s.unlocked.asc5 = now;
  }
  if (profile.wins > 0) {
    for (const id of ['first_blood', 'act1', 'act2', 'summit']) if (!s.unlocked[id]) s.unlocked[id] = now;
  }
  for (const c of CHAR_ORDER) if (s.counters[`win_${c}`] && !s.unlocked[`win_${c}`]) s.unlocked[`win_${c}`] = now;
  if (CHAR_ORDER.every((c) => s.counters[`win_${c}`]) && !s.unlocked.all_chars) s.unlocked.all_chars = now;
  if ((s.counters.runs ?? 0) >= 10 && !s.unlocked.runs_10) s.unlocked.runs_10 = now;
}

/** 合并两份成就记录（本机与云端）：解锁取并集并保留较早的时间，计数取较大值 */
export function mergeAch(a: AchState, b: Partial<AchState> | null | undefined): AchState {
  if (!b) return a;
  const unlocked = { ...a.unlocked };
  for (const [id, t] of Object.entries(b.unlocked ?? {})) {
    const v = Number(t) || 0;
    if (!ACH_BY_ID[id] || !v) continue;
    unlocked[id] = unlocked[id] ? Math.min(unlocked[id], v) : v;
  }
  const counters = { ...a.counters };
  for (const [k, v] of Object.entries(b.counters ?? {})) counters[k] = Math.max(counters[k] ?? 0, Number(v) || 0);
  const seen = [...new Set([...a.seen, ...(Array.isArray(b.seen) ? b.seen.filter((x) => typeof x === 'string') : [])])];
  return { unlocked, counters, seen };
}
