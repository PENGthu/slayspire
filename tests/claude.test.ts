import { describe, expect, it } from 'vitest';
import '../src/game/content';
import { Combat as StrictCombat } from '../src/game/combat';
StrictCombat.strict = true;
import { Combat, TOOL_IDS } from '../src/game/combat';
import { Run } from '../src/game/run';
import { cardDef, makeCard } from '../src/game/cards';
import { RELICS } from '../src/game/registry';

function setup(enemies = ['nibbit']) {
  const run = Run.create('claude', 99);
  run.screen = { s: 'map' };
  const g = new Combat(run, enemies);
  g.start();
  g.hand = [];
  g.energy = 10;
  g.context = 0;
  return { run, g, e: g.enemies[0] };
}

function play(g: Combat, id: string, target = g.enemies[0], up = false) {
  const c = makeCard(id, up);
  g.hand.push(c);
  const ok = g.playCard(c, target);
  expect(ok, `${id} 应能打出`).toBe(true);
  return c;
}

/** 依次选择思考面板中的牌（按 id） */
function pick(g: Combat, ids: string[]) {
  const p = g.pending;
  expect(p, '应弹出选择面板').toBeTruthy();
  const sel = ids.map((id) => p!.cards.find((c) => c.id === id)!).filter(Boolean);
  p!.resolve(sel);
}

describe('Claude：上下文与压缩', () => {
  it('星火：每打出一张牌记录 1', () => {
    const { g } = setup();
    play(g, 'defend_c');
    play(g, 'defend_c');
    expect(g.context).toBe(2);
  });

  it('上下文达到窗口时压缩：溢出保留，并获得 1 张摘要', () => {
    const { g } = setup();
    g.context = 8;
    play(g, 'draft'); // 记录 3 → 11 → 压缩，剩 1；星火再 +1
    expect(g.compacts).toBe(1);
    expect(g.context).toBe(2);
    expect(g.hand.map((c) => c.id)).toContain('summary');
  });

  it('摘要：获得 1 点能量并抽 2 张牌，保留且打出后消耗', () => {
    const { g } = setup();
    g.energy = 0;
    const before = g.drawPile.length;
    play(g, 'summary');
    expect(g.energy).toBe(1);
    expect(g.drawPile.length).toBe(before - 2);
    expect(g.exhaustPile.map((c) => c.id)).toContain('summary');
    expect(cardDef('summary').retain).toBe(true);
  });

  it('长文回答按打出前的上下文计算伤害（星火在结算后才记录）', () => {
    const { g, e } = setup();
    g.context = 9;
    const hp = e.hp;
    play(g, 'long_answer');
    expect(e.hp).toBe(hp - 19);
    expect(g.compacts).toBe(1);
  });

  it('总结陈词花费所有上下文，每点打 1 下', () => {
    const { g, e } = setup();
    g.context = 5;
    e.hp = e.maxHp = 200;
    play(g, 'closing_argument');
    expect(e.hp).toBe(200 - 15);
    expect(g.context).toBe(1); // 花光后星火再记录 1
  });

  it('最终回答：伤害 14 + 3×上下文，然后清空上下文', () => {
    const { g, e } = setup();
    e.hp = e.maxHp = 200;
    g.context = 6;
    play(g, 'final_answer');
    expect(e.hp).toBe(200 - 32);
    expect(g.context).toBe(1);
  });

  it('提示缓存与燎原之火叠加时，压缩连锁有上限，不会死循环', () => {
    const { g, run } = setup();
    run.relics.push({ id: 'blazing_spark', counter: 0 });
    g.resizeContext(-7); // 窗口 3
    g.apply(g.player, 'prompt_caching', 10);
    g.note(3);
    expect(g.compacts).toBeGreaterThan(0);
    expect(g.compacts).toBeLessThanOrEqual(11);
    expect(g.context).toBeLessThan(g.contextMax);
  });

  it('燎原之火替换星火，上下文窗口 -3', () => {
    const run = Run.create('claude', 5);
    run.obtainRelic('blazing_spark');
    expect(run.hasRelic('the_spark')).toBe(false);
    const g = new Combat(run, ['nibbit']);
    g.start();
    expect(g.contextMax).toBe(7);
    expect(RELICS.blazing_spark.char).toBe('claude');
  });

  it('百万上下文：窗口 +10，回合开始时记录 3', () => {
    const { g } = setup();
    play(g, 'million_context');
    expect(g.contextMax).toBe(20);
    const before = g.context;
    g.endTurn();
    g.runEnemyPhase();
    expect(g.context).toBe(before + 3);
  });

  it('涌现：压缩时获得力量和敏捷；自我反思：压缩时升级手牌', () => {
    const { g } = setup();
    play(g, 'emergence');
    play(g, 'self_reflection');
    g.hand.push(makeCard('strike_c'));
    g.compact();
    expect(g.pw(g.player, 'strength')).toBe(1);
    expect(g.pw(g.player, 'dexterity')).toBe(1);
    expect(g.hand.every((c) => c.up)).toBe(true);
  });

  it('多智能体：每压缩过 1 次多打 1 下', () => {
    const { g, e } = setup();
    e.hp = e.maxHp = 300;
    g.compacts = 2;
    play(g, 'multi_agent');
    expect(e.hp).toBe(300 - 6 * 4);
  });
});

describe('Claude：思考', () => {
  it('思考展示抽牌堆顶部的牌，弃掉选中的，其余留在原位', () => {
    const { g } = setup();
    g.drawPile = ['strike_c', 'defend_c', 'citation', 'draft'].map((id) => makeCard(id));
    play(g, 'ponder'); // 思考 3：draft、citation、defend_c
    expect(g.pending!.cards.map((c) => c.id)).toEqual(['draft', 'citation', 'defend_c']);
    pick(g, ['draft', 'defend_c']);
    expect(g.drawPile.map((c) => c.id)).toEqual(['strike_c', 'citation']);
    expect(g.discardPile.map((c) => c.id)).toEqual(expect.arrayContaining(['draft', 'defend_c']));
    // 深思：思考后记录 2，星火再记录 1
    expect(g.context).toBe(3);
    expect(g.phase).toBe('player');
  });

  it('头脑风暴先思考再抽牌：抽到的是思考后留下的牌', () => {
    const { g } = setup();
    g.drawPile = ['strike_c', 'defend_c', 'citation', 'draft'].map((id) => makeCard(id));
    play(g, 'brainstorm'); // 思考 3
    pick(g, ['draft', 'citation']);
    expect(g.hand.map((c) => c.id).sort()).toEqual(['defend_c', 'strike_c']);
  });

  it('链式思考：每次思考获得格挡（即使抽牌堆为空）', () => {
    const { g } = setup();
    play(g, 'chain_of_thought');
    g.drawPile = [];
    g.discardPile = [];
    play(g, 'ponder');
    expect(g.pending).toBeNull();
    expect(g.player.block).toBe(3);
  });

  it('灵光：思考时从弃牌堆回到手牌', () => {
    const { g } = setup();
    g.discardPile = [makeCard('eureka')];
    g.drawPile = [makeCard('strike_c')];
    play(g, 'ponder');
    pick(g, []);
    expect(g.hand.map((c) => c.id)).toContain('eureka');
  });

  it('扩展思考与小黄鸭在回合开始时依次弹出选择，抽牌在选择之后', () => {
    const { g, run } = setup();
    run.relics.push({ id: 'rubber_duck', counter: 0 });
    play(g, 'extended_thinking');
    g.endTurn();
    g.runEnemyPhase();
    // 第一次选择（扩展思考 3）
    expect(g.pending?.cards.length).toBe(3);
    expect(g.hand.length).toBe(0);
    pick(g, []);
    // 第二次选择（小黄鸭 2）
    expect(g.pending?.cards.length).toBe(2);
    pick(g, []);
    expect(g.pending).toBeNull();
    expect(g.hand.length).toBe(5);
    expect(g.phase).toBe('player');
  });
});

describe('Claude：工具', () => {
  it('调用工具加入 2 张工具牌，工具牌 0 费且打出后消耗', () => {
    const { g } = setup();
    play(g, 'tool_use');
    expect(g.hand.length).toBe(2);
    for (const c of g.hand) {
      expect(TOOL_IDS as readonly string[]).toContain(c.id);
      expect(g.costOf(c)).toBe(0);
    }
    const t = g.hand.find((c) => c.id !== 'web_search') ?? g.hand[0];
    g.playCard(t, g.enemies[0]);
    if (g.pending) g.pending.resolve([]);
    expect(g.exhaustPile).toContain(t);
    expect(g.total.tools).toBe(1);
  });

  it('智能体循环：工具牌额外打出 1 次', () => {
    const { g, e } = setup();
    e.hp = e.maxHp = 100;
    play(g, 'agentic_loop');
    play(g, 'code_exec');
    expect(e.hp).toBe(100 - 10);
  });

  it('工具链：本场战斗每打出过 1 张工具牌伤害 +2', () => {
    const { g, e } = setup();
    e.hp = e.maxHp = 100;
    play(g, 'text_edit');
    play(g, 'memory_tool');
    play(g, 'tool_chain');
    expect(e.hp).toBe(100 - 9);
  });

  it('函数调用会加入一张代码执行', () => {
    const { g } = setup();
    play(g, 'function_call');
    expect(g.hand.map((c) => c.id)).toEqual(['code_exec']);
  });
});
