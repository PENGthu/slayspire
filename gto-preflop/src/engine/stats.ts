// 训练记录：总体、按场景、按位置的正确率，以及最近的答题历史（用于错题重练）。
import type { Card } from '../poker/cards';
import type { Grade } from './trainer';

export interface Tally {
  n: number;
  ok: number;
}

export interface AnswerRecord {
  t: number;
  key: string;
  title: string;
  family: string;
  hero: string;
  source: 'sixmax' | 'solver';
  hand: number;
  cards: [Card, Card];
  /** 所选行动的文字 */
  action: string;
  grade: Grade;
  correct: boolean;
  /** 各行动的文字与 GTO 频率 */
  labels: string[];
  freqs: number[];
}

export interface Stats {
  total: Tally;
  byKey: Record<string, Tally>;
  byFamily: Record<string, Tally>;
  byHero: Record<string, Tally>;
  /** 场景 × 位置，键为 "family|hero" */
  byFamilyHero: Record<string, Tally>;
  streak: number;
  bestStreak: number;
  history: AnswerRecord[];
}

export const HISTORY_LIMIT = 300;

export function emptyStats(): Stats {
  return { total: { n: 0, ok: 0 }, byKey: {}, byFamily: {}, byHero: {}, byFamilyHero: {}, streak: 0, bestStreak: 0, history: [] };
}

function bump(map: Record<string, Tally>, key: string, ok: boolean) {
  const t = (map[key] ??= { n: 0, ok: 0 });
  t.n++;
  if (ok) t.ok++;
}

/** 返回记录后的新对象（不修改原对象） */
export function record(s: Stats, r: AnswerRecord): Stats {
  const next: Stats = structuredClone(s);
  next.total.n++;
  if (r.correct) next.total.ok++;
  bump(next.byKey, r.key, r.correct);
  bump(next.byFamily, r.family, r.correct);
  bump(next.byHero, r.hero, r.correct);
  bump(next.byFamilyHero, `${r.family}|${r.hero}`, r.correct);
  next.streak = r.correct ? next.streak + 1 : 0;
  next.bestStreak = Math.max(next.bestStreak, next.streak);
  next.history = [r, ...next.history].slice(0, HISTORY_LIMIT);
  return next;
}

export const accuracy = (t: Tally | undefined) => (t && t.n ? t.ok / t.n : NaN);

/** 最近答错的题（同一决策点、同一手牌只保留一次） */
export function mistakes(s: Stats, limit = 50): AnswerRecord[] {
  const seen = new Set<string>();
  const out: AnswerRecord[] = [];
  for (const r of s.history) {
    if (r.correct) continue;
    const id = `${r.key}|${r.hand}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

/** 校验从存储里读出的数据，结构不对时返回 null */
export function parseStats(raw: unknown): Stats | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<Stats>;
  if (!s.total || typeof s.total.n !== 'number' || !Array.isArray(s.history)) return null;
  return { ...emptyStats(), ...s } as Stats;
}
