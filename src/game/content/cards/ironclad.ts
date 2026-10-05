import { defineCards } from '../../registry';
import { canUpgrade, cardDef, upgradeCard, uv } from '../../cards';
import { COST_X } from '../../types';
import { B, D, M, hit, hitAll, hitRandom, isType } from './helpers';

const R = 'ironclad' as const;

defineCards([
  // ---------------------------------------------------------------- 基础
  {
    id: 'strike_r', name: '打击', color: R, type: 'attack', rarity: 'basic', cost: 1, target: 'enemy',
    dmg: [6, 9], text: '造成 {D} 点伤害。', art: '⚔️', tags: ['strike', 'starter'],
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'defend_r', name: '防御', color: R, type: 'skill', rarity: 'basic', cost: 1, target: 'self',
    blk: [5, 8], text: '获得 {B} 点格挡。', art: '🛡️', tags: ['starter'],
    play: (g, c) => g.block(B(g, c)),
  },
  {
    id: 'bash', name: '痛击', color: R, type: 'attack', rarity: 'basic', cost: 2, target: 'enemy',
    dmg: [8, 10], mag: [2, 3], text: '造成 {D} 点伤害。\n给予 {M} 层易伤。', art: '🔨',
    play: (g, c, t) => {
      hit(g, c, t);
      g.apply(t, 'vulnerable', M(c));
    },
  },
  // ---------------------------------------------------------------- 普通
  {
    id: 'anger', name: '愤怒', color: R, type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
    dmg: [6, 8], text: '造成 {D} 点伤害。\n将这张牌的一张复制品放入弃牌堆。', art: '😠',
    play: (g, c, t) => {
      hit(g, c, t);
      g.addToDiscard(c.id, c.up);
    },
  },
  {
    id: 'armaments', name: '武装', color: R, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    blk: 5, text: ['获得 {B} 点格挡。\n升级手牌中的一张牌。', '获得 {B} 点格挡。\n升级手牌中的所有牌。'], art: '🔧',
    play: (g, c) => {
      g.block(B(g, c));
      if (c.up) g.hand.forEach(upgradeCard);
      else g.chooseHand({ title: '选择一张牌升级', min: 1, max: 1, filter: canUpgrade }, (s) => s.forEach(upgradeCard));
    },
  },
  {
    id: 'body_slam', name: '全身撞击', color: R, type: 'attack', rarity: 'common', cost: [1, 0], target: 'enemy',
    text: '造成等同于你当前格挡值的伤害（{D}）。', art: '🐂',
    dmgFn: (g) => g?.player.block ?? 0,
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'clash', name: '交锋', color: R, type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
    dmg: [14, 18], text: '只有手牌中全是攻击牌时才能打出。\n造成 {D} 点伤害。', art: '🤺',
    canPlay: (g, c) => (g.hand.every((h) => h === c || isType(h, 'attack')) ? true : '手牌中有非攻击牌'),
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'cleave', name: '顺劈斩', color: R, type: 'attack', rarity: 'common', cost: 1, target: 'all',
    dmg: [8, 11], text: '对所有敌人造成 {D} 点伤害。', art: '🪓',
    play: (g, c) => hitAll(g, c),
  },
  {
    id: 'clothesline', name: '金刚臂', color: R, type: 'attack', rarity: 'common', cost: 2, target: 'enemy',
    dmg: [12, 14], mag: [2, 3], text: '造成 {D} 点伤害。\n给予 {M} 层虚弱。', art: '💪',
    play: (g, c, t) => {
      hit(g, c, t);
      g.apply(t, 'weak', M(c));
    },
  },
  {
    id: 'flex', name: '屈伸', color: R, type: 'skill', rarity: 'common', cost: 0, target: 'self',
    mag: [2, 4], text: '获得 {M} 点力量。\n回合结束时失去 {M} 点力量。', art: '🏋️',
    play: (g, c) => {
      g.apply(g.player, 'strength', M(c));
      g.apply(g.player, 'temp_strength', M(c));
    },
  },
  {
    id: 'havoc', name: '破灭', color: R, type: 'skill', rarity: 'common', cost: [1, 0], target: 'none',
    text: '打出你抽牌堆顶部的牌，然后将其消耗。', art: '🌪️',
    play: (g) => {
      if (!g.drawPile.length) g.shuffleDiscardIntoDraw();
      const top = g.drawPile[g.drawPile.length - 1];
      if (top) g.autoPlay(top, g.randomEnemy(), true);
    },
  },
  {
    id: 'headbutt', name: '头槌', color: R, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [9, 12], text: '造成 {D} 点伤害。\n将弃牌堆中的一张牌放到抽牌堆顶部。', art: '🐏',
    play: (g, c, t) => {
      hit(g, c, t);
      g.chooseCards({ title: '选择一张牌放到抽牌堆顶部', cards: [...g.discardPile], min: 1, max: 1 }, (s) =>
        s.forEach((x) => g.moveTo(x, 'drawTop')),
      );
    },
  },
  {
    id: 'heavy_blade', name: '重刃', color: R, type: 'attack', rarity: 'common', cost: 2, target: 'enemy',
    dmg: 14, mag: [3, 5], text: '造成 {D} 点伤害。\n力量对这张牌产生 {M} 倍效果。', art: '🗡️',
    dmgFn: (g, c) => 14 + (g ? (uv(cardDef(c).mag, c.up)! - 1) * g.pw(g.player, 'strength') : 0),
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'iron_wave', name: '铁斩波', color: R, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [5, 7], blk: [5, 7], text: '获得 {B} 点格挡。\n造成 {D} 点伤害。', art: '🌊',
    play: (g, c, t) => {
      g.block(B(g, c));
      hit(g, c, t);
    },
  },
  {
    id: 'perfected_strike', name: '完美打击', color: R, type: 'attack', rarity: 'common', cost: 2, target: 'enemy',
    mag: [2, 3], text: '造成 {D} 点伤害。\n你的每张「打击」使伤害提高 {M}。', art: '✨', tags: ['strike'],
    dmgFn: (g, c) => {
      const per = uv(cardDef(c).mag, c.up)!;
      const pool = g ? [...g.allCards(), ...g.exhaustPile] : [];
      return 6 + per * pool.filter((x) => cardDef(x).tags?.includes('strike')).length;
    },
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'pommel_strike', name: '剑柄打击', color: R, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [9, 10], mag: [1, 2], text: '造成 {D} 点伤害。\n抽 {M} 张牌。', art: '🔱', tags: ['strike'],
    play: (g, c, t) => {
      hit(g, c, t);
      g.draw(M(c));
    },
  },
  {
    id: 'shrug_it_off', name: '耸肩无视', color: R, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    blk: [8, 11], text: '获得 {B} 点格挡。\n抽 1 张牌。', art: '🤷',
    play: (g, c) => {
      g.block(B(g, c));
      g.draw(1);
    },
  },
  {
    id: 'sword_boomerang', name: '飞剑回旋镖', color: R, type: 'attack', rarity: 'common', cost: 1, target: 'all',
    dmg: 3, mag: [3, 4], text: '随机对敌人造成 {D} 点伤害 {M} 次。', art: '🪃',
    play: (g, c) => hitRandom(g, c, M(c)),
  },
  {
    id: 'thunderclap', name: '闪电霹雳', color: R, type: 'attack', rarity: 'common', cost: 1, target: 'all',
    dmg: [4, 7], text: '对所有敌人造成 {D} 点伤害，并给予 1 层易伤。', art: '⚡',
    play: (g, c) => {
      hitAll(g, c);
      for (const e of g.alive) g.apply(e, 'vulnerable', 1);
    },
  },
  {
    id: 'true_grit', name: '坚毅', color: R, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    blk: [7, 9], text: ['获得 {B} 点格挡。\n随机消耗一张手牌。', '获得 {B} 点格挡。\n消耗一张手牌。'], art: '🪨',
    play: (g, c) => {
      g.block(B(g, c));
      if (c.up) g.chooseHand({ title: '选择一张牌消耗', min: 1, max: 1 }, (s) => s.forEach((x) => g.exhaustCard(x)));
      else if (g.hand.length) g.exhaustCard(g.rng.pick(g.hand));
    },
  },
  {
    id: 'twin_strike', name: '双重打击', color: R, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [5, 7], text: '造成 {D} 点伤害两次。', art: '⚔️', tags: ['strike'],
    play: (g, c, t) => hit(g, c, t, 2),
  },
  {
    id: 'warcry', name: '战吼', color: R, type: 'skill', rarity: 'common', cost: 0, target: 'self',
    mag: [1, 2], exhaust: true, text: '抽 {M} 张牌。\n将一张手牌放到抽牌堆顶部。', art: '📣',
    play: (g, c) => {
      g.draw(M(c));
      g.chooseHand({ title: '选择一张牌放到抽牌堆顶部', min: 1, max: 1 }, (s) => s.forEach((x) => g.moveTo(x, 'drawTop')));
    },
  },
  {
    id: 'wild_strike', name: '狂野打击', color: R, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [12, 17], text: '造成 {D} 点伤害。\n将一张伤口洗入你的抽牌堆。', art: '🐺', tags: ['strike'],
    play: (g, c, t) => {
      hit(g, c, t);
      g.addToDraw('wound');
    },
  },
  // ---------------------------------------------------------------- 罕见
  {
    id: 'battle_trance', name: '战斗专注', color: R, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    mag: [3, 4], text: '抽 {M} 张牌。\n本回合你无法再抽牌。', art: '🧠',
    play: (g, c) => {
      g.draw(M(c));
      g.apply(g.player, 'no_draw', 1);
    },
  },
  {
    id: 'blood_for_blood', name: '以血还血', color: R, type: 'attack', rarity: 'uncommon', cost: [4, 3], target: 'enemy',
    dmg: [18, 22], text: '本场战斗中你每失去一次生命，这张牌的费用减少 1。\n造成 {D} 点伤害。', art: '🩸', tags: ['bloodcost'],
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'bloodletting', name: '放血', color: R, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    mag: [2, 3], text: '失去 3 点生命。\n获得 {M} 点能量。', art: '💉',
    play: (g, c) => {
      g.loseHp(g.player, 3, g.player);
      g.gainEnergy(M(c));
    },
  },
  {
    id: 'burning_pact', name: '燃烧契约', color: R, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [2, 3], text: '消耗一张手牌。\n抽 {M} 张牌。', art: '📜',
    play: (g, c) => {
      g.chooseHand({ title: '选择一张牌消耗', min: 1, max: 1 }, (s) => {
        s.forEach((x) => g.exhaustCard(x));
        g.draw(M(c));
      });
    },
  },
  {
    id: 'carnage', name: '残杀', color: R, type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy',
    dmg: [20, 28], ethereal: true, text: '造成 {D} 点伤害。', art: '🩸',
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'combust', name: '自燃', color: R, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [5, 7], text: '回合结束时，失去 1 点生命，并对所有敌人造成 {M} 点伤害。', art: '☄️',
    play: (g, c) => g.apply(g.player, 'combust', M(c)),
  },
  {
    id: 'dark_embrace', name: '黑暗之拥', color: R, type: 'power', rarity: 'uncommon', cost: [2, 1], target: 'self',
    text: '每当一张牌被消耗，抽 1 张牌。', art: '🌑',
    play: (g) => g.apply(g.player, 'dark_embrace', 1),
  },
  {
    id: 'disarm', name: '缴械', color: R, type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy',
    mag: [2, 3], exhaust: true, text: '敌人失去 {M} 点力量。', art: '🫳',
    play: (g, c, t) => g.apply(t, 'strength', -M(c)),
  },
  {
    id: 'dropkick', name: '飞踢', color: R, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    dmg: [5, 8], text: '造成 {D} 点伤害。\n若敌人有易伤，获得 1 点能量并抽 1 张牌。', art: '🦵',
    play: (g, c, t) => {
      const vul = g.has(t, 'vulnerable');
      hit(g, c, t);
      if (vul) {
        g.gainEnergy(1);
        g.draw(1);
      }
    },
  },
  {
    id: 'dual_wield', name: '双持', color: R, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [1, 2], text: '选择手牌中的一张攻击牌或能力牌，将它的 {M} 张复制品加入手牌。', art: '🤹',
    play: (g, c) => {
      g.chooseHand(
        { title: '选择一张牌复制', min: 1, max: 1, filter: (x) => isType(x, 'attack') || isType(x, 'power') },
        (s) => s.forEach((x) => g.addToHand(x.id, x.up, M(c))),
      );
    },
  },
  {
    id: 'entrench', name: '巩固', color: R, type: 'skill', rarity: 'uncommon', cost: [2, 1], target: 'self',
    text: '将你的格挡翻倍。', art: '🏰',
    play: (g) => g.gainBlock(g.player, g.player.block),
  },
  {
    id: 'evolve', name: '进化', color: R, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [1, 2], text: '每当你抽到一张状态牌，抽 {M} 张牌。', art: '🧬',
    play: (g, c) => g.apply(g.player, 'evolve', M(c)),
  },
  {
    id: 'feel_no_pain', name: '无惧疼痛', color: R, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [3, 4], text: '每当一张牌被消耗，获得 {M} 点格挡。', art: '🧘',
    play: (g, c) => g.apply(g.player, 'feel_no_pain', M(c)),
  },
  {
    id: 'fire_breathing', name: '火焰吐息', color: R, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [6, 10], text: '每当你抽到一张状态牌或诅咒牌，对所有敌人造成 {M} 点伤害。', art: '🐉',
    play: (g, c) => g.apply(g.player, 'fire_breathing', M(c)),
  },
  {
    id: 'flame_barrier', name: '火焰屏障', color: R, type: 'skill', rarity: 'uncommon', cost: 2, target: 'self',
    blk: [12, 16], mag: [4, 6], text: '获得 {B} 点格挡。\n本回合每当你受到攻击，对攻击者造成 {M} 点伤害。', art: '🔥',
    play: (g, c) => {
      g.block(B(g, c));
      g.apply(g.player, 'flame_barrier', M(c));
    },
  },
  {
    id: 'ghostly_armor', name: '幽灵铠甲', color: R, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    blk: [10, 13], ethereal: true, text: '获得 {B} 点格挡。', art: '👻',
    play: (g, c) => g.block(B(g, c)),
  },
  {
    id: 'hemokinesis', name: '御血术', color: R, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    dmg: [15, 20], text: '失去 2 点生命。\n造成 {D} 点伤害。', art: '🩸',
    play: (g, c, t) => {
      g.loseHp(g.player, 2, g.player);
      hit(g, c, t);
    },
  },
  {
    id: 'infernal_blade', name: '地狱之刃', color: R, type: 'skill', rarity: 'uncommon', cost: [1, 0], target: 'self',
    exhaust: true, text: '将一张随机攻击牌加入手牌，它本回合费用为 0。', art: '🔥',
    play: (g) => {
      const [nc] = g.randomCards(1, (id) => cardDef(id).type === 'attack');
      if (nc) {
        nc.costTurn = 0;
        g.addToHand(nc);
      }
    },
  },
  {
    id: 'inflame', name: '燃烧', color: R, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [2, 3], text: '获得 {M} 点力量。', art: '🔥',
    play: (g, c) => g.apply(g.player, 'strength', M(c)),
  },
  {
    id: 'intimidate', name: '威吓', color: R, type: 'skill', rarity: 'uncommon', cost: 0, target: 'all',
    mag: [1, 2], exhaust: true, text: '给予所有敌人 {M} 层虚弱。', art: '😱',
    play: (g, c) => g.alive.forEach((e) => g.apply(e, 'weak', M(c))),
  },
  {
    id: 'metallicize', name: '金属化', color: R, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [3, 4], text: '回合结束时，获得 {M} 点格挡。', art: '🔩',
    play: (g, c) => g.apply(g.player, 'metallicize', M(c)),
  },
  {
    id: 'power_through', name: '硬撑', color: R, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    blk: [15, 20], text: '将 2 张伤口加入手牌。\n获得 {B} 点格挡。', art: '🧱',
    play: (g, c) => {
      g.addToHand('wound', false, 2);
      g.block(B(g, c));
    },
  },
  {
    id: 'pummel', name: '连续拳', color: R, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    dmg: 2, mag: [4, 5], exhaust: true, text: '造成 {D} 点伤害 {M} 次。', art: '👊',
    play: (g, c, t) => hit(g, c, t, M(c)),
  },
  {
    id: 'rage', name: '狂怒', color: R, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    mag: [3, 5], text: '本回合你每打出一张攻击牌，获得 {M} 点格挡。', art: '😡',
    play: (g, c) => g.apply(g.player, 'rage', M(c)),
  },
  {
    id: 'rampage', name: '暴走', color: R, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    dmg: 8, mag: [5, 8], text: '造成 {D} 点伤害。\n本场战斗中这张牌的伤害提高 {M}。', art: '🦏',
    play: (g, c, t) => {
      hit(g, c, t);
      c.tmpDmg = (c.tmpDmg ?? 0) + M(c);
    },
  },
  {
    id: 'reckless_charge', name: '无谋冲锋', color: R, type: 'attack', rarity: 'uncommon', cost: 0, target: 'enemy',
    dmg: [7, 10], text: '造成 {D} 点伤害。\n将一张晕眩洗入你的抽牌堆。', art: '🐗',
    play: (g, c, t) => {
      hit(g, c, t);
      g.addToDraw('dazed');
    },
  },
  {
    id: 'rupture', name: '撕裂', color: R, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [1, 2], text: '每当你因卡牌失去生命，获得 {M} 点力量。', art: '🩹',
    play: (g, c) => g.apply(g.player, 'rupture', M(c)),
  },
  {
    id: 'second_wind', name: '重振精神', color: R, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    blk: [5, 7], text: '消耗手牌中所有非攻击牌，每消耗一张获得 {B} 点格挡。', art: '🌬️',
    play: (g, c) => {
      for (const x of g.hand.filter((h) => !isType(h, 'attack'))) {
        g.exhaustCard(x);
        g.block(B(g, c));
      }
    },
  },
  {
    id: 'seeing_red', name: '见红', color: R, type: 'skill', rarity: 'uncommon', cost: [1, 0], target: 'self',
    exhaust: true, text: '获得 2 点能量。', art: '🔴',
    play: (g) => g.gainEnergy(2),
  },
  {
    id: 'sentinel', name: '哨卫', color: R, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    blk: [5, 8], mag: [2, 3], text: '获得 {B} 点格挡。\n这张牌被消耗时，获得 {M} 点能量。', art: '🗼',
    play: (g, c) => g.block(B(g, c)),
    onExhaust: (g, c) => g.gainEnergy(M(c)),
  },
  {
    id: 'sever_soul', name: '断魂斩', color: R, type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy',
    dmg: [16, 22], text: '消耗手牌中所有非攻击牌。\n造成 {D} 点伤害。', art: '⚰️',
    play: (g, c, t) => {
      for (const x of g.hand.filter((h) => !isType(h, 'attack'))) g.exhaustCard(x);
      hit(g, c, t);
    },
  },
  {
    id: 'shockwave', name: '震荡波', color: R, type: 'skill', rarity: 'uncommon', cost: 2, target: 'all',
    mag: [3, 5], exhaust: true, text: '给予所有敌人 {M} 层虚弱和易伤。', art: '💥',
    play: (g, c) =>
      g.alive.forEach((e) => {
        g.apply(e, 'weak', M(c));
        g.apply(e, 'vulnerable', M(c));
      }),
  },
  {
    id: 'spot_weakness', name: '观察弱点', color: R, type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy',
    mag: [3, 4], text: '若敌人意图攻击，获得 {M} 点力量。', art: '🔍',
    play: (g, c, t) => {
      if (t && g.isAttacking(t)) g.apply(g.player, 'strength', M(c));
    },
  },
  {
    id: 'uppercut', name: '上勾拳', color: R, type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy',
    dmg: 13, mag: [1, 2], text: '造成 {D} 点伤害。\n给予 {M} 层虚弱和 {M} 层易伤。', art: '🥊',
    play: (g, c, t) => {
      hit(g, c, t);
      g.apply(t, 'weak', M(c));
      g.apply(t, 'vulnerable', M(c));
    },
  },
  {
    id: 'whirlwind', name: '旋风斩', color: R, type: 'attack', rarity: 'uncommon', cost: COST_X, target: 'all',
    dmg: [5, 8], text: '对所有敌人造成 {D} 点伤害 X 次。', art: '🌀',
    play: (g, c) => hitAll(g, c, g.x),
  },
  // ---------------------------------------------------------------- 稀有
  {
    id: 'barricade', name: '壁垒', color: R, type: 'power', rarity: 'rare', cost: [3, 2], target: 'self',
    text: '格挡不再在回合开始时消失。', art: '🏯',
    play: (g) => g.apply(g.player, 'barricade', 1),
  },
  {
    id: 'berserk', name: '狂暴', color: R, type: 'power', rarity: 'rare', cost: 0, target: 'self',
    mag: [2, 1], text: '获得 {M} 层易伤。\n回合开始时，获得 1 点能量。', art: '🪓',
    play: (g, c) => {
      g.apply(g.player, 'vulnerable', M(c), null);
      g.apply(g.player, 'berserk', 1);
    },
  },
  {
    id: 'bludgeon', name: '重锤', color: R, type: 'attack', rarity: 'rare', cost: 3, target: 'enemy',
    dmg: [32, 42], text: '造成 {D} 点伤害。', art: '🔨',
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'brutality', name: '残暴', color: R, type: 'power', rarity: 'rare', cost: 0, target: 'self',
    innate: [false, true], text: '回合开始时，失去 1 点生命并抽 1 张牌。', art: '💀',
    play: (g) => g.apply(g.player, 'brutality', 1),
  },
  {
    id: 'corruption', name: '腐化', color: R, type: 'power', rarity: 'rare', cost: [3, 2], target: 'self',
    text: '技能牌费用变为 0。\n每当你打出技能牌，将其消耗。', art: '🩸',
    play: (g) => g.apply(g.player, 'corruption', 1),
  },
  {
    id: 'demon_form', name: '恶魔形态', color: R, type: 'power', rarity: 'rare', cost: 3, target: 'self',
    mag: [2, 3], text: '回合开始时，获得 {M} 点力量。', art: '😈',
    play: (g, c) => g.apply(g.player, 'demon_form', M(c)),
  },
  {
    id: 'double_tap', name: '双发', color: R, type: 'skill', rarity: 'rare', cost: 1, target: 'self',
    mag: [1, 2], text: '本回合接下来的 {M} 张攻击牌会被打出两次。', art: '🎯',
    play: (g, c) => g.apply(g.player, 'double_tap', M(c)),
  },
  {
    id: 'exhume', name: '发掘', color: R, type: 'skill', rarity: 'rare', cost: [1, 0], target: 'self',
    exhaust: true, text: '将一张被消耗的牌放入手牌。', art: '⛏️',
    play: (g) => {
      g.chooseCards(
        { title: '选择一张被消耗的牌', cards: g.exhaustPile.filter((x) => x.id !== 'exhume'), min: 1, max: 1 },
        (s) => s.forEach((x) => g.moveTo(x, 'hand')),
      );
    },
  },
  {
    id: 'feed', name: '狂宴', color: R, type: 'attack', rarity: 'rare', cost: 1, target: 'enemy',
    dmg: [10, 12], mag: [3, 4], exhaust: true, text: '造成 {D} 点伤害。\n若击杀敌人，永久提高 {M} 点最大生命。', art: '🍖', tags: ['healing'],
    play: (g, c, t) => {
      if (hit(g, c, t) && t && !t.minion) g.gainMaxHp(M(c));
    },
  },
  {
    id: 'fiend_fire', name: '恶魔之焰', color: R, type: 'attack', rarity: 'rare', cost: 2, target: 'enemy',
    dmg: [7, 10], exhaust: true, text: '消耗所有手牌。\n每消耗一张牌，造成 {D} 点伤害。', art: '👹',
    play: (g, c, t) => {
      const cards = [...g.hand];
      for (const x of cards) g.exhaustCard(x);
      hit(g, c, t, cards.length);
    },
  },
  {
    id: 'immolate', name: '燔祭', color: R, type: 'attack', rarity: 'rare', cost: 2, target: 'all',
    dmg: [21, 28], text: '对所有敌人造成 {D} 点伤害。\n将一张灼伤放入弃牌堆。', art: '🌋',
    play: (g, c) => {
      hitAll(g, c);
      g.addToDiscard('burn');
    },
  },
  {
    id: 'impervious', name: '岿然不动', color: R, type: 'skill', rarity: 'rare', cost: 2, target: 'self',
    blk: [30, 40], exhaust: true, text: '获得 {B} 点格挡。', art: '🗿',
    play: (g, c) => g.block(B(g, c)),
  },
  {
    id: 'juggernaut', name: '势不可挡', color: R, type: 'power', rarity: 'rare', cost: 2, target: 'self',
    mag: [5, 7], text: '每当你获得格挡，对随机敌人造成 {M} 点伤害。', art: '🐗',
    play: (g, c) => g.apply(g.player, 'juggernaut', M(c)),
  },
  {
    id: 'limit_break', name: '突破极限', color: R, type: 'skill', rarity: 'rare', cost: 1, target: 'self',
    exhaust: [true, false], text: '将你的力量翻倍。', art: '📈',
    play: (g) => {
      const s = g.pw(g.player, 'strength');
      if (s > 0) g.apply(g.player, 'strength', s);
    },
  },
  {
    id: 'offering', name: '祭品', color: R, type: 'skill', rarity: 'rare', cost: 0, target: 'self',
    mag: [3, 5], exhaust: true, text: '失去 6 点生命。\n获得 2 点能量。\n抽 {M} 张牌。', art: '🕯️',
    play: (g, c) => {
      g.loseHp(g.player, 6, g.player);
      g.gainEnergy(2);
      g.draw(M(c));
    },
  },
  {
    id: 'reaper', name: '收割', color: R, type: 'attack', rarity: 'rare', cost: 2, target: 'all',
    dmg: [4, 5], exhaust: true, text: '对所有敌人造成 {D} 点伤害。\n回复等同于未被格挡伤害的生命。', art: '🌾', tags: ['healing'],
    play: (g, c) => {
      let total = 0;
      for (const e of g.alive) total += g.attack(e, D(g, c), c).dealt;
      g.heal(g.player, total);
    },
  },
  {
    id: 'bloodthirst', name: '饮血', color: R, type: 'power', rarity: 'rare', cost: 1, target: 'self',
    mag: [3, 4], text: '每当一名敌人死亡，回复 {M} 点生命。', art: '🧛', tags: ['healing'],
    play: (g, c) => g.apply(g.player, 'bloodthirst', M(c)),
  },
]);
