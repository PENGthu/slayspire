import { definePotions } from '../registry';
import { cardDef, upgradeCard } from '../cards';
import type { Combat } from '../combat';
import type { PotionDef } from '../types';

type Ctx = Parameters<PotionDef['use']>[0];

const discoverType = (g: Combat, p: number, filter: (id: string) => boolean, pool: 'char' | 'colorless' = 'char') => {
  const opts = g.randomCards(3, filter, pool);
  g.discover(opts, (c) => {
    c.costTurn = 0;
    g.addToHand(c, false, p);
  });
};

const G = (ctx: Ctx) => ctx.g!;

definePotions([
  // ---------------------------------------------------------------- 普通
  {
    id: 'fire_potion', name: '火焰药水', art: '🔥', color: '#e2552a', rarity: 'common', target: 'enemy',
    desc: '对目标敌人造成 20 点伤害。', combatOnly: true,
    use: (x) => G(x).thorns(x.t!, 20 * x.potency, null),
  },
  {
    id: 'explosive_potion', name: '爆炸药水', art: '💣', color: '#d9792b', rarity: 'common', target: 'none',
    desc: '对所有敌人造成 10 点伤害。', combatOnly: true,
    use: (x) => G(x).alive.forEach((e) => G(x).thorns(e, 10 * x.potency, null)),
  },
  {
    id: 'block_potion', name: '格挡药水', art: '🛡️', color: '#4a86c8', rarity: 'common', target: 'none',
    desc: '获得 12 点格挡。', combatOnly: true,
    use: (x) => G(x).gainBlock(G(x).player, 12 * x.potency),
  },
  {
    id: 'energy_potion', name: '能量药水', art: '⚡', color: '#e8b923', rarity: 'common', target: 'none',
    desc: '获得 2 点能量。', combatOnly: true,
    use: (x) => G(x).gainEnergy(2 * x.potency),
  },
  {
    id: 'strength_potion', name: '力量药水', art: '💪', color: '#c0392b', rarity: 'common', target: 'none',
    desc: '获得 2 点力量。', combatOnly: true,
    use: (x) => G(x).apply(G(x).player, 'strength', 2 * x.potency),
  },
  {
    id: 'dexterity_potion', name: '敏捷药水', art: '🦶', color: '#3fae5b', rarity: 'common', target: 'none',
    desc: '获得 2 点敏捷。', combatOnly: true,
    use: (x) => G(x).apply(G(x).player, 'dexterity', 2 * x.potency),
  },
  {
    id: 'swift_potion', name: '迅捷药水', art: '💨', color: '#5bc0de', rarity: 'common', target: 'none',
    desc: '抽 3 张牌。', combatOnly: true,
    use: (x) => G(x).draw(3 * x.potency),
  },
  {
    id: 'fear_potion', name: '恐惧药水', art: '😱', color: '#7d3c98', rarity: 'common', target: 'enemy',
    desc: '给予 3 层易伤。', combatOnly: true,
    use: (x) => G(x).apply(x.t, 'vulnerable', 3 * x.potency),
  },
  {
    id: 'weak_potion', name: '虚弱药水', art: '🥀', color: '#95a5a6', rarity: 'common', target: 'enemy',
    desc: '给予 3 层虚弱。', combatOnly: true,
    use: (x) => G(x).apply(x.t, 'weak', 3 * x.potency),
  },
  {
    id: 'poison_potion', name: '毒药', art: '☠️', color: '#58b947', rarity: 'common', target: 'enemy',
    desc: '给予 6 层中毒。', combatOnly: true,
    use: (x) => G(x).apply(x.t, 'poison', 6 * x.potency),
  },
  {
    id: 'flex_potion', name: '屈伸药水', art: '🏋️', color: '#d35400', rarity: 'common', target: 'none',
    desc: '获得 5 点力量。回合结束时失去 5 点力量。', combatOnly: true,
    use: (x) => {
      G(x).apply(G(x).player, 'strength', 5 * x.potency);
      G(x).apply(G(x).player, 'temp_strength', 5 * x.potency);
    },
  },
  {
    id: 'speed_potion', name: '速度药水', art: '🏃', color: '#16a085', rarity: 'common', target: 'none',
    desc: '获得 5 点敏捷。回合结束时失去 5 点敏捷。', combatOnly: true,
    use: (x) => {
      G(x).apply(G(x).player, 'dexterity', 5 * x.potency);
      G(x).apply(G(x).player, 'temp_dex', 5 * x.potency);
    },
  },
  {
    id: 'attack_potion', name: '攻击药水', art: '🗡️', color: '#c0392b', rarity: 'common', target: 'none',
    desc: '从 3 张随机攻击牌中选择 1 张加入手牌，它本回合费用为 0。', combatOnly: true,
    use: (x) => discoverType(G(x), x.potency, (id) => cardDef(id).type === 'attack'),
  },
  {
    id: 'skill_potion', name: '技能药水', art: '📘', color: '#2e86c1', rarity: 'common', target: 'none',
    desc: '从 3 张随机技能牌中选择 1 张加入手牌，它本回合费用为 0。', combatOnly: true,
    use: (x) => discoverType(G(x), x.potency, (id) => cardDef(id).type === 'skill'),
  },
  {
    id: 'power_potion', name: '能力药水', art: '🌀', color: '#8e44ad', rarity: 'common', target: 'none',
    desc: '从 3 张随机能力牌中选择 1 张加入手牌，它本回合费用为 0。', combatOnly: true,
    use: (x) => discoverType(G(x), x.potency, (id) => cardDef(id).type === 'power'),
  },
  {
    id: 'colorless_potion', name: '无色药水', art: '⚪', color: '#bdc3c7', rarity: 'common', target: 'none',
    desc: '从 3 张随机无色牌中选择 1 张加入手牌，它本回合费用为 0。', combatOnly: true,
    use: (x) => discoverType(G(x), x.potency, () => true, 'colorless'),
  },
  {
    id: 'blood_potion', name: '鲜血药水', art: '🩸', color: '#a93226', rarity: 'common', char: 'ironclad', target: 'none',
    desc: '回复 20% 最大生命。', outOfCombat: true,
    use: (x) => {
      if (x.g && !x.g.over) x.g.heal(x.g.player, Math.floor(x.g.player.maxHp * 0.2 * x.potency));
      else x.run.heal(Math.floor(x.run.maxHp * 0.2 * x.potency));
    },
  },
  {
    id: 'cunning_potion', name: '狡诈药水', art: '🔪', color: '#27ae60', rarity: 'common', char: 'silent', target: 'none',
    desc: '将 3 张小刀+加入手牌。', combatOnly: true,
    use: (x) => G(x).addToHand('shiv', true, 3 * x.potency),
  },
  {
    id: 'star_potion', name: '星光药水', art: '⭐', color: '#f39c12', rarity: 'common', char: 'regent', target: 'none',
    desc: '获得 3 颗星辰。', combatOnly: true,
    use: (x) => G(x).gainStars(3 * x.potency),
  },
  {
    id: 'bone_potion', name: '骨灰药水', art: '🦴', color: '#d7bde2', rarity: 'common', char: 'necrobinder', target: 'none',
    desc: '召唤 8。', combatOnly: true,
    use: (x) => G(x).summon(8 * x.potency),
  },
  {
    id: 'focus_potion', name: '集中药水', art: '🔷', color: '#4f8fd6', rarity: 'common', char: 'defect', target: 'none',
    desc: '获得 2 点集中。', combatOnly: true,
    use: (x) => G(x).apply(G(x).player, 'focus', 2 * x.potency),
  },
  // ---------------------------------------------------------------- 罕见
  {
    id: 'ancient_potion', name: '古代药水', art: '🏺', color: '#f1c40f', rarity: 'uncommon', target: 'none',
    desc: '获得 1 层人工制品。', combatOnly: true,
    use: (x) => G(x).apply(G(x).player, 'artifact', 1 * x.potency),
  },
  {
    id: 'regen_potion', name: '再生药水', art: '💚', color: '#2ecc71', rarity: 'uncommon', target: 'none',
    desc: '获得 5 层再生。', combatOnly: true,
    use: (x) => G(x).apply(G(x).player, 'regen', 5 * x.potency),
  },
  {
    id: 'essence_of_steel', name: '钢铁精华', art: '🔩', color: '#7f8c8d', rarity: 'uncommon', target: 'none',
    desc: '获得 4 层多层护甲。', combatOnly: true,
    use: (x) => G(x).apply(G(x).player, 'plated_armor', 4 * x.potency),
  },
  {
    id: 'liquid_bronze', name: '液态青铜', art: '🥉', color: '#cd7f32', rarity: 'uncommon', target: 'none',
    desc: '获得 3 点荆棘。', combatOnly: true,
    use: (x) => G(x).apply(G(x).player, 'thorns', 3 * x.potency),
  },
  {
    id: 'gamblers_brew', name: '赌徒佳酿', art: '🎲', color: '#e67e22', rarity: 'uncommon', target: 'none',
    desc: '丢弃任意张手牌，然后抽等量的牌。', combatOnly: true,
    use: (x) => {
      const g = G(x);
      g.chooseHand({ title: '丢弃任意张牌', min: 0, max: 10 }, (s) => {
        s.forEach((c) => g.discardCard(c));
        g.draw(s.length);
      });
    },
  },
  {
    id: 'duplication_potion', name: '复制药水', art: '🪞', color: '#a569bd', rarity: 'uncommon', target: 'none',
    desc: '你打出的下一张牌会被打出两次。', combatOnly: true,
    use: (x) => G(x).apply(G(x).player, 'duplication', 1 * x.potency),
  },
  {
    id: 'liquid_memories', name: '液态记忆', art: '🧠', color: '#5dade2', rarity: 'uncommon', target: 'none',
    desc: '将弃牌堆中的一张牌放入手牌，它本回合费用为 0。', combatOnly: true,
    use: (x) => {
      const g = G(x);
      g.chooseCards({ title: '选择一张牌放入手牌', cards: [...g.discardPile], min: 1, max: x.potency }, (s) =>
        s.forEach((c) => {
          c.costTurn = 0;
          g.moveTo(c, 'hand');
        }),
      );
    },
  },
  {
    id: 'distilled_chaos', name: '蒸馏混沌', art: '🌀', color: '#6c3483', rarity: 'uncommon', target: 'none',
    desc: '打出抽牌堆顶部的 3 张牌。', combatOnly: true,
    use: (x) => {
      const g = G(x);
      for (let i = 0; i < 3 * x.potency; i++) {
        if (!g.drawPile.length) g.shuffleDiscardIntoDraw();
        const c = g.drawPile[g.drawPile.length - 1 - 0];
        if (!c) break;
        g.autoPlay(c, g.randomEnemy());
      }
    },
  },
  {
    id: 'fruit_juice', name: '果汁', art: '🧃', color: '#e74c3c', rarity: 'uncommon', target: 'none',
    desc: '最大生命 +5。', outOfCombat: true,
    use: (x) => {
      if (x.g && !x.g.over) x.g.gainMaxHp(5 * x.potency);
      else x.run.gainMaxHp(5 * x.potency);
    },
  },
  {
    id: 'forge_potion', name: '锻造药水', art: '⚒️', color: '#e59866', rarity: 'uncommon', char: 'regent', target: 'none',
    desc: '铸造 10。', combatOnly: true,
    use: (x) => G(x).forge(10 * x.potency),
  },
  {
    id: 'doom_potion', name: '灾厄药水', art: '💀', color: '#76448a', rarity: 'uncommon', char: 'necrobinder', target: 'enemy',
    desc: '给予 15 层灾厄。', combatOnly: true,
    use: (x) => G(x).apply(x.t, 'doom', 15 * x.potency),
  },
  {
    id: 'capacitor_potion', name: '电容药水', art: '🔌', color: '#7fb3e6', rarity: 'uncommon', char: 'defect', target: 'none',
    desc: '获得 2 个充能球栏位。', combatOnly: true,
    use: (x) => G(x).addOrbSlots(2 * x.potency),
  },
  // ---------------------------------------------------------------- 稀有
  {
    id: 'fairy_in_bottle', name: '瓶中精灵', art: '🧚', color: '#f5b7b1', rarity: 'rare', target: 'none',
    desc: '你即将死亡时，自动使用：回复 30% 最大生命。', onDeath: true, combatOnly: true,
    use: (x) => {
      const g = G(x);
      g.player.hp = Math.max(1, Math.floor(g.player.maxHp * 0.3 * x.potency));
      g.emit('heal', g.player.uid, g.player.hp, '瓶中精灵');
    },
  },
  {
    id: 'smoke_bomb', name: '烟雾弹', art: '💨', color: '#566573', rarity: 'rare', target: 'none',
    desc: '逃离非首领战斗（不获得奖励）。', combatOnly: true,
    use: (x) => G(x).escape(),
  },
  {
    id: 'entropic_brew', name: '混沌佳酿', art: '🍷', color: '#943126', rarity: 'rare', target: 'none',
    desc: '用随机药水填满所有空的药水栏。', outOfCombat: true,
    use: (x) => {
      while (x.run.potionSlotsFree > 0) {
        let id = x.run.randomPotionId();
        while (id === 'entropic_brew') id = x.run.randomPotionId();
        if (!x.run.obtainPotion(id)) break;
      }
    },
  },
  {
    id: 'cultist_potion', name: '邪教徒药水', art: '🐦', color: '#2c3e50', rarity: 'rare', target: 'none',
    desc: '获得 1 层仪式（回合结束时获得 1 点力量）。', combatOnly: true,
    use: (x) => G(x).apply(G(x).player, 'ritual', 1 * x.potency),
  },
  {
    id: 'heart_of_iron', name: '钢铁之心', art: '❤️', color: '#566573', rarity: 'rare', target: 'none',
    desc: '获得 6 层金属化。', combatOnly: true,
    use: (x) => G(x).apply(G(x).player, 'metallicize', 6 * x.potency),
  },
  {
    id: 'elixir', name: '灵药', art: '⚗️', color: '#d4ac0d', rarity: 'rare', char: 'ironclad', target: 'none',
    desc: '消耗任意张手牌。', combatOnly: true,
    use: (x) => {
      const g = G(x);
      g.chooseHand({ title: '消耗任意张牌', min: 0, max: 10 }, (s) => s.forEach((c) => g.exhaustCard(c)));
    },
  },
  {
    id: 'ghost_in_a_jar', name: '罐中幽灵', art: '👻', color: '#d5dbdb', rarity: 'rare', char: 'silent', target: 'none',
    desc: '获得 1 层无实体。', combatOnly: true,
    use: (x) => G(x).apply(G(x).player, 'intangible', 1 * x.potency),
  },
  {
    id: 'crown_elixir', name: '王冠灵药', art: '👑', color: '#f7dc6f', rarity: 'rare', char: 'regent', target: 'none',
    desc: '本回合打出卡牌无需花费星辰。获得 2 颗星辰。', combatOnly: true,
    use: (x) => {
      G(x).apply(G(x).player, 'free_stars', 1);
      G(x).gainStars(2 * x.potency);
    },
  },
  {
    id: 'essence_of_darkness', name: '黑暗精华', art: '🌑', color: '#6c4fa0', rarity: 'rare', char: 'defect', target: 'none',
    desc: '每有一个充能球栏位，生成 1 个黑暗。', combatOnly: true,
    use: (x) => {
      const g = G(x);
      for (let i = 0; i < g.orbSlots * x.potency; i++) g.channel('dark');
    },
  },
  {
    id: 'soul_vessel', name: '灵魂容器', art: '🫙', color: '#bb8fce', rarity: 'rare', char: 'necrobinder', target: 'none',
    desc: '将 3 张灵魂+加入手牌。', combatOnly: true,
    use: (x) => {
      const cs = G(x).addToHand('soul', true, 3 * x.potency);
      cs.forEach(upgradeCard);
    },
  },
]);
