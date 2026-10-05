import { defineCards } from '../../registry';
import { cardDef, isUnplayable, upgradeCard } from '../../cards';
import { COST_X, UNPLAYABLE } from '../../types';
import { B, M, hit, hitAll, isType } from './helpers';

const C = 'colorless' as const;

defineCards([
  // ---------------------------------------------------------------- 无色·罕见
  {
    id: 'flash_of_steel', name: '闪光一击', color: C, type: 'attack', rarity: 'uncommon', cost: 0, target: 'enemy',
    dmg: [3, 6], text: '造成 {D} 点伤害。\n抽 1 张牌。', art: '⚡',
    play: (g, c, t) => {
      hit(g, c, t);
      g.draw(1);
    },
  },
  {
    id: 'swift_strike', name: '迅捷打击', color: C, type: 'attack', rarity: 'uncommon', cost: 0, target: 'enemy',
    dmg: [7, 10], text: '造成 {D} 点伤害。', art: '💨', tags: ['strike'],
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'discovery', name: '发现', color: C, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    exhaust: [true, false], text: '从 3 张随机牌中选择 1 张加入手牌，它本回合费用为 0。', art: '🧭',
    play: (g) => {
      const opts = g.randomCards(3, () => true);
      g.discover(opts, (x) => {
        x.costTurn = 0;
        g.addToHand(x);
      });
    },
  },
  {
    id: 'finesse', name: '妙手', color: C, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    blk: [2, 4], text: '获得 {B} 点格挡。\n抽 1 张牌。', art: '🪄',
    play: (g, c) => {
      g.block(B(g, c));
      g.draw(1);
    },
  },
  {
    id: 'good_instincts', name: '良好直觉', color: C, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    blk: [6, 9], text: '获得 {B} 点格挡。', art: '🦉',
    play: (g, c) => g.block(B(g, c)),
  },
  {
    id: 'panic_button', name: '恐慌按钮', color: C, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    blk: [30, 40], exhaust: true, text: '获得 {B} 点格挡。\n接下来 2 回合无法从卡牌获得格挡。', art: '🆘',
    play: (g, c) => {
      g.block(B(g, c));
      g.apply(g.player, 'no_block', 2, null);
    },
  },
  {
    id: 'madness', name: '疯狂', color: C, type: 'skill', rarity: 'uncommon', cost: [1, 0], target: 'self',
    exhaust: true, text: '使手牌中一张随机牌在本场战斗中费用变为 0。', art: '🤪',
    play: (g) => {
      const cands = g.hand.filter((x) => g.costOf(x) > 0 && !isUnplayable(x));
      if (cands.length) g.rng.pick(cands).costCombat = 0;
    },
  },
  {
    id: 'trip', name: '绊倒', color: C, type: 'skill', rarity: 'uncommon', cost: 0, target: 'enemy',
    text: ['给予 2 层易伤。', '给予所有敌人 2 层易伤。'], art: '🍌',
    play: (g, c, t) => {
      if (c.up) g.alive.forEach((e) => g.apply(e, 'vulnerable', 2));
      else g.apply(t, 'vulnerable', 2);
    },
  },
  {
    id: 'dark_shackles', name: '黑暗枷锁', color: C, type: 'skill', rarity: 'uncommon', cost: 0, target: 'enemy',
    mag: [9, 15], exhaust: true, text: '本回合敌人失去 {M} 点力量。', art: '⛓️',
    play: (g, c, t) => {
      if (t && g.apply(t, 'strength', -M(c))) g.apply(t, 'shackled', M(c), t);
    },
  },
  {
    id: 'deep_breath', name: '深呼吸', color: C, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    mag: [1, 2], text: '将弃牌堆洗入抽牌堆。\n抽 {M} 张牌。', art: '🌬️',
    play: (g, c) => {
      g.shuffleDiscardIntoDraw();
      g.draw(M(c));
    },
  },
  {
    id: 'enlightenment', name: '启示', color: C, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    text: ['本回合手牌中费用大于 1 的牌费用变为 1。', '本场战斗中手牌中费用大于 1 的牌费用变为 1。'], art: '💡',
    play: (g, c) => {
      for (const x of g.hand) {
        if (g.costOf(x) > 1 && !isUnplayable(x)) {
          if (c.up) x.costCombat = 1;
          else x.costTurn = 1;
        }
      }
    },
  },
  {
    id: 'jack_of_all_trades', name: '多面手', color: C, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    mag: [1, 2], exhaust: true, text: '将 {M} 张随机无色牌加入手牌。', art: '🃏',
    play: (g, c) => g.randomCards(M(c), (id) => id !== 'jack_of_all_trades', 'colorless').forEach((x) => g.addToHand(x)),
  },
  {
    id: 'mind_blast', name: '心灵冲击', color: C, type: 'attack', rarity: 'uncommon', cost: [2, 1], target: 'enemy',
    innate: true, text: '造成等同于抽牌堆牌数的伤害（{D}）。', art: '🧠',
    dmgFn: (g) => g?.drawPile.length ?? 0,
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'purity', name: '净化', color: C, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    mag: [3, 5], exhaust: true, text: '消耗至多 {M} 张手牌。', art: '🕊️',
    play: (g, c) =>
      g.chooseHand({ title: `消耗至多 ${M(c)} 张牌`, min: 0, max: M(c) }, (s) => s.forEach((x) => g.exhaustCard(x))),
  },
  {
    id: 'thinking_ahead', name: '深谋远虑', color: C, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    exhaust: [true, false], text: '抽 2 张牌。\n将一张手牌放到抽牌堆顶部。', art: '🤔',
    play: (g) => {
      g.draw(2);
      g.chooseHand({ title: '选择一张牌放到抽牌堆顶部', min: 1, max: 1 }, (s) => s.forEach((x) => g.moveTo(x, 'drawTop')));
    },
  },
  {
    id: 'bandage_up', name: '包扎', color: C, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    mag: [4, 6], exhaust: true, text: '回复 {M} 点生命。', art: '🩹', tags: ['healing'],
    play: (g, c) => g.heal(g.player, M(c)),
  },
  {
    id: 'blind', name: '致盲', color: C, type: 'skill', rarity: 'uncommon', cost: 0, target: 'enemy',
    text: ['给予 2 层虚弱。', '给予所有敌人 2 层虚弱。'], art: '🙈',
    play: (g, c, t) => {
      if (c.up) g.alive.forEach((e) => g.apply(e, 'weak', 2));
      else g.apply(t, 'weak', 2);
    },
  },
  {
    id: 'dramatic_entrance', name: '闪亮登场', color: C, type: 'attack', rarity: 'uncommon', cost: 0, target: 'all',
    dmg: [8, 12], innate: true, exhaust: true, text: '对所有敌人造成 {D} 点伤害。', art: '🎭',
    play: (g, c) => hitAll(g, c),
  },
  {
    id: 'impatience', name: '急躁', color: C, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    mag: [2, 3], text: '若手牌中没有攻击牌，抽 {M} 张牌。', art: '😤',
    play: (g, c) => {
      if (!g.hand.some((x) => isType(x, 'attack'))) g.draw(M(c));
    },
  },
  // ---------------------------------------------------------------- 无色·稀有
  {
    id: 'apotheosis', name: '神化', color: C, type: 'skill', rarity: 'rare', cost: [2, 1], target: 'self',
    exhaust: true, text: '升级本场战斗中你的所有牌。', art: '😇',
    play: (g) => {
      for (const x of [...g.allCards(), ...g.exhaustPile]) upgradeCard(x);
    },
  },
  {
    id: 'hand_of_greed', name: '贪婪之手', color: C, type: 'attack', rarity: 'rare', cost: 2, target: 'enemy',
    dmg: [20, 25], mag: [20, 25], text: '造成 {D} 点伤害。\n若击杀敌人，获得 {M} 金币。', art: '🤑',
    play: (g, c, t) => {
      if (hit(g, c, t) && t && !t.minion) g.run.gainGold(M(c));
    },
  },
  {
    id: 'master_of_strategy', name: '战略大师', color: C, type: 'skill', rarity: 'rare', cost: 0, target: 'self',
    mag: [3, 4], exhaust: true, text: '抽 {M} 张牌。', art: '♛',
    play: (g, c) => g.draw(M(c)),
  },
  {
    id: 'secret_weapon', name: '秘密武器', color: C, type: 'skill', rarity: 'rare', cost: 0, target: 'self',
    exhaust: [true, false], text: '从抽牌堆中选择一张攻击牌放入手牌。', art: '🗝️',
    play: (g) =>
      g.chooseCards(
        { title: '选择一张攻击牌', cards: g.drawPile.filter((x) => isType(x, 'attack')), min: 1, max: 1 },
        (s) => s.forEach((x) => g.moveTo(x, 'hand')),
      ),
  },
  {
    id: 'secret_technique', name: '秘密技巧', color: C, type: 'skill', rarity: 'rare', cost: 0, target: 'self',
    exhaust: [true, false], text: '从抽牌堆中选择一张技能牌放入手牌。', art: '📖',
    play: (g) =>
      g.chooseCards(
        { title: '选择一张技能牌', cards: g.drawPile.filter((x) => isType(x, 'skill')), min: 1, max: 1 },
        (s) => s.forEach((x) => g.moveTo(x, 'hand')),
      ),
  },
  {
    id: 'violence', name: '暴力', color: C, type: 'skill', rarity: 'rare', cost: 0, target: 'self',
    mag: [3, 4], exhaust: true, text: '将抽牌堆中 {M} 张随机攻击牌放入手牌。', art: '💢',
    play: (g, c) => {
      const atks = g.rng.sample(g.drawPile.filter((x) => isType(x, 'attack')), M(c));
      atks.forEach((x) => g.moveTo(x, 'hand'));
    },
  },
  {
    id: 'transmutation', name: '嬗变', color: C, type: 'skill', rarity: 'rare', cost: COST_X, target: 'self',
    exhaust: true, text: ['将 X 张随机无色牌加入手牌，它们本回合费用为 0。', '将 X 张随机无色牌+加入手牌，它们本回合费用为 0。'], art: '🔁',
    play: (g, c) => {
      for (const x of g.randomCards(g.x, (id) => id !== 'transmutation', 'colorless')) {
        if (c.up) upgradeCard(x);
        x.costTurn = 0;
        g.addToHand(x);
      }
    },
  },
  {
    id: 'metamorphosis', name: '蜕变', color: C, type: 'skill', rarity: 'rare', cost: 2, target: 'self',
    mag: [3, 5], exhaust: true, text: '将 {M} 张随机攻击牌洗入抽牌堆，它们本场战斗费用为 0。', art: '🦋',
    play: (g, c) => {
      for (const x of g.randomCards(M(c), (id) => cardDef(id).type === 'attack')) {
        x.costCombat = 0;
        g.addToDraw(x);
      }
    },
  },
  {
    id: 'chrysalis', name: '虫茧', color: C, type: 'skill', rarity: 'rare', cost: 2, target: 'self',
    mag: [3, 5], exhaust: true, text: '将 {M} 张随机技能牌洗入抽牌堆，它们本场战斗费用为 0。', art: '🐛',
    play: (g, c) => {
      for (const x of g.randomCards(M(c), (id) => cardDef(id).type === 'skill')) {
        x.costCombat = 0;
        g.addToDraw(x);
      }
    },
  },
  {
    id: 'ritual_dagger', name: '仪式匕首', color: C, type: 'attack', rarity: 'special', cost: 1, target: 'enemy',
    mag: [3, 5], exhaust: true, noPool: true, text: '造成 {D} 点伤害。\n若击杀敌人，这张牌的伤害永久提高 {M}。', art: '🗡️',
    dmgFn: (_g, c) => 15 + c.misc,
    play: (g, c, t) => {
      if (hit(g, c, t) && t && !t.minion) {
        c.misc += M(c);
        const deck = g.run.deck.find((x) => x.uid === c.deckUid);
        if (deck) deck.misc += M(c);
      }
    },
  },
]);

// ---------------------------------------------------------------- 诅咒
const K = 'curse' as const;
defineCards([
  {
    id: 'ascenders_bane', name: '攀登者之祸', color: K, type: 'curse', rarity: 'curse', cost: UNPLAYABLE, target: 'none',
    ethereal: true, noPool: true, text: '不能被打出。\n无法从牌组中移除。', art: '⛓️',
  },
  {
    id: 'regret', name: '悔恨', color: K, type: 'curse', rarity: 'curse', cost: UNPLAYABLE, target: 'none',
    text: '不能被打出。\n回合结束时，手牌中每有一张牌，失去 1 点生命。', art: '😔',
    onTurnEndInHand: (g) => {
      g.loseHp(g.player, g.hand.length);
    },
  },
  {
    id: 'pain', name: '疼痛', color: K, type: 'curse', rarity: 'curse', cost: UNPLAYABLE, target: 'none',
    text: '不能被打出。\n这张牌在手牌中时，你每打出一张牌，失去 1 点生命。', art: '🤕',
    onOtherPlayed: (g) => {
      g.loseHp(g.player, 1);
    },
  },
  {
    id: 'parasite', name: '寄生虫', color: K, type: 'curse', rarity: 'curse', cost: UNPLAYABLE, target: 'none',
    text: '不能被打出。\n若从牌组中移除，失去 3 点最大生命。', art: '🪱',
    onRemove: (run) => run.loseMaxHp(3),
  },
  {
    id: 'injury', name: '受伤', color: K, type: 'curse', rarity: 'curse', cost: UNPLAYABLE, target: 'none',
    text: '不能被打出。', art: '🩼',
  },
  {
    id: 'decay', name: '腐朽', color: K, type: 'curse', rarity: 'curse', cost: UNPLAYABLE, target: 'none',
    text: '不能被打出。\n回合结束时，受到 2 点伤害。', art: '🍂',
    onTurnEndInHand: (g) => {
      g.thorns(g.player, 2, null);
    },
  },
  {
    id: 'shame', name: '羞耻', color: K, type: 'curse', rarity: 'curse', cost: UNPLAYABLE, target: 'none',
    text: '不能被打出。\n回合结束时，获得 1 层脆弱。', art: '😳',
    onTurnEndInHand: (g) => {
      g.apply(g.player, 'frail', 1, null);
    },
  },
  {
    id: 'doubt', name: '疑虑', color: K, type: 'curse', rarity: 'curse', cost: UNPLAYABLE, target: 'none',
    text: '不能被打出。\n回合结束时，获得 1 层虚弱。', art: '🤨',
    onTurnEndInHand: (g) => {
      g.apply(g.player, 'weak', 1, null);
    },
  },
  {
    id: 'clumsy', name: '笨拙', color: K, type: 'curse', rarity: 'curse', cost: UNPLAYABLE, target: 'none',
    ethereal: true, text: '不能被打出。', art: '🤦',
  },
  {
    id: 'writhe', name: '苦恼', color: K, type: 'curse', rarity: 'curse', cost: UNPLAYABLE, target: 'none',
    innate: true, text: '不能被打出。', art: '😖',
  },
  {
    id: 'normality', name: '凡庸', color: K, type: 'curse', rarity: 'curse', cost: UNPLAYABLE, target: 'none',
    text: '不能被打出。\n这张牌在手牌中时，你每回合最多打出 3 张牌。', art: '📏',
  },
]);

// ---------------------------------------------------------------- 状态
const ST = 'status' as const;
defineCards([
  {
    id: 'wound', name: '伤口', color: ST, type: 'status', rarity: 'status', cost: UNPLAYABLE, target: 'none',
    noPool: true, text: '不能被打出。', art: '🩸',
  },
  {
    id: 'dazed', name: '晕眩', color: ST, type: 'status', rarity: 'status', cost: UNPLAYABLE, target: 'none',
    ethereal: true, noPool: true, text: '不能被打出。', art: '💫',
  },
  {
    id: 'burn', name: '灼伤', color: ST, type: 'status', rarity: 'status', cost: UNPLAYABLE, target: 'none',
    noPool: true, mag: [2, 4], text: ['不能被打出。\n回合结束时，受到 {M} 点伤害。', '不能被打出。\n回合结束时，受到 {M} 点伤害。'], art: '🔥',
    onTurnEndInHand: (g, c) => {
      g.thorns(g.player, M(c), null);
    },
  },
  {
    id: 'slimed', name: '黏液', color: ST, type: 'status', rarity: 'status', cost: 1, target: 'self',
    exhaust: true, noPool: true, text: '消耗。', art: '🟢',
    play: () => {},
  },
  {
    id: 'void', name: '虚空', color: ST, type: 'status', rarity: 'status', cost: UNPLAYABLE, target: 'none',
    ethereal: true, noPool: true, text: '不能被打出。\n抽到这张牌时，失去 1 点能量。', art: '🕳️',
    onDraw: (g) => g.gainEnergy(-1),
  },
  {
    id: 'infection', name: '感染', color: ST, type: 'status', rarity: 'status', cost: UNPLAYABLE, target: 'none',
    noPool: true, text: '不能被打出。\n回合结束时，失去 2 点生命。', art: '🦠',
    onTurnEndInHand: (g) => {
      g.loseHp(g.player, 2);
    },
  },
  {
    id: 'debris', name: '碎屑', color: ST, type: 'status', rarity: 'status', cost: 1, target: 'self',
    exhaust: true, noPool: true, text: '消耗。\n回合结束时若在手牌中，将其消耗。', art: '🪨',
    play: () => {},
    onTurnEndInHand: (g, c) => g.exhaustCard(c),
  },
]);
