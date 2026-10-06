import { defineEncounters, defineEnemies, definePowers } from '../../registry';
import type { Enemy } from '../../types';
import { atk, atkThen, buffSelf, cycle, flee, last, lastTwo, move, pickMove, restore, roll, steal, summon } from './ai';

definePowers([
  {
    id: 'thief',
    name: '窃贼',
    art: '💰',
    type: 'buff',
    noStack: true,
    desc: () => '会偷走你的金币。击败它可以夺回。',
    onDeath: (g, o) => {
      const e = o as Enemy;
      if (e.mem.stolen) {
        g.bonusGold += e.mem.stolen;
        g.emit('text', g.player.uid, undefined, `夺回 ${e.mem.stolen} 金币`);
      }
    },
  },
]);

/** 第二幕：嗡鸣蜂巢（怪物与数值参照原版） */
defineEnemies([
  // ------------------------------------------------------------------ 普通
  {
    id: 'bowlbug_egg', name: '蛋碗虫', art: '🥚', hp: [21, 22], size: 0.8,
    desc: '背着一颗蛋的碗虫，每回合边咬边缩进壳里。',
    moves: {
      bite: atkThen('啃咬', 7, 1, 'attackDefend', (e, g) => g.gainBlock(e, 7)),
    },
    ai: () => 'bite',
  },
  {
    id: 'bowlbug_rock', name: '石碗虫', art: '🪨', hp: [45, 48],
    desc: '背着石头猛撞。攻击被完全格挡时会失去平衡，下回合无法行动。',
    init: (e, g) => void g.apply(e, 'imbalanced', 1, e),
    moves: {
      headbutt: {
        name: '头槌',
        intent: 'attack',
        dmg: 15,
        act: (e, g) => {
          const hpBefore = g.player.hp;
          g.enemyAttack(e, 15);
          if (!e.dead && !g.player.dead && g.player.hp >= hpBefore) {
            e.mem.dizzy = 1;
            g.emit('text', e.uid, undefined, '失去平衡！');
          }
        },
      },
      dizzy: move('晕头转向', 'stun', () => {}),
    },
    ai: (e) => {
      if (e.mem.dizzy) {
        e.mem.dizzy = 0;
        return 'dizzy';
      }
      return 'headbutt';
    },
  },
  {
    id: 'bowlbug_nectar', name: '蜜碗虫', art: '🍯', hp: [35, 38],
    desc: '每隔两次乱撞就喝一口花蜜，力量越来越大。',
    moves: {
      thrash: atk('乱撞', 3),
      buff: buffSelf('啜饮花蜜', 'strength', 3),
    },
    ai: (e) => cycle(e, ['thrash', 'buff', 'thrash']),
  },
  {
    id: 'bowlbug_silk', name: '丝碗虫', art: '🕸️', hp: [40, 43],
    moves: {
      spit: move('毒丝', 'debuff', (e, g) => void g.apply(g.player, 'weak', 1, e)),
      thrash: atk('乱撞', 4, 2),
    },
    ai: (e) => cycle(e, ['spit', 'thrash', 'thrash']),
  },
  {
    id: 'exoskeleton', name: '外骨骼虫', art: '🦗', hp: [24, 28], size: 0.85,
    desc: '硬壳让它每次至多失去 9 点生命，多段攻击更有效。',
    init: (e, g) => void g.apply(e, 'hard_to_kill', 9, e),
    moves: {
      skitter: atk('疾爬', 1, 3),
      mandible: atk('上颚', 8),
      enrage: buffSelf('激怒', 'strength', 2),
    },
    ai: (e, g) => pickMove(g, [
      ['skitter', 35, last(e, 'skitter')],
      ['mandible', 40, lastTwo(e, 'mandible')],
      ['enrage', 25, last(e, 'enrage')],
    ]),
  },
  {
    id: 'louse_progenitor', name: '虱母', art: '🐞', hp: [134, 136], size: 1.4,
    desc: '固定循环：蛛网炮 → 蜷缩生长 → 猛扑。第一次被攻击时会蜷起来获得格挡。',
    init: (e, g) => void g.apply(e, 'curl_up', 12, e),
    moves: {
      web: atkThen('蛛网炮', 9, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'frail', 2, e)),
      grow: move('蜷缩生长', 'defendBuff', (e, g) => {
        g.gainBlock(e, 14);
        g.apply(e, 'strength', 5, e);
      }),
      pounce: atk('猛扑', 14),
    },
    ai: (e) => cycle(e, ['web', 'grow', 'pounce']),
  },
  {
    id: 'myte', name: '螨虫', art: '🕷️', hp: [61, 67], size: 1.1,
    desc: '往你的牌堆里塞毒素，还会吸血变强。',
    moves: {
      cornucopia: move('剧毒丰饶角', 'debuff', (_e, g) => g.addToDiscard('toxic', false, 2)),
      bite: atk('啃咬', 13),
      suck: atkThen('吸吮', 4, 1, 'attackBuff', (e, g) => void g.apply(e, 'strength', 2, e)),
    },
    ai: (e, g) => {
      const idx = g.enemies.filter((x) => x.defId === 'myte').indexOf(e);
      if (e.turns === 0) return idx === 1 ? 'suck' : 'cornucopia';
      return pickMove(g, [
        ['cornucopia', 25, e.history.slice(-2).includes('cornucopia')],
        ['bite', 45, last(e, 'bite')],
        ['suck', 30, last(e, 'suck')],
      ]);
    },
  },
  {
    id: 'spiny_toad', name: '刺蟾', art: '🐸', hp: [116, 119], size: 1.35,
    desc: '固定循环：竖起尖刺 → 尖刺爆裂 → 舌鞭。竖刺期间攻击它会被扎。',
    moves: {
      spikes: buffSelf('竖起尖刺', 'thorns', 5),
      explode: {
        name: '尖刺爆裂',
        intent: 'attack',
        dmg: 23,
        act: (e, g) => {
          g.enemyAttack(e, 23);
          g.removePower(e, 'thorns');
        },
      },
      lash: atk('舌鞭', 17),
    },
    ai: (e) => cycle(e, ['spikes', 'explode', 'lash']),
  },
  {
    id: 'the_obscura', name: '晦影', art: '🌑', hp: [123, 123], size: 1.4,
    desc: '先放出幻象「惊惧魅影」，再用哀嚎为所有敌人加力量。',
    moves: {
      illusion: move('幻象', 'summon', (_e, g) => summon(g, 'parafright', 1, 4)),
      gaze: atk('穿刺凝视', 10),
      wail: move('哀嚎', 'buff', (e, g) => {
        for (const x of g.alive) g.apply(x, 'strength', 3, e);
      }),
      strike: atkThen('硬化打击', 6, 1, 'attackDefend', (e, g) => g.gainBlock(e, 6)),
    },
    ai: (e, g) => {
      if (e.turns === 0) return 'illusion';
      const frights = g.alive.filter((x) => x.defId === 'parafright').length;
      if (frights === 0 && !e.history.slice(-3).includes('illusion')) return 'illusion';
      return cycle(e, ['gaze', 'wail', 'strike'], 2);
    },
  },
  {
    id: 'parafright', name: '惊惧魅影', art: '👻', hp: [18, 20], size: 0.8,
    summonedBy: 'the_obscura',
    desc: '晦影召唤的幻象。被打散后下回合会复原，晦影死亡时一同消散。',
    init: (e, g) => void g.apply(e, 'illusion', 1, e),
    moves: {
      scare: atkThen('惊吓', 7, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'weak', 1, e)),
      revive: move('复原', 'buff', (e, g) => restore(e, g)),
      fade: move('消散', 'escape', (e, g) => flee(e, g)),
    },
    ai: (e, g) => {
      if (!g.alive.some((x) => x.defId === 'the_obscura')) return 'fade';
      if (e.powers.revive_pending) return 'revive';
      return 'scare';
    },
  },
  {
    id: 'thieving_hopper', name: '窃贼跳虫', art: '🦗', hp: [45, 49],
    init: (e, g) => void g.apply(e, 'thief', 1, e),
    moves: {
      mug: atkThen('抢夺', 10, 1, 'attack', (e, g) => steal(e, g, 15)),
      lunge: atkThen('扑击', 12, 1, 'attack', (e, g) => steal(e, g, 15)),
      smoke: move('烟幕', 'defend', (e, g) => g.gainBlock(e, 8)),
      escape: move('逃跑', 'escape', (e, g) => {
        e.escaped = true;
        g.emit('escape', e.uid);
      }),
    },
    ai: (e, g) => {
      if (last(e, 'smoke')) return 'escape';
      if (e.turns < 2) return 'mug';
      if (e.turns === 2) return roll(g) < 50 ? 'lunge' : 'smoke';
      return 'smoke';
    },
  },
  {
    id: 'chomper', name: '大颚虫', art: '🐊', hp: [58, 62],
    init: (e, g) => void g.apply(e, 'artifact', 2, e),
    moves: {
      chomp: atk('撕咬', 7, 2),
      screech: move('尖啸', 'debuff', (e, g) => {
        g.addToDraw('dazed', false, 2);
        g.apply(g.player, 'weak', 1, e);
      }),
    },
    ai: (e) => cycle(e, ['chomp', 'chomp', 'screech']),
  },
  {
    id: 'hunter_killer', name: '猎杀者', art: '🦂', hp: [115, 120], size: 1.25,
    moves: {
      tenderize: move('软化', 'strongDebuff', (e, g) => {
        g.apply(g.player, 'vulnerable', 2, e);
        g.apply(g.player, 'frail', 2, e);
      }),
      slash: atk('斩击', 16),
      flurry: atk('乱舞', 6, 3),
    },
    ai: (e, g) => {
      if (e.turns === 0 || (e.turns % 4 === 0 && !last(e, 'tenderize'))) return 'tenderize';
      return pickMove(g, [
        ['slash', 50, last(e, 'slash')],
        ['flurry', 50, last(e, 'flurry')],
      ]);
    },
  },
  {
    id: 'tunneler', name: '掘地者', art: '🦡', hp: [85, 90], size: 1.15,
    moves: {
      bite: atk('撕咬', 9),
      burrow: move('钻地', 'defend', (e, g) => g.gainBlock(e, 25)),
      surface: atk('破土而出', 24),
    },
    ai: (e) => cycle(e, ['bite', 'burrow', 'surface']),
  },
  {
    id: 'ovicopter', name: '产卵母虫', art: '🦟', hp: [120, 125], size: 1.3,
    moves: {
      lay: move('产卵', 'summon', (_e, g) => summon(g, 'larva', 2, 4)),
      slam: atk('猛击', 16),
      spray: atkThen('喷洒', 6, 2, 'attackDebuff', (e, g) => void g.apply(g.player, 'weak', 1, e)),
    },
    ai: (e, g) => {
      const larvae = g.alive.filter((x) => x.defId === 'larva').length;
      if ((e.turns === 0 || e.turns % 3 === 0) && larvae < 2) return 'lay';
      return pickMove(g, [
        ['slam', 50, last(e, 'slam')],
        ['spray', 50, last(e, 'spray')],
      ]);
    },
  },
  // ------------------------------------------------------------------ 召唤物
  {
    id: 'worker_bee', name: '工蜂', art: '🐝', hp: [14, 18], size: 0.75,
    summonedBy: 'entomancer',
    desc: '驭虫师召来的工蜂。',
    init: (e, g) => void g.apply(e, 'hive_mind', 1, e),
    moves: {
      sting: atkThen('蜇刺', 4, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'weak', 1, e)),
      buzz: atk('嗡鸣冲击', 3, 2),
    },
    ai: (e, g) => pickMove(g, [
      ['sting', 40, last(e, 'sting')],
      ['buzz', 60, lastTwo(e, 'buzz')],
    ]),
  },
  {
    id: 'larva', name: '蜂巢幼虫', art: '🪱', hp: [30, 34], size: 0.85,
    summonedBy: 'ovicopter',
    desc: '产卵母虫孵出的幼虫。',
    moves: {
      nibble: atk('啃食', 7),
      molt: move('蜕皮', 'defendBuff', (e, g) => {
        g.gainBlock(e, 8);
        g.apply(e, 'strength', 2, e);
      }),
    },
    ai: (e, g) => pickMove(g, [
      ['nibble', 65, lastTwo(e, 'nibble')],
      ['molt', 35, last(e, 'molt')],
    ]),
  },
  // ------------------------------------------------------------------ 精英
  {
    id: 'infested_prism', name: '感染棱镜', art: '💎', hp: [180, 190], size: 1.35,
    init: (e, g) => void g.apply(e, 'artifact', 2, e),
    moves: {
      refract: atk('折射', 8, 3),
      pulse: move('感染脉冲', 'debuff', (e, g) => {
        g.addToDiscard('burn', false, 1);
        g.apply(g.player, 'weak', 1, e);
        g.afflictCards('brittle', 2);
      }),
      crystallize: move('结晶', 'defendBuff', (e, g) => {
        g.gainBlock(e, 20);
        g.apply(e, 'artifact', 1, e);
      }),
      beam: atk('棱光', 22),
    },
    ai: (e) => cycle(e, ['refract', 'pulse', 'beam', 'crystallize']),
  },
  {
    id: 'decimillipede', name: '千足虫', art: '🐉', hp: [195, 205], size: 1.45,
    moves: {
      bite: atk('撕咬', 14),
      coil: move('盘绕', 'defendBuff', (e, g) => {
        g.gainBlock(e, 15);
        g.apply(e, 'strength', 2, e);
      }),
      barrage: atk('百足乱踏', 4, 4),
      spit: atkThen('毒液', 7, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'poison', 4, e)),
    },
    ai: (e, g) => {
      if (e.turns === 0) return 'spit';
      return pickMove(g, [
        ['bite', 30, last(e, 'bite')],
        ['coil', 20, e.history.slice(-2).includes('coil')],
        ['barrage', 30, last(e, 'barrage')],
        ['spit', 20, last(e, 'spit')],
      ]);
    },
  },
  {
    id: 'entomancer', name: '驭虫师', art: '🧙', hp: [140, 148], size: 1.3,
    moves: {
      swarm: move('召唤虫群', 'summon', (_e, g) => summon(g, 'worker_bee', 2, 4)),
      command: move('号令', 'buff', (e, g) => {
        for (const x of g.alive) g.apply(x, 'strength', 1, e);
      }),
      volley: atk('毒针齐射', 6, 3),
    },
    ai: (e, g) => {
      const bees = g.alive.filter((x) => x.defId === 'worker_bee').length;
      if (bees === 0 && !last(e, 'swarm')) return 'swarm';
      return pickMove(g, [
        ['command', 35, last(e, 'command')],
        ['volley', 65, lastTwo(e, 'volley')],
      ]);
    },
  },
  // ------------------------------------------------------------------ 首领
  {
    id: 'insatiable', name: '贪食者', art: '🐲', hp: [330, 330], size: 1.75,
    init: (e, g) => void g.apply(e, 'consume', 1, e),
    moves: {
      drool: move('垂涎', 'defendBuff', (e, g) => {
        g.addToDiscard('slimed', false, 2);
        g.gainBlock(e, 14);
      }),
      gnash: atk('啃噬', 8, 3),
      devour: atk('吞噬', 32),
      thrash: atkThen('翻滚', 14, 1, 'attackBuff', (e, g) => void g.apply(e, 'strength', 2, e)),
      frenzy: move('饥饿狂乱', 'buff', (e, g) => {
        g.apply(e, 'strength', 4, e);
        g.cleanse(e);
      }),
    },
    ai: (e) => {
      if (e.hp < e.maxHp / 2 && !e.mem.frenzy) {
        e.mem.frenzy = 1;
        return 'frenzy';
      }
      return cycle(e, ['gnash', 'drool', 'thrash', 'devour']);
    },
  },
  {
    id: 'knowledge_demon', name: '知识恶魔', art: '😈', hp: [360, 360], size: 1.75,
    moves: {
      curse: move('知识诅咒', 'strongDebuff', (e, g) => {
        g.addToDraw('doubt', false, 1);
        g.apply(g.player, 'weak', 2, e);
        g.afflictCards('heavy', 2);
      }),
      blast: atk('心灵冲击', 12, 2),
      ponder: move('沉思', 'defendBuff', (e, g) => {
        g.apply(e, 'strength', 3, e);
        g.gainBlock(e, 20);
      }),
      slam: atk('知识重压', 30),
    },
    ai: (e) => (e.turns === 0 ? 'curse' : cycle(e, ['blast', 'ponder', 'slam', 'blast', 'curse'], 4)),
  },
  {
    id: 'kaiser_crab', name: '帝王蟹', art: '🦀', hp: [300, 300], size: 1.7,
    init: (e, g) => void g.apply(e, 'plated_armor', 6, e),
    moves: {
      pinch: atk('钳击', 14),
      shell: move('缩壳', 'defendBuff', (e, g) => {
        g.gainBlock(e, 25);
        g.apply(e, 'mirror_shield', 4, e);
      }),
      crush: atk('碾碎', 9, 3),
      snap: atkThen('断钳', 20, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'vulnerable', 2, e)),
    },
    ai: (e) => cycle(e, ['pinch', 'shell', 'crush', 'snap']),
  },
]);

const BOWLBUGS = ['bowlbug_egg', 'bowlbug_silk', 'bowlbug_nectar', 'bowlbug_rock'];

defineEncounters([
  // 弱
  { id: 'a2_bowlbugs', name: '碗虫', act: 2, kind: 'weak', enemies: (rng) => rng.shuffle(BOWLBUGS.slice(0, 3)) },
  { id: 'a2_hopper', name: '窃贼跳虫', act: 2, kind: 'weak', enemies: ['thieving_hopper'] },
  { id: 'a2_exos', name: '外骨骼虫', act: 2, kind: 'weak', enemies: ['exoskeleton', 'exoskeleton'] },
  { id: 'a2_myte', name: '螨虫', act: 2, kind: 'weak', enemies: ['myte'] },
  { id: 'a2_chomper', name: '大颚虫', act: 2, kind: 'weak', enemies: ['chomper'] },
  // 普通
  { id: 'a2_bowlbug_swarm', name: '碗虫群', act: 2, kind: 'strong', enemies: (rng) => rng.shuffle([...BOWLBUGS]) },
  { id: 'a2_chompers', name: '一对机关虫', act: 2, kind: 'strong', enemies: ['chomper', 'chomper'] },
  { id: 'a2_hunter', name: '猎杀者', act: 2, kind: 'strong', enemies: ['hunter_killer'] },
  { id: 'a2_tunneler', name: '掘地者', act: 2, kind: 'strong', enemies: ['exoskeleton', 'tunneler'] },
  { id: 'a2_ovicopter', name: '产卵母虫', act: 2, kind: 'strong', enemies: ['ovicopter'] },
  { id: 'a2_louse', name: '虱母', act: 2, kind: 'strong', enemies: ['louse_progenitor'] },
  { id: 'a2_mytes', name: '螨虫', act: 2, kind: 'strong', enemies: ['myte', 'myte'] },
  { id: 'a2_toad', name: '刺蟾', act: 2, kind: 'strong', enemies: ['spiny_toad'] },
  { id: 'a2_obscura', name: '晦影', act: 2, kind: 'strong', enemies: ['the_obscura'] },
  { id: 'a2_thieves', name: '窃贼与外骨骼虫', act: 2, kind: 'strong', enemies: ['exoskeleton', 'thieving_hopper'] },
  // 精英
  { id: 'a2_prism', name: '感染棱镜', act: 2, kind: 'elite', enemies: ['infested_prism'] },
  { id: 'a2_millipede', name: '千足虫', act: 2, kind: 'elite', enemies: ['decimillipede'] },
  { id: 'a2_entomancer', name: '驭虫师', act: 2, kind: 'elite', enemies: ['entomancer'] },
  // 首领
  { id: 'a2_insatiable', name: '贪食者', act: 2, kind: 'boss', enemies: ['insatiable'], art: '🐲' },
  { id: 'a2_demon', name: '知识恶魔', act: 2, kind: 'boss', enemies: ['knowledge_demon'], art: '😈' },
  { id: 'a2_crab', name: '帝王蟹', act: 2, kind: 'boss', enemies: ['kaiser_crab'], art: '🦀' },
]);
