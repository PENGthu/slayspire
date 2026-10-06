import { defineCards } from '../../registry';
import { cardDef, uv } from '../../cards';
import { B, M, N, hit, hitAll, hitRandom } from './helpers';

const C = 'claude' as const;

/** Claude：思考 · 上下文 · 工具 */
defineCards([
  // ---------------------------------------------------------------- 基础
  {
    id: 'strike_c', name: '打击', color: C, type: 'attack', rarity: 'basic', cost: 1, target: 'enemy',
    dmg: [6, 9], text: '造成 {D} 点伤害。', art: '⚔️', tags: ['strike', 'starter'],
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'defend_c', name: '防御', color: C, type: 'skill', rarity: 'basic', cost: 1, target: 'self',
    blk: [5, 8], text: '获得 {B} 点格挡。', art: '🛡️', tags: ['starter'],
    play: (g, c) => g.block(B(g, c)),
  },
  {
    id: 'ponder', name: '深思', color: C, type: 'skill', rarity: 'basic', cost: 0, target: 'self',
    mag: [3, 4], mag2: [2, 3], text: '思考 {M}。\n记录 {N}。', art: '💭',
    play: (g, c) => g.think(M(c), () => g.note(N(c))),
  },
  {
    id: 'tool_use', name: '调用工具', color: C, type: 'skill', rarity: 'basic', cost: 1, target: 'self',
    text: ['将 2 张随机工具牌加入手牌。', '将 2 张随机的升级工具牌加入手牌。'], art: '🧰',
    play: (g, c) => g.addTools(2, c.up),
  },
  // ---------------------------------------------------------------- 特殊：工具与摘要
  {
    id: 'web_search', name: '网页搜索', color: C, type: 'skill', rarity: 'special', cost: 0, target: 'self',
    mag: [2, 3], exhaust: true, noPool: true, tags: ['tool'], text: '思考 {M}。\n抽 1 张牌。', art: '🔎',
    play: (g, c) => g.think(M(c), () => g.draw(1)),
  },
  {
    id: 'code_exec', name: '代码执行', color: C, type: 'attack', rarity: 'special', cost: 0, target: 'enemy',
    dmg: [5, 8], exhaust: true, noPool: true, tags: ['tool'], text: '造成 {D} 点伤害。', art: '💻',
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'text_edit', name: '文本编辑', color: C, type: 'skill', rarity: 'special', cost: 0, target: 'self',
    blk: [5, 8], exhaust: true, noPool: true, tags: ['tool'], text: '获得 {B} 点格挡。', art: '📝',
    play: (g, c) => g.block(B(g, c)),
  },
  {
    id: 'memory_tool', name: '记忆', color: C, type: 'skill', rarity: 'special', cost: 0, target: 'self',
    mag: [3, 5], exhaust: true, noPool: true, tags: ['tool'], text: '记录 {M}。', art: '🗂️',
    play: (g, c) => g.note(M(c)),
  },
  {
    id: 'summary', name: '摘要', color: C, type: 'skill', rarity: 'special', cost: 0, target: 'self',
    mag: [2, 3], retain: true, exhaust: true, noPool: true, text: '获得 1 点能量。\n抽 {M} 张牌。', art: '📄',
    play: (g, c) => {
      g.gainEnergy(1);
      g.draw(M(c));
    },
  },
  // ---------------------------------------------------------------- 普通
  {
    id: 'citation', name: '引用', color: C, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [8, 11], mag: [2, 3], text: '造成 {D} 点伤害。\n记录 {M}。', art: '📖',
    play: (g, c, t) => {
      hit(g, c, t);
      g.note(M(c));
    },
  },
  {
    id: 'quick_reply', name: '快速回复', color: C, type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
    dmg: [4, 6], text: '造成 {D} 点伤害。\n记录 1。', art: '💬',
    play: (g, c, t) => {
      hit(g, c, t);
      g.note(1);
    },
  },
  {
    id: 'step_by_step', name: '逐步推理', color: C, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [3, 4], text: '造成 {D} 点伤害 3 次。', art: '🪜',
    play: (g, c, t) => hit(g, c, t, 3),
  },
  {
    id: 'clarify', name: '澄清问题', color: C, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    blk: [7, 10], text: '获得 {B} 点格挡。\n思考 2。', art: '❓',
    play: (g, c) => {
      g.block(B(g, c));
      g.think(2);
    },
  },
  {
    id: 'brainstorm', name: '头脑风暴', color: C, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    mag: [3, 5], text: '思考 {M}。\n抽 2 张牌。', art: '🌩️',
    play: (g, c) => g.think(M(c), () => g.draw(2)),
  },
  {
    id: 'polite_refusal', name: '礼貌拒绝', color: C, type: 'skill', rarity: 'common', cost: 1, target: 'enemy',
    blk: [6, 9], mag: [1, 2], text: '获得 {B} 点格挡。\n给予 {M} 层虚弱。', art: '🙅',
    play: (g, c, t) => {
      g.block(B(g, c));
      g.apply(t, 'weak', M(c));
    },
  },
  {
    id: 'code_review', name: '代码审查', color: C, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [7, 10], mag: [1, 2], text: '造成 {D} 点伤害。\n给予 {M} 层易伤。', art: '🔬',
    play: (g, c, t) => {
      hit(g, c, t);
      g.apply(t, 'vulnerable', M(c));
    },
  },
  {
    id: 'draft', name: '草稿', color: C, type: 'skill', rarity: 'common', cost: 0, target: 'self',
    mag: [3, 4], retain: true, text: '记录 {M}。', art: '✏️',
    play: (g, c) => g.note(M(c)),
  },
  {
    id: 'read_the_docs', name: '查阅文档', color: C, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    blk: [5, 8], text: '获得 {B} 点格挡。\n将 1 张随机工具牌加入手牌。', art: '📚',
    play: (g, c) => {
      g.block(B(g, c));
      g.addTools(1);
    },
  },
  {
    id: 'function_call', name: '函数调用', color: C, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [6, 9], text: '造成 {D} 点伤害。\n将 1 张代码执行加入手牌。', art: '🧩',
    play: (g, c, t) => {
      hit(g, c, t);
      g.addToHand('code_exec', c.up);
    },
  },
  {
    id: 'long_answer', name: '长文回答', color: C, type: 'attack', rarity: 'common', cost: 2, target: 'enemy',
    dmg: [10, 13], text: ['造成 {D} 点伤害。\n（10 点，每有 1 点上下文再 +1）', '造成 {D} 点伤害。\n（13 点，每有 1 点上下文再 +1）'], art: '📜',
    dmgFn: (g, c) => (c.up ? 13 : 10) + (g?.context ?? 0),
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'self_correct', name: '自我纠正', color: C, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    blk: [6, 9], text: '获得 {B} 点格挡。\n从弃牌堆选择 1 张牌，放到抽牌堆顶部。', art: '↩️',
    play: (g, c) => {
      g.block(B(g, c));
      g.chooseCards({ title: '选择 1 张牌放到抽牌堆顶部', cards: [...g.discardPile], min: 1, max: 1 }, (s) => {
        if (s[0]) g.moveTo(s[0], 'drawTop');
      });
    },
  },
  {
    id: 'one_to_many', name: '一问多答', color: C, type: 'attack', rarity: 'common', cost: 1, target: 'all',
    dmg: [7, 10], text: '对所有敌人造成 {D} 点伤害。', art: '📣',
    play: (g, c) => hitAll(g, c),
  },
  {
    id: 'active_listening', name: '耐心倾听', color: C, type: 'skill', rarity: 'common', cost: 1, target: 'self',
    blk: [5, 8], mag: [2, 3], text: '获得 {B} 点格挡。\n记录 {M}。', art: '👂',
    play: (g, c) => {
      g.block(B(g, c));
      g.note(M(c));
    },
  },
  {
    id: 'rebuttal', name: '反驳', color: C, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [7, 9], mag: [4, 6], text: '造成 {D} 点伤害。\n若目标意图攻击，获得 {M} 点格挡。', art: '☝️',
    play: (g, c, t) => {
      const attacking = !!t && g.isAttacking(t);
      hit(g, c, t);
      if (attacking) g.block(M(c));
    },
  },
  {
    id: 'shorthand', name: '速记', color: C, type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    dmg: [6, 9], text: '造成 {D} 点伤害。\n思考 2。', art: '🖋️',
    play: (g, c, t) => {
      hit(g, c, t);
      g.think(2);
    },
  },
  // ---------------------------------------------------------------- 罕见
  {
    id: 'parallel_calls', name: '并行调用', color: C, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [3, 4], text: '将 {M} 张随机工具牌加入手牌。', art: '🔀',
    play: (g, c) => g.addTools(M(c)),
  },
  {
    id: 'closing_argument', name: '总结陈词', color: C, type: 'attack', rarity: 'uncommon', cost: 1, target: 'all',
    dmg: [3, 4], text: '花费所有上下文。\n每花费 1 点，对随机敌人造成 {D} 点伤害。', art: '🎤',
    play: (g, c) => hitRandom(g, c, g.spendContext()),
  },
  {
    id: 'extended_thinking', name: '扩展思考', color: C, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [3, 4], text: '回合开始时，思考 {M}。', art: '🧠',
    play: (g, c) => g.apply(g.player, 'extended_thinking', M(c)),
  },
  {
    id: 'chain_of_thought', name: '链式思考', color: C, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [3, 4], text: '每当你思考，获得 {M} 点格挡。', art: '🔗',
    play: (g, c) => g.apply(g.player, 'chain_of_thought', M(c)),
  },
  {
    id: 'prompt_caching', name: '提示缓存', color: C, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [3, 4], text: '每当你压缩时，记录 {M}。', art: '🗄️',
    play: (g, c) => g.apply(g.player, 'prompt_caching', M(c)),
  },
  {
    id: 'subagent', name: '子代理', color: C, type: 'power', rarity: 'uncommon', cost: [2, 1], target: 'self',
    text: '回合开始时，将 1 张随机工具牌加入手牌。', art: '🤖',
    play: (g) => g.apply(g.player, 'subagent', 1),
  },
  {
    id: 'prompt_engineering', name: '提示工程', color: C, type: 'skill', rarity: 'uncommon', cost: 0, target: 'self',
    mag: [5, 8], text: '获得 {M} 点活力。\n记录 1。', art: '🎛️',
    play: (g, c) => {
      g.apply(g.player, 'vigor', M(c));
      g.note(1);
    },
  },
  {
    id: 'follow_up', name: '追问', color: C, type: 'skill', rarity: 'uncommon', cost: 1, target: 'all',
    mag: [1, 2], text: '给予所有敌人 {M} 层虚弱。\n思考 3。', art: '🗨️',
    play: (g, c) => {
      for (const e of g.alive) g.apply(e, 'weak', M(c));
      g.think(3);
    },
  },
  {
    id: 'red_teaming', name: '红队测试', color: C, type: 'skill', rarity: 'uncommon', cost: 1, target: 'all',
    mag: [1, 2], text: '给予所有敌人 {M} 层易伤。\n抽 1 张牌。', art: '🎯',
    play: (g, c) => {
      for (const e of g.alive) g.apply(e, 'vulnerable', M(c));
      g.draw(1);
    },
  },
  {
    id: 'structured_output', name: '结构化输出', color: C, type: 'skill', rarity: 'uncommon', cost: 2, target: 'self',
    blk: [12, 16], text: '获得 {B} 点格挡。\n记录 3。', art: '🧱',
    play: (g, c) => {
      g.block(B(g, c));
      g.note(3);
    },
  },
  {
    id: 'eureka', name: '灵光', color: C, type: 'attack', rarity: 'uncommon', cost: 0, target: 'enemy',
    dmg: [4, 6], tags: ['thinkReturn'], text: '造成 {D} 点伤害。\n每当你思考时，若这张牌在弃牌堆中，将其放回手牌。', art: '💡',
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'memo', name: '备忘录', color: C, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [1, 2], text: '回合结束时，可以保留至多 {M} 张牌。', art: '🗒️',
    play: (g, c) => g.apply(g.player, 'well_laid_plans', M(c)),
  },
  {
    id: 'tool_chain', name: '工具链', color: C, type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    dmg: [5, 7], mag: [2, 3],
    text: ['造成 {D} 点伤害。\n（5 点，本场战斗中每打出过 1 张工具牌再 +{M}）', '造成 {D} 点伤害。\n（7 点，本场战斗中每打出过 1 张工具牌再 +{M}）'], art: '⛓️',
    dmgFn: (g, c) => (c.up ? 7 : 5) + (g?.total.tools ?? 0) * (uv(cardDef(c).mag, c.up) ?? 0),
    play: (g, c, t) => hit(g, c, t),
  },
  {
    id: 'creative_writing', name: '创意写作', color: C, type: 'skill', rarity: 'uncommon', cost: 1, target: 'self',
    exhaust: [true, false], text: '从 3 张随机 Claude 牌中选择 1 张加入手牌，它本回合费用为 0。', art: '🪶',
    play: (g) => {
      const opts = g.randomCards(3, () => true);
      g.discover(opts, (x) => {
        x.costTurn = 0;
        g.addToHand(x);
      });
    },
  },
  {
    id: 'deep_research', name: '深度研究', color: C, type: 'skill', rarity: 'uncommon', cost: 2, target: 'self',
    mag: [3, 4], text: '思考 5。\n抽 {M} 张牌。', art: '🔭',
    play: (g, c) => g.think(5, () => g.draw(M(c))),
  },
  {
    id: 'memory_consolidation', name: '记忆整理', color: C, type: 'power', rarity: 'uncommon', cost: 1, target: 'self',
    mag: [6, 9], text: '每当你压缩时，获得 {M} 点格挡。', art: '🗃️',
    play: (g, c) => g.apply(g.player, 'memory_consolidation', M(c)),
  },
  {
    id: 'batch_processing', name: '批量处理', color: C, type: 'attack', rarity: 'uncommon', cost: 1, target: 'all',
    dmg: [4, 6], text: '对所有敌人造成 {D} 点伤害 2 次。', art: '📦',
    play: (g, c) => hitAll(g, c, 2),
  },
  {
    id: 'guardrails', name: '安全护栏', color: C, type: 'skill', rarity: 'uncommon', cost: 2, target: 'self',
    blk: [10, 13], exhaust: true, text: '获得 {B} 点格挡。\n获得 1 层缓冲。', art: '🚧',
    play: (g, c) => {
      g.block(B(g, c));
      g.apply(g.player, 'buffer', 1);
    },
  },
  // ---------------------------------------------------------------- 稀有
  {
    id: 'million_context', name: '百万上下文', color: C, type: 'power', rarity: 'rare', cost: [2, 1], target: 'self',
    mag: 3, text: '上下文窗口 +10。\n回合开始时，记录 {M}。', art: '🌌',
    play: (g, c) => {
      g.resizeContext(10);
      g.apply(g.player, 'million_context', M(c));
    },
  },
  {
    id: 'constitution', name: '宪法', color: C, type: 'power', rarity: 'rare', cost: 3, target: 'self',
    mag: [4, 7], text: '回合开始时，获得 {M} 点格挡，抽 1 张牌，并给予所有敌人 1 层虚弱。', art: '📜',
    play: (g, c) => g.apply(g.player, 'constitution', M(c)),
  },
  {
    id: 'agentic_loop', name: '智能体循环', color: C, type: 'power', rarity: 'rare', cost: [2, 1], target: 'self',
    text: '你打出的工具牌会额外打出 1 次。', art: '🔁',
    play: (g) => g.apply(g.player, 'agentic_loop', 1),
  },
  {
    id: 'epiphany', name: '顿悟', color: C, type: 'skill', rarity: 'rare', cost: 1, target: 'self',
    mag: [1, 2], exhaust: true, text: '压缩 {M} 次。', art: '🌟',
    play: (g, c) => {
      for (let i = 0; i < M(c); i++) g.compact();
    },
  },
  {
    id: 'retrieval', name: '检索增强', color: C, type: 'skill', rarity: 'rare', cost: 0, target: 'self',
    mag: [1, 2], exhaust: true, text: '从抽牌堆中选择 {M} 张牌放入手牌。', art: '🧲',
    play: (g, c) => {
      g.chooseCards({ title: `选择 ${M(c)} 张牌放入手牌`, cards: [...g.drawPile].reverse(), min: M(c), max: M(c) }, (s) => {
        for (const x of s) g.moveTo(x, 'hand');
      });
    },
  },
  {
    id: 'final_answer', name: '最终回答', color: C, type: 'attack', rarity: 'rare', cost: 2, target: 'enemy',
    dmg: [14, 20],
    text: ['造成 {D} 点伤害，然后花费所有上下文。\n（14 点，每有 1 点上下文再 +3）', '造成 {D} 点伤害，然后花费所有上下文。\n（20 点，每有 1 点上下文再 +3）'], art: '🏁',
    dmgFn: (g, c) => (c.up ? 20 : 14) + (g?.context ?? 0) * 3,
    play: (g, c, t) => {
      hit(g, c, t);
      g.spendContext();
    },
  },
  {
    id: 'emergence', name: '涌现', color: C, type: 'power', rarity: 'rare', cost: [2, 1], target: 'self',
    text: '每当你压缩时，获得 1 点力量和 1 点敏捷。', art: '🦋',
    play: (g) => g.apply(g.player, 'emergence', 1),
  },
  {
    id: 'pair_programming', name: '结对编程', color: C, type: 'power', rarity: 'rare', cost: 3, target: 'self',
    ethereal: [true, false], text: '每回合你打出的第一张牌会被打出两次。', art: '👥',
    play: (g) => g.apply(g.player, 'echo_form', 1),
  },
  {
    id: 'self_reflection', name: '自我反思', color: C, type: 'power', rarity: 'rare', cost: [1, 0], target: 'self',
    text: '每当你压缩时，升级手牌中的所有牌（本场战斗）。', art: '🪞',
    play: (g) => g.apply(g.player, 'self_reflection', 1),
  },
  {
    id: 'multi_agent', name: '多智能体', color: C, type: 'attack', rarity: 'rare', cost: 2, target: 'enemy',
    dmg: [6, 8], text: '造成 {D} 点伤害 2 次。\n本场战斗中你每压缩过 1 次，再多造成 1 次。', art: '🕸️',
    play: (g, c, t) => hit(g, c, t, 2 + g.compacts),
  },
]);
