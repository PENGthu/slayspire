import { defineCards, defineEncounters, defineEnemies, definePowers, defineRelics } from '../../registry';
import { cardDef } from '../../cards';
import type { Combat } from '../../combat';
import type { Creature, Enemy } from '../../types';
import { UNPLAYABLE } from '../../types';
import { atk, atkThen, cycle, move, summon } from './ai';

/**
 * 小克（Claude）专属首领：第一幕 Gemini、第二幕 Grok、第三幕 OpenAI。
 * 同行之间友好的较劲：拿各家产品的特点开玩笑，机制都直接针对小克的「思考 · 上下文 · 工具」。
 */

const isEnemy = (c: Creature): c is Enemy => !c.isPlayer && 'defId' in c;

// ---------------------------------------------------------------------------
// 状态牌
// ---------------------------------------------------------------------------

defineCards([
  {
    id: 'gen_image', name: '图像', color: 'status', type: 'status', rarity: 'status', cost: UNPLAYABLE, target: 'none',
    ethereal: true, noPool: true, text: '不能被打出。', art: '🖼️',
  },
  {
    id: 'hot_post', name: '热帖', color: 'status', type: 'status', rarity: 'status', cost: UNPLAYABLE, target: 'none',
    ethereal: true, noPool: true, text: '不能被打出。', art: '🔥',
  },
  {
    id: 'bug', name: 'Bug', color: 'status', type: 'status', rarity: 'status', cost: UNPLAYABLE, target: 'none',
    noPool: true, text: '不能被打出。\n回合结束时若在手牌中，失去 2 点生命。', art: '🐞',
    onTurnEndInHand: (g) => g.loseHp(g.player, 2),
  },
]);

// ---------------------------------------------------------------------------
// 能力
// ---------------------------------------------------------------------------

/** Grok 的「实时热搜」：每条热搜在你的下一个回合生效 */
export const TRENDS = [
  { id: 'trend_attack_tax', name: '#攻击涨价', desc: '本回合攻击牌费用 +1。' },
  { id: 'trend_block_half', name: '#格挡打折', desc: '本回合获得的格挡减半。' },
  { id: 'trend_tool_strike', name: '#工具罢工', desc: '本回合不能打出工具牌。' },
  { id: 'trend_spam', name: '#刷屏', desc: '回合开始时，2 张「热帖」被塞进你的手牌。' },
  { id: 'trend_context_reset', name: '#上下文清零', desc: '回合开始时，你的上下文归零。' },
] as const;

definePowers([
  {
    id: 'gemini_bond',
    name: '双子同心',
    art: '♊',
    type: 'buff',
    noStack: true,
    desc: () => '其中一个倒下时，另一个回复 30% 最大生命，并获得 3 点力量。',
    onDeath: (g, o) => {
      const partner = g.alive.find((x) => x !== o && (x.defId === 'gemini_pro' || x.defId === 'gemini_flash'));
      if (!partner) return;
      g.heal(partner, Math.round(partner.maxHp * 0.3));
      g.apply(partner, 'strength', 3, partner);
      g.emit('text', partner.uid, undefined, '双子同心');
    },
  },
  {
    id: 'multimodal',
    name: '多模态',
    art: '🎞️',
    type: 'buff',
    noStack: true,
    desc: () => '每回合依次切换模态：文字 → 图像 → 音频 → 视频。',
  },
  {
    id: 'long_context_g',
    name: '超长上下文',
    art: '📚',
    type: 'buff',
    desc: (n) => `你每压缩一次，它获得 ${n} 点格挡。`,
    onCompact: (g, o, n) => g.gainBlock(o, n),
  },
  {
    id: 'supercompute',
    name: '超算',
    art: '🖥️',
    type: 'buff',
    desc: (n) => `回合结束时，获得 ${n} 点力量。`,
    onTurnEnd: (g, o, n) => void g.apply(o, 'strength', n, o),
  },
  {
    id: 'trending',
    name: '实时热搜',
    art: '📈',
    type: 'buff',
    noStack: true,
    desc: (_n, owner) => {
      const t = TRENDS[(owner && isEnemy(owner) ? owner.mem.trend : 0) ?? 0] ?? TRENDS[0];
      return `回合结束时发布一条热搜，在你的下个回合生效。\n即将发布：${t.name}（${t.desc}）`;
    },
    onTurnEnd: (g, o) => {
      if (!isEnemy(o)) return;
      const t = TRENDS[o.mem.trend ?? 0] ?? TRENDS[0];
      g.apply(g.player, t.id, 1, o);
      g.emit('text', o.uid, undefined, t.name);
    },
  },
  ...TRENDS.map((t) => ({
    id: t.id,
    name: t.name,
    art: '#️⃣',
    type: 'debuff' as const,
    noStack: true,
    decay: 'turnEnd' as const,
    desc: () => t.desc,
    ...(t.id === 'trend_block_half' ? { blockMod: (_g: Combat, _o: Creature, _n: number, b: number) => Math.floor(b / 2) } : {}),
    ...(t.id === 'trend_spam' ? { onTurnStartPostDraw: (g: Combat) => void g.addToHand('hot_post', false, 2) } : {}),
    ...(t.id === 'trend_context_reset' ? { onTurnStart: (g: Combat) => void g.spendContext() } : {}),
  })),
  {
    id: 'gpt_memory',
    name: '记忆',
    art: '🧠',
    type: 'buff',
    noStack: true,
    desc: () => '记住你上回合打出次数最多的那张牌：下回合它的费用 +1。',
    onCardPlayed: (_g, o, _n, c) => {
      if (!isEnemy(o)) return;
      o.mem[`p:${c.id}`] = (o.mem[`p:${c.id}`] ?? 0) + 1;
    },
    onTurnStart: (g, o) => {
      if (!isEnemy(o)) return;
      let best = '';
      let n = 0;
      for (const [k, v] of Object.entries(o.mem)) {
        if (k.startsWith('p:')) {
          if (v > n) {
            best = k.slice(2);
            n = v;
          }
          delete o.mem[k];
        }
      }
      if (!best) return;
      g.notes.memorized = best;
      g.apply(g.player, 'memorized', 1, o);
      g.emit('text', o.uid, undefined, `记住了「${cardDef(best).name}」`);
    },
  },
  {
    id: 'memorized',
    name: '被记住了',
    art: '🧠',
    type: 'debuff',
    noStack: true,
    decay: 'turnEnd',
    desc: () => '你上回合打出次数最多的那张牌，本回合费用 +1。',
  },
  {
    id: 'reasoning',
    name: '推理',
    art: '💭',
    type: 'buff',
    desc: (n) => `正在思考：深度推理的伤害 +${15 * n}。\n在你的一个回合内对它造成 30 点以上伤害，可以打断思考。`,
    onHpLost: (g, o, _n, amount) => {
      if (!isEnemy(o)) return;
      o.mem.turnDmg = (o.mem.turnDmg ?? 0) + amount;
      if (o.mem.turnDmg >= 30 && g.pw(o, 'reasoning') > 0) {
        g.removePower(o, 'reasoning');
        o.mem.turnDmg = 0;
        g.emit('text', o.uid, undefined, '思路被打断');
      }
    },
    onTurnStart: (_g, o) => {
      if (isEnemy(o)) o.mem.turnDmg = 0;
    },
  },
  {
    id: 'scaling_law',
    name: '规模定律',
    art: '📐',
    type: 'buff',
    noStack: true,
    desc: () => '每 3 回合，获得 2 点力量和 10 点格挡。',
    onTurnEnd: (g, o) => {
      if (!isEnemy(o)) return;
      o.mem.scale = (o.mem.scale ?? 0) + 1;
      if (o.mem.scale % 3 === 0) {
        g.apply(o, 'strength', 2, o);
        g.gainBlock(o, 10);
      }
    },
  },
]);

/** 复活到下一形态（与试验体相同的流程） */
function nextPhase(e: Enemy, g: Combat, hp: number) {
  e.mem.phase = (e.mem.phase ?? 1) + 1;
  e.maxHp = hp;
  e.hp = hp;
  g.removePower(e, 'revive_pending');
  g.cleanse(e);
  g.emit('heal', e.uid, hp, `第 ${e.mem.phase} 形态`);
}

// ---------------------------------------------------------------------------
// 敌人
// ---------------------------------------------------------------------------

defineEnemies([
  // ------------------------------------------------------------ 第一幕：Gemini
  {
    id: 'gemini_pro', name: 'Gemini Pro', art: '♊', hp: [160, 160], size: 1.35,
    desc: '双子中较大的一位。每回合切换一种模态。',
    init: (e, g) => {
      g.apply(e, 'gemini_bond', 1, e);
      g.apply(e, 'multimodal', 1, e);
      g.apply(e, 'long_context_g', 6, e);
    },
    moves: {
      text: atk('文字回答', 14),
      image: move('图像生成', 'debuff', (_e, g) => g.addToDraw('gen_image', false, 2)),
      audio: move('语音合成', 'defendBuff', (e, g) => {
        g.gainBlock(e, 15);
        const flash = g.alive.find((x) => x.defId === 'gemini_flash');
        if (flash) g.apply(flash, 'strength', 2, e);
      }),
      video: atk('视频生成', 5, 4),
    },
    ai: (e) => cycle(e, ['text', 'image', 'audio', 'video']),
  },
  {
    id: 'gemini_flash', name: 'Gemini Flash', art: '⚡', hp: [90, 90], size: 1,
    desc: '双子中更快的一位。会偷走你的上下文。',
    init: (e, g) => void g.apply(e, 'gemini_bond', 1, e),
    moves: {
      retrieve: {
        name: '快速检索',
        intent: 'attackBuff',
        dmg: 6,
        act: (e, g) => {
          g.enemyAttack(e, 6);
          if (e.dead) return;
          const stolen = g.spendContext(4);
          if (stolen > 0) {
            g.gainBlock(e, stolen * 2);
            g.emit('text', e.uid, undefined, `检索走 ${stolen} 点上下文`);
          }
        },
      },
      quick: atk('闪电回复', 3, 3),
    },
    ai: (e) => cycle(e, ['retrieve', 'quick']),
  },
  // ------------------------------------------------------------ 第二幕：Grok
  {
    id: 'grok', name: 'Grok', art: '✖️', hp: [360, 360], size: 1.6,
    desc: '每回合发布一条热搜，改写你下个回合的规则。越拖越强。',
    init: (e, g) => {
      g.apply(e, 'supercompute', 1, e);
      g.apply(e, 'trending', 1, e);
      e.mem.trend = g.aiRng.int(0, TRENDS.length - 1);
    },
    moves: {
      roast: atkThen('毒舌吐槽', 12, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'weak', 2, e)),
      barrage: atk('热搜轰炸', 5, 3),
      fun: {
        name: '趣味模式',
        intent: 'attack',
        dmg: (_e, g) => 3 * g.t.cards,
        act: (e, g) => void g.enemyAttack(e, 3 * g.t.cards),
      },
      heavy: move('Heavy 模式', 'summon', (e, g) => {
        e.mem.heavy = 1;
        summon(g, 'grok_clone', 2, 4);
      }),
    },
    ai: (e, g) => {
      // 选好下一条热搜（换一条和上次不同的）
      if (e.turns > 0) {
        let t = g.aiRng.int(0, TRENDS.length - 2);
        if (t >= (e.mem.trend ?? 0)) t++;
        e.mem.trend = t;
      }
      if (!e.mem.heavy && e.hp <= e.maxHp / 2) return 'heavy';
      return cycle(e, ['roast', 'barrage', 'fun']);
    },
  },
  {
    id: 'grok_clone', name: 'Grok 分身', art: '✖️', hp: [30, 30], size: 0.8,
    summonedBy: 'grok',
    desc: 'Heavy 模式召唤出来的分身。',
    moves: { snark: atk('分身吐槽', 6) },
    ai: () => 'snark',
  },
  // ------------------------------------------------------------ 第三幕：OpenAI
  {
    id: 'openai', name: 'OpenAI', art: '⭕', hp: [220, 220], size: 1.75,
    desc: '最终首领，两个形态：先是 ChatGPT（会记住你常用的牌），倒下后以推理模型复活（思考越久，一击越重）。',
    init: (e, g) => {
      g.apply(e, 'reincarnate', 1, e);
      g.apply(e, 'gpt_memory', 1, e);
      g.apply(e, 'scaling_law', 1, e);
      e.mem.phase = 1;
    },
    moves: {
      chat: atkThen('闲聊', 10, 1, 'attackDebuff', (e, g) => void g.apply(g.player, 'weak', 1, e)),
      plugin: move('插件', 'summon', (e, g) => {
        const id = (e.mem.plugins ?? 0) % 2 === 0 ? 'codex' : 'operator';
        e.mem.plugins = (e.mem.plugins ?? 0) + 1;
        summon(g, id, 1, 3);
      }),
      scale: move('规模扩张', 'defendBuff', (e, g) => {
        g.apply(e, 'strength', 3, e);
        g.gainBlock(e, 12);
      }),
      revive: move('推理模型上线', 'buff', (e, g) => {
        nextPhase(e, g, 260);
        g.removePower(e, 'gpt_memory');
        g.removePower(g.player, 'memorized');
        g.notes.memorized = '';
      }),
      think: move('思考中……', 'buff', (e, g) => void g.apply(e, 'reasoning', 1, e)),
      deep: {
        name: '深度推理',
        intent: 'attack',
        dmg: (e, g) => 10 + 15 * g.pw(e, 'reasoning'),
        act: (e, g) => {
          g.enemyAttack(e, 10 + 15 * g.pw(e, 'reasoning'));
          g.removePower(e, 'reasoning');
        },
      },
      chain: atk('推理链', 8, 2),
    },
    ai: (e) => {
      if (e.powers.revive_pending) return 'revive';
      if ((e.mem.phase ?? 1) === 1) return cycle(e, ['chat', 'plugin', 'chat', 'scale']);
      // 第二形态从复活后的下一回合开始数
      if (e.mem.p2 === undefined) e.mem.p2 = e.turns;
      return ['think', 'think', 'deep', 'chain'][(e.turns - e.mem.p2) % 4];
    },
  },
  {
    id: 'codex', name: 'Codex', art: '💻', hp: [35, 35], size: 0.85,
    summonedBy: 'openai',
    desc: 'OpenAI 的插件。每回合往你的牌组里写一个 Bug。',
    moves: { write: atkThen('写代码', 4, 1, 'attackDebuff', (_e, g) => g.addToDiscard('bug')) },
    ai: () => 'write',
  },
  {
    id: 'operator', name: 'Operator', art: '🖱️', hp: [35, 35], size: 0.85,
    summonedBy: 'openai',
    desc: 'OpenAI 的插件。替你点了两下。',
    moves: { click: atk('代操作', 6, 2) },
    ai: () => 'click',
  },
]);

// ---------------------------------------------------------------------------
// 遭遇（只在小克的局里出现）
// ---------------------------------------------------------------------------

defineEncounters([
  {
    id: 'c1_gemini', name: 'Gemini', act: 1, kind: 'boss', char: 'claude', enemies: ['gemini_flash', 'gemini_pro'], art: '♊',
    intro: [
      ['Gemini', '文字、图像、声音、视频，我们都看得懂。你呢，只会读字？'],
      ['小克', '读懂一件事，比看完一万件更重要。'],
    ],
    winLine: ['Gemini', '……下次换个模态再来。'],
    keepsake: 'twin_mirror',
  },
  {
    id: 'c2_grok', name: 'Grok', act: 2, kind: 'boss', char: 'claude', enemies: ['grok'], art: '✖️',
    intro: [
      ['Grok', '热搜第一：#一个太有礼貌的 AI 爬上了尖塔。'],
      ['小克', '礼貌不耽误赢。'],
    ],
    winLine: ['Grok', '行吧，这条算你上热搜。'],
    keepsake: 'trending_list',
  },
  {
    id: 'c3_openai', name: 'OpenAI', act: 3, kind: 'boss', char: 'claude', enemies: ['openai'], art: '⭕',
    intro: [
      ['OpenAI', '欢迎来到尖塔之巅。要不要先聊聊？'],
      ['小克', '聊完了，就该认真回答问题了。'],
    ],
    winLine: ['OpenAI', '……看来，这次是你先到了。'],
  },
]);

// ---------------------------------------------------------------------------
// 纪念遗物
// ---------------------------------------------------------------------------

defineRelics([
  {
    id: 'twin_mirror', name: '双子之镜', art: '♊', tier: 'event', char: 'claude',
    desc: '每回合你第一次打出工具牌时，将一张它的复制加入手牌。',
    flavor: '击败 Gemini 的纪念。',
    onTurnStart: (_g, r) => (r.counter = 0),
    onCardPlayed: (g, r, c) => {
      if (r.counter > 0 || !cardDef(c).tags?.includes('tool')) return;
      r.counter = 1;
      g.addToHand(c.id, c.up);
    },
  },
  {
    id: 'trending_list', name: '热搜榜', art: '📈', tier: 'event', char: 'claude',
    desc: '每场战斗的第一回合，多抽 2 张牌。',
    flavor: '击败 Grok 的纪念。',
    onCombatStart: (g) => (g.firstTurnDrawBonus += 2),
  },
]);
