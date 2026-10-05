import { Rng, hashSeed } from '../core/rng';
import { bumpUid, nextUid, remove } from '../core/util';
import { canUpgrade, cardDef, makeCard, upgradeCard } from './cards';
import { CHARACTERS } from './characters';
import { Combat } from './combat';
import type { EventState, EventView } from './events';
import { generateMap, nodeAt } from './map';
import { ANCIENTS, CARDS, ENCHANTS, ENCOUNTERS, EVENTS, POTIONS, RELICS } from './registry';
import type {
  Card,
  CharId,
  EncounterDef,
  MapData,
  MapNode,
  PotionRarity,
  Rarity,
  RelicInst,
  RelicTier,
  RoomKind,
} from './types';

export const SAVE_VERSION = 3;
export const MAX_ACT = 3;

// ---------------------------------------------------------------------------
// 奖励 / 商店 / 界面状态
// ---------------------------------------------------------------------------

export type Reward =
  | { type: 'gold'; n: number; taken?: boolean }
  | { type: 'card'; cards: Card[]; taken?: boolean }
  | { type: 'relic'; id: string; taken?: boolean }
  | { type: 'potion'; id: string; taken?: boolean };

export interface ShopItem {
  kind: 'card' | 'relic' | 'potion';
  card?: Card;
  id?: string;
  price: number;
  sold: boolean;
  sale?: boolean;
}

export interface ShopState {
  items: ShopItem[];
  removeUsed: boolean;
}

export type CombatKind = 'monster' | 'elite' | 'boss' | 'event';

export type Screen =
  | { s: 'ancient'; id: string; options: string[]; picked?: number }
  | { s: 'map' }
  | {
      s: 'combat';
      enc: string;
      enemies: string[];
      kind: CombatKind;
      extra?: { relic?: string; gold?: number; noCards?: boolean };
    }
  | { s: 'reward'; rewards: Reward[]; after: 'map' | 'boss' | 'event' }
  | { s: 'shop'; shop: ShopState }
  | { s: 'rest'; done: boolean; note?: string }
  | { s: 'event'; ev: EventState }
  | { s: 'treasure'; relic: string; gold: number; opened: boolean; size: 'small' | 'medium' | 'large' }
  | { s: 'bossRelic'; choices: string[] }
  | { s: 'gameover'; win: boolean };

export interface Selection {
  title: string;
  cards: Card[];
  min: number;
  max: number;
  canCancel: boolean;
  /** 预览升级效果 */
  preview?: 'upgrade';
  onDone: (sel: Card[]) => void;
  onCancel?: () => void;
}

export interface RunStats {
  kills: number;
  elites: number;
  bosses: number;
  damageTaken: number;
  goldEarned: number;
  cardsPlayed: number;
  floorsClimbed: number;
  startTime: number;
}

const PERSIST_KEYS = [
  'v',
  'seed',
  'char',
  'ascension',
  'hp',
  'maxHp',
  'gold',
  'deck',
  'relics',
  'potions',
  'act',
  'floor',
  'map',
  'pos',
  'rngState',
  'rareOffset',
  'potionChance',
  'removeCount',
  'seenEvents',
  'encHistory',
  'eliteHistory',
  'boss',
  'stats',
  'screen',
  'unknownOdds',
  'fights',
  'flags',
  'path',
  'zone',
] as const;

export class Run {
  v = SAVE_VERSION;
  seed: number;
  char: CharId;
  ascension: number;
  hp: number;
  maxHp: number;
  gold: number;
  deck: Card[] = [];
  relics: RelicInst[] = [];
  potions: (string | null)[] = [null, null, null];
  act = 1;
  floor = 0;
  map: MapData = { rows: [], width: 7, height: 15 };
  /** 当前所在节点；row = 15 表示 Boss 房 */
  pos: { row: number; col: number } | null = null;
  rngState: Record<string, number> = {};
  rareOffset = -5;
  potionChance = 40;
  removeCount = 0;
  seenEvents: string[] = [];
  encHistory: string[] = [];
  eliteHistory: string[] = [];
  boss = '';
  stats: RunStats;
  screen: Screen = { s: 'map' };
  unknownOdds = { monster: 10, shop: 3, treasure: 2 };
  /** 本幕已进行的普通战斗数 */
  fights = 0;
  /** 本幕走过的节点 [行, 列] */
  path: [number, number][] = [];
  /** 当前区域 */
  zone = 'overgrowth';
  flags: Record<string, number> = {};

  // ---- 非持久化 ----
  combat: Combat | null = null;
  selection: Selection | null = null;
  toasts: { id: number; text: string }[] = [];
  private rngs: Record<string, Rng> = {};

  constructor(char: CharId, seed: number, ascension = 0) {
    const cd = CHARACTERS[char];
    this.seed = seed >>> 0;
    this.char = char;
    this.ascension = ascension;
    this.maxHp = cd.hp;
    this.hp = cd.hp;
    this.gold = cd.gold;
    this.stats = {
      kills: 0,
      elites: 0,
      bosses: 0,
      damageTaken: 0,
      goldEarned: 0,
      cardsPlayed: 0,
      floorsClimbed: 0,
      startTime: Date.now(),
    };
  }

  /** 开始一局新游戏 */
  static create(char: CharId, seed: number, ascension = 0): Run {
    const run = new Run(char, seed, ascension);
    const cd = CHARACTERS[char];
    if (ascension >= 6) run.hp = Math.round(run.maxHp * 0.9);
    for (const id of cd.deck) run.deck.push(makeCard(id));
    if (ascension >= 7) run.deck.push(makeCard('ascenders_bane'));
    run.obtainRelic(cd.relic, true);
    run.startAct(1);
    return run;
  }

  get charName(): string {
    return CHARACTERS[this.char].name;
  }

  // =========================================================================
  // 随机数
  // =========================================================================

  rng(name: string): Rng {
    let r = this.rngs[name];
    if (!r) {
      r = new Rng(this.rngState[name] ?? hashSeed(this.seed, name));
      this.rngs[name] = r;
    }
    return r;
  }

  private syncRng() {
    for (const [k, r] of Object.entries(this.rngs)) this.rngState[k] = r.s;
  }

  // =========================================================================
  // 存档
  // =========================================================================

  toJSON(): Record<string, unknown> {
    this.syncRng();
    const o: Record<string, unknown> = {};
    for (const k of PERSIST_KEYS) o[k] = (this as unknown as Record<string, unknown>)[k];
    return JSON.parse(JSON.stringify(o));
  }

  static fromJSON(o: Record<string, unknown>): Run {
    if (o.v !== SAVE_VERSION) throw new Error('存档版本不兼容');
    const run = new Run(o.char as CharId, o.seed as number, (o.ascension as number) ?? 0);
    for (const k of PERSIST_KEYS) {
      if (o[k] !== undefined) (run as unknown as Record<string, unknown>)[k] = o[k];
    }
    let maxUid = 0;
    const scan = (c: Card) => (maxUid = Math.max(maxUid, c.uid));
    run.deck.forEach(scan);
    const sc = run.screen;
    if (sc.s === 'reward') sc.rewards.forEach((r) => r.type === 'card' && r.cards.forEach(scan));
    if (sc.s === 'shop') sc.shop.items.forEach((i) => i.card && scan(i.card));
    bumpUid(maxUid + 1000);
    if (run.screen.s === 'combat') run.beginCombat();
    return run;
  }

  // =========================================================================
  // 基础查询
  // =========================================================================

  hasRelic(id: string): boolean {
    return this.relics.some((r) => r.id === id);
  }

  relic(id: string): RelicInst | undefined {
    return this.relics.find((r) => r.id === id);
  }

  energyBonus(): number {
    return this.relics.reduce((s, r) => s + (RELICS[r.id]?.energy ?? 0), 0);
  }

  potionPotency(): number {
    return this.hasRelic('sacred_bark') ? 2 : 1;
  }

  enemyHpMult(elite: boolean, boss: boolean): number {
    let m = 1;
    if (this.ascension >= 2 && !elite && !boss) m += 0.1;
    if (this.ascension >= 3 && elite) m += 0.1;
    if (this.ascension >= 4 && boss) m += 0.1;
    return m;
  }

  /** 敌人攻击伤害倍率（进阶 8） */
  enemyDmgMult(): number {
    return this.ascension >= 8 ? 1.1 : 1;
  }

  toast(text: string) {
    this.toasts.push({ id: nextUid(), text });
    if (this.toasts.length > 5) this.toasts.shift();
  }

  // =========================================================================
  // 牌组 / 遗物 / 药水 / 资源
  // =========================================================================

  addCard(c: Card | string, silent = false): Card | null {
    const card = typeof c === 'string' ? makeCard(c) : c;
    const def = cardDef(card);
    if (def.type === 'curse') {
      const om = this.relic('omamori');
      if (om && om.counter > 0) {
        om.counter--;
        if (!silent) this.toast(`御守抵挡了诅咒「${def.name}」`);
        return null;
      }
      if (this.hasRelic('darkstone_periapt')) this.gainMaxHp(6);
    }
    if (!card.up) {
      if (def.type === 'attack' && this.hasRelic('molten_egg')) upgradeCard(card);
      if (def.type === 'skill' && this.hasRelic('toxic_egg')) upgradeCard(card);
      if (def.type === 'power' && this.hasRelic('frozen_egg')) upgradeCard(card);
    }
    this.deck.push(card);
    for (const r of this.relics) RELICS[r.id]?.onCardAdded?.(this, r, card);
    return card;
  }

  removeCard(c: Card) {
    if (remove(this.deck, c)) cardDef(c).onRemove?.(this);
  }

  obtainRelic(id: string, silent = false) {
    const def = RELICS[id];
    if (!def) throw new Error(`未知遗物: ${id}`);
    if (this.hasRelic(id) && id !== 'circlet') return;
    if (id === 'circlet' && this.hasRelic('circlet')) {
      this.relic('circlet')!.counter++;
      return;
    }
    const r: RelicInst = { id, counter: def.counter ? 0 : -1 };
    if (id === 'circlet') r.counter = 1;
    this.relics.push(r);
    def.onPickup?.(this, r);
    if (!silent) this.toast(`获得遗物「${def.name}」`);
  }

  loseRelic(id: string) {
    this.relics = this.relics.filter((r) => r.id !== id);
  }

  obtainPotion(id: string): boolean {
    if (this.hasRelic('sozu')) return false;
    const i = this.potions.indexOf(null);
    if (i < 0) return false;
    this.potions[i] = id;
    return true;
  }

  get potionSlotsFree(): number {
    return this.potions.filter((p) => p === null).length;
  }

  discardPotion(slot: number) {
    this.potions[slot] = null;
  }

  /** 战斗外使用药水 */
  usePotionOutside(slot: number) {
    const id = this.potions[slot];
    if (!id) return;
    const def = POTIONS[id];
    if (!def.outOfCombat) return;
    this.potions[slot] = null;
    def.use({ run: this, g: null, t: null, potency: this.potionPotency() });
    for (const r of this.relics) RELICS[r.id]?.onPotionUsed?.(this, r, null);
  }

  gainGold(n: number) {
    if (n <= 0) return;
    if (this.hasRelic('ectoplasm')) return;
    this.gold += n;
    this.stats.goldEarned += n;
    if (this.hasRelic('bloody_idol')) this.heal(5);
  }

  loseGold(n: number) {
    this.gold = Math.max(0, this.gold - n);
  }

  heal(n: number) {
    if (n <= 0 || this.hasRelic('mark_of_bloom')) return;
    this.hp = Math.min(this.maxHp, this.hp + Math.floor(n));
  }

  /** 战斗外受到伤害 */
  damage(n: number) {
    this.hp = Math.max(0, this.hp - n);
    this.stats.damageTaken += n;
    if (this.hp <= 0) {
      const lt = this.relic('lizard_tail');
      if (lt && !lt.used) {
        lt.used = true;
        this.hp = Math.floor(this.maxHp / 2);
        this.toast('蜥蜴尾巴让你重获新生');
      } else {
        this.screen = { s: 'gameover', win: false };
      }
    }
  }

  gainMaxHp(n: number) {
    this.maxHp += n;
    this.hp += n;
  }

  loseMaxHp(n: number) {
    this.maxHp = Math.max(1, this.maxHp - n);
    this.hp = Math.min(this.hp, this.maxHp);
  }

  get dead(): boolean {
    return this.screen.s === 'gameover' && !this.screen.win;
  }

  upgradeRandom(n: number, filter: (c: Card) => boolean = () => true): Card[] {
    const cands = this.deck.filter((c) => canUpgrade(c) && filter(c));
    const picked = this.rng('misc').sample(cands, n);
    picked.forEach(upgradeCard);
    return picked;
  }

  /** 变化：替换为同颜色的随机牌 */
  transformCard(c: Card, upgrade = false): Card {
    const def = cardDef(c);
    const color = def.color === 'curse' || def.color === 'status' ? this.char : def.color;
    const ids = Object.values(CARDS)
      .filter(
        (d) =>
          d.color === color &&
          !d.noPool &&
          d.id !== c.id &&
          ['common', 'uncommon', 'rare'].includes(d.rarity),
      )
      .map((d) => d.id);
    const id = this.rng('misc').pick(ids);
    this.removeCard(c);
    const nc = makeCard(id, upgrade);
    this.addCard(nc, true);
    return nc;
  }

  enchant(c: Card, id: string, n: number) {
    if (!ENCHANTS[id]) throw new Error(`未知附魔: ${id}`);
    c.ench = { id, n };
  }

  // =========================================================================
  // 随机生成：卡牌 / 遗物 / 药水
  // =========================================================================

  rollRarity(kind: 'normal' | 'elite' | 'shop'): Rarity {
    const rng = this.rng('card');
    const base = kind === 'elite' ? 10 : kind === 'shop' ? 9 : 3;
    const unc = kind === 'elite' ? 40 : 37;
    const rare = Math.max(0, base + this.rareOffset);
    const r = rng.int(0, 99);
    if (r < rare) {
      if (kind !== 'shop') this.rareOffset = -5;
      return 'rare';
    }
    if (r < rare + unc) return 'uncommon';
    if (kind !== 'shop') this.rareOffset = Math.min(40, this.rareOffset + 1);
    return 'common';
  }

  cardPool(rarity: Rarity, color: string = this.char, type?: string): string[] {
    return Object.values(CARDS)
      .filter((d) => d.color === color && d.rarity === rarity && !d.noPool && (!type || d.type === type))
      .map((d) => d.id);
  }

  randomCardId(rarity: Rarity, color: string = this.char, type?: string, exclude: string[] = []): string {
    const rng = this.rng('card');
    let pool = this.cardPool(rarity, color, type).filter((id) => !exclude.includes(id));
    if (!pool.length) pool = this.cardPool('common', color, type).filter((id) => !exclude.includes(id));
    if (!pool.length) pool = this.cardPool(rarity, color);
    if (!pool.length) pool = this.cardPool('common', color);
    return rng.pick(pool);
  }

  /** 生成卡牌奖励 */
  cardReward(kind: 'normal' | 'elite' | 'boss'): Card[] {
    let n = 3;
    if (this.hasRelic('question_card')) n++;
    if (this.hasRelic('busted_crown')) n -= 2;
    n = Math.max(1, n);
    const out: Card[] = [];
    const rng = this.rng('card');
    for (let i = 0; i < n; i++) {
      const rarity: Rarity = kind === 'boss' ? 'rare' : this.rollRarity(kind === 'elite' ? 'elite' : 'normal');
      const id = this.randomCardId(rarity, this.char, undefined, out.map((c) => c.id));
      const c = makeCard(id);
      const upChance = this.act === 2 ? 0.25 : this.act >= 3 ? 0.5 : 0;
      if (rarity !== 'rare' && rng.chance(this.ascension >= 9 ? upChance / 2 : upChance)) upgradeCard(c);
      out.push(c);
    }
    return out;
  }

  relicPool(tier: RelicTier): string[] {
    return Object.values(RELICS)
      .filter((d) => d.tier === tier && (!d.char || d.char === this.char) && !this.hasRelic(d.id))
      .map((d) => d.id);
  }

  randomRelicId(tier?: RelicTier): string {
    const rng = this.rng('relic');
    const t: RelicTier =
      tier ?? rng.weighted<RelicTier>([
        ['common', 50],
        ['uncommon', 33],
        ['rare', 17],
      ]);
    const order: RelicTier[] = t === 'boss' ? ['boss'] : t === 'shop' ? ['shop', 'common', 'uncommon'] : [t, 'uncommon', 'common', 'rare'];
    for (const tt of order) {
      const pool = this.relicPool(tt);
      if (pool.length) return rng.pick(pool);
    }
    return 'circlet';
  }

  randomPotionId(rarity?: PotionRarity): string {
    const rng = this.rng('potion');
    const r: PotionRarity =
      rarity ??
      rng.weighted<PotionRarity>([
        ['common', 65],
        ['uncommon', 25],
        ['rare', 10],
      ]);
    const pool = Object.values(POTIONS)
      .filter((p) => p.rarity === r && (!p.char || p.char === this.char))
      .map((p) => p.id);
    return rng.pick(pool);
  }

  // =========================================================================
  // 幕与地图
  // =========================================================================

  startAct(act: number) {
    this.act = act;
    this.pos = null;
    this.fights = 0;
    this.path = [];
    this.zone = act === 1 ? this.rng('map').pick(['overgrowth', 'underdocks']) : act === 2 ? 'hive' : 'glory';
    this.map = generateMap(this.rng(`map${act}`), act, this.ascension);
    const bosses = Object.values(ENCOUNTERS).filter((e) => this.encInZone(e) && e.kind === 'boss');
    this.boss = this.rng('enc').pick(bosses).id;
    // 先古之民
    const ancients = Object.values(ANCIENTS).filter((a) => a.acts.includes(act));
    const anc = this.rng('event').pick(ancients);
    const pool = anc.blessings.filter((b) => !b.cond || b.cond(this));
    const goods = pool.filter((b) => b.tone !== 'trade');
    const trades = pool.filter((b) => b.tone === 'trade');
    const rng = this.rng('event');
    const options = [...rng.sample(goods, 2), ...rng.sample(trades.length ? trades : goods, 1)].map((b) => b.id);
    this.screen = { s: 'ancient', id: anc.id, options: [...new Set(options)] };
  }

  chooseBlessing(i: number) {
    const sc = this.screen;
    if (sc.s !== 'ancient' || sc.picked !== undefined) return;
    const anc = ANCIENTS[sc.id];
    const b = anc.blessings.find((x) => x.id === sc.options[i]);
    if (!b) return;
    sc.picked = i;
    b.apply(this);
  }

  leaveAncient() {
    if (this.screen.s === 'ancient') this.screen = { s: 'map' };
  }

  /** 当前可前往的节点 */
  reachable(): MapNode[] {
    if (this.screen.s !== 'map') return [];
    if (!this.pos) return this.map.rows[0].filter((n): n is MapNode => !!n);
    if (this.pos.row >= 14) return [];
    const cur = nodeAt(this.map, this.pos.row, this.pos.col);
    if (!cur) return [];
    return cur.next.map((c) => nodeAt(this.map, this.pos!.row + 1, c)).filter((n): n is MapNode => !!n);
  }

  get bossReachable(): boolean {
    return this.screen.s === 'map' && !!this.pos && this.pos.row === 14;
  }

  /** 进入地图节点 */
  enterNode(row: number, col: number) {
    if (this.screen.s !== 'map') return;
    const node = this.reachable().find((n) => n.row === row && n.col === col);
    if (!node) return;
    this.pos = { row, col };
    this.path.push([row, col]);
    this.floor++;
    this.stats.floorsClimbed++;
    const mb = this.relic('maw_bank');
    if (mb && !mb.used) this.gainGold(12);
    for (const r of this.relics) RELICS[r.id]?.onEnterRoom?.(this, r, node.kind);
    this.enterRoom(node.kind);
  }

  enterBoss() {
    if (!this.bossReachable) return;
    this.pos = { row: 15, col: 3 };
    this.floor++;
    this.stats.floorsClimbed++;
    for (const r of this.relics) RELICS[r.id]?.onEnterRoom?.(this, r, 'boss');
    const enc = ENCOUNTERS[this.boss];
    this.startCombat(enc, 'boss');
  }

  private enterRoom(kind: RoomKind) {
    switch (kind) {
      case 'monster':
        return this.startCombat(this.pickEncounter(this.fights < 3 ? 'weak' : 'strong'), 'monster');
      case 'elite':
        return this.startCombat(this.pickEncounter('elite'), 'elite');
      case 'rest':
        this.screen = { s: 'rest', done: false };
        return;
      case 'shop':
        return this.openShop();
      case 'treasure':
        return this.openTreasureRoom();
      case 'event':
        return this.enterUnknown();
      default:
        this.screen = { s: 'map' };
    }
  }

  private enterUnknown() {
    const rng = this.rng('event');
    const o = this.unknownOdds;
    const r = rng.int(0, 99);
    const juzu = this.hasRelic('juzu_bracelet');
    if (r < o.monster && !juzu) {
      o.monster = 10;
      this.startCombat(this.pickEncounter(this.fights < 3 ? 'weak' : 'strong'), 'monster');
      return;
    }
    o.monster += 10;
    if (r >= 100 - o.shop) {
      o.shop = 3;
      this.openShop();
      return;
    }
    o.shop += 3;
    if (r >= 100 - o.shop - o.treasure && r < 100 - o.shop) {
      o.treasure = 2;
      this.openTreasureRoom();
      return;
    }
    o.treasure += 2;
    this.startEvent();
  }

  /** 遭遇是否属于当前幕与区域 */
  encInZone(e: EncounterDef): boolean {
    if (e.act !== this.act) return false;
    const zone = e.zone ?? (e.act === 1 ? 'overgrowth' : undefined);
    return !zone || zone === this.zone;
  }

  pickEncounter(kind: 'weak' | 'strong' | 'elite'): EncounterDef {
    const rng = this.rng('enc');
    let pool = Object.values(ENCOUNTERS).filter((e) => this.encInZone(e) && e.kind === kind);
    const hist = kind === 'elite' ? this.eliteHistory : this.encHistory;
    const fresh = pool.filter((e) => !hist.slice(-2).includes(e.id));
    if (fresh.length) pool = fresh;
    const enc = rng.weighted(pool.map((e) => [e, e.weight ?? 1] as const));
    hist.push(enc.id);
    return enc;
  }

  // =========================================================================
  // 战斗
  // =========================================================================

  startCombat(enc: EncounterDef, kind: CombatKind, extra?: { relic?: string; gold?: number; noCards?: boolean }) {
    const enemies = typeof enc.enemies === 'function' ? enc.enemies(this.rng('enc')) : [...enc.enemies];
    this.screen = { s: 'combat', enc: enc.id, enemies, kind, extra };
    if (kind === 'monster') this.fights++;
    this.beginCombat();
  }

  /** 事件中触发的战斗 */
  startEventCombat(enemies: string[], extra?: { relic?: string; gold?: number; noCards?: boolean; elite?: boolean }) {
    this.screen = { s: 'combat', enc: 'event', enemies, kind: extra?.elite ? 'elite' : 'event', extra };
    this.beginCombat();
  }

  /** 根据当前 screen 创建战斗实例（读档时也会调用） */
  beginCombat() {
    const sc = this.screen;
    if (sc.s !== 'combat') return;
    const g = new Combat(this, sc.enemies, {
      elite: sc.kind === 'elite',
      boss: sc.kind === 'boss',
      seedKey: `${this.act}-${this.floor}-${sc.enc}`,
    });
    this.combat = g;
    g.start();
  }

  /** 战斗结束后由界面调用 */
  finishCombat() {
    const g = this.combat;
    const sc = this.screen;
    if (!g || !g.result || sc.s !== 'combat') return;
    this.combat = null;
    this.hp = g.player.hp;
    this.maxHp = g.player.maxHp;
    if (g.result === 'lose') {
      this.screen = { s: 'gameover', win: false };
      return;
    }
    if (g.result === 'escape') {
      this.screen = { s: 'map' };
      return;
    }
    const rewards: Reward[] = [];
    const rng = this.rng('misc');
    const kind = sc.kind;
    let gold = 0;
    if (kind === 'monster' || kind === 'event') gold = rng.int(10, 20);
    if (kind === 'elite') gold = rng.int(25, 35);
    if (kind === 'boss') gold = rng.int(95, 105);
    gold += g.bonusGold;
    if (sc.extra?.gold) gold += sc.extra.gold;
    if (this.hasRelic('golden_idol')) gold = Math.round(gold * 1.25);
    if (this.hasRelic('nonupeipe_purse')) gold *= 2;
    if (gold > 0 && !this.hasRelic('ectoplasm')) rewards.push({ type: 'gold', n: gold });
    if (kind === 'elite') {
      this.stats.elites++;
      rewards.push({ type: 'relic', id: this.randomRelicId() });
      if (this.hasRelic('black_star')) rewards.push({ type: 'relic', id: this.randomRelicId() });
    }
    if (sc.extra?.relic) rewards.push({ type: 'relic', id: sc.extra.relic });
    // 药水
    const potionRoll = this.rng('potion').int(0, 99);
    const chance = this.hasRelic('white_beast_statue') ? 100 : this.potionChance;
    if (kind !== 'boss' && potionRoll < chance) {
      rewards.push({ type: 'potion', id: this.randomPotionId() });
      this.potionChance = Math.max(0, this.potionChance - 10);
    } else if (kind !== 'boss') {
      this.potionChance = Math.min(100, this.potionChance + 10);
    }
    if (!sc.extra?.noCards) {
      rewards.push({ type: 'card', cards: this.cardReward(kind === 'boss' ? 'boss' : kind === 'elite' ? 'elite' : 'normal') });
      if (this.hasRelic('prayer_wheel') && kind === 'monster') rewards.push({ type: 'card', cards: this.cardReward('normal') });
    }
    if (kind === 'boss') this.stats.bosses++;
    this.screen = { s: 'reward', rewards, after: kind === 'boss' ? 'boss' : 'map' };
  }

  // =========================================================================
  // 奖励
  // =========================================================================

  takeReward(i: number, cardIndex = -1): boolean {
    const sc = this.screen;
    if (sc.s !== 'reward') return false;
    const r = sc.rewards[i];
    if (!r || r.taken) return false;
    switch (r.type) {
      case 'gold':
        this.gainGold(r.n);
        r.taken = true;
        break;
      case 'relic':
        this.obtainRelic(r.id);
        r.taken = true;
        break;
      case 'potion':
        if (!this.obtainPotion(r.id)) {
          this.toast('药水栏已满');
          return false;
        }
        r.taken = true;
        break;
      case 'card':
        if (cardIndex < 0) {
          // 跳过：歌唱之碗
          if (this.hasRelic('singing_bowl')) this.gainMaxHp(2);
          r.taken = true;
        } else {
          const c = r.cards[cardIndex];
          if (!c) return false;
          this.addCard(c);
          r.taken = true;
        }
        break;
    }
    return true;
  }

  leaveRewards() {
    const sc = this.screen;
    if (sc.s !== 'reward') return;
    if (sc.after === 'boss') {
      if (this.act >= MAX_ACT) {
        this.screen = { s: 'gameover', win: true };
        return;
      }
      const choices: string[] = [];
      for (let i = 0; i < 3; i++) {
        const pool = this.relicPool('boss').filter((id) => !choices.includes(id));
        if (pool.length) choices.push(this.rng('relic').pick(pool));
      }
      this.screen = { s: 'bossRelic', choices };
      return;
    }
    this.screen = { s: 'map' };
  }

  pickBossRelic(i: number) {
    const sc = this.screen;
    if (sc.s !== 'bossRelic') return;
    if (i >= 0 && sc.choices[i]) this.obtainRelic(sc.choices[i]);
    this.nextAct();
  }

  nextAct() {
    // 幕间治疗
    const missing = this.maxHp - this.hp;
    this.heal(this.ascension >= 5 ? Math.round(missing * 0.75) : missing);
    this.startAct(this.act + 1);
  }

  // =========================================================================
  // 休息处
  // =========================================================================

  restHealAmount(): number {
    let n = Math.floor(this.maxHp * 0.3);
    if (this.hasRelic('regal_pillow')) n += 15;
    return n;
  }

  canRest(): true | string {
    if (this.hasRelic('coffee_dripper')) return '咖啡滤杯：无法在休息处休息';
    return true;
  }

  canSmith(): true | string {
    if (this.hasRelic('fusion_hammer')) return '融合之锤：无法在休息处锻造';
    if (!this.deck.some(canUpgrade)) return '没有可以升级的牌';
    return true;
  }

  restAction(action: 'rest' | 'smith' | 'lift' | 'toke' | 'dig') {
    const sc = this.screen;
    if (sc.s !== 'rest' || sc.done) return;
    const done = (note: string) => {
      sc.done = true;
      sc.note = note;
      for (const r of this.relics) RELICS[r.id]?.onRest?.(this, r);
    };
    switch (action) {
      case 'rest': {
        if (this.canRest() !== true) return;
        const n = this.restHealAmount();
        this.heal(n);
        done(`你休息了一会儿，回复了 ${n} 点生命。`);
        if (this.hasRelic('dream_catcher')) {
          this.screen = { s: 'reward', rewards: [{ type: 'card', cards: this.cardReward('normal') }], after: 'map' };
        }
        const ats = this.relic('ancient_tea_set');
        if (ats) ats.counter = 1;
        return;
      }
      case 'smith':
        if (this.canSmith() !== true) return;
        this.selection = {
          title: '选择一张牌升级',
          cards: this.deck.filter(canUpgrade),
          min: 1,
          max: 1,
          canCancel: true,
          preview: 'upgrade',
          onDone: (sel) => {
            if (!sel[0]) return;
            upgradeCard(sel[0]);
            done(`你锻造了「${cardDef(sel[0]).name}」。`);
          },
        };
        return;
      case 'lift': {
        const gi = this.relic('girya');
        if (!gi || gi.counter >= 3) return;
        gi.counter++;
        done('你举起了吉里亚，获得了力量。');
        return;
      }
      case 'toke':
        if (!this.hasRelic('peace_pipe')) return;
        this.selection = {
          title: '选择一张牌移除',
          cards: this.deck.filter((c) => cardDef(c).id !== 'ascenders_bane'),
          min: 1,
          max: 1,
          canCancel: true,
          onDone: (sel) => {
            if (!sel[0]) return;
            this.removeCard(sel[0]);
            done(`你移除了「${cardDef(sel[0]).name}」。`);
          },
        };
        return;
      case 'dig': {
        if (!this.hasRelic('shovel')) return;
        const id = this.randomRelicId();
        this.obtainRelic(id);
        done(`你挖出了「${RELICS[id].name}」！`);
        return;
      }
    }
  }

  leaveRoom() {
    if (['rest', 'shop', 'treasure', 'event'].includes(this.screen.s)) this.screen = { s: 'map' };
  }

  // =========================================================================
  // 商店
  // =========================================================================

  private price(base: number): number {
    let p = Math.round(base * this.rng('shop').int(90, 110) / 100);
    if (this.hasRelic('membership_card')) p = Math.round(p * 0.5);
    if (this.hasRelic('the_courier')) p = Math.round(p * 0.8);
    if (this.ascension >= 10) p = Math.round(p * 1.1);
    return p;
  }

  removeCost(): number {
    if (this.hasRelic('smiling_mask')) return 50;
    let p = 75 + 25 * this.removeCount;
    if (this.hasRelic('membership_card')) p = Math.round(p * 0.5);
    if (this.hasRelic('the_courier')) p = Math.round(p * 0.8);
    return p;
  }

  openShop() {
    const items: ShopItem[] = [];
    const cardPrice: Record<string, number> = { common: 50, uncommon: 75, rare: 150 };
    const types = ['attack', 'attack', 'skill', 'skill', 'power'];
    const used: string[] = [];
    for (const t of types) {
      const rarity = t === 'power' ? (this.rollRarity('shop') === 'rare' ? 'rare' : 'uncommon') : this.rollRarity('shop');
      const id = this.randomCardId(rarity, this.char, t, used);
      used.push(id);
      const c = makeCard(id);
      items.push({ kind: 'card', card: c, price: this.price(cardPrice[cardDef(c).rarity] ?? 75), sold: false });
    }
    const sale = this.rng('shop').int(0, 4);
    items[sale].sale = true;
    items[sale].price = Math.round(items[sale].price / 2);
    for (const r of ['uncommon', 'rare'] as const) {
      const id = this.randomCardId(r, 'colorless');
      const c = makeCard(id);
      items.push({ kind: 'card', card: c, price: this.price(r === 'rare' ? 180 : 90), sold: false });
    }
    const relicPrice: Record<string, number> = { common: 150, uncommon: 250, rare: 300, shop: 150 };
    const usedRelics: string[] = [];
    for (let i = 0; i < 3; i++) {
      let id = i === 2 ? this.randomRelicId('shop') : this.randomRelicId();
      let guard = 0;
      while (usedRelics.includes(id) && guard++ < 10) id = this.randomRelicId();
      if (usedRelics.includes(id)) continue;
      usedRelics.push(id);
      items.push({ kind: 'relic', id, price: this.price(relicPrice[RELICS[id].tier] ?? 200), sold: false });
    }
    const potionPrice: Record<string, number> = { common: 50, uncommon: 75, rare: 100 };
    for (let i = 0; i < 3; i++) {
      const id = this.randomPotionId();
      items.push({ kind: 'potion', id, price: this.price(potionPrice[POTIONS[id].rarity]), sold: false });
    }
    this.screen = { s: 'shop', shop: { items, removeUsed: false } };
    if (this.hasRelic('meal_ticket')) this.heal(15);
  }

  buy(i: number): boolean {
    const sc = this.screen;
    if (sc.s !== 'shop') return false;
    const it = sc.shop.items[i];
    if (!it || it.sold || this.gold < it.price) return false;
    if (it.kind === 'potion' && this.potionSlotsFree === 0) {
      this.toast('药水栏已满');
      return false;
    }
    this.gold -= it.price;
    it.sold = true;
    const mb = this.relic('maw_bank');
    if (mb) mb.used = true;
    if (it.kind === 'card' && it.card) this.addCard(it.card);
    if (it.kind === 'relic' && it.id) this.obtainRelic(it.id);
    if (it.kind === 'potion' && it.id) this.obtainPotion(it.id);
    return true;
  }

  buyRemoval() {
    const sc = this.screen;
    if (sc.s !== 'shop' || sc.shop.removeUsed) return;
    const cost = this.removeCost();
    if (this.gold < cost) return;
    this.selection = {
      title: `选择一张牌移除（${cost} 金币）`,
      cards: this.deck.filter((c) => c.id !== 'ascenders_bane'),
      min: 1,
      max: 1,
      canCancel: true,
      onDone: (sel) => {
        if (!sel[0]) return;
        this.gold -= cost;
        this.removeCount++;
        const mb = this.relic('maw_bank');
        if (mb) mb.used = true;
        sc.shop.removeUsed = true;
        this.removeCard(sel[0]);
      },
    };
  }

  // =========================================================================
  // 宝箱
  // =========================================================================

  openTreasureRoom() {
    const rng = this.rng('treasure');
    const size = rng.weighted<'small' | 'medium' | 'large'>([
      ['small', 50],
      ['medium', 33],
      ['large', 17],
    ]);
    const tierW: Record<string, [RelicTier, number][]> = {
      small: [
        ['common', 75],
        ['uncommon', 25],
      ],
      medium: [
        ['common', 35],
        ['uncommon', 50],
        ['rare', 15],
      ],
      large: [
        ['uncommon', 75],
        ['rare', 25],
      ],
    };
    const tier = rng.weighted(tierW[size]);
    const goldChance = { small: 0.5, medium: 0.35, large: 0.5 }[size];
    const gold = rng.chance(goldChance) ? { small: 25, medium: 50, large: 75 }[size] + rng.int(-5, 5) : 0;
    this.screen = { s: 'treasure', relic: this.randomRelicId(tier), gold, opened: false, size };
  }

  openChest() {
    const sc = this.screen;
    if (sc.s !== 'treasure' || sc.opened) return;
    sc.opened = true;
    if (sc.gold) this.gainGold(sc.gold);
    this.obtainRelic(sc.relic);
    if (this.hasRelic('cursed_key')) this.addCard(this.rng('misc').pick(curseIds()));
  }

  // =========================================================================
  // 事件
  // =========================================================================

  startEvent(id?: string) {
    const rng = this.rng('event');
    let evId = id;
    if (!evId) {
      const pool = Object.values(EVENTS).filter(
        (e) => e.acts.includes(this.act) && !this.seenEvents.includes(e.id) && (!e.cond || e.cond(this)),
      );
      if (!pool.length) {
        this.startCombat(this.pickEncounter('strong'), 'monster');
        return;
      }
      evId = rng.pick(pool).id;
    }
    this.seenEvents.push(evId);
    const ev: EventState = { id: evId, page: 'start', vars: {} };
    EVENTS[evId].init?.(this, ev);
    this.screen = { s: 'event', ev };
  }

  eventView(): EventView | null {
    const sc = this.screen;
    if (sc.s !== 'event') return null;
    return EVENTS[sc.ev.id].view(this, sc.ev);
  }

  /** 选择卡牌（界面以覆盖层显示） */
  selectCards(opts: Omit<Selection, 'canCancel'> & { canCancel?: boolean }) {
    if (!opts.cards.length) {
      opts.onDone([]);
      return;
    }
    this.selection = { canCancel: false, ...opts };
  }

  resolveSelection(sel: Card[] | null) {
    const s = this.selection;
    if (!s) return;
    this.selection = null;
    if (sel === null) {
      if (s.canCancel) s.onCancel?.();
      else return;
    } else s.onDone(sel);
  }

  /** 分数（游戏结束界面） */
  score(): number {
    const s = this.stats;
    return this.floor * 5 + s.elites * 10 + s.bosses * 50 + s.kills * 2 + Math.floor(s.goldEarned / 10) + this.ascension * 20;
  }
}

export function curseIds(): string[] {
  return Object.values(CARDS)
    .filter((d) => d.type === 'curse' && !d.noPool)
    .map((d) => d.id);
}
