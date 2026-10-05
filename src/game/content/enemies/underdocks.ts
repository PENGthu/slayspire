import { defineEncounters, defineEnemies } from '../../registry';
import type { Combat } from '../../combat';
import type { Enemy } from '../../types';
import { atk, atkThen, buffSelf, cycle, last, lastTwo, move, pickMove, roll, summon } from './ai';

/** 偷取金币（击杀后夺回） */
function steal(e: Enemy, g: Combat, n: number) {
  const x = Math.min(n, g.run.gold);
  if (x <= 0) return;
  g.run.gold -= x;
  e.mem.stolen = (e.mem.stolen ?? 0) + x;
  g.emit('text', g.player.uid, undefined, `-${x} 金币`);
}

/** 第一幕（另一条路线）：地下船坞 */
defineEnemies([
  // ------------------------------------------------------------------ 普通
  {
    id: 'dock_rat', name: '码头鼠', art: '🐀', hp: [15, 19], size: 0.75,
    moves: {
      gnaw: atk('啃咬', 5),
      swarm: atk('鼠群', 2, 2),
      squeak: buffSelf('尖叫', 'strength', 1),
    },
    ai: (e, g) => pickMove(g, [
      ['gnaw', 50, lastTwo(e, 'gnaw')],
      ['swarm', 35, last(e, 'swarm')],
      ['squeak', 15, last(e, 'squeak')],
    ]),
  },
  {
    id: 'mud_crab', name: '泥蟹', art: '🦞', hp: [30, 34],
    init: (e, g) => void g.apply(e, 'curl_up', 6, e),
    moves: {
      pinch: atk('钳击', 8),
      shell: move('缩壳', 'defendBuff', (e, g) => {
        g.gainBlock(e, 6);
        g.apply(e, 'strength', 1, e);
      }),
    },
    ai: (e, g) => (e.turns === 0 ? 'pinch' : pickMove(g, [
      ['pinch', 65, lastTwo(e, 'pinch')],
      ['shell', 35, last(e, 'shell')],
    ])),
  },
  {
    id: 'bilge_eel', name: '舱底电鳗', art: '🐍', hp: [26, 30],
    moves: {
      shock: atkThen('放电', 6, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'weak', 1, e)),
      coil: move('盘绕', 'defendBuff', (e, g) => {
        g.gainBlock(e, 5);
        g.apply(e, 'strength', 1, e);
      }),
      lash: atk('甩尾', 9),
    },
    ai: (e, g) => pickMove(g, [
      ['shock', 40, last(e, 'shock')],
      ['lash', 40, lastTwo(e, 'lash')],
      ['coil', 20, last(e, 'coil')],
    ]),
  },
  {
    id: 'pirate_parrot', name: '海盗鹦鹉', art: '🦜', hp: [40, 44],
    init: (e, g) => void g.apply(e, 'thief', 1, e),
    moves: {
      snatch: atkThen('抢夺', 8, 1, 'attack', (e, g) => steal(e, g, 12)),
      squawk: move('聒噪', 'debuff', (e, g) => void g.apply(g.player, 'weak', 1, e)),
      flee: move('飞走', 'escape', (e, g) => {
        e.escaped = true;
        g.emit('escape', e.uid);
      }),
      dive: atk('俯冲', 11),
    },
    ai: (e, g) => {
      if (e.turns >= 4 && e.mem.stolen && roll(g) < 50) return 'flee';
      if (e.turns === 0) return 'snatch';
      return pickMove(g, [
        ['snatch', 40, last(e, 'snatch')],
        ['dive', 40, last(e, 'dive')],
        ['squawk', 20, last(e, 'squawk')],
      ]);
    },
  },
  {
    id: 'barnacle_heap', name: '藤壶堆', art: '🐚', hp: [32, 36],
    init: (e, g) => void g.apply(e, 'plated_armor', 5, e),
    moves: {
      spit: atk('喷射', 7),
      encrust: move('附着', 'debuff', (e, g) => {
        g.apply(g.player, 'frail', 1, e);
        g.gainBlock(e, 4);
      }),
    },
    ai: (e) => cycle(e, ['spit', 'spit', 'encrust']),
  },
  {
    id: 'drowned_diver', name: '溺亡潜水员', art: '🤿', hp: [55, 58], size: 1.1,
    moves: {
      drag: atkThen('拖入深渊', 10, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'frail', 1, e)),
      grasp: atk('抓握', 6, 2),
      gurgle: buffSelf('咕哝', 'strength', 2),
    },
    ai: (e) => cycle(e, ['drag', 'grasp', 'gurgle', 'grasp']),
  },
  {
    id: 'net_caster', name: '撒网人', art: '🎣', hp: [48, 52],
    moves: {
      net: atkThen('撒网', 4, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'entangled', 1, e)),
      hook: atk('鱼钩', 11),
      reel: atk('收线', 5, 2),
    },
    ai: (e, g) => {
      if (e.turns === 1) return 'net';
      return pickMove(g, [
        ['hook', 55, lastTwo(e, 'hook')],
        ['reel', 45, last(e, 'reel')],
        ['net', 10, e.history.includes('net')],
      ]);
    },
  },
  {
    id: 'lantern_fish', name: '灯笼鱼', art: '🐠', hp: [58, 62], size: 1.1,
    moves: {
      lure: move('诱光', 'debuff', (e, g) => {
        g.apply(g.player, 'vulnerable', 1, e);
        g.gainBlock(e, 8);
      }),
      bite: atk('猛咬', 14),
      flash: atkThen('闪光', 5, 1, 'attackDebuff', (_e, g) => g.addToDraw('dazed', false, 1)),
    },
    ai: (e) => cycle(e, ['lure', 'bite', 'flash', 'bite']),
  },
  // ------------------------------------------------------------------ 精英
  {
    id: 'drowned_captain', name: '溺亡船长', art: '☠️', hp: [92, 96], size: 1.35,
    moves: {
      cutlass: atk('弯刀', 7, 2),
      crew: move('召集船员', 'summon', (_e, g) => summon(g, 'dock_rat', 2, 4)),
      load: move('装填火炮', 'buff', (e, g) => void g.apply(e, 'strength', 2, e)),
      cannon: atk('火炮齐射', 22),
    },
    ai: (e, g) => {
      const rats = g.alive.filter((x) => x.defId === 'dock_rat').length;
      if (e.turns === 0 || (rats === 0 && e.turns % 4 === 0)) return 'crew';
      if (last(e, 'load')) return 'cannon';
      return e.turns % 3 === 2 ? 'load' : 'cutlass';
    },
  },
  {
    id: 'tide_golem', name: '潮汐魔像', art: '🌊', hp: [118, 124], size: 1.4,
    init: (e, g) => void g.apply(e, 'artifact', 1, e),
    moves: {
      wave: atkThen('巨浪', 12, 1, 'attackDebuff', (_e, g) => g.addToDiscard('slimed', false, 2)),
      rise: move('涨潮', 'defendBuff', (e, g) => {
        g.gainBlock(e, 15);
        g.apply(e, 'strength', 2, e);
      }),
      crash: atk('拍岸', 6, 3),
    },
    ai: (e) => cycle(e, ['wave', 'crash', 'rise']),
  },
  {
    id: 'hermit_titan', name: '巨蚌', art: '🦪', hp: [84, 88], size: 1.3,
    init: (e, g) => void g.apply(e, 'malleable', 3, e),
    moves: {
      clamp: atk('夹击', 15),
      pearl: atk('珍珠弹', 4, 3),
      harden: move('闭壳', 'defendBuff', (e, g) => {
        g.gainBlock(e, 12);
        g.apply(e, 'strength', 2, e);
      }),
    },
    ai: (e, g) => pickMove(g, [
      ['clamp', 45, last(e, 'clamp')],
      ['pearl', 35, lastTwo(e, 'pearl')],
      ['harden', 20, e.history.slice(-2).includes('harden')],
    ]),
  },
  // ------------------------------------------------------------------ 首领
  {
    id: 'shipwreck_shark', name: '噬船巨鲨', art: '🦈', hp: [230, 230], size: 1.75,
    moves: {
      circle: move('盘旋', 'defendBuff', (e, g) => {
        g.gainBlock(e, 18);
        g.apply(e, 'strength', 3, e);
      }),
      bite: atk('撕咬', 16),
      frenzy: atk('狂乱', 4, 4),
      blood: move('嗅到血腥', 'strongDebuff', (e, g) => {
        g.apply(g.player, 'vulnerable', 1, e);
        g.apply(g.player, 'frail', 1, e);
      }),
    },
    ai: (e) => (e.turns === 0 ? 'blood' : cycle(e, ['bite', 'frenzy', 'circle', 'bite', 'blood'], 4)),
  },
  {
    id: 'anchor_wraith', name: '锚魂', art: '⚓', hp: [220, 220], size: 1.7,
    init: (e, g) => void g.apply(e, 'plated_armor', 8, e),
    moves: {
      chain: atkThen('锁链', 8, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'weak', 1, e)),
      drop: atk('沉锚', 26),
      rust: move('锈蚀', 'defendBuff', (e, g) => {
        g.gainBlock(e, 14);
        g.apply(e, 'strength', 2, e);
      }),
      sweep: atk('横扫', 6, 3),
    },
    ai: (e) => cycle(e, ['chain', 'sweep', 'rust', 'drop']),
  },
  {
    id: 'siren_queen', name: '塞壬女王', art: '🧜', hp: [200, 200], size: 1.7,
    moves: {
      song: move('魅惑之歌', 'strongDebuff', (e, g) => {
        g.apply(g.player, 'weak', 2, e);
        g.addToDraw('dazed', false, 1);
        g.afflictCards('sapping', 2);
      }),
      shriek: atk('尖啸', 5, 3),
      drown: atk('溺毙', 22),
      call: move('召唤鱼群', 'summon', (_e, g) => summon(g, 'lantern_fish', 1, 3)),
      tide: move('潮汐护盾', 'defendBuff', (e, g) => {
        g.gainBlock(e, 20);
        g.apply(e, 'strength', 2, e);
      }),
    },
    ai: (e, g) => {
      const fish = g.alive.filter((x) => x.defId === 'lantern_fish').length;
      if (e.turns === 2 && fish === 0) return 'call';
      return cycle(e, ['song', 'shriek', 'drown', 'tide', 'shriek', 'drown']);
    },
  },
]);

defineEncounters([
  { id: 'u1_rats', name: '码头鼠', act: 1, zone: 'underdocks', kind: 'weak', enemies: ['dock_rat', 'dock_rat', 'dock_rat'] },
  { id: 'u1_crab', name: '泥蟹', act: 1, zone: 'underdocks', kind: 'weak', enemies: ['mud_crab'] },
  { id: 'u1_eels', name: '电鳗', act: 1, zone: 'underdocks', kind: 'weak', enemies: ['bilge_eel', 'dock_rat'] },
  { id: 'u1_parrot', name: '海盗鹦鹉', act: 1, zone: 'underdocks', kind: 'weak', enemies: ['pirate_parrot'] },
  { id: 'u1_barnacle', name: '藤壶堆', act: 1, zone: 'underdocks', kind: 'weak', enemies: ['barnacle_heap', 'dock_rat'] },
  { id: 'u1_diver', name: '溺亡潜水员', act: 1, zone: 'underdocks', kind: 'strong', enemies: ['drowned_diver'] },
  { id: 'u1_net', name: '撒网人', act: 1, zone: 'underdocks', kind: 'strong', enemies: ['net_caster', 'dock_rat'] },
  { id: 'u1_lantern', name: '灯笼鱼', act: 1, zone: 'underdocks', kind: 'strong', enemies: ['lantern_fish'] },
  { id: 'u1_crabs', name: '泥蟹与电鳗', act: 1, zone: 'underdocks', kind: 'strong', enemies: ['mud_crab', 'bilge_eel'] },
  { id: 'u1_pirates', name: '海盗', act: 1, zone: 'underdocks', kind: 'strong', enemies: ['pirate_parrot', 'barnacle_heap'] },
  { id: 'u1_ratpack', name: '鼠群', act: 1, zone: 'underdocks', kind: 'strong', enemies: ['dock_rat', 'dock_rat', 'dock_rat', 'dock_rat'] },
  { id: 'u1_captain', name: '溺亡船长', act: 1, zone: 'underdocks', kind: 'elite', enemies: ['drowned_captain'] },
  { id: 'u1_golem', name: '潮汐魔像', act: 1, zone: 'underdocks', kind: 'elite', enemies: ['tide_golem'] },
  { id: 'u1_titan', name: '巨蚌', act: 1, zone: 'underdocks', kind: 'elite', enemies: ['hermit_titan'] },
  { id: 'u1_shark', name: '噬船巨鲨', act: 1, zone: 'underdocks', kind: 'boss', enemies: ['shipwreck_shark'], art: '🦈' },
  { id: 'u1_anchor', name: '锚魂', act: 1, zone: 'underdocks', kind: 'boss', enemies: ['anchor_wraith'], art: '⚓' },
  { id: 'u1_siren', name: '塞壬女王', act: 1, zone: 'underdocks', kind: 'boss', enemies: ['siren_queen'], art: '🧜' },
]);
