import { defineEncounters, defineEnemies, definePowers } from '../../registry';
import type { Combat } from '../../combat';
import type { Enemy } from '../../types';
import { atk, atkThen, buffSelf, cycle, last, move, pickMove, steal } from './ai';

/** 第一幕（另一条路线）：地下船坞（怪物与数值参照原版） */
defineEnemies([
  // ------------------------------------------------------------------ 普通
  {
    id: 'corpse_slug', name: '腐尸蛞蝓', art: '🐌', hp: [25, 27],
    desc: '成群出没的食腐者。同伴一死，它就扑上去吞掉残骸并变得更强。',
    init: (e, g) => void g.apply(e, 'ravenous', 4, e),
    moves: {
      whip: atk('鞭打', 3, 2),
      glomp: atk('猛吞', 8),
      goop: move('黏液', 'debuff', (e, g) => void g.apply(g.player, 'frail', 2, e)),
      devour: move('吞食残骸', 'buff', (e, g) => {
        e.mem.devour = 0;
        g.apply(e, 'strength', g.pw(e, 'ravenous'), e);
      }),
    },
    ai: (e, g) => {
      if (e.mem.devour) return 'devour';
      const idx = g.enemies.filter((x) => x.defId === 'corpse_slug').indexOf(e);
      if (e.turns === 0) return ['whip', 'glomp', 'goop'][idx % 3];
      return pickMove(g, [
        ['whip', 40, last(e, 'whip')],
        ['glomp', 40, last(e, 'glomp')],
        ['goop', 20, last(e, 'goop')],
      ]);
    },
  },
  {
    id: 'calcified_cultist', name: '钙化信徒', art: '🦴', hp: [38, 41],
    desc: '第一回合吟诵，之后每回合都更强。',
    moves: {
      incant: buffSelf('吟诵', 'ritual', 2),
      strike: atk('黑暗打击', 9),
    },
    ai: (e) => (e.turns === 0 ? 'incant' : 'strike'),
  },
  {
    id: 'damp_cultist', name: '湿漉信徒', art: '💧', hp: [51, 53],
    desc: '起手很弱，但仪式之力极强：每回合获得 5 点力量。',
    moves: {
      incant: buffSelf('吟诵', 'ritual', 5),
      strike: atk('黑暗打击', 1),
    },
    ai: (e) => (e.turns === 0 ? 'incant' : 'strike'),
  },
  {
    id: 'fossil_stalker', name: '化石潜猎者', art: '🦕', hp: [51, 53], size: 1.15,
    moves: {
      tackle: atkThen('擒抱', 9, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'frail', 1, e)),
      latch: atk('咬住', 12),
      lash: atk('甩尾', 3, 2),
    },
    ai: (e, g) => pickMove(g, [
      ['tackle', 35, last(e, 'tackle')],
      ['latch', 35, last(e, 'latch')],
      ['lash', 30, last(e, 'lash')],
    ]),
  },
  {
    id: 'gremlin_merc', name: '地精佣兵', art: '👺', hp: [47, 49],
    desc: '每次攻击都会顺手偷走金币，击败它才能夺回。',
    init: (e, g) => void g.apply(e, 'thief', 1, e),
    moves: {
      gimme: atkThen('给我！', 7, 2, 'attack', (e, g) => steal(e, g, 10)),
      smash: atkThen('双重猛击', 6, 2, 'attackDebuff', (e, g) => {
        g.apply(g.player, 'weak', 2, e);
        steal(e, g, 10);
      }),
      hehe: atkThen('嘿嘿', 8, 1, 'attackBuff', (e, g) => {
        g.apply(e, 'strength', 2, e);
        steal(e, g, 10);
      }),
    },
    ai: (e) => cycle(e, ['gimme', 'smash', 'hehe']),
  },
  {
    id: 'haunted_ship', name: '幽灵船', art: '⛵', hp: [63, 63], size: 1.3,
    desc: '一艘被亡魂驱动的破船。固定循环：全速撞击 → 横扫 → 踩踏 → 作祟，「作祟」会同时施加虚弱、脆弱与易伤。',
    moves: {
      ram: atkThen('全速撞击', 10, 1, 'attackDebuff', (_e, g) => g.addToDiscard('wound', false, 2)),
      haunt: move('作祟', 'strongDebuff', (e, g) => {
        g.apply(g.player, 'weak', 2, e);
        g.apply(g.player, 'frail', 2, e);
        g.apply(g.player, 'vulnerable', 2, e);
      }),
      swipe: atk('横扫', 13),
      stomp: atk('踩踏', 4, 3),
    },
    ai: (e) => cycle(e, ['ram', 'swipe', 'stomp', 'haunt']),
  },
  {
    id: 'living_fog', name: '活体迷雾', art: '🌫️', hp: [80, 80], size: 1.2,
    moves: {
      advanced: atk('高级毒气', 8),
      bloat: atkThen('膨胀', 5, 1, 'attackBuff', (e, g) => void g.apply(e, 'strength', 1, e)),
      blast: atk('超级毒气爆', 8),
    },
    ai: (e) => (e.turns === 0 ? 'advanced' : cycle(e, ['bloat', 'blast'], 1)),
  },
  {
    id: 'punch_construct', name: '拳击构装体', art: '🥊', hp: [55, 55], size: 1.15,
    moves: {
      ready: move('预备！', 'defend', (e, g) => g.gainBlock(e, 10)),
      strong: atk('重拳', 14),
      fast: atkThen('快拳', 5, 2, 'attackDebuff', (e, g) => void g.apply(g.player, 'frail', 1, e)),
    },
    ai: (e) => cycle(e, ['ready', 'strong', 'fast']),
  },
  {
    id: 'seapunk', name: '海洋朋克', art: '🐟', hp: [44, 46],
    moves: {
      kick: atk('海踢', 11),
      spin: atk('旋风腿', 2, 4),
      burp: move('泡泡嗝', 'defendBuff', (e, g) => {
        g.gainBlock(e, 7);
        g.apply(e, 'strength', 1, e);
      }),
    },
    ai: (e, g) => pickMove(g, [
      ['kick', 40, last(e, 'kick')],
      ['spin', 35, last(e, 'spin')],
      ['burp', 25, last(e, 'burp')],
    ]),
  },
  {
    id: 'sewer_clam', name: '下水道巨蛤', art: '🦪', hp: [56, 56], size: 1.15,
    moves: {
      jet: atk('喷射', 10),
      pressurize: buffSelf('加压', 'strength', 4),
    },
    ai: (e) => cycle(e, ['jet', 'jet', 'pressurize']),
  },
  {
    id: 'sludge_spinner', name: '淤泥陀螺', art: '🌀', hp: [37, 39],
    moves: {
      spray: atkThen('喷油', 8, 1, 'attackDebuff', (_e, g) => g.addToDiscard('slimed')),
      slam: atk('猛撞', 11),
      rage: atkThen('暴怒', 6, 1, 'attackBuff', (e, g) => void g.apply(e, 'strength', 2, e)),
    },
    ai: (e, g) => pickMove(g, [
      ['spray', 35, last(e, 'spray')],
      ['slam', 35, last(e, 'slam')],
      ['rage', 30, last(e, 'rage')],
    ]),
  },
  {
    id: 'toadpole', name: '蝌蚪蟾', art: '🐸', hp: [21, 25], size: 0.85,
    desc: '固定循环：旋转 → 长刺 → 吐刺。长刺后浑身是刺，攻击它会受伤。',
    moves: {
      whirl: atk('旋转', 7),
      spiken: buffSelf('长刺', 'thorns', 2),
      spit: atkThen('吐刺', 3, 3, 'attackBuff', (e, g) => void g.apply(e, 'thorns', 1, e)),
    },
    ai: (e, g) => {
      const idx = g.enemies.filter((x) => x.defId === 'toadpole').indexOf(e);
      return cycle(e, ['whirl', 'spiken', 'spit'], idx);
    },
  },
  {
    id: 'two_tailed_rat', name: '双尾鼠', art: '🐀', hp: [17, 21], size: 0.8,
    desc: '每只开场的招式都不同；只剩最后一只时会叫来援兵。',
    moves: {
      scratch: atk('抓挠', 8),
      bite: atk('病菌啃咬', 6),
      screech: move('尖叫', 'debuff', (e, g) => void g.apply(g.player, 'frail', 1, e)),
      backup: move('呼叫援兵', 'summon', (_e, g) => {
        if (g.alive.length < 4) g.spawnEnemy('two_tailed_rat', { at: 0 });
      }),
    },
    ai: (e, g) => {
      const rats = g.alive.filter((x) => x.defId === 'two_tailed_rat');
      const idx = rats.indexOf(e);
      if (e.turns === 0) return ['scratch', 'bite', 'screech'][Math.max(0, idx) % 3];
      if (rats.length === 1 && g.alive.length < 4 && !e.history.includes('backup')) return 'backup';
      return pickMove(g, [
        ['scratch', 40, last(e, 'scratch')],
        ['bite', 35, last(e, 'bite')],
        ['screech', 25, last(e, 'screech')],
      ]);
    },
  },
  // ------------------------------------------------------------------ 精英
  {
    id: 'phantasmal_gardener', name: '幻影园丁', art: '👻', hp: [26, 31], size: 0.9,
    desc: '四个一组，各自从循环的不同位置开始：咬 → 鞭打 → 乱挥 → 膨大。',
    init: (e, g) => void g.apply(e, 'skittish', 6, e),
    moves: {
      bite: atk('咬', 5),
      lash: atk('鞭打', 7),
      flail: atk('乱挥', 1, 3),
      enlarge: buffSelf('膨大', 'strength', 2),
    },
    ai: (e, g) => {
      const idx = g.enemies.filter((x) => x.defId === 'phantasmal_gardener').indexOf(e);
      return cycle(e, ['bite', 'lash', 'flail', 'enlarge'], idx);
    },
  },
  {
    id: 'skulking_colony', name: '潜行群落', art: '🐚', hp: [75, 75], size: 1.3,
    desc: '一整窝挤在硬壳里的小东西。硬化外壳让它每回合至多失去 20 点生命。',
    init: (e, g) => void g.apply(e, 'hardened_shell', 20, e),
    moves: {
      zoom: atk('猛冲', 14),
      inertia: atkThen('惯性', 9, 1, 'attackBuff', (e, g) => void g.apply(e, 'strength', 2, e)),
      stabs: atk('穿刺连击', 7, 2),
    },
    ai: (e) => cycle(e, ['zoom', 'zoom', 'inertia', 'stabs']),
  },
  {
    id: 'terror_eel', name: '恐惧鳗', art: '🐉', hp: [140, 140], size: 1.45,
    desc: '交替冲撞与狂甩。生命第一次降到一半时会被震晕，醒来后施加 99 层易伤。',
    moves: {
      crash: {
        name: '冲撞',
        intent: 'attack',
        dmg: 16,
        act: (e, g) => {
          g.enemyAttack(e, 16);
          g.removePower(e, 'vigor');
        },
      },
      thrash: atkThen('狂甩', 3, 3, 'attackBuff', (e, g) => void g.apply(e, 'vigor', 6, e)),
      stunned: move('震晕', 'stun', () => {}),
      terrorize: move('恐吓', 'strongDebuff', (e, g) => void g.apply(g.player, 'vulnerable', 99, e)),
    },
    ai: (e) => {
      if (e.hp <= e.maxHp / 2 && !e.mem.shocked) {
        e.mem.shocked = 1;
        return 'stunned';
      }
      if (last(e, 'stunned')) return 'terrorize';
      return last(e, 'crash') ? 'thrash' : 'crash';
    },
  },
  // ------------------------------------------------------------------ 首领
  {
    id: 'lagavulin_matriarch', name: '拉格夫林女族长', art: '🐢', hp: [222, 222], size: 1.7,
    desc: '在铁壳里沉睡，受到伤害或 3 回合后苏醒。她的「灵魂虹吸」会永久削减你的力量和敏捷。',
    init: (e, g) => {
      g.apply(e, 'metallicize', 8, e);
      g.apply(e, 'dormant', 1, e);
      e.mem.asleep = 1;
    },
    moves: {
      sleep: move('沉睡', 'sleep', (e, g) => {
        e.mem.sleepTurns = (e.mem.sleepTurns ?? 0) + 1;
        if (e.mem.sleepTurns >= 3) wake(e, g, false);
      }),
      stir: move('苏醒', 'stun', () => {}),
      slash: atk('斩击', 19),
      disembowel: atk('开膛', 9, 2),
      slash2: atkThen('回斩', 12, 1, 'attackDefend', (e, g) => g.gainBlock(e, 12)),
      siphon: move('灵魂虹吸', 'strongDebuff', (e, g) => {
        g.apply(e, 'strength', 2, e);
        g.apply(g.player, 'strength', -2, e);
        g.apply(g.player, 'dexterity', -2, e);
      }),
    },
    ai: (e) => {
      if (e.mem.asleep) return 'sleep';
      e.mem.awake = (e.mem.awake ?? 0) + 1;
      return ['slash', 'disembowel', 'slash2', 'siphon'][(e.mem.awake - 1) % 4];
    },
  },
  {
    id: 'soul_fysh', name: '魂鱼', art: '🐠', hp: [211, 211], size: 1.7,
    desc: '固定循环：召唤 → 排气 → 凝视 → 隐去 → 尖啸。隐去时几乎无法被伤害。',
    moves: {
      beckon: move('召唤', 'debuff', (_e, g) => g.addToDraw('void', false, 2)),
      degas: atk('排气', 16),
      gaze: atkThen('凝视', 7, 1, 'attackDebuff', (_e, g) => g.addToDiscard('dazed', false, 2)),
      fade: buffSelf('隐去', 'intangible', 1),
      scream: atkThen('尖啸', 13, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'vulnerable', 2, e)),
    },
    ai: (e) => cycle(e, ['beckon', 'degas', 'gaze', 'fade', 'scream']),
  },
  {
    id: 'waterfall_giant', name: '瀑布巨人', art: '🌊', hp: [240, 240], size: 1.75,
    desc: '每个行动都会积蓄蒸汽。「高压水枪」造成等于蒸汽层数的伤害，越往后越疼。',
    moves: {
      pressurize: buffSelf('加压', 'steam', 6),
      stomp: atkThen('践踏', 15, 1, 'attackDebuff', (e, g) => {
        g.apply(g.player, 'weak', 1, e);
        g.apply(e, 'steam', 3, e);
      }),
      ram: atkThen('冲撞', 10, 1, 'attackBuff', (e, g) => void g.apply(e, 'steam', 3, e)),
      siphon: move('虹吸', 'heal', (e, g) => {
        g.heal(e, 15);
        g.apply(e, 'steam', 4, e);
      }),
      gun: {
        name: '高压水枪',
        intent: 'attackBuff',
        dmg: (e, g) => Math.max(1, g.pw(e, 'steam')),
        act: (e, g) => {
          g.enemyAttack(e, Math.max(1, g.pw(e, 'steam')));
          if (!e.dead) g.apply(e, 'steam', 2, e);
        },
      },
      up: atkThen('压力升级', 13, 1, 'attackBuff', (e, g) => void g.apply(e, 'steam', 4, e)),
    },
    ai: (e) => cycle(e, ['pressurize', 'stomp', 'ram', 'siphon', 'gun', 'up']),
  },
]);

function wake(e: Enemy, g: Combat, byDamage: boolean) {
  if (!e.mem.asleep) return;
  e.mem.asleep = 0;
  g.removePower(e, 'metallicize');
  g.removePower(e, 'dormant');
  g.emit('text', e.uid, undefined, '苏醒了！');
  // 被打醒时本回合陷入眩晕；自然苏醒则下回合直接行动
  if (byDamage) e.move = 'stir';
}

definePowers([
  {
    id: 'dormant',
    name: '沉睡',
    art: '💤',
    type: 'buff',
    noStack: true,
    desc: () => '受到伤害时会苏醒。',
    onHpLost: (g, o) => {
      const e = o as Enemy;
      if (e.mem?.asleep) wake(e, g, true);
    },
  },
]);

const U = { act: 1, zone: 'underdocks' } as const;

defineEncounters([
  // 弱
  { ...U, id: 'u1_slugs', name: '腐尸蛞蝓', kind: 'weak', enemies: ['corpse_slug', 'corpse_slug'] },
  { ...U, id: 'u1_rats', name: '双尾鼠', kind: 'weak', enemies: ['two_tailed_rat', 'two_tailed_rat'] },
  { ...U, id: 'u1_toadpoles', name: '蝌蚪蟾', kind: 'weak', enemies: ['toadpole', 'toadpole'] },
  { ...U, id: 'u1_cultists', name: '信徒', kind: 'weak', enemies: ['calcified_cultist'] },
  // 普通
  { ...U, id: 'u1_two_cultists', name: '一对信徒', kind: 'strong', enemies: ['calcified_cultist', 'damp_cultist'] },
  { ...U, id: 'u1_fossil', name: '化石潜猎者', kind: 'strong', enemies: ['fossil_stalker'] },
  { ...U, id: 'u1_gremlin', name: '地精佣兵', kind: 'strong', enemies: ['gremlin_merc'] },
  { ...U, id: 'u1_ship', name: '幽灵船', kind: 'strong', enemies: ['haunted_ship'] },
  { ...U, id: 'u1_fog', name: '活体迷雾', kind: 'strong', enemies: ['living_fog'] },
  { ...U, id: 'u1_punch', name: '拳击构装体', kind: 'strong', enemies: ['punch_construct'] },
  { ...U, id: 'u1_seapunk', name: '海洋朋克', kind: 'strong', enemies: ['toadpole', 'seapunk'] },
  { ...U, id: 'u1_sludge', name: '淤泥陀螺', kind: 'strong', enemies: ['sludge_spinner', 'corpse_slug'] },
  { ...U, id: 'u1_clam', name: '下水道巨蛤', kind: 'strong', enemies: ['toadpole', 'sewer_clam'] },
  { ...U, id: 'u1_slug_pile', name: '蛞蝓窝', kind: 'strong', enemies: ['corpse_slug', 'corpse_slug', 'corpse_slug'] },
  { ...U, id: 'u1_rat_pack', name: '鼠群', kind: 'strong', enemies: ['two_tailed_rat', 'two_tailed_rat', 'two_tailed_rat'] },
  // 精英
  {
    ...U, id: 'u1_gardeners', name: '幻影园丁', kind: 'elite',
    enemies: ['phantasmal_gardener', 'phantasmal_gardener', 'phantasmal_gardener', 'phantasmal_gardener'],
  },
  { ...U, id: 'u1_colony', name: '潜行群落', kind: 'elite', enemies: ['skulking_colony'] },
  { ...U, id: 'u1_eel', name: '恐惧鳗', kind: 'elite', enemies: ['terror_eel'] },
  // 首领
  { ...U, id: 'u1_matriarch', name: '拉格夫林女族长', kind: 'boss', enemies: ['lagavulin_matriarch'], art: '🐢' },
  { ...U, id: 'u1_fysh', name: '魂鱼', kind: 'boss', enemies: ['soul_fysh'], art: '🐠' },
  { ...U, id: 'u1_giant', name: '瀑布巨人', kind: 'boss', enemies: ['waterfall_giant'], art: '🌊' },
]);
