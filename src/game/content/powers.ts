import { definePowers } from '../registry';
import { cardDef, upgradeCard } from '../cards';
import type { Combat } from '../combat';
import type { Creature, Enemy } from '../types';

const isEnemy = (c: Creature): c is Enemy => !c.isPlayer && 'defId' in c;

function dmgAllEnemies(g: Combat, n: number, src: Creature | null) {
  for (const e of g.alive) g.thorns(e, n, src);
}

definePowers([
  // ---------------------------------------------------------------------------
  // 通用
  // ---------------------------------------------------------------------------
  {
    id: 'strength',
    name: '力量',
    art: '💪',
    type: 'buff',
    negative: true,
    desc: (n) => (n >= 0 ? `攻击伤害提高 ${n} 点。` : `攻击伤害降低 ${-n} 点。`),
    dmgOutAdd: (_g, _o, n) => n,
  },
  {
    id: 'dexterity',
    name: '敏捷',
    art: '🦶',
    type: 'buff',
    negative: true,
    desc: (n) => (n >= 0 ? `从卡牌获得的格挡提高 ${n} 点。` : `从卡牌获得的格挡降低 ${-n} 点。`),
    blockMod: (_g, _o, n, b) => b + n,
  },
  {
    id: 'vulnerable',
    name: '易伤',
    art: '💔',
    type: 'debuff',
    decay: 'round',
    desc: (n) => `受到的攻击伤害提高 50%，持续 ${n} 回合。`,
    dmgIn: (g, o, _n, d) => {
      if (o.isPlayer) return d * (g.run.hasRelic('odd_mushroom') ? 1.25 : 1.5);
      return d * (g.run.hasRelic('paper_phrog') ? 1.75 : 1.5);
    },
  },
  {
    id: 'weak',
    name: '虚弱',
    art: '🥀',
    type: 'debuff',
    decay: 'round',
    desc: (n) => `造成的攻击伤害降低 25%，持续 ${n} 回合。`,
    dmgOut: (_g, _o, _n, d) => d * 0.75,
  },
  {
    id: 'frail',
    name: '脆弱',
    art: '🦴',
    type: 'debuff',
    decay: 'round',
    desc: (n) => `从卡牌获得的格挡降低 25%，持续 ${n} 回合。`,
    blockMod: (_g, _o, _n, b) => b * 0.75,
  },
  {
    id: 'poison',
    name: '中毒',
    art: '☠️',
    type: 'debuff',
    desc: (n) => `回合开始时失去 ${n} 点生命，然后中毒层数减 1。`,
    onTurnStart: (g, o, n) => {
      g.loseHp(o, n);
      g.reducePower(o, 'poison', 1);
    },
  },
  {
    id: 'artifact',
    name: '人工制品',
    art: '🔷',
    type: 'buff',
    desc: (n) => `抵消接下来 ${n} 次负面效果。`,
  },
  {
    id: 'thorns',
    name: '荆棘',
    art: '🌵',
    type: 'buff',
    desc: (n) => `受到攻击时，对攻击者造成 ${n} 点伤害。`,
    onAttacked: (g, o, n, src) => {
      if (src !== o) g.thorns(src, n, o);
    },
  },
  {
    id: 'metallicize',
    name: '金属化',
    art: '🔩',
    type: 'buff',
    desc: (n) => `回合结束时获得 ${n} 点格挡。`,
    onTurnEnd: (g, o, n) => g.gainBlock(o, n),
  },
  {
    id: 'plated_armor',
    name: '多层护甲',
    art: '🛡️',
    type: 'buff',
    desc: (n) => `回合结束时获得 ${n} 点格挡。受到攻击伤害会使层数减 1。`,
    onTurnEnd: (g, o, n) => g.gainBlock(o, n),
    onHpLost: (g, o, _n, _a, src) => {
      if (src && src !== o) g.reducePower(o, 'plated_armor', 1);
    },
  },
  {
    id: 'regen',
    name: '再生',
    art: '💚',
    type: 'buff',
    desc: (n) => `回合结束时回复 ${n} 点生命，然后层数减 1。`,
    onTurnEnd: (g, o, n) => {
      g.heal(o, n);
      g.reducePower(o, 'regen', 1);
    },
  },
  {
    id: 'ritual',
    name: '仪式',
    art: '🕯️',
    type: 'buff',
    desc: (n) => `回合结束时获得 ${n} 点力量。`,
    onTurnEnd: (g, o, n) => {
      g.apply(o, 'strength', n, o);
    },
  },
  {
    id: 'intangible',
    name: '无实体',
    art: '👻',
    type: 'buff',
    decay: 'round',
    desc: (n) => `受到的所有伤害降低为 1，持续 ${n} 回合。`,
    dmgInFinal: (_g, _o, _n, d) => (d > 1 ? 1 : d),
  },
  {
    id: 'buffer',
    name: '缓冲',
    art: '🫧',
    type: 'buff',
    desc: (n) => `阻止接下来 ${n} 次失去生命。`,
  },
  {
    id: 'vigor',
    name: '活力',
    art: '🔥',
    type: 'buff',
    desc: (n) => `下一张攻击牌额外造成 ${n} 点伤害。`,
    dmgOutAdd: (_g, _o, n, card) => (card && cardDef(card).type === 'attack' ? n : 0),
    afterCardPlayed: (g, o, _n, c) => {
      if (cardDef(c).type === 'attack') g.removePower(o, 'vigor');
    },
  },
  {
    id: 'blur',
    name: '残影',
    art: '🌫️',
    type: 'buff',
    decay: 'start',
    desc: (n) => `格挡不会在接下来 ${n} 个回合开始时消失。`,
  },
  {
    id: 'barricade',
    name: '壁垒',
    art: '🏰',
    type: 'buff',
    noStack: true,
    desc: () => '格挡不会在回合开始时消失。',
  },
  {
    id: 'energized',
    name: '充能',
    art: '⚡',
    type: 'buff',
    desc: (n) => `下回合开始时获得 ${n} 点能量。`,
    onTurnStartPostDraw: (g, o, n) => {
      g.gainEnergy(n);
      g.removePower(o, 'energized');
    },
  },
  {
    id: 'draw_next',
    name: '蓄势',
    art: '📜',
    type: 'buff',
    desc: (n) => `下回合额外抽 ${n} 张牌。`,
  },
  {
    id: 'next_block',
    name: '后续格挡',
    art: '🛡️',
    type: 'buff',
    desc: (n) => `下回合开始时获得 ${n} 点格挡。`,
    onTurnStartPostDraw: (g, o, n) => {
      g.gainBlock(o, n);
      g.removePower(o, 'next_block');
    },
  },
  {
    id: 'no_draw',
    name: '无法抽牌',
    art: '🚫',
    type: 'debuff',
    noStack: true,
    decay: 'clear',
    desc: () => '本回合无法再抽牌。',
  },
  {
    id: 'entangled',
    name: '缠绕',
    art: '🌿',
    type: 'debuff',
    noStack: true,
    decay: 'clear',
    desc: () => '本回合无法打出攻击牌。',
  },
  {
    id: 'confused',
    name: '混乱',
    art: '😵',
    type: 'debuff',
    noStack: true,
    desc: () => '抽到的牌费用随机变为 0~3。',
  },
  {
    id: 'double_tap',
    name: '双发',
    art: '🎯',
    type: 'buff',
    desc: (n) => `接下来 ${n} 张攻击牌会被打出两次。`,
  },
  {
    id: 'burst',
    name: '爆发',
    art: '💥',
    type: 'buff',
    desc: (n) => `接下来 ${n} 张技能牌会被打出两次。`,
  },
  {
    id: 'duplication',
    name: '复制',
    art: '🪞',
    type: 'buff',
    desc: (n) => `接下来 ${n} 张牌会被打出两次。`,
  },
  {
    id: 'double_damage',
    name: '双倍伤害',
    art: '✖️',
    type: 'buff',
    decay: 'clear',
    desc: () => '本回合攻击造成双倍伤害。',
    dmgOut: (_g, _o, _n, d) => d * 2,
  },
  {
    id: 'phantasmal',
    name: '幻影',
    art: '👤',
    type: 'buff',
    desc: () => '下回合攻击造成双倍伤害。',
    onTurnStart: (g, o) => {
      g.removePower(o, 'phantasmal');
      g.apply(o, 'double_damage', 1, o);
    },
  },
  {
    id: 'temp_strength',
    name: '暂时力量',
    art: '💪',
    type: 'buff',
    desc: (n) => `回合结束时失去 ${n} 点力量。`,
    onTurnEnd: (g, o, n) => {
      g.apply(o, 'strength', -n, o);
      g.removePower(o, 'temp_strength');
    },
  },
  {
    id: 'temp_dex',
    name: '暂时敏捷',
    art: '🦶',
    type: 'buff',
    desc: (n) => `回合结束时失去 ${n} 点敏捷。`,
    onTurnEnd: (g, o, n) => {
      g.apply(o, 'dexterity', -n, o);
      g.removePower(o, 'temp_dex');
    },
  },
  {
    id: 'shackled',
    name: '镣铐',
    art: '⛓️',
    type: 'debuff',
    desc: (n) => `回合结束时恢复 ${n} 点力量。`,
    onTurnEnd: (g, o, n) => {
      g.apply(o, 'strength', n, o);
      g.removePower(o, 'shackled');
    },
  },
  {
    id: 'no_block',
    name: '恐慌',
    art: '😰',
    type: 'debuff',
    decay: 'round',
    desc: (n) => `接下来 ${n} 回合无法从卡牌获得格挡。`,
    blockMod: () => 0,
  },
  {
    id: 'normality_lock',
    name: '凡庸',
    art: '📏',
    type: 'debuff',
    hidden: true,
    noStack: true,
    desc: () => '每回合最多打出 3 张牌。',
  },

  // ---------------------------------------------------------------------------
  // 铁甲战士
  // ---------------------------------------------------------------------------
  {
    id: 'rage',
    name: '狂怒',
    art: '😡',
    type: 'buff',
    decay: 'clear',
    desc: (n) => `本回合每打出一张攻击牌，获得 ${n} 点格挡。`,
    onCardPlayed: (g, o, n, c) => {
      if (cardDef(c).type === 'attack') g.gainBlock(o, n);
    },
  },
  {
    id: 'flame_barrier',
    name: '火焰屏障',
    art: '🔥',
    type: 'buff',
    decay: 'startClear',
    desc: (n) => `受到攻击时，对攻击者造成 ${n} 点伤害。`,
    onAttacked: (g, o, n, src) => {
      if (src !== o) g.thorns(src, n, o);
    },
  },
  {
    id: 'demon_form',
    name: '恶魔形态',
    art: '😈',
    type: 'buff',
    desc: (n) => `回合开始时获得 ${n} 点力量。`,
    onTurnStartPostDraw: (g, o, n) => {
      g.apply(o, 'strength', n, o);
    },
  },
  {
    id: 'feel_no_pain',
    name: '无惧疼痛',
    art: '🧘',
    type: 'buff',
    desc: (n) => `每当一张牌被消耗，获得 ${n} 点格挡。`,
    onExhaust: (g, o, n) => g.gainBlock(o, n),
  },
  {
    id: 'dark_embrace',
    name: '黑暗之拥',
    art: '🌑',
    type: 'buff',
    desc: (n) => `每当一张牌被消耗，抽 ${n} 张牌。`,
    onExhaust: (g, _o, n) => {
      if (!g.over) g.draw(n);
    },
  },
  {
    id: 'evolve',
    name: '进化',
    art: '🧬',
    type: 'buff',
    desc: (n) => `每当你抽到状态牌，抽 ${n} 张牌。`,
    onDraw: (g, _o, n, c) => {
      if (cardDef(c).type === 'status') g.draw(n);
    },
  },
  {
    id: 'fire_breathing',
    name: '火焰吐息',
    art: '🐉',
    type: 'buff',
    desc: (n) => `每当你抽到状态牌或诅咒牌，对所有敌人造成 ${n} 点伤害。`,
    onDraw: (g, o, n, c) => {
      const t = cardDef(c).type;
      if (t === 'status' || t === 'curse') dmgAllEnemies(g, n, o);
    },
  },
  {
    id: 'combust',
    name: '自燃',
    art: '☄️',
    type: 'buff',
    desc: (n) => `回合结束时失去 1 点生命，并对所有敌人造成 ${n} 点伤害。`,
    onTurnEnd: (g, o, n) => {
      g.loseHp(o, 1, o);
      dmgAllEnemies(g, n, o);
    },
  },
  {
    id: 'juggernaut',
    name: '势不可挡',
    art: '🐗',
    type: 'buff',
    desc: (n) => `每当你获得格挡，对随机敌人造成 ${n} 点伤害。`,
    onGainBlock: (g, o, n) => {
      const e = g.randomEnemy();
      if (e) g.thorns(e, n, o);
    },
  },
  {
    id: 'corruption',
    name: '腐化',
    art: '🩸',
    type: 'buff',
    noStack: true,
    desc: () => '技能牌费用变为 0。打出技能牌时将其消耗。',
  },
  {
    id: 'berserk',
    name: '狂暴',
    art: '🪓',
    type: 'buff',
    desc: (n) => `回合开始时获得 ${n} 点能量。`,
    onTurnStartPostDraw: (g, _o, n) => g.gainEnergy(n),
  },
  {
    id: 'brutality',
    name: '残暴',
    art: '🩸',
    type: 'buff',
    desc: (n) => `回合开始时失去 1 点生命并抽 ${n} 张牌。`,
    onTurnStartPostDraw: (g, o, n) => {
      g.loseHp(o, 1, o);
      g.draw(n);
    },
  },
  {
    id: 'rupture',
    name: '撕裂',
    art: '🩹',
    type: 'buff',
    desc: (n) => `每当你因卡牌失去生命，获得 ${n} 点力量。`,
    onHpLost: (g, o, n, _a, src) => {
      if (src === o) g.apply(o, 'strength', n, o);
    },
  },
  {
    id: 'bloodthirst',
    name: '嗜血',
    art: '🧛',
    type: 'buff',
    desc: (n) => `每当一名敌人死亡，回复 ${n} 点生命。`,
    onEnemyDeath: (g, o, n) => g.heal(o, n),
  },

  // ---------------------------------------------------------------------------
  // 静默猎手
  // ---------------------------------------------------------------------------
  {
    id: 'after_image',
    name: '余像',
    art: '👥',
    type: 'buff',
    desc: (n) => `每打出一张牌，获得 ${n} 点格挡。`,
    onCardPlayed: (g, o, n) => g.gainBlock(o, n),
  },
  {
    id: 'thousand_cuts',
    name: '凌迟',
    art: '🔪',
    type: 'buff',
    desc: (n) => `每打出一张牌，对所有敌人造成 ${n} 点伤害。`,
    afterCardPlayed: (g, o, n) => dmgAllEnemies(g, n, o),
  },
  {
    id: 'noxious_fumes',
    name: '毒雾',
    art: '🌫️',
    type: 'buff',
    desc: (n) => `回合开始时，给予所有敌人 ${n} 层中毒。`,
    onTurnStartPostDraw: (g, o, n) => {
      for (const e of g.alive) g.apply(e, 'poison', n, o);
    },
  },
  {
    id: 'infinite_blades',
    name: '无尽刀刃',
    art: '🗡️',
    type: 'buff',
    desc: (n) => `回合开始时，将 ${n} 张小刀加入手牌。`,
    onTurnStartPostDraw: (g, _o, n) => {
      g.addToHand('shiv', false, n);
    },
  },
  {
    id: 'accuracy',
    name: '精准',
    art: '🎯',
    type: 'buff',
    desc: (n) => `小刀额外造成 ${n} 点伤害。`,
    dmgOutAdd: (_g, _o, n, c) => (c?.id === 'shiv' ? n : 0),
  },
  {
    id: 'envenom',
    name: '涂毒',
    art: '🐍',
    type: 'buff',
    desc: (n) => `攻击造成未被格挡的伤害时，给予 ${n} 层中毒。`,
    onDealAttack: (g, o, n, t, dealt) => {
      if (dealt > 0 && !t.dead) g.apply(t, 'poison', n, o);
    },
  },
  {
    id: 'tools_of_trade',
    name: '交易工具',
    art: '🧰',
    type: 'buff',
    desc: (n) => `回合开始时抽 ${n} 张牌，然后丢弃 ${n} 张牌。`,
    onTurnStartPostDraw: (g, _o, n) => {
      g.draw(n);
      g.chooseHand({ title: `丢弃 ${n} 张牌`, min: n, max: n }, (sel) => sel.forEach((c) => g.discardCard(c)));
    },
  },
  {
    id: 'well_laid_plans',
    name: '计划妥当',
    art: '📋',
    type: 'buff',
    desc: (n) => `回合结束时，可以保留至多 ${n} 张牌。`,
  },
  {
    id: 'wraith_form',
    name: '幽灵形态',
    art: '👻',
    type: 'debuff',
    desc: (n) => `回合结束时失去 ${n} 点敏捷。`,
    onTurnEnd: (g, o, n) => {
      g.apply(o, 'dexterity', -n, o);
    },
  },
  {
    id: 'choke',
    name: '掐喉',
    art: '🫳',
    type: 'debuff',
    decay: 'clear',
    desc: (n) => `本回合玩家每打出一张牌，失去 ${n} 点生命。`,
    onCardPlayed: (g, o, n) => {
      g.loseHp(o, n, g.player);
    },
  },
  {
    id: 'corpse_explosion',
    name: '尸体爆炸',
    art: '💣',
    type: 'debuff',
    desc: (n) => `死亡时，对所有其他敌人造成等同于其最大生命 ${n > 1 ? `×${n} ` : ''}的伤害。`,
    onDeath: (g, o, n) => {
      for (const e of g.alive) if (e !== o) g.thorns(e, o.maxHp * n, g.player);
    },
  },
  {
    id: 'reflexes',
    name: '本能',
    art: '🌀',
    type: 'buff',
    desc: (n) => `每当你丢弃一张牌，获得 ${n} 点格挡。`,
    onManualDiscard: (g, o, n) => g.gainBlock(o, n),
  },

  // ---------------------------------------------------------------------------
  // 储君
  // ---------------------------------------------------------------------------
  {
    id: 'sovereignty',
    name: '王权',
    art: '👑',
    type: 'buff',
    desc: (n) => `回合开始时获得 ${n} 颗星辰。`,
    onTurnStartPostDraw: (g, _o, n) => g.gainStars(n),
  },
  {
    id: 'star_forge',
    name: '星辰锻炉',
    art: '⚒️',
    type: 'buff',
    desc: (n) => `每当你获得星辰，铸造 ${n}。`,
    onStarsGained: (g, _o, n) => g.forge(n),
  },
  {
    id: 'black_hole',
    name: '黑洞',
    art: '🕳️',
    type: 'buff',
    desc: (n) => `每花费 1 颗星辰，对随机敌人造成 ${n} 点伤害。`,
    onStarsSpent: (g, o, n, spent) => {
      for (let i = 0; i < spent; i++) {
        const e = g.randomEnemy();
        if (e) g.thorns(e, n, o);
      }
    },
  },
  {
    id: 'imperial_form',
    name: '帝王形态',
    art: '🏛️',
    type: 'buff',
    desc: (n) => `回合开始时铸造 ${n}，并获得 1 颗星辰。`,
    onTurnStartPostDraw: (g, _o, n) => {
      g.forge(n);
      g.gainStars(1);
    },
  },
  {
    id: 'galaxy',
    name: '银河',
    art: '🌌',
    type: 'buff',
    desc: (n) => `回合开始时，若你至少有 4 颗星辰，获得 1 点能量并抽 ${n} 张牌。`,
    onTurnStartPostDraw: (g, _o, n) => {
      if (g.stars >= 4) {
        g.gainEnergy(1);
        g.draw(n);
      }
    },
  },
  {
    id: 'royal_armor',
    name: '王族铠甲',
    art: '🥋',
    type: 'buff',
    desc: (n) => `回合结束时，每有 1 颗星辰（至多 5 颗），获得 ${n} 点格挡。`,
    onTurnEnd: (g, o, n) => {
      const s = Math.min(5, g.stars);
      if (s > 0) g.gainBlock(o, s * n);
    },
  },
  {
    id: 'twin_stars',
    name: '双子星',
    art: '♊',
    type: 'buff',
    desc: (n) => `接下来 ${n} 张花费星辰的牌会被打出两次。`,
  },
  {
    id: 'free_stars',
    name: '星辉',
    art: '✨',
    type: 'buff',
    noStack: true,
    decay: 'clear',
    desc: () => '本回合打出卡牌无需花费星辰。',
  },
  {
    id: 'blade_upgrade',
    name: '神铸',
    art: '⚔️',
    type: 'buff',
    noStack: true,
    desc: () => '加入手牌的君王之刃已升级。',
  },
  {
    id: 'starlight',
    name: '星光',
    art: '🌟',
    type: 'buff',
    desc: (n) => `每当你花费星辰，获得 ${n} 点格挡。`,
    onStarsSpent: (g, o, n) => g.gainBlock(o, n),
  },
  {
    id: 'stellar_tide',
    name: '星潮',
    art: '🌠',
    type: 'buff',
    desc: (n) => `每当你打出君王之刃，获得 ${n} 颗星辰。`,
    afterCardPlayed: (g, _o, n, c) => {
      if (c.id === 'sovereign_blade') g.gainStars(n);
    },
  },

  // ---------------------------------------------------------------------------
  // 亡灵契约师
  // ---------------------------------------------------------------------------
  {
    id: 'doom',
    name: '灾厄',
    art: '💀',
    type: 'debuff',
    desc: (n) => `回合开始时，若灾厄（${n}）不低于当前生命，则立即死亡。`,
    onTurnStart: (g, o, n) => {
      if (n >= o.hp && !o.dead) {
        g.emit('text', o.uid, undefined, '灾厄降临');
        g.loseHp(o, o.hp + o.block, g.player);
      }
    },
  },
  {
    id: 'possession',
    name: '亡魂附体',
    art: '👻',
    type: 'buff',
    desc: (n) => `每当你打出灵魂，给予所有敌人 ${n} 层灾厄。`,
    afterCardPlayed: (g, o, n, c) => {
      if (c.id === 'soul') for (const e of g.alive) g.apply(e, 'doom', n, o);
    },
  },
  {
    id: 'death_pact',
    name: '死亡契约',
    art: '📜',
    type: 'buff',
    desc: (n) => `回合开始时，召唤 ${n}。`,
    onTurnStartPostDraw: (g, _o, n) => g.summon(n),
  },
  {
    id: 'bone_armor',
    name: '骨甲',
    art: '🦴',
    type: 'buff',
    desc: (n) => `回合结束时，若奥斯提在场，获得 ${n} 点格挡。`,
    onTurnEnd: (g, o, n) => {
      if (g.ostyAlive) g.gainBlock(o, n);
    },
  },
  {
    id: 'blight_aura',
    name: '凋零光环',
    art: '🥀',
    type: 'buff',
    desc: (n) => `回合结束时，给予所有敌人 ${n} 层灾厄。`,
    onTurnEnd: (g, o, n) => {
      for (const e of g.alive) g.apply(e, 'doom', n, o);
    },
  },
  {
    id: 'lich_form',
    name: '巫妖形态',
    art: '☠️',
    type: 'buff',
    desc: (n) => `回合开始时，召唤 ${n}，并将 1 张灵魂加入手牌。`,
    onTurnStartPostDraw: (g, _o, n) => {
      g.summon(n);
      g.addToHand('soul');
    },
  },
  {
    id: 'danse_macabre',
    name: '死亡之舞',
    art: '💃',
    type: 'buff',
    desc: (n) => `每当你打出一张奥斯提攻击牌，获得 ${n} 点格挡。`,
    onCardPlayed: (g, o, n, c) => {
      if (cardDef(c).tags?.includes('osty')) g.gainBlock(o, n);
    },
  },
  {
    id: 'eternal_bond',
    name: '永恒契约',
    art: '♾️',
    type: 'buff',
    desc: (n) => `奥斯提死亡时，立刻召唤 ${n}。`,
    onOstyDeath: (g, _o, n) => g.summon(n),
  },
  {
    id: 'reaper_power',
    name: '收割者',
    art: '🌾',
    type: 'buff',
    desc: (n) => `每当一名敌人死亡，召唤 ${n} 并抽 1 张牌。`,
    onEnemyDeath: (g, _o, n) => {
      g.summon(n);
      g.draw(1);
    },
  },
  {
    id: 'grave_urn_power',
    name: '墓土之瓮',
    art: '⚱️',
    type: 'buff',
    hidden: true,
    desc: (n) => `奥斯提死亡时，给予所有敌人 ${n} 层灾厄。`,
    onOstyDeath: (g, o, n) => {
      for (const e of g.alive) g.apply(e, 'doom', n, o);
    },
  },
  {
    id: 'summon_bonus',
    name: '骨灰之力',
    art: '⚱️',
    type: 'buff',
    desc: (n) => `召唤时额外召唤 ${n}。`,
  },
  {
    id: 'soul_link',
    name: '灵魂链接',
    art: '🔗',
    type: 'buff',
    desc: (n) => `每当你打出灵魂，奥斯提对随机敌人造成 ${n} 点伤害。`,
    afterCardPlayed: (g, _o, n, c) => {
      if (c.id === 'soul') g.ostyAttack(g.randomEnemy(), n, null);
    },
  },

  // ---------------------------------------------------------------------------
  // 故障机器人
  // ---------------------------------------------------------------------------
  {
    id: 'focus',
    name: '集中',
    art: '🔷',
    type: 'buff',
    negative: true,
    desc: (n) => (n >= 0 ? `充能球的效果提高 ${n}。` : `充能球的效果降低 ${-n}。`),
  },
  {
    id: 'electrodynamics',
    name: '电动力学',
    art: '🌐',
    type: 'buff',
    noStack: true,
    desc: () => '闪电充能球会命中所有敌人。',
  },
  {
    id: 'heatsinks',
    name: '散热片',
    art: '🌡️',
    type: 'buff',
    desc: (n) => `每当你打出一张能力牌，抽 ${n} 张牌。`,
    afterCardPlayed: (g, _o, n, c) => {
      if (cardDef(c).type === 'power') g.draw(n);
    },
  },
  {
    id: 'storm',
    name: '风暴',
    art: '⛈️',
    type: 'buff',
    desc: (n) => `每当你打出一张能力牌，生成 ${n} 个闪电。`,
    afterCardPlayed: (g, _o, n, c) => {
      if (cardDef(c).type === 'power') for (let i = 0; i < n; i++) g.channel('lightning');
    },
  },
  {
    id: 'hello_world',
    name: '你好世界',
    art: '👋',
    type: 'buff',
    desc: (n) => `回合开始时，将 ${n} 张随机普通牌加入手牌。`,
    onTurnStartPostDraw: (g, _o, n) => {
      for (const c of g.randomCards(n, (id) => cardDef(id).rarity === 'common')) g.addToHand(c);
    },
  },
  {
    id: 'creative_ai',
    name: '创造性 AI',
    art: '🤖',
    type: 'buff',
    desc: (n) => `回合开始时，将 ${n} 张随机能力牌加入手牌。`,
    onTurnStartPostDraw: (g, _o, n) => {
      for (const c of g.randomCards(n, (id) => cardDef(id).type === 'power')) g.addToHand(c);
    },
  },
  {
    id: 'loop',
    name: '循环',
    art: '➰',
    type: 'buff',
    desc: (n) => `回合开始时，触发最左侧充能球的被动 ${n} 次。`,
    onTurnStartPostDraw: (g, _o, n) => {
      const o = g.orbs[0];
      if (o) g.triggerPassive(o, n);
    },
  },
  {
    id: 'static_discharge',
    name: '静电释放',
    art: '⚡',
    type: 'buff',
    desc: (n) => `每当你受到未被格挡的攻击伤害，生成 ${n} 个闪电。`,
    onHpLost: (g, o, n, _a, src) => {
      if (src && src !== o && !src.isPlayer) for (let i = 0; i < n; i++) g.channel('lightning');
    },
  },
  {
    id: 'self_repair',
    name: '自我修复',
    art: '🔧',
    type: 'buff',
    desc: (n) => `战斗结束时，回复 ${n} 点生命。`,
  },
  {
    id: 'amplify',
    name: '增幅',
    art: '📢',
    type: 'buff',
    decay: 'clear',
    desc: (n) => `本回合你打出的下 ${n} 张能力牌会被打出两次。`,
  },
  {
    id: 'biased_cognition',
    name: '偏差认知',
    art: '🧠',
    type: 'debuff',
    desc: (n) => `回合开始时，失去 ${n} 点集中。`,
    onTurnStart: (g, o, n) => {
      g.apply(o, 'focus', -n, o);
    },
  },
  {
    id: 'echo_form',
    name: '回响形态',
    art: '🔊',
    type: 'buff',
    desc: (n) => `每回合你打出的前 ${n} 张牌会被打出两次。`,
  },
  {
    id: 'machine_learning',
    name: '机器学习',
    art: '📈',
    type: 'buff',
    desc: (n) => `回合开始时，额外抽 ${n} 张牌。`,
  },
  {
    id: 'equilibrium',
    name: '均衡',
    art: '⚖️',
    type: 'buff',
    decay: 'clear',
    noStack: true,
    desc: () => '本回合结束时保留手牌。',
  },

  // ---------------------------------------------------------------------------
  // 敌人专属
  // ---------------------------------------------------------------------------
  {
    id: 'curl_up',
    name: '蜷身',
    art: '🐚',
    type: 'buff',
    desc: (n) => `第一次受到攻击伤害时，获得 ${n} 点格挡。`,
    onHpLost: (g, o, n, _a, src) => {
      if (src && src !== o) {
        g.gainBlock(o, n);
        g.removePower(o, 'curl_up');
      }
    },
  },
  {
    id: 'angry',
    name: '愤怒',
    art: '💢',
    type: 'buff',
    desc: (n) => `受到攻击伤害时，获得 ${n} 点力量。`,
    onHpLost: (g, o, n, _a, src) => {
      if (src && src !== o) g.apply(o, 'strength', n, o);
    },
  },
  {
    id: 'enrage',
    name: '激怒',
    art: '😤',
    type: 'buff',
    desc: (n) => `玩家每打出一张技能牌，获得 ${n} 点力量。`,
    onCardPlayed: (g, o, n, c) => {
      if (cardDef(c).type === 'skill') g.apply(o, 'strength', n, o);
    },
  },
  {
    id: 'spore_cloud',
    name: '孢子云',
    art: '🍄',
    type: 'buff',
    desc: (n) => `死亡时，给予玩家 ${n} 层易伤。`,
    onDeath: (g, o, n) => {
      g.apply(g.player, 'vulnerable', n, o);
    },
  },
  {
    id: 'split',
    name: '分裂',
    art: '🧫',
    type: 'buff',
    noStack: true,
    desc: () => '生命降到一半以下时，分裂为两个更小的史莱姆。',
    onHpLost: (g, o) => {
      const e = o as Enemy;
      if (!e.dead && e.hp > 0 && e.hp <= e.maxHp / 2 && e.move !== 'split') {
        e.move = 'split';
        g.emit('text', e.uid, undefined, '分裂！');
      }
    },
  },
  {
    id: 'sharp_hide',
    name: '锋利外皮',
    art: '🦔',
    type: 'buff',
    desc: (n) => `玩家每打出一张攻击牌，受到 ${n} 点伤害。`,
    onCardPlayed: (g, o, n, c) => {
      if (cardDef(c).type === 'attack') g.thorns(g.player, n, o);
    },
  },
  {
    id: 'beat_of_death',
    name: '死亡律动',
    art: '🥁',
    type: 'buff',
    desc: (n) => `玩家每打出一张牌，受到 ${n} 点伤害。`,
    onCardPlayed: (g, o, n) => {
      g.thorns(g.player, n, o);
    },
  },
  {
    id: 'hex',
    name: '妖术',
    art: '🔮',
    type: 'buff',
    desc: () => '玩家每打出一张非攻击牌，将 1 张晕眩洗入抽牌堆。',
    onCardPlayed: (g, _o, _n, c) => {
      if (cardDef(c).type !== 'attack') g.addToDraw('dazed');
    },
  },
  {
    id: 'flight',
    name: '飞行',
    art: '🪶',
    type: 'buff',
    desc: (n) => `受到的攻击伤害减半。被攻击 ${n} 次后坠落。`,
    dmgIn: (_g, _o, _n, d, src) => (src ? d * 0.5 : d),
    onHpLost: (g, o, _n, _a, src) => {
      if (!src || src === o) return;
      g.reducePower(o, 'flight', 1);
      if (!g.has(o, 'flight') && isEnemy(o)) {
        o.move = 'grounded';
        g.emit('text', o.uid, undefined, '坠落！');
      }
    },
  },
  {
    id: 'slippery',
    name: '滑溜',
    art: '💧',
    type: 'buff',
    desc: (n) => `接下来 ${n} 次受到的伤害降低为 1。`,
    dmgInFinal: (g, o, _n, d) => {
      if (d > 1) {
        g.reducePower(o, 'slippery', 1);
        return 1;
      }
      return d;
    },
  },
  {
    id: 'invincible',
    name: '不可战胜',
    art: '🛡️',
    type: 'buff',
    desc: (n) => `本回合至多再受到 ${n} 点伤害。`,
    dmgInFinal: (g, o, n, d) => {
      const take = Math.min(d, n);
      if (take > 0) {
        o.powers.invincible = n - take;
        if (o.powers.invincible <= 0) o.powers.invincible = 0;
      }
      void g;
      return take;
    },
  },
  {
    id: 'reincarnate',
    name: '不灭',
    art: '🔁',
    type: 'buff',
    desc: (n) => `死亡后会复活。剩余 ${n} 次。`,
  },
  {
    id: 'revive_pending',
    name: '复苏中',
    art: '⏳',
    type: 'buff',
    noStack: true,
    desc: () => '正在复苏，暂时不会受到伤害。',
  },
  {
    id: 'stunned',
    name: '眩晕',
    art: '💫',
    type: 'debuff',
    noStack: true,
    desc: () => '下回合无法行动。',
  },
  {
    id: 'shrink',
    name: '缩小',
    art: '🔻',
    type: 'debuff',
    desc: (n) => `造成的攻击伤害降低 ${n * 10}%。`,
    dmgOut: (_g, _o, n, d) => d * Math.max(0.3, 1 - n * 0.1),
  },
  {
    id: 'hive_mind',
    name: '蜂群意志',
    art: '🐝',
    type: 'buff',
    desc: (n) => `每当一名同伴死亡，获得 ${n} 点力量。`,
    onEnemyDeath: (g, o, n, dead) => {
      if (dead !== o) g.apply(o, 'strength', n, o);
    },
  },
  {
    id: 'fading',
    name: '消逝',
    art: '⌛',
    type: 'buff',
    desc: (n) => `${n} 回合后死亡。`,
    onTurnEnd: (g, o, n) => {
      if (n <= 1) g.loseHp(o, o.hp + o.block);
      else g.reducePower(o, 'fading', 1);
    },
  },
  {
    id: 'malleable',
    name: '可塑',
    art: '🫠',
    type: 'buff',
    desc: (n) => `受到攻击伤害时获得 ${n} 点格挡，并使该数值 +1。`,
    onHpLost: (g, o, n, _a, src) => {
      if (src && src !== o && !o.dead) {
        g.gainBlock(o, n);
        o.powers.malleable = n + 1;
      }
    },
  },
  {
    id: 'thievery',
    name: '偷窃',
    art: '💰',
    type: 'buff',
    desc: (n) => `攻击时偷取 ${n} 金币。`,
  },
  {
    id: 'consume',
    name: '吞噬',
    art: '🫦',
    type: 'buff',
    desc: (n) => `每当玩家消耗一张牌，获得 ${n} 点力量。`,
    onExhaust: (g, o, n) => {
      g.apply(o, 'strength', n, o);
    },
  },
  {
    id: 'mirror_shield',
    name: '镜盾',
    art: '🪞',
    type: 'buff',
    decay: 'startClear',
    desc: (n) => `受到攻击时，将 ${n} 点伤害反弹给攻击者。`,
    onAttacked: (g, o, n, src) => {
      if (src !== o) g.thorns(src, n, o);
    },
  },
  {
    id: 'empower_allies',
    name: '统御',
    art: '📯',
    type: 'buff',
    desc: (n) => `回合结束时，所有其他敌人获得 ${n} 点力量。`,
    onTurnEnd: (g, o, n) => {
      for (const e of g.alive) if (e !== o) g.apply(e, 'strength', n, o);
    },
  },
  // ---------------------------------------------------------------------------
  // Claude
  // ---------------------------------------------------------------------------
  {
    id: 'extended_thinking',
    name: '扩展思考',
    art: '🧠',
    type: 'buff',
    desc: (n) => `回合开始时，思考 ${n}。`,
    onTurnStart: (g, _o, n) => g.think(n),
  },
  {
    id: 'chain_of_thought',
    name: '链式思考',
    art: '🔗',
    type: 'buff',
    desc: (n) => `每当你思考，获得 ${n} 点格挡。`,
    onThink: (g, o, n) => g.gainBlock(o, n),
  },
  {
    id: 'prompt_caching',
    name: '提示缓存',
    art: '🗄️',
    type: 'buff',
    desc: (n) => `每当你压缩时，记录 ${n}。`,
    onCompact: (g, _o, n) => g.note(n),
  },
  {
    id: 'subagent',
    name: '子代理',
    art: '🤖',
    type: 'buff',
    desc: (n) => `回合开始时，将 ${n} 张随机工具牌加入手牌。`,
    onTurnStartPostDraw: (g, _o, n) => g.addTools(n),
  },
  {
    id: 'memory_consolidation',
    name: '记忆整理',
    art: '🗃️',
    type: 'buff',
    desc: (n) => `每当你压缩时，获得 ${n} 点格挡。`,
    onCompact: (g, o, n) => g.gainBlock(o, n),
  },
  {
    id: 'million_context',
    name: '百万上下文',
    art: '🌌',
    type: 'buff',
    desc: (n) => `上下文窗口已扩大。回合开始时，记录 ${n}。`,
    onTurnStartPostDraw: (g, _o, n) => g.note(n),
  },
  {
    id: 'constitution',
    name: '宪法',
    art: '📜',
    type: 'buff',
    desc: (n) => `回合开始时，获得 ${n} 点格挡，抽 1 张牌，并给予所有敌人 1 层虚弱。`,
    onTurnStartPostDraw: (g, o, n) => {
      g.gainBlock(o, n);
      g.draw(1);
      for (const e of g.alive) g.apply(e, 'weak', 1);
    },
  },
  {
    id: 'agentic_loop',
    name: '智能体循环',
    art: '🔁',
    type: 'buff',
    desc: (n) => `你打出的工具牌会额外打出 ${n} 次。`,
  },
  {
    id: 'emergence',
    name: '涌现',
    art: '🦋',
    type: 'buff',
    desc: (n) => `每当你压缩时，获得 ${n} 点力量和 ${n} 点敏捷。`,
    onCompact: (g, o, n) => {
      g.apply(o, 'strength', n);
      g.apply(o, 'dexterity', n);
    },
  },
  {
    id: 'self_reflection',
    name: '自我反思',
    art: '🪞',
    type: 'buff',
    noStack: true,
    desc: () => '每当你压缩时，升级手牌中的所有牌（本场战斗）。',
    onCompact: (g) => {
      for (const c of g.hand) upgradeCard(c);
    },
  },
]);
