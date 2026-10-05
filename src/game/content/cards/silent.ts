import { defineCards } from '../../registry';
import { COST_X, UNPLAYABLE } from '../../types';
import { B, M, hit, hitAll, hitRandom, isType } from './helpers';

const S = 'silent' as const;

defineCards([
  // ---------------------------------------------------------------- 基础
  {
    id: 'strike_g', name: '打击', color: S, type: 'attack', rarity: 'basic', cost: 1, target: 'enemy',
    dmg: [6, 9], text: '造成 {D} 点伤害。', art: '⚔️', tags: ['strike', 'starter'],
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'defend_g', name: '防御', color: S, type: 'skill', rarity: 'basic', cost: 1, target: 'self',
    blk: [5, 8], text: '获得 {B} 点格挡。', art: '🛡️', tags: ['starter'],
    play: (g, c) => g.block(B(g, c)),
  },
  {
    id: 'neutralize', name: '中和', color: S, type: 'attack', rarity: 'basic', cost: 0, target: 'enemy',
    dmg: [3, 4], mag: [1, 2], text: '造成 {D} 点伤害。\n给予 {M} 层虚弱。', art: '🫳',
    play: (g, c, t) => {
      hit(g, c, t);
      g.apply(t, 'weak', M(c));
    },
  },
  {
    id: 'survivor', name: '生存者', color: S, type: 'skill', rarity: 'basic', cost: 1, target: 'self',
    blk: [8, 11], text: '获得 {B} 点格挡。\n丢弃 1 张牌。', art: '🏕️',
    play: (g, c) => {
      g.block(B(g, c));
      g.chooseHand({ title: '丢弃 1 张牌', min: 1, max: 1 }, (s) => s.forEach((x) => g.discardCard(x)));
    },
  },
  // ---------------------------------------------------------------- 普通
  {
    id: 'acrobatics', name: '杂技', color: S, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    mag: [3, 4], text: '抽 {M} 张牌。\n丢弃 1 张牌。', art: '🤸',
    play: (g, c) => {
      g.draw(M(c));
      g.chooseHand({ title: '丢弃 1 张牌', min: 1, max: 1 }, (s) => s.forEach((x) => g.discardCard(x)));
    },
  },
  {
    id: 'backflip', name: '后空翻', color: S, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    blk: [5, 8], text: '获得 {B} 点格挡。\n抽 2 张牌。', art: '🔄',
    play: (g, c) => {
      g.block(B(g, c));
      g.draw(2);
    },
  },
  {
    id: 'bane', name: '灾祸', color: S, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [7, 10], text: '造成 {D} 点伤害。\n若敌人中毒，再造成 {D} 点伤害。', art: '🐍',
    play: (g, c, t) => {
      hit(g, c, t);
      if (t && g.has(t, 'poison')) hit(g, c, t);
    },
  },
  {
    id: 'blade_dance', name: '刀刃之舞', color: S, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    mag: [3, 4], text: '将 {M} 张小刀加入手牌。', art: '💃',
    play: (g, c) => g.addToHand('shiv', false, M(c)),
  },
  {
    id: 'cloak_and_dagger', name: '斗篷与匕首', color: S, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    blk: 6, mag: [1, 2], text: '获得 {B} 点格挡。\n将 {M} 张小刀加入手牌。', art: '🧥',
    play: (g, c) => {
      g.block(B(g, c));
      g.addToHand('shiv', false, M(c));
    },
  },
  {
    id: 'dagger_spray', name: '匕首喷射', color: S, type: 'attack', rarity: 'common', cost: 1, target: 'all',
    dmg: [4, 6], text: '对所有敌人造成 {D} 点伤害两次。', art: '🌧️',
    play: (g, c) => hitAll(g, c, 2),
  },
  {
    id: 'dagger_throw', name: '投掷匕首', color: S, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [9, 12], text: '造成 {D} 点伤害。\n抽 1 张牌。\n丢弃 1 张牌。', art: '🗡️',
    play: (g, c, t) => {
      hit(g, c, t);
      g.draw(1);
      g.chooseHand({ title: '丢弃 1 张牌', min: 1, max: 1 }, (s) => s.forEach((x) => g.discardCard(x)));
    },
  },
  {
    id: 'deadly_poison', name: '致命毒药', color: S, type: 'skill', rarity: 'common', cost: 1, target: 'enemy',
    mag: [5, 7], text: '给予 {M} 层中毒。', art: '🧪',
    play: (g, c, t) => g.apply(t, 'poison', M(c)),
  },
  {
    id: 'deflect', name: '偏斜', color: S, type: 'skill', rarity: 'common', cost: 0, target: 'self',
    blk: [4, 7], text: '获得 {B} 点格挡。', art: '🪶',
    play: (g, c) => g.block(B(g, c)),
  },
  {
    id: 'dodge_and_roll', name: '闪躲翻滚', color: S, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    blk: [4, 6], text: '获得 {B} 点格挡。\n下回合获得 {B} 点格挡。', art: '🌀',
    play: (g, c) => {
      const b = g.previewBlock(B(g, c));
      g.gainBlock(g.player, b);
      g.apply(g.player, 'next_block', b);
    },
  },
  {
    id: 'flying_knee', name: '飞膝', color: S, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [8, 11], text: '造成 {D} 点伤害。\n下回合获得 1 点能量。', art: '🦵',
    play: (g, c, t) => {
      hit(g, c, t);
      g.apply(g.player, 'energized', 1);
    },
  },
  {
    id: 'outmaneuver', name: '先发制人', color: S, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    mag: [2, 3], text: '下回合获得 {M} 点能量。', art: '♟️',
    play: (g, c) => g.apply(g.player, 'energized', M(c)),
  },
  {
    id: 'piercing_wail', name: '尖啸', color: S, type: 'skill', rarity: 'common', cost: 1, target: 'all',
    mag: [6, 8], exhaust: true, text: '本回合所有敌人失去 {M} 点力量。', art: '😱',
    play: (g, c) => {
      for (const e of g.alive) {
        if (g.apply(e, 'strength', -M(c))) g.apply(e, 'shackled', M(c), e);
      }
    },
  },
  {
    id: 'poisoned_stab', name: '淬毒刺击', color: S, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [6, 8], mag: [3, 4], text: '造成 {D} 点伤害。\n给予 {M} 层中毒。', art: '🔪',
    play: (g, c, t) => {
      hit(g, c, t);
      g.apply(t, 'poison', M(c));
    },
  },
  {
    id: 'prepared', name: '准备', color: S, type: 'skill', rarity: 'common', cost: 0, target: 'self',
    mag: [1, 2], text: '抽 {M} 张牌。\n丢弃 {M} 张牌。', art: '🎒',
    play: (g, c) => {
      g.draw(M(c));
      g.chooseHand({ title: `丢弃 ${M(c)} 张牌`, min: M(c), max: M(c) }, (s) => s.forEach((x) => g.discardCard(x)));
    },
  },
  {
    id: 'quick_slash', name: '快斩', color: S, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [8, 12], text: '造成 {D} 点伤害。\n抽 1 张牌。', art: '💨',
    play: (g, c, t) => {
      hit(g, c, t);
      g.draw(1);
    },
  },
  {
    id: 'slice', name: '切割', color: S, type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
    dmg: [6, 9], text: '造成 {D} 点伤害。', art: '🔪',
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'sneaky_strike', name: '偷袭', color: S, type: 'attack', rarity: 'common', cost: 2, target: 'enemy',
    dmg: [12, 16], text: '造成 {D} 点伤害。\n若本回合你丢弃过牌，获得 2 点能量。', art: '🥷', tags: ['strike'],
    play: (g, c, t) => {
      hit(g, c, t);
      if (g.t.discarded > 0) g.gainEnergy(2);
    },
  },
  {
    id: 'sucker_punch', name: '突袭一拳', color: S, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [7, 9], mag: [1, 2], text: '造成 {D} 点伤害。\n给予 {M} 层虚弱。', art: '👊',
    play: (g, c, t) => {
      hit(g, c, t);
      g.apply(t, 'weak', M(c));
    },
  },
  // ---------------------------------------------------------------- 罕见
  {
    id: 'accuracy', name: '精准', color: S, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [4, 6], text: '小刀额外造成 {M} 点伤害。', art: '🎯',
    play: (g, c) => g.apply(g.player, 'accuracy', M(c)),
  },
  {
    id: 'all_out_attack', name: '全力攻击', color: S, type: 'attack', rarity: 'uncommon', cost: 1, target: 'all',
    dmg: [10, 14], text: '对所有敌人造成 {D} 点伤害。\n随机丢弃 1 张牌。', art: '💢',
    play: (g, c) => {
      hitAll(g, c);
      if (g.hand.length) g.discardCard(g.rng.pick(g.hand));
    },
  },
  {
    id: 'backstab', name: '背刺', color: S, type: 'attack', rarity: 'uncommon', cost: 0, target: 'enemy',
    dmg: [11, 15], innate: true, exhaust: true, text: '造成 {D} 点伤害。', art: '🗡️',
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'blur', name: '残影', color: S, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    blk: [5, 8], text: '获得 {B} 点格挡。\n下回合开始时格挡不会消失。', art: '🌫️',
    play: (g, c) => {
      g.block(B(g, c));
      g.apply(g.player, 'blur', 1);
    },
  },
  {
    id: 'bouncing_flask', name: '弹跳药瓶', color: S, type: 'skill', rarity: 'uncommon', cost: 2, target: 'all',
    mag: [3, 4], text: '随机给予敌人 3 层中毒，共 {M} 次。', art: '⚗️',
    play: (g, c) => {
      for (let i = 0; i < M(c); i++) g.apply(g.randomEnemy(), 'poison', 3);
    },
  },
  {
    id: 'calculated_gamble', name: '计算下注', color: S, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    exhaust: [true, false], text: '丢弃所有手牌，然后抽等量的牌。', art: '🎲',
    play: (g) => {
      const n = g.hand.length;
      for (const x of [...g.hand]) g.discardCard(x);
      g.draw(n);
    },
  },
  {
    id: 'caltrops', name: '铁蒺藜', color: S, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [3, 5], text: '每当你受到攻击，对攻击者造成 {M} 点伤害。', art: '📍',
    play: (g, c) => g.apply(g.player, 'thorns', M(c)),
  },
  {
    id: 'catalyst', name: '催化剂', color: S, type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy',
    exhaust: true, text: ['使敌人的中毒层数翻倍。', '使敌人的中毒层数变为三倍。'], art: '🧫',
    play: (g, c, t) => {
      const p = g.pw(t, 'poison');
      if (p > 0) g.apply(t, 'poison', p * (c.up ? 2 : 1));
    },
  },
  {
    id: 'choke', name: '掐喉', color: S, type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy',
    dmg: 12, mag: [3, 5], text: '造成 {D} 点伤害。\n本回合你每打出一张牌，该敌人失去 {M} 点生命。', art: '🫳',
    play: (g, c, t) => {
      hit(g, c, t);
      g.apply(t, 'choke', M(c));
    },
  },
  {
    id: 'concentrate', name: '集中', color: S, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    mag: [3, 2], text: '丢弃 {M} 张牌。\n获得 2 点能量。', art: '🧘',
    canPlay: (g, c) => (g.hand.length - 1 >= M(c) ? true : '手牌不足'),
    play: (g, c) => {
      g.chooseHand({ title: `丢弃 ${M(c)} 张牌`, min: M(c), max: M(c) }, (s) => {
        s.forEach((x) => g.discardCard(x));
        g.gainEnergy(2);
      });
    },
  },
  {
    id: 'crippling_cloud', name: '致残毒云', color: S, type: 'skill', rarity: 'uncommon', cost: 2, target: 'all',
    mag: [4, 7], exhaust: true, text: '给予所有敌人 {M} 层中毒和 2 层虚弱。', art: '☁️',
    play: (g, c) =>
      g.alive.forEach((e) => {
        g.apply(e, 'poison', M(c));
        g.apply(e, 'weak', 2);
      }),
  },
  {
    id: 'dash', name: '冲刺', color: S, type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy',
    dmg: [10, 13], blk: [10, 13], text: '获得 {B} 点格挡。\n造成 {D} 点伤害。', art: '🏃',
    play: (g, c, t) => {
      g.block(B(g, c));
      hit(g, c, t);
    },
  },
  {
    id: 'endless_agony', name: '无尽苦痛', color: S, type: 'attack', rarity: 'uncommon', cost: 0, target: 'enemy',
    dmg: [4, 6], exhaust: true, text: '抽到这张牌时，将它的一张复制品加入手牌。\n造成 {D} 点伤害。', art: '♾️',
    play: (g, c, t) => hit(g, c, t),
    onDraw: (g, c) => {
      g.addToHand(c.id, c.up);
    },
  },
  {
    id: 'escape_plan', name: '逃脱计划', color: S, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    blk: [3, 5], text: '抽 1 张牌。\n若抽到的是技能牌，获得 {B} 点格挡。', art: '🗺️',
    play: (g, c) => {
      const [x] = g.draw(1);
      if (x && isType(x, 'skill')) g.block(B(g, c));
    },
  },
  {
    id: 'eviscerate', name: '内脏切除', color: S, type: 'attack', rarity: 'uncommon', cost: 3, target: 'enemy',
    dmg: [7, 9], text: '本回合你每丢弃一张牌，这张牌的费用减少 1。\n造成 {D} 点伤害三次。', art: '🩸',
    costFn: (g, _c, cost) => Math.max(0, cost - g.t.discarded),
    play: (g, c, t) => hit(g, c, t, 3),
  },
  {
    id: 'expertise', name: '专精', color: S, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [6, 7], text: '抽牌直到手牌数达到 {M} 张。', art: '📚',
    play: (g, c) => g.draw(Math.max(0, M(c) - g.hand.length)),
  },
  {
    id: 'finisher', name: '终结技', color: S, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    dmg: [6, 8], text: '本回合你每打出过一张攻击牌，造成 {D} 点伤害一次。', art: '🏁',
    play: (g, c, t) => hit(g, c, t, Math.max(0, g.t.attacks - 1)),
  },
  {
    id: 'flechettes', name: '飞镖', color: S, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    dmg: [4, 6], text: '手牌中每有一张技能牌，造成 {D} 点伤害一次。', art: '🎯',
    play: (g, c, t) => hit(g, c, t, g.hand.filter((x) => isType(x, 'skill')).length),
  },
  {
    id: 'footwork', name: '灵动步法', color: S, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [2, 3], text: '获得 {M} 点敏捷。', art: '👣',
    play: (g, c) => g.apply(g.player, 'dexterity', M(c)),
  },
  {
    id: 'heel_hook', name: '勾腿', color: S, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    dmg: [5, 8], text: '造成 {D} 点伤害。\n若敌人有虚弱，获得 1 点能量并抽 1 张牌。', art: '🪝',
    play: (g, c, t) => {
      const weak = g.has(t, 'weak');
      hit(g, c, t);
      if (weak) {
        g.gainEnergy(1);
        g.draw(1);
      }
    },
  },
  {
    id: 'infinite_blades', name: '无尽刀刃', color: S, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    innate: [false, true], text: '回合开始时，将 1 张小刀加入手牌。', art: '🗡️',
    play: (g) => g.apply(g.player, 'infinite_blades', 1),
  },
  {
    id: 'leg_sweep', name: '扫腿', color: S, type: 'skill', rarity: 'uncommon', cost: 2, target: 'enemy',
    blk: [11, 14], mag: [2, 3], text: '给予 {M} 层虚弱。\n获得 {B} 点格挡。', art: '🦿',
    play: (g, c, t) => {
      g.apply(t, 'weak', M(c));
      g.block(B(g, c));
    },
  },
  {
    id: 'noxious_fumes', name: '毒雾', color: S, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [2, 3], text: '回合开始时，给予所有敌人 {M} 层中毒。', art: '🌫️',
    play: (g, c) => g.apply(g.player, 'noxious_fumes', M(c)),
  },
  {
    id: 'predator', name: '掠食者', color: S, type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy',
    dmg: [15, 20], text: '造成 {D} 点伤害。\n下回合多抽 2 张牌。', art: '🐆',
    play: (g, c, t) => {
      hit(g, c, t);
      g.apply(g.player, 'draw_next', 2);
    },
  },
  {
    id: 'reflex', name: '反射', color: S, type: 'skill', rarity: 'uncommon', cost: UNPLAYABLE, target: 'none',
    mag: [2, 3], text: '不能被打出。\n这张牌被丢弃时，抽 {M} 张牌。', art: '⚡',
    onManualDiscard: (g, c) => {
      g.draw(M(c));
    },
  },
  {
    id: 'riddle_with_holes', name: '千疮百孔', color: S, type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy',
    dmg: [3, 4], text: '造成 {D} 点伤害五次。', art: '🕳️',
    play: (g, c, t) => hit(g, c, t, 5),
  },
  {
    id: 'skewer', name: '穿刺', color: S, type: 'attack', rarity: 'uncommon', cost: COST_X, target: 'enemy',
    dmg: [7, 10], text: '造成 {D} 点伤害 X 次。', art: '🍢',
    play: (g, c, t) => hit(g, c, t, g.x),
  },
  {
    id: 'tactician', name: '战术家', color: S, type: 'skill', rarity: 'uncommon', cost: UNPLAYABLE, target: 'none',
    mag: [1, 2], text: '不能被打出。\n这张牌被丢弃时，获得 {M} 点能量。', art: '♞',
    onManualDiscard: (g, c) => g.gainEnergy(M(c)),
  },
  {
    id: 'terror', name: '恐怖', color: S, type: 'skill', rarity: 'uncommon', cost: [1, 0], target: 'enemy',
    exhaust: true, text: '给予 99 层易伤。', art: '👁️',
    play: (g, _c, t) => g.apply(t, 'vulnerable', 99),
  },
  {
    id: 'well_laid_plans', name: '计划妥当', color: S, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [1, 2], text: '回合结束时，保留至多 {M} 张牌。', art: '📋',
    play: (g, c) => g.apply(g.player, 'well_laid_plans', M(c)),
  },
  {
    id: 'reflexes', name: '本能反应', color: S, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [3, 4], text: '每当你丢弃一张牌，获得 {M} 点格挡。', art: '🌀',
    play: (g, c) => g.apply(g.player, 'reflexes', M(c)),
  },
  // ---------------------------------------------------------------- 稀有
  {
    id: 'a_thousand_cuts', name: '凌迟', color: S, type: 'power', rarity: 'rare', cost: 2, target: 'self',
    mag: [1, 2], text: '每当你打出一张牌，对所有敌人造成 {M} 点伤害。', art: '🔪',
    play: (g, c) => g.apply(g.player, 'thousand_cuts', M(c)),
  },
  {
    id: 'adrenaline', name: '肾上腺素', color: S, type: 'skill', rarity: 'rare', cost: 0, target: 'self',
    mag: [1, 2], exhaust: true, text: '获得 {M} 点能量。\n抽 2 张牌。', art: '💉',
    play: (g, c) => {
      g.gainEnergy(M(c));
      g.draw(2);
    },
  },
  {
    id: 'after_image', name: '余像', color: S, type: 'power', rarity: 'rare', cost: 1, target: 'self',
    innate: [false, true], text: '每当你打出一张牌，获得 1 点格挡。', art: '👥',
    play: (g) => g.apply(g.player, 'after_image', 1),
  },
  {
    id: 'bullet_time', name: '子弹时间', color: S, type: 'skill', rarity: 'rare', cost: [3, 2], target: 'self',
    text: '本回合你无法再抽牌。\n本回合手牌费用变为 0。', art: '⏱️',
    play: (g) => {
      g.apply(g.player, 'no_draw', 1);
      for (const x of g.hand) x.costTurn = 0;
    },
  },
  {
    id: 'burst', name: '爆发', color: S, type: 'skill', rarity: 'rare', cost: 1, target: 'self',
    mag: [1, 2], text: '本回合接下来的 {M} 张技能牌会被打出两次。', art: '💥',
    play: (g, c) => g.apply(g.player, 'burst', M(c)),
  },
  {
    id: 'corpse_explosion', name: '尸体爆炸', color: S, type: 'skill', rarity: 'rare', cost: 2, target: 'enemy',
    mag: [6, 9], text: '给予 {M} 层中毒。\n该敌人死亡时，对所有其他敌人造成等同于其最大生命的伤害。', art: '💣',
    play: (g, c, t) => {
      g.apply(t, 'poison', M(c));
      if (t && !g.has(t, 'corpse_explosion')) g.apply(t, 'corpse_explosion', 1);
    },
  },
  {
    id: 'die_die_die', name: '死吧死吧死吧', color: S, type: 'attack', rarity: 'rare', cost: 1, target: 'all',
    dmg: [13, 17], exhaust: true, text: '对所有敌人造成 {D} 点伤害。', art: '☠️',
    play: (g, c) => hitAll(g, c),
  },
  {
    id: 'envenom', name: '涂毒', color: S, type: 'power', rarity: 'rare', cost: [2, 1], target: 'self',
    text: '每当攻击造成未被格挡的伤害，给予 1 层中毒。', art: '🐍',
    play: (g) => g.apply(g.player, 'envenom', 1),
  },
  {
    id: 'glass_knife', name: '玻璃刀', color: S, type: 'attack', rarity: 'rare', cost: 1, target: 'enemy',
    dmg: [8, 12], text: '造成 {D} 点伤害两次。\n本场战斗中这张牌的伤害降低 2。', art: '🔪',
    play: (g, c, t) => {
      hit(g, c, t, 2);
      c.tmpDmg = (c.tmpDmg ?? 0) - 2;
    },
  },
  {
    id: 'grand_finale', name: '华丽谢幕', color: S, type: 'attack', rarity: 'rare', cost: 0, target: 'all',
    dmg: [50, 60], text: '只有在抽牌堆为空时才能打出。\n对所有敌人造成 {D} 点伤害。', art: '🎆',
    canPlay: (g) => (g.drawPile.length === 0 ? true : '抽牌堆不为空'),
    play: (g, c) => hitAll(g, c),
  },
  {
    id: 'malaise', name: '萎靡', color: S, type: 'skill', rarity: 'rare', cost: COST_X, target: 'enemy',
    exhaust: true, text: ['敌人失去 X 点力量。\n给予 X 层虚弱。', '敌人失去 X+1 点力量。\n给予 X+1 层虚弱。'], art: '😩',
    play: (g, c, t) => {
      const x = g.x + (c.up ? 1 : 0);
      if (x <= 0) return;
      g.apply(t, 'strength', -x);
      g.apply(t, 'weak', x);
    },
  },
  {
    id: 'phantasmal_killer', name: '幻影杀手', color: S, type: 'skill', rarity: 'rare', cost: [1, 0], target: 'self',
    text: '下回合你的攻击造成双倍伤害。', art: '👤',
    play: (g) => g.apply(g.player, 'phantasmal', 1),
  },
  {
    id: 'storm_of_steel', name: '钢铁风暴', color: S, type: 'skill', rarity: 'rare', cost: 1, target: 'self',
    text: ['丢弃所有手牌。\n每丢弃一张牌，将一张小刀加入手牌。', '丢弃所有手牌。\n每丢弃一张牌，将一张小刀+加入手牌。'], art: '🌪️',
    play: (g, c) => {
      const n = g.hand.length;
      for (const x of [...g.hand]) g.discardCard(x);
      g.addToHand('shiv', c.up, n);
    },
  },
  {
    id: 'tools_of_the_trade', name: '交易工具', color: S, type: 'power', rarity: 'rare', cost: [1, 0], target: 'self',
    text: '回合开始时，抽 1 张牌，然后丢弃 1 张牌。', art: '🧰',
    play: (g) => g.apply(g.player, 'tools_of_trade', 1),
  },
  {
    id: 'unload', name: '倾泻', color: S, type: 'attack', rarity: 'rare', cost: 1, target: 'enemy',
    dmg: [14, 18], text: '造成 {D} 点伤害。\n丢弃手牌中所有非攻击牌。', art: '🔫',
    play: (g, c, t) => {
      hit(g, c, t);
      for (const x of g.hand.filter((h) => !isType(h, 'attack'))) g.discardCard(x);
    },
  },
  {
    id: 'wraith_form', name: '幽灵形态', color: S, type: 'power', rarity: 'rare', cost: 3, target: 'self',
    mag: [2, 3], text: '获得 {M} 层无实体。\n回合结束时，失去 1 点敏捷。', art: '👻',
    play: (g, c) => {
      g.apply(g.player, 'intangible', M(c));
      g.apply(g.player, 'wraith_form', 1);
    },
  },
  {
    id: 'nightshade', name: '夜影毒刃', color: S, type: 'attack', rarity: 'rare', cost: 1, target: 'enemy',
    dmg: [6, 8], text: '造成 {D} 点伤害。\n使该敌人的中毒立即生效一次（不减少层数）。', art: '🌑',
    play: (g, c, t) => {
      hit(g, c, t);
      if (t && !t.dead && g.pw(t, 'poison') > 0) g.loseHp(t, g.pw(t, 'poison'), g.player);
    },
  },
  {
    id: 'masterful_stab', name: '精妙刺击', color: S, type: 'attack', rarity: 'rare', cost: 0, target: 'enemy',
    dmg: [12, 16], text: '本场战斗中你每失去一次生命，这张牌的费用增加 1。\n造成 {D} 点伤害。', art: '🎭',
    costFn: (g, _c, cost) => cost + g.total.hpLossTimes,
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'shiv_storm', name: '刀雨', color: S, type: 'attack', rarity: 'rare', cost: 2, target: 'all',
    dmg: [3, 4], mag: [6, 8], text: '随机对敌人造成 {D} 点伤害 {M} 次。\n每次命中时将一张小刀放入弃牌堆的几率为 25%。', art: '🌧️',
    play: (g, c) => {
      hitRandom(g, c, M(c));
      for (let i = 0; i < M(c); i++) if (g.rng.chance(0.25)) g.addToDiscard('shiv');
    },
  },
]);

// 小刀（特殊）
defineCards([
  {
    id: 'shiv', name: '小刀', color: 'colorless', type: 'attack', rarity: 'special', cost: 0, target: 'enemy',
    dmg: [4, 6], exhaust: true, text: '造成 {D} 点伤害。', art: '🔪', noPool: true,
    play: (g, c, t) => hit(g, c, t),
  },
]);
