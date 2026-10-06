import { describe, expect, it } from 'vitest';
import '../src/game/content';
import { Combat as StrictCombat } from '../src/game/combat';
StrictCombat.strict = true;
import { Combat, TOOL_IDS } from '../src/game/combat';
import { Run } from '../src/game/run';
import { makeCard } from '../src/game/cards';
import { CARDS } from '../src/game/registry';
import { resolvePending } from '../src/game/bot';
import { Rng } from '../src/core/rng';

type Ch = 'claude' | 'regent' | 'necrobinder' | 'ironclad';

function setup(ch: Ch, enemies = ['nibbit'], opts: { elite?: boolean; boss?: boolean } = {}) {
  const run = Run.create(ch, 99);
  run.screen = { s: 'map' };
  const g = new Combat(run, enemies, opts);
  g.start();
  resolvePending(g, new Rng(1));
  g.hand = [];
  g.energy = 10;
  for (const e of g.enemies) e.hp = e.maxHp = 500;
  return { run, g, e: g.enemies[0] };
}

function play(g: Combat, id: string, target = g.enemies[0], up = false) {
  const c = makeCard(id, up);
  g.hand.push(c);
  const ok = g.playCard(c, target);
  expect(ok, `${id} 应能打出`).toBe(true);
  return c;
}

/** 结束回合并跑完敌方回合，回到玩家的下一回合 */
function nextTurn(g: Combat) {
  g.endTurn();
  g.runEnemyPhase();
  resolvePending(g, new Rng(2));
}

const lost = (e: { hp: number; maxHp: number }) => e.maxHp - e.hp;

describe('卡池规模', () => {
  it('Claude、储君、亡灵契约师各有 70 张以上可获得的牌', () => {
    for (const ch of ['claude', 'regent', 'necrobinder']) {
      const n = Object.values(CARDS).filter((d) => d.color === ch && ['common', 'uncommon', 'rare'].includes(d.rarity) && !d.noPool).length;
      expect(n, ch).toBeGreaterThanOrEqual(70);
    }
  });
});

describe('Claude：扩充卡牌', () => {
  it('思维树：每弃掉 1 张牌多造成 1 次伤害', () => {
    const { g, e } = setup('claude');
    play(g, 'tree_of_thoughts');
    const p = g.pending!;
    expect(p.cards.length).toBe(3);
    p.resolve(p.cards.slice(0, 2));
    expect(lost(e)).toBe(6 * 3);
  });

  it('缓存命中：只有每回合第一张工具牌给能量', () => {
    const { g } = setup('claude');
    play(g, 'cache_hit');
    g.energy = 5;
    play(g, 'text_edit');
    expect(g.energy).toBe(6);
    play(g, 'text_edit');
    expect(g.energy).toBe(6);
  });

  it('前沿模型：每压缩过 1 次费用 -1，最低为 0', () => {
    const { g } = setup('claude');
    const c = makeCard('frontier_model');
    expect(g.costOf(c)).toBe(4);
    g.compacts = 3;
    expect(g.costOf(c)).toBe(1);
    g.compacts = 9;
    expect(g.costOf(c)).toBe(0);
  });

  it('智能体编排：加入工具牌，本回合工具牌打出两次，回合结束失效', () => {
    const { g, e } = setup('claude');
    play(g, 'orchestrator');
    expect(g.hand.filter((c) => (TOOL_IDS as readonly string[]).includes(c.id)).length).toBe(3);
    const before = lost(e);
    play(g, 'code_exec');
    expect(lost(e) - before).toBe(10);
    nextTurn(g);
    expect(g.has(g.player, 'orchestrate')).toBe(false);
  });

  it('多头注意力：每次记录额外记录 1', () => {
    const { g } = setup('claude');
    play(g, 'multi_head_attention');
    g.context = 0;
    g.note(1);
    expect(g.context).toBe(2);
  });

  it('慢思考：思考时每弃掉 1 张抽 1 张', () => {
    const { g } = setup('claude');
    play(g, 'slow_thinking');
    g.hand = [];
    g.think(3);
    const p = g.pending!;
    p.resolve(p.cards.slice(0, 2));
    expect(g.hand.length).toBe(2);
  });
});

describe('储君：扩充卡牌', () => {
  it('砺刃：铸造并让君王之刃本回合费用 -1，下回合恢复', () => {
    const { g } = setup('regent');
    const f0 = g.forged;
    play(g, 'hone_blade');
    expect(g.forged).toBe(f0 + 3);
    const blade = g.hand.find((c) => c.id === 'sovereign_blade')!;
    expect(blade).toBeTruthy();
    expect(g.costOf(blade)).toBe(1);
    nextTurn(g);
    expect(g.hand).toContain(blade);
    expect(g.costOf(blade)).toBe(2);
  });

  it('王冠宝石：每回合只有第一次花费星辰时抽牌', () => {
    const { g } = setup('regent');
    play(g, 'crown_jewels');
    g.stars = 5;
    play(g, 'radiance'); // 星辰 1：抽 2，加上宝石 1
    expect(g.hand.length).toBe(3);
    play(g, 'radiance');
    expect(g.hand.length).toBe(5);
  });

  it('星辰坍缩：X 加上花费的星辰数为攻击次数', () => {
    const { g, e } = setup('regent');
    g.energy = 3;
    g.stars = 2;
    play(g, 'stellar_collapse');
    expect(g.stars).toBe(0);
    expect(lost(e)).toBe(6 * 5);
  });

  it('永恒统治：每回合补足 1 层双子星，不会越攒越多', () => {
    const { g } = setup('regent');
    play(g, 'eternal_reign');
    nextTurn(g);
    expect(g.pw(g.player, 'twin_stars')).toBe(1);
    nextTurn(g);
    expect(g.pw(g.player, 'twin_stars')).toBe(1);
  });

  it('杰作：铸造值翻倍，至少铸造 5', () => {
    const { g } = setup('regent');
    g.forged = 7;
    play(g, 'masterwork');
    expect(g.forged).toBe(14);
    const b = setup('regent').g;
    b.forged = 0;
    play(b, 'masterwork');
    expect(b.forged).toBe(5);
  });

  it('王家狩猎：精英战伤害翻倍', () => {
    const a = setup('regent');
    play(a.g, 'royal_hunt');
    expect(lost(a.e)).toBe(12);
    const b = setup('regent', ['nibbit'], { elite: true });
    play(b.g, 'royal_hunt');
    expect(lost(b.e)).toBe(24);
  });

  it('废黜：先移除目标格挡', () => {
    const { g, e } = setup('regent');
    e.block = 20;
    play(g, 'dethrone');
    expect(lost(e)).toBe(16);
  });

  it('群星坠落：攻击次数等于星辰数且不花费星辰', () => {
    const { g, e } = setup('regent');
    g.stars = 4;
    play(g, 'shooting_stars');
    expect(lost(e)).toBe(3 * 4);
    expect(g.stars).toBe(4);
  });

  it('天球仪：回合开始时多抽 1 张并获得 1 颗星辰', () => {
    const a = setup('regent');
    play(a.g, 'celestial_globe');
    const b = setup('regent');
    a.g.stars = b.g.stars = 0;
    // 开局清空了手牌，补足抽牌堆，确保多抽的那张有牌可抽
    for (const x of [a.g, b.g]) for (let i = 0; i < 6; i++) x.drawPile.push(makeCard('strike_o'));
    nextTurn(a.g);
    nextTurn(b.g);
    expect(a.g.hand.length).toBe(b.g.hand.length + 1);
    expect(a.g.stars).toBe(b.g.stars + 1);
  });
});

describe('亡灵契约师：扩充卡牌', () => {
  it('骨髓灌注：奥斯提获得力量，奥斯提攻击随之提高', () => {
    const { g, e } = setup('necrobinder');
    g.summon(10);
    play(g, 'marrow_infusion');
    play(g, 'bone_claw');
    expect(lost(e)).toBe(12);
  });

  it('剔除：灾厄不低于剩余生命时立即击杀', () => {
    const a = setup('necrobinder', ['nibbit', 'nibbit']);
    a.e.hp = 30;
    a.g.apply(a.e, 'doom', 25);
    play(a.g, 'cull');
    expect(a.e.dead).toBe(true);
    const b = setup('necrobinder', ['nibbit', 'nibbit']);
    b.e.hp = 30;
    b.g.apply(b.e, 'doom', 10);
    play(b.g, 'cull');
    expect(b.e.dead).toBe(false);
  });

  it('传染：其他敌人获得与目标等量的灾厄', () => {
    const { g } = setup('necrobinder', ['nibbit', 'nibbit']);
    const [a, b] = g.enemies;
    g.apply(a, 'doom', 8);
    play(g, 'contagion', a);
    expect(g.pw(b, 'doom')).toBe(8);
    expect(g.pw(a, 'doom')).toBe(8);
  });

  it('坏死之触：给予等同于失去生命值的灾厄（格挡吸收的部分不算）', () => {
    const { g, e } = setup('necrobinder');
    e.block = 3;
    play(g, 'necrotic_touch');
    expect(g.pw(e, 'doom')).toBe(4);
  });

  it('掘尸：把消耗堆中的灵魂洗回抽牌堆', () => {
    const { g } = setup('necrobinder');
    g.exhaustPile.push(makeCard('soul'), makeCard('soul'));
    play(g, 'disinter');
    expect(g.exhaustPile.filter((c) => c.id === 'soul').length).toBe(0);
    expect(g.drawPile.filter((c) => c.id === 'soul').length).toBe(2);
    expect(g.exhaustPile.map((c) => c.id)).toEqual(['disinter']);
  });

  it('永夜：回合结束时敌人的灾厄增加一半', () => {
    const { g, e } = setup('necrobinder');
    play(g, 'eternal_night');
    g.apply(e, 'doom', 10);
    g.endTurn();
    expect(g.pw(e, 'doom')).toBe(15);
  });

  it('命匣：奥斯提死亡时获得灵魂', () => {
    const { g } = setup('necrobinder');
    g.summon(5);
    play(g, 'phylactery');
    g.killOsty();
    expect(g.hand.filter((c) => c.id === 'soul').length).toBe(2);
  });

  it('万人坑：每击杀 1 名敌人召唤', () => {
    const { g } = setup('necrobinder', ['nibbit', 'nibbit', 'nibbit']);
    g.enemies[0].hp = 5;
    g.enemies[1].hp = 5;
    g.summon(5);
    const hp = g.osty!.hp;
    play(g, 'mass_grave');
    expect(g.osty!.hp).toBe(hp + 10);
  });

  it('死神降临：攻击后处决灾厄足够的敌人', () => {
    const { g } = setup('necrobinder', ['nibbit', 'nibbit']);
    const [a, b] = g.enemies;
    a.hp = 40;
    g.apply(a, 'doom', 30);
    play(g, 'grim_reaper');
    expect(a.dead).toBe(true);
    expect(b.dead).toBe(false);
  });
});

describe('修正', () => {
  it('发掘：从消耗堆取回的牌不会同时留在消耗堆', () => {
    const { g } = setup('ironclad');
    const x = makeCard('bash');
    g.exhaustPile.push(x);
    play(g, 'exhume');
    g.pending?.resolve([x]);
    expect(g.hand).toContain(x);
    expect(g.exhaustPile).not.toContain(x);
  });
});
