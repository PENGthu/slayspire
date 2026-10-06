import { defineCards } from '../../registry';
import { canUpgrade, cardDef, upgradeCard, uv } from '../../cards';
import { COST_X } from '../../types';
import { B, M, hit, hitAll, hitRandom } from './helpers';

const O = 'regent' as const;

/** 储君：星辰 + 铸造君王之刃 */
defineCards([
  // ---------------------------------------------------------------- 基础
  {
    id: 'strike_o', name: '打击', color: O, type: 'attack', rarity: 'basic', cost: 1, target: 'enemy',
    dmg: [6, 9], text: '造成 {D} 点伤害。', art: '⚔️', tags: ['strike', 'starter'],
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'defend_o', name: '防御', color: O, type: 'skill', rarity: 'basic', cost: 1, target: 'self',
    blk: [5, 8], text: '获得 {B} 点格挡。', art: '🛡️', tags: ['starter'],
    play: (g, c) => g.block(B(g, c)),
  },
  {
    id: 'falling_star', name: '坠星', color: O, type: 'attack', rarity: 'basic', cost: 0, star: 2, target: 'enemy',
    dmg: [8, 11], text: '造成 {D} 点伤害。\n给予 1 层虚弱和 1 层易伤。', art: '🌠',
    play: (g, c, t) => {
      hit(g, c, t);
      g.apply(t, 'weak', 1);
      g.apply(t, 'vulnerable', 1);
    },
  },
  {
    id: 'venerate', name: '崇敬', color: O, type: 'skill', rarity: 'basic', cost: 1, target: 'self',
    mag: [2, 3], text: '获得 {M} 颗星辰。', art: '🙏',
    play: (g, c) => g.gainStars(M(c)),
  },
  // ---------------------------------------------------------------- 特殊：君王之刃
  {
    id: 'sovereign_blade', name: '君王之刃', color: O, type: 'attack', rarity: 'special', cost: 2, target: 'enemy',
    dmg: [10, 14], retain: true, noPool: true, text: '造成 {D} 点伤害。\n（铸造可提高伤害）', art: '🗡️',
    tags: ['blade'],
    dmgFn: (g, c) => (c.up ? 14 : 10) + (g?.forged ?? 0),
    // 「砺刃」：本回合君王之刃费用降低
    costFn: (g, _c, cost) => cost - g.pw(g.player, 'blade_discount'),
    play: (g, c, t) => hit(g, c, t),
  },
  // ---------------------------------------------------------------- 普通
  {
    id: 'forge_ahead', name: '预锻', color: O, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    blk: [5, 7], mag: [5, 7], text: '获得 {B} 点格挡。\n铸造 {M}。', art: '⚒️',
    play: (g, c) => {
      g.block(B(g, c));
      g.forge(M(c));
    },
  },
  {
    id: 'starfall_strike', name: '星落打击', color: O, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [8, 11], text: '造成 {D} 点伤害。\n获得 1 颗星辰。', art: '💫', tags: ['strike'],
    play: (g, c, t) => {
      hit(g, c, t);
      g.gainStars(1);
    },
  },
  {
    id: 'royal_guard', name: '御前护卫', color: O, type: 'skill', rarity: 'common', cost: 1, star: 1, target: 'self',
    blk: [9, 12], text: '获得 {B} 点格挡。\n抽 1 张牌。', art: '💂',
    play: (g, c) => {
      g.block(B(g, c));
      g.draw(1);
    },
  },
  {
    id: 'twinkle', name: '闪烁', color: O, type: 'skill', rarity: 'common', cost: 0, target: 'self',
    mag: [1, 2], text: '获得 1 颗星辰。\n抽 {M} 张牌。', art: '✨', exhaust: [true, false],
    play: (g, c) => {
      g.gainStars(1);
      g.draw(M(c));
    },
  },
  {
    id: 'celestial_impact', name: '天体撞击', color: O, type: 'attack', rarity: 'common', cost: 1, star: 2, target: 'enemy',
    dmg: [16, 21], text: '造成 {D} 点伤害。', art: '☄️',
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'decree', name: '敕令', color: O, type: 'skill', rarity: 'common', cost: 1, star: 1, target: 'all',
    blk: [7, 9], mag: [1, 2], text: '获得 {B} 点格挡。\n给予所有敌人 {M} 层虚弱。', art: '📜',
    play: (g, c) => {
      g.block(B(g, c));
      for (const e of g.alive) g.apply(e, 'weak', M(c));
    },
  },
  {
    id: 'precise_cut', name: '精准切割', color: O, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [6, 9], mag: [3, 5], text: '造成 {D} 点伤害。\n铸造 {M}。', art: '✂️',
    play: (g, c, t) => {
      hit(g, c, t);
      g.forge(M(c));
    },
  },
  {
    id: 'astral_shield', name: '星界之盾', color: O, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    blk: [5, 7], mag: [2, 3], text: ['获得 {B} 点格挡。\n（5 点，每有 1 颗星辰再 +{M}）', '获得 {B} 点格挡。\n（7 点，每有 1 颗星辰再 +{M}）'], art: '🌟',
    blkFn: (g, c) => (c.up ? 7 : 5) + (g ? g.stars * (uv(cardDef(c).mag, c.up) ?? 0) : 0),
    play: (g, c) => g.block(B(g, c)),
  },
  {
    id: 'radiance', name: '光辉', color: O, type: 'skill', rarity: 'common', cost: 0, star: 1, target: 'self',
    mag: [2, 3], text: '抽 {M} 张牌。', art: '🔆',
    play: (g, c) => g.draw(M(c)),
  },
  {
    id: 'crown_weight', name: '王冠之重', color: O, type: 'attack', rarity: 'common', cost: 2, target: 'enemy',
    dmg: [12, 16], text: '造成 {D} 点伤害。\n若你至少有 3 颗星辰，再造成一次。', art: '👑',
    play: (g, c, t) => hit(g, c, t, g.stars >= 3 ? 2 : 1),
  },
  {
    id: 'constellation', name: '星座', color: O, type: 'attack', rarity: 'common', cost: 1, star: 1, target: 'all',
    dmg: [9, 12], text: '对所有敌人造成 {D} 点伤害。', art: '♒',
    play: (g, c) => hitAll(g, c),
  },
  {
    id: 'offering_of_light', name: '光之献礼', color: O, type: 'skill', rarity: 'common', cost: 0, target: 'self',
    mag: [2, 3], text: '失去 2 点生命。\n获得 {M} 颗星辰。', art: '🕯️',
    play: (g, c) => {
      g.loseHp(g.player, 2, g.player);
      g.gainStars(M(c));
    },
  },
  {
    id: 'royal_reprimand', name: '王室训诫', color: O, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [9, 12], mag: [1, 2], text: '造成 {D} 点伤害。\n给予 {M} 层易伤。', art: '☝️',
    play: (g, c, t) => {
      hit(g, c, t);
      g.apply(t, 'vulnerable', M(c));
    },
  },
  {
    id: 'shining_parry', name: '闪耀格挡', color: O, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    blk: [7, 10], mag: [2, 3], text: '获得 {B} 点格挡。\n铸造 {M}。', art: '🤺',
    play: (g, c) => {
      g.block(B(g, c));
      g.forge(M(c));
    },
  },
  {
    id: 'guiding_light', name: '引路之光', color: O, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    mag: [4, 6], text: '将君王之刃从抽牌堆或弃牌堆放入手牌。\n铸造 {M}。', art: '🔦',
    play: (g, c) => {
      g.forge(M(c));
      const blade = [...g.drawPile, ...g.discardPile].find((x) => x.id === 'sovereign_blade');
      if (blade) g.moveTo(blade, 'hand');
    },
  },
  {
    id: 'comet_tail', name: '彗尾', color: O, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [5, 7], text: '造成 {D} 点伤害两次。\n若本回合你花费过星辰，获得 1 颗星辰。', art: '🌠',
    play: (g, c, t) => {
      hit(g, c, t, 2);
      if (g.t.starsSpent > 0) g.gainStars(1);
    },
  },
  // ---------------------------------------------------------------- 罕见
  {
    id: 'nova', name: '新星', color: O, type: 'attack', rarity: 'uncommon', cost: 1, target: 'all',
    dmg: [5, 7], text: '花费所有星辰。\n每花费 1 颗，对所有敌人造成 {D} 点伤害。', art: '💥',
    play: (g, c) => {
      const s = g.stars;
      g.spendStars(s);
      hitAll(g, c, s);
    },
  },
  {
    id: 'sovereignty', name: '王权', color: O, type: 'power', rarity: 'uncommon', cost: [1, 0], target: 'self',
    text: '回合开始时，获得 1 颗星辰。', art: '👑',
    play: (g) => g.apply(g.player, 'sovereignty', 1),
  },
  {
    id: 'star_forge', name: '星辰锻炉', color: O, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [2, 3], text: '每当你获得星辰，铸造 {M}。', art: '🔥',
    play: (g, c) => g.apply(g.player, 'star_forge', M(c)),
  },
  {
    id: 'black_hole', name: '黑洞', color: O, type: 'power', rarity: 'uncommon', cost: 2, target: 'self',
    mag: [3, 4], text: '每当你花费 1 颗星辰，对随机敌人造成 {M} 点伤害。', art: '🕳️',
    play: (g, c) => g.apply(g.player, 'black_hole', M(c)),
  },
  {
    id: 'gravity', name: '引力', color: O, type: 'skill', rarity: 'uncommon', cost: 1, star: 2, target: 'all',
    mag: [2, 3], text: '给予所有敌人 {M} 层虚弱和 {M} 层易伤。', art: '🪐',
    play: (g, c) => {
      for (const e of g.alive) {
        g.apply(e, 'weak', M(c));
        g.apply(e, 'vulnerable', M(c));
      }
    },
  },
  {
    id: 'royal_wrath', name: '君王之怒', color: O, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    dmg: [6, 9], text: '造成 {D} 点伤害。\n（铸造值同样计入这张牌的伤害）', art: '😤',
    dmgFn: (g, c) => (c.up ? 9 : 6) + (g?.forged ?? 0),
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'celestial_barrier', name: '天穹屏障', color: O, type: 'skill', rarity: 'uncommon', cost: 2, target: 'self',
    blk: [13, 17], text: '获得 {B} 点格挡。\n获得 1 颗星辰。', art: '🌌',
    play: (g, c) => {
      g.block(B(g, c));
      g.gainStars(1);
    },
  },
  {
    id: 'meteor_shower', name: '流星雨', color: O, type: 'attack', rarity: 'uncommon', cost: 0, star: 3, target: 'all',
    dmg: [6, 8], mag: [4, 5], text: '随机对敌人造成 {D} 点伤害 {M} 次。', art: '🌧️',
    play: (g, c) => hitRandom(g, c, M(c)),
  },
  {
    id: 'royal_armor', name: '王族铠甲', color: O, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [2, 3], text: '回合结束时，你每有 1 颗星辰（至多 5 颗），获得 {M} 点格挡。', art: '🥋',
    play: (g, c) => g.apply(g.player, 'royal_armor', M(c)),
  },
  {
    id: 'conscript', name: '征召', color: O, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [3, 5], text: '抽 2 张牌。\n铸造 {M}。', art: '📯',
    play: (g, c) => {
      g.draw(2);
      g.forge(M(c));
    },
  },
  {
    id: 'destiny', name: '天命', color: O, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [3, 4], text: '检视抽牌堆顶部 {M} 张牌，选择 1 张放入手牌，其余丢弃。', art: '🔮',
    play: (g, c) => {
      if (g.drawPile.length < M(c)) g.shuffleDiscardIntoDraw();
      const top = g.drawPile.slice(-M(c)).reverse();
      g.chooseCards({ title: '选择 1 张牌放入手牌', cards: top, min: 1, max: 1 }, (s) => {
        for (const x of top) {
          if (s.includes(x)) g.moveTo(x, 'hand');
          else g.discardCard(x);
        }
      });
    },
  },
  {
    id: 'stardust', name: '星尘', color: O, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [2, 3], text: '获得 {M} 颗星辰。\n下回合获得 1 点能量。', art: '🌫️',
    play: (g, c) => {
      g.gainStars(M(c));
      g.apply(g.player, 'energized', 1);
    },
  },
  {
    id: 'eclipse', name: '日蚀', color: O, type: 'attack', rarity: 'uncommon', cost: 1, star: 1, target: 'enemy',
    dmg: [11, 15], text: '造成 {D} 点伤害。\n给予 2 层虚弱。', art: '🌑',
    play: (g, c, t) => {
      hit(g, c, t);
      g.apply(t, 'weak', 2);
    },
  },
  {
    id: 'heavenly_decree', name: '天谕', color: O, type: 'skill', rarity: 'uncommon', cost: 0, star: 1, target: 'self',
    mag: [6, 9], text: '获得 {M} 点活力。', art: '📯',
    play: (g, c) => g.apply(g.player, 'vigor', M(c)),
  },
  {
    id: 'orbit', name: '环绕', color: O, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [1, 2], text: '每当你打出君王之刃，获得 {M} 颗星辰。', art: '🪐',
    play: (g, c) => g.apply(g.player, 'stellar_tide', M(c)),
  },
  {
    id: 'regal_presence', name: '威仪', color: O, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    blk: [8, 11], retain: true, text: '获得 {B} 点格挡。', art: '🫅',
    play: (g, c) => g.block(B(g, c)),
  },
  {
    id: 'starlight', name: '星光', color: O, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [2, 3], text: '每当你花费星辰，获得 {M} 点格挡。', art: '🌟',
    play: (g, c) => g.apply(g.player, 'starlight', M(c)),
  },
  {
    id: 'rally', name: '号令', color: O, type: 'skill', rarity: 'uncommon', cost: [1, 0], target: 'self',
    text: '你打出的下一张花费星辰的牌会被打出两次。', art: '📢',
    play: (g) => g.apply(g.player, 'twin_stars', 1),
  },
  // ---------------------------------------------------------------- 稀有
  {
    id: 'supernova', name: '超新星', color: O, type: 'attack', rarity: 'rare', cost: 2, star: 3, target: 'all',
    dmg: [30, 40], exhaust: true, text: '对所有敌人造成 {D} 点伤害。', art: '🌞',
    play: (g, c) => hitAll(g, c),
  },
  {
    id: 'imperial_form', name: '帝王形态', color: O, type: 'power', rarity: 'rare', cost: 3, target: 'self',
    mag: [3, 5], text: '回合开始时，铸造 {M}，并获得 1 颗星辰。', art: '🏛️',
    play: (g, c) => g.apply(g.player, 'imperial_form', M(c)),
  },
  {
    id: 'galaxy', name: '银河', color: O, type: 'power', rarity: 'rare', cost: 2, target: 'self',
    mag: [1, 2], text: '回合开始时，若你至少有 4 颗星辰，获得 1 点能量并抽 {M} 张牌。', art: '🌌',
    play: (g, c) => g.apply(g.player, 'galaxy', M(c)),
  },
  {
    id: 'final_judgment', name: '终审', color: O, type: 'attack', rarity: 'rare', cost: 2, target: 'enemy',
    mag: [3, 4], text: ['造成 {D} 点伤害。\n（12 点，每有 1 颗星辰再 +{M}）', '造成 {D} 点伤害。\n（16 点，每有 1 颗星辰再 +{M}）'], art: '⚖️',
    dmgFn: (g, c) => (c.up ? 16 : 12) + (g ? g.stars * (uv(cardDef(c).mag, c.up) ?? 0) : 0),
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'coronation', name: '加冕', color: O, type: 'skill', rarity: 'rare', cost: 1, target: 'self',
    mag: [5, 7], exhaust: true, text: '获得 {M} 颗星辰。', art: '👑',
    play: (g, c) => g.gainStars(M(c)),
  },
  {
    id: 'sovereign_will', name: '君主意志', color: O, type: 'skill', rarity: 'rare', cost: 1, target: 'self',
    mag: [10, 14], exhaust: true, text: '铸造 {M}。', art: '🔱',
    play: (g, c) => g.forge(M(c)),
  },
  {
    id: 'divine_blade', name: '神铸之刃', color: O, type: 'power', rarity: 'rare', cost: [1, 0], target: 'self',
    text: '升级所有君王之刃，之后加入手牌的君王之刃也会升级。\n铸造 5。', art: '⚔️',
    play: (g) => {
      g.apply(g.player, 'blade_upgrade', 1);
      for (const x of g.allCards()) if (x.id === 'sovereign_blade') x.up = true;
      g.forge(5);
    },
  },
  {
    id: 'starshroud', name: '星幕', color: O, type: 'skill', rarity: 'rare', cost: [1, 0], star: 3, target: 'self',
    exhaust: true, text: '获得 1 层无实体。', art: '🌃',
    play: (g) => g.apply(g.player, 'intangible', 1),
  },
  {
    id: 'starlit_overflow', name: '星辉漫溢', color: O, type: 'skill', rarity: 'rare', cost: [1, 0], target: 'self',
    exhaust: true, text: '获得 2 颗星辰。\n本回合打出卡牌无需花费星辰。', art: '🌠',
    play: (g) => {
      g.gainStars(2);
      g.apply(g.player, 'free_stars', 1);
    },
  },
  {
    id: 'blade_of_kings', name: '万王之刃', color: O, type: 'attack', rarity: 'rare', cost: 2, target: 'enemy',
    dmg: [10, 14], text: '造成 {D} 点伤害。\n然后打出你手牌中的君王之刃（无需费用）。', art: '🗡️',
    play: (g, c, t) => {
      hit(g, c, t);
      const blade = g.hand.find((x) => x.id === 'sovereign_blade');
      if (blade) g.autoPlay(blade, t);
    },
  },
]);

// ---------------------------------------------------------------- 扩充：星辰、铸造与王权各有更多选择
defineCards([
  // ---------------------------------------------------------------- 普通
  {
    id: 'scepter_bash', name: '权杖重击', color: O, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [8, 11], mag: [1, 2], text: '造成 {D} 点伤害。\n若你至少有 2 颗星辰，给予 {M} 层虚弱。', art: '🪄',
    play: (g, c, t) => {
      hit(g, c, t);
      if (t && !t.dead && g.stars >= 2) g.apply(t, 'weak', M(c));
    },
  },
  {
    id: 'stargazing', name: '观星', color: O, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    mag: [2, 3], text: '抽 {M} 张牌。\n获得 1 颗星辰。', art: '🔭',
    play: (g, c) => {
      g.draw(M(c));
      g.gainStars(1);
    },
  },
  {
    id: 'tempered_edge', name: '回火', color: O, type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
    text: ['造成 {D} 点伤害。\n（2 点，加上铸造值的一半）', '造成 {D} 点伤害。\n（4 点，加上铸造值的一半）'], art: '🔥',
    dmgFn: (g, c) => (c.up ? 4 : 2) + Math.floor((g?.forged ?? 0) / 2),
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'noble_stance', name: '王者之姿', color: O, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    blk: [7, 10], text: '获得 {B} 点格挡。\n下回合开始时获得 1 颗星辰。', art: '🧍',
    play: (g, c) => {
      g.block(B(g, c));
      g.apply(g.player, 'star_next', 1);
    },
  },
  // ---------------------------------------------------------------- 罕见
  {
    id: 'astral_projection', name: '星界投影', color: O, type: 'skill', rarity: 'uncommon', cost: [1, 0], star: 1, target: 'self',
    text: '从弃牌堆中选择 1 张牌放入手牌。', art: '👻',
    play: (g) =>
      g.chooseCards({ title: '选择 1 张牌放入手牌', cards: [...g.discardPile].reverse(), min: 1, max: 1 }, (s) => {
        for (const x of s) g.moveTo(x, 'hand');
      }),
  },
  {
    id: 'crown_jewels', name: '王冠宝石', color: O, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [1, 2], text: '每回合你第一次花费星辰时，抽 {M} 张牌。', art: '💎',
    play: (g, c) => g.apply(g.player, 'crown_jewels', M(c)),
  },
  {
    id: 'forge_master', name: '锻造大师', color: O, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [2, 3], text: '回合结束时，铸造 {M}。', art: '🧑‍🏭',
    play: (g, c) => g.apply(g.player, 'forge_master', M(c)),
  },
  {
    id: 'royal_flourish', name: '王室剑花', color: O, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    dmg: [3, 4], mag: [2, 3], text: '造成 {D} 点伤害 3 次。\n铸造 {M}。', art: '🤺',
    play: (g, c, t) => {
      hit(g, c, t, 3);
      g.forge(M(c));
    },
  },
  {
    id: 'shooting_stars', name: '群星坠落', color: O, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    dmg: [3, 4], text: '造成 {D} 点伤害，次数等于你的星辰数。\n（不花费星辰）', art: '🌠',
    play: (g, c, t) => hit(g, c, t, g.stars),
  },
  {
    id: 'knighting', name: '册封', color: O, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [1, 2], text: '升级手牌中的 1 张牌。\n获得 {M} 颗星辰。', art: '🎖️',
    play: (g, c) => {
      g.chooseHand({ title: '选择 1 张牌升级', min: 1, max: 1, filter: canUpgrade }, (s) => s.forEach(upgradeCard));
      g.gainStars(M(c));
    },
  },
  {
    id: 'aegis_of_stars', name: '星辰庇护', color: O, type: 'skill', rarity: 'uncommon', cost: 1, star: 2, target: 'self',
    blk: [11, 15], text: '获得 {B} 点格挡。\n下回合开始时格挡不会消失。', art: '🛡️',
    play: (g, c) => {
      g.block(B(g, c));
      g.apply(g.player, 'blur', 1);
    },
  },
  {
    id: 'cosmic_ray', name: '宇宙射线', color: O, type: 'attack', rarity: 'uncommon', cost: 0, star: 1, target: 'enemy',
    dmg: [7, 10], text: '造成 {D} 点伤害。\n抽 1 张牌。', art: '⚡',
    play: (g, c, t) => {
      hit(g, c, t);
      g.draw(1);
    },
  },
  {
    id: 'tribute', name: '纳贡', color: O, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    dmg: [8, 11], mag: [12, 16], text: '造成 {D} 点伤害。\n若击杀敌人（召唤物除外），获得 {M} 金币。', art: '💰',
    play: (g, c, t) => {
      if (hit(g, c, t) && t && !t.minion) g.run.gainGold(M(c));
    },
  },
  {
    id: 'fealty', name: '效忠', color: O, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [5, 7], text: '每当你打出君王之刃，获得 {M} 点格挡。', art: '🤝',
    play: (g, c) => g.apply(g.player, 'fealty', M(c)),
  },
  {
    id: 'celestial_alignment', name: '星象连珠', color: O, type: 'skill', rarity: 'uncommon', cost: 0, star: [3, 2], target: 'self',
    text: '获得 2 点能量。', art: '🪐',
    play: (g) => g.gainEnergy(2),
  },
  {
    id: 'hone_blade', name: '砺刃', color: O, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    mag: [3, 5], text: '铸造 {M}。\n本回合君王之刃的费用减少 1。', art: '🪨',
    play: (g, c) => {
      g.forge(M(c));
      g.apply(g.player, 'blade_discount', 1);
    },
  },
  {
    id: 'royal_hunt', name: '王家狩猎', color: O, type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy',
    text: ['造成 {D} 点伤害。\n（12 点，精英战与首领战中翻倍）', '造成 {D} 点伤害。\n（16 点，精英战与首领战中翻倍）'], art: '🏹',
    dmgFn: (g, c) => (c.up ? 16 : 12) * (g && (g.elite || g.boss) ? 2 : 1),
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'nebula', name: '星云', color: O, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [2, 3], text: ['获得 {B} 点格挡。\n（6 点，本回合每花费过 1 颗星辰再 +{M}）', '获得 {B} 点格挡。\n（8 点，本回合每花费过 1 颗星辰再 +{M}）'], art: '🌫️',
    blkFn: (g, c) => (c.up ? 8 : 6) + (g ? g.t.starsSpent * (uv(cardDef(c).mag, c.up) ?? 0) : 0),
    play: (g, c) => g.block(B(g, c)),
  },
  {
    id: 'twin_suns', name: '双日', color: O, type: 'attack', rarity: 'uncommon', cost: 1, star: 2, target: 'enemy',
    dmg: [9, 12], text: '造成 {D} 点伤害 2 次。', art: '🌞',
    play: (g, c, t) => hit(g, c, t, 2),
  },
  // ---------------------------------------------------------------- 稀有
  {
    id: 'excalibur', name: '王者之剑', color: O, type: 'attack', rarity: 'rare', cost: 2, target: 'enemy',
    exhaust: true, text: ['造成 {D} 点伤害。\n（10 点，加上 2 倍铸造值）', '造成 {D} 点伤害。\n（14 点，加上 2 倍铸造值）'], art: '🗡️',
    dmgFn: (g, c) => (c.up ? 14 : 10) + 2 * (g?.forged ?? 0),
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'eternal_reign', name: '永恒统治', color: O, type: 'power', rarity: 'rare', cost: [3, 2], target: 'self',
    text: '每回合你打出的第一张花费星辰的牌会被打出两次。', art: '♾️',
    play: (g) => g.apply(g.player, 'eternal_reign', 1),
  },
  {
    id: 'stellar_collapse', name: '星辰坍缩', color: O, type: 'attack', rarity: 'rare', cost: COST_X, target: 'enemy',
    dmg: [6, 8], text: '花费所有星辰。\n造成 {D} 点伤害 X 次，每花费 1 颗星辰再多 1 次。', art: '🌀',
    play: (g, c, t) => {
      const s = g.stars;
      g.spendStars(s);
      hit(g, c, t, g.x + s);
    },
  },
  {
    id: 'royal_treasury', name: '王室宝库', color: O, type: 'skill', rarity: 'rare', cost: 0, target: 'self',
    mag: [2, 3], exhaust: true, text: '获得 1 点能量和 {M} 颗星辰。\n抽 1 张牌。', art: '🏦',
    play: (g, c) => {
      g.gainEnergy(1);
      g.gainStars(M(c));
      g.draw(1);
    },
  },
  {
    id: 'masterwork', name: '杰作', color: O, type: 'skill', rarity: 'rare', cost: [1, 0], target: 'self',
    mag: 5, exhaust: true, text: '铸造值翻倍（至少铸造 {M}）。', art: '🏆',
    play: (g, c) => g.forge(Math.max(M(c), g.forged)),
  },
  {
    id: 'celestial_globe', name: '天球仪', color: O, type: 'power', rarity: 'rare', cost: [2, 1], target: 'self',
    text: '回合开始时，抽 1 张牌并获得 1 颗星辰。', art: '🌐',
    play: (g) => g.apply(g.player, 'celestial_globe', 1),
  },
  {
    id: 'dethrone', name: '废黜', color: O, type: 'attack', rarity: 'rare', cost: 2, target: 'enemy',
    dmg: [16, 22], text: '移除目标的格挡，然后造成 {D} 点伤害。\n对精英和首领先给予 2 层易伤。', art: '🪓',
    play: (g, c, t) => {
      if (!t) return;
      t.block = 0;
      if (g.elite || g.boss) g.apply(t, 'vulnerable', 2);
      hit(g, c, t);
    },
  },
]);
