import type {
  CardDef,
  EncounterDef,
  EnemyDef,
  PotionDef,
  PowerDef,
  RelicDef,
} from './types';
import type { EventDef } from './events';
import type { AncientDef } from './ancients';
import type { EnchantDef } from './enchants';

/** 所有游戏内容的注册表，由 content/* 模块在加载时填充。 */
export const CARDS: Record<string, CardDef> = {};
export const POWERS: Record<string, PowerDef> = {};
export const RELICS: Record<string, RelicDef> = {};
export const POTIONS: Record<string, PotionDef> = {};
export const ENEMIES: Record<string, EnemyDef> = {};
export const ENCOUNTERS: Record<string, EncounterDef> = {};
export const EVENTS: Record<string, EventDef> = {};
export const ANCIENTS: Record<string, AncientDef> = {};
export const ENCHANTS: Record<string, EnchantDef> = {};

function reg<T extends { id: string }>(table: Record<string, T>, kind: string, defs: T[]) {
  for (const d of defs) {
    if (table[d.id]) throw new Error(`重复的${kind} id: ${d.id}`);
    table[d.id] = d;
  }
}

export const defineCards = (defs: CardDef[]) => reg(CARDS, '卡牌', defs);
export const definePowers = (defs: PowerDef[]) => reg(POWERS, '能力', defs);
export const defineRelics = (defs: RelicDef[]) => reg(RELICS, '遗物', defs);
export const definePotions = (defs: PotionDef[]) => reg(POTIONS, '药水', defs);
export const defineEnemies = (defs: EnemyDef[]) => reg(ENEMIES, '敌人', defs);
export const defineEncounters = (defs: EncounterDef[]) => reg(ENCOUNTERS, '遭遇', defs);
export const defineEvents = (defs: EventDef[]) => reg(EVENTS, '事件', defs);
export const defineAncients = (defs: AncientDef[]) => reg(ANCIENTS, '先古', defs);
export const defineEnchants = (defs: EnchantDef[]) => reg(ENCHANTS, '附魔', defs);
