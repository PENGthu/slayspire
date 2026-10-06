import { defineRelics } from '../registry';
import { canUpgrade, cardDef, hasTag, makeCard, upgradeCard } from '../cards';
import type { Combat } from '../combat';
import type { Run } from '../run';

/** 在战斗内或战斗外回复生命 */
function healEither(run: Run, g: Combat | null, n: number) {
  if (g && !g.over) g.heal(g.player, n);
  else run.heal(n);
}

/** 每回合计数型遗物：在回合开始时重置 */
const resetEachTurn = { onTurnStart: (_g: Combat, r: { counter: number }) => (r.counter = 0) };

defineRelics([
  // ======================================================== 初始遗物
  {
    id: 'burning_blood', name: '燃烧之血', art: '🩸', tier: 'starter', char: 'ironclad',
    desc: '战斗结束时，回复 6 点生命。',
    onVictory: (g) => g.heal(g.player, 6),
  },
  {
    id: 'ring_of_snake', name: '蛇之戒指', art: '💍', tier: 'starter', char: 'silent',
    desc: '每场战斗开始时，额外抽 2 张牌。',
    onCombatStart: (g) => (g.firstTurnDrawBonus += 2),
  },
  {
    id: 'divine_right', name: '神授之权', art: '🌟', tier: 'starter', char: 'regent',
    desc: '每场战斗开始时，获得 3 颗星辰。',
    onCombatStartPostDraw: (g) => g.gainStars(3),
  },
  {
    id: 'bound_phylactery', name: '缚魂经匣', art: '⚱️', tier: 'starter', char: 'necrobinder',
    desc: '每场战斗开始时，召唤 5。',
    onCombatStartPostDraw: (g) => g.summon(5),
  },
  {
    id: 'cracked_core', name: '破碎核心', art: '⚙️', tier: 'starter', char: 'defect',
    desc: '每场战斗开始时，生成 1 个闪电。',
    onCombatStart: (g) => g.channel('lightning'),
  },
  {
    id: 'the_spark', name: '星火', art: '✴️', tier: 'starter', char: 'claude',
    desc: '每当你打出一张牌，记录 1。',
    flavor: '一切思考开始的地方。',
    afterCardPlayed: (g) => g.note(1),
  },
  // ======================================================== 普通
  {
    id: 'anchor', name: '锚', art: '⚓', tier: 'common',
    desc: '每场战斗开始时，获得 10 点格挡。',
    onCombatStartPostDraw: (g) => g.gainBlock(g.player, 10),
  },
  {
    id: 'ancient_tea_set', name: '古老茶具', art: '🫖', tier: 'common', counter: true,
    desc: '每当你在休息处休息后，下一场战斗开始时获得 2 点能量。',
    onCombatStartPostDraw: (g, r) => {
      if (r.counter > 0) {
        g.gainEnergy(2);
        r.counter = 0;
      }
    },
  },
  {
    id: 'art_of_war', name: '孙子兵法', art: '📘', tier: 'common',
    desc: '若你在一个回合中没有打出攻击牌，下回合获得 1 点能量。',
    onTurnEnd: (g) => {
      if (g.t.attacks === 0) g.apply(g.player, 'energized', 1);
    },
  },
  {
    id: 'bag_of_marbles', name: '弹珠袋', art: '🔮', tier: 'common',
    desc: '每场战斗开始时，给予所有敌人 1 层易伤。',
    onCombatStart: (g) => g.alive.forEach((e) => g.apply(e, 'vulnerable', 1)),
  },
  {
    id: 'bag_of_preparation', name: '准备背包', art: '🎒', tier: 'common',
    desc: '每场战斗开始时，额外抽 2 张牌。',
    onCombatStart: (g) => (g.firstTurnDrawBonus += 2),
  },
  {
    id: 'blood_vial', name: '小血瓶', art: '🧃', tier: 'common',
    desc: '每场战斗开始时，回复 2 点生命。',
    onCombatStart: (g) => g.heal(g.player, 2),
  },
  {
    id: 'bronze_scales', name: '铜制鳞片', art: '🐉', tier: 'common',
    desc: '每场战斗开始时，获得 3 点荆棘。',
    onCombatStart: (g) => g.apply(g.player, 'thorns', 3),
  },
  {
    id: 'centennial_puzzle', name: '百年积木', art: '🧩', tier: 'common',
    desc: '每场战斗中第一次失去生命时，抽 3 张牌。',
    onCombatStart: (_g, r) => (r.counter = 0),
    onPlayerHpLoss: (g, r) => {
      if (r.counter === 0) {
        r.counter = 1;
        g.draw(3);
      }
    },
  },
  {
    id: 'ceramic_fish', name: '陶瓷小鱼', art: '🐟', tier: 'common',
    desc: '每当你将一张牌加入牌组，获得 9 金币。',
    onCardAdded: (run) => run.gainGold(9),
  },
  {
    id: 'dream_catcher', name: '捕梦网', art: '🕸️', tier: 'common',
    desc: '每当你在休息处休息，可以选择一张牌加入牌组。',
  },
  {
    id: 'happy_flower', name: '开心小花', art: '🌻', tier: 'common', counter: true,
    desc: '每 3 回合，获得 1 点能量。',
    onTurnStartPostDraw: (g, r) => {
      r.counter++;
      if (r.counter >= 3) {
        r.counter = 0;
        g.gainEnergy(1);
      }
    },
  },
  {
    id: 'juzu_bracelet', name: '念珠手链', art: '📿', tier: 'common',
    desc: '「未知」房间中不会再遇到普通敌人。',
  },
  {
    id: 'lantern', name: '灯笼', art: '🏮', tier: 'common',
    desc: '每场战斗的第一回合，获得 1 点能量。',
    onCombatStartPostDraw: (g) => g.gainEnergy(1),
  },
  {
    id: 'maw_bank', name: '巨口储蓄罐', art: '🐷', tier: 'common',
    desc: '每登上一层，获得 12 金币。在商店消费后失效。',
  },
  {
    id: 'meal_ticket', name: '餐券', art: '🎫', tier: 'common',
    desc: '每当你进入商店，回复 15 点生命。',
  },
  {
    id: 'nunchaku', name: '双节棍', art: '🥢', tier: 'common', counter: true,
    desc: '每打出 10 张攻击牌，获得 1 点能量。',
    onCardPlayed: (g, r, c) => {
      if (cardDef(c).type !== 'attack') return;
      r.counter++;
      if (r.counter >= 10) {
        r.counter = 0;
        g.gainEnergy(1);
      }
    },
  },
  {
    id: 'oddly_smooth_stone', name: '意外光滑的石头', art: '🪨', tier: 'common',
    desc: '每场战斗开始时，获得 1 点敏捷。',
    onCombatStart: (g) => g.apply(g.player, 'dexterity', 1),
  },
  {
    id: 'omamori', name: '御守', art: '🧧', tier: 'common', counter: true,
    desc: '抵挡接下来获得的 2 张诅咒。',
    onPickup: (_run, r) => (r.counter = 2),
  },
  {
    id: 'orichalcum', name: '奥利哈钢', art: '🟧', tier: 'common',
    desc: '若回合结束时你没有格挡，获得 6 点格挡。',
    onTurnEnd: (g) => {
      if (g.player.block === 0) g.gainBlock(g.player, 6);
    },
  },
  {
    id: 'pen_nib', name: '钢笔尖', art: '✒️', tier: 'common', counter: true,
    desc: '每打出 10 张攻击牌，第 10 张造成双倍伤害。',
    onCardPlayed: (g, r, c) => {
      if (cardDef(c).type !== 'attack') return;
      r.counter++;
      if (r.counter >= 10) {
        r.counter = 0;
        g.flags.penNib = c.uid;
      }
    },
    onAttackDamage: (g, _r, d, card) => (card && g.flags.penNib === card.uid ? d * 2 : d),
  },
  {
    id: 'potion_belt', name: '药水腰带', art: '👝', tier: 'common',
    desc: '药水栏位 +2。',
    onPickup: (run) => run.potions.push(null, null),
  },
  {
    id: 'preserved_insect', name: '昆虫标本', art: '🦗', tier: 'common',
    desc: '精英敌人的生命降低 25%。',
  },
  {
    id: 'regal_pillow', name: '皇家枕头', art: '🛏️', tier: 'common',
    desc: '在休息处休息时，额外回复 15 点生命。',
  },
  {
    id: 'strawberry', name: '草莓', art: '🍓', tier: 'common',
    desc: '最大生命 +7。',
    onPickup: (run) => run.gainMaxHp(7),
  },
  {
    id: 'smiling_mask', name: '微笑面具', art: '🎭', tier: 'common',
    desc: '商人的移除卡牌服务固定为 50 金币。',
  },
  {
    id: 'toy_ornithopter', name: '玩具扑翼机', art: '🪁', tier: 'common',
    desc: '每当你使用药水，回复 5 点生命。',
    onPotionUsed: (run, _r, g) => healEither(run, g, 5),
  },
  {
    id: 'vajra', name: '金刚杵', art: '🔱', tier: 'common',
    desc: '每场战斗开始时，获得 1 点力量。',
    onCombatStart: (g) => g.apply(g.player, 'strength', 1),
  },
  {
    id: 'war_paint', name: '战争油彩', art: '🎨', tier: 'common',
    desc: '拾取时，随机升级 2 张技能牌。',
    onPickup: (run) => run.upgradeRandom(2, (c) => cardDef(c).type === 'skill'),
  },
  {
    id: 'whetstone', name: '磨刀石', art: '🪒', tier: 'common',
    desc: '拾取时，随机升级 2 张攻击牌。',
    onPickup: (run) => run.upgradeRandom(2, (c) => cardDef(c).type === 'attack'),
  },
  {
    id: 'akabeko', name: '赤牛', art: '🐄', tier: 'common',
    desc: '每场战斗开始时，获得 8 点活力。',
    onCombatStart: (g) => g.apply(g.player, 'vigor', 8),
  },
  {
    id: 'red_skull', name: '红头骨', art: '💀', tier: 'common', char: 'ironclad',
    desc: '生命不高于 50% 时，额外获得 3 点力量。',
    onCombatStart: (_g, r) => (r.counter = 0),
    onTurnStart: (g, r) => {
      const low = g.player.hp <= g.player.maxHp / 2;
      if (low && r.counter === 0) {
        r.counter = 1;
        g.apply(g.player, 'strength', 3);
      } else if (!low && r.counter === 1) {
        r.counter = 0;
        g.apply(g.player, 'strength', -3, g.player);
      }
    },
    onPlayerHpLoss: (g, r) => {
      if (g.player.hp <= g.player.maxHp / 2 && r.counter === 0 && g.player.hp > 0) {
        r.counter = 1;
        g.apply(g.player, 'strength', 3);
      }
    },
  },
  {
    id: 'snecko_skull', name: '蛇头骨', art: '🐍', tier: 'common', char: 'silent',
    desc: '每当你给予中毒时，额外给予 1 层。',
  },
  {
    id: 'star_chart', name: '星图', art: '🗺️', tier: 'common', char: 'regent',
    desc: '每回合第一次花费星辰时，抽 1 张牌。',
    ...resetEachTurn,
    onStarsSpent: (g, r) => {
      if (r.counter === 0) {
        r.counter = 1;
        g.draw(1);
      }
    },
  },
  {
    id: 'bone_flute', name: '骨笛', art: '🪈', tier: 'common', char: 'necrobinder',
    desc: '每当你召唤，获得 2 点格挡。',
    onSummon: (g) => g.gainBlock(g.player, 2),
  },
  {
    id: 'data_disk', name: '数据磁盘', art: '💾', tier: 'common', char: 'defect',
    desc: '每场战斗开始时，获得 1 点集中。',
    onCombatStart: (g) => g.apply(g.player, 'focus', 1),
  },
  {
    id: 'sticky_note', name: '便签', art: '🗒️', tier: 'common', char: 'claude',
    desc: '每场战斗开始时，记录 4。',
    onCombatStart: (g) => g.note(4),
  },
  // ======================================================== 罕见
  {
    id: 'blue_candle', name: '蓝蜡烛', art: '🕯️', tier: 'uncommon',
    desc: '诅咒牌可以被打出：失去 1 点生命并将其消耗。',
  },
  {
    id: 'eternal_feather', name: '永恒羽毛', art: '🪶', tier: 'uncommon',
    desc: '进入休息处时，你牌组中每有 5 张牌，回复 3 点生命。',
    onEnterRoom: (run, _r, kind) => {
      if (kind === 'rest') run.heal(Math.floor(run.deck.length / 5) * 3);
    },
  },
  {
    id: 'gremlin_horn', name: '地精之角', art: '📯', tier: 'uncommon',
    desc: '每当一名敌人死亡，获得 1 点能量并抽 1 张牌。',
    onEnemyDeath: (g) => {
      if (g.alive.length > 0) {
        g.gainEnergy(1);
        g.draw(1);
      }
    },
  },
  {
    id: 'horn_cleat', name: '船夹板', art: '🪝', tier: 'uncommon',
    desc: '每场战斗的第 2 回合开始时，获得 14 点格挡。',
    onTurnStartPostDraw: (g) => {
      if (g.turn === 2) g.gainBlock(g.player, 14);
    },
  },
  {
    id: 'ink_bottle', name: '墨水瓶', art: '🖋️', tier: 'uncommon', counter: true,
    desc: '每打出 10 张牌，抽 1 张牌。',
    onCardPlayed: (g, r) => {
      r.counter++;
      if (r.counter >= 10) {
        r.counter = 0;
        g.draw(1);
      }
    },
  },
  {
    id: 'kunai', name: '苦无', art: '🔪', tier: 'uncommon', counter: true,
    desc: '每回合每打出 3 张攻击牌，获得 1 点敏捷。',
    ...resetEachTurn,
    onCardPlayed: (g, r, c) => {
      if (cardDef(c).type !== 'attack') return;
      if (++r.counter % 3 === 0) g.apply(g.player, 'dexterity', 1);
    },
  },
  {
    id: 'shuriken', name: '手里剑', art: '✴️', tier: 'uncommon', counter: true,
    desc: '每回合每打出 3 张攻击牌，获得 1 点力量。',
    ...resetEachTurn,
    onCardPlayed: (g, r, c) => {
      if (cardDef(c).type !== 'attack') return;
      if (++r.counter % 3 === 0) g.apply(g.player, 'strength', 1);
    },
  },
  {
    id: 'ornamental_fan', name: '精致折扇', art: '🪭', tier: 'uncommon', counter: true,
    desc: '每回合每打出 3 张攻击牌，获得 4 点格挡。',
    ...resetEachTurn,
    onCardPlayed: (g, r, c) => {
      if (cardDef(c).type !== 'attack') return;
      if (++r.counter % 3 === 0) g.gainBlock(g.player, 4);
    },
  },
  {
    id: 'letter_opener', name: '开信刀', art: '📨', tier: 'uncommon', counter: true,
    desc: '每回合每打出 3 张技能牌，对所有敌人造成 5 点伤害。',
    ...resetEachTurn,
    onCardPlayed: (g, r, c) => {
      if (cardDef(c).type !== 'skill') return;
      if (++r.counter % 3 === 0) for (const e of g.alive) g.thorns(e, 5, g.player);
    },
  },
  {
    id: 'meat_on_the_bone', name: '带骨肉', art: '🍖', tier: 'uncommon',
    desc: '战斗结束时，若生命不高于 50%，回复 12 点生命。',
    onVictory: (g) => {
      if (g.player.hp <= g.player.maxHp / 2) g.heal(g.player, 12);
    },
  },
  {
    id: 'mercury_hourglass', name: '水银沙漏', art: '⏳', tier: 'uncommon',
    desc: '回合开始时，对所有敌人造成 3 点伤害。',
    onTurnStart: (g) => {
      for (const e of g.alive) g.thorns(e, 3, g.player);
    },
  },
  {
    id: 'molten_egg', name: '熔火之蛋', art: '🥚', tier: 'uncommon',
    desc: '之后加入牌组的攻击牌自动升级。',
  },
  {
    id: 'toxic_egg', name: '毒素之蛋', art: '🥚', tier: 'uncommon',
    desc: '之后加入牌组的技能牌自动升级。',
  },
  {
    id: 'frozen_egg', name: '冻结之蛋', art: '🥚', tier: 'uncommon',
    desc: '之后加入牌组的能力牌自动升级。',
  },
  {
    id: 'pantograph', name: '缩放仪', art: '📐', tier: 'uncommon',
    desc: '首领战开始时，回复 25 点生命。',
    onCombatStart: (g) => {
      if (g.boss) g.heal(g.player, 25);
    },
  },
  {
    id: 'pear', name: '梨子', art: '🍐', tier: 'uncommon',
    desc: '最大生命 +10。',
    onPickup: (run) => run.gainMaxHp(10),
  },
  {
    id: 'question_card', name: '问号卡', art: '❔', tier: 'uncommon',
    desc: '卡牌奖励多提供 1 个选项。',
  },
  {
    id: 'self_forming_clay', name: '自成型黏土', art: '🏺', tier: 'uncommon',
    desc: '每当你失去生命，下回合获得 3 点格挡。',
    onPlayerHpLoss: (g) => g.apply(g.player, 'next_block', 3),
  },
  {
    id: 'singing_bowl', name: '颂钵', art: '🥣', tier: 'uncommon',
    desc: '跳过卡牌奖励时，最大生命 +2。',
  },
  {
    id: 'strike_dummy', name: '打击木偶', art: '🎯', tier: 'uncommon',
    desc: '名称含「打击」的牌额外造成 3 点伤害。',
    onAttackDamage: (_g, _r, d, card) => (card && hasTag(card, 'strike') ? d + 3 : d),
  },
  {
    id: 'sundial', name: '日晷', art: '🕰️', tier: 'uncommon', counter: true,
    desc: '每洗牌 3 次，获得 2 点能量。',
    onShuffle: (g, r) => {
      r.counter++;
      if (r.counter >= 3) {
        r.counter = 0;
        g.gainEnergy(2);
      }
    },
  },
  {
    id: 'paper_phrog', name: '纸蛙', art: '🐸', tier: 'uncommon',
    desc: '有易伤的敌人受到的攻击伤害提高 75%（而非 50%）。',
  },
  {
    id: 'white_beast_statue', name: '白兽雕像', art: '🗿', tier: 'uncommon',
    desc: '战斗胜利后必定掉落药水。',
  },
  {
    id: 'darkstone_periapt', name: '黑石护符', art: '🖤', tier: 'uncommon',
    desc: '每当你获得一张诅咒，最大生命 +6。',
  },
  {
    id: 'ninja_scroll', name: '忍者卷轴', art: '📜', tier: 'uncommon', char: 'silent',
    desc: '每场战斗开始时，将 3 张小刀加入手牌。',
    onCombatStartPostDraw: (g) => g.addToHand('shiv', false, 3),
  },
  {
    id: 'crown_shard', name: '王冠碎片', art: '🔶', tier: 'uncommon', char: 'regent',
    desc: '每场战斗开始时，铸造 6。',
    onCombatStartPostDraw: (g) => g.forge(6),
  },
  {
    id: 'soul_jar', name: '灵魂之罐', art: '🏺', tier: 'uncommon', char: 'necrobinder',
    desc: '每场战斗开始时，将 2 张灵魂洗入抽牌堆。',
    onCombatStart: (g) => g.addToDraw('soul', false, 2),
  },
  {
    id: 'paper_crane', name: '纸鹤', art: '🕊️', tier: 'uncommon', char: 'silent',
    desc: '每场战斗开始时，给予所有敌人 1 层虚弱。',
    onCombatStart: (g) => g.alive.forEach((e) => g.apply(e, 'weak', 1)),
  },
  {
    id: 'blood_pact', name: '血之契约', art: '🩸', tier: 'uncommon', char: 'ironclad',
    desc: '每当你因卡牌失去生命，获得 2 点格挡。',
    onPlayerHpLoss: (g) => {
      if (g.phase !== 'enemy') g.gainBlock(g.player, 2);
    },
  },
  {
    id: 'gold_plated_cables', name: '镀金缆线', art: '🔗', tier: 'uncommon', char: 'defect',
    desc: '最左侧充能球的被动额外触发一次。',
  },
  {
    id: 'symbiotic_virus', name: '共生病毒', art: '🦠', tier: 'uncommon', char: 'defect',
    desc: '每场战斗开始时，生成 1 个黑暗。',
    onCombatStart: (g) => g.channel('dark'),
  },
  {
    id: 'tool_belt', name: '工具腰带', art: '🧰', tier: 'uncommon', char: 'claude',
    desc: '每场战斗开始时，将 2 张随机工具牌加入手牌。',
    onCombatStartPostDraw: (g) => g.addTools(2),
  },
  // ======================================================== 稀有
  {
    id: 'bird_faced_urn', name: '鸟面瓮', art: '🏺', tier: 'rare',
    desc: '每当你打出能力牌，回复 2 点生命。',
    onCardPlayed: (g, _r, c) => {
      if (cardDef(c).type === 'power') g.heal(g.player, 2);
    },
  },
  {
    id: 'calipers', name: '外卡钳', art: '📏', tier: 'rare',
    desc: '回合开始时，格挡只会失去 15 点，而不是全部消失。',
  },
  {
    id: 'dead_branch', name: '枯枝', art: '🌿', tier: 'rare',
    desc: '每当一张牌被消耗，将一张随机牌加入手牌。',
    onExhaust: (g) => {
      const [c] = g.randomCards(1, () => true);
      if (c) g.addToHand(c);
    },
  },
  {
    id: 'du_vu_doll', name: '毒巫娃娃', art: '🪆', tier: 'rare',
    desc: '牌组中每有一张诅咒，战斗开始时获得 1 点力量。',
    onCombatStart: (g) => {
      const n = g.run.deck.filter((c) => cardDef(c).type === 'curse').length;
      if (n) g.apply(g.player, 'strength', n);
    },
  },
  {
    id: 'fossilized_helix', name: '螺旋化石', art: '🐚', tier: 'rare',
    desc: '每场战斗开始时，获得 1 层缓冲。',
    onCombatStart: (g) => g.apply(g.player, 'buffer', 1),
  },
  {
    id: 'ginger', name: '生姜', art: '🫚', tier: 'rare',
    desc: '你不会再被虚弱。',
  },
  {
    id: 'turnip', name: '萝卜', art: '🥕', tier: 'rare',
    desc: '你不会再被脆弱。',
  },
  {
    id: 'ice_cream', name: '冰淇淋', art: '🍦', tier: 'rare',
    desc: '未使用的能量会保留到下回合。',
  },
  {
    id: 'incense_burner', name: '香炉', art: '🪔', tier: 'rare', counter: true,
    desc: '每 6 回合，获得 1 层无实体。',
    onTurnStartPostDraw: (g, r) => {
      r.counter++;
      if (r.counter >= 6) {
        r.counter = 0;
        g.apply(g.player, 'intangible', 1);
      }
    },
  },
  {
    id: 'lizard_tail', name: '蜥蜴尾巴', art: '🦎', tier: 'rare',
    desc: '你即将死亡时，改为回复 50% 最大生命（仅一次）。',
    onDeath: (g, r) => {
      if (r.used) return false;
      r.used = true;
      g.player.hp = Math.max(1, Math.floor(g.player.maxHp / 2));
      g.emit('heal', g.player.uid, g.player.hp, '蜥蜴尾巴');
      return true;
    },
  },
  {
    id: 'mango', name: '芒果', art: '🥭', tier: 'rare',
    desc: '最大生命 +14。',
    onPickup: (run) => run.gainMaxHp(14),
  },
  {
    id: 'old_coin', name: '古钱币', art: '🪙', tier: 'rare',
    desc: '拾取时获得 300 金币。',
    onPickup: (run) => run.gainGold(300),
  },
  {
    id: 'peace_pipe', name: '和平烟斗', art: '🚬', tier: 'rare',
    desc: '可以在休息处移除一张牌。',
  },
  {
    id: 'shovel', name: '铲子', art: '🪏', tier: 'rare',
    desc: '可以在休息处挖掘遗物。',
  },
  {
    id: 'girya', name: '吉里亚', art: '🏋️', tier: 'rare', counter: true,
    desc: '可以在休息处举重以永久获得 1 点力量（至多 3 次）。',
    onCombatStart: (g, r) => {
      if (r.counter > 0) g.apply(g.player, 'strength', r.counter);
    },
  },
  {
    id: 'tungsten_rod', name: '钨合金棍', art: '🔩', tier: 'rare',
    desc: '每当你将要失去生命，少失去 1 点。',
    modHpLoss: (_g, _r, n) => Math.max(0, n - 1),
  },
  {
    id: 'torii', name: '鸟居', art: '⛩️', tier: 'rare',
    desc: '受到不高于 5 点的未被格挡的攻击伤害时，伤害降为 1。',
    modHpLoss: (_g, _r, n, atk) => (atk && n > 1 && n <= 5 ? 1 : n),
  },
  {
    id: 'unceasing_top', name: '不休陀螺', art: '🪀', tier: 'rare',
    desc: '回合中手牌为空时，抽 1 张牌。',
  },
  {
    id: 'thread_and_needle', name: '针线', art: '🪡', tier: 'rare',
    desc: '每场战斗开始时，获得 4 层多层护甲。',
    onCombatStart: (g) => g.apply(g.player, 'plated_armor', 4),
  },
  {
    id: 'pocketwatch', name: '怀表', art: '⌚', tier: 'rare',
    desc: '若你在一个回合中打出不多于 3 张牌，下回合多抽 3 张牌。',
    onTurnEnd: (g) => {
      if (g.t.cards <= 3) g.apply(g.player, 'draw_next', 3);
    },
  },
  {
    id: 'prayer_wheel', name: '转经轮', art: '☸️', tier: 'rare',
    desc: '普通战斗额外提供一组卡牌奖励。',
  },
  {
    id: 'champion_belt', name: '冠军腰带', art: '🥇', tier: 'rare', char: 'ironclad',
    desc: '每当你给予易伤，同时给予 1 层虚弱。',
  },
  {
    id: 'tough_bandages', name: '坚韧绷带', art: '🩹', tier: 'rare', char: 'silent',
    desc: '每当你丢弃一张牌，获得 3 点格挡。',
    onCombatStart: (g) => g.apply(g.player, 'reflexes', 3),
  },
  {
    id: 'astral_gem', name: '星辰宝石', art: '💎', tier: 'rare', char: 'regent',
    desc: '回合开始时，若你没有星辰，获得 2 颗星辰。',
    onTurnStartPostDraw: (g) => {
      if (g.stars === 0) g.gainStars(2);
    },
  },
  {
    id: 'grave_urn', name: '墓土之瓮', art: '⚱️', tier: 'rare', char: 'necrobinder',
    desc: '每当奥斯提死亡，给予所有敌人 6 层灾厄。',
    onCombatStart: (g) => g.apply(g.player, 'grave_urn_power', 6),
  },
  {
    id: 'emotion_chip', name: '情感芯片', art: '💟', tier: 'rare', char: 'defect',
    desc: '若你上回合失去过生命，回合开始时触发所有充能球的被动。',
    onTurnStartPostDraw: (g, r) => {
      if (r.counter > 0) {
        r.counter = 0;
        g.triggerPassives();
      }
    },
    onPlayerHpLoss: (g, r) => {
      if (g.phase === 'enemy') r.counter = 1;
    },
    onCombatStart: (_g, r) => (r.counter = 0),
  },
  {
    id: 'endless_scroll', name: '无尽卷轴', art: '📜', tier: 'rare', char: 'claude',
    desc: '每当你压缩时，获得 1 点能量。',
    onCompact: (g) => g.gainEnergy(1),
  },
  // ======================================================== 首领遗物
  {
    id: 'coffee_dripper', name: '咖啡滤杯', art: '☕', tier: 'boss', energy: 1,
    desc: '每回合获得 1 点能量。\n你无法在休息处休息。',
  },
  {
    id: 'fusion_hammer', name: '融合之锤', art: '🔨', tier: 'boss', energy: 1,
    desc: '每回合获得 1 点能量。\n你无法在休息处锻造。',
  },
  {
    id: 'ectoplasm', name: '灵体外质', art: '🫧', tier: 'boss', energy: 1,
    desc: '每回合获得 1 点能量。\n你无法再获得金币。',
  },
  {
    id: 'sozu', name: '草药', art: '🌿', tier: 'boss', energy: 1,
    desc: '每回合获得 1 点能量。\n你无法再获得药水。',
  },
  {
    id: 'velvet_choker', name: '天鹅绒颈圈', art: '🎀', tier: 'boss', energy: 1,
    desc: '每回合获得 1 点能量。\n每回合最多打出 6 张牌。',
  },
  {
    id: 'philosophers_stone', name: '贤者之石', art: '🔴', tier: 'boss', energy: 1,
    desc: '每回合获得 1 点能量。\n所有敌人开始战斗时拥有 1 点力量。',
    onCombatStart: (g) => g.alive.forEach((e) => g.apply(e, 'strength', 1, e)),
  },
  {
    id: 'busted_crown', name: '破碎王冠', art: '👑', tier: 'boss', energy: 1,
    desc: '每回合获得 1 点能量。\n卡牌奖励的选项减少 2 个。',
  },
  {
    id: 'mark_of_pain', name: '痛苦印记', art: '🩸', tier: 'boss', energy: 1,
    desc: '每回合获得 1 点能量。\n每场战斗开始时，将 2 张伤口洗入抽牌堆。',
    onCombatStart: (g) => g.addToDraw('wound', false, 2),
  },
  {
    id: 'cursed_key', name: '诅咒钥匙', art: '🗝️', tier: 'boss', energy: 1,
    desc: '每回合获得 1 点能量。\n每当你打开宝箱，获得一张诅咒。',
  },
  {
    id: 'runic_pyramid', name: '符文金字塔', art: '🔺', tier: 'boss',
    desc: '回合结束时不再丢弃手牌。',
  },
  {
    id: 'snecko_eye', name: '蛇眼', art: '👁️', tier: 'boss',
    desc: '每回合多抽 2 张牌。\n战斗开始时陷入混乱（抽到的牌费用随机）。',
    onCombatStart: (g) => {
      g.drawPerTurnBonus += 2;
      g.apply(g.player, 'confused', 1, g.player);
    },
  },
  {
    id: 'black_star', name: '黑星', art: '⭐', tier: 'boss',
    desc: '精英敌人额外掉落一件遗物。',
  },
  {
    id: 'astrolabe', name: '星盘', art: '🧭', tier: 'boss',
    desc: '拾取时，选择 3 张牌变化并升级。',
    onPickup: (run) =>
      run.selectCards({
        title: '选择 3 张牌变化并升级',
        cards: run.deck.filter((c) => c.id !== 'ascenders_bane'),
        min: 3,
        max: 3,
        onDone: (sel) => sel.forEach((c) => run.transformCard(c, true)),
      }),
  },
  {
    id: 'empty_cage', name: '空笼子', art: '🪺', tier: 'boss',
    desc: '拾取时，从牌组中移除 2 张牌。',
    onPickup: (run) =>
      run.selectCards({
        title: '选择 2 张牌移除',
        cards: run.deck.filter((c) => c.id !== 'ascenders_bane'),
        min: 2,
        max: 2,
        onDone: (sel) => sel.forEach((c) => run.removeCard(c)),
      }),
  },
  {
    id: 'pandoras_box', name: '潘多拉魔盒', art: '🎁', tier: 'boss',
    desc: '拾取时，变化牌组中所有的初始打击和防御。',
    onPickup: (run) => {
      for (const c of run.deck.filter((x) => cardDef(x).tags?.includes('starter'))) run.transformCard(c);
    },
  },
  {
    id: 'tiny_house', name: '小房子', art: '🏠', tier: 'boss',
    desc: '拾取时：最大生命 +5，获得 50 金币、1 瓶药水，随机升级 1 张牌。',
    onPickup: (run) => {
      run.gainMaxHp(5);
      run.gainGold(50);
      run.obtainPotion(run.randomPotionId());
      run.upgradeRandom(1);
    },
  },
  {
    id: 'sacred_bark', name: '圣树皮', art: '🌳', tier: 'boss',
    desc: '药水效果翻倍。',
  },
  {
    id: 'calling_bell', name: '召唤铃', art: '🔔', tier: 'boss',
    desc: '拾取时，获得一张诅咒和 3 件随机遗物。',
    onPickup: (run) => {
      run.addCard('injury');
      for (let i = 0; i < 3; i++) run.obtainRelic(run.randomRelicId(i === 0 ? 'common' : i === 1 ? 'uncommon' : 'rare'));
    },
  },
  {
    id: 'black_blood', name: '黑色之血', art: '🖤', tier: 'boss', char: 'ironclad',
    desc: '替换燃烧之血。战斗结束时，回复 12 点生命。',
    onPickup: (run) => run.loseRelic('burning_blood'),
    onVictory: (g) => g.heal(g.player, 12),
  },
  {
    id: 'ring_of_serpent', name: '巨蛇之戒', art: '🐍', tier: 'boss', char: 'silent',
    desc: '替换蛇之戒指。每回合多抽 1 张牌。',
    onPickup: (run) => run.loseRelic('ring_of_snake'),
    onCombatStart: (g) => (g.drawPerTurnBonus += 1),
  },
  {
    id: 'celestial_crown', name: '天穹之冠', art: '👑', tier: 'boss', char: 'regent',
    desc: '替换神授之权。战斗开始时获得 3 颗星辰；回合开始时获得 1 颗星辰。',
    onPickup: (run) => run.loseRelic('divine_right'),
    onCombatStartPostDraw: (g) => g.gainStars(2),
    onTurnStartPostDraw: (g) => g.gainStars(1),
  },
  {
    id: 'eternal_phylactery', name: '不朽经匣', art: '🏺', tier: 'boss', char: 'necrobinder',
    desc: '替换缚魂经匣。战斗开始时召唤 5；回合开始时召唤 2。',
    onPickup: (run) => run.loseRelic('bound_phylactery'),
    onCombatStartPostDraw: (g) => g.summon(3),
    onTurnStartPostDraw: (g) => g.summon(2),
  },
  {
    id: 'frozen_core', name: '冰冻核心', art: '🧊', tier: 'boss', char: 'defect',
    desc: '替换破碎核心。若回合结束时有空的充能球栏位，生成 1 个冰霜。',
    onPickup: (run) => run.loseRelic('cracked_core'),
    onTurnEnd: (g) => {
      if (g.orbs.length < g.orbSlots) g.channel('frost');
    },
  },
  {
    id: 'inserter', name: '插入器', art: '🔌', tier: 'boss', char: 'defect',
    desc: '每 2 回合，获得 1 个充能球栏位。',
    counter: true,
    onCombatStart: (_g, r) => (r.counter = 0),
    onTurnStartPostDraw: (g, r) => {
      r.counter++;
      if (r.counter >= 2) {
        r.counter = 0;
        g.addOrbSlots(1);
      }
    },
  },
  {
    id: 'blazing_spark', name: '燎原之火', art: '🔥', tier: 'boss', char: 'claude',
    desc: '替换星火。每当你打出一张牌，记录 1。你的上下文窗口 -3。',
    onPickup: (run) => run.loseRelic('the_spark'),
    onCombatStart: (g) => g.resizeContext(-3),
    afterCardPlayed: (g) => g.note(1),
  },
  // ======================================================== 商店
  {
    id: 'membership_card', name: '会员卡', art: '💳', tier: 'shop',
    desc: '商店中所有商品半价。',
  },
  {
    id: 'the_courier', name: '送货员', art: '🛵', tier: 'shop',
    desc: '商店中所有商品八折。',
  },
  {
    id: 'strange_spoon', name: '奇怪的勺子', art: '🥄', tier: 'shop',
    desc: '本应被消耗的牌有 50% 几率改为放入弃牌堆。',
  },
  {
    id: 'chemical_x', name: '化学物 X', art: '🧪', tier: 'shop',
    desc: 'X 费牌的 X 值额外 +2。',
  },
  {
    id: 'lees_waffle', name: '华夫饼', art: '🧇', tier: 'shop',
    desc: '最大生命 +7，并回复所有生命。',
    onPickup: (run) => {
      run.gainMaxHp(7);
      run.heal(run.maxHp);
    },
  },
  {
    id: 'medical_kit', name: '医疗包', art: '🩺', tier: 'shop',
    desc: '状态牌可以被打出，打出时将其消耗。',
  },
  {
    id: 'sling', name: '勇气投石索', art: '🪃', tier: 'shop',
    desc: '精英战开始时，获得 2 点力量。',
    onCombatStart: (g) => {
      if (g.elite) g.apply(g.player, 'strength', 2);
    },
  },
  {
    id: 'clockwork_souvenir', name: '发条纪念品', art: '⚙️', tier: 'shop',
    desc: '每场战斗开始时，获得 1 层人工制品。',
    onCombatStart: (g) => g.apply(g.player, 'artifact', 1),
  },
  {
    id: 'cauldron', name: '大锅', art: '🍲', tier: 'shop',
    desc: '拾取时，用随机药水填满药水栏。',
    onPickup: (run) => {
      while (run.potionSlotsFree > 0 && run.obtainPotion(run.randomPotionId())) {
        /* fill */
      }
    },
  },
  {
    id: 'dollys_mirror', name: '多莉之镜', art: '🪞', tier: 'shop',
    desc: '拾取时，复制牌组中的一张牌。',
    onPickup: (run) =>
      run.selectCards({
        title: '选择一张牌复制',
        cards: run.deck.filter((c) => cardDef(c).type !== 'curse'),
        min: 1,
        max: 1,
        onDone: (sel) => sel.forEach((c) => run.addCard({ ...c, uid: makeCard(c.id).uid, ench: c.ench ? { ...c.ench } : undefined })),
      }),
  },
  {
    id: 'runic_capacitor', name: '符文电容', art: '🔋', tier: 'shop', char: 'defect',
    desc: '每场战斗开始时，获得 3 个充能球栏位。',
    onCombatStart: (g) => g.addOrbSlots(3),
  },
  {
    id: 'rubber_duck', name: '小黄鸭', art: '🦆', tier: 'shop', char: 'claude',
    desc: '回合开始时，思考 2。',
    flavor: '把问题讲给它听，答案往往就自己浮现了。',
    onTurnStart: (g) => g.think(2),
  },
  {
    id: 'warped_tongs', name: '扭曲钳子', art: '🗜️', tier: 'shop',
    desc: '回合开始时，随机升级手牌中的一张牌（本场战斗）。',
    onTurnStartPostDraw: (g) => {
      const cands = g.hand.filter(canUpgrade);
      if (cands.length) upgradeCard(g.rng.pick(cands));
    },
  },
  // ======================================================== 事件 / 特殊
  {
    id: 'circlet', name: '头环', art: '⭕', tier: 'event', counter: true,
    desc: '没什么用，但看着挺好看。',
  },
  {
    id: 'golden_idol', name: '金色神像', art: '🗿', tier: 'event',
    desc: '战斗获得的金币提高 25%。',
  },
  {
    id: 'odd_mushroom', name: '怪蘑菇', art: '🍄', tier: 'event',
    desc: '你有易伤时，受到的攻击伤害只提高 25%。',
  },
  {
    id: 'bloody_idol', name: '血之神像', art: '🩸', tier: 'event',
    desc: '每当你获得金币，回复 5 点生命。',
  },
  {
    id: 'mark_of_bloom', name: '绽放印记', art: '🌸', tier: 'event',
    desc: '你无法再回复生命。',
  },
  // ======================================================== 先古之民的赠礼
  {
    id: 'neows_lament', name: '涅奥的悲恸', art: '😢', tier: 'ancient', counter: true,
    desc: '接下来 3 场战斗中，敌人的生命变为 1。',
    onPickup: (_run, r) => (r.counter = 3),
    onCombatStart: (g, r) => {
      if (r.counter > 0) {
        r.counter--;
        for (const e of g.alive) e.hp = 1;
      }
    },
  },
  {
    id: 'pael_eye', name: '帕埃尔之眼', art: '👁️', tier: 'ancient',
    desc: '每场战斗开始时，获得 2 点力量和 2 点敏捷，但失去 4 点生命。',
    onCombatStart: (g) => {
      g.apply(g.player, 'strength', 2);
      g.apply(g.player, 'dexterity', 2);
      g.loseHp(g.player, 4, g.player);
    },
  },
  {
    id: 'orobas_prism', name: '奥罗巴斯棱镜', art: '🔷', tier: 'ancient',
    desc: '每场战斗开始时，将一张随机升级过的稀有牌加入手牌，它本回合费用为 0。',
    onCombatStartPostDraw: (g) => {
      const [c] = g.randomCards(1, (id) => cardDef(id).rarity === 'rare');
      if (c) {
        upgradeCard(c);
        c.costTurn = 0;
        g.addToHand(c);
      }
    },
  },
  {
    id: 'tezcatara_ember', name: '特兹卡塔拉的余烬', art: '🔥', tier: 'ancient',
    desc: '每回合开始时获得 1 点能量。每场战斗开始时受到 6 点伤害。',
    energy: 1,
    onCombatStart: (g) => g.loseHp(g.player, 6, g.player),
  },
  {
    id: 'nonupeipe_purse', name: '诺努佩佩的钱袋', art: '👛', tier: 'ancient',
    desc: '战斗获得的金币翻倍。',
  },
  {
    id: 'vakuu_mask', name: '瓦库的面具', art: '🎭', tier: 'ancient',
    desc: '每场战斗开始时，随机给予一名敌人 3 层易伤和 3 层虚弱。',
    onCombatStart: (g) => {
      const e = g.randomEnemy();
      if (e) {
        g.apply(e, 'vulnerable', 3);
        g.apply(e, 'weak', 3);
      }
    },
  },
]);
