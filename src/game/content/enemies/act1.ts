import { defineEncounters, defineEnemies, definePowers } from '../../registry';
import type { Combat } from '../../combat';
import type { Enemy } from '../../types';
import { atk, atkThen, buffSelf, cycle, last, lastTwo, move, pickMove, roll, splitInto, summon } from './ai';

/** 第一幕：蔓生密林 */
defineEnemies([
  // ------------------------------------------------------------------ 普通
  {
    id: 'twig_cultist', name: '枝条信徒', art: '🦉', hp: [48, 54],
    moves: {
      incant: buffSelf('吟诵', 'ritual', 3),
      strike: atk('黑暗打击', 6),
    },
    ai: (e) => (e.turns === 0 ? 'incant' : 'strike'),
  },
  {
    id: 'nibbit', name: '啃咬兽', art: '🦔', hp: [42, 46],
    moves: {
      bite: atk('啃咬', 11),
      thrash: atkThen('翻滚', 7, 1, 'attackDefend', (e, g) => g.gainBlock(e, 5)),
      bellow: move('咆哮', 'defendBuff', (e, g) => {
        g.apply(e, 'strength', 2, e);
        g.gainBlock(e, 6);
      }),
    },
    ai: (e, g) => {
      if (e.turns === 0) return 'bite';
      const r = roll(g);
      if (r < 25 && !last(e, 'bite')) return 'bite';
      if (r < 55 && !lastTwo(e, 'thrash')) return 'thrash';
      if (!last(e, 'bellow')) return 'bellow';
      return 'thrash';
    },
  },
  {
    id: 'shroomling', name: '孢子菇', art: '🍄', hp: [20, 24],
    init: (e, g) => void g.apply(e, 'spore_cloud', 2, e),
    moves: {
      spit: atk('喷吐', 6),
      grow: buffSelf('生长', 'strength', 3),
    },
    ai: (e, g) => pickMove(g, [
      ['spit', 60, lastTwo(e, 'spit')],
      ['grow', 40, last(e, 'grow')],
    ]),
  },
  {
    id: 'acid_slime_s', name: '小酸液史莱姆', art: '🦠', hp: [8, 12], size: 0.7,
    moves: {
      tackle: atk('撞击', 3),
      lick: move('舔舐', 'debuff', (e, g) => void g.apply(g.player, 'weak', 1, e)),
    },
    ai: (e) => (e.turns % 2 === 0 ? 'lick' : 'tackle'),
  },
  {
    id: 'spike_slime_s', name: '小尖刺史莱姆', art: '🐡', hp: [10, 14], size: 0.7,
    moves: { tackle: atk('撞击', 5) },
    ai: () => 'tackle',
  },
  {
    id: 'acid_slime_m', name: '酸液史莱姆', art: '🦠', hp: [28, 32], size: 0.9,
    moves: {
      spit: atkThen('腐蚀喷吐', 7, 1, 'attackDebuff', (_e, g) => g.addToDiscard('slimed')),
      tackle: atk('撞击', 10),
      lick: move('舔舐', 'debuff', (e, g) => void g.apply(g.player, 'weak', 1, e)),
    },
    ai: (e, g) => pickMove(g, [
      ['spit', 30, lastTwo(e, 'spit')],
      ['tackle', 40, last(e, 'tackle')],
      ['lick', 30, last(e, 'lick')],
    ]),
  },
  {
    id: 'spike_slime_m', name: '尖刺史莱姆', art: '🐡', hp: [28, 32], size: 0.9,
    moves: {
      tackle: atkThen('火焰撞击', 8, 1, 'attackDebuff', (_e, g) => g.addToDiscard('slimed')),
      lick: move('舔舐', 'debuff', (e, g) => void g.apply(g.player, 'frail', 1, e)),
    },
    ai: (e, g) => pickMove(g, [
      ['tackle', 70, lastTwo(e, 'tackle')],
      ['lick', 30, last(e, 'lick')],
    ]),
  },
  {
    id: 'acid_slime_l', name: '巨型酸液史莱姆', art: '🦠', hp: [65, 69], size: 1.25,
    init: (e, g) => void g.apply(e, 'split', 1, e),
    moves: {
      spit: atkThen('腐蚀喷吐', 11, 1, 'attackDebuff', (_e, g) => g.addToDiscard('slimed', false, 2)),
      tackle: atk('撞击', 16),
      lick: move('舔舐', 'debuff', (e, g) => void g.apply(g.player, 'weak', 2, e)),
      split: move('分裂', 'unknown', (e, g) => splitInto(e, g, 'acid_slime_m')),
    },
    ai: (e, g) => {
      if (e.hp <= e.maxHp / 2) return 'split';
      return pickMove(g, [
        ['spit', 30, lastTwo(e, 'spit')],
        ['tackle', 40, last(e, 'tackle')],
        ['lick', 30, last(e, 'lick')],
      ]);
    },
  },
  {
    id: 'spike_slime_l', name: '巨型尖刺史莱姆', art: '🐡', hp: [64, 70], size: 1.25,
    init: (e, g) => void g.apply(e, 'split', 1, e),
    moves: {
      tackle: atkThen('火焰撞击', 16, 1, 'attackDebuff', (_e, g) => g.addToDiscard('slimed', false, 2)),
      lick: move('舔舐', 'debuff', (e, g) => void g.apply(g.player, 'frail', 2, e)),
      split: move('分裂', 'unknown', (e, g) => splitInto(e, g, 'spike_slime_m')),
    },
    ai: (e, g) => {
      if (e.hp <= e.maxHp / 2) return 'split';
      return pickMove(g, [
        ['tackle', 70, lastTwo(e, 'tackle')],
        ['lick', 30, last(e, 'lick')],
      ]);
    },
  },
  {
    id: 'inklet', name: '墨精', art: '🦑', hp: [11, 15], size: 0.75,
    moves: {
      jab: atk('戳刺', 4),
      splash: atk('泼墨', 2, 2),
      smudge: move('涂抹', 'debuff', (e, g) => void g.apply(g.player, 'weak', 1, e)),
    },
    ai: (e, g) => pickMove(g, [
      ['jab', 45, lastTwo(e, 'jab')],
      ['splash', 35, last(e, 'splash')],
      ['smudge', 20, last(e, 'smudge')],
    ]),
  },
  {
    id: 'vine_lasher', name: '藤鞭', art: '🌿', hp: [26, 30],
    moves: {
      lash: atk('鞭笞', 7),
      entwine: atkThen('缠绕', 4, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'entangled', 1, e)),
      thorn: atk('荆刺', 3, 2),
    },
    ai: (e, g) => {
      if (e.turns === 1 && !e.mem.tangled) {
        e.mem.tangled = 1;
        return 'entwine';
      }
      return pickMove(g, [
        ['lash', 55, lastTwo(e, 'lash')],
        ['thorn', 45, last(e, 'thorn')],
      ]);
    },
  },
  {
    id: 'shrinker_beetle', name: '缩小甲虫', art: '🪲', hp: [38, 42],
    moves: {
      shrink: move('缩小光线', 'strongDebuff', (e, g) => void g.apply(g.player, 'shrink', 1, e)),
      chomp: atk('咀嚼', 7),
      stomp: atk('践踏', 13),
    },
    ai: (e) => (e.turns === 0 ? 'shrink' : cycle(e, ['chomp', 'chomp', 'stomp'], 2)),
  },
  {
    id: 'fuzzy_wurm', name: '绒毛蠕虫', art: '🐛', hp: [55, 58], size: 1.1,
    moves: {
      goop: atk('酸液', 6),
      grow: buffSelf('生长', 'strength', 4),
      smash: atk('猛撞', 12),
    },
    ai: (e) => cycle(e, ['goop', 'goop', 'grow', 'smash']),
  },
  {
    id: 'phrog_parasite', name: '寄生蛙', art: '🐸', hp: [58, 62], size: 1.1,
    moves: {
      infect: move('感染', 'debuff', (_e, g) => g.addToDiscard('infection', false, 2)),
      lash: atk('舌鞭', 4, 3),
      gulp: atkThen('吞咽', 10, 1, 'attackBuff', (e, g) => void g.apply(e, 'strength', 1, e)),
    },
    ai: (e, g) => {
      if (e.turns === 0) return 'infect';
      return pickMove(g, [
        ['lash', 45, last(e, 'lash')],
        ['gulp', 35, lastTwo(e, 'gulp')],
        ['infect', 20, e.history.slice(-3).includes('infect')],
      ]);
    },
  },
  // ------------------------------------------------------------------ 精英
  {
    id: 'byrdonis', name: '巨喙鸟母', art: '🦅', hp: [82, 86], size: 1.35,
    moves: {
      peck: atk('连啄', 3, 4),
      swoop: atk('俯冲', 16),
      screech: move('尖啸', 'debuff', (e, g) => {
        g.apply(g.player, 'vulnerable', 2, e);
      }),
      molt: move('换羽', 'defendBuff', (e, g) => {
        g.gainBlock(e, 10);
        g.apply(e, 'strength', 2, e);
      }),
    },
    ai: (e, g) => {
      if (e.turns === 0) return 'screech';
      if (e.turns % 4 === 3) return 'molt';
      return pickMove(g, [
        ['peck', 55, lastTwo(e, 'peck')],
        ['swoop', 45, last(e, 'swoop')],
      ]);
    },
  },
  {
    id: 'bygone_effigy', name: '往昔雕像', art: '🗿', hp: [118, 124], size: 1.4,
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
      smash: atk('重击', 18),
      siphon: move('汲取灵魂', 'strongDebuff', (e, g) => {
        g.apply(g.player, 'strength', -1, e);
        g.apply(g.player, 'dexterity', -1, e);
      }),
      stir: move('苏醒', 'stun', () => {}),
    },
    ai: (e) => {
      if (e.mem.asleep) return 'sleep';
      e.mem.awakeTurns = (e.mem.awakeTurns ?? 0) + 1;
      return e.mem.awakeTurns % 3 === 0 ? 'siphon' : 'smash';
    },
  },
  {
    id: 'rage_treant', name: '暴怒树精', art: '🌳', hp: [82, 86], size: 1.35,
    moves: {
      bellow: move('怒吼', 'buff', (e, g) => void g.apply(e, 'enrage', 2, e)),
      rush: atk('冲撞', 14),
      bash: atkThen('碎颅', 6, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'vulnerable', 2, e)),
    },
    ai: (e, g) => {
      if (e.turns === 0) return 'bellow';
      if (!e.history.slice(-2).includes('bash') && roll(g) < 33) return 'bash';
      return lastTwo(e, 'rush') ? 'bash' : 'rush';
    },
  },
  {
    id: 'sentinel', name: '石哨卫', art: '🗼', hp: [38, 42],
    init: (e, g) => void g.apply(e, 'artifact', 1, e),
    moves: {
      beam: atk('光束', 9),
      bolt: move('震荡', 'debuff', (_e, g) => g.addToDiscard('dazed', false, 2)),
    },
    ai: (e, g) => {
      const idx = g.enemies.filter((x) => x.defId === 'sentinel').indexOf(e);
      return (e.turns + idx) % 2 === 0 ? 'bolt' : 'beam';
    },
  },
  // ------------------------------------------------------------------ 首领
  {
    id: 'ceremonial_beast', name: '祭仪巨兽', art: '🦬', hp: [240, 240], size: 1.7,
    init: (e, g) => void g.apply(e, 'artifact', 1, e),
    moves: {
      roar: move('祭仪咆哮', 'defendBuff', (e, g) => {
        g.gainBlock(e, 15);
        g.apply(e, 'strength', 2, e);
      }),
      stomp: atk('践踏', 5, 3),
      gore: atk('顶撞', 20),
      frenzy: move('狂乱', 'buff', (e, g) => {
        g.apply(e, 'ritual', 2, e);
        g.cleanse(e);
      }),
      quake: atkThen('震地', 10, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'frail', 2, e)),
    },
    ai: (e) => {
      if (e.hp < e.maxHp / 2 && !e.mem.frenzied) {
        e.mem.frenzied = 1;
        return 'frenzy';
      }
      return cycle(e, ['roar', 'stomp', 'gore', 'quake', 'stomp', 'gore']);
    },
  },
  {
    id: 'vantom', name: '墨渊幽影', art: '🐙', hp: [200, 200], size: 1.7,
    init: (e, g) => void g.apply(e, 'slippery', 6, e),
    moves: {
      ink: atkThen('墨渍', 8, 1, 'attackDebuff', (_e, g) => g.addToDiscard('slimed', false, 2)),
      lash: atk('触手鞭笞', 5, 3),
      dismember: atk('撕裂', 27),
      prepare: move('潜入墨中', 'defendBuff', (e, g) => {
        g.gainBlock(e, 15);
        g.apply(e, 'slippery', 3, e);
        g.apply(e, 'strength', 2, e);
      }),
    },
    ai: (e) => cycle(e, ['ink', 'lash', 'prepare', 'dismember']),
  },
  {
    id: 'kin_priest', name: '亲族祭司', art: '👹', hp: [180, 180], size: 1.6,
    moves: {
      rite: move('血之仪式', 'buff', (e, g) => {
        for (const x of g.alive) g.apply(x, 'strength', x === e ? 2 : 1, e);
      }),
      beam: atk('灼目光束', 12),
      smite: atk('惩击', 6, 2),
      call: move('召集', 'summon', (_e, g) => summon(g, 'kin_follower', 2 - g.alive.filter((x) => x.defId === 'kin_follower').length, 3)),
    },
    ai: (e, g) => {
      const followers = g.alive.filter((x) => x.defId === 'kin_follower').length;
      if (followers === 0 && e.turns > 1 && !last(e, 'call') && !e.mem.called) {
        e.mem.called = 1;
        return 'call';
      }
      return cycle(e, ['rite', 'beam', 'smite', 'beam', 'smite']);
    },
  },
  {
    id: 'kin_follower', name: '亲族信徒', art: '👺', hp: [42, 46],
    moves: {
      slash: atk('挥砍', 6),
      boomerang: atk('回旋刃', 3, 2),
      praise: move('赞颂', 'buff', (e, g) => {
        const priest = g.alive.find((x) => x.defId === 'kin_priest');
        if (priest) g.gainBlock(priest, 10);
        g.apply(e, 'strength', 1, e);
      }),
    },
    ai: (e, g) => {
      const idx = g.enemies.filter((x) => x.defId === 'kin_follower').indexOf(e);
      return cycle(e, ['slash', 'praise', 'boomerang'], idx);
    },
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

// 往昔雕像受到伤害时苏醒
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

defineEncounters([
  // 弱
  { id: 'a1_cultist', name: '枝条信徒', act: 1, kind: 'weak', enemies: ['twig_cultist'] },
  { id: 'a1_nibbit', name: '啃咬兽', act: 1, kind: 'weak', enemies: ['nibbit'] },
  { id: 'a1_shrooms', name: '孢子菇', act: 1, kind: 'weak', enemies: ['shroomling', 'shroomling'] },
  {
    id: 'a1_slimes', name: '史莱姆', act: 1, kind: 'weak',
    enemies: (rng) => (rng.chance(0.5) ? ['spike_slime_s', 'acid_slime_m'] : ['acid_slime_s', 'spike_slime_m']),
  },
  { id: 'a1_inklets', name: '墨精', act: 1, kind: 'weak', enemies: ['inklet', 'inklet', 'inklet'] },
  { id: 'a1_lasher', name: '藤鞭', act: 1, kind: 'weak', enemies: ['vine_lasher', 'shroomling'] },
  // 强
  { id: 'a1_beetle', name: '缩小甲虫', act: 1, kind: 'strong', enemies: ['shrinker_beetle', 'inklet'] },
  {
    id: 'a1_big_slime', name: '巨型史莱姆', act: 1, kind: 'strong',
    enemies: (rng) => [rng.chance(0.5) ? 'acid_slime_l' : 'spike_slime_l'],
  },
  { id: 'a1_phrog', name: '寄生蛙', act: 1, kind: 'strong', enemies: ['phrog_parasite'] },
  { id: 'a1_wurm', name: '绒毛蠕虫', act: 1, kind: 'strong', enemies: ['fuzzy_wurm'] },
  { id: 'a1_nibbits', name: '啃咬兽与墨精', act: 1, kind: 'strong', enemies: ['nibbit', 'inklet', 'inklet'] },
  { id: 'a1_shroom3', name: '孢子菇丛', act: 1, kind: 'strong', enemies: ['shroomling', 'shroomling', 'shroomling'] },
  { id: 'a1_lashers', name: '藤鞭丛', act: 1, kind: 'strong', enemies: ['vine_lasher', 'vine_lasher', 'inklet'] },
  { id: 'a1_cult_slime', name: '信徒与史莱姆', act: 1, kind: 'strong', enemies: ['acid_slime_s', 'twig_cultist'] },
  // 精英
  { id: 'a1_byrdonis', name: '巨喙鸟母', act: 1, kind: 'elite', enemies: ['byrdonis'] },
  { id: 'a1_effigy', name: '往昔雕像', act: 1, kind: 'elite', enemies: ['bygone_effigy'] },
  { id: 'a1_treant', name: '暴怒树精', act: 1, kind: 'elite', enemies: ['rage_treant'] },
  { id: 'a1_sentinels', name: '石哨卫', act: 1, kind: 'elite', enemies: ['sentinel', 'sentinel', 'sentinel'] },
  // 首领
  { id: 'a1_beast', name: '祭仪巨兽', act: 1, kind: 'boss', enemies: ['ceremonial_beast'], art: '🦬' },
  { id: 'a1_vantom', name: '墨渊幽影', act: 1, kind: 'boss', enemies: ['vantom'], art: '🐙' },
  { id: 'a1_kin', name: '亲族', act: 1, kind: 'boss', enemies: ['kin_follower', 'kin_priest', 'kin_follower'], art: '👹' },
]);
