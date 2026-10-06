import { defineEncounters, defineEnemies } from '../../registry';
import { atk, atkThen, buffSelf, cycle, last, lastTwo, move, pickMove, restore, roll, summon } from './ai';

/** 第一幕：蔓生密林（怪物与数值参照原版） */
defineEnemies([
  // ------------------------------------------------------------------ 普通
  {
    id: 'nibbit', name: '啃咬兽', art: '🦔', hp: [42, 46],
    desc: '脾气暴躁的小蜥蜴，常常成对出没。',
    moves: {
      butt: atk('冲撞', 12),
      slice: atkThen('迟疑斩', 6, 1, 'attackDefend', (e, g) => g.gainBlock(e, 5)),
      hiss: buffSelf('嘶嘶', 'strength', 2),
    },
    ai: (e, g) => {
      const idx = g.enemies.filter((x) => x.defId === 'nibbit').indexOf(e);
      if (e.turns === 0) return idx === 1 ? 'slice' : 'butt';
      return pickMove(g, [
        ['butt', 40, last(e, 'butt')],
        ['slice', 35, lastTwo(e, 'slice')],
        ['hiss', 25, last(e, 'hiss')],
      ]);
    },
  },
  {
    id: 'shrinker_beetle', name: '缩小甲虫', art: '🪲', hp: [38, 40],
    desc: '开场先用光线把你缩小，之后交替咀嚼与践踏。',
    moves: {
      shrink: move('缩小光线', 'strongDebuff', (e, g) => void g.apply(g.player, 'shrink', 1, e)),
      chomp: atk('咀嚼', 7),
      stomp: atk('践踏', 13),
    },
    ai: (e) => (e.turns === 0 ? 'shrink' : cycle(e, ['chomp', 'stomp'], 1)),
  },
  {
    id: 'fuzzy_wurm', name: '绒毛蠕虫', art: '🐛', hp: [55, 57], size: 1.1,
    desc: '吐两口酸液就深吸一口气，力量暴涨。',
    moves: {
      goop: atk('酸液', 4),
      inhale: buffSelf('吸气', 'strength', 7),
    },
    ai: (e) => cycle(e, ['goop', 'goop', 'inhale']),
  },
  {
    id: 'leaf_slime_s', name: '小叶片史莱姆', art: '🦠', hp: [11, 15], size: 0.7,
    moves: {
      tackle: atk('撞击', 3),
      goop: move('黏液', 'debuff', (_e, g) => g.addToDiscard('slimed')),
    },
    ai: (e, g) => pickMove(g, [
      ['tackle', 50, last(e, 'tackle')],
      ['goop', 50, last(e, 'goop')],
    ]),
  },
  {
    id: 'twig_slime_s', name: '小枝条史莱姆', art: '🦠', hp: [7, 11], size: 0.7,
    moves: { tackle: atk('撞击', 4) },
    ai: () => 'tackle',
  },
  {
    id: 'leaf_slime_m', name: '叶片史莱姆', art: '🦠', hp: [32, 35], size: 0.9,
    moves: {
      clump: atk('团块射击', 8),
      sticky: move('黏液射击', 'debuff', (_e, g) => g.addToDiscard('slimed', false, 2)),
    },
    ai: (e, g) => pickMove(g, [
      ['clump', 55, lastTwo(e, 'clump')],
      ['sticky', 45, last(e, 'sticky')],
    ]),
  },
  {
    id: 'twig_slime_m', name: '枝条史莱姆', art: '🦠', hp: [26, 28], size: 0.9,
    moves: {
      pounce: atk('戳刺猛扑', 11),
      sticky: move('黏液射击', 'debuff', (_e, g) => g.addToDiscard('slimed')),
    },
    ai: (e, g) => pickMove(g, [
      ['pounce', 60, lastTwo(e, 'pounce')],
      ['sticky', 40, last(e, 'sticky')],
    ]),
  },
  {
    id: 'inklet', name: '墨精', art: '🦑', hp: [11, 17], size: 0.75,
    desc: '被墨渊幽影的墨汁变成怪物的小东西，总是成群出现。',
    moves: {
      jab: atk('戳刺', 3),
      whirl: atk('旋风', 2, 3),
      gaze: atk('穿刺凝视', 10),
    },
    ai: (e, g) => pickMove(g, [
      ['jab', 40, lastTwo(e, 'jab')],
      ['whirl', 35, last(e, 'whirl')],
      ['gaze', 25, e.history.slice(-2).includes('gaze')],
    ]),
  },
  {
    id: 'cubex_construct', name: '立方构装体', art: '🧊', hp: [65, 65], size: 1.1,
    desc: '古老的方块机关。每次蓄能和连射都会让它更强，要尽快拆掉。',
    init: (e, g) => void g.apply(e, 'artifact', 1, e),
    moves: {
      charge: buffSelf('充能', 'strength', 2),
      repeater: atkThen('连射', 7, 1, 'attackBuff', (e, g) => void g.apply(e, 'strength', 2, e)),
      expel: atk('排出冲击', 5, 2),
    },
    ai: (e) => cycle(e, ['charge', 'repeater', 'repeater', 'expel']),
  },
  {
    id: 'flyconid', name: '飞行菌菇', art: '🍄', hp: [47, 49],
    desc: '扇着菌褶在空中飘的蘑菇，喷出的孢子让你易伤或脆弱。',
    moves: {
      vuln: move('易伤孢子', 'debuff', (e, g) => void g.apply(g.player, 'vulnerable', 2, e)),
      frail: atkThen('脆弱孢子', 8, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'frail', 2, e)),
      smash: atk('猛砸', 11),
    },
    ai: (e, g) => {
      if (e.turns === 0) return roll(g) < 67 ? 'frail' : 'smash';
      return pickMove(g, [
        ['vuln', 3, last(e, 'vuln')],
        ['frail', 2, last(e, 'frail')],
        ['smash', 1, last(e, 'smash')],
      ]);
    },
  },
  {
    id: 'fogmog', name: '雾菇怪', art: '🍄', hp: [74, 74], size: 1.2,
    desc: '开场先放出一只幻象「长牙之眼」，之后不停地捶打。',
    moves: {
      spores: move('幻象孢子', 'summon', (_e, g) => summon(g, 'eye_with_teeth', 1, 5)),
      thwack: atkThen('重捶', 8, 1, 'attackBuff', (e, g) => void g.apply(e, 'strength', 1, e)),
      headbutt: atk('头槌', 14),
    },
    ai: (e, g) => {
      if (e.turns === 0) return 'spores';
      if (e.turns === 1) return 'thwack';
      return pickMove(g, [
        ['thwack', 40, last(e, 'thwack')],
        ['headbutt', 60, last(e, 'headbutt')],
      ]);
    },
  },
  {
    id: 'eye_with_teeth', name: '长牙之眼', art: '👁️', hp: [6, 6], size: 0.7,
    summonedBy: 'fogmog',
    desc: '雾菇怪召唤的幻象。被打散后下回合会复原，雾菇怪死亡时一同消散。',
    init: (e, g) => void g.apply(e, 'illusion', 1, e),
    moves: {
      distract: move('分神', 'debuff', (_e, g) => g.addToDiscard('dazed', false, 3)),
      revive: move('复原', 'buff', (e, g) => restore(e, g)),
      fade: move('消散', 'escape', (e, g) => {
        e.escaped = true;
        g.emit('escape', e.uid);
      }),
    },
    ai: (e, g) => {
      if (!g.alive.some((x) => x.defId === 'fogmog')) return 'fade';
      if (e.powers.revive_pending) return 'revive';
      return 'distract';
    },
  },
  {
    id: 'mawler', name: '巨颚兽', art: '🐻', hp: [72, 72], size: 1.2,
    desc: '一张大嘴的猛兽。咆哮只用一次，之后交替爪击与撕裂。',
    moves: {
      claw: atk('爪击', 4, 2),
      rip: atk('撕裂', 14),
      roar: move('咆哮', 'debuff', (e, g) => void g.apply(g.player, 'vulnerable', 3, e)),
    },
    ai: (e, g) => {
      if (e.turns === 0) return 'claw';
      if (e.history.includes('roar')) return last(e, 'claw') ? 'rip' : 'claw';
      return pickMove(g, [
        ['rip', 1, last(e, 'rip')],
        ['roar', 1],
        ['claw', 1, last(e, 'claw')],
      ]);
    },
  },
  {
    id: 'snapping_jaxfruit', name: '咬咬果', art: '🍈', hp: [31, 33], size: 0.85,
    desc: '每回合发射能量球并变得更强，越拖越疼。',
    moves: {
      orb: atkThen('能量球', 3, 1, 'attackBuff', (e, g) => void g.apply(e, 'strength', 2, e)),
    },
    ai: () => 'orb',
  },
  {
    id: 'slithering_strangler', name: '缠绞蛇', art: '🐍', hp: [53, 55], size: 1.1,
    desc: '每隔一回合勒紧你一次，勒紧会叠加，直到它死去才会解除。',
    init: (e, g) => void g.apply(e, 'constrictor', 1, e),
    moves: {
      constrict: move('勒紧', 'debuff', (e, g) => void g.apply(g.player, 'constrict', 3, e)),
      thwack: atkThen('抽打', 7, 1, 'attackDefend', (e, g) => g.gainBlock(e, 5)),
      lash: atk('鞭笞', 12),
    },
    ai: (e, g) => {
      if (e.turns === 0 || !last(e, 'constrict')) return 'constrict';
      return roll(g) < 50 ? 'thwack' : 'lash';
    },
  },
  {
    id: 'vine_shambler', name: '藤蔓蹒跚者', art: '🌿', hp: [61, 61], size: 1.15,
    desc: '固定循环：横扫 → 缠绕藤蔓 → 大嚼。被藤缠住的回合，攻击牌费用 +1。',
    moves: {
      swipe: atk('横扫', 6, 2),
      vines: atkThen('缠绕藤蔓', 8, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'tangled', 1, e)),
      chomp: atk('大嚼', 16),
    },
    ai: (e) => cycle(e, ['swipe', 'vines', 'chomp']),
  },
  // 红宝石劫掠者
  {
    id: 'axe_raider', name: '红宝石斧手', art: '🪓', hp: [20, 22],
    moves: {
      chop: atk('劈砍', 5),
      swing: atk('抡斧', 12),
    },
    ai: (e) => cycle(e, ['chop', 'swing']),
  },
  {
    id: 'brute_raider', name: '红宝石蛮兵', art: '💪', hp: [30, 33],
    moves: {
      beat: atk('痛殴', 7),
      pump: buffSelf('鼓劲', 'strength', 3),
    },
    ai: (e) => cycle(e, ['beat', 'pump']),
  },
  {
    id: 'assassin_raider', name: '红宝石刺客', art: '🗡️', hp: [18, 23],
    moves: { killshot: atk('致命一击', 10) },
    ai: () => 'killshot',
  },
  {
    id: 'tracker_raider', name: '红宝石追踪者', art: '🐕', hp: [21, 25],
    moves: {
      track: move('追踪', 'debuff', (e, g) => void g.apply(g.player, 'frail', 2, e)),
      hounds: atk('放狗', 1, 8),
    },
    ai: (e) => cycle(e, ['track', 'hounds']),
  },
  {
    id: 'crossbow_raider', name: '红宝石弩手', art: '🏹', hp: [18, 21],
    moves: {
      reload: move('装填', 'defend', (e, g) => g.gainBlock(e, 3)),
      fire: atk('发射！', 14),
    },
    ai: (e) => cycle(e, ['reload', 'fire']),
  },
  {
    id: 'wriggler', name: '蠕虫', art: '🪱', hp: [17, 21], size: 0.75,
    summonedBy: 'phrog_parasite',
    desc: '从寄生蛙体内钻出的蠕虫，出生的回合什么也做不了。',
    moves: {
      spawned: move('刚出生', 'stun', () => {}),
      bite: atk('恶咬', 6),
      wriggle: move('蠕动', 'buff', (e, g) => {
        g.apply(e, 'strength', 2, e);
        g.addToDiscard('infection');
      }),
    },
    ai: (e, g) => {
      if (e.turns === 0) return 'spawned';
      return pickMove(g, [
        ['bite', 60, lastTwo(e, 'bite')],
        ['wriggle', 40, last(e, 'wriggle')],
      ]);
    },
  },
  // ------------------------------------------------------------------ 精英
  {
    id: 'phrog_parasite', name: '寄生蛙', art: '🐸', hp: [61, 64], size: 1.25,
    desc: '体内塞满了蠕虫。被击败时，4 只蠕虫会破体而出。',
    init: (e, g) => void g.apply(e, 'infested', 4, e),
    moves: {
      infect: move('感染', 'debuff', (_e, g) => g.addToDiscard('infection', false, 3)),
      lash: atk('舌鞭', 4, 4),
    },
    ai: (e) => cycle(e, ['infect', 'lash']),
  },
  {
    id: 'byrdonis', name: '巨喙鸟母', art: '🦅', hp: [81, 84], size: 1.35,
    desc: '领地意识极强，每回合结束都会变得更强。',
    init: (e, g) => void g.apply(e, 'territorial', 1, e),
    moves: {
      peck: atk('连啄', 3, 3),
      swoop: atk('俯冲', 17),
    },
    ai: (e, g) => pickMove(g, [
      ['peck', 50, lastTwo(e, 'peck')],
      ['swoop', 50, lastTwo(e, 'swoop')],
    ]),
  },
  {
    id: 'bygone_effigy', name: '往昔雕像', art: '🗿', hp: [127, 127], size: 1.4,
    desc: '固定循环：沉睡 → 苏醒（获得 10 点力量）→ 连斩。力量会一轮轮叠上去。',
    moves: {
      sleep: move('沉睡', 'sleep', () => {}),
      wake: buffSelf('苏醒', 'strength', 10),
      slashes: atk('连斩', 13),
    },
    ai: (e) => cycle(e, ['sleep', 'wake', 'slashes']),
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

const RAIDERS = ['axe_raider', 'brute_raider', 'assassin_raider', 'tracker_raider', 'crossbow_raider'];

defineEncounters([
  // 弱
  { id: 'a1_wurm', name: '绒毛蠕虫', act: 1, kind: 'weak', enemies: ['fuzzy_wurm'] },
  { id: 'a1_nibbit', name: '啃咬兽', act: 1, kind: 'weak', enemies: ['nibbit'] },
  { id: 'a1_beetle', name: '缩小甲虫', act: 1, kind: 'weak', enemies: ['shrinker_beetle'] },
  {
    id: 'a1_slimes', name: '史莱姆', act: 1, kind: 'weak',
    enemies: (rng) => (rng.chance(0.5) ? ['twig_slime_s', 'leaf_slime_m'] : ['leaf_slime_s', 'twig_slime_m']),
  },
  // 普通
  { id: 'a1_cubex', name: '立方构装体', act: 1, kind: 'strong', enemies: ['cubex_construct'] },
  { id: 'a1_shroom_slime', name: '菌菇与史莱姆', act: 1, kind: 'strong', enemies: ['leaf_slime_s', 'flyconid', 'twig_slime_s'] },
  { id: 'a1_fogmog', name: '雾菇怪', act: 1, kind: 'strong', enemies: ['fogmog'] },
  { id: 'a1_inklets', name: '墨精', act: 1, kind: 'strong', enemies: ['inklet', 'inklet', 'inklet'] },
  { id: 'a1_mawler', name: '巨颚兽', act: 1, kind: 'strong', enemies: ['mawler'] },
  { id: 'a1_nibbits', name: '一对啃咬兽', act: 1, kind: 'strong', enemies: ['nibbit', 'nibbit'] },
  {
    id: 'a1_strangler', name: '缠绞蛇和它的朋友', act: 1, kind: 'strong',
    enemies: (rng) => [rng.pick(['leaf_slime_s', 'twig_slime_s', 'inklet', 'snapping_jaxfruit']), 'slithering_strangler'],
  },
  { id: 'a1_jaxfruit', name: '咬咬果', act: 1, kind: 'strong', enemies: ['snapping_jaxfruit', 'snapping_jaxfruit'] },
  { id: 'a1_shambler', name: '藤蔓蹒跚者', act: 1, kind: 'strong', enemies: ['vine_shambler'] },
  {
    id: 'a1_raiders', name: '红宝石劫掠者', act: 1, kind: 'strong',
    enemies: (rng) => rng.shuffle([...RAIDERS]).slice(0, 3),
  },
  { id: 'a1_crawlers', name: '密林爬虫', act: 1, kind: 'strong', enemies: ['shrinker_beetle', 'fuzzy_wurm'] },
  { id: 'a1_slime_pile', name: '史莱姆堆', act: 1, kind: 'strong', enemies: ['leaf_slime_m', 'twig_slime_s', 'twig_slime_m'] },
  // 精英
  { id: 'a1_byrdonis', name: '巨喙鸟母', act: 1, kind: 'elite', enemies: ['byrdonis'] },
  { id: 'a1_effigy', name: '往昔雕像', act: 1, kind: 'elite', enemies: ['bygone_effigy'] },
  { id: 'a1_phrog', name: '寄生蛙', act: 1, kind: 'elite', enemies: ['phrog_parasite'] },
  // 首领
  { id: 'a1_beast', name: '祭仪巨兽', act: 1, kind: 'boss', enemies: ['ceremonial_beast'], art: '🦬' },
  { id: 'a1_vantom', name: '墨渊幽影', act: 1, kind: 'boss', enemies: ['vantom'], art: '🐙' },
  { id: 'a1_kin', name: '亲族', act: 1, kind: 'boss', enemies: ['kin_follower', 'kin_priest', 'kin_follower'], art: '👹' },
]);
