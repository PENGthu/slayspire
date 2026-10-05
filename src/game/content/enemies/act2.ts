import { defineEncounters, defineEnemies, definePowers } from '../../registry';
import type { Combat } from '../../combat';
import type { Enemy } from '../../types';
import { atk, atkThen, buffSelf, cycle, last, lastTwo, move, pickMove, roll, summon } from './ai';

/** 偷取金币 */
function steal(e: Enemy, g: Combat, n: number) {
  const x = Math.min(n, g.run.gold);
  if (x <= 0) return;
  g.run.gold -= x;
  e.mem.stolen = (e.mem.stolen ?? 0) + x;
  g.emit('text', g.player.uid, undefined, `-${x} 金币`);
}

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

/** 第二幕：嗡鸣蜂巢 */
defineEnemies([
  // ------------------------------------------------------------------ 普通
  {
    id: 'worker_bee', name: '工蜂', art: '🐝', hp: [14, 18], size: 0.75,
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
    id: 'larva', name: '蜂巢幼虫', art: '🪱', hp: [30, 34], size: 0.85,
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
  {
    id: 'byrd', name: '尖嘴鸟', art: '🐦', hp: [25, 31], size: 0.85,
    init: (e, g) => void g.apply(e, 'flight', 3, e),
    moves: {
      peck: atk('啄击', 1, 5),
      swoop: atk('俯冲', 12),
      caw: buffSelf('鸣叫', 'strength', 1),
      grounded: move('坠落', 'stun', () => {}),
      headbutt: atk('头槌', 3),
      fly: buffSelf('起飞', 'flight', 3),
    },
    ai: (e, g) => {
      if (!g.has(e, 'flight')) {
        if (last(e, 'grounded') || e.move === 'grounded') return 'headbutt';
        if (last(e, 'headbutt')) return 'fly';
      }
      if (e.turns === 0) return roll(g) < 37 ? 'caw' : 'peck';
      return pickMove(g, [
        ['peck', 50, lastTwo(e, 'peck')],
        ['swoop', 20, last(e, 'swoop')],
        ['caw', 30, last(e, 'caw')],
      ]);
    },
  },
  {
    id: 'hive_guard', name: '蜂巢卫兵', art: '🐞', hp: [48, 52],
    moves: {
      guard: move('结阵', 'defend', (e, g) => {
        for (const x of g.alive) g.gainBlock(x, 9);
        void e;
      }),
      jab: atk('刺击', 10),
    },
    ai: (e) => cycle(e, ['guard', 'jab', 'jab']),
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
    id: 'chomper', name: '大颚虫', art: '🐊', hp: [58, 62],
    init: (e, g) => void g.apply(e, 'artifact', 2, e),
    moves: {
      chomp: atk('撕咬', 8, 2),
      screech: move('尖啸', 'debuff', (e, g) => {
        g.addToDraw('dazed', false, 2);
        g.apply(g.player, 'weak', 1, e);
      }),
    },
    ai: (e) => cycle(e, ['chomp', 'chomp', 'screech']),
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
  // ------------------------------------------------------------------ 精英
  {
    id: 'infested_prism', name: '感染棱镜', art: '💎', hp: [180, 190], size: 1.35,
    init: (e, g) => void g.apply(e, 'artifact', 2, e),
    moves: {
      refract: atk('折射', 8, 3),
      pulse: move('感染脉冲', 'debuff', (e, g) => {
        g.addToDiscard('burn', false, 2);
        g.apply(g.player, 'weak', 1, e);
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
        for (const x of g.alive) g.apply(x, 'strength', 2, e);
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
        g.addToDraw('decay', false, 1);
        g.apply(g.player, 'weak', 2, e);
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

defineEncounters([
  { id: 'a2_bees', name: '工蜂群', act: 2, kind: 'weak', enemies: ['worker_bee', 'worker_bee', 'worker_bee'] },
  { id: 'a2_hopper', name: '窃贼跳虫', act: 2, kind: 'weak', enemies: ['thieving_hopper'] },
  { id: 'a2_larvae', name: '幼虫', act: 2, kind: 'weak', enemies: ['larva', 'larva'] },
  { id: 'a2_chomper', name: '大颚虫', act: 2, kind: 'weak', enemies: ['chomper'] },
  { id: 'a2_guard', name: '蜂巢卫兵', act: 2, kind: 'weak', enemies: ['hive_guard', 'worker_bee', 'worker_bee'] },
  { id: 'a2_hunter', name: '猎杀者', act: 2, kind: 'strong', enemies: ['hunter_killer'] },
  { id: 'a2_chompers', name: '大颚虫群', act: 2, kind: 'strong', enemies: ['chomper', 'chomper'] },
  { id: 'a2_tunneler', name: '掘地者', act: 2, kind: 'strong', enemies: ['tunneler', 'worker_bee'] },
  { id: 'a2_ovicopter', name: '产卵母虫', act: 2, kind: 'strong', enemies: ['ovicopter'] },
  { id: 'a2_byrds', name: '尖嘴鸟群', act: 2, kind: 'strong', enemies: ['byrd', 'byrd', 'byrd'] },
  { id: 'a2_thieves', name: '窃贼与幼虫', act: 2, kind: 'strong', enemies: ['thieving_hopper', 'larva'] },
  { id: 'a2_guard_chomper', name: '卫兵与大颚虫', act: 2, kind: 'strong', enemies: ['hive_guard', 'chomper'] },
  { id: 'a2_prism', name: '感染棱镜', act: 2, kind: 'elite', enemies: ['infested_prism'] },
  { id: 'a2_millipede', name: '千足虫', act: 2, kind: 'elite', enemies: ['decimillipede'] },
  { id: 'a2_entomancer', name: '驭虫师', act: 2, kind: 'elite', enemies: ['entomancer'] },
  { id: 'a2_insatiable', name: '贪食者', act: 2, kind: 'boss', enemies: ['insatiable'], art: '🐲' },
  { id: 'a2_demon', name: '知识恶魔', act: 2, kind: 'boss', enemies: ['knowledge_demon'], art: '😈' },
  { id: 'a2_crab', name: '帝王蟹', act: 2, kind: 'boss', enemies: ['kaiser_crab'], art: '🦀' },
]);
