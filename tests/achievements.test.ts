import { describe, expect, it } from 'vitest';
import '../src/game/content';
import { Combat } from '../src/game/combat';
import { Run } from '../src/game/run';
import { makeCard } from '../src/game/cards';
import { ACHIEVEMENTS, ACH_BY_ID, backfill, mergeAch, newAchState, processEvent } from '../src/game/achievements';
import { loginEmail, isUsernameEmail, USERNAME_DOMAIN } from '../src/cloud/sync';

function fight(enemies: string[], opts: { boss?: boolean; elite?: boolean } = {}, char: Parameters<typeof Run.create>[0] = 'ironclad') {
  const run = Run.create(char, 7);
  run.screen = { s: 'map' };
  const g = new Combat(run, enemies, opts);
  g.start();
  return { run, g };
}

function winFight(g: Combat) {
  for (const e of g.enemies) g.dealDamage(e, 9999, g.player, 'hploss');
  g.checkEnd();
  expect(g.result).toBe('win');
}

describe('成就', () => {
  it('定义完整：id 唯一，计数类都有目标', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) if (a.progress) expect(a.goal, a.id).toBeGreaterThan(0);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(30);
  });

  it('第一场胜利、击败数、见过的怪物', () => {
    const s = newAchState();
    const { run, g } = fight(['nibbit', 'inklet']);
    winFight(g);
    const got = processEvent(s, { t: 'combat', g, run, win: true });
    expect(got).toContain('first_blood');
    expect(s.counters.kills).toBe(2);
    expect(s.seen.sort()).toEqual(['inklet', 'nibbit']);
    // 同一个成就不会重复解锁
    expect(processEvent(s, { t: 'combat', g, run, win: true })).not.toContain('first_blood');
  });

  it('一次攻击 50 点以上伤害、一回合 10 张牌', () => {
    const s = newAchState();
    const { run, g } = fight(['nibbit']);
    g.enemies[0].hp = g.enemies[0].maxHp = 2000;
    g.apply(g.player, 'strength', 50);
    g.energy = 99;
    for (let i = 0; i < 10; i++) {
      const c = makeCard('strike_r');
      g.hand.push(c);
      g.playCard(c, g.enemies[0]);
    }
    expect(g.best.hit).toBeGreaterThanOrEqual(56);
    expect(g.best.turnCards).toBe(10);
    expect(g.best.turnDmg).toBeGreaterThanOrEqual(100);
    winFight(g);
    const got = processEvent(s, { t: 'combat', g, run, win: true });
    expect(got).toEqual(expect.arrayContaining(['big_hit', 'combo', 'storm']));
    expect(got).not.toContain('huge_hit');
  });

  it('毫发无伤击败第一幕首领；在两条路线上都打过第一幕', () => {
    const s = newAchState();
    const a = fight(['ceremonial_beast'], { boss: true });
    winFight(a.g);
    expect(processEvent(s, { t: 'combat', g: a.g, run: a.run, win: true })).toEqual(expect.arrayContaining(['act1', 'flawless_boss']));
    const b = fight(['soul_fysh'], { boss: true });
    b.run.zone = 'underdocks';
    b.g.player.hp -= 5;
    b.g.total.hpLost = 5;
    winFight(b.g);
    const got = processEvent(s, { t: 'combat', g: b.g, run: b.run, win: true });
    expect(got).toContain('both_roads');
    expect(got).not.toContain('flawless_boss');
  });

  it('小克击败专属首领', () => {
    const s = newAchState();
    const { run, g } = fight(['gemini_flash', 'gemini_pro'], { boss: true }, 'claude');
    winFight(g);
    expect(processEvent(s, { t: 'combat', g, run, win: true })).toContain('beat_gemini');
  });

  it('攀登结束：登顶、角色成就、进阶、精简牌组；六名角色都登顶', () => {
    const s = newAchState();
    const run = Run.create('silent', 3, 5);
    const got = processEvent(s, { t: 'runEnd', run, win: true });
    expect(got).toEqual(expect.arrayContaining(['summit', 'win_silent', 'asc5', 'lean']));
    expect(got).not.toContain('asc10');
    for (const c of ['ironclad', 'regent', 'necrobinder', 'defect', 'claude'] as const) processEvent(s, { t: 'runEnd', run: Run.create(c, 3), win: true });
    expect(s.unlocked.all_chars).toBeTruthy();
    expect(s.counters.runs).toBe(6);
  });

  it('隐藏成就：第一幕前三层倒下', () => {
    const s = newAchState();
    const run = Run.create('ironclad', 3);
    run.floor = 2;
    expect(processEvent(s, { t: 'runEnd', run, win: false })).toContain('early_fall');
    expect(ACH_BY_ID.early_fall.hidden).toBe(true);
  });

  it('即时状态：金币、遗物、牌组', () => {
    const s = newAchState();
    const run = Run.create('ironclad', 3);
    run.gold = 520;
    while (run.deck.length < 50) run.deck.push(makeCard('strike_r'));
    const got = processEvent(s, { t: 'tick', run });
    expect(got).toEqual(expect.arrayContaining(['rich', 'big_deck']));
    expect(got).not.toContain('hoarder');
  });

  it('合并：解锁取并集并保留较早时间，计数取较大值，见过的怪物合并', () => {
    const a = { unlocked: { summit: 200, act1: 50 }, counters: { kills: 30 }, seen: ['nibbit'] };
    const b = { unlocked: { summit: 100, rich: 300, bogus: 5 }, counters: { kills: 12, potions: 4 }, seen: ['inklet', 'nibbit'] };
    const m = mergeAch(a, b);
    expect(m.unlocked).toEqual({ summit: 100, act1: 50, rich: 300 });
    expect(m.counters).toEqual({ kills: 30, potions: 4 });
    expect(m.seen.sort()).toEqual(['inklet', 'nibbit']);
  });

  it('老存档补发：有过登顶的角色', () => {
    const s = newAchState();
    backfill(s, { wins: 2, runs: 12, maxAsc: { ironclad: 6, defect: 1 } });
    expect(Object.keys(s.unlocked)).toEqual(expect.arrayContaining(['summit', 'win_ironclad', 'win_defect', 'asc5', 'runs_10']));
    expect(s.unlocked.win_silent).toBeUndefined();
  });
});

describe('用户名登录', () => {
  it('用户名映射到内部邮箱，邮箱原样保留', () => {
    expect(loginEmail('Admin')).toBe(`admin@${USERNAME_DOMAIN}`);
    expect(loginEmail('  me@example.com ')).toBe('me@example.com');
    expect(isUsernameEmail(`admin@${USERNAME_DOMAIN}`)).toBe(true);
    expect(isUsernameEmail('me@example.com')).toBe(false);
    expect(() => loginEmail('ab')).toThrow();
    expect(() => loginEmail('有中文')).toThrow();
  });
});
