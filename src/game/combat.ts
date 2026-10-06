import { Rng, hashSeed } from '../core/rng';
import { nextUid, remove } from '../core/util';
import {
  baseCost,
  cardBlk,
  cardDef,
  cardDmg,
  combatCopy,
  displayCost,
  duplicateCard,
  hasTag,
  isEthereal,
  isExhaust,
  isInnate,
  isRetain,
  isX,
  makeCard,
  starCost,
  upgradeCard,
  uv,
} from './cards';
import { CARDS, ENCHANTS, ENEMIES, POTIONS, POWERS, RELICS } from './registry';
import type { Run } from './run';
import { ORBS, type Orb, type OrbId } from './orbs';
import type {
  Card,
  CardType,
  Companion,
  Creature,
  Enemy,
  EnemyDef,
  MoveDef,
  Player,
  PowerDef,
  RelicDef,
  RelicInst,
} from './types';
import { UNPLAYABLE } from './types';

export const HAND_LIMIT = 10;

/** Claude 的工具牌 */
export const TOOL_IDS = ['web_search', 'code_exec', 'text_edit', 'memory_tool'] as const;
/** 上下文窗口的初始大小 */
export const CONTEXT_WINDOW = 10;

export interface Pending {
  mode: 'hand' | 'grid';
  title: string;
  cards: Card[];
  min: number;
  max: number;
  resolve: (sel: Card[]) => void;
}

export type FxKind =
  | 'dmg'
  | 'hploss'
  | 'blocked'
  | 'block'
  | 'heal'
  | 'buff'
  | 'debuff'
  | 'negated'
  | 'text'
  | 'die'
  | 'lunge'
  | 'shuffle'
  | 'summon'
  | 'stars'
  | 'escape'
  | 'hurt'
  | 'compact';

export interface Fx {
  id: number;
  kind: FxKind;
  uid: number;
  n?: number;
  text?: string;
}

export type Phase = 'player' | 'busy' | 'enemy' | 'over';
type DmgKind = 'attack' | 'thorns' | 'hploss';

interface TurnStats {
  cards: number;
  attacks: number;
  skills: number;
  powers: number;
  discarded: number;
  drawn: number;
  hpLost: number;
  starsSpent: number;
}

const newTurnStats = (): TurnStats => ({
  cards: 0,
  attacks: 0,
  skills: 0,
  powers: 0,
  discarded: 0,
  drawn: 0,
  hpLost: 0,
  starsSpent: 0,
});

export interface CombatOpts {
  elite?: boolean;
  boss?: boolean;
  seedKey?: string | number;
}

let fxSeq = 1;

export class Combat {
  run: Run;
  player: Player;
  osty: Companion | null = null;
  enemies: Enemy[] = [];
  drawPile: Card[] = [];
  hand: Card[] = [];
  discardPile: Card[] = [];
  exhaustPile: Card[] = [];
  limbo: Card[] = [];
  energy = 0;
  maxEnergy = 3;
  stars = 0;
  /** 君王之刃累计铸造值 */
  forged = 0;
  /** 充能球（故障机器人） */
  orbs: Orb[] = [];
  orbSlots = 0;
  /** 上下文（Claude）：达到窗口上限时压缩为摘要 */
  context = 0;
  contextMax = CONTEXT_WINDOW;
  /** 本场战斗压缩的次数 */
  compacts = 0;
  turn = 0;
  phase: Phase = 'busy';
  result: null | 'win' | 'lose' | 'escape' = null;
  pending: Pending | null = null;
  queue: (() => void)[] = [];
  fx: Fx[] = [];
  rng: Rng;
  aiRng: Rng;
  elite: boolean;
  boss: boolean;
  /** 当前打出的 X 费数值 */
  x = 0;
  t: TurnStats = newTurnStats();
  /** 整场战斗计数 */
  total = { cards: 0, attacks: 0, hpLossTimes: 0, shuffles: 0, summons: 0, ostyDeaths: 0, lightning: 0, frost: 0, powers: 0, tools: 0 };
  firstTurnDrawBonus = 0;
  drawPerTurnBonus = 0;
  /** 战斗结束奖励的额外金币（偷窃被夺回等） */
  bonusGold = 0;
  /** 因卡牌效果（如狂宴）获得的额外奖励标记 */
  flags: Record<string, number> = {};
  /** 战斗内的文字备注（例如 OpenAI「记住」的那张牌） */
  notes: Record<string, string> = {};
  private processing = false;
  private enemySteps: (() => void)[] = [];
  /** 已经打出过的附魔首效 */
  private enchFirstPlayed = new Set<number>();
  log: string[] = [];

  constructor(run: Run, enemyIds: string[], opts: CombatOpts = {}) {
    this.run = run;
    this.elite = !!opts.elite;
    this.boss = !!opts.boss;
    const seed = hashSeed(run.seed, 'combat', opts.seedKey ?? run.floor);
    this.rng = new Rng(seed);
    this.aiRng = new Rng(hashSeed(seed, 'ai'));
    this.player = {
      uid: nextUid(),
      name: run.charName,
      hp: run.hp,
      maxHp: run.maxHp,
      block: 0,
      powers: {},
      justApplied: {},
      isPlayer: true,
      dead: false,
      char: run.char,
    };
    if (run.char === 'necrobinder') {
      this.osty = {
        uid: nextUid(),
        name: '奥斯提',
        hp: 0,
        maxHp: 0,
        block: 0,
        powers: {},
        justApplied: {},
        isPlayer: false,
        dead: false,
        alive: false,
      };
    }
    this.maxEnergy = 3 + run.energyBonus();
    if (run.char === 'defect') this.orbSlots = 3;
    for (const id of enemyIds) this.spawnEnemy(id);
  }

  // =========================================================================
  // 查询
  // =========================================================================

  get alive(): Enemy[] {
    return this.enemies.filter((e) => !e.dead && !e.escaped);
  }

  get over(): boolean {
    return this.result !== null;
  }

  pw(c: Creature | null | undefined, id: string): number {
    return c?.powers[id] ?? 0;
  }

  has(c: Creature | null | undefined, id: string): boolean {
    return !!c && c.powers[id] !== undefined;
  }

  relic(id: string): RelicInst | undefined {
    return this.run.relics.find((r) => r.id === id);
  }

  randomEnemy(): Enemy | null {
    const a = this.alive;
    return a.length ? this.rng.pick(a) : null;
  }

  isAttacking(e: Enemy): boolean {
    const m = this.moveOf(e);
    return !!m && m.intent.startsWith('attack');
  }

  moveOf(e: Enemy): MoveDef | null {
    if (!e.move) return null;
    return ENEMIES[e.defId].moves[e.move] ?? null;
  }

  enemyDef(e: Enemy): EnemyDef {
    return ENEMIES[e.defId];
  }

  allCards(): Card[] {
    return [...this.drawPile, ...this.hand, ...this.discardPile, ...this.limbo];
  }

  // =========================================================================
  // 特效事件
  // =========================================================================

  emit(kind: FxKind, uid: number, n?: number, text?: string) {
    this.fx.push({ id: fxSeq++, kind, uid, n, text });
    if (this.fx.length > 200) this.fx.splice(0, this.fx.length - 200);
  }

  takeFx(): Fx[] {
    const f = this.fx;
    this.fx = [];
    return f;
  }

  // =========================================================================
  // 生命周期
  // =========================================================================

  spawnEnemy(id: string, opts: { minion?: boolean; hp?: number; at?: number } = {}): Enemy {
    const def = ENEMIES[id];
    if (!def) throw new Error(`未知敌人: ${id}`);
    let hp = opts.hp ?? this.aiRng.int(def.hp[0], def.hp[1]);
    if (this.elite && this.run.hasRelic('preserved_insect') && opts.hp === undefined) hp = Math.ceil(hp * 0.75);
    hp = Math.round(hp * this.run.enemyHpMult(this.elite, this.boss));
    const e: Enemy = {
      uid: nextUid(),
      name: def.name,
      hp,
      maxHp: hp,
      block: 0,
      powers: {},
      justApplied: {},
      isPlayer: false,
      dead: false,
      defId: id,
      art: def.art,
      move: null,
      history: [],
      turns: 0,
      minion: !!opts.minion,
      escaped: false,
      mem: {},
      size: def.size ?? 1,
    };
    if (opts.at !== undefined) this.enemies.splice(opts.at, 0, e);
    else this.enemies.push(e);
    def.init?.(e, this);
    if (this.phase !== 'busy' || this.turn > 0) e.move = def.ai(e, this);
    return e;
  }

  /** 战斗开始 */
  start() {
    const cards = this.run.deck.map(combatCopy);
    this.rng.shuffle(cards);
    const innate = cards.filter(isInnate);
    const rest = cards.filter((c) => !isInnate(c));
    // 抽牌堆顶部为数组末尾
    this.drawPile = [...rest, ...innate];
    for (const e of this.enemies) e.move = this.enemyDef(e).ai(e, this);
    this.queue.push(() => {
      for (const r of this.run.relics) RELICS[r.id]?.onCombatStart?.(this, r);
      const extra = Math.max(0, innate.length - 5);
      this.firstTurnDrawBonus += extra;
    });
    this.process();
    this.startPlayerTurn();
  }

  startPlayerTurn() {
    this.turn++;
    this.phase = 'busy';
    this.t = newTurnStats();
    const p = this.player;
    this.queue.push(() => {
      if (this.has(p, 'barricade') || this.has(p, 'blur')) {
        // 保留格挡
      } else if (this.run.hasRelic('calipers')) {
        p.block = Math.max(0, p.block - 15);
      } else {
        p.block = 0;
      }
      if (this.osty) this.osty.block = 0;
      this.decayPowers(p, 'start');
      this.firePowers(p, 'onTurnStart');
      for (const r of this.run.relics) RELICS[r.id]?.onTurnStart?.(this, r);
      const keep = this.run.hasRelic('ice_cream') ? this.energy : 0;
      this.energy = keep + this.maxEnergy;
      for (const o of [...this.orbs]) if (ORBS[o.id].startOfTurn) ORBS[o.id].passive(this, o);
    });
    this.queue.push(() => {
      if (this.over) return;
      let n = 5 + this.drawPerTurnBonus + this.pw(p, 'draw_next') + this.pw(p, 'machine_learning');
      delete p.powers.draw_next;
      if (this.turn === 1) n += this.firstTurnDrawBonus;
      this.draw(n);
    });
    this.queue.push(() => {
      this.firePowers(p, 'onTurnStartPostDraw');
      for (const r of this.run.relics) RELICS[r.id]?.onTurnStartPostDraw?.(this, r);
      if (this.turn === 1) for (const r of this.run.relics) RELICS[r.id]?.onCombatStartPostDraw?.(this, r);
    });
    this.queue.push(() => {
      this.phase = 'player';
    });
    this.process();
  }

  /** 玩家点击结束回合 */
  endTurn() {
    if (this.phase !== 'player' || this.pending || this.over) return;
    this.phase = 'busy';
    const p = this.player;
    this.queue.push(() => {
      this.firePowers(p, 'onTurnEnd');
      for (const r of this.run.relics) RELICS[r.id]?.onTurnEnd?.(this, r);
      this.triggerPassives();
    });
    // 「计划妥当」：选择保留的牌
    this.queue.push(() => {
      const n = this.pw(p, 'well_laid_plans');
      if (n > 0) {
        const cands = this.hand.filter((c) => !isRetain(c) && !isEthereal(c));
        if (cands.length)
          this.chooseCards({ title: `选择至多 ${n} 张牌保留`, cards: cands, min: 0, max: n, mode: 'hand' }, (sel) => {
            for (const c of sel) c.retainOnce = true;
          });
      }
    });
    this.queue.push(() => {
      for (const c of [...this.hand]) cardDef(c).onTurnEndInHand?.(this, c);
    });
    this.queue.push(() => {
      const pyramid = this.run.hasRelic('runic_pyramid') || this.has(p, 'equilibrium');
      for (const c of [...this.hand]) {
        if (isEthereal(c)) {
          this.exhaustCard(c);
        } else if (isRetain(c) || pyramid) {
          c.retainOnce = false;
          cardDef(c).onRetain?.(this, c);
        } else {
          remove(this.hand, c);
          this.discardPile.push(c);
        }
      }
      for (const c of this.allCards()) c.costTurn = undefined;
      this.decayPowers(p, 'turnEnd');
      this.decayPowers(p, 'clear');
    });
    this.queue.push(() => this.beginEnemyPhase());
    this.process();
  }

  private beginEnemyPhase() {
    if (this.over) return;
    this.phase = 'enemy';
    const steps: (() => void)[] = [];
    // 第一步：所有敌人回合开始（格挡清除、中毒、灾厄）
    steps.push(() => {
      for (const e of this.alive) {
        if (!this.has(e, 'barricade')) e.block = 0;
        this.decayPowers(e, 'start');
        this.firePowers(e, 'onTurnStart');
        this.checkEnd();
        if (this.over) return;
      }
    });
    for (const e of this.alive) {
      steps.push(() => this.enemyAct(e));
    }
    steps.push(() => this.endRound());
    this.enemySteps = steps;
  }

  /** 执行敌方回合的下一步；返回是否还有剩余步骤 */
  stepEnemy(): boolean {
    if (this.phase !== 'enemy') return false;
    const s = this.enemySteps.shift();
    if (s) {
      try {
        s();
      } catch (e) {
        this.reportError(e);
      }
      this.checkEnd();
    }
    if (this.over) {
      this.enemySteps = [];
      return false;
    }
    return this.enemySteps.length > 0;
  }

  /** 一次性跑完敌方回合（测试 / 快速模式） */
  runEnemyPhase() {
    while (this.stepEnemy()) {
      /* continue */
    }
  }

  private enemyAct(e: Enemy) {
    if (e.dead || e.escaped || this.over) return;
    const def = this.enemyDef(e);
    if (this.has(e, 'stunned')) {
      delete e.powers.stunned;
      this.emit('text', e.uid, undefined, '眩晕');
    } else if (e.move) {
      const m = def.moves[e.move];
      if (m) {
        this.emit('text', e.uid, undefined, m.name);
        m.act(e, this);
        e.history.push(e.move);
      }
    }
    e.turns++;
    if (e.dead || e.escaped || this.over) return;
    this.firePowers(e, 'onTurnEnd');
    this.decayPowers(e, 'turnEnd');
    this.decayPowers(e, 'clear');
    if (!e.dead && !e.escaped) e.move = def.ai(e, this);
  }

  private endRound() {
    for (const c of [this.player, ...this.alive, ...(this.osty ? [this.osty] : [])]) {
      this.decayPowers(c, 'round');
      c.justApplied = {};
    }
    this.enemySteps = [];
    if (!this.over) this.startPlayerTurn();
  }

  private decayPowers(c: Creature, mode: 'round' | 'start' | 'turnEnd' | 'clear') {
    for (const id of Object.keys(c.powers)) {
      const def = POWERS[id];
      if (!def) continue;
      if (mode === 'clear') {
        if (def.decay === 'clear') delete c.powers[id];
        continue;
      }
      if (mode === 'start' && def.decay === 'startClear') {
        delete c.powers[id];
        continue;
      }
      if (def.decay !== mode) continue;
      if (mode === 'round' && c.justApplied[id]) continue;
      c.powers[id] -= 1;
      if (c.powers[id] <= 0) delete c.powers[id];
    }
  }

  checkEnd() {
    if (this.result) return;
    if (this.player.dead) {
      this.result = 'lose';
    } else if (!this.enemies.some((e) => !e.dead && !e.escaped && !e.minion)) {
      // 所有非仆从敌人已被消灭，仆从逃离
      for (const e of this.alive) {
        e.escaped = true;
        this.emit('escape', e.uid);
      }
      this.result = 'win';
    }
    if (this.result) {
      this.phase = 'over';
      this.queue = [];
      this.pending = null;
      this.enemySteps = [];
      if (this.result === 'win') {
        for (const r of this.run.relics) RELICS[r.id]?.onVictory?.(this, r);
        const sr = this.pw(this.player, 'self_repair');
        if (sr > 0) this.heal(this.player, sr);
      }
      this.run.hp = Math.max(0, Math.min(this.player.hp, this.player.maxHp));
      this.run.maxHp = this.player.maxHp;
    }
  }

  /** 逃离战斗（烟雾弹） */
  escape() {
    if (this.boss || this.over) return;
    this.result = 'escape';
    this.phase = 'over';
    this.queue = [];
    this.pending = null;
    this.run.hp = this.player.hp;
    this.run.maxHp = this.player.maxHp;
  }

  // =========================================================================
  // 行动队列
  // =========================================================================

  process() {
    if (this.processing) return;
    this.processing = true;
    try {
      while (!this.pending && this.queue.length && !this.over) {
        const a = this.queue.shift()!;
        try {
          a();
        } catch (e) {
          // 单个效果出错时跳过它，避免整场战斗卡死
          this.reportError(e);
        }
        this.checkEnd();
      }
    } finally {
      this.processing = false;
    }
  }

  /** 记录效果执行中的错误（测试环境下直接抛出，便于发现问题） */
  errors: string[] = [];
  reportError(e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    this.errors.push(msg);
    console.error('[combat]', e);
    if (Combat.strict) throw e;
  }
  /** 严格模式：测试时打开，出错直接抛出 */
  static strict = false;

  /** 把一个行动插入队列最前（在当前行动之后立刻执行） */
  next(a: () => void) {
    this.queue.unshift(a);
  }

  // =========================================================================
  // 能力钩子
  // =========================================================================

  firePowers<K extends keyof PowerDef>(c: Creature, hook: K, ...args: unknown[]) {
    for (const id of Object.keys(c.powers)) {
      const def = POWERS[id];
      const fn = def?.[hook] as unknown as ((...a: unknown[]) => void) | undefined;
      if (fn && c.powers[id] !== undefined) fn(this, c, c.powers[id], ...args);
      if (this.over) return;
    }
  }

  private fireRelics<K extends keyof RelicDef>(hook: K, ...args: unknown[]) {
    for (const r of this.run.relics) {
      const fn = RELICS[r.id]?.[hook] as unknown as ((...a: unknown[]) => void) | undefined;
      if (fn) fn(this, r, ...args);
    }
  }

  // =========================================================================
  // 伤害
  // =========================================================================

  /** 计算一次攻击的伤害（力量、虚弱、易伤等） */
  calcAttack(src: Creature | null, tgt: Creature | null, base: number, card: Card | null = null): number {
    let d = base;
    if (src && !src.isPlayer && src !== this.osty) d = Math.floor(d * this.run.enemyDmgMult());
    if (src) {
      for (const id of Object.keys(src.powers)) {
        const def = POWERS[id];
        if (def?.dmgOutAdd) d += def.dmgOutAdd(this, src, src.powers[id], card);
      }
      if (src.isPlayer && card) {
        for (const r of this.run.relics) {
          const def = RELICS[r.id];
          if (def?.onAttackDamage) d = def.onAttackDamage(this, r, d, card);
        }
      }
      for (const id of Object.keys(src.powers)) {
        const def = POWERS[id];
        if (def?.dmgOut) d = def.dmgOut(this, src, src.powers[id], d, card);
      }
    }
    if (tgt) {
      for (const id of Object.keys(tgt.powers)) {
        const def = POWERS[id];
        if (def?.dmgIn) d = def.dmgIn(this, tgt, tgt.powers[id], d, src);
      }
    }
    return Math.max(0, Math.floor(d));
  }

  /** 卡牌描述中显示的伤害 */
  previewDamage(c: Card, target: Enemy | null): number {
    const base = cardDmg(this, c);
    const src = hasTag(c, 'osty') ? this.osty : this.player;
    return this.calcAttack(src, target, base, c);
  }

  previewBlock(base: number): number {
    let b = base;
    for (const id of Object.keys(this.player.powers)) {
      const def = POWERS[id];
      if (def?.blockMod) b = def.blockMod(this, this.player, this.player.powers[id], b);
    }
    return Math.max(0, Math.floor(b));
  }

  /** 敌人意图显示的单次伤害 */
  intentDamage(e: Enemy): { dmg: number; hits: number } | null {
    const m = this.moveOf(e);
    if (!m || m.dmg === undefined) return null;
    const base = typeof m.dmg === 'function' ? m.dmg(e, this) : m.dmg;
    const hits = m.hits === undefined ? 1 : typeof m.hits === 'function' ? m.hits(e, this) : m.hits;
    return { dmg: this.calcAttack(e, this.player, base), hits };
  }

  /**
   * 对目标造成伤害（底层）。返回实际失去的生命与是否击杀。
   * kind=hploss 时无视格挡。
   */
  dealDamage(
    tgt: Creature,
    amount: number,
    src: Creature | null,
    kind: DmgKind = 'attack',
  ): { dealt: number; killed: boolean } {
    if (tgt.dead || (tgt as Enemy).escaped || tgt.powers.revive_pending) return { dealt: 0, killed: false };
    if (tgt === this.osty && !this.osty.alive) return { dealt: 0, killed: false };
    let d = Math.max(0, Math.floor(amount));
    for (const id of Object.keys(tgt.powers)) {
      const def = POWERS[id];
      if (def?.dmgInFinal) d = def.dmgInFinal(this, tgt, tgt.powers[id], d, src);
    }
    if (kind !== 'hploss' && tgt.block > 0 && d > 0) {
      const b = Math.min(tgt.block, d);
      tgt.block -= b;
      d -= b;
      this.emit('blocked', tgt.uid, b);
    }
    // 奥斯提替玩家承受攻击伤害
    if (tgt.isPlayer && kind === 'attack' && d > 0 && this.osty?.alive) {
      const o = this.osty;
      const absorbed = Math.min(o.hp, d);
      o.hp -= absorbed;
      d -= absorbed;
      this.emit('dmg', o.uid, absorbed);
      if (o.hp <= 0) this.killOsty();
    }
    if (tgt.isPlayer && d > 0) {
      for (const r of this.run.relics) {
        const def = RELICS[r.id];
        if (def?.modHpLoss) d = def.modHpLoss(this, r, d, kind === 'attack');
      }
      if (d > 0 && this.pw(tgt, 'buffer') > 0) {
        this.reducePower(tgt, 'buffer', 1);
        this.emit('text', tgt.uid, undefined, '缓冲');
        d = 0;
      }
    }
    if (!tgt.isPlayer && d > 0 && this.pw(tgt, 'buffer') > 0) {
      this.reducePower(tgt, 'buffer', 1);
      d = 0;
    }
    let dealt = 0;
    if (d > 0) {
      dealt = Math.min(d, tgt.hp);
      tgt.hp -= d;
      this.emit(kind === 'hploss' ? 'hploss' : 'dmg', tgt.uid, d);
      if (tgt.isPlayer) {
        this.t.hpLost += d;
        this.total.hpLossTimes++;
        this.run.stats.damageTaken += d;
        for (const r of this.run.relics) RELICS[r.id]?.onPlayerHpLoss?.(this, r, d);
        for (const c of this.allCards()) {
          const def = cardDef(c);
          if (def.tags?.includes('bloodcost')) c.costCombat = Math.max(0, (c.costCombat ?? baseCost(c)) - 1);
        }
      }
      if (tgt.hp > 0 || tgt.isPlayer) this.firePowers(tgt, 'onHpLost', d, src);
    } else if (kind === 'attack') {
      this.emit('dmg', tgt.uid, 0);
    }
    if (kind === 'attack' && src && !src.dead) {
      this.firePowers(tgt, 'onAttacked', src, d);
    }
    let killed = false;
    if (tgt.hp <= 0 && !tgt.dead) {
      killed = this.die(tgt);
    }
    return { dealt, killed };
  }

  private die(c: Creature): boolean {
    if (c.isPlayer) {
      // 复活：妖精瓶 / 蜥蜴尾巴
      const slot = this.run.potions.findIndex((p) => p && POTIONS[p]?.onDeath);
      if (slot >= 0) {
        const pid = this.run.potions[slot]!;
        this.run.potions[slot] = null;
        POTIONS[pid].use({ run: this.run, g: this, t: null, potency: this.run.potionPotency() });
        if (c.hp > 0) return false;
      }
      for (const r of this.run.relics) {
        const def = RELICS[r.id];
        if (def?.onDeath && def.onDeath(this, r)) return false;
      }
      c.hp = 0;
      c.dead = true;
      this.emit('die', c.uid);
      return true;
    }
    const e = c as Enemy;
    if (this.has(e, 'revive_pending')) return false;
    // 「重生」类能力：在死亡时拦截
    const illusion = this.has(e, 'illusion');
    if (illusion || (this.has(e, 'reincarnate') && this.pw(e, 'reincarnate') > 0)) {
      if (!illusion) this.reducePower(e, 'reincarnate', 1);
      e.hp = 0;
      e.block = 0;
      e.powers = { ...e.powers, revive_pending: 1 };
      e.move = 'revive';
      this.emit('text', e.uid, undefined, illusion ? '幻象消散' : '濒死');
      return false;
    }
    e.hp = 0;
    e.dead = true;
    e.block = 0;
    this.emit('die', e.uid);
    this.firePowers(e, 'onDeath');
    e.powers = {};
    for (const r of this.run.relics) RELICS[r.id]?.onEnemyDeath?.(this, r, e);
    this.firePowers(this.player, 'onEnemyDeath', e);
    for (const other of this.alive) this.firePowers(other, 'onEnemyDeath', e);
    this.run.stats.kills++;
    return true;
  }

  /** 以玩家（或指定来源）发动一次攻击 */
  attack(target: Creature | null, base: number, card: Card | null = null, src?: Creature | null) {
    const s = src === undefined ? this.player : src;
    if (!target || target.dead || (target as Enemy).escaped) return { dealt: 0, killed: false };
    const d = this.calcAttack(s, target, base, card);
    if (s) this.emit('lunge', s.uid);
    const r = this.dealDamage(target, d, s, 'attack');
    if (s?.isPlayer && card && cardDef(card).type === 'attack') {
      this.firePowers(s, 'onDealAttack', target, r.dealt);
    }
    return r;
  }

  attackAll(base: number, card: Card | null = null, src?: Creature | null): number {
    let kills = 0;
    for (const e of this.alive) {
      if (this.attack(e, base, card, src).killed) kills++;
    }
    return kills;
  }

  attackRandom(base: number, card: Card | null = null, src?: Creature | null) {
    const e = this.randomEnemy();
    return this.attack(e, base, card, src);
  }

  /** 敌人攻击玩家 */
  enemyAttack(e: Enemy, base: number, hits = 1): number {
    let total = 0;
    for (let i = 0; i < hits; i++) {
      if (this.player.dead || e.dead || this.over) break;
      const r = this.attack(this.player, base, null, e);
      total += r.dealt;
    }
    return total;
  }

  /** 直接失去生命（不受格挡影响） */
  loseHp(tgt: Creature, n: number, src: Creature | null = null) {
    return this.dealDamage(tgt, n, src, 'hploss');
  }

  /** 非攻击伤害（荆棘等，受格挡影响） */
  thorns(tgt: Creature, n: number, src: Creature | null) {
    return this.dealDamage(tgt, n, src, 'thorns');
  }

  heal(c: Creature, n: number) {
    if (c.dead || n <= 0) return;
    if (c.isPlayer && this.run.hasRelic('mark_of_bloom')) return;
    const before = c.hp;
    c.hp = Math.min(c.maxHp, c.hp + n);
    if (c.hp > before) this.emit('heal', c.uid, c.hp - before);
  }

  gainMaxHp(n: number) {
    this.player.maxHp += n;
    this.player.hp += n;
    this.run.maxHp = this.player.maxHp;
    this.emit('heal', this.player.uid, n);
  }

  // =========================================================================
  // 格挡
  // =========================================================================

  /** 玩家从卡牌获得格挡（受敏捷、脆弱影响） */
  block(base: number, target: Creature = this.player) {
    const b = target === this.player ? this.previewBlock(base) : base;
    this.gainBlock(target, b);
  }

  gainBlock(c: Creature, n: number) {
    if (c.dead || n <= 0) return;
    c.block = Math.min(999, c.block + n);
    this.emit('block', c.uid, n);
    this.firePowers(c, 'onGainBlock', n);
    if (c.isPlayer) this.fireRelics('onGainBlock', n);
  }

  // =========================================================================
  // 能力
  // =========================================================================

  /** 施加能力。返回是否成功（可能被人工制品抵消） */
  apply(tgt: Creature | null, id: string, n: number, src: Creature | null = this.player): boolean {
    if (!tgt || tgt.dead || n === 0) return false;
    if ((tgt as Enemy).escaped) return false;
    const def = POWERS[id];
    if (!def) throw new Error(`未知能力: ${id}`);
    const isDebuff = def.type === 'debuff' || (def.negative && n < 0);
    if (isDebuff && tgt !== src) {
      if (this.pw(tgt, 'artifact') > 0) {
        this.reducePower(tgt, 'artifact', 1);
        this.emit('negated', tgt.uid, undefined, '抵消');
        return false;
      }
      if (tgt.isPlayer) {
        if (id === 'weak' && this.run.hasRelic('ginger')) return false;
        if (id === 'frail' && this.run.hasRelic('turnip')) return false;
      }
    }
    if (id === 'poison' && src?.isPlayer && this.run.hasRelic('snecko_skull')) n += 1;
    const prev = tgt.powers[id] ?? 0;
    const nv = prev + n;
    if (def.negative) {
      if (nv === 0) delete tgt.powers[id];
      else tgt.powers[id] = nv;
    } else if (nv <= 0) {
      delete tgt.powers[id];
    } else {
      tgt.powers[id] = def.noStack ? Math.max(1, nv) : nv;
    }
    if (this.phase === 'enemy' && src && !src.isPlayer && (def.decay === 'round' || def.delayed)) {
      tgt.justApplied[id] = true;
    }
    this.emit(isDebuff ? 'debuff' : 'buff', tgt.uid, n, def.name);
    if (isDebuff && src?.isPlayer && !tgt.isPlayer) {
      this.firePowers(this.player, 'onApplyDebuff', tgt, id);
      if (id === 'vulnerable' && this.run.hasRelic('champion_belt')) this.apply(tgt, 'weak', 1);
    }
    return true;
  }

  reducePower(c: Creature, id: string, n: number) {
    if (c.powers[id] === undefined) return;
    c.powers[id] -= n;
    if (c.powers[id] <= 0 && !POWERS[id]?.negative) delete c.powers[id];
  }

  removePower(c: Creature, id: string) {
    delete c.powers[id];
  }

  /** 移除所有负面效果 */
  cleanse(c: Creature) {
    for (const id of Object.keys(c.powers)) {
      const def = POWERS[id];
      if (def?.type === 'debuff' || (def?.negative && c.powers[id] < 0)) delete c.powers[id];
    }
  }

  // =========================================================================
  // 牌堆操作
  // =========================================================================

  shuffleDiscardIntoDraw() {
    if (!this.discardPile.length) return;
    this.drawPile = this.rng.shuffle([...this.discardPile, ...this.drawPile]);
    this.discardPile = [];
    this.total.shuffles++;
    this.emit('shuffle', this.player.uid);
    this.firePowers(this.player, 'onShuffle');
    this.fireRelics('onShuffle');
  }

  /** 抽 n 张牌，返回抽到的牌 */
  draw(n: number): Card[] {
    const drawn: Card[] = [];
    if (this.has(this.player, 'no_draw')) return drawn;
    for (let i = 0; i < n; i++) {
      if (this.over) break;
      if (this.hand.length >= HAND_LIMIT) break;
      if (!this.drawPile.length) this.shuffleDiscardIntoDraw();
      const c = this.drawPile.pop();
      if (!c) break;
      this.hand.push(c);
      drawn.push(c);
      this.t.drawn++;
      if (this.has(this.player, 'confused') && baseCost(c) >= 0) {
        c.costCombat = this.rng.int(0, 3);
      }
      cardDef(c).onDraw?.(this, c);
      this.firePowers(this.player, 'onDraw', c);
    }
    return drawn;
  }

  /** 将卡牌加入手牌（手牌满时进入弃牌堆） */
  addToHand(c: Card | string, up = false, count = 1): Card[] {
    const out: Card[] = [];
    for (let i = 0; i < count; i++) {
      const card = typeof c === 'string' ? this.newCard(c, up) : i === 0 ? c : duplicateCard(c);
      if (this.hand.length < HAND_LIMIT) this.hand.push(card);
      else this.discardPile.push(card);
      out.push(card);
    }
    return out;
  }

  addToDraw(c: Card | string, up = false, count = 1, where: 'random' | 'top' | 'bottom' = 'random') {
    for (let i = 0; i < count; i++) {
      const card = typeof c === 'string' ? this.newCard(c, up) : i === 0 ? c : duplicateCard(c);
      if (where === 'top') this.drawPile.push(card);
      else if (where === 'bottom') this.drawPile.unshift(card);
      else this.drawPile.splice(this.rng.int(0, this.drawPile.length), 0, card);
    }
  }

  addToDiscard(c: Card | string, up = false, count = 1) {
    for (let i = 0; i < count; i++) {
      const card = typeof c === 'string' ? this.newCard(c, up) : i === 0 ? c : duplicateCard(c);
      this.discardPile.push(card);
    }
  }

  newCard(id: string, up = false): Card {
    const c = makeCard(id, up);
    if (!up && this.has(this.player, 'master_reality')) upgradeCard(c);
    const t = cardDef(c).type;
    if (!up && t === 'attack' && this.run.hasRelic('molten_egg')) upgradeCard(c);
    return c;
  }

  private takeFromPiles(c: Card) {
    remove(this.hand, c) || remove(this.drawPile, c) || remove(this.discardPile, c) || remove(this.limbo, c);
  }

  exhaustCard(c: Card) {
    this.takeFromPiles(c);
    this.exhaustPile.push(c);
    cardDef(c).onExhaust?.(this, c);
    this.firePowers(this.player, 'onExhaust', c);
    for (const e of this.alive) this.firePowers(e, 'onExhaust', c);
    this.fireRelics('onExhaust', c);
  }

  /** 手动弃牌（触发「反射」等） */
  discardCard(c: Card) {
    this.takeFromPiles(c);
    this.t.discarded++;
    if (hasTag(c, 'sly') && !this.over) {
      // 机巧：被丢弃时免费打出
      this.emit('text', this.player.uid, undefined, `机巧：${cardDef(c).name}`);
      cardDef(c).onManualDiscard?.(this, c);
      this.firePowers(this.player, 'onManualDiscard', c);
      this.autoPlay(c, this.randomEnemy());
      return;
    }
    this.discardPile.push(c);
    cardDef(c).onManualDiscard?.(this, c);
    this.firePowers(this.player, 'onManualDiscard', c);
  }

  /** 给卡牌施加苦难（本场战斗有效） */
  afflict(c: Card, id: string) {
    c.afflict = id;
  }

  /** 随机给牌堆（抽牌堆、弃牌堆、手牌）中的 n 张牌施加苦难 */
  afflictCards(id: string, n: number) {
    const cands = [...this.drawPile, ...this.discardPile, ...this.hand].filter(
      (c) => !c.afflict && baseCost(c) !== UNPLAYABLE && cardDef(c).type !== 'status' && cardDef(c).type !== 'curse',
    );
    const picked = this.rng.sample(cands, n);
    for (const c of picked) this.afflict(c, id);
    if (picked.length) this.emit('debuff', this.player.uid, picked.length, `${picked.length} 张牌被施加苦难`);
  }

  moveTo(c: Card, pile: 'hand' | 'draw' | 'drawTop' | 'discard') {
    this.takeFromPiles(c);
    if (pile === 'hand') {
      if (this.hand.length < HAND_LIMIT) this.hand.push(c);
      else this.discardPile.push(c);
    } else if (pile === 'drawTop') this.drawPile.push(c);
    else if (pile === 'draw') this.drawPile.splice(this.rng.int(0, this.drawPile.length), 0, c);
    else this.discardPile.push(c);
  }

  /** 从手牌/其他位置中选择卡牌 */
  chooseCards(
    opts: { title: string; cards: Card[]; min: number; max: number; mode?: 'hand' | 'grid' },
    cb: (sel: Card[]) => void,
  ) {
    const cards = opts.cards;
    const max = Math.min(opts.max, cards.length);
    const min = Math.min(opts.min, cards.length);
    if (cards.length === 0 || max === 0) {
      cb([]);
      return;
    }
    // 必须全部选择时自动选择
    if (min >= cards.length && (opts.mode ?? 'grid') === 'hand') {
      cb([...cards]);
      return;
    }
    this.pending = {
      mode: opts.mode ?? 'grid',
      title: opts.title,
      cards,
      min,
      max,
      resolve: (sel) => {
        this.pending = null;
        this.next(() => cb(sel));
        this.process();
      },
    };
  }

  chooseHand(opts: { title: string; min: number; max: number; filter?: (c: Card) => boolean }, cb: (sel: Card[]) => void) {
    const cards = this.hand.filter(opts.filter ?? (() => true));
    this.chooseCards({ ...opts, cards, mode: 'hand' }, cb);
  }

  /** 从若干张生成的牌中选择 1 张（发现） */
  discover(cards: Card[], cb: (c: Card) => void, title = '选择一张牌') {
    this.chooseCards({ title, cards, min: 1, max: 1, mode: 'grid' }, (sel) => {
      if (sel[0]) cb(sel[0]);
    });
  }

  /** 生成随机卡牌（用于发现、无尽等） */
  randomCards(
    n: number,
    filter: (id: string) => boolean,
    pool: 'char' | 'colorless' | 'any' = 'char',
  ): Card[] {
    const ids = Object.values(CARDS)
      .filter((d) => !d.noPool && ['common', 'uncommon', 'rare'].includes(d.rarity))
      .filter((d) =>
        pool === 'char' ? d.color === this.run.char : pool === 'colorless' ? d.color === 'colorless' : true,
      )
      .filter((d) => d.color !== 'curse' && d.color !== 'status')
      .map((d) => d.id)
      .filter(filter);
    return this.rng.sample(ids, n).map((id) => this.newCard(id));
  }

  // =========================================================================
  // 打出卡牌
  // =========================================================================

  costOf(c: Card): number {
    const d = cardDef(c);
    const b = baseCost(c);
    if (b === UNPLAYABLE) return Infinity;
    if (isX(c)) return 0;
    let cost = displayCost(c);
    if (d.costFn) cost = d.costFn(this, c, cost);
    if (d.type === 'skill' && this.has(this.player, 'corruption')) cost = 0;
    if (c.freeOnce) cost = 0;
    if (this.has(this.player, 'free_attacks') && d.type === 'attack') cost = 0;
    if (c.afflict === 'heavy') cost += 1;
    // 专属首领施加的临时规则
    if (d.type === 'attack' && this.has(this.player, 'trend_attack_tax')) cost += 1;
    if (d.type === 'attack' && this.has(this.player, 'tangled')) cost += 1;
    if (this.has(this.player, 'memorized') && this.notes.memorized === c.id) cost += 1;
    return Math.max(0, cost);
  }

  starCostOf(c: Card): number {
    let s = starCost(c);
    if (s > 0 && this.has(this.player, 'free_stars')) s = 0;
    return s;
  }

  canPlay(c: Card): true | string {
    if (this.phase !== 'player' || this.pending || this.over) return '现在不能出牌';
    if (!this.hand.includes(c)) return '不在手牌中';
    const d = cardDef(c);
    if (baseCost(c) === UNPLAYABLE) {
      if (d.type === 'curse' && this.run.hasRelic('blue_candle')) return true;
      if (d.type === 'status' && this.run.hasRelic('medical_kit')) return true;
      return '这张牌不能被打出';
    }
    if (this.costOf(c) > this.energy) return '能量不足';
    if (this.starCostOf(c) > this.stars) return '星辰不足';
    if (d.type === 'attack' && this.has(this.player, 'entangled')) return '你被缠绕了，无法打出攻击牌';
    if (d.tags?.includes('tool') && this.has(this.player, 'trend_tool_strike')) return '#工具罢工：本回合不能打出工具牌';
    if (this.t.cards >= 3 && this.hand.some((h) => h.id === 'normality')) return '凡庸：本回合已无法打出更多卡牌';
    if (this.run.hasRelic('velvet_choker') && this.t.cards >= 6) return '本回合已打出 6 张牌';
    if (d.canPlay) {
      const r = d.canPlay(this, c);
      if (r !== true) return r;
    }
    return true;
  }

  needsTarget(c: Card): boolean {
    return cardDef(c).target === 'enemy';
  }

  playCard(c: Card, target: Enemy | null): boolean {
    const ok = this.canPlay(c);
    if (ok !== true) return false;
    const d = cardDef(c);
    if (d.target === 'enemy') {
      if (!target || target.dead || target.escaped) target = this.alive[0] ?? null;
      if (!target) return false;
    }
    // 支付费用
    let x = 0;
    if (baseCost(c) === UNPLAYABLE) {
      // 蓝蜡烛 / 医疗包
      remove(this.hand, c);
      this.limbo.push(c);
      this.queue.push(() => {
        if (d.type === 'curse') this.loseHp(this.player, 1);
        this.exhaustCard(c);
      });
      this.process();
      return true;
    }
    if (isX(c)) {
      x = this.energy;
      this.energy = 0;
      if (this.run.hasRelic('chemical_x')) x += 2;
    } else {
      this.energy -= this.costOf(c);
    }
    const sc = this.starCostOf(c);
    if (sc > 0) this.spendStars(sc);
    c.freeOnce = false;
    remove(this.hand, c);
    this.limbo.push(c);
    this.phase = 'busy';
    this.usePlay(c, target, x, false);
    this.queue.push(() => {
      if (!this.over) this.phase = 'player';
    });
    this.process();
    return true;
  }

  /** 无需支付费用打出（如「破灭」打出抽牌堆顶的牌） */
  autoPlay(c: Card, target: Enemy | null = null, exhaustAfter = false) {
    this.takeFromPiles(c);
    this.limbo.push(c);
    const d = cardDef(c);
    if (baseCost(c) === UNPLAYABLE || !d.play) {
      this.next(() => (exhaustAfter ? this.exhaustCard(c) : this.moveTo(c, 'discard')));
      return;
    }
    if (d.target === 'enemy' && (!target || target.dead)) target = this.randomEnemy();
    const x = isX(c) ? this.energy : 0;
    if (isX(c)) this.energy = 0;
    this.usePlay(c, target, x, true, exhaustAfter);
  }

  private usePlay(c: Card, target: Enemy | null, x: number, front: boolean, exhaustAfter = false) {
    const d = cardDef(c);
    const actions: (() => void)[] = [];
    actions.push(() => {
      if (c.afflict === 'sapping') this.loseHp(this.player, 2);
      this.t.cards++;
      this.total.cards++;
      c.played = (c.played ?? 0) + 1;
      if (d.type === 'attack') {
        this.t.attacks++;
        this.total.attacks++;
      } else if (d.type === 'skill') this.t.skills++;
      else if (d.type === 'power') {
        this.t.powers++;
        this.total.powers++;
      }
      if (d.tags?.includes('tool')) this.total.tools++;
      this.firePowers(this.player, 'onCardPlayed', c);
      for (const e of this.alive) this.firePowers(e, 'onCardPlayed', c);
      for (const r of this.run.relics) RELICS[r.id]?.onCardPlayed?.(this, r, c);
      for (const h of [...this.hand]) if (h !== c) cardDef(h).onOtherPlayed?.(this, h, c);
      this.run.stats.cardsPlayed++;
    });
    let plays = 1;
    if (d.type === 'attack' && this.pw(this.player, 'double_tap') > 0) {
      this.reducePower(this.player, 'double_tap', 1);
      plays++;
    }
    if (d.type === 'skill' && this.pw(this.player, 'burst') > 0) {
      this.reducePower(this.player, 'burst', 1);
      plays++;
    }
    if (this.pw(this.player, 'duplication') > 0 && d.type !== 'power') {
      this.reducePower(this.player, 'duplication', 1);
      plays++;
    }
    if (d.type === 'power' && this.pw(this.player, 'amplify') > 0) {
      this.reducePower(this.player, 'amplify', 1);
      plays++;
    }
    if (this.t.cards < this.pw(this.player, 'echo_form')) plays++;
    if (isStarCard(c) && this.pw(this.player, 'twin_stars') > 0) {
      this.reducePower(this.player, 'twin_stars', 1);
      plays++;
    }
    if (d.tags?.includes('tool')) plays += this.pw(this.player, 'agentic_loop');
    const ench = c.ench && ENCHANTS[c.ench.id];
    if (ench?.id === 'echo' && !this.enchFirstPlayed.has(c.uid)) plays++;
    for (let i = 0; i < plays; i++) {
      actions.push(() => {
        let t = target;
        if (d.target === 'enemy' && (!t || t.dead || t.escaped)) t = this.randomEnemy();
        if (d.target === 'enemy' && !t) return;
        this.x = x;
        d.play?.(this, c, t);
      });
    }
    if (ench) {
      actions.push(() => {
        if (!this.enchFirstPlayed.has(c.uid)) {
          this.enchFirstPlayed.add(c.uid);
          ench.onFirstPlay?.(this, c, c.ench!.n);
        }
        ench.onPlay?.(this, c, c.ench!.n);
      });
    }
    actions.push(() => this.finishPlay(c, exhaustAfter));
    if (front) this.queue.unshift(...actions);
    else this.queue.push(...actions);
  }

  private finishPlay(c: Card, forceExhaust: boolean) {
    const d = cardDef(c);
    if (!this.limbo.includes(c)) return;
    remove(this.limbo, c);
    if (d.type === 'power') {
      // 能力牌打出后移出
    } else if (forceExhaust || isExhaust(c) || c.afflict === 'brittle' || (d.type === 'skill' && this.has(this.player, 'corruption'))) {
      if (this.run.hasRelic('strange_spoon') && !forceExhaust && this.rng.chance(0.5)) this.discardPile.push(c);
      else this.exhaustCard(c);
    } else if (d.tags?.includes('returnHand')) {
      this.addToHand(c);
    } else {
      this.discardPile.push(c);
    }
    this.firePowers(this.player, 'afterCardPlayed', c);
    this.fireRelics('afterCardPlayed', c);
    if (this.hand.length === 0 && this.run.hasRelic('unceasing_top') && this.phase !== 'enemy') {
      this.draw(1);
    }
  }

  // =========================================================================
  // 资源
  // =========================================================================

  gainEnergy(n: number) {
    this.energy = Math.max(0, this.energy + n);
  }

  gainStars(n: number) {
    if (n <= 0) return;
    this.stars += n;
    this.emit('stars', this.player.uid, n);
    this.firePowers(this.player, 'onStarsGained', n);
  }

  spendStars(n: number) {
    const s = Math.min(this.stars, n);
    if (s <= 0) return;
    this.stars -= s;
    this.t.starsSpent += s;
    this.firePowers(this.player, 'onStarsSpent', s);
    this.fireRelics('onStarsSpent', s);
  }

  /** 铸造：强化君王之刃；若牌堆中没有则加入手牌 */
  forge(n: number) {
    this.forged += n;
    const has = [...this.hand, ...this.drawPile, ...this.discardPile, ...this.limbo].some((c) => c.id === 'sovereign_blade');
    if (!has) this.addToHand('sovereign_blade', this.has(this.player, 'blade_upgrade'));
    this.emit('text', this.player.uid, undefined, `铸造 ${n}`);
  }

  /** 召唤奥斯提 */
  summon(n: number) {
    const o = this.osty;
    if (!o || n <= 0) return;
    n += this.pw(this.player, 'summon_bonus');
    if (!o.alive) {
      o.alive = true;
      o.dead = false;
      o.maxHp = n;
      o.hp = n;
      o.powers = {};
    } else {
      o.maxHp += n;
      o.hp += n;
    }
    this.total.summons++;
    this.emit('summon', o.uid, n);
    this.firePowers(this.player, 'onSummon', n);
    this.fireRelics('onSummon', n);
  }

  get ostyAlive(): boolean {
    return !!this.osty?.alive;
  }

  killOsty() {
    const o = this.osty;
    if (!o || !o.alive) return;
    o.alive = false;
    o.hp = 0;
    o.maxHp = 0;
    o.block = 0;
    o.powers = {};
    this.total.ostyDeaths++;
    this.emit('die', o.uid);
    this.firePowers(this.player, 'onOstyDeath');
  }

  /** 奥斯提发动攻击 */
  ostyAttack(target: Creature | null, base: number, card: Card | null) {
    if (!this.osty?.alive) {
      this.emit('text', this.player.uid, undefined, '奥斯提不在场');
      return { dealt: 0, killed: false };
    }
    return this.attack(target, base, card, this.osty);
  }

  // =========================================================================
  // 上下文、思考与工具（Claude）
  // =========================================================================

  /** 记录：获得上下文；达到窗口上限时压缩（溢出的部分保留） */
  note(n: number) {
    if (n <= 0 || this.over) return;
    this.context += n;
    this.overflow();
  }

  private compactDepth = 0;

  private overflow() {
    // 压缩时触发的效果可能再次记录：嵌套的记录交给最外层统一处理，并限制单次连锁的次数
    if (this.compactDepth > 0) return;
    this.compactDepth++;
    try {
      let guard = 0;
      while (this.context >= this.contextMax && !this.over) {
        if (guard++ >= 10) {
          this.context = this.contextMax - 1;
          break;
        }
        this.context -= this.contextMax;
        this.compact();
      }
    } finally {
      this.compactDepth--;
    }
  }

  /** 压缩：将 1 张摘要加入手牌，并触发压缩相关的效果 */
  compact() {
    if (this.over) return;
    this.compacts++;
    this.emit('compact', this.player.uid);
    this.addToHand('summary');
    this.firePowers(this.player, 'onCompact');
    this.fireRelics('onCompact');
    for (const e of this.alive) this.firePowers(e, 'onCompact');
  }

  /** 花费上下文，返回实际花费的数量 */
  spendContext(n = this.context): number {
    const s = Math.max(0, Math.min(this.context, n));
    this.context -= s;
    return s;
  }

  /** 改变上下文窗口的大小（至少为 3） */
  resizeContext(delta: number) {
    this.contextMax = Math.max(3, this.contextMax + delta);
    this.overflow();
  }

  /**
   * 思考：查看抽牌堆顶部 n 张牌，弃掉其中任意张。
   * then 会在玩家做出选择之后执行（思考后面的效果都应该放在这里）。
   */
  think(n: number, then?: () => void) {
    // 已有待选择的效果时（例如回合开始时多个思考同时触发），排在它之后
    if (this.pending) {
      this.next(() => this.think(n, then));
      return;
    }
    const top = n > 0 ? this.drawPile.slice(-n).reverse() : [];
    this.chooseCards({ title: `思考 ${top.length}：选择要弃掉的牌（可以不选，最左边是牌堆顶）`, cards: top, min: 0, max: top.length, mode: 'grid' }, (sel) => {
      for (const c of sel) this.discardCard(c);
      // 「灵光」：每当你思考时，从弃牌堆回到手牌
      for (const c of [...this.discardPile]) if (cardDef(c).tags?.includes('thinkReturn')) this.moveTo(c, 'hand');
      this.firePowers(this.player, 'onThink', sel.length);
      then?.();
    });
  }

  /** 将 n 张随机工具牌加入手牌 */
  addTools(n: number, up = false) {
    for (let i = 0; i < n; i++) this.addToHand(this.rng.pick([...TOOL_IDS]), up);
  }

  // =========================================================================
  // 充能球
  // =========================================================================

  /** 生成充能球：栏位已满时先激发最左侧的充能球 */
  channel(id: OrbId) {
    if (this.orbSlots <= 0 || this.over) return;
    if (this.orbs.length >= this.orbSlots) this.evoke(1);
    if (this.over) return;
    this.orbs.push({ id, n: id === 'dark' ? 6 : 0 });
    if (id === 'lightning') this.total.lightning++;
    if (id === 'frost') this.total.frost++;
    this.emit('text', this.player.uid, undefined, `生成${ORBS[id].name}`);
  }

  /** 激发最左侧的充能球 times 次 */
  evoke(times = 1) {
    const o = this.orbs.shift();
    if (!o) return;
    for (let i = 0; i < times && !this.over; i++) ORBS[o.id].evoke(this, o);
    this.emit('text', this.player.uid, undefined, `激发${ORBS[o.id].name}`);
  }

  evokeAll() {
    while (this.orbs.length && !this.over) this.evoke(1);
  }

  /** 触发回合结束型被动（闪电、冰霜、黑暗） */
  triggerPassives(times = 1) {
    for (const o of [...this.orbs]) {
      if (ORBS[o.id].startOfTurn) continue;
      for (let i = 0; i < times; i++) ORBS[o.id].passive(this, o);
      if (this.over) return;
    }
    const cables = this.run.hasRelic('gold_plated_cables') ? this.orbs[0] : null;
    if (cables && !ORBS[cables.id].startOfTurn) ORBS[cables.id].passive(this, cables);
  }

  /** 触发单个充能球的被动 */
  triggerPassive(o: Orb, times = 1) {
    for (let i = 0; i < times && !this.over; i++) ORBS[o.id].passive(this, o);
  }

  addOrbSlots(n: number) {
    this.orbSlots = Math.max(0, Math.min(10, this.orbSlots + n));
    while (this.orbs.length > this.orbSlots) this.orbs.pop();
  }

  // =========================================================================
  // 药水
  // =========================================================================

  canUsePotion(slot: number): boolean {
    const id = this.run.potions[slot];
    if (!id || this.over || this.pending) return false;
    if (this.phase !== 'player') return false;
    return true;
  }

  usePotion(slot: number, target: Enemy | null) {
    if (!this.canUsePotion(slot)) return;
    const id = this.run.potions[slot]!;
    const def = POTIONS[id];
    if (def.target === 'enemy' && (!target || target.dead)) target = this.alive[0] ?? null;
    this.run.potions[slot] = null;
    this.queue.push(() => {
      def.use({ run: this.run, g: this, t: target, potency: this.run.potionPotency() });
      for (const r of this.run.relics) RELICS[r.id]?.onPotionUsed?.(this.run, r, this);
    });
    this.process();
  }
}

function isStarCard(c: Card): boolean {
  return (uv(cardDef(c).star, c.up) ?? 0) > 0;
}

/** 卡牌类型（便于外部使用） */
export function typeOf(c: Card): CardType {
  return cardDef(c).type;
}

export { cardBlk, cardDmg };
