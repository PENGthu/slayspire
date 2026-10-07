// 卡牌效果：动物能力、赞助卡（立即 / 触发 / 收入 / 终局）、放置奖励、地图左侧奖励、奖励板块、终局计分。
// 效果按原版基础游戏复刻，按卡牌编号实现。
import { abilityName, isPostAbility, soloAbility } from './abilities';
import { buildingDef } from './buildings';
import { card, sponsor, SCORING_CARDS } from './content';
import {
  advanceBreak,
  drawDeck,
  drawToHand,
  gainLog,
  log,
  partnerOpts,
  push,
  pushChoose,
  queueFx,
  refillDisplay,
  revealUntil,
  shuffle,
  slotOpts,
  uniOpts,
} from './engine';
import { featureCells, LEFT_INFO, type BonusId, type LeftBonusId } from './maps';
import {
  allBorderCovered,
  connectedCells,
  coveredCells,
  emptyBuildable,
  has,
  hasPlacement,
  iconCounts,
  kinds,
  largeCount,
  mapFullyCovered,
  mapOf,
  smallCount,
  terrainConnection,
} from './query';
import { appealIncome, tile } from './rules';
import type { Ability, ActionId, AnimalCard, Frame, Fx, GameState, Icon, Opt, PlayerState } from './types';
import { ACTIONS as ALL_ACTIONS, CATEGORIES, CONTINENTS } from './types';

// ———————————————————————————————————————————— 行动结束后的效果

/** 把效果挂到当前行动的结束步骤之后；不在行动中则立即排队 */
export function attachPost(g: GameState, pi: number, fx: Fx) {
  for (let i = g.stack.length - 1; i >= 0; i--) {
    const f = g.stack[i];
    if (f.k === 'finishAction' && f.p === pi) {
      if (fx.t === 'post' && fx.except === undefined) fx = { ...fx, except: f.action };
      f.after.push(fx);
      return;
    }
  }
  queueFx(g, pi, [fx]);
}

/** 打出动物时的能力：立即结算的排队返回，行动结束后的挂到行动上 */
export function playAnimalFx(g: GameState, pi: number, a: AnimalCard, uid: number): Fx[] {
  const out: Fx[] = [];
  for (const ab0 of a.abilities ?? []) {
    const ab = g.solo ? soloAbility(ab0) : ab0;
    if (isPostAbility(ab)) attachPost(g, pi, { t: 'post', ab });
    else out.push({ t: 'ability', ab, card: a.id, uid });
  }
  return out;
}

// ———————————————————————————————————————————— 图标触发

/** 自己打出图标时触发的赞助卡 */
const OWN_TRIGGERS: Record<string, Icon> = {
  s202: 'science',
  s204: 'science',
  s210: 'americas',
  s211: 'europe',
  s212: 'australia',
  s213: 'asia',
  s214: 'africa',
  s243: 'herbivore',
  s244: 'bird',
  s245: 'water',
  s246: 'rock',
  s247: 'primate',
  s248: 'primate',
  s249: 'bird',
  s250: 'reptile',
  s252: 'predator',
  s253: 'herbivore',
};

/** 任何动物园打出图标时都会触发的赞助卡 */
const ANY_TRIGGERS: Record<string, Icon> = {
  s208: 'science',
  s236: 'primate',
  s237: 'reptile',
  s238: 'bird',
  s239: 'predator',
  s240: 'herbivore',
  s251: 'bear',
};

export function triggerIcon(id: string): { icon: Icon; any: boolean } | null {
  if (OWN_TRIGGERS[id]) return { icon: OWN_TRIGGERS[id], any: false };
  if (ANY_TRIGGERS[id]) return { icon: ANY_TRIGGERS[id], any: true };
  return null;
}

/** 一张卡把图标带进动物园：按顺序列出被触发的效果（卡牌本身不触发自己） */
export function iconFx(g: GameState, pi: number, cardId: string, icons: Icon[], before: Record<Icon, number>): Frame[] {
  const out: Frame[] = [];
  const p = g.players[pi];
  for (const sid of p.sponsors) {
    if (sid === cardId) continue;
    const t = OWN_TRIGGERS[sid];
    if (t) for (const ic of icons) if (ic === t) out.push({ k: 'fx', p: pi, fx: { t: 'trigger', sponsor: sid, icon: ic } });
  }
  if (has(p, 's262') && cardId !== 's262') {
    const after = iconCounts(p);
    const n = [...CONTINENTS, ...CATEGORIES].filter((x) => before[x] === 0 && after[x] > 0).length;
    if (n) out.push({ k: 'fx', p: pi, fx: { t: 'gain', gain: { appeal: n, money: 2 * n }, why: `${sponsor('s262').name}（${n} 种新图标）` } });
  }
  g.players.forEach((o, oi) => {
    for (const sid of o.sponsors) {
      if (sid === cardId) continue;
      const t = ANY_TRIGGERS[sid];
      if (t) for (const ic of icons) if (ic === t) out.push({ k: 'fx', p: oi, fx: { t: 'trigger', sponsor: sid, icon: ic } });
    }
  });
  return out;
}

function resolveTrigger(g: GameState, pi: number, sid: string, icon: Icon) {
  const p = g.players[pi];
  const name = sponsor(sid).name;
  void icon;
  switch (sid) {
    case 's202':
      gainLog(g, pi, name, { rep: 1 });
      break;
    case 's204':
      gainLog(g, pi, name, { cp: 1 });
      break;
    case 's208':
      gainLog(g, pi, name, { money: 2 });
      break;
    case 's210':
      placeFree(g, pi, ['kiosk'], `${name}：可以免费建造 1 个售货亭`);
      break;
    case 's211':
      placeFree(g, pi, ['E1'], `${name}：可以免费建造 1 座 1 格围栏`);
      break;
    case 's212':
      if (p.hand.length) push(g, { k: 'pick', p: pi, purpose: 'pouch', cards: [], min: 0, max: 1, under: sid });
      break;
    case 's213':
      placeFree(g, pi, ['pavilion'], `${name}：可以免费建造 1 座凉亭`);
      break;
    case 's214':
      pushChoose(g, pi, `${name}：可以把任一行动卡放到 1 号位`, [...slotOpts(p, 0), { k: 'none' }]);
      break;
    case 's236':
    case 's237':
    case 's238':
    case 's239':
    case 's240':
      gainLog(g, pi, name, { money: 3 });
      break;
    case 's243':
    case 's244':
    case 's245':
    case 's246':
    case 's247':
    case 's251':
      gainLog(g, pi, name, { appeal: 2 });
      break;
    case 's248':
      gainLog(g, pi, name, { x: 1 });
      break;
    case 's249': {
      const cards = drawDeck(g, 2);
      if (cards.length) push(g, { k: 'pick', p: pi, purpose: 'keep', cards, min: 1, max: 1 });
      break;
    }
    case 's250':
      if (p.hand.length) push(g, { k: 'pick', p: pi, purpose: 'sell', cards: [], min: 0, max: 2 });
      break;
    case 's252': {
      const n = iconCounts(p).predator;
      const cards = drawDeck(g, n);
      if (cards.length) pushKeepAnimal(g, pi, cards, name);
      break;
    }
    case 's253':
      if ((p.cardTokens.s253 ?? 0) > 0 && p.hand.some((id) => card(id).kind === 'sponsor'))
        push(g, { k: 'sponsorPay', p: pi, reason: `${name}：移除 1 个标记，支付等级数的钱打出 1 张赞助卡`, token: 's253' });
      break;
  }
}

function pushKeepAnimal(g: GameState, pi: number, cards: string[], why: string) {
  if (cards.some((id) => card(id).kind === 'animal')) push(g, { k: 'pick', p: pi, purpose: 'keepAnimal', cards, min: 1, max: 1 });
  else {
    g.discard.push(...cards);
    log(g, pi, `${why}：翻开的牌里没有动物`);
  }
}

function placeFree(g: GameState, pi: number, types: string[], reason: string, count = 1, ignoreUpgrade = false) {
  const p = g.players[pi];
  const ok = types.filter((t) => hasPlacement(p, t, { ignoreTypeUpgrade: ignoreUpgrade }));
  if (ok.length) push(g, { k: 'place', p: pi, types: ok, reason, count, ignoreUpgrade });
}

// ———————————————————————————————————————————— 赞助卡的立即效果

export function sponsorNow(g: GameState, pi: number, id: string) {
  const p = g.players[pi];
  const ic = iconCounts(p);
  const name = sponsor(id).name;
  const others = (cp: number) => {
    if (!cp) return;
    g.players.forEach((o, oi) => oi !== pi && gainLog(g, oi, `${name}（${p.name} 获得 ${cp} 保护点数）`, { money: 2 * cp }));
  };
  switch (id) {
    case 's201':
    case 's254':
      push(g, { k: 'display', p: pi, n: 1, any: false, deck: true, reason: `${name}：从声望范围内或牌库拿 1 张牌` });
      break;
    case 's203':
      gainLog(g, pi, name, { money: [0, 2, 5, 10][p.unis.length] });
      break;
    case 's204':
      gainLog(g, pi, name, { money: 2 * ic.science });
      break;
    case 's206':
      gainLog(g, pi, name, { appeal: 2 * p.supported.length });
      break;
    case 's207': {
      const cp = Math.floor((kinds(p, 'continent') + kinds(p, 'category')) / 2);
      gainLog(g, pi, name, { cp });
      others(cp);
      break;
    }
    case 's208':
      gainLog(g, pi, name, { appeal: ic.science });
      break;
    case 's209':
    case 's224':
    case 's225':
      gainLog(g, pi, name, { x: 1 });
      break;
    case 's210':
      gainLog(g, pi, name, { appeal: ic.americas });
      break;
    case 's211':
      gainLog(g, pi, name, { appeal: ic.europe });
      break;
    case 's212':
      gainLog(g, pi, name, { appeal: ic.australia });
      break;
    case 's213':
      gainLog(g, pi, name, { appeal: ic.asia });
      break;
    case 's214':
      gainLog(g, pi, name, { appeal: ic.africa });
      break;
    case 's215':
    case 's218':
      p.cardTokens[id] = 2;
      log(g, pi, `${name}：放 2 个标记在卡上`);
      break;
    case 's216':
      gainLog(g, pi, name, { worker: 1 });
      break;
    case 's219':
      gainLog(g, pi, name, { money: 2 * (ic.water + ic.rock) });
      break;
    case 's220':
      gainLog(g, pi, name, { money: 3 });
      break;
    case 's222': {
      const cp = Math.min(3, ic.science);
      gainLog(g, pi, name, { cp });
      others(cp);
      break;
    }
    case 's227':
      if (!p.waza)
        pushChoose(g, pi, `${name}：选择小型或大型动物`, [
          { k: 'waza', size: 'small' },
          { k: 'waza', size: 'large' },
        ]);
      break;
    case 's228':
      gainLog(g, pi, name, { money: 2 * smallCount(p) });
      break;
    case 's229':
      gainLog(g, pi, name, { appeal: smallCount(p) });
      break;
    case 's230':
      gainLog(g, pi, name, { appeal: 2 * largeCount(p) });
      break;
    case 's231':
      gainLog(g, pi, name, { appeal: ic.primate });
      break;
    case 's232':
      gainLog(g, pi, name, { appeal: ic.reptile });
      break;
    case 's233':
      gainLog(g, pi, name, { appeal: ic.bird });
      break;
    case 's234':
      gainLog(g, pi, name, { appeal: ic.predator });
      break;
    case 's235':
      gainLog(g, pi, name, { appeal: ic.herbivore });
      break;
    case 's241':
      gainLog(g, pi, name, { appeal: ic.water });
      break;
    case 's242':
      gainLog(g, pi, name, { appeal: 3 * Math.floor(ic.rock / 2) });
      break;
    case 's253':
      p.cardTokens[id] = 3;
      log(g, pi, `${name}：放 3 个标记在卡上`);
      break;
    case 's258':
      gainLog(g, pi, name, { appeal: terrainConnection(p, 'water').connected });
      break;
    case 's259':
      gainLog(g, pi, name, { appeal: terrainConnection(p, 'rock').connected });
      break;
    case 's260':
      gainLog(g, pi, name, { appeal: connectedEmptyBorder(p) });
      break;
    case 's262':
      gainLog(g, pi, name, { money: 2 * (kinds(p, 'continent') + kinds(p, 'category')) });
      break;
    case 's263':
      placeFree(g, pi, ['E5'], `${name}：可以免费放 1 座 5 格围栏`);
      break;
    case 's264':
      gainLog(g, pi, name, { appeal: bonusCells(p).connected });
      break;
  }
}

function isBlocked(f: string | null) {
  return f === 'tower' || f === 'gate' || f === 'restaurant';
}

/** 与建筑相邻、还没有建筑的边缘陆地格 */
export function connectedEmptyBorder(p: PlayerState): number {
  const covered = coveredCells(p);
  const conn = connectedCells(p);
  return mapOf(p).cells.filter((c) => c.border && c.terrain === 'land' && !isBlocked(c.feature) && !covered.has(c.i) && conn.has(c.i)).length;
}

/** 还没被覆盖的放置奖励格：与建筑相邻 / 不相邻的数量 */
export function bonusCells(p: PlayerState): { connected: number; unconnected: number } {
  const covered = coveredCells(p);
  const conn = connectedCells(p);
  let connected = 0;
  let unconnected = 0;
  for (const c of mapOf(p).cells) {
    if (!c.bonus || covered.has(c.i)) continue;
    if (conn.has(c.i)) connected++;
    else unconnected++;
  }
  return { connected, unconnected };
}

// ———————————————————————————————————————————— 动物能力

function venomTargets(g: GameState, pi: number): number[] {
  const p = g.players[pi];
  return g.players.map((_, i) => i).filter((i) => i !== pi && g.players[i].appeal > p.appeal && !has(g.players[i], 's225'));
}

/** 吸引力 / 保护点数最高的对手（同分取行动顺序靠前的） */
function leader(g: GameState, pi: number, key: 'appeal' | 'cp'): number | null {
  const n = g.players.length;
  let best: number | null = null;
  for (let k = 1; k < n; k++) {
    const i = (pi + k) % n;
    if (best === null || g.players[i][key] > g.players[best][key]) best = i;
  }
  return best;
}

function resolveAbility(g: GameState, pi: number, ab: Ability, uid: number) {
  const p = g.players[pi];
  const name = abilityName(ab);
  switch (ab.k) {
    case 'sprint':
      drawToHand(g, pi, ab.n);
      log(g, pi, `${name}：抽 ${ab.n} 张牌`);
      break;
    case 'hunter': {
      const cards = drawDeck(g, ab.n);
      if (cards.length) pushKeepAnimal(g, pi, cards, name);
      break;
    }
    case 'perception': {
      const cards = drawDeck(g, ab.n);
      const k = Math.min(ab.keep, cards.length);
      if (k) push(g, { k: 'pick', p: pi, purpose: 'keep', cards, min: k, max: k });
      break;
    }
    case 'snap':
      if (g.display.length) push(g, { k: 'display', p: pi, n: ab.n, any: true, deck: false, reason: name });
      break;
    case 'boost':
    case 'actionNow':
    case 'determination':
    case 'clever':
    case 'hypnosis':
      resolvePost(g, pi, ab);
      break;
    case 'multiplier':
      (p.tokens[ab.action] ??= {}).mult = 1;
      log(g, pi, `${name}：在行动卡上放 1 个倍增标记`);
      break;
    case 'pack':
      gainLog(g, pi, name, { appeal: iconCounts(p).predator });
      break;
    case 'iconic': {
      const n = g.players.reduce((s, o) => s + iconCounts(o)[ab.cont], 0);
      gainLog(g, pi, name, { appeal: Math.min(8, n) });
      break;
    }
    case 'pouch':
      if (p.hand.length) push(g, { k: 'pick', p: pi, purpose: 'pouch', cards: [], min: 0, max: ab.n, under: String(uid) });
      break;
    case 'sunbathe':
      if (p.hand.length) push(g, { k: 'pick', p: pi, purpose: 'sell', cards: [], min: 0, max: ab.n });
      break;
    case 'venom':
      for (const t of venomTargets(g, pi)) {
        const o = g.players[t];
        let left = ab.n;
        for (const a of o.actions) {
          if (left <= 0) break;
          const tk = (o.tokens[a] ??= {});
          if (tk.venom) continue;
          tk.venom = 1;
          left--;
        }
        log(g, t, `${p.name} 的${name}：获得 ${ab.n} 个毒液标记`);
      }
      break;
    case 'constrict':
      g.players.forEach((o, t) => {
        if (t === pi || has(o, 's225')) return;
        let n = (o.appeal > p.appeal ? 1 : 0) + (o.cp > p.cp ? 1 : 0);
        if (!n) return;
        const got = n;
        for (let k = o.actions.length - 1; k >= 0 && n > 0; k--) {
          const tk = (o.tokens[o.actions[k]] ??= {});
          if (tk.constrict) continue;
          tk.constrict = 1;
          n--;
        }
        log(g, t, `${p.name} 的${name}：获得 ${got} 个绞杀标记`);
      });
      break;
    case 'jump':
      advanceBreak(g, ab.n);
      gainLog(g, pi, `${name}：休息标记前进 ${ab.n} 格`, { money: ab.n });
      break;
    case 'dig':
      push(g, { k: 'dig', p: pi, left: ab.n });
      break;
    case 'posture':
      placeFree(g, pi, ['kiosk', 'pavilion'], `${name}：免费建造售货亭或凉亭`, ab.n);
      break;
    case 'resist': {
      const cards = g.scoringPile.splice(0, 2);
      if (cards.length) push(g, { k: 'pick', p: pi, purpose: 'scoring', cards, min: 1, max: 1 });
      break;
    }
    case 'assert':
      if (g.baseUnused.length) pushChoose(g, pi, `${name}：可以把 1 个没用到的基础保护项目加入手牌`, [...g.baseUnused.map((id) => ({ k: 'project', id }) as Opt), { k: 'none' }]);
      break;
    case 'dominance':
      if (g.baseUnused.includes('p108'))
        pushChoose(g, pi, `${name}：可以把“灵长类”基础保护项目加入手牌`, [
          { k: 'project', id: 'p108' },
          { k: 'none' },
        ]);
      break;
    case 'scavenge': {
      if (!g.discard.length) break;
      shuffle(g, g.discard);
      const cards = g.discard.splice(0, ab.n);
      g.reveal++;
      push(g, { k: 'pick', p: pi, purpose: 'keep', cards, min: 1, max: 1 });
      break;
    }
    case 'inventive':
      gainLog(g, pi, name, { x: ab.n });
      break;
    case 'inventiveBear': {
      const n = g.players.reduce((s, o) => s + iconCounts(o).bear, 0);
      gainLog(g, pi, name, { x: Math.min(3, n) });
      break;
    }
    case 'inventivePrimate': {
      const pr = iconCounts(p).primate;
      gainLog(g, pi, name, { x: pr >= 5 ? 3 : pr >= 3 ? 2 : pr >= 1 ? 1 : 0 });
      break;
    }
    case 'fullThroated':
      gainLog(g, pi, name, { worker: 1 });
      break;
    case 'flock':
      break;
    case 'sponsorMagnet': {
      const got = g.display.filter((id) => card(id).kind === 'sponsor');
      if (!got.length) break;
      g.display = g.display.filter((id) => card(id).kind !== 'sponsor');
      p.hand.push(...got);
      refillDisplay(g);
      log(g, pi, `${name}：拿走展示区的 ${got.length} 张赞助卡`);
      break;
    }
    case 'pilfer': {
      const targets = new Set<number>();
      const a = leader(g, pi, 'appeal');
      if (a !== null) targets.add(a);
      if (ab.n > 1) {
        const c = leader(g, pi, 'cp');
        if (c !== null) targets.add(c);
      }
      for (const t of targets) {
        const o = g.players[t];
        if (has(o, 's225')) continue;
        const opts: Opt[] = [];
        if (o.hand.length) opts.push({ k: 'pilfer', thief: pi, give: 'card' });
        if (o.money > 0) opts.push({ k: 'pilfer', thief: pi, give: 'money' });
        pushChoose(g, t, `${p.name} 的${name}：给 1 张随机手牌还是 5 元？`, opts);
      }
      break;
    }
    case 'peacock':
      placeFree(g, pi, ['aviary'], `${name}：可以免费建造 1 座大型鸟舍`, 1, true);
      break;
    case 'petting':
      gainLog(g, pi, name, { appeal: 3 * iconCounts(p).petting });
      break;
  }
}

function resolvePost(g: GameState, pi: number, ab: Ability, except?: ActionId) {
  const p = g.players[pi];
  const name = abilityName(ab);
  switch (ab.k) {
    case 'boost':
      pushChoose(g, pi, `${name}：可以把这张行动卡放到 1 号位或 5 号位`, [
        { k: 'slot', action: ab.action, to: 0 },
        { k: 'slot', action: ab.action, to: 4 },
        { k: 'none' },
      ]);
      break;
    case 'clever':
      pushChoose(g, pi, `${name}：可以把任一行动卡放到 1 号位`, [...slotOpts(p, 0), { k: 'none' }]);
      break;
    case 'actionNow':
      push(g, { k: 'extra', p: pi, only: ab.action, except: null, reason: `${name}：可以执行这个行动` });
      break;
    case 'determination':
      push(g, { k: 'extra', p: pi, only: null, except: except ?? null, reason: `${name}：可以再执行 1 个其他行动` });
      break;
    case 'hypnosis': {
      const t = leader(g, pi, 'appeal');
      if (t === null || has(g.players[t], 's225')) break;
      const o = g.players[t];
      const opts: Opt[] = o.actions.slice(0, ab.n).map((a) => ({ k: 'hypno', target: t, action: a }) as Opt);
      pushChoose(g, pi, `${name}：可以执行 ${o.name} 1–${ab.n} 号位上的 1 张行动卡`, [...opts, { k: 'none' }]);
      break;
    }
    default:
      break;
  }
}

// ———————————————————————————————————————————— 放置奖励、地图左侧奖励、奖励板块

function resolveBonus(g: GameState, pi: number, bonus: BonusId, border: boolean) {
  const p = g.players[pi];
  const why = '放置奖励';
  switch (bonus) {
    case 'x':
      gainLog(g, pi, why, { x: 1 });
      break;
    case 'card':
      push(g, { k: 'display', p: pi, n: 1, any: false, deck: true, reason: `${why}：从声望范围内或牌库拿 1 张牌` });
      break;
    case 'money5':
      gainLog(g, pi, why, { money: 5 });
      break;
    case 'money10':
      gainLog(g, pi, why, { money: 10 });
      break;
    case 'money2':
      gainLog(g, pi, why, { money: 2 });
      break;
    case 'rep1':
      gainLog(g, pi, why, { rep: 1 });
      break;
    case 'rep2':
      gainLog(g, pi, why, { rep: 2 });
      break;
    case 'slot1':
      pushChoose(g, pi, `${why}：可以把任一行动卡放到 1 号位`, [...slotOpts(p, 0), { k: 'none' }]);
      break;
    case 'worker':
      gainLog(g, pi, why, { worker: 1 });
      break;
    case 'partner':
      pushChoose(g, pi, `${why}：结交 1 个合作动物园`, partnerOpts(p));
      break;
    case 'sponsor':
      if (p.hand.some((id) => card(id).kind === 'sponsor')) push(g, { k: 'sponsorPay', p: pi, reason: `${why}：支付等级数的钱打出 1 张赞助卡` });
      break;
    case 'mult':
      pushChoose(
        g,
        pi,
        `${why}：在 1 张行动卡上放倍增标记`,
        ALL_ACTIONS.map((a) => ({ k: 'mult', action: a }) as Opt),
      );
      break;
    case 'uni':
      pushChoose(g, pi, `${why}：拿 1 所大学`, uniOpts(p));
      break;
    case 'kiosk':
      placeFree(g, pi, ['kiosk'], `${why}：免费建造 1 个售货亭`);
      break;
  }
  if (border && has(p, 's221')) {
    const kinds = [...new Set(mapOf(p).cells.map((c) => c.bonus).filter((b): b is BonusId => !!b))];
    pushChoose(
      g,
      pi,
      `${sponsor('s221').name}：额外获得 1 个任意的放置奖励`,
      kinds.map((b) => ({ k: 'bonus', bonus: b }) as Opt),
    );
  }
}

function resolveLeft(g: GameState, pi: number, id: LeftBonusId) {
  const p = g.players[pi];
  const why = `地图奖励（${LEFT_INFO[id].label}）`;
  switch (id) {
    case 'draw':
      drawToHand(g, pi, 1);
      log(g, pi, why);
      break;
    case 'enc2':
      placeFree(g, pi, ['E2'], why);
      break;
    case 'money5':
      gainLog(g, pi, '地图奖励', { money: 5 });
      break;
    case 'cp1':
      gainLog(g, pi, '地图奖励', { cp: 1 });
      break;
    case 'sponsor':
      if (p.hand.some((c) => card(c).kind === 'sponsor')) push(g, { k: 'sponsorPay', p: pi, reason: why });
      break;
    case 'worker':
      gainLog(g, pi, '地图奖励', { worker: 1 });
      break;
    case 'money12':
      gainLog(g, pi, '地图奖励', { money: 12 });
      break;
    case 'x3':
      gainLog(g, pi, '地图奖励', { x: 3 });
      break;
    case 'rep2':
      gainLog(g, pi, '地图奖励', { rep: 2 });
      break;
    case 'extraAction':
      attachPost(g, pi, { t: 'extraAction' });
      break;
    case 'uni':
      pushChoose(g, pi, why, uniOpts(p));
      break;
    case 'special':
      placeFree(
        g,
        pi,
        ['reptile', 'aviary'].filter((t) => !p.buildings.some((b) => b.type === t)),
        why,
        1,
        true,
      );
      break;
    case 'slot1x2':
      for (let k = 0; k < 2; k++) push(g, { k: 'choose', p: pi, reason: `${why}（${2 - k}/2）`, opts: [...slotOpts(p, 0), { k: 'none' }] });
      break;
    case 'pouch2':
      if (p.hand.length) push(g, { k: 'pick', p: pi, purpose: 'pouch', cards: [], min: 0, max: 2, under: 'map' });
      break;
    case 'partner':
      pushChoose(g, pi, why, partnerOpts(p));
      break;
  }
}

export function tileFx(id: string): Fx[] {
  return [{ t: 'tile', id }];
}

function resolveTile(g: GameState, pi: number, id: string) {
  const p = g.players[pi];
  const why = tile(id).name;
  switch (id) {
    case 't_money':
      gainLog(g, pi, why, { money: 10 });
      break;
    case 't_rep':
      gainLog(g, pi, why, { rep: 2 });
      break;
    case 't_x':
      gainLog(g, pi, why, { x: 3 });
      break;
    case 't_enclosure':
      placeFree(g, pi, ['E3'], `${why}：免费建造 1 座 3 格标准围栏`);
      break;
    case 't_cards':
      push(g, { k: 'display', p: pi, n: 3, any: false, deck: true, reason: `${why}：从声望范围内或牌库拿牌` });
      break;
    case 't_mult':
      pushChoose(
        g,
        pi,
        `${why}：在 1 张行动卡上放倍增标记`,
        ALL_ACTIONS.map((a) => ({ k: 'mult', action: a }) as Opt),
      );
      break;
    case 't_uni':
      pushChoose(g, pi, why, uniOpts(p));
      break;
    case 't_partner':
      pushChoose(g, pi, why, partnerOpts(p));
      break;
    case 't_ignore':
      p.ignoreTokens++;
      log(g, pi, `${why}：下次打出动物时可以忽略最多 3 个条件`);
      break;
  }
}

// ———————————————————————————————————————————— 结算入口

export function resolveFx(g: GameState, pi: number, fx: Fx) {
  switch (fx.t) {
    case 'ability':
      resolveAbility(g, pi, fx.ab, fx.uid);
      break;
    case 'trigger':
      resolveTrigger(g, pi, fx.sponsor, fx.icon);
      break;
    case 'sponsor':
      sponsorNow(g, pi, fx.id);
      break;
    case 'bonus':
      resolveBonus(g, pi, fx.bonus, fx.border);
      break;
    case 'left':
      resolveLeft(g, pi, fx.id);
      break;
    case 'hills': {
      const c = revealUntil(g, (id) => card(id).kind === 'sponsor');
      if (c) {
        g.players[pi].hand.push(c);
        log(g, pi, `好莱坞山：翻到赞助卡 ${card(c).name}，加入手牌`);
      }
      break;
    }
    case 'post':
      resolvePost(g, pi, fx.ab, fx.except);
      break;
    case 'extraAction':
      push(g, { k: 'extra', p: pi, only: null, except: null, reason: '地图奖励：再执行 1 个行动' });
      break;
    case 'gain':
      gainLog(g, pi, fx.why, fx.gain);
      break;
    case 'tile':
      resolveTile(g, pi, fx.id);
      break;
  }
}

// ———————————————————————————————————————————— 休息收入

export function breakIncome(g: GameState, pi: number): { total: number; parts: { label: string; money: number }[] } {
  const p = g.players[pi];
  const map = mapOf(p);
  const ic = iconCounts(p);
  const parts: { label: string; money: number }[] = [{ label: '吸引力', money: appealIncome(p.appeal) }];
  const at = (i: number) => p.buildings.find((b) => b.cells.includes(i));
  let kiosk = 0;
  const kiosks = p.buildings.filter((b) => b.type === 'kiosk');
  for (const b of kiosks) {
    const adj = new Set<number>();
    for (const n of map.cells[b.cells[0]].nbrs) {
      const o = at(n);
      if (o && o.type !== 'kiosk') adj.add(o.uid);
    }
    kiosk += adj.size;
  }
  if (kiosk) parts.push({ label: '售货亭', money: kiosk });
  const kCells = map.cells.filter((c) => c.bonus === 'kiosk');
  if (kCells.length && kiosks.length) {
    const covered = coveredCells(p);
    if (kCells.every((c) => covered.has(c.i))) parts.push({ label: '冰淇淋店', money: kiosks.length });
  }
  const rest = featureCells(map, 'restaurant');
  if (rest.length) {
    const covered = coveredCells(p);
    const n = map.cells.filter((c) => covered.has(c.i) && c.nbrs.some((x) => rest.includes(x))).length;
    if (n) parts.push({ label: '公园餐厅', money: n });
  }
  const left = map.left;
  const uncovered = left.map((_, i) => i).filter((i) => !p.mapTokens.includes(i));
  for (const i of uncovered) if (left[i].recurring && left[i].id === 'money5') parts.push({ label: '地图奖励', money: 5 });
  for (const id of p.sponsors) {
    const name = sponsor(id).name;
    if (id === 's220') parts.push({ label: name, money: 3 });
    const sp: Record<string, Icon> = { s231: 'primate', s232: 'reptile', s233: 'bird', s234: 'predator', s235: 'herbivore' };
    if (sp[id]) {
      const n = ic[sp[id]];
      const m = n >= 5 ? 9 : n >= 3 ? 6 : n >= 1 ? 3 : 0;
      if (m) parts.push({ label: name, money: m });
    }
    if (id === 's257') {
      const b = p.buildings.find((x) => x.type === 's257');
      if (b) {
        const adj = new Set<number>();
        for (const c of b.cells)
          for (const n of map.cells[c].nbrs) {
            const o = at(n);
            if (!o || o.uid === b.uid) continue;
            if (buildingDef(o.type).kind === 'enclosure' && !o.animals.length) continue;
            adj.add(o.uid);
          }
        if (adj.size) parts.push({ label: name, money: 2 * adj.size });
      }
    }
  }
  return { total: parts.reduce((s, x) => s + x.money, 0), parts };
}

/** 休息时需要单独结算的收入（地图左侧露出的紫色奖励、部分赞助卡） */
export function recurringFx(g: GameState, pi: number): Fx[] {
  const p = g.players[pi];
  const left = mapOf(p).left;
  const out: Fx[] = [];
  left.forEach((lb, i) => {
    if (lb.recurring && lb.id !== 'money5' && !p.mapTokens.includes(i)) out.push({ t: 'left', id: lb.id });
  });
  for (const id of p.sponsors) {
    if (id === 's201') out.push({ t: 'sponsor', id: 's201' });
    if (id === 's206') out.push({ t: 'gain', gain: { cp: 1 }, why: `${sponsor(id).name}（收入）` });
    if (id === 's209') out.push({ t: 'gain', gain: { x: 1 }, why: `${sponsor(id).name}（收入）` });
  }
  return out;
}

// ———————————————————————————————————————————— 终局计分

/** 终局计分卡对应的数值（界面显示进度用） */
export function scoringMetric(g: GameState, pi: number, id: string): number {
  const p = g.players[pi];
  const ic = iconCounts(p);
  switch (id) {
    case 'e001':
      return largeCount(p);
    case 'e002':
      return smallCount(p);
    case 'e003':
      return ic.science;
    case 'e004':
      return scoringCp(g, pi, id);
    case 'e005':
      return p.supported.length;
    case 'e006':
      return emptyBuildable(p);
    case 'e007':
      return p.rep;
    case 'e008':
      return p.sponsors.length;
    case 'e009':
      return scoringCp(g, pi, id);
    case 'e010':
      return ic.rock;
    case 'e011':
      return ic.water;
  }
  return 0;
}

export function scoringCp(g: GameState, pi: number, id: string): number {
  const p = g.players[pi];
  if (id === 'e004') {
    return (
      (terrainConnection(p, 'water').unconnected === 0 ? 1 : 0) +
      (terrainConnection(p, 'rock').unconnected === 0 ? 1 : 0) +
      (allBorderCovered(p) ? 1 : 0) +
      (mapFullyCovered(p) ? 1 : 0)
    );
  }
  if (id === 'e009') {
    const n = g.players.length;
    const mine = iconCounts(p);
    const other = n > 1 ? iconCounts(g.players[(pi - 1 + n) % n]) : null;
    const more = CATEGORIES.filter((c) => mine[c] > (other ? other[c] : 0)).length;
    return Math.min(4, more);
  }
  const s = SCORING_CARDS[id];
  const v = scoringMetric(g, pi, id);
  let cp = 0;
  for (const [need, c] of s.tiers) if (v >= need) cp = c;
  return cp;
}

export function endgameBreakdown(g: GameState, pi: number): { label: string; cp: number; appeal?: number }[] {
  const p = g.players[pi];
  const ic = iconCounts(p);
  const out: { label: string; cp: number; appeal?: number }[] = [];
  for (const id of p.scoring) out.push({ label: SCORING_CARDS[id].name, cp: scoringCp(g, pi, id) });
  const cp = (id: string, v: number) => v && out.push({ label: sponsor(id).name, cp: v });
  const ap = (id: string, v: number) => v && out.push({ label: sponsor(id).name, cp: 0, appeal: v });
  const water = terrainConnection(p, 'water');
  const rock = terrainConnection(p, 'rock');
  for (const id of p.sponsors) {
    switch (id) {
      case 's201':
        cp(id, ic.science >= 6 ? 2 : ic.science >= 3 ? 1 : 0);
        break;
      case 's203':
      case 's209':
        cp(id, p.unis.length >= 3 ? 1 : 0);
        break;
      case 's208':
      case 's261':
        cp(id, kinds(p, 'category') >= 5 ? 1 : 0);
        break;
      case 's210':
        cp(id, p.buildings.filter((b) => b.type === 'kiosk').length >= 5 ? 1 : 0);
        break;
      case 's211':
        cp(id, p.buildings.filter((b) => b.type === 'E1' && b.animals.length).length >= 5 ? 1 : 0);
        break;
      case 's214':
        ap(id, p.x);
        break;
      case 's215':
      case 's218':
        cp(id, p.supported.length >= 5 ? 1 : 0);
        break;
      case 's216':
      case 's220':
        cp(id, p.rep >= 9 ? 1 : 0);
        break;
      case 's217':
      case 's257':
        ap(id, mapFullyCovered(p) ? 5 : 0);
        break;
      case 's219':
        ap(id, 2 * Math.min(3, ic.water + ic.rock));
        break;
      case 's221':
        cp(id, allBorderCovered(p) ? 1 : 0);
        break;
      case 's225':
      case 's226':
        cp(id, kinds(p, 'continent') >= 5 ? 1 : 0);
        break;
      case 's241':
        cp(id, water.unconnected === 0 ? 1 : 0);
        break;
      case 's242':
        cp(id, rock.unconnected === 0 ? 1 : 0);
        break;
      case 's243':
        cp(id, ic.herbivore >= 6 ? 1 : 0);
        break;
      case 's244':
        cp(id, ic.bird >= 6 ? 1 : 0);
        break;
      case 's245':
        cp(id, ic.water >= 6 ? 1 : 0);
        break;
      case 's246':
        cp(id, ic.rock >= 6 ? 1 : 0);
        break;
      case 's247':
        cp(id, ic.primate >= 6 ? 1 : 0);
        break;
      case 's251':
        cp(id, ic.bear >= 6 ? 2 : ic.bear >= 3 ? 1 : 0);
        break;
      case 's258':
        cp(id, Math.floor(water.unconnected / 2));
        break;
      case 's259':
        cp(id, Math.floor(rock.unconnected / 2));
        break;
      case 's260':
        cp(id, Math.floor(emptyBuildable(p) / 6));
        break;
      case 's264':
        cp(id, Math.floor(bonusCells(p).unconnected / 2));
        break;
    }
  }
  return out;
}
