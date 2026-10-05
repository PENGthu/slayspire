import { Rng } from '../core/rng';
import { cardBlk, cardDef, canUpgrade } from './cards';
import type { Combat } from './combat';
import { POTIONS } from './registry';
import type { Run } from './run';

/** 简单的随机/贪心机器人，用于自动化测试与平衡性模拟 */
export interface BotOpts {
  /** 贪心：优先打出攻击、目标选择生命最低者 */
  smart?: boolean;
  /** 使用药水的几率 */
  potionRate?: number;
}

export function resolvePending(g: Combat, rng: Rng) {
  let guard = 0;
  while (g.pending && guard++ < 50) {
    const p = g.pending;
    const n = rng.int(p.min, p.max);
    p.resolve(rng.sample(p.cards, n));
  }
}

export function resolveSelection(run: Run, rng: Rng) {
  let guard = 0;
  while (run.selection && guard++ < 20) {
    const s = run.selection;
    const n = Math.max(s.min, Math.min(s.max, rng.int(s.min, s.max)));
    run.resolveSelection(rng.sample(s.cards, n));
  }
}

function incomingDamage(g: Combat): number {
  return g.alive.reduce((sum, e) => {
    const i = g.intentDamage(e);
    return sum + (i ? i.dmg * i.hits : 0);
  }, 0);
}

function scoreCard(g: Combat, c: import('./types').Card): number {
  const d = cardDef(c);
  const cost = Math.max(1, g.costOf(c));
  let s = 1;
  if (d.type === 'power') s += g.turn <= 2 ? 14 : 6;
  if (d.type === 'attack') {
    const t = g.alive[0] ?? null;
    s += g.previewDamage(c, t) * 0.9;
  }
  if (d.blk !== undefined || d.blkFn) {
    const need = incomingDamage(g) - g.player.block;
    if (need > 0) s += Math.min(g.previewBlock(cardBlk(g, c)), need) * 1.3;
  }
  if (d.mag !== undefined && /抽/.test(String(d.text))) s += 4;
  if (d.type === 'curse' || d.type === 'status') s -= 5;
  return s / cost;
}

export function botPlayerTurn(g: Combat, rng: Rng, opts: BotOpts = {}) {
  let guard = 0;
  resolvePending(g, rng);
  while (g.phase === 'player' && !g.over && guard++ < 60) {
    // 药水
    if (rng.chance(opts.potionRate ?? 0.08)) {
      const slot = g.run.potions.findIndex((p) => p && !POTIONS[p].onDeath && !POTIONS[p].outOfCombat);
      if (slot >= 0) {
        g.usePotion(slot, rng.pick(g.alive));
        resolvePending(g, rng);
        if (g.over) return;
      }
    }
    const playable = g.hand.filter((c) => g.canPlay(c) === true);
    if (!playable.length) break;
    let c = rng.pick(playable);
    if (opts.smart) {
      playable.sort((a, b) => scoreCard(g, b) - scoreCard(g, a));
      c = playable[0];
    }
    const alive = g.alive;
    let t = g.needsTarget(c) ? rng.pick(alive) : null;
    if (opts.smart && t) {
      const main = alive.filter((e) => !e.minion);
      t = [...(main.length ? main : alive)].sort((a, b) => a.hp - b.hp)[0];
    }
    const before = g.hand.length + g.energy * 100;
    g.playCard(c, t);
    resolvePending(g, rng);
    if (g.hand.length + g.energy * 100 === before && g.hand.includes(c)) break;
  }
  if (!g.over && g.phase === 'player') {
    g.endTurn();
    resolvePending(g, rng);
  }
}

/** 跑完整场战斗；返回回合数 */
export function botCombat(g: Combat, rng: Rng, opts: BotOpts = {}, maxTurns = 80): number {
  while (!g.over && g.turn <= maxTurns) {
    if (g.phase === 'player') botPlayerTurn(g, rng, opts);
    if (g.phase === 'enemy') {
      g.runEnemyPhase();
      resolvePending(g, rng);
    }
    resolvePending(g, rng);
    if (g.phase === 'busy' && !g.pending && !g.over) {
      // 理论上不应出现
      throw new Error(`战斗卡在 busy 状态（回合 ${g.turn}）`);
    }
  }
  return g.turn;
}

/** 机器人完成一整局。godMode 下玩家生命极高，用于遍历全部内容。 */
export function botRun(run: Run, rng: Rng, opts: BotOpts & { godMode?: boolean; maxSteps?: number } = {}) {
  let steps = 0;
  const max = opts.maxSteps ?? 2000;
  while (steps++ < max) {
    resolveSelection(run, rng);
    if (opts.godMode) {
      run.maxHp = Math.max(run.maxHp, 5000);
      run.hp = run.maxHp;
    }
    const sc = run.screen;
    switch (sc.s) {
      case 'ancient':
        if (sc.picked === undefined) run.chooseBlessing(rng.int(0, sc.options.length - 1));
        resolveSelection(run, rng);
        run.leaveAncient();
        break;
      case 'map': {
        if (run.bossReachable) {
          run.enterBoss();
          break;
        }
        const nodes = run.reachable();
        if (!nodes.length) throw new Error('地图上无路可走');
        let n = rng.pick(nodes);
        if (opts.smart) {
          const low = run.hp < run.maxHp * 0.45;
          const pref = nodes.find((x) => (low ? x.kind === 'rest' : x.kind === 'elite' && run.hp > run.maxHp * 0.75));
          const avoid = nodes.filter((x) => !(low && x.kind === 'elite'));
          n = pref ?? (avoid.length ? rng.pick(avoid) : n);
        }
        run.enterNode(n.row, n.col);
        break;
      }
      case 'combat': {
        const g = run.combat;
        if (!g) throw new Error('战斗实例缺失');
        if (opts.godMode) {
          g.player.maxHp = Math.max(g.player.maxHp, 5000);
          g.player.hp = g.player.maxHp;
        }
        botCombat(g, rng, opts, opts.godMode ? 150 : 80);
        if (!g.over) {
          // 拖太久就判定逃跑（仅测试用）
          g.escape();
          if (!g.over) for (const e of g.alive) e.hp = 0, (e.dead = true);
          g.checkEnd();
        }
        run.finishCombat();
        break;
      }
      case 'reward':
        sc.rewards.forEach((r, i) => {
          if (r.type === 'card') {
            if (opts.smart) {
              const order = { rare: 3, uncommon: 2, common: 1 } as Record<string, number>;
              let best = -1;
              let bestScore = 0;
              r.cards.forEach((c, j) => {
                const sc2 = (order[cardDef(c).rarity] ?? 0) + (cardDef(c).type === 'power' ? 0.5 : 0) + rng.next();
                if (sc2 > bestScore) {
                  bestScore = sc2;
                  best = j;
                }
              });
              run.takeReward(i, run.deck.length > 25 && bestScore < 3 ? -1 : best);
            } else run.takeReward(i, rng.chance(0.7) ? rng.int(0, r.cards.length - 1) : -1);
          }
          else run.takeReward(i);
        });
        resolveSelection(run, rng);
        run.leaveRewards();
        break;
      case 'shop': {
        for (let i = 0; i < 4; i++) {
          const items = sc.shop.items.map((it, idx) => ({ it, idx })).filter(({ it }) => !it.sold && it.price <= run.gold);
          if (!items.length) break;
          run.buy(rng.pick(items).idx);
          resolveSelection(run, rng);
        }
        if (!sc.shop.removeUsed && run.gold >= run.removeCost() && rng.chance(0.5)) {
          run.buyRemoval();
          resolveSelection(run, rng);
        }
        run.leaveRoom();
        break;
      }
      case 'rest': {
        if (!sc.done) {
          const acts: ('rest' | 'smith' | 'lift' | 'toke' | 'dig')[] = [];
          if (run.canRest() === true) acts.push('rest');
          if (run.canSmith() === true) acts.push('smith');
          if (run.hasRelic('girya') && run.relic('girya')!.counter < 3) acts.push('lift');
          if (run.hasRelic('peace_pipe')) acts.push('toke');
          if (run.hasRelic('shovel')) acts.push('dig');
          if (acts.length) {
            const a =
              run.hp < run.maxHp * (opts.smart ? 0.65 : 0.5) && acts.includes('rest')
                ? 'rest'
                : opts.smart && acts.includes('smith')
                  ? 'smith'
                  : rng.pick(acts);
            run.restAction(a);
            resolveSelection(run, rng);
          }
        }
        if (run.screen.s === 'rest') run.leaveRoom();
        break;
      }
      case 'event': {
        const v = run.eventView();
        if (!v) break;
        const opts2 = v.options.filter((o) => !o.disabled);
        if (!opts2.length) {
          run.leaveRoom();
          break;
        }
        rng.pick(opts2).go();
        resolveSelection(run, rng);
        break;
      }
      case 'treasure':
        run.openChest();
        run.leaveRoom();
        break;
      case 'bossRelic':
        run.pickBossRelic(rng.int(0, sc.choices.length - 1));
        resolveSelection(run, rng);
        break;
      case 'gameover':
        return { win: sc.win, floor: run.floor, act: run.act, steps };
    }
  }
  throw new Error(`机器人在 ${max} 步内未结束（楼层 ${run.floor}，界面 ${run.screen.s}）`);
}

export { canUpgrade };
