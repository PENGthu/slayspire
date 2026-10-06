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

/** 灾厄已不低于当前生命的敌人立即死亡（与灾厄在回合开始时的结算相同） */
function reap(g: Combat, e: Enemy) {
  if (e.dead || g.pw(e, 'doom') < e.hp) return;
  g.emit('text', e.uid, undefined, '灾厄降临');
  g.loseHp(e, e.hp + e.block, g.player);
}

// ---------------------------------------------------------------- 扩充：奥斯提、灾厄与灵魂各有更多选择
defineCards([
  // ---------------------------------------------------------------- 普通
  {
    id: 'grave_robber', name: '盗墓', color: NB, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [7, 10], text: '造成 {D} 点伤害。\n若目标带有灾厄，将 1 张灵魂加入手牌。', art: '⛏️',
    play: (g, c, t) => {
      const doomed = !!t && g.has(t, 'doom');
      hit(g, c, t);
      if (doomed) g.addToHand('soul');
    },
  },
  {
    id: 'bone_toss', name: '掷骨', color: NB, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [5, 7], text: '奥斯提造成 {D} 点伤害两次。', art: '🦴', tags: ['osty'],
    canPlay: needOsty,
    play: (g, c, t) => osty(g, c, t, 2),
  },
  {
    id: 'last_rites', name: '临终祷告', color: NB, type: 'skill', rarity: 'common', cost: 0, target: 'enemy',
    mag: [3, 5], text: '给予 {M} 层灾厄。\n若该敌人的灾厄已不低于其生命，抽 2 张牌。', art: '🙏',
    play: (g, c, t) => {
      g.apply(t, 'doom', M(c));
      if (t && !t.dead && g.pw(t, 'doom') >= t.hp) g.draw(2);
    },
  },
  {
    id: 'carrion_crows', name: '腐鸦', color: NB, type: 'attack', rarity: 'common', cost: 1, target: 'all',
    dmg: [3, 4], mag: [1, 2], text: '随机对敌人造成 {D} 点伤害 3 次，\n每次给予 {M} 层灾厄。', art: '🐦‍⬛',
    play: (g, c) => {
      for (let i = 0; i < 3; i++) {
        const e = g.randomEnemy();
        if (!e) break;
        g.attack(e, D(g, c), c);
        if (!e.dead) g.apply(e, 'doom', M(c));
      }
    },
  },
  {
    id: 'skeletal_hand', name: '骷髅之手', color: NB, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [6, 9], mag: [2, 3], text: '奥斯提造成 {D} 点伤害。\n召唤 {M}。', art: '🖐️', tags: ['osty'],
    canPlay: needOsty,
    play: (g, c, t) => {
      osty(g, c, t);
      g.summon(M(c));
    },
  },
  {
    id: 'funeral_veil', name: '送葬面纱', color: NB, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    blk: [8, 11], mag: [4, 6], text: '获得 {B} 点格挡。\n若奥斯提不在场，召唤 {M}。', art: '🖤',
    play: (g, c) => {
      g.block(B(g, c));
      if (!g.ostyAlive) g.summon(M(c));
    },
  },
  // ---------------------------------------------------------------- 罕见
  {
    id: 'marrow_infusion', name: '骨髓灌注', color: NB, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [2, 3], text: '奥斯提获得 {M} 点力量。\n（奥斯提死亡后失去）', art: '💉',
    canPlay: needOsty,
    play: (g, c) => {
      if (g.osty) g.apply(g.osty, 'strength', M(c));
    },
  },
  {
    id: 'soul_well', name: '灵魂之井', color: NB, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [3, 4], text: '每当你打出灵魂，获得 {M} 点格挡。', art: '⛲',
    play: (g, c) => g.apply(g.player, 'soul_well', M(c)),
  },
  {
    id: 'doom_blade', name: '宿命之刃', color: NB, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    dmg: [6, 9], text: '造成 {D} 点伤害，\n外加目标灾厄层数一半的伤害。', art: '🗡️',
    play: (g, c, t) => {
      if (t) g.attack(t, D(g, c) + Math.floor(g.pw(t, 'doom') / 2), c);
    },
  },
  {
    id: 'contagion', name: '传染', color: NB, type: 'skill', rarity: 'uncommon', cost: [1, 0], target: 'enemy',
    text: '其他所有敌人获得与目标等量的灾厄。', art: '🦠',
    play: (g, _c, t) => {
      const d = t ? g.pw(t, 'doom') : 0;
      if (d > 0) for (const e of g.alive) if (e !== t) g.apply(e, 'doom', d);
    },
  },
  {
    id: 'phylactery', name: '命匣', color: NB, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [2, 3], text: '奥斯提死亡时，将 {M} 张灵魂加入手牌。', art: '🏺',
    play: (g, c) => g.apply(g.player, 'phylactery', M(c)),
  },
  {
    id: 'necrotic_touch', name: '坏死之触', color: NB, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    dmg: [7, 10], text: '造成 {D} 点伤害。\n给予等同于失去生命值的灾厄。', art: '🫳',
    play: (g, c, t) => {
      if (!t) return;
      const r = g.attack(t, D(g, c), c);
      if (r.dealt > 0 && !t.dead) g.apply(t, 'doom', r.dealt);
    },
  },
  {
    id: 'bone_resolve', name: '骸骨意志', color: NB, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [2, 3], text: '每当你召唤，获得 {M} 点格挡。', art: '🦴',
    play: (g, c) => g.apply(g.player, 'bone_resolve', M(c)),
  },
  {
    id: 'mass_grave', name: '万人坑', color: NB, type: 'attack', rarity: 'uncommon', cost: 2, target: 'all',
    dmg: [9, 12], mag: [5, 7], text: '对所有敌人造成 {D} 点伤害。\n每击杀 1 名敌人，召唤 {M}。', art: '🪦',
    play: (g, c) => {
      let kills = 0;
      for (const e of g.alive) if (g.attack(e, D(g, c), c).killed) kills++;
      if (kills) g.summon(kills * M(c));
    },
  },
  {
    id: 'disinter', name: '掘尸', color: NB, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [4, 7], exhaust: true, text: '将消耗堆中的所有灵魂洗入抽牌堆。\n召唤 {M}。', art: '⚰️',
    play: (g, c) => {
      for (const x of g.exhaustPile.filter((y) => y.id === 'soul')) g.moveTo(x, 'draw');
      g.summon(M(c));
    },
  },
  {
    id: 'undertaker', name: '送葬人', color: NB, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [1, 2], text: '每当一名敌人死亡，将 {M} 张灵魂加入手牌。', art: '🎩',
    play: (g, c) => g.apply(g.player, 'undertaker', M(c)),
  },
  {
    id: 'death_coil', name: '死亡缠绕', color: NB, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    dmg: [9, 12], mag: [3, 4], text: '造成 {D} 点伤害。\n若目标带有灾厄，召唤 {M}。', art: '🌀',
    play: (g, c, t) => {
      const doomed = !!t && g.has(t, 'doom');
      hit(g, c, t);
      if (doomed) g.summon(M(c));
    },
  },
  {
    id: 'bone_spear', name: '骨矛', color: NB, type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy',
    dmg: [15, 20], text: '奥斯提造成 {D} 点伤害。\n若击杀敌人，召唤 5。', art: '🔱', tags: ['osty'],
    canPlay: needOsty,
    play: (g, c, t) => {
      if (osty(g, c, t)) g.summon(5);
    },
  },
  {
    id: 'cull', name: '剔除', color: NB, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    dmg: [7, 10], text: '造成 {D} 点伤害。\n然后若目标的灾厄不低于其生命，立即将其击杀。', art: '✂️',
    play: (g, c, t) => {
      hit(g, c, t);
      if (t) reap(g, t);
    },
  },
  {
    id: 'spectral_shield', name: '幽冥护盾', color: NB, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    text: ['获得 {B} 点格挡。\n（5 点，本场战斗中每打出过 1 张灵魂再 +2）', '获得 {B} 点格挡。\n（8 点，本场战斗中每打出过 1 张灵魂再 +2）'], art: '🛡️',
    blkFn: (g, c) => (c.up ? 8 : 5) + 2 * (g?.flags.souls ?? 0),
    play: (g, c) => g.block(B(g, c)),
  },
  {
    id: 'grave_offering', name: '死者供奉', color: NB, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [3, 4], text: '召唤 {M}。\n每有 1 名带有灾厄的敌人，再召唤 {M}。', art: '🕯️',
    play: (g, c) => g.summon(M(c) * (1 + g.alive.filter((e) => g.has(e, 'doom')).length)),
  },
  // ---------------------------------------------------------------- 稀有
  {
    id: 'army_of_the_dead', name: '亡者大军', color: NB, type: 'skill', rarity: 'rare', cost: 2, target: 'self',
    mag: [3, 4], exhaust: true, text: '将 {M} 张灵魂加入手牌。\n召唤 6。', art: '🧟',
    play: (g, c) => {
      g.addToHand('soul', false, M(c));
      g.summon(6);
    },
  },
  {
    id: 'bone_colossus', name: '骸骨巨像', color: NB, type: 'power', rarity: 'rare', cost: [3, 2], target: 'self',
    text: '回合开始时，若奥斯提在场，奥斯提获得 1 点力量。', art: '🗿',
    play: (g) => g.apply(g.player, 'bone_colossus', 1),
  },
  {
    id: 'grim_reaper', name: '死神降临', color: NB, type: 'attack', rarity: 'rare', cost: 3, target: 'all',
    dmg: [12, 16], exhaust: true, text: '对所有敌人造成 {D} 点伤害。\n然后灾厄不低于其生命的敌人立即死亡。', art: '💀',
    play: (g, c) => {
      g.attackAll(D(g, c), c);
      for (const e of [...g.alive]) reap(g, e);
    },
  },
  {
    id: 'book_of_the_dead', name: '亡者之书', color: NB, type: 'power', rarity: 'rare', cost: [2, 1], target: 'self',
    mag: 3, text: '每当你打出灵魂，召唤 {M}。', art: '📖',
    play: (g, c) => g.apply(g.player, 'book_of_the_dead', M(c)),
  },
  {
    id: 'undead_horde', name: '尸潮', color: NB, type: 'power', rarity: 'rare', cost: 2, target: 'self',
    mag: [10, 14], text: '奥斯提死亡时，对所有敌人造成 {M} 点伤害。', art: '🌊',
    play: (g, c) => g.apply(g.player, 'undead_horde', M(c)),
  },
  {
    id: 'pale_rider', name: '苍白骑士', color: NB, type: 'attack', rarity: 'rare', cost: 2, target: 'all',
    dmg: [7, 9], text: '奥斯提对所有敌人造成 {D} 点伤害两次。', art: '🐎', tags: ['osty'],
    canPlay: needOsty,
    play: (g, c) => {
      ostyAll(g, c);
      ostyAll(g, c);
    },
  },
  {
    id: 'eternal_night', name: '永夜', color: NB, type: 'power', rarity: 'rare', cost: [3, 2], target: 'self',
    text: '回合结束时，所有敌人的灾厄增加一半。', art: '🌑',
    play: (g) => g.apply(g.player, 'eternal_night', 1),
  },
]);
