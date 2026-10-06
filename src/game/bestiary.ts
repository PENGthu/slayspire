import { Rng } from '../core/rng';
import type { Combat } from './combat';
import { ENCOUNTERS, ENEMIES, POWERS } from './registry';
import type { EncounterDef, EnemyDef, Enemy, IntentKind } from './types';

/** 怪物图鉴：按区域与级别整理所有敌人 */

export type RegionId = 'overgrowth' | 'underdocks' | 'hive' | 'glory' | 'claude';

export const REGIONS: { id: RegionId; name: string; sub: string }[] = [
  { id: 'overgrowth', name: '蔓生密林', sub: '第一幕' },
  { id: 'underdocks', name: '地下船坞', sub: '第一幕' },
  { id: 'hive', name: '嗡鸣蜂巢', sub: '第二幕' },
  { id: 'glory', name: '荣光之巅', sub: '第三幕' },
  { id: 'claude', name: '小克专属', sub: '首领' },
];

export type Rank = 'normal' | 'elite' | 'boss' | 'follower' | 'summon';

export const RANK_NAMES: Record<Rank, string> = {
  normal: '普通',
  elite: '精英',
  boss: '首领',
  follower: '首领随从',
  summon: '召唤物',
};

const RANK_ORDER: Rank[] = ['normal', 'elite', 'boss', 'follower', 'summon'];

export const INTENT_NAMES: Record<IntentKind, string> = {
  attack: '攻击',
  attackBuff: '攻击 · 强化',
  attackDebuff: '攻击 · 削弱',
  attackDefend: '攻击 · 格挡',
  buff: '强化',
  debuff: '削弱',
  strongDebuff: '强力削弱',
  defend: '格挡',
  defendBuff: '格挡 · 强化',
  escape: '逃跑',
  sleep: '沉睡',
  stun: '无法行动',
  unknown: '未知',
  summon: '召唤',
  heal: '回复',
};

export interface BestiaryMove {
  id: string;
  name: string;
  intent: IntentKind;
  /** 伤害文字，如「12」「3×3」「可变」；不造成伤害时为空 */
  dmg: string;
}

export interface BestiaryPower {
  id: string;
  name: string;
  art: string;
  amount: number;
  desc: string;
}

export interface BestiaryEntry {
  def: EnemyDef;
  regions: RegionId[];
  rank: Rank;
  /** 出现在哪些遭遇中（遭遇名） */
  encounters: string[];
  /** 召唤者的名字 */
  summoner?: string;
  moves: BestiaryMove[];
  powers: BestiaryPower[];
}

function encRegion(e: EncounterDef): RegionId {
  if (e.char) return 'claude';
  if (e.act === 1) return e.zone === 'underdocks' ? 'underdocks' : 'overgrowth';
  return e.act === 2 ? 'hive' : 'glory';
}

/** 遭遇里可能出现的全部敌人（随机组合的遭遇取多个种子的并集） */
function encEnemies(e: EncounterDef): Set<string> {
  if (Array.isArray(e.enemies)) return new Set(e.enemies);
  const out = new Set<string>();
  for (let seed = 1; seed <= 60; seed++) for (const id of e.enemies(new Rng(seed))) out.add(id);
  return out;
}

function moveList(def: EnemyDef): BestiaryMove[] {
  return Object.entries(def.moves)
    .filter(([id]) => id !== 'revive' && id !== 'fade')
    .map(([id, m]) => {
      let dmg = '';
      if (m.dmg !== undefined) {
        const hits = typeof m.hits === 'number' ? m.hits : m.hits ? 0 : 1;
        const base = typeof m.dmg === 'number' ? String(m.dmg) : '可变';
        dmg = hits === 1 ? base : hits === 0 ? `${base}×?` : `${base}×${hits}`;
      }
      return { id, name: m.name, intent: m.intent, dmg };
    });
}

/** 敌人登场时自带的能力（用一个只记录 apply 的替身战斗运行 init） */
function initialPowers(def: EnemyDef): BestiaryPower[] {
  if (!def.init) return [];
  const e = { defId: def.id, hp: def.hp[1], maxHp: def.hp[1], block: 0, powers: {}, justApplied: {}, mem: {} } as unknown as Enemy;
  const got: Record<string, number> = {};
  const noop = () => undefined;
  const fake = new Proxy(
    {},
    {
      get: (_t, k) =>
        k === 'apply'
          ? (tgt: unknown, id: string, n: number) => {
              if (tgt === e) got[id] = (got[id] ?? 0) + n;
              return true;
            }
          : noop,
    },
  ) as unknown as Combat;
  try {
    def.init(e, fake);
  } catch {
    // 图鉴里只做展示，init 出错时忽略
  }
  return Object.entries(got)
    .filter(([id]) => POWERS[id] && !POWERS[id].hidden)
    .map(([id, n]) => {
      const p = POWERS[id];
      return { id, name: p.name, art: p.art, amount: n, desc: p.desc(n, e) };
    });
}

let cache: BestiaryEntry[] | null = null;

export function bestiary(): BestiaryEntry[] {
  if (cache) return cache;
  const byEnemy = new Map<string, EncounterDef[]>();
  for (const enc of Object.values(ENCOUNTERS)) {
    for (const id of encEnemies(enc)) {
      if (!byEnemy.has(id)) byEnemy.set(id, []);
      byEnemy.get(id)!.push(enc);
    }
  }
  const entries: BestiaryEntry[] = [];
  const pending: EnemyDef[] = [];
  for (const def of Object.values(ENEMIES)) {
    const encs = byEnemy.get(def.id) ?? [];
    if (!encs.length) {
      pending.push(def);
      continue;
    }
    const kinds = new Set(encs.map((e) => e.kind));
    const rank: Rank = kinds.has('boss') ? (def.hp[1] >= 80 ? 'boss' : 'follower') : kinds.has('elite') ? 'elite' : 'normal';
    entries.push({
      def,
      regions: [...new Set(encs.map(encRegion))],
      rank,
      encounters: [...new Set(encs.map((e) => e.name))],
      moves: moveList(def),
      powers: initialPowers(def),
    });
  }
  // 召唤物跟随召唤者所在的区域
  for (const def of pending) {
    const by = def.summonedBy ? entries.find((x) => x.def.id === def.summonedBy) : undefined;
    entries.push({
      def,
      regions: by ? [...by.regions] : [],
      rank: 'summon',
      encounters: [],
      summoner: by?.def.name,
      moves: moveList(def),
      powers: initialPowers(def),
    });
  }
  const regionIdx = (e: BestiaryEntry) => Math.min(...e.regions.map((r) => REGIONS.findIndex((x) => x.id === r)), 99);
  entries.sort((a, b) => regionIdx(a) - regionIdx(b) || RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank) || a.def.hp[1] - b.def.hp[1]);
  cache = entries;
  return entries;
}

export function hpRange(def: EnemyDef): string {
  return def.hp[0] === def.hp[1] ? String(def.hp[0]) : `${def.hp[0]}–${def.hp[1]}`;
}
