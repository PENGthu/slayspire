// 卡牌注册表：编号、按 id 查询、组成牌库。
import { registerBuilding } from '../buildings';
import type { AnimalCard, Card, ProjectCard, ScoringCard, SponsorCard } from '../types';
import { ANIMALS } from './animals';
import { PROJECTS, SCORING } from './projects';
import { SPONSORS } from './sponsors';

export const CARDS: Record<string, Card> = {};
export const SCORING_CARDS: Record<string, ScoringCard> = {};

let n = 1;
for (const c of [...ANIMALS, ...SPONSORS, ...PROJECTS]) {
  if (CARDS[c.id]) throw new Error(`重复的卡牌 id：${c.id}`);
  c.num = n++;
  CARDS[c.id] = c;
}
for (const s of SCORING) SCORING_CARDS[s.id] = s;

// 赞助卡的专属建筑
for (const s of SPONSORS) {
  if (!s.building) continue;
  registerBuilding({
    id: s.id,
    name: s.name,
    emoji: s.emoji,
    kind: 'sponsor',
    shape: s.building.shape,
    unique: true,
    text: s.text,
  });
}

export function card(id: string): Card {
  const c = CARDS[id];
  if (!c) throw new Error(`未知卡牌 ${id}`);
  return c;
}

export function animal(id: string): AnimalCard {
  const c = card(id);
  if (c.kind !== 'animal') throw new Error(`${id} 不是动物卡`);
  return c;
}

export function sponsor(id: string): SponsorCard {
  const c = card(id);
  if (c.kind !== 'sponsor') throw new Error(`${id} 不是赞助卡`);
  return c;
}

export function project(id: string): ProjectCard {
  const c = card(id);
  if (c.kind !== 'project') throw new Error(`${id} 不是保护项目`);
  return c;
}

/** 进入牌库的卡（基础项目除外） */
export function deckCards(): string[] {
  return Object.values(CARDS)
    .filter((c) => !(c.kind === 'project' && c.base))
    .map((c) => c.id);
}

export function baseProjects(): string[] {
  return PROJECTS.filter((p) => p.base).map((p) => p.id);
}

export { ANIMALS, SPONSORS, PROJECTS, SCORING };
