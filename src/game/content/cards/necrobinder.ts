import { defineCards } from '../../registry';
import { COST_X } from '../../types';
import type { Combat } from '../../combat';
import type { Card, Enemy } from '../../types';
import { B, D, M, hit } from './helpers';

const NB = 'necrobinder' as const;

/** 奥斯提发动卡牌攻击 */
function osty(g: Combat, c: Card, t: Enemy | null, hits = 1) {
  let killed = false;
  for (let i = 0; i < hits; i++) {
    if (!t || t.dead) break;
    killed = g.ostyAttack(t, D(g, c), c).killed || killed;
  }
  return killed;
}

function ostyAll(g: Combat, c: Card) {
  for (const e of g.alive) g.ostyAttack(e, D(g, c), c);
}

const needOsty = (g: Combat) => (g.ostyAlive ? true : '奥斯提不在场');

defineCards([
  // ---------------------------------------------------------------- 基础
  {
    id: 'strike_n', name: '打击', color: NB, type: 'attack', rarity: 'basic', cost: 1, target: 'enemy',
    dmg: [6, 9], text: '造成 {D} 点伤害。', art: '⚔️', tags: ['strike', 'starter'],
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'defend_n', name: '防御', color: NB, type: 'skill', rarity: 'basic', cost: 1, target: 'self',
    blk: [5, 8], text: '获得 {B} 点格挡。', art: '🛡️', tags: ['starter'],
    play: (g, c) => g.block(B(g, c)),
  },
  {
    id: 'bodyguard', name: '骸骨守卫', color: NB, type: 'skill', rarity: 'basic', cost: 1, target: 'self',
    mag: [5, 8], text: '召唤 {M}。', art: '🦴',
    play: (g, c) => g.summon(M(c)),
  },
  {
    id: 'unleash', name: '释放', color: NB, type: 'attack', rarity: 'basic', cost: 1, target: 'enemy',
    text: '奥斯提造成 {D} 点伤害。\n（6 点 + 奥斯提当前生命值的一半）', art: '✋', tags: ['osty'],
    dmgFn: (g, c) => (c.up ? 9 : 6) + Math.floor((g?.osty?.hp ?? 0) / 2),
    canPlay: needOsty,
    play: (g, c, t) => osty(g, c, t),
  },
  // ---------------------------------------------------------------- 特殊：灵魂
  {
    id: 'soul', name: '灵魂', color: 'colorless', type: 'skill', rarity: 'special', cost: 0, target: 'self',
    mag: [2, 3], exhaust: true, noPool: true, text: '抽 {M} 张牌。', art: '👻',
    play: (g, c) => {
      g.flags.souls = (g.flags.souls ?? 0) + 1;
      g.draw(M(c));
    },
  },
  // ---------------------------------------------------------------- 普通
  {
    id: 'bone_claw', name: '骨爪', color: NB, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [10, 14], text: '奥斯提造成 {D} 点伤害。', art: '🦴', tags: ['osty'],
    canPlay: needOsty,
    play: (g, c, t) => osty(g, c, t),
  },
  {
    id: 'mark_of_death', name: '死亡印记', color: NB, type: 'skill', rarity: 'common', cost: 1, target: 'enemy',
    mag: [9, 13], text: '给予 {M} 层灾厄。', art: '💀',
    play: (g, c, t) => g.apply(t, 'doom', M(c)),
  },
  {
    id: 'reap', name: '收割镰', color: NB, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [7, 10], mag: [4, 5], text: '造成 {D} 点伤害。\n给予 {M} 层灾厄。', art: '🌾',
    play: (g, c, t) => {
      hit(g, c, t);
      g.apply(t, 'doom', M(c));
    },
  },
  {
    id: 'soul_drain', name: '灵魂汲取', color: NB, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [8, 11], text: '造成 {D} 点伤害。\n将 1 张灵魂加入手牌。', art: '🫗',
    play: (g, c, t) => {
      hit(g, c, t);
      g.addToHand('soul');
    },
  },
  {
    id: 'bone_wall', name: '骨墙', color: NB, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    blk: [6, 8], mag: [3, 5], text: '获得 {B} 点格挡。\n召唤 {M}。', art: '🧱',
    play: (g, c) => {
      g.block(B(g, c));
      g.summon(M(c));
    },
  },
  {
    id: 'whispers', name: '亡者低语', color: NB, type: 'skill', rarity: 'common', cost: 0, target: 'all',
    mag: [3, 4], text: '给予所有敌人 {M} 层灾厄。\n抽 1 张牌。', art: '🗣️',
    play: (g, c) => {
      for (const e of g.alive) g.apply(e, 'doom', M(c));
      g.draw(1);
    },
  },
  {
    id: 'grave_soil', name: '墓土', color: NB, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    blk: [7, 10], text: ['获得 {B} 点格挡。\n（7 点，奥斯提在场时再 +4）', '获得 {B} 点格挡。\n（10 点，奥斯提在场时再 +4）'], art: '⚱️',
    blkFn: (g, c) => (c.up ? 10 : 7) + (g?.ostyAlive ? 4 : 0),
    play: (g, c) => g.block(B(g, c)),
  },
  {
    id: 'bone_storm', name: '骨刃风暴', color: NB, type: 'attack', rarity: 'common', cost: 1, target: 'all',
    dmg: [6, 9], text: '奥斯提对所有敌人造成 {D} 点伤害。', art: '🌪️', tags: ['osty'],
    canPlay: needOsty,
    play: (g, c) => ostyAll(g, c),
  },
  {
    id: 'soul_siphon', name: '摄魂', color: NB, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    blk: [5, 7], mag: [2, 3], text: '获得 {B} 点格挡。\n将 {M} 张灵魂洗入抽牌堆。', art: '🌀',
    play: (g, c) => {
      g.block(B(g, c));
      g.addToDraw('soul', false, M(c));
    },
  },
  {
    id: 'protect', name: '护主', color: NB, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    mag: [5, 7], text: '召唤 {M}。\n抽 1 张牌。', art: '🫂',
    play: (g, c) => {
      g.summon(M(c));
      g.draw(1);
    },
  },
  {
    id: 'ghost_touch', name: '幽魂之触', color: NB, type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
    dmg: [3, 5], mag: [3, 4], text: '造成 {D} 点伤害。\n给予 {M} 层灾厄。', art: '👻',
    play: (g, c, t) => {
      hit(g, c, t);
      g.apply(t, 'doom', M(c));
    },
  },
  {
    id: 'decay_wave', name: '腐朽之潮', color: NB, type: 'attack', rarity: 'common', cost: 2, target: 'all',
    dmg: [8, 11], mag: [3, 4], text: '对所有敌人造成 {D} 点伤害。\n给予所有敌人 {M} 层灾厄。', art: '🌊',
    play: (g, c) => {
      for (const e of g.alive) {
        g.attack(e, D(g, c), c);
        g.apply(e, 'doom', M(c));
      }
    },
  },
  {
    id: 'twin_scythe', name: '双刃镰', color: NB, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [5, 7], text: '造成 {D} 点伤害两次。', art: '⚔️',
    play: (g, c, t) => hit(g, c, t, 2),
  },
  {
    id: 'dread', name: '恐惧', color: NB, type: 'skill', rarity: 'common', cost: 1, target: 'enemy',
    mag: [5, 8], text: '给予 2 层虚弱。\n给予 {M} 层灾厄。', art: '😨',
    play: (g, c, t) => {
      g.apply(t, 'weak', 2);
      g.apply(t, 'doom', M(c));
    },
  },
  {
    id: 'rattle', name: '骸骨喧响', color: NB, type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
    dmg: [4, 7], text: '奥斯提造成 {D} 点伤害。\n抽 1 张牌。', art: '🎶', tags: ['osty'],
    canPlay: needOsty,
    play: (g, c, t) => {
      osty(g, c, t);
      g.draw(1);
    },
  },
  // ---------------------------------------------------------------- 罕见
  {
    id: 'death_knell', name: '丧钟', color: NB, type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy',
    exhaust: true, text: ['使敌人的灾厄翻倍。', '使敌人的灾厄变为三倍。'], art: '🔔',
    play: (g, c, t) => {
      const d = g.pw(t, 'doom');
      if (d > 0) g.apply(t, 'doom', d * (c.up ? 2 : 1));
    },
  },
  {
    id: 'bone_feast', name: '骨之盛宴', color: NB, type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy',
    text: ['奥斯提造成等同于其最大生命的伤害（{D}）。', '奥斯提造成等同于其最大生命 1.5 倍的伤害（{D}）。'],
    art: '🍖', tags: ['osty'],
    dmgFn: (g, c) => Math.floor((g?.osty?.maxHp ?? 0) * (c.up ? 1.5 : 1)),
    canPlay: needOsty,
    play: (g, c, t) => osty(g, c, t),
  },
  {
    id: 'sacrifice', name: '献祭', color: NB, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    text: ['奥斯提死亡。\n获得等同于其生命值的格挡。', '奥斯提死亡。\n获得等同于其生命值 1.5 倍的格挡。'], art: '🗡️',
    canPlay: needOsty,
    play: (g, c) => {
      const hp = g.osty?.hp ?? 0;
      g.killOsty();
      g.gainBlock(g.player, Math.floor(hp * (c.up ? 1.5 : 1)));
    },
  },
  {
    id: 'reanimate', name: '复生', color: NB, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [11, 15], exhaust: true, text: '召唤 {M}。', art: '⚰️',
    play: (g, c) => g.summon(M(c)),
  },
  {
    id: 'soul_storm', name: '灵魂风暴', color: NB, type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy',
    dmg: [5, 6], text: '造成 {D} 点伤害。\n本场战斗中你每打出过一张灵魂，额外造成一次。', art: '🌪️',
    play: (g, c, t) => hit(g, c, t, 1 + (g.flags.souls ?? 0)),
  },
  {
    id: 'possession', name: '亡魂附体', color: NB, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [3, 4], text: '每当你打出灵魂，给予所有敌人 {M} 层灾厄。', art: '👻',
    play: (g, c) => g.apply(g.player, 'possession', M(c)),
  },
  {
    id: 'death_pact', name: '死亡契约', color: NB, type: 'power', rarity: 'uncommon', cost: 2, target: 'self',
    mag: [2, 3], text: '回合开始时，召唤 {M}。', art: '📜',
    play: (g, c) => g.apply(g.player, 'death_pact', M(c)),
  },
  {
    id: 'bone_armor', name: '骨甲', color: NB, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [4, 6], text: '回合结束时，若奥斯提在场，获得 {M} 点格挡。', art: '🦴',
    play: (g, c) => g.apply(g.player, 'bone_armor', M(c)),
  },
  {
    id: 'blight_aura', name: '凋零光环', color: NB, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [3, 4], text: '回合结束时，给予所有敌人 {M} 层灾厄。', art: '🥀',
    play: (g, c) => g.apply(g.player, 'blight_aura', M(c)),
  },
  {
    id: 'devour_soul', name: '噬魂', color: NB, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    dmg: [9, 12], text: '造成 {D} 点伤害。\n若击杀敌人，获得 1 点能量并抽 2 张牌。', art: '😋',
    play: (g, c, t) => {
      if (hit(g, c, t)) {
        g.gainEnergy(1);
        g.draw(2);
      }
    },
  },
  {
    id: 'corpse_collector', name: '收尸人', color: NB, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    blk: [4, 6], text: '每有一名带有灾厄的敌人，抽 1 张牌并获得 {B} 点格挡。', art: '🪦',
    play: (g, c) => {
      const n = g.alive.filter((e) => g.has(e, 'doom')).length;
      for (let i = 0; i < n; i++) g.block(B(g, c));
      g.draw(n);
    },
  },
  {
    id: 'grasp', name: '不死之握', color: NB, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    dmg: [8, 11], text: '奥斯提造成 {D} 点伤害。\n给予 1 层虚弱和 1 层易伤。', art: '🫳', tags: ['osty'],
    canPlay: needOsty,
    play: (g, c, t) => {
      osty(g, c, t);
      g.apply(t, 'weak', 1);
      g.apply(t, 'vulnerable', 1);
    },
  },
  {
    id: 'seance', name: '招魂', color: NB, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [2, 3], text: '将 {M} 张灵魂加入手牌。', art: '🕯️',
    play: (g, c) => g.addToHand('soul', false, M(c)),
  },
  {
    id: 'wither', name: '凋亡', color: NB, type: 'skill', rarity: 'uncommon', cost: [1, 0], target: 'enemy',
    exhaust: true, text: '给予等同于敌人已损失生命值的灾厄。', art: '🍂',
    play: (g, _c, t) => {
      if (t) g.apply(t, 'doom', t.maxHp - t.hp);
    },
  },
  {
    id: 'bone_cage', name: '骨牢', color: NB, type: 'skill', rarity: 'uncommon', cost: 2, target: 'self',
    blk: [12, 16], mag: [4, 6], text: '获得 {B} 点格挡。\n召唤 {M}。', art: '🦴',
    play: (g, c) => {
      g.block(B(g, c));
      g.summon(M(c));
    },
  },
  {
    id: 'haunt', name: '作祟', color: NB, type: 'skill', rarity: 'uncommon', cost: 1, target: 'all',
    mag: [6, 8], text: '给予所有敌人 {M} 层灾厄。', art: '🏚️',
    play: (g, c) => {
      for (const e of g.alive) g.apply(e, 'doom', M(c));
    },
  },
  {
    id: 'soul_link', name: '灵魂链接', color: NB, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [4, 6], text: '每当你打出灵魂，奥斯提对随机敌人造成 {M} 点伤害。', art: '🔗',
    play: (g, c) => g.apply(g.player, 'soul_link', M(c)),
  },
  {
    id: 'ossify', name: '骨化', color: NB, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [2, 3], text: '奥斯提的最大生命翻倍（至多增加 {M}0 点）。', art: '🦷',
    canPlay: needOsty,
    play: (g, c) => g.summon(Math.min(g.osty?.maxHp ?? 0, M(c) * 10)),
  },
  // ---------------------------------------------------------------- 稀有
  {
    id: 'doomsday', name: '末日审判', color: NB, type: 'skill', rarity: 'rare', cost: 3, target: 'all',
    mag: [16, 22], exhaust: true, text: '给予所有敌人 {M} 层灾厄。', art: '☄️',
    play: (g, c) => {
      for (const e of g.alive) g.apply(e, 'doom', M(c));
    },
  },
  {
    id: 'eternal_bond', name: '永恒契约', color: NB, type: 'power', rarity: 'rare', cost: [3, 2], target: 'self',
    mag: 5, text: '奥斯提死亡时，立刻召唤 {M}。', art: '♾️',
    play: (g, c) => g.apply(g.player, 'eternal_bond', M(c)),
  },
  {
    id: 'lich_form', name: '巫妖形态', color: NB, type: 'power', rarity: 'rare', cost: 3, target: 'self',
    mag: [4, 6], text: '回合开始时，召唤 {M}，并将 1 张灵魂加入手牌。', art: '☠️',
    play: (g, c) => g.apply(g.player, 'lich_form', M(c)),
  },
  {
    id: 'bone_explosion', name: '骸骨爆裂', color: NB, type: 'attack', rarity: 'rare', cost: 2, target: 'all',
    text: ['奥斯提死亡，对所有敌人造成等同于其生命值 2 倍的伤害（{D}）。', '奥斯提死亡，对所有敌人造成等同于其生命值 3 倍的伤害（{D}）。'],
    art: '💥', tags: ['osty'],
    dmgFn: (g, c) => (g?.osty?.hp ?? 0) * (c.up ? 3 : 2),
    canPlay: needOsty,
    play: (g, c) => {
      const dmg = D(g, c);
      g.killOsty();
      for (const e of g.alive) g.attack(e, dmg, c, null);
    },
  },
  {
    id: 'soul_harvest', name: '灵魂收割', color: NB, type: 'attack', rarity: 'rare', cost: 1, target: 'enemy',
    exhaust: [true, false], text: '造成等同于敌人灾厄层数的伤害。', art: '🌙',
    play: (g, c, t) => {
      if (t) g.attack(t, g.pw(t, 'doom'), c);
    },
  },
  {
    id: 'danse_macabre', name: '死亡之舞', color: NB, type: 'power', rarity: 'rare', cost: 1, target: 'self',
    mag: [3, 4], text: '每当你打出一张奥斯提攻击牌，获得 {M} 点格挡。', art: '💃',
    play: (g, c) => g.apply(g.player, 'danse_macabre', M(c)),
  },
  {
    id: 'reaper_form', name: '收割者形态', color: NB, type: 'power', rarity: 'rare', cost: 2, target: 'self',
    mag: [3, 5], text: '每当一名敌人死亡，召唤 {M} 并抽 1 张牌。', art: '🌾',
    play: (g, c) => g.apply(g.player, 'reaper_power', M(c)),
  },
  {
    id: 'legion', name: '骸骨军团', color: NB, type: 'skill', rarity: 'rare', cost: COST_X, target: 'self',
    mag: [4, 6], text: '召唤 X×{M}。', art: '🪖',
    play: (g, c) => g.summon(g.x * M(c)),
  },
  {
    id: 'undying', name: '不死', color: NB, type: 'skill', rarity: 'rare', cost: [2, 1], target: 'self',
    exhaust: true, text: '获得 1 层缓冲。\n召唤 5。', art: '🧟',
    play: (g) => {
      g.apply(g.player, 'buffer', 1);
      g.summon(5);
    },
  },
  {
    id: 'requiem', name: '安魂曲', color: NB, type: 'attack', rarity: 'rare', cost: 2, target: 'all',
    dmg: [6, 8], text: '对所有敌人造成 {D} 点伤害。\n（消耗堆中每有一张灵魂，伤害 +2）', art: '🎼',
    dmgFn: (g, c) => (c.up ? 8 : 6) + 2 * (g?.exhaustPile.filter((x) => x.id === 'soul').length ?? 0),
    play: (g, c) => g.attackAll(D(g, c), c),
  },
]);
