import type { Combat } from '../../combat';
import type { Enemy, IntentKind, MoveDef } from '../../types';

export const last = (e: Enemy, id: string) => e.history[e.history.length - 1] === id;
export const lastTwo = (e: Enemy, id: string) => last(e, id) && e.history[e.history.length - 2] === id;
export const roll = (g: Combat) => g.aiRng.int(0, 99);
/** 已行动次数（下一次行动是第 turns+1 次） */
export const nth = (e: Enemy) => e.turns;

/** 按权重随机选择，排除不允许的选项 */
export function pickMove(g: Combat, opts: [string, number, boolean?][]): string {
  const ok = opts.filter(([, w, banned]) => w > 0 && !banned);
  if (!ok.length) return opts[0][0];
  return g.aiRng.weighted(ok.map(([id, w]) => [id, w] as const));
}

/** 循环模式 */
export const cycle = (e: Enemy, seq: string[], offset = 0) => seq[(e.turns + offset) % seq.length];

export function atk(name: string, dmg: number, hits = 1): MoveDef {
  return { name, intent: 'attack', dmg, hits, act: (e, g) => void g.enemyAttack(e, dmg, hits) };
}

export function atkThen(
  name: string,
  dmg: number,
  hits: number,
  intent: IntentKind,
  then: (e: Enemy, g: Combat, dealt: number) => void,
): MoveDef {
  return {
    name,
    intent,
    dmg,
    hits,
    act: (e, g) => {
      const dealt = g.enemyAttack(e, dmg, hits);
      if (!e.dead) then(e, g, dealt);
    },
  };
}

export function move(name: string, intent: IntentKind, act: (e: Enemy, g: Combat) => void): MoveDef {
  return { name, intent, act };
}

export const defend = (name: string, n: number): MoveDef => move(name, 'defend', (e, g) => g.gainBlock(e, n));

export const buffSelf = (name: string, id: string, n: number): MoveDef =>
  move(name, 'buff', (e, g) => void g.apply(e, id, n, e));

export const debuffPlayer = (name: string, id: string, n: number, strong = false): MoveDef =>
  move(name, strong ? 'strongDebuff' : 'debuff', (e, g) => void g.apply(g.player, id, n, e));

/** 分裂：移除自身，生成两个更小的敌人（继承当前生命） */
export function splitInto(e: Enemy, g: Combat, id: string) {
  const idx = g.enemies.indexOf(e);
  const hp = e.hp;
  e.escaped = true;
  e.hp = 0;
  g.emit('text', e.uid, undefined, '分裂');
  g.spawnEnemy(id, { hp, at: idx + 1 });
  g.spawnEnemy(id, { hp, at: idx + 1 });
}

/** 召唤仆从（限制场上总数） */
export function summon(g: Combat, id: string, n = 1, max = 5) {
  for (let i = 0; i < n; i++) {
    if (g.alive.length >= max) return;
    g.spawnEnemy(id, { minion: true, at: 0 });
  }
}

/** 偷取金币（击败偷窃者后夺回） */
export function steal(e: Enemy, g: Combat, n: number) {
  const x = Math.min(n, g.run.gold);
  if (x <= 0) return;
  g.run.gold -= x;
  e.mem.stolen = (e.mem.stolen ?? 0) + x;
  g.emit('text', g.player.uid, undefined, `-${x} 金币`);
}

/** 复原到满生命（幻象） */
export function restore(e: Enemy, g: Combat) {
  e.hp = e.maxHp;
  g.removePower(e, 'revive_pending');
  g.emit('heal', e.uid, e.maxHp, '复原');
}

/** 逃离战场 */
export function flee(e: Enemy, g: Combat) {
  e.escaped = true;
  g.emit('escape', e.uid);
}
