import { describe, expect, it } from 'vitest';
import '../src/game/content';
import { Combat as StrictCombat } from '../src/game/combat';
StrictCombat.strict = true;
import { Combat } from '../src/game/combat';
import { Run } from '../src/game/run';
import { makeCard } from '../src/game/cards';
import { ENCOUNTERS } from '../src/game/registry';
import { CHAR_ORDER } from '../src/game/characters';

function fight(enemies: string[], char: 'claude' | 'ironclad' = 'claude') {
  const run = Run.create(char, 11);
  run.screen = { s: 'map' };
  const g = new Combat(run, enemies, { boss: true });
  g.start();
  g.hand = [];
  g.energy = 10;
  g.context = 0;
  return { run, g };
}
const byId = (g: Combat, id: string) => g.enemies.find((e) => e.defId === id)!;

describe('小克专属首领', () => {
  it('小克的三幕首领固定为 Gemini、Grok、OpenAI；其他角色不会遇到', () => {
    const run = Run.create('claude', 3);
    expect(run.boss).toBe('c1_gemini');
    run.startAct(2);
    expect(run.boss).toBe('c2_grok');
    run.startAct(3);
    expect(run.boss).toBe('c3_openai');
    for (const ch of CHAR_ORDER.filter((c) => c !== 'claude')) {
      for (let seed = 1; seed <= 6; seed++) {
        const r = Run.create(ch, seed);
        for (const act of [1, 2, 3]) {
          r.startAct(act);
          expect(ENCOUNTERS[r.boss].char, `${ch} 第 ${act} 幕`).toBeUndefined();
        }
      }
    }
  });

  it('Gemini：双子同心；Flash 偷走上下文；Pro 在你压缩时获得格挡', () => {
    const { g } = fight(['gemini_flash', 'gemini_pro']);
    const flash = byId(g, 'gemini_flash');
    const pro = byId(g, 'gemini_pro');
    g.note(8);
    pro.block = 0;
    g.note(2); // 压缩
    expect(pro.block).toBe(6);
    g.context = 7;
    g.endTurn();
    g.runEnemyPhase();
    // Flash 第一个行动是「快速检索」：偷走 4 点上下文
    expect(g.context).toBe(3);
    pro.hp = 100;
    g.dealDamage(flash, 999, g.player);
    expect(flash.dead).toBe(true);
    expect(pro.hp).toBe(100 + 48);
    expect(g.pw(pro, 'strength')).toBe(3);
  });

  it('Grok：热搜在你的下个回合生效（攻击涨价、工具罢工、刷屏）', () => {
    const { g } = fight(['grok']);
    const grok = byId(g, 'grok');
    grok.mem.trend = 0; // #攻击涨价
    g.endTurn();
    g.runEnemyPhase();
    expect(g.has(g.player, 'trend_attack_tax')).toBe(true);
    const strike = makeCard('strike_c');
    g.hand.push(strike);
    expect(g.costOf(strike)).toBe(2);
    grok.mem.trend = 2; // #工具罢工
    g.endTurn();
    g.runEnemyPhase();
    expect(g.has(g.player, 'trend_attack_tax')).toBe(false);
    const tool = makeCard('code_exec');
    g.hand.push(tool);
    expect(g.canPlay(tool)).toContain('工具罢工');
    grok.mem.trend = 3; // #刷屏
    g.endTurn();
    g.runEnemyPhase();
    expect(g.hand.filter((c) => c.id === 'hot_post').length).toBe(2);
  });

  it('Grok：趣味模式按你本回合打出的牌数造成伤害；半血时召唤分身', () => {
    const { g } = fight(['grok']);
    const grok = byId(g, 'grok');
    grok.move = 'fun';
    g.player.hp = g.player.maxHp = 200;
    for (let i = 0; i < 4; i++) {
      const c = makeCard('defend_c');
      g.hand.push(c);
      g.playCard(c, null);
    }
    g.player.block = 0;
    const hp = g.player.hp;
    g.endTurn();
    g.runEnemyPhase();
    expect(hp - g.player.hp).toBe(12);
    grok.hp = Math.floor(grok.maxHp / 2);
    g.endTurn();
    g.runEnemyPhase();
    g.endTurn();
    g.runEnemyPhase();
    expect(g.enemies.filter((e) => e.defId === 'grok_clone').length).toBe(2);
  });

  it('OpenAI：记住你打得最多的牌（下回合 +1 费）；倒下后以推理模型复活', () => {
    const { g } = fight(['openai']);
    const ai = byId(g, 'openai');
    for (let i = 0; i < 3; i++) {
      const c = makeCard('quick_reply');
      g.hand.push(c);
      g.playCard(c, ai);
    }
    g.endTurn();
    g.runEnemyPhase();
    const q = makeCard('quick_reply');
    g.hand.push(q);
    expect(g.notes.memorized).toBe('quick_reply');
    expect(g.costOf(q)).toBe(1);
    g.dealDamage(ai, 9999, g.player);
    expect(ai.dead).toBe(false);
    g.endTurn();
    g.runEnemyPhase();
    expect(ai.maxHp).toBe(330);
    expect(g.has(ai, 'gpt_memory')).toBe(false);
  });

  it('OpenAI 第二形态：思考时获得格挡，两回合后深度推理；一回合内每失去 40 点生命打断 1 层思考', () => {
    const { g } = fight(['openai']);
    const ai = byId(g, 'openai');
    g.dealDamage(ai, 9999, g.player);
    g.player.hp = g.player.maxHp = 999;
    g.endTurn();
    g.runEnemyPhase(); // 复活
    g.endTurn();
    g.runEnemyPhase(); // 推理链
    g.endTurn();
    g.runEnemyPhase(); // 思考 1
    expect(g.pw(ai, 'reasoning')).toBe(1);
    expect(ai.block).toBeGreaterThanOrEqual(12); // 思考给 12 点格挡（规模定律也可能叠加格挡）
    g.dealDamage(ai, ai.block + 39, g.player); // 先打掉格挡，再失去 39：还不够打断
    expect(g.pw(ai, 'reasoning')).toBe(1);
    g.dealDamage(ai, 1, g.player); // 累计失去 40：打断
    expect(g.pw(ai, 'reasoning')).toBe(0);
    g.endTurn();
    g.runEnemyPhase(); // 思考 2
    expect(g.pw(ai, 'reasoning')).toBe(1);
    expect(ai.move).toBe('deep');
    expect(g.intentDamage(ai)?.dmg).toBe(20 + 15 + g.pw(ai, 'strength')); // 规模定律会叠力量
  });

  it('打赢 Gemini、Grok 后获得纪念遗物', () => {
    const run = Run.create('claude', 5);
    run.screen = { s: 'map' };
    run.startCombat(ENCOUNTERS.c1_gemini, 'boss');
    const g = run.combat!;
    for (const e of g.enemies) g.dealDamage(e, 9999, g.player);
    g.checkEnd();
    expect(g.result).toBe('win');
    run.finishCombat();
    const sc = run.screen as Run['screen'];
    expect(sc.s).toBe('reward');
    if (sc.s === 'reward') expect(sc.rewards.some((r) => r.type === 'relic' && r.id === 'twin_mirror')).toBe(true);
  });

  it('双子之镜：每回合第一次打出工具牌时复制一张', () => {
    const { g, run } = fight(['nibbit']);
    run.relics.push({ id: 'twin_mirror', counter: 0 });
    const t = makeCard('text_edit');
    g.hand.push(t);
    g.playCard(t, null);
    expect(g.hand.map((c) => c.id)).toEqual(['text_edit']);
    const t2 = g.hand[0];
    g.playCard(t2, null);
    expect(g.hand.length).toBe(0);
  });
});
