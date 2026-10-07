// 方舟动物园的核心类型。游戏状态是纯 JSON（可直接存档、克隆），卡牌等静态内容只用 id 引用。

export type ActionId = 'animals' | 'build' | 'cards' | 'association' | 'sponsors';
export const ACTIONS: ActionId[] = ['animals', 'build', 'cards', 'association', 'sponsors'];

export type Continent = 'africa' | 'europe' | 'asia' | 'americas' | 'australia';
export const CONTINENTS: Continent[] = ['africa', 'europe', 'asia', 'americas', 'australia'];

export type Category = 'predator' | 'herbivore' | 'bird' | 'reptile' | 'primate' | 'bear' | 'petting';
export const CATEGORIES: Category[] = ['predator', 'herbivore', 'bird', 'reptile', 'primate', 'bear', 'petting'];

/** 卡牌上可以出现的图标：大洲、动物种类、研究 */
export type Icon = Continent | Category | 'science';

export type SpecialKind = 'petting' | 'reptile' | 'aviary';

/** 一次性收益 */
export interface Gain {
  money?: number;
  appeal?: number;
  cp?: number;
  rep?: number;
  x?: number;
  cards?: number;
  worker?: number;
  upgrade?: number;
}

export type Requirement =
  | { k: 'icon'; icon: Icon; n: number }
  | { k: 'rep'; n: number }
  | { k: 'upgrade'; action: ActionId }
  | { k: 'partner'; continent: Continent };

/** 动物能力（打出时触发一次） */
export type Ability =
  | { k: 'sprint'; n: number } // 冲刺：从牌库抽 n 张
  | { k: 'hunter'; n: number } // 狩猎：翻开 n 张，可保留 1 张动物卡
  | { k: 'perception'; n: number } // 洞察：抽 n 张，保留 2 张
  | { k: 'snap'; n: number } // 抢先：从展示区任意位置拿 n 张
  | { k: 'boost'; action: ActionId } // 助推：该行动卡移到 5 号位
  | { k: 'clever' } // 聪慧：任选一张行动卡移到 5 号位
  | { k: 'pack'; cat: Category } // 群居：园中每个该种类图标 +1 吸引力（含自身，最多 5）
  | { k: 'iconic'; cont: Continent } // 标志：园中每个该大洲图标 +1 吸引力（含自身，最多 5）
  | { k: 'pouch' } // 育儿袋：把 1 张手牌放到它下面，+2 吸引力
  | { k: 'sunbathe'; n: number } // 日光浴：最多出售 n 张手牌，每张 4 元
  | { k: 'venom'; n: number } // 毒液：吸引力高于你的对手各失去 n 元
  | { k: 'constrict' } // 绞杀：吸引力高于你的对手把 5 号位行动卡移到 1 号位
  | { k: 'hypnosis'; n: number } // 催眠：执行对手 1–n 号位的一张行动卡
  | { k: 'jump'; n: number } // 跳跃：休息标记前进 n 格，获得 n 元
  | { k: 'dig'; n: number } // 掘地：弃最多 n 张手牌，抽同样数量
  | { k: 'posture'; n: number } // 炫耀：免费建造 n 个凉亭
  | { k: 'resist' } // 坚韧：抽 2 张终局计分卡，保留 1 张
  | { k: 'assert' } // 霸主：免费建造爬行馆或大型鸟舍（无需升级）
  | { k: 'trade' } // 交换：用 1 张手牌换展示区（声望范围内）1 张牌
  | { k: 'scavenge'; n: number } // 拾荒：从弃牌堆随机翻 n 张，保留 1 张
  | { k: 'xtoken'; n: number } // 耐心：获得 n 个 X 标记
  | { k: 'money'; n: number }; // 获得 n 元

export interface CardBase {
  id: string;
  /** 图鉴编号 */
  num: number;
  name: string;
  emoji: string;
}

export interface AnimalCard extends CardBase {
  kind: 'animal';
  en: string;
  size: number;
  /** 可替代的特殊场馆及占用的容量 */
  special?: { kind: SpecialKind; units: number };
  cost: number;
  continents: Continent[];
  categories: Category[];
  water?: number;
  rock?: number;
  req?: Requirement[];
  appeal: number;
  cp?: number;
  rep?: number;
  ability?: Ability;
}

/** 动物筛选条件（用于赞助卡效果） */
export interface AnimalFilter {
  cat?: Category;
  cont?: Continent;
  minSize?: number;
  maxSize?: number;
}

/** 可计数的指标（赞助卡、终局计分卡、基础保护项目共用） */
export type Metric =
  | { m: 'icon'; icon: Icon }
  | { m: 'animals'; filter?: AnimalFilter }
  | { m: 'kiosks' }
  | { m: 'pavilions' }
  | { m: 'partners' }
  | { m: 'universities' }
  | { m: 'partnersUnis' }
  | { m: 'sponsors' }
  | { m: 'projects' }
  | { m: 'catKinds' }
  | { m: 'contKinds' }
  | { m: 'rep' }
  | { m: 'covered' }
  | { m: 'fullEnclosures' }
  | { m: 'waterAnimals' }
  | { m: 'rockAnimals' }
  | { m: 'specialAnimals' }
  | { m: 'upgrades' }
  | { m: 'money' };

export type SponsorEffect =
  | { k: 'onPlay'; filter: AnimalFilter; gain: Gain }
  | { k: 'onOtherPlay'; filter: AnimalFilter; gain: Gain }
  | { k: 'onBuild'; building: 'kiosk' | 'pavilion' | 'enclosure' | 'special'; gain: Gain }
  | { k: 'onProject'; gain: Gain }
  | { k: 'income'; money: number }
  | { k: 'incomePer'; metric: Metric; per: number; money: number; max?: number }
  | { k: 'discount'; filter: AnimalFilter; n: number }
  | { k: 'end'; metric: Metric; per: number; cp: number; max: number }
  | { k: 'handLimit'; n: number }
  | { k: 'range'; n: number };

export interface SponsorCard extends CardBase {
  kind: 'sponsor';
  level: number;
  icons: Icon[];
  req?: Requirement[];
  /** 打出时立即获得 */
  gain?: Gain;
  /** 打出时按指标获得（每 per 个获得 gain，最多 max 次） */
  gainPer?: { metric: Metric; per: number; gain: Gain; max: number };
  effects?: SponsorEffect[];
  /** 专属建筑：打出时必须放到自己的动物园里 */
  building?: { shape: [number, number][]; water?: boolean; rock?: boolean };
  text: string;
}

export type ProjectGoal =
  | { k: 'icon'; icon: Icon }
  | { k: 'metric'; metric: Metric; label: string }
  | { k: 'release'; filter?: AnimalFilter };

export interface ProjectCard extends CardBase {
  kind: 'project';
  goal: ProjectGoal;
  /** 由高到低的三档：需要数量 → 保护点数 */
  levels: { need: number; cp: number }[];
  /** 基础项目（开局摆在协会版图上，不进牌库） */
  base?: boolean;
  text: string;
}

export type Card = AnimalCard | SponsorCard | ProjectCard;

export interface ScoringCard {
  id: string;
  name: string;
  emoji: string;
  metric: Metric;
  /** 达到数量 → 保护点数（取满足的最高一档） */
  tiers: [number, number][];
  text: string;
}

// ---------------------------------------------------------------- 状态

export interface Building {
  uid: number;
  type: string;
  cells: number[];
  /** 放在其中的动物卡 */
  animals: string[];
  /** 育儿袋下面的卡 */
  pouch?: string[];
}

export type AiLevel = 'easy' | 'normal' | 'hard';

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
  hand: string[];
  scoring: string[];
  buildings: Building[];
  sponsors: string[];
  partners: Continent[];
  unis: string[];
  /** 已支持的保护项目 */
  projects: string[];
  /** 已获得的保护点数 / 声望奖励门槛 */
  cpBonuses: number[];
  repBonuses: number[];
  donations: number;
  /** 终局时计算 */
  final?: { cp: number; score: number; breakdown: { label: string; cp: number }[] };
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

/** 二选一 / 多选一时的选项 */
export type Opt =
  | { k: 'upgrade'; action: ActionId }
  | { k: 'worker' }
  | { k: 'tile'; id: string }
  | { k: 'gain'; gain: Gain }
  | { k: 'hypno'; target: number; action: ActionId }
  | { k: 'boost'; action: ActionId }
  | { k: 'none' };

export type PickPurpose = 'discard' | 'keep' | 'keepAnimal' | 'sell' | 'pouch' | 'dig' | 'setup' | 'scoring' | 'scoringKeep' | 'trade';

export type Frame =
  // —— 需要玩家决定的
  | { k: 'turn'; p: number }
  | { k: 'build'; p: number; str: number; up: boolean; budget: number; built: string[]; done: number }
  | { k: 'animals'; p: number; str: number; up: boolean; left: number; played: number }
  | { k: 'cards'; p: number; str: number; up: boolean }
  | { k: 'assoc'; p: number; str: number; up: boolean; budget: number; used: TaskId[]; donated: boolean }
  | { k: 'sponsors'; p: number; str: number; up: boolean; budget: number; played: number }
  | {
      k: 'pick';
      p: number;
      purpose: PickPurpose;
      /** 候选卡（不在手牌中的，比如翻开的牌）；为空表示从手牌中选 */
      cards: string[];
      min: number;
      max: number;
      /** 育儿袋等需要关联的建筑 */
      uid?: number;
    }
  | { k: 'choose'; p: number; reason: string; opts: Opt[] }
  | { k: 'place'; p: number; types: string[]; reason: string; count: number }
  | { k: 'display'; p: number; n: number; any: boolean; reason: string; swap?: string }
  // —— 自动结算的
  | { k: 'endTurn'; p: number }
  | { k: 'afterTurn'; p: number }
  | { k: 'hypnoEnd'; p: number; target: number; action: ActionId }
  | { k: 'finishAction'; p: number; action: ActionId }
  | { k: 'animalsEnd'; p: number; rep: number }
  | { k: 'breakFinish'; p: number }
  | { k: 'begin' };

export type Move =
  | { t: 'action'; action: ActionId; x: number }
  | { t: 'xaction'; action: ActionId }
  | { t: 'build'; type: string; cells: number[] }
  | { t: 'animal'; card: string; from: number; building: number }
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
      fromHand: boolean;
      /** 从展示区打出（升级的协会行动），展示区位置 */
      display?: number;
      release?: { uid: number; card: string };
    }
  | { t: 'donate' }
  | { t: 'sponsor'; card: string; from: number; cells?: number[] }
  | { t: 'sponsorMoney' }
  | { t: 'choose'; i: number }
  | { t: 'cards'; cards: string[] }
  | { t: 'take'; slot: number }
  | { t: 'done' };

export interface GameOptions {
  players: { name: string; ai: AiLevel | null; map: string }[];
  seed: number;
  /** 单人挑战：在限定的休息次数内达到 0 分以上 */
  solo?: boolean;
}

export interface GameState {
  v: number;
  seed: number;
  rng: number;
  solo: boolean;
  players: PlayerState[];
  deck: string[];
  discard: string[];
  display: string[];
  projects: BoardProject[];
  /** 协会版图上每项任务的工人（玩家编号） */
  tasks: Record<TaskId, number[]>;
  donationStep: number;
  /** 保护点数 5 / 8 旁边的共享奖励板块 */
  tiles: { id: string; at: number; by: number | null }[];
  /** 是否已有玩家达到保护点数 10（此时所有人弃掉 1 张终局计分卡） */
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
  finalTurns: number;
  over: boolean;
  stack: Frame[];
  log: LogEntry[];
  /** 隐藏信息被揭示的次数（撤销只能回到最近一次揭示之后） */
  reveal: number;
  nextUid: number;
}
