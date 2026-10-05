import type { Card, CardDef } from './types';
import type { Combat } from './combat';

/** 附魔：《杀戮尖塔 2》中可以附着在卡牌上的永久强化。 */
export interface EnchantDef {
  id: string;
  name: string;
  color: string;
  desc: (n: number) => string;
  /** 能否附着到该卡牌上 */
  fits: (def: CardDef) => boolean;
  dmgAdd?: (n: number) => number;
  blkAdd?: (n: number) => number;
  costAdd?: (n: number) => number;
  innate?: boolean;
  retain?: boolean;
  /** 每场战斗首次打出时的额外效果 */
  onFirstPlay?: (g: Combat, c: Card, n: number) => void;
  /** 每次打出时的额外效果 */
  onPlay?: (g: Combat, c: Card, n: number) => void;
}
