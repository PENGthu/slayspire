// 方舟动物园的核心类型。游戏状态是纯 JSON（可直接存档、克隆），卡牌等静态内容只用 id 引用。
// 卡牌功能按原版基础游戏复刻（数据见 content/），卡面文字与插图由本作自行生成。
import type { BonusId, LeftBonusId } from './maps';

export type ActionId = 'animals' | 'build' | 'cards' | 'association' | 'sponsors';
export const ACTIONS: ActionId[] = ['animals', 'build', 'cards', 'association', 'sponsors'];

export type Continent = 'africa' | 'europe' | 'asia' | 'americas' | 'australia';
export const CONTINENTS: Continent[] = ['africa', 'europe', 'asia', 'americas', 'australia'];

export type Category = 'predator' | 'herbivore' | 'bird' | 'reptile' | 'primate' | 'bear' | 'petting';
export const CATEGORIES: Category[] = ['predator', 'herbivore', 'bird', 'reptile', 'primate', 'bear', 'petting'];

/** 卡牌上的图标：大洲、动物种类、研究、水、岩石 */
export type Icon = Continent | Category | 'science' | 'water' | 'rock';

export type SpecialKind = 'petting' | 'reptile' | 'aviary';

/** 一次性收益 */
export interface Gain {
  money?: number;
  appeal?: number;
  cp?: number;
  rep?: number;
  x?: number;
  /** 从牌库抽牌 */
  cards?: number;
  worker?: number;
  upgrade?: number;
}

/** 打出卡牌的条件 */
export type Requirement =
  | { k: 'icon'; icon: Icon; n: number }
  /** 动物：需要一个与它同大洲的合作动物园 */
  | { k: 'partner' }
  /** 赞助卡：至少 n 个合作动物园 */
  | { k: 'partners'; n: number }
  | { k: 'upgrade'; action: ActionId }
  | { k: 'rep'; n: number }
  /** 吸引力不超过 n */
  | { k: 'appealMax'; n: number };

/** 动物能力（原版关键词） */
export type Ability =
  | { k: 'sprint'; n: number }
  | { k: 'hunter'; n: number }
  | { k: 'perception'; n: number; keep: number }
  | { k: 'snap'; n: number }
  | { k: 'boost'; action: ActionId }
  | { k: 'actionNow'; action: ActionId }
  | { k: 'multiplier'; action: ActionId }
  | { k: 'clever' }
  | { k: 'pack' }
  | { k: 'iconic'; cont: Continent }
  | { k: 'pouch'; n: number }
  | { k: 'sunbathe'; n: number }
  | { k: 'venom'; n: number }
  | { k: 'constrict' }
  | { k: 'hypnosis'; n: number }
  | { k: 'jump'; n: number }
  | { k: 'dig'; n: number }
  | { k: 'posture'; n: number }
  | { k: 'resist' }
  | { k: 'assert' }
  | { k: 'dominance' }
  | { k: 'scavenge'; n: number }
  | { k: 'inventive'; n: number }
  | { k: 'inventiveBear' }
  | { k: 'inventivePrimate' }
  | { k: 'fullThroated' }
  | { k: 'flock'; n: number }
  | { k: 'sponsorMagnet' }
  | { k: 'pilfer'; n: number }
  | { k: 'determination' }
  | { k: 'peacock' }
  | { k: 'petting' };

export interface CardBase {
  id: string;
  /** 原版卡牌编号 */
  num: number;
  name: string;
  en: string;
  emoji: string;
}

export interface AnimalCard extends CardBase {
  kind: 'animal';
  size: number;
  cost: number;
  /** 提供的图标（可重复，比如两个捕食者图标） */
  icons: Icon[];
  /** 围栏需要相邻的水域 / 岩石格数（同时也算作水 / 岩石图标） */
  water?: number;
  rock?: number;
  req?: Requirement[];
  /** 可以住进的特殊场馆，以及占用的容量格数 */
  special?: { kind: SpecialKind; units: number };
  /** 不能住标准围栏（宠物） */
  noStandard?: boolean;
  appeal: number;
  cp?: number;
  rep?: number;
  abilities?: Ability[];
}

/** 赞助卡的专属建筑 */
export interface SponsorBuilding {
  shape: [number, number][];
  /** 至少相邻多少个水域 / 岩石格 */
  water?: number;
  rock?: number;
  /** 至少有几格在地图边缘 */
  border?: number;
  /** 不需要与其他建筑相邻 */
  free?: boolean;
}

export interface SponsorCard extends CardBase {
  kind: 'sponsor';
  level: number;
  icons: Icon[];
  req?: Requirement[];
  /** 打出时立即获得 */
  gain?: Gain;
  building?: SponsorBuilding;
  /** 人物卡（部分效果会用到） */
  person?: boolean;
  /** 规则说明（本作撰写） */
  text: string;
}

export type ProjectGoal =
  | { k: 'icon'; icon: Icon }
  /** 不同的动物种类 / 大洲 */
  | { k: 'kinds'; of: 'category' | 'continent' }
  | { k: 'small' }
  | { k: 'large' }
  /** 放归一只带该图标的动物：三档分别要求体型 ≥4 / =3 / ≤2 */
  | { k: 'release'; icon: Icon }
  /** 繁育：一只该种类的动物，以及与它同大洲的合作动物园 */
  | { k: 'breed'; cat: Category };

export interface ProjectLevel {
  /** 需要的数量（放归项目为体型档：0 = ≥4，1 = 3，2 = ≤2；繁育项目不用） */
  need: number;
  cp: number;
  rep?: number;
}

export interface ProjectCard extends CardBase {
  kind: 'project';
  goal: ProjectGoal;
  /** 三档，从左到右 */
  levels: ProjectLevel[];
  /** 基础项目（开局摆在协会版图旁，不进牌库） */
  base?: boolean;
}

export type Card = AnimalCard | SponsorCard | ProjectCard;

export interface ScoringCard {
  id: string;
  num: number;
  name: string;
  emoji: string;
  /** 达到数量 → 保护点数（取满足的最高一档）；为空表示特殊计分 */
  tiers: [number, number][];
  text: string;
}

// ---------------------------------------------------------------- 状态

export interface Building {
  uid: number;
  type: string;
  cells: number[];
  /** 住在其中的动物卡（标准围栏通常 1 只；群居动物可以合住） */
  animals: string[];
}

export type AiLevel = 'easy' | 'normal' | 'hard';

/** 行动卡上的临时标记（休息时清除） */
export interface CardTokens {
  venom?: number;
  constrict?: number;
  mult?: number;
}

export interface PlayerState {
  name: string;
  ai: AiLevel | null;
  color: string;
  map: string;
  money: number;
  appeal: number;
  cp: number;
  rep: number;
  x: number;
  workers: number;
  /** 行动卡顺序：下标 0 = 1 号位 */
  actions: ActionId[];
  upgraded: Record<ActionId, boolean>;
  tokens: Partial<Record<ActionId, CardTokens>>;
  hand: string[];
  scoring: string[];
  buildings: Building[];
  /** 打出的赞助卡 */
  sponsors: string[];
  partners: Continent[];
  unis: string[];
  /** 支持过的保护项目 */
  supported: { id: string; level: number }[];
  /** 地图左侧还在的玩家标记（0–6） */
  mapTokens: number[];
  /** 压在卡下的牌（育儿袋等）：键为动物所在建筑 uid、赞助卡 id 或 'map' */
  tucked: Record<string, string[]>;
  /** 赞助卡上的玩家标记（繁育合作、霍加狓马厩等） */
  cardTokens: Record<string, number>;
  /** WAZA 特别任务选择的动物类型 */
  waza: 'small' | 'large' | null;
  cpBonuses: number[];
  repBonuses: number[];
  donations: number;
  /** 商港本回合是否已用过 */
  harborTurn: number;
  /** 终局时计算 */
  final?: { cp: number; appeal: number; score: number; breakdown: { label: string; cp: number; appeal?: number }[] };
  stats: { turns: number; animals: number; released: number };
}

export type TaskId = 'rep' | 'partner' | 'university' | 'project';

export interface BoardProject {
  id: string;
  /** 每一档由谁占据 */
  slots: (number | null)[];
}

export interface LogEntry {
  p: number | null;
  text: string;
  turn: number;
}

/** 多选一时的选项 */
export type Opt =
  | { k: 'upgrade'; action: ActionId }
  | { k: 'worker' }
  | { k: 'tile'; id: string }
  | { k: 'gain'; gain: Gain }
  /** 催眠：执行对手的行动卡 */
  | { k: 'hypno'; target: number; action: ActionId }
  /** 把行动卡移到某个位置（to：0 = 1 号位，4 = 5 号位） */
  | { k: 'slot'; action: ActionId; to: number }
  /** 在行动卡上放倍增标记 */
  | { k: 'mult'; action: ActionId }
  /** 拿走地图左侧的一个玩家标记 */
  | { k: 'mapToken'; i: number }
  /** 被掠夺的玩家决定给牌还是给钱 */
  | { k: 'pilfer'; thief: number; give: 'card' | 'money' }
  | { k: 'waza'; size: 'small' | 'large' }
  | { k: 'partner'; continent: Continent }
  | { k: 'university'; uni: string }
  /** 任选一个放置奖励（考古学家） */
  | { k: 'bonus'; bonus: BonusId }
  /** 把一个没用到的基础保护项目加入手牌 */
  | { k: 'project'; id: string }
  | { k: 'none' };

export type PickPurpose =
  | 'discard'
  | 'keep'
  | 'keepAnimal'
  | 'sell'
  | 'pouch'
  | 'setup'
  | 'scoring'
  | 'scoringDrop'
  | 'harbor';

/** 延后结算的效果（按顺序排在栈上，前一个效果引发的决定结算完才轮到下一个） */
export type Fx =
  /** 动物能力 */
  | { t: 'ability'; ab: Ability; card: string; uid: number }
  /** 自己的赞助卡被图标触发 */
  | { t: 'trigger'; sponsor: string; icon: Icon }
  /** 赞助卡打出时的立即效果 */
  | { t: 'sponsor'; id: string }
  /** 放置奖励 */
  | { t: 'bonus'; bonus: BonusId; border: boolean }
  /** 地图左侧的奖励 */
  | { t: 'left'; id: LeftBonusId }
  /** 好莱坞山：翻到第一张赞助卡 */
  | { t: 'hills' }
  /** 行动结束后才结算的能力（助推、聪慧、行动、决心、催眠） */
  | { t: 'post'; ab: Ability; except?: ActionId }
  /** 保护点数轨上的奖励板块 */
  | { t: 'tile'; id: string }
  /** 再执行 1 个行动 */
  | { t: 'extraAction' }
  | { t: 'gain'; gain: Gain; why: string };

export type Frame =
  // —— 需要玩家决定的
  | { k: 'turn'; p: number }
  /** 额外的行动（决心、行动能力、地图奖励）：only 限定行动卡，except 排除行动卡 */
  | { k: 'extra'; p: number; only: ActionId | null; except: ActionId | null; reason: string }
  | { k: 'build'; p: number; str: number; up: boolean; budget: number; built: string[]; engineer: boolean }
  | {
      k: 'animals';
      p: number;
      str: number;
      up: boolean;
      left: number;
      played: number;
      /** 这次行动打出的都是小型动物 */
      allSmall: boolean;
      onlySmall: boolean;
      /** 正在使用世界动物园协会小型动物计划的额外打出 */
      waza228: boolean;
    }
  | { k: 'cards'; p: number; str: number; up: boolean }
  | { k: 'assoc'; p: number; str: number; up: boolean; budget: number; used: TaskId[]; donated: boolean }
  | { k: 'sponsors'; p: number; str: number; up: boolean; budget: number; played: number }
  | {
      k: 'pick';
      p: number;
      purpose: PickPurpose;
      /** 候选卡（翻开的牌等）；为空表示从手牌中选 */
      cards: string[];
      min: number;
      max: number;
      /** 压牌的位置（建筑 uid、赞助卡 id 或 'map'） */
      under?: string;
    }
  | { k: 'choose'; p: number; reason: string; opts: Opt[] }
  | { k: 'place'; p: number; types: string[]; reason: string; count: number; ignoreUpgrade: boolean }
  /** 从展示区拿牌：any = 不受声望范围限制；deck = 也可以改为从牌库抽 */
  | { k: 'display'; p: number; n: number; any: boolean; deck: boolean; reason: string; filter?: 'sponsor' | 'small' }
  /** 支付等级数的钱打出 1 张赞助卡；token = 用掉霍加狓棚厩上的标记 */
  | { k: 'sponsorPay'; p: number; reason: string; token?: string }
  /** 掘地：弃掉展示区的牌并补充，或者弃 1 张手牌再抽 1 张 */
  | { k: 'dig'; p: number; left: number }
  // —— 自动结算的
  | { k: 'fx'; p: number; fx: Fx }
  /** 倍增：同一个行动再执行一次 */
  | { k: 'again'; p: number; action: ActionId; str: number; up: boolean }
  /** 行动结束：owner 的这张行动卡回到 1 号位，然后结算 after */
  | { k: 'finishAction'; p: number; action: ActionId; owner: number; after: Fx[] }
  | { k: 'animalsEnd'; p: number; rep: number; take228: boolean }
  | { k: 'endTurn'; p: number }
  | { k: 'afterTurn'; p: number }
  | { k: 'breakFinish'; p: number }
  | { k: 'begin' };

export type Move =
  | { t: 'action'; action: ActionId; x: number; mult?: boolean }
  | { t: 'xaction'; action: ActionId }
  | { t: 'build'; type: string; cells: number[] }
  /** 打出动物：from = -1 表示手牌，否则为展示区位置 */
  | { t: 'animal'; card: string; from: number; building: number }
  /** 卡牌行动抽牌：display 为从展示区拿的位置（升级后），其余从牌库抽 */
  | { t: 'draw'; display: number[] }
  | { t: 'snap'; slot: number }
  | { t: 'assoc'; task: 'rep' }
  | { t: 'assoc'; task: 'partner'; continent: Continent }
  | { t: 'assoc'; task: 'university'; uni: string }
  | {
      t: 'assoc';
      task: 'project';
      project: string;
      level: number;
      /** 从手牌打出 / 从展示区打出（升级的协会行动，展示区位置） */
      fromHand: boolean;
      display?: number;
      /** 放归的动物 */
      release?: { uid: number; card: string };
      /** 用赞助卡上的标记当作任意图标（繁育合作 / 育种计划） */
      wild?: string[];
    }
  | { t: 'donate' }
  | { t: 'sponsor'; card: string; from: number; cells?: number[] }
  | { t: 'sponsorMoney' }
  | { t: 'choose'; i: number }
  | { t: 'cards'; cards: string[] }
  /** 从展示区拿牌；slot = -1 表示从牌库抽 */
  | { t: 'take'; slot: number }
  /** 商港：弃 1 张手牌换 3 元（自己回合内任何时候，每回合一次） */
  | { t: 'harbor'; card: string }
  | { t: 'done' };

export interface GameOptions {
  players: { name: string; ai: AiLevel | null; map: string }[];
  seed: number;
  /** 单人挑战的起始吸引力（20 入门 … 0 最难） */
  soloAppeal?: number;
}

export interface SoloState {
  /** 当前第几轮（0–5），每轮回合数 7/6/5/4/3/2 */
  round: number;
  /** 本轮剩余回合 */
  left: number;
}

export interface GameState {
  v: number;
  seed: number;
  rng: number;
  solo: SoloState | null;
  players: PlayerState[];
  deck: string[];
  discard: string[];
  display: string[];
  projects: BoardProject[];
  /** 没有用到的基础项目（霸主、统治能力可以拿走） */
  baseUnused: string[];
  /** 协会版图上每项任务的工人（玩家编号） */
  tasks: Record<TaskId, number[]>;
  donationStep: number;
  /** 保护点数 5 / 8 旁边的奖励板块 */
  tiles: { id: string; at: number; by: number | null }[];
  /** 是否已有玩家达到保护点数 10 */
  cp10: boolean;
  scoringPile: string[];
  breakPos: number;
  breakMax: number;
  breaks: number;
  current: number;
  /** 起始玩家 */
  first: number;
  turn: number;
  endBy: number | null;
  /** 触发终局后还能再进行 1 个回合的玩家 */
  finalLeft: number[];
  over: boolean;
  stack: Frame[];
  log: LogEntry[];
  /** 隐藏信息被揭示的次数（撤销只能回到最近一次揭示之后） */
  reveal: number;
  nextUid: number;
}
