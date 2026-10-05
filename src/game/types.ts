import type { Combat } from './combat';
import type { Run } from './run';

export type CharId = 'ironclad' | 'silent' | 'regent' | 'necrobinder' | 'defect';
export type Color = CharId | 'colorless' | 'curse' | 'status';
export type CardType = 'attack' | 'skill' | 'power' | 'status' | 'curse';
export type Rarity = 'basic' | 'common' | 'uncommon' | 'rare' | 'special' | 'curse' | 'status';
/** enemy: 指定一名敌人；all: 全体敌人；self/none: 无需目标 */
export type Target = 'enemy' | 'all' | 'self' | 'none';

/** 普通值或 [未升级, 升级] 值 */
export type UV<T> = T | readonly [T, T];

export const COST_X = -1;
export const UNPLAYABLE = -2;

// ---------------------------------------------------------------------------
// 卡牌
// ---------------------------------------------------------------------------

export interface Enchant {
  id: string;
  n: number;
}

/** 一张卡牌实例。牌组中的卡与战斗中的卡共用此结构（战斗开始时复制）。 */
export interface Card {
  uid: number;
  id: string;
  up: boolean;
  ench?: Enchant;
  /** 永久成长数值（如「仪式匕首」） */
  misc: number;
  /** 指向牌组中原卡的 uid（仅战斗副本） */
  deckUid?: number;
  // ---- 战斗内临时字段 ----
  costTurn?: number;
  costCombat?: number;
  freeOnce?: boolean;
  tmpDmg?: number;
  tmpBlk?: number;
  retainOnce?: boolean;
  /** 本场战斗被打出的次数 */
  played?: number;
  /** 苦难（战斗中由敌人施加的负面卡牌修饰） */
  afflict?: string;
}

export interface CardDef {
  id: string;
  name: string;
  color: Color;
  type: CardType;
  rarity: Rarity;
  /** 能量费用；COST_X 为 X 费；UNPLAYABLE 为不能打出 */
  cost: UV<number>;
  /** 星辰费用（储君） */
  star?: UV<number>;
  target: Target;
  dmg?: UV<number>;
  blk?: UV<number>;
  mag?: UV<number>;
  mag2?: UV<number>;
  exhaust?: UV<boolean>;
  ethereal?: UV<boolean>;
  innate?: UV<boolean>;
  retain?: UV<boolean>;
  /** 描述，支持 {D} 伤害、{B} 格挡、{M} {N} 数值 */
  text: UV<string>;
  art: string;
  tags?: string[];
  /** 是否不进入奖励池 */
  noPool?: boolean;
  play?: (g: Combat, c: Card, t: Enemy | null) => void;
  /** 返回 true 或不可打出的原因 */
  canPlay?: (g: Combat, c: Card) => true | string;
  /** 动态基础伤害 */
  dmgFn?: (g: Combat | null, c: Card) => number;
  blkFn?: (g: Combat | null, c: Card) => number;
  /** 动态费用修正（返回调整后的费用） */
  costFn?: (g: Combat, c: Card, cost: number) => number;
  onDraw?: (g: Combat, c: Card) => void;
  onExhaust?: (g: Combat, c: Card) => void;
  /** 被手动弃置时（非回合结束） */
  onManualDiscard?: (g: Combat, c: Card) => void;
  /** 回合结束时仍在手牌中 */
  onTurnEndInHand?: (g: Combat, c: Card) => void;
  /** 回合结束时被保留 */
  onRetain?: (g: Combat, c: Card) => void;
  /** 手中有此牌时打出了其他牌 */
  onOtherPlayed?: (g: Combat, c: Card, played: Card) => void;
  /** 从牌组移除时 */
  onRemove?: (run: Run) => void;
}

// ---------------------------------------------------------------------------
// 生物与能力
// ---------------------------------------------------------------------------

export interface Creature {
  uid: number;
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  powers: Record<string, number>;
  /** 本轮由敌方施加、本轮结束时不衰减的能力 */
  justApplied: Record<string, boolean>;
  isPlayer: boolean;
  dead: boolean;
}

export interface Enemy extends Creature {
  defId: string;
  art: string;
  move: string | null;
  history: string[];
  turns: number;
  minion: boolean;
  escaped: boolean;
  /** AI 记忆 */
  mem: Record<string, number>;
  /** 显示尺寸倍率 */
  size: number;
}

export interface Player extends Creature {
  char: CharId;
}

/** 奥斯提（亡灵契约师的伙伴） */
export interface Companion extends Creature {
  alive: boolean;
}

export type PowerType = 'buff' | 'debuff';

export interface PowerDef {
  id: string;
  name: string;
  art: string;
  type: PowerType;
  desc: (n: number, owner?: Creature) => string;
  /** round: 每轮结束（敌方回合后）层数 -1；start: 拥有者回合开始时 -1；turnEnd: 拥有者回合结束时 -1；clear: 回合结束移除 */
  decay?: 'round' | 'start' | 'turnEnd' | 'clear' | 'startClear';
  /** 层数可为负（力量、敏捷） */
  negative?: boolean;
  /** 不显示层数 */
  noStack?: boolean;
  hidden?: boolean;
  // ---- 钩子 ----
  onTurnStart?: (g: Combat, o: Creature, n: number) => void;
  onTurnStartPostDraw?: (g: Combat, o: Creature, n: number) => void;
  onTurnEnd?: (g: Combat, o: Creature, n: number) => void;
  /** 修改该生物造成的攻击伤害（加法阶段之后的乘法阶段） */
  dmgOut?: (g: Combat, o: Creature, n: number, d: number, card: Card | null) => number;
  /** 加法阶段（力量、活力） */
  dmgOutAdd?: (g: Combat, o: Creature, n: number, card: Card | null) => number;
  dmgIn?: (g: Combat, o: Creature, n: number, d: number, src: Creature | null) => number;
  /** 最终受到伤害（格挡前），如无实体 */
  dmgInFinal?: (g: Combat, o: Creature, n: number, d: number, src: Creature | null) => number;
  blockMod?: (g: Combat, o: Creature, n: number, b: number) => number;
  onAttacked?: (g: Combat, o: Creature, n: number, src: Creature, dmg: number) => void;
  onHpLost?: (g: Combat, o: Creature, n: number, amount: number, src: Creature | null) => void;
  onCardPlayed?: (g: Combat, o: Creature, n: number, c: Card) => void;
  afterCardPlayed?: (g: Combat, o: Creature, n: number, c: Card) => void;
  onGainBlock?: (g: Combat, o: Creature, n: number, amount: number) => void;
  onExhaust?: (g: Combat, o: Creature, n: number, c: Card) => void;
  onDraw?: (g: Combat, o: Creature, n: number, c: Card) => void;
  onApplyDebuff?: (g: Combat, o: Creature, n: number, target: Creature, id: string) => void;
  onDeath?: (g: Combat, o: Creature, n: number) => void;
  /** 拥有者（玩家）用攻击牌造成伤害后 */
  onDealAttack?: (g: Combat, o: Creature, n: number, target: Creature, dealt: number) => void;
  onOstyDeath?: (g: Combat, o: Creature, n: number) => void;
  onEnemyDeath?: (g: Combat, o: Creature, n: number, dead: Enemy) => void;
  onStarsSpent?: (g: Combat, o: Creature, n: number, spent: number) => void;
  onStarsGained?: (g: Combat, o: Creature, n: number, gained: number) => void;
  onSummon?: (g: Combat, o: Creature, n: number, amount: number) => void;
  onShuffle?: (g: Combat, o: Creature, n: number) => void;
  onManualDiscard?: (g: Combat, o: Creature, n: number, c: Card) => void;
}

// ---------------------------------------------------------------------------
// 遗物与药水
// ---------------------------------------------------------------------------

export type RelicTier = 'starter' | 'common' | 'uncommon' | 'rare' | 'boss' | 'shop' | 'event' | 'ancient';

export interface RelicInst {
  id: string;
  counter: number;
  used?: boolean;
}

export interface RelicDef {
  id: string;
  name: string;
  art: string;
  tier: RelicTier;
  char?: CharId;
  desc: string;
  flavor?: string;
  /** 显示计数器 */
  counter?: boolean;
  /** 每回合额外能量（首领遗物） */
  energy?: number;
  onPickup?: (run: Run, r: RelicInst) => void;
  onCombatStart?: (g: Combat, r: RelicInst) => void;
  onCombatStartPostDraw?: (g: Combat, r: RelicInst) => void;
  onTurnStart?: (g: Combat, r: RelicInst) => void;
  onTurnStartPostDraw?: (g: Combat, r: RelicInst) => void;
  onTurnEnd?: (g: Combat, r: RelicInst) => void;
  onCardPlayed?: (g: Combat, r: RelicInst, c: Card) => void;
  onAttackDamage?: (g: Combat, r: RelicInst, d: number, card: Card | null) => number;
  onPlayerHpLoss?: (g: Combat, r: RelicInst, amount: number) => void;
  /** 修改玩家将失去的生命（钨合金棍、鸟居） */
  modHpLoss?: (g: Combat, r: RelicInst, amount: number, attack: boolean) => number;
  onExhaust?: (g: Combat, r: RelicInst, c: Card) => void;
  onEnemyDeath?: (g: Combat, r: RelicInst, e: Enemy) => void;
  onShuffle?: (g: Combat, r: RelicInst) => void;
  onVictory?: (g: Combat, r: RelicInst) => void;
  onPotionUsed?: (run: Run, r: RelicInst, g: Combat | null) => void;
  onGainBlock?: (g: Combat, r: RelicInst, amount: number) => void;
  onStarsSpent?: (g: Combat, r: RelicInst, spent: number) => void;
  onSummon?: (g: Combat, r: RelicInst, amount: number) => void;
  onRest?: (run: Run, r: RelicInst) => void;
  onEnterRoom?: (run: Run, r: RelicInst, kind: RoomKind) => void;
  onCardAdded?: (run: Run, r: RelicInst, c: Card) => void;
  /** 玩家死亡时触发复活，返回 true 表示已复活 */
  onDeath?: (g: Combat, r: RelicInst) => boolean;
}

export type PotionRarity = 'common' | 'uncommon' | 'rare';

export interface PotionDef {
  id: string;
  name: string;
  art: string;
  color: string;
  rarity: PotionRarity;
  char?: CharId;
  target: 'enemy' | 'none';
  desc: string;
  /** 战斗外可用 */
  outOfCombat?: boolean;
  combatOnly?: boolean;
  use: (ctx: { run: Run; g: Combat | null; t: Enemy | null; potency: number }) => void;
  /** 当玩家死亡时自动使用 */
  onDeath?: boolean;
}

// ---------------------------------------------------------------------------
// 敌人
// ---------------------------------------------------------------------------

export type IntentKind =
  | 'attack'
  | 'attackBuff'
  | 'attackDebuff'
  | 'attackDefend'
  | 'buff'
  | 'debuff'
  | 'strongDebuff'
  | 'defend'
  | 'defendBuff'
  | 'escape'
  | 'sleep'
  | 'stun'
  | 'unknown'
  | 'summon'
  | 'heal';

export interface MoveDef {
  name: string;
  intent: IntentKind;
  dmg?: number | ((e: Enemy, g: Combat) => number);
  hits?: number | ((e: Enemy, g: Combat) => number);
  act: (e: Enemy, g: Combat) => void;
}

export interface EnemyDef {
  id: string;
  name: string;
  art: string;
  hp: [number, number];
  size?: number;
  moves: Record<string, MoveDef>;
  /** 选择下一回合的行动 */
  ai: (e: Enemy, g: Combat) => string;
  init?: (e: Enemy, g: Combat) => void;
  desc?: string;
}

export type EncounterKind = 'weak' | 'strong' | 'elite' | 'boss';

export interface EncounterDef {
  id: string;
  name: string;
  act: number;
  /** 区域（第一幕有两种：蔓生密林 overgrowth / 地下船坞 underdocks） */
  zone?: string;
  kind: EncounterKind;
  enemies: string[] | ((rng: import('../core/rng').Rng) => string[]);
  weight?: number;
  /** Boss 地图图标 */
  art?: string;
}

// ---------------------------------------------------------------------------
// 地图与房间
// ---------------------------------------------------------------------------

export type RoomKind = 'monster' | 'elite' | 'rest' | 'shop' | 'event' | 'treasure' | 'boss' | 'ancient';

export interface MapNode {
  row: number;
  col: number;
  kind: RoomKind;
  next: number[]; // 下一行的 col
  /** 用于显示的轻微偏移 */
  dx: number;
  dy: number;
}

export interface MapData {
  rows: (MapNode | null)[][];
  width: number;
  height: number;
}
