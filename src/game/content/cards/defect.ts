import { defineCards } from '../../registry';
import { cardDef, uv } from '../../cards';
import { COST_X } from '../../types';
import { ORB_IDS } from '../../orbs';
import { B, M, hit, hitAll, hitRandom, isType } from './helpers';

const DF = 'defect' as const;

/** 故障机器人：充能球 + 集中 */
defineCards([
  // ---------------------------------------------------------------- 基础
  {
    id: 'strike_b', name: '打击', color: DF, type: 'attack', rarity: 'basic', cost: 1, target: 'enemy',
    dmg: [6, 9], text: '造成 {D} 点伤害。', art: '⚔️', tags: ['strike', 'starter'],
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'defend_b', name: '防御', color: DF, type: 'skill', rarity: 'basic', cost: 1, target: 'self',
    blk: [5, 8], text: '获得 {B} 点格挡。', art: '🛡️', tags: ['starter'],
    play: (g, c) => g.block(B(g, c)),
  },
  {
    id: 'zap', name: '电击', color: DF, type: 'skill', rarity: 'basic', cost: [1, 0], target: 'self',
    text: '生成 1 个闪电。', art: '⚡',
    play: (g) => g.channel('lightning'),
  },
  {
    id: 'dualcast', name: '双重释放', color: DF, type: 'skill', rarity: 'basic', cost: [1, 0], target: 'self',
    text: '激发最左侧的充能球两次。', art: '♊',
    play: (g) => g.evoke(2),
  },
  // ---------------------------------------------------------------- 普通
  {
    id: 'ball_lightning', name: '球状闪电', color: DF, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [7, 10], text: '造成 {D} 点伤害。\n生成 1 个闪电。', art: '🌩️',
    play: (g, c, t) => {
      hit(g, c, t);
      g.channel('lightning');
    },
  },
  {
    id: 'barrage', name: '弹幕齐射', color: DF, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [4, 6], text: '每有一个充能球，造成 {D} 点伤害一次。', art: '🎆',
    play: (g, c, t) => hit(g, c, t, g.orbs.length),
  },
  {
    id: 'beam_cell', name: '光束射线', color: DF, type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
    dmg: [3, 4], mag: [1, 2], text: '造成 {D} 点伤害。\n给予 {M} 层易伤。', art: '🔦',
    play: (g, c, t) => {
      hit(g, c, t);
      g.apply(t, 'vulnerable', M(c));
    },
  },
  {
    id: 'charge_battery', name: '充电', color: DF, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    blk: [7, 10], text: '获得 {B} 点格挡。\n下回合获得 1 点能量。', art: '🔋',
    play: (g, c) => {
      g.block(B(g, c));
      g.apply(g.player, 'energized', 1);
    },
  },
  {
    id: 'claw', name: '爪击', color: DF, type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
    dmg: [3, 5], text: '造成 {D} 点伤害。\n本场战斗中所有「爪击」的伤害提高 2。', art: '🦾',
    dmgFn: (g, c) => (c.up ? 5 : 3) + (g?.flags.claw ?? 0),
    play: (g, c, t) => {
      hit(g, c, t);
      g.flags.claw = (g.flags.claw ?? 0) + 2;
    },
  },
  {
    id: 'cold_snap', name: '寒流', color: DF, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [6, 9], text: '造成 {D} 点伤害。\n生成 1 个冰霜。', art: '🥶',
    play: (g, c, t) => {
      hit(g, c, t);
      g.channel('frost');
    },
  },
  {
    id: 'compile_driver', name: '编译冲击', color: DF, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [7, 10], text: '造成 {D} 点伤害。\n你每有一种不同的充能球，抽 1 张牌。', art: '💽',
    play: (g, c, t) => {
      hit(g, c, t);
      g.draw(new Set(g.orbs.map((o) => o.id)).size);
    },
  },
  {
    id: 'coolheaded', name: '冷静头脑', color: DF, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    mag: [1, 2], text: '生成 1 个冰霜。\n抽 {M} 张牌。', art: '🧊',
    play: (g, c) => {
      g.channel('frost');
      g.draw(M(c));
    },
  },
  {
    id: 'go_for_the_eyes', name: '直攻要害', color: DF, type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
    dmg: [3, 4], mag: [1, 2], text: '造成 {D} 点伤害。\n若敌人意图攻击，给予 {M} 层虚弱。', art: '👁️',
    play: (g, c, t) => {
      const atk = t ? g.isAttacking(t) : false;
      hit(g, c, t);
      if (atk) g.apply(t, 'weak', M(c));
    },
  },
  {
    id: 'hologram', name: '全息影像', color: DF, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    blk: [3, 5], exhaust: [true, false], text: '获得 {B} 点格挡。\n将弃牌堆中的一张牌放入手牌。', art: '📽️',
    play: (g, c) => {
      g.block(B(g, c));
      g.chooseCards({ title: '选择一张牌放入手牌', cards: [...g.discardPile], min: 1, max: 1 }, (s) => s.forEach((x) => g.moveTo(x, 'hand')));
    },
  },
  {
    id: 'leap', name: '跃迁', color: DF, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    blk: [9, 12], text: '获得 {B} 点格挡。', art: '🦘',
    play: (g, c) => g.block(B(g, c)),
  },
  {
    id: 'recursion', name: '递归', color: DF, type: 'skill', rarity: 'common', cost: [1, 0], target: 'self',
    text: '激发最左侧的充能球，然后生成一个同类型的充能球。', art: '🔁',
    play: (g) => {
      const o = g.orbs[0];
      if (!o) return;
      g.evoke(1);
      g.channel(o.id);
    },
  },
  {
    id: 'stack', name: '堆栈', color: DF, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    text: ['获得等同于弃牌堆牌数的格挡（{B}）。', '获得等同于弃牌堆牌数 +3 的格挡（{B}）。'], art: '🗄️',
    blkFn: (g, c) => (g?.discardPile.length ?? 0) + (c.up ? 3 : 0),
    play: (g, c) => g.block(B(g, c)),
  },
  {
    id: 'steam_barrier', name: '蒸汽屏障', color: DF, type: 'skill', rarity: 'common', cost: 0, target: 'self',
    blk: [6, 8], text: '获得 {B} 点格挡。\n本场战斗中这张牌的格挡降低 1。', art: '♨️',
    play: (g, c) => {
      g.block(B(g, c));
      c.tmpBlk = (c.tmpBlk ?? 0) - 1;
    },
  },
  {
    id: 'streamline', name: '精简', color: DF, type: 'attack', rarity: 'common', cost: 2, target: 'enemy',
    dmg: [15, 20], text: '造成 {D} 点伤害。\n本场战斗中这张牌的费用减少 1。', art: '📉',
    play: (g, c, t) => {
      hit(g, c, t);
      c.costCombat = Math.max(0, (c.costCombat ?? g.costOf(c)) - 1);
    },
  },
  {
    id: 'sweeping_beam', name: '扫荡射线', color: DF, type: 'attack', rarity: 'common', cost: 1, target: 'all',
    dmg: [6, 9], text: '对所有敌人造成 {D} 点伤害。\n抽 1 张牌。', art: '📡',
    play: (g, c) => {
      hitAll(g, c);
      g.draw(1);
    },
  },
  {
    id: 'turbo', name: '涡轮', color: DF, type: 'skill', rarity: 'common', cost: 0, target: 'self',
    mag: [2, 3], text: '获得 {M} 点能量。\n将一张虚空放入弃牌堆。', art: '🌀',
    play: (g, c) => {
      g.gainEnergy(M(c));
      g.addToDiscard('void');
    },
  },
  // ---------------------------------------------------------------- 罕见
  {
    id: 'aggregate', name: '聚合', color: DF, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [4, 3], text: '抽牌堆中每有 {M} 张牌，获得 1 点能量。', art: '🧮',
    play: (g, c) => g.gainEnergy(Math.floor(g.drawPile.length / M(c))),
  },
  {
    id: 'auto_shields', name: '自动护盾', color: DF, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    blk: [11, 15], text: '若你没有格挡，获得 {B} 点格挡。', art: '🛡️',
    play: (g, c) => {
      if (g.player.block === 0) g.block(B(g, c));
    },
  },
  {
    id: 'blizzard', name: '暴风雪', color: DF, type: 'attack', rarity: 'uncommon', cost: 1, target: 'all',
    mag: [2, 3], text: '本场战斗中每生成过一个冰霜，对所有敌人造成 {M} 点伤害（{D}）。', art: '🌨️',
    dmgFn: (g, c) => (g?.total.frost ?? 0) * (c.up ? 3 : 2),
    play: (g, c) => hitAll(g, c),
  },
  {
    id: 'boot_sequence', name: '启动流程', color: DF, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    blk: [10, 13], innate: true, exhaust: true, text: '获得 {B} 点格挡。', art: '💻',
    play: (g, c) => g.block(B(g, c)),
  },
  {
    id: 'capacitor', name: '电容器', color: DF, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [2, 3], text: '获得 {M} 个充能球栏位。', art: '🔌',
    play: (g, c) => g.addOrbSlots(M(c)),
  },
  {
    id: 'chaos', name: '混沌', color: DF, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [1, 2], text: '随机生成 {M} 个充能球。', art: '🎲',
    play: (g, c) => {
      for (let i = 0; i < M(c); i++) g.channel(g.rng.pick(ORB_IDS));
    },
  },
  {
    id: 'chill', name: '冰冷', color: DF, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    exhaust: true, innate: [false, true], text: '每有一名敌人，生成 1 个冰霜。', art: '🥶',
    play: (g) => g.alive.forEach(() => g.channel('frost')),
  },
  {
    id: 'consume_orb', name: '吞噬', color: DF, type: 'skill', rarity: 'uncommon', cost: 2, target: 'self',
    mag: [2, 3], text: '获得 {M} 点集中。\n失去 1 个充能球栏位。', art: '🍽️',
    play: (g, c) => {
      g.apply(g.player, 'focus', M(c));
      g.addOrbSlots(-1);
    },
  },
  {
    id: 'darkness', name: '黑暗', color: DF, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    text: ['生成 1 个黑暗。', '生成 1 个黑暗。\n触发所有黑暗的被动。'], art: '🌑',
    play: (g, c) => {
      g.channel('dark');
      if (c.up) for (const o of g.orbs.filter((x) => x.id === 'dark')) g.triggerPassive(o);
    },
  },
  {
    id: 'defragment', name: '碎片整理', color: DF, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [1, 2], text: '获得 {M} 点集中。', art: '🧩',
    play: (g, c) => g.apply(g.player, 'focus', M(c)),
  },
  {
    id: 'doom_and_gloom', name: '末日与绝望', color: DF, type: 'attack', rarity: 'uncommon', cost: 2, target: 'all',
    dmg: [10, 14], text: '对所有敌人造成 {D} 点伤害。\n生成 1 个黑暗。', art: '🌫️',
    play: (g, c) => {
      hitAll(g, c);
      g.channel('dark');
    },
  },
  {
    id: 'double_energy', name: '双倍能量', color: DF, type: 'skill', rarity: 'uncommon', cost: [1, 0], target: 'self',
    exhaust: true, text: '使你的能量翻倍。', art: '⚡',
    play: (g) => g.gainEnergy(g.energy),
  },
  {
    id: 'equilibrium', name: '均衡', color: DF, type: 'skill', rarity: 'uncommon', cost: 2, target: 'self',
    blk: [13, 16], text: '获得 {B} 点格挡。\n本回合结束时保留你的手牌。', art: '⚖️',
    play: (g, c) => {
      g.block(B(g, c));
      g.apply(g.player, 'equilibrium', 1);
    },
  },
  {
    id: 'ftl', name: '超光速', color: DF, type: 'attack', rarity: 'uncommon', cost: 0, target: 'enemy',
    dmg: [5, 6], mag: [3, 4], text: '造成 {D} 点伤害。\n若本回合打出的牌少于 {M} 张，抽 1 张牌。', art: '🚀',
    play: (g, c, t) => {
      hit(g, c, t);
      if (g.t.cards <= M(c)) g.draw(1);
    },
  },
  {
    id: 'force_field', name: '力场', color: DF, type: 'skill', rarity: 'uncommon', cost: 4, target: 'self',
    blk: [12, 16], text: '本场战斗中你每打出过一张能力牌，这张牌的费用减少 1。\n获得 {B} 点格挡。', art: '🔵',
    costFn: (g, _c, cost) => Math.max(0, cost - g.total.powers),
    play: (g, c) => g.block(B(g, c)),
  },
  {
    id: 'fusion', name: '聚变', color: DF, type: 'skill', rarity: 'uncommon', cost: [2, 1], target: 'self',
    text: '生成 1 个等离子。', art: '☢️',
    play: (g) => g.channel('plasma'),
  },
  {
    id: 'glacier', name: '冰川', color: DF, type: 'skill', rarity: 'uncommon', cost: 2, target: 'self',
    blk: [7, 10], text: '获得 {B} 点格挡。\n生成 2 个冰霜。', art: '🏔️',
    play: (g, c) => {
      g.block(B(g, c));
      g.channel('frost');
      g.channel('frost');
    },
  },
  {
    id: 'heatsinks', name: '散热片', color: DF, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [1, 2], text: '每当你打出一张能力牌，抽 {M} 张牌。', art: '🌡️',
    play: (g, c) => g.apply(g.player, 'heatsinks', M(c)),
  },
  {
    id: 'hello_world', name: '你好世界', color: DF, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    innate: [false, true], text: '回合开始时，将一张随机普通牌加入手牌。', art: '👋',
    play: (g) => g.apply(g.player, 'hello_world', 1),
  },
  {
    id: 'loop', name: '循环', color: DF, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [1, 2], text: '回合开始时，触发最左侧充能球的被动 {M} 次。', art: '➰',
    play: (g, c) => g.apply(g.player, 'loop', M(c)),
  },
  {
    id: 'melter', name: '熔化', color: DF, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    dmg: [10, 14], text: '移除敌人的所有格挡。\n造成 {D} 点伤害。', art: '🫠',
    play: (g, c, t) => {
      if (t) t.block = 0;
      hit(g, c, t);
    },
  },
  {
    id: 'overclock', name: '超频', color: DF, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    mag: [2, 3], text: '抽 {M} 张牌。\n将一张灼伤放入弃牌堆。', art: '🔥',
    play: (g, c) => {
      g.draw(M(c));
      g.addToDiscard('burn');
    },
  },
  {
    id: 'recycle', name: '回收', color: DF, type: 'skill', rarity: 'uncommon', cost: [1, 0], target: 'self',
    text: '消耗一张手牌。\n获得等同于其费用的能量。', art: '♻️',
    play: (g) =>
      g.chooseHand({ title: '选择一张牌消耗', min: 1, max: 1 }, (s) => {
        for (const x of s) {
          const cost = uv(cardDef(x).cost, x.up) ?? 0;
          const e = cost === COST_X ? g.energy : Math.max(0, g.costOf(x) === Infinity ? 0 : g.costOf(x));
          g.exhaustCard(x);
          g.gainEnergy(e);
        }
      }),
  },
  {
    id: 'reinforced_body', name: '强化躯体', color: DF, type: 'skill', rarity: 'uncommon', cost: COST_X, target: 'self',
    blk: [7, 9], text: '获得 {B} 点格挡 X 次。', art: '🦿',
    play: (g, c) => {
      for (let i = 0; i < g.x; i++) g.block(B(g, c));
    },
  },
  {
    id: 'reprogram', name: '重新编程', color: DF, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [1, 2], text: '失去 {M} 点集中。\n获得 {M} 点力量和 {M} 点敏捷。', art: '⌨️',
    play: (g, c) => {
      g.apply(g.player, 'focus', -M(c), g.player);
      g.apply(g.player, 'strength', M(c));
      g.apply(g.player, 'dexterity', M(c));
    },
  },
  {
    id: 'rip_and_tear', name: '撕裂', color: DF, type: 'attack', rarity: 'uncommon', cost: 1, target: 'all',
    dmg: [7, 9], text: '随机对敌人造成 {D} 点伤害两次。', art: '✂️',
    play: (g, c) => hitRandom(g, c, 2),
  },
  {
    id: 'scrape', name: '刮削', color: DF, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    dmg: [7, 10], mag: [4, 5], text: '造成 {D} 点伤害。\n抽 {M} 张牌，丢弃其中费用不为 0 的牌。', art: '🪚',
    play: (g, c, t) => {
      hit(g, c, t);
      for (const x of g.draw(M(c))) if (g.costOf(x) !== 0) g.discardCard(x);
    },
  },
  {
    id: 'self_repair', name: '自我修复', color: DF, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [7, 10], text: '战斗结束时，回复 {M} 点生命。', art: '🔧', tags: ['healing'],
    play: (g, c) => g.apply(g.player, 'self_repair', M(c)),
  },
  {
    id: 'skim', name: '浏览', color: DF, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [3, 4], text: '抽 {M} 张牌。', art: '📄',
    play: (g, c) => g.draw(M(c)),
  },
  {
    id: 'static_discharge', name: '静电释放', color: DF, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [1, 2], text: '每当你受到未被格挡的攻击伤害，生成 {M} 个闪电。', art: '⚡',
    play: (g, c) => g.apply(g.player, 'static_discharge', M(c)),
  },
  {
    id: 'storm', name: '风暴', color: DF, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    innate: [false, true], text: '每当你打出一张能力牌，生成 1 个闪电。', art: '⛈️',
    play: (g) => g.apply(g.player, 'storm', 1),
  },
  {
    id: 'sunder', name: '粉碎', color: DF, type: 'attack', rarity: 'uncommon', cost: 3, target: 'enemy',
    dmg: [24, 32], text: '造成 {D} 点伤害。\n若击杀敌人，获得 3 点能量。', art: '🔨',
    play: (g, c, t) => {
      if (hit(g, c, t)) g.gainEnergy(3);
    },
  },
  {
    id: 'tempest', name: '暴雨', color: DF, type: 'skill', rarity: 'uncommon', cost: COST_X, target: 'self',
    exhaust: true, text: ['生成 X 个闪电。', '生成 X+1 个闪电。'], art: '🌧️',
    play: (g, c) => {
      for (let i = 0; i < g.x + (c.up ? 1 : 0); i++) g.channel('lightning');
    },
  },
  {
    id: 'white_noise', name: '白噪声', color: DF, type: 'skill', rarity: 'uncommon', cost: [1, 0], target: 'self',
    exhaust: true, text: '将一张随机能力牌加入手牌，它本回合费用为 0。', art: '📻',
    play: (g) => {
      const [x] = g.randomCards(1, (id) => cardDef(id).type === 'power');
      if (x) {
        x.costTurn = 0;
        g.addToHand(x);
      }
    },
  },
  // ---------------------------------------------------------------- 稀有
  {
    id: 'all_for_one', name: '万物一心', color: DF, type: 'attack', rarity: 'rare', cost: 2, target: 'enemy',
    dmg: [10, 14], text: '造成 {D} 点伤害。\n将弃牌堆中所有 0 费牌放入手牌。', art: '🫶',
    play: (g, c, t) => {
      hit(g, c, t);
      for (const x of g.discardPile.filter((y) => g.costOf(y) === 0 && !isType(y, 'status'))) g.moveTo(x, 'hand');
    },
  },
  {
    id: 'amplify', name: '增幅', color: DF, type: 'skill', rarity: 'rare', cost: 1, target: 'self',
    mag: [1, 2], text: '本回合你打出的下 {M} 张能力牌会被打出两次。', art: '📢',
    play: (g, c) => g.apply(g.player, 'amplify', M(c)),
  },
  {
    id: 'biased_cognition', name: '偏差认知', color: DF, type: 'power', rarity: 'rare', cost: 1, target: 'self',
    mag: [4, 5], text: '获得 {M} 点集中。\n回合开始时，失去 1 点集中。', art: '🧠',
    play: (g, c) => {
      g.apply(g.player, 'focus', M(c));
      g.apply(g.player, 'biased_cognition', 1);
    },
  },
  {
    id: 'buffer', name: '缓冲', color: DF, type: 'power', rarity: 'rare', cost: 2, target: 'self',
    mag: [1, 2], text: '获得 {M} 层缓冲。', art: '🫧',
    play: (g, c) => g.apply(g.player, 'buffer', M(c)),
  },
  {
    id: 'core_surge', name: '核心电涌', color: DF, type: 'attack', rarity: 'rare', cost: 1, target: 'enemy',
    dmg: [11, 15], exhaust: true, text: '造成 {D} 点伤害。\n获得 1 层人工制品。', art: '💠',
    play: (g, c, t) => {
      hit(g, c, t);
      g.apply(g.player, 'artifact', 1);
    },
  },
  {
    id: 'creative_ai', name: '创造性 AI', color: DF, type: 'power', rarity: 'rare', cost: [3, 2], target: 'self',
    text: '回合开始时，将一张随机能力牌加入手牌。', art: '🤖',
    play: (g) => g.apply(g.player, 'creative_ai', 1),
  },
  {
    id: 'echo_form', name: '回响形态', color: DF, type: 'power', rarity: 'rare', cost: 3, target: 'self',
    ethereal: [true, false], text: '每回合你打出的第一张牌会被打出两次。', art: '🔊',
    play: (g) => g.apply(g.player, 'echo_form', 1),
  },
  {
    id: 'electrodynamics', name: '电动力学', color: DF, type: 'power', rarity: 'rare', cost: 2, target: 'self',
    mag: [2, 3], text: '闪电现在会命中所有敌人。\n生成 {M} 个闪电。', art: '🌐',
    play: (g, c) => {
      g.apply(g.player, 'electrodynamics', 1);
      for (let i = 0; i < M(c); i++) g.channel('lightning');
    },
  },
  {
    id: 'fission', name: '裂变', color: DF, type: 'skill', rarity: 'rare', cost: 0, target: 'self',
    exhaust: true, text: ['移除所有充能球。\n每移除一个，获得 1 点能量并抽 1 张牌。', '激发所有充能球。\n每激发一个，获得 1 点能量并抽 1 张牌。'], art: '⚛️',
    play: (g, c) => {
      const n = g.orbs.length;
      if (c.up) g.evokeAll();
      else g.orbs = [];
      g.gainEnergy(n);
      g.draw(n);
    },
  },
  {
    id: 'hyperbeam', name: '超能光束', color: DF, type: 'attack', rarity: 'rare', cost: 2, target: 'all',
    dmg: [26, 34], text: '对所有敌人造成 {D} 点伤害。\n失去 3 点集中。', art: '🔆',
    play: (g, c) => {
      hitAll(g, c);
      g.apply(g.player, 'focus', -3, g.player);
    },
  },
  {
    id: 'machine_learning', name: '机器学习', color: DF, type: 'power', rarity: 'rare', cost: 1, target: 'self',
    innate: [false, true], text: '回合开始时，额外抽 1 张牌。', art: '📈',
    play: (g) => g.apply(g.player, 'machine_learning', 1),
  },
  {
    id: 'meteor_strike', name: '流星打击', color: DF, type: 'attack', rarity: 'rare', cost: 5, target: 'enemy',
    dmg: [24, 30], text: '造成 {D} 点伤害。\n生成 3 个等离子。', art: '☄️',
    play: (g, c, t) => {
      hit(g, c, t);
      for (let i = 0; i < 3; i++) g.channel('plasma');
    },
  },
  {
    id: 'multi_cast', name: '多重释放', color: DF, type: 'skill', rarity: 'rare', cost: COST_X, target: 'self',
    text: ['激发最左侧的充能球 X 次。', '激发最左侧的充能球 X+1 次。'], art: '🎇',
    play: (g, c) => {
      const n = g.x + (c.up ? 1 : 0);
      if (n > 0) g.evoke(n);
    },
  },
  {
    id: 'rainbow', name: '彩虹', color: DF, type: 'skill', rarity: 'rare', cost: 2, target: 'self',
    exhaust: [true, false], text: '生成 1 个闪电、1 个冰霜和 1 个黑暗。', art: '🌈',
    play: (g) => {
      g.channel('lightning');
      g.channel('frost');
      g.channel('dark');
    },
  },
  {
    id: 'reboot', name: '重启', color: DF, type: 'skill', rarity: 'rare', cost: 0, target: 'self',
    mag: [4, 6], exhaust: true, text: '将手牌和弃牌堆洗入抽牌堆。\n抽 {M} 张牌。', art: '🔄',
    play: (g, c) => {
      for (const x of [...g.hand]) g.moveTo(x, 'discard');
      g.shuffleDiscardIntoDraw();
      g.draw(M(c));
    },
  },
  {
    id: 'seek', name: '搜寻', color: DF, type: 'skill', rarity: 'rare', cost: 0, target: 'self',
    mag: [1, 2], exhaust: true, text: '从抽牌堆中选择 {M} 张牌放入手牌。', art: '🔍',
    play: (g, c) =>
      g.chooseCards({ title: `选择 ${M(c)} 张牌放入手牌`, cards: [...g.drawPile], min: M(c), max: M(c) }, (s) =>
        s.forEach((x) => g.moveTo(x, 'hand')),
      ),
  },
  {
    id: 'thunder_strike', name: '雷霆打击', color: DF, type: 'attack', rarity: 'rare', cost: 3, target: 'all',
    dmg: [7, 9], text: '本场战斗中每生成过一个闪电，随机对敌人造成 {D} 点伤害一次。', art: '🌩️',
    play: (g, c) => hitRandom(g, c, g.total.lightning),
  },
]);

