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

/** 第三幕：荣光之巅（怪物与数值参照原版） */
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
    id: 'globe_head', name: '球首', art: '🌐', hp: [148, 148], size: 1.3,
    desc: '头是一颗通电的玻璃球。固定循环：电击掌掴 → 雷霆打击 → 电流爆发。',
    moves: {
      slap: atkThen('电击掌掴', 13, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'frail', 2, e)),
      thunder: atk('雷霆打击', 6, 3),
      burst: atkThen('电流爆发', 16, 1, 'attackBuff', (e, g) => void g.apply(e, 'strength', 2, e)),
    },
    ai: (e) => cycle(e, ['slap', 'thunder', 'burst']),
  },
  {
    id: 'owl_magistrate', name: '枭法官', art: '🦉', hp: [231, 231], size: 1.5,
    desc: '固定循环：审视 → 啄击 → 法庭飞翔 → 判决。飞翔时受到的攻击伤害减半，判决会施加 4 层易伤。',
    moves: {
      scrutiny: atk('法官审视', 16),
      peck: atk('啄击', 4, 6),
      flight: buffSelf('法庭飞翔', 'soar', 1),
      verdict: atkThen('判决', 33, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'vulnerable', 4, e)),
    },
    ai: (e) => cycle(e, ['scrutiny', 'peck', 'flight', 'verdict']),
  },
  {
    id: 'frog_knight', name: '蛙骑士', art: '🐸', hp: [191, 191], size: 1.4,
    desc: '女王的忠诚骑士。生命低于一半后，会在宣誓之后发动一次甲虫冲锋。',
    moves: {
      tongue: atkThen('舌鞭', 13, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'frail', 2, e)),
      strike: atk('惩奸除恶', 21),
      queen: buffSelf('为了女王！', 'strength', 5),
      charge: atk('甲虫冲锋', 35),
    },
    ai: (e) => {
      if (last(e, 'queen') && e.hp < e.maxHp / 2 && !e.history.includes('charge')) return 'charge';
      const n = e.history.filter((m) => m !== 'charge').length;
      return ['tongue', 'strike', 'queen'][n % 3];
    },
  },
  {
    id: 'devoted_sculptor', name: '虔诚雕刻师', art: '🗿', hp: [162, 162], size: 1.2,
    desc: '开场念诵禁忌咒文，之后每回合获得 9 点力量。必须速战速决。',
    moves: {
      incant: buffSelf('禁忌咒文', 'ritual', 9),
      savage: atk('野蛮劈凿', 12),
    },
    ai: (e) => (e.turns === 0 ? 'incant' : 'savage'),
  },
  {
    id: 'slimed_berserker', name: '黏液狂战士', art: '🧌', hp: [266, 266], size: 1.5,
    desc: '固定循环：呕吐黏液 → 吸血拥抱 → 窒息 → 狂怒连打。',
    moves: {
      vomit: move('呕吐黏液', 'debuff', (_e, g) => g.addToDiscard('slimed', false, 10)),
      hug: move('吸血拥抱', 'strongDebuff', (e, g) => {
        g.apply(g.player, 'weak', 3, e);
        g.apply(e, 'strength', 3, e);
      }),
      smother: atk('窒息', 30),
      pummel: atk('狂怒连打', 4, 4),
    },
    ai: (e) => cycle(e, ['vomit', 'hug', 'smother', 'pummel']),
  },
  {
    id: 'fabricator', name: '制造机', art: '🏭', hp: [150, 150], size: 1.35,
    desc: '会不断制造防御机器人来保护自己。',
    moves: {
      fabricate: move('制造', 'summon', (_e, g) => summon(g, 'defensive_bot', 1, 4)),
      strike: atk('制造打击', 18),
      disintegrate: atk('分解', 11),
    },
    ai: (e, g) => {
      const bots = g.alive.filter((x) => x.defId === 'defensive_bot').length;
      if (e.turns === 0 || (bots < 2 && !e.history.slice(-3).includes('fabricate'))) return 'fabricate';
      return last(e, 'strike') ? 'disintegrate' : 'strike';
    },
  },
  {
    id: 'defensive_bot', name: '防御机器人', art: '🤖', hp: [18, 22], size: 0.75,
    summonedBy: 'fabricator',
    desc: '制造机的产物，给主人加格挡。',
    moves: {
      protect: move('护卫', 'defend', (_e, g) => {
        const f = g.alive.find((x) => x.defId === 'fabricator');
        if (f) g.gainBlock(f, 6);
      }),
      zap: atk('电击', 5),
    },
    ai: (e) => cycle(e, ['zap', 'protect']),
  },
  {
    id: 'living_shield', name: '活体盾牌', art: '🛡️', hp: [55, 55], size: 1.15,
    desc: '炮塔操作员活着时用盾牌掩护他；操作员一死就会暴怒。',
    moves: {
      slam: atkThen('盾击', 6, 1, 'attackDefend', (_e, g) => {
        const op = g.alive.find((x) => x.defId === 'turret_operator');
        if (op) g.gainBlock(op, 6);
      }),
      smash: atkThen('粉碎', 16, 1, 'attackBuff', (e, g) => void g.apply(e, 'strength', 3, e)),
    },
    ai: (_e, g) => (g.alive.some((x) => x.defId === 'turret_operator') ? 'slam' : 'smash'),
  },
  {
    id: 'turret_operator', name: '炮塔操作员', art: '🔫', hp: [41, 41],
    moves: {
      unload: atk('倾泻！', 3, 5),
      loading: buffSelf('装弹', 'strength', 1),
    },
    ai: (e) => cycle(e, ['unload', 'loading']),
  },
  // ------------------------------------------------------------------ 精英
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
        g.apply(g.player, 'weak', 1, e);
        g.afflictCards('heavy', 1);
      }),
      charge: move('蓄能', 'defend', (e, g) => g.gainBlock(e, 10)),
      blast: atk('奥术爆发', 26),
    },
    ai: (e) => cycle(e, ['arcane', 'charge', 'blast']),
  },
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
        g.afflictCards('sapping', 2);
        g.heal(e, 15);
      }),
      pulse: atk('灵魂脉冲', 18),
    },
    ai: (e) => cycle(e, ['burn', 'drain', 'pulse', 'burn', 'pulse']),
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
    id: 'aeonglass', name: '永恒沙漏', art: '⏳', hp: [512, 512], size: 1.75,
    desc: '固定循环：退潮 → 眼部激光 → 渐强。你每打出 6 张牌，它就往你手里塞一张「凋零」。',
    init: (e, g) => {
      g.apply(e, 'artifact', 3, e);
      g.apply(e, 'withering_presence', 6, e);
    },
    moves: {
      ebb: atkThen('退潮', 26, 1, 'attackDefend', (e, g) => g.gainBlock(e, 33)),
      lasers: atk('眼部激光', 11, 2),
      intensity: move('渐强', 'buff', (e, g) => {
        g.apply(e, 'strength', 3, e);
        g.addToHand('withered');
      }),
    },
    ai: (e) => cycle(e, ['ebb', 'lasers', 'intensity']),
  },
  {
    id: 'queen', name: '荣光女王', art: '👸', hp: [360, 360], size: 1.7,
    init: (e, g) => void g.apply(e, 'artifact', 1, e),
    moves: {
      decree: move('王令', 'buff', (e, g) => {
        for (const x of g.alive) g.apply(x, 'strength', 2, e);
      }),
      execute: atk('处决', 6, 3),
      guard: move('召唤卫队', 'summon', (_e, g) => summon(g, 'queen_guard', 2 - g.alive.filter((x) => x.defId === 'queen_guard').length, 3)),
      wrath: atk('女王之怒', 30),
    },
    ai: (e, g) => {
      if (e.turns === 0) return 'decree';
      const guards = g.alive.filter((x) => x.defId === 'queen_guard').length;
      if (guards === 0) {
        if (!e.history.slice(-3).includes('guard')) return 'guard';
        return last(e, 'wrath') ? 'execute' : 'wrath';
      }
      return cycle(e, ['execute', 'execute', 'decree'], 2);
    },
  },
  {
    id: 'queen_guard', name: '御前卫士', art: '💂', hp: [62, 66],
    moves: {
      protect: move('护驾', 'defend', (_e, g) => {
        const q = g.alive.find((x) => x.defId === 'queen');
        if (q) g.gainBlock(q, 15);
      }),
      halberd: atk('戟击', 9),
    },
    ai: (e, g) => {
      const idx = g.enemies.filter((x) => x.defId === 'queen_guard').indexOf(e);
      return cycle(e, ['protect', 'halberd'], idx);
    },
  },
]);

defineEncounters([
  // 弱
  { id: 'a3_axebots', name: '斧头机器人', act: 3, kind: 'weak', enemies: ['axebot', 'axebot'] },
  { id: 'a3_turret', name: '炮塔操作员', act: 3, kind: 'weak', enemies: ['living_shield', 'turret_operator'] },
  { id: 'a3_globe', name: '球首', act: 3, kind: 'weak', enemies: ['globe_head'] },
  { id: 'a3_cubex', name: '立方构装体', act: 3, kind: 'weak', enemies: ['cubex_construct', 'axebot'] },
  // 普通
  { id: 'a3_owl', name: '枭法官', act: 3, kind: 'strong', enemies: ['owl_magistrate'] },
  { id: 'a3_frog', name: '蛙骑士', act: 3, kind: 'strong', enemies: ['frog_knight'] },
  { id: 'a3_sculptor', name: '虔诚雕刻师', act: 3, kind: 'strong', enemies: ['devoted_sculptor'] },
  { id: 'a3_berserker', name: '黏液狂战士', act: 3, kind: 'strong', enemies: ['slimed_berserker'] },
  { id: 'a3_fabricator', name: '制造机', act: 3, kind: 'strong', enemies: ['fabricator'] },
  { id: 'a3_menagerie', name: '构装动物园', act: 3, kind: 'strong', enemies: ['cubex_construct', 'axebot', 'punch_construct'] },
  { id: 'a3_axebots3', name: '机器人小队', act: 3, kind: 'strong', enemies: ['axebot', 'axebot', 'axebot'] },
  { id: 'a3_globe_turret', name: '球首与炮塔', act: 3, kind: 'strong', enemies: ['living_shield', 'turret_operator', 'globe_head'] },
  // 精英
  { id: 'a3_knights', name: '骑士团', act: 3, kind: 'elite', enemies: ['flail_knight', 'spectral_knight', 'magi_knight'] },
  { id: 'a3_mecha', name: '机甲骑士', act: 3, kind: 'elite', enemies: ['mecha_knight'] },
  { id: 'a3_nexus', name: '灵魂枢纽', act: 3, kind: 'elite', enemies: ['soul_nexus'] },
  // 首领
  { id: 'a3_subject', name: '试验体', act: 3, kind: 'boss', enemies: ['test_subject'], art: '🧟' },
  { id: 'a3_aeonglass', name: '永恒沙漏', act: 3, kind: 'boss', enemies: ['aeonglass'], art: '⏳' },
  { id: 'a3_queen', name: '荣光女王', act: 3, kind: 'boss', enemies: ['queen_guard', 'queen', 'queen_guard'], art: '👸' },
]);
