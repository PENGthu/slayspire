import { defineEncounters, defineEnemies } from '../../registry';
import type { Combat } from '../../combat';
import type { Enemy } from '../../types';
import { atk, atkThen, buffSelf, cycle, last, lastTwo, move, pickMove, summon } from './ai';

function reviveTo(e: Enemy, g: Combat, hp: number) {
  e.mem.phase = (e.mem.phase ?? 1) + 1;
  e.maxHp = hp;
  e.hp = hp;
  g.removePower(e, 'revive_pending');
  g.cleanse(e);
  g.emit('heal', e.uid, hp, `第 ${e.mem.phase} 形态`);
}

/** 第三幕：荣光之巅 */
defineEnemies([
  // ------------------------------------------------------------------ 普通
  {
    id: 'axebot', name: '斧头机器人', art: '🤖', hp: [40, 44],
    moves: {
      chop: atk('劈砍', 12),
      spin: atkThen('回旋', 5, 2, 'attackDefend', (e, g) => g.gainBlock(e, 6)),
      overclock: buffSelf('超频', 'strength', 2),
    },
    ai: (e, g) => pickMove(g, [
      ['chop', 45, lastTwo(e, 'chop')],
      ['spin', 35, last(e, 'spin')],
      ['overclock', 20, e.history.includes('overclock') && e.turns < 4],
    ]),
  },
  {
    id: 'sword_knight', name: '剑骑士', art: '🤺', hp: [50, 54],
    moves: {
      slash: atk('斩击', 14),
      riposte: atkThen('反击', 9, 1, 'attackDefend', (e, g) => g.gainBlock(e, 8)),
    },
    ai: (e, g) => pickMove(g, [
      ['slash', 55, lastTwo(e, 'slash')],
      ['riposte', 45, last(e, 'riposte')],
    ]),
  },
  {
    id: 'shield_knight', name: '盾骑士', art: '🛡️', hp: [54, 58],
    moves: {
      bulwark: move('坚壁', 'defend', (_e, g) => {
        for (const x of g.alive) g.gainBlock(x, 11);
      }),
      bash: atkThen('盾击', 8, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'frail', 1, e)),
    },
    ai: (e) => cycle(e, ['bulwark', 'bash']),
  },
  {
    id: 'chanter', name: '咏唱者', art: '👼', hp: [58, 62],
    moves: {
      hymn: move('赞美诗', 'buff', (e, g) => {
        for (const x of g.alive) g.apply(x, 'strength', 2, e);
      }),
      dirge: atkThen('挽歌', 10, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'weak', 1, e)),
      halo: atk('光环', 6, 2),
    },
    ai: (e, g) => {
      if (e.turns === 0) return 'hymn';
      return pickMove(g, [
        ['hymn', 25, e.history.slice(-2).includes('hymn')],
        ['dirge', 40, last(e, 'dirge')],
        ['halo', 35, last(e, 'halo')],
      ]);
    },
  },
  {
    id: 'glory_colossus', name: '荣光巨像', art: '🗽', hp: [150, 158], size: 1.35,
    init: (e, g) => void g.apply(e, 'plated_armor', 8, e),
    moves: {
      slam: atk('猛砸', 18),
      quake: atkThen('震地', 7, 1, 'attackDebuff', (_e, g) => g.addToDraw('dazed', false, 2)),
      harden: move('硬化', 'defendBuff', (e, g) => {
        g.gainBlock(e, 12);
        g.apply(e, 'strength', 2, e);
      }),
    },
    ai: (e) => cycle(e, ['slam', 'quake', 'slam', 'harden']),
  },
  {
    id: 'inquisitor', name: '审判官', art: '🧑‍⚖️', hp: [135, 140], size: 1.25,
    moves: {
      scrutinize: move('审视', 'strongDebuff', (e, g) => {
        g.apply(g.player, 'vulnerable', 2, e);
        g.apply(g.player, 'weak', 2, e);
      }),
      verdict: atk('裁决', 22),
      gavel: atk('法槌', 6, 3),
    },
    ai: (e) => (e.turns === 0 ? 'scrutinize' : cycle(e, ['verdict', 'gavel', 'gavel', 'scrutinize'], 3)),
  },
  {
    id: 'lizard_knight', name: '蜥蜴骑士', art: '🦎', hp: [165, 170], size: 1.3,
    moves: {
      lance: atk('长枪突刺', 16),
      leap: move('跃起', 'defend', (e, g) => g.gainBlock(e, 15)),
      crash: atk('坠击', 28),
      hiss: buffSelf('嘶鸣', 'strength', 3),
    },
    ai: (e) => (last(e, 'leap') ? 'crash' : cycle(e, ['lance', 'leap', 'lance', 'hiss', 'leap'])),
  },
  {
    id: 'flail_knight', name: '连枷骑士', art: '🏇', hp: [60, 64],
    moves: {
      flail: atk('连枷', 6, 2),
      ram: atk('冲撞', 13),
      rally: buffSelf('振奋', 'strength', 2),
    },
    ai: (e, g) => pickMove(g, [
      ['flail', 45, lastTwo(e, 'flail')],
      ['ram', 40, last(e, 'ram')],
      ['rally', 15, last(e, 'rally')],
    ]),
  },
  {
    id: 'spectral_knight', name: '幽灵骑士', art: '👻', hp: [55, 58],
    moves: {
      phase: move('相位', 'buff', (e, g) => void g.apply(e, 'intangible', 1, e)),
      blade: atk('幽冥之刃', 11),
    },
    ai: (e) => cycle(e, ['blade', 'phase']),
  },
  {
    id: 'magi_knight', name: '法师骑士', art: '🧝', hp: [58, 62],
    moves: {
      arcane: move('奥术诅咒', 'strongDebuff', (e, g) => {
        g.apply(g.player, 'frail', 2, e);
        g.apply(g.player, 'weak', 2, e);
      }),
      charge: move('蓄能', 'defend', (e, g) => g.gainBlock(e, 10)),
      blast: atk('奥术爆发', 26),
    },
    ai: (e) => cycle(e, ['arcane', 'charge', 'blast']),
  },
  // ------------------------------------------------------------------ 精英
  {
    id: 'mecha_knight', name: '机甲骑士', art: '🦾', hp: [280, 295], size: 1.45,
    init: (e, g) => void g.apply(e, 'artifact', 2, e),
    moves: {
      flame: atkThen('喷火', 6, 4, 'attackDebuff', (_e, g) => g.addToDiscard('burn')),
      charge: move('充能', 'defendBuff', (e, g) => {
        g.gainBlock(e, 20);
        g.apply(e, 'strength', 2, e);
      }),
      cleave: atk('巨刃劈斩', 32),
    },
    ai: (e) => cycle(e, ['flame', 'charge', 'cleave']),
  },
  {
    id: 'soul_nexus', name: '灵魂枢纽', art: '🌀', hp: [220, 230], size: 1.45,
    init: (e, g) => void g.apply(e, 'beat_of_death', 1, e),
    moves: {
      burn: atk('灵魂灼烧', 7, 3),
      drain: move('汲取', 'strongDebuff', (e, g) => {
        g.apply(g.player, 'weak', 2, e);
        g.apply(g.player, 'frail', 2, e);
        g.heal(e, 15);
      }),
      pulse: atk('灵魂脉冲', 18),
    },
    ai: (e) => cycle(e, ['burn', 'drain', 'pulse', 'burn', 'pulse']),
  },
  {
    id: 'seraph', name: '炽天使', art: '😇', hp: [240, 250], size: 1.45,
    moves: {
      radiance: atk('圣光', 5, 3),
      sanctuary: move('圣域', 'buff', (e, g) => {
        g.apply(e, 'intangible', 1, e);
        g.apply(e, 'strength', 2, e);
      }),
      judgment: atk('审判之剑', 30),
    },
    ai: (e) => cycle(e, ['radiance', 'sanctuary', 'judgment']),
  },
  // ------------------------------------------------------------------ 首领
  {
    id: 'test_subject', name: '试验体', art: '🧟', hp: [110, 110], size: 1.7,
    init: (e, g) => {
      g.apply(e, 'reincarnate', 2, e);
      e.mem.phase = 1;
    },
    moves: {
      bite: atk('撕咬', 12),
      pounce: atk('扑咬', 7, 2),
      revive: move('重组', 'buff', (e, g) => reviveTo(e, g, e.mem.phase === 1 ? 200 : 280)),
      rampage: atk('暴走', 5, 5),
      roar: move('咆哮', 'defendBuff', (e, g) => {
        g.apply(e, 'strength', 3, e);
        g.gainBlock(e, 15);
      }),
      gather: move('积蓄', 'buff', (e, g) => void g.apply(e, 'strength', 2, e)),
      annihilate: atk('湮灭', 42),
      slash: atk('狂乱撕扯', 10, 3),
    },
    ai: (e) => {
      if (e.powers.revive_pending) return 'revive';
      const p = e.mem.phase ?? 1;
      if (p === 1) return cycle(e, ['bite', 'pounce']);
      if (p === 2) return last(e, 'rampage') ? 'roar' : 'rampage';
      return last(e, 'gather') ? 'annihilate' : last(e, 'annihilate') ? 'slash' : 'gather';
    },
  },
  {
    id: 'doormaker', name: '造门者', art: '🚪', hp: [420, 420], size: 1.75,
    moves: {
      open: move('开门', 'summon', (_e, g) => {
        const pick = g.aiRng.pick(['axebot', 'sword_knight', 'chanter', 'flail_knight']);
        summon(g, pick, 1, 3);
      }),
      slam: atk('门扉重击', 28),
      barrage: atk('碎片弹幕', 8, 3),
      hinge: move('铰合', 'defendBuff', (e, g) => {
        g.gainBlock(e, 30);
        g.apply(e, 'strength', 2, e);
      }),
    },
    ai: (e, g) => {
      const minions = g.alive.filter((x) => x.minion).length;
      if (e.turns % 4 === 0 && minions < 2) return 'open';
      return cycle(e, ['slam', 'barrage', 'hinge'], 0);
    },
  },
  {
    id: 'queen', name: '荣光女王', art: '👸', hp: [380, 380], size: 1.7,
    init: (e, g) => void g.apply(e, 'artifact', 1, e),
    moves: {
      decree: move('王令', 'buff', (e, g) => {
        for (const x of g.alive) g.apply(x, 'strength', 3, e);
      }),
      execute: atk('处决', 10, 3),
      guard: move('召唤卫队', 'summon', (_e, g) => summon(g, 'queen_guard', 2 - g.alive.filter((x) => x.defId === 'queen_guard').length, 3)),
      wrath: atk('女王之怒', 34),
    },
    ai: (e, g) => {
      const guards = g.alive.filter((x) => x.defId === 'queen_guard').length;
      if (guards === 0 && !last(e, 'guard') && e.turns % 3 === 2) return 'guard';
      if (guards === 0) return cycle(e, ['wrath', 'execute', 'decree']);
      return cycle(e, ['execute', 'decree', 'execute']);
    },
  },
  {
    id: 'queen_guard', name: '御前卫士', art: '💂', hp: [68, 72],
    moves: {
      protect: move('护驾', 'defend', (_e, g) => {
        const q = g.alive.find((x) => x.defId === 'queen');
        if (q) g.gainBlock(q, 15);
      }),
      halberd: atk('戟击', 12),
    },
    ai: (e, g) => pickMove(g, [
      ['protect', 40, last(e, 'protect')],
      ['halberd', 60, lastTwo(e, 'halberd')],
    ]),
  },
]);

defineEncounters([
  { id: 'a3_axebots', name: '斧头机器人', act: 3, kind: 'weak', enemies: ['axebot', 'axebot'] },
  { id: 'a3_knights', name: '骑士', act: 3, kind: 'weak', enemies: ['sword_knight', 'shield_knight'] },
  { id: 'a3_chanter', name: '咏唱者', act: 3, kind: 'weak', enemies: ['chanter', 'axebot'] },
  { id: 'a3_flail', name: '连枷骑士', act: 3, kind: 'weak', enemies: ['flail_knight', 'spectral_knight'] },
  { id: 'a3_colossus', name: '荣光巨像', act: 3, kind: 'strong', enemies: ['glory_colossus'] },
  { id: 'a3_inquisitor', name: '审判官', act: 3, kind: 'strong', enemies: ['inquisitor'] },
  { id: 'a3_lizard', name: '蜥蜴骑士', act: 3, kind: 'strong', enemies: ['lizard_knight'] },
  { id: 'a3_trio', name: '骑士三人组', act: 3, kind: 'strong', enemies: ['flail_knight', 'spectral_knight', 'magi_knight'] },
  { id: 'a3_axebots3', name: '机器人小队', act: 3, kind: 'strong', enemies: ['axebot', 'axebot', 'axebot'] },
  { id: 'a3_choir', name: '唱诗班', act: 3, kind: 'strong', enemies: ['shield_knight', 'chanter', 'sword_knight'] },
  { id: 'a3_magi', name: '法师骑士', act: 3, kind: 'strong', enemies: ['magi_knight', 'axebot'] },
  { id: 'a3_mecha', name: '机甲骑士', act: 3, kind: 'elite', enemies: ['mecha_knight'] },
  { id: 'a3_nexus', name: '灵魂枢纽', act: 3, kind: 'elite', enemies: ['soul_nexus'] },
  { id: 'a3_seraph', name: '炽天使', act: 3, kind: 'elite', enemies: ['seraph'] },
  { id: 'a3_subject', name: '试验体', act: 3, kind: 'boss', enemies: ['test_subject'], art: '🧟' },
  { id: 'a3_doormaker', name: '造门者', act: 3, kind: 'boss', enemies: ['doormaker'], art: '🚪' },
  { id: 'a3_queen', name: '荣光女王', act: 3, kind: 'boss', enemies: ['queen_guard', 'queen', 'queen_guard'], art: '👸' },
]);
