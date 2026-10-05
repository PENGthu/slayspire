import { defineEnchants } from '../registry';
import { uv } from '../cards';
import type { CardDef } from '../types';
import { UNPLAYABLE } from '../types';

const playable = (d: CardDef) => uv(d.cost, false) !== UNPLAYABLE && d.type !== 'curse' && d.type !== 'status';

/** 附魔（《杀戮尖塔 2》新机制）：附着在卡牌上的永久强化 */
defineEnchants([
  {
    id: 'sharp',
    name: '锋锐',
    color: '#e0603a',
    desc: (n) => `这张牌的伤害提高 ${n}。`,
    fits: (d) => playable(d) && d.type === 'attack' && (d.dmg !== undefined || !!d.dmgFn),
    dmgAdd: (n) => n,
  },
  {
    id: 'sturdy',
    name: '坚固',
    color: '#4f8fd6',
    desc: (n) => `这张牌获得的格挡提高 ${n}。`,
    fits: (d) => playable(d) && (d.blk !== undefined || !!d.blkFn),
    blkAdd: (n) => n,
  },
  {
    id: 'swift',
    name: '迅捷',
    color: '#5bc8d6',
    desc: () => '打出时抽 1 张牌。',
    fits: (d) => playable(d) && d.type !== 'power',
    onPlay: (g) => g.draw(1),
  },
  {
    id: 'steady',
    name: '沉稳',
    color: '#c9a35b',
    desc: () => '固有：每场战斗开始时必定在手牌中。',
    fits: (d) => playable(d) && !d.innate,
    innate: true,
  },
  {
    id: 'patient',
    name: '耐心',
    color: '#8fbf6b',
    desc: () => '保留：回合结束时不会被丢弃。',
    fits: (d) => playable(d) && d.type !== 'power' && !d.retain,
    retain: true,
  },
  {
    id: 'efficient',
    name: '高效',
    color: '#e8c547',
    desc: () => '费用减少 1。',
    fits: (d) => playable(d) && (uv(d.cost, false) ?? 0) >= 1,
    costAdd: () => -1,
  },
  {
    id: 'echo',
    name: '回响',
    color: '#b07be0',
    desc: () => '每场战斗中第一次打出时，额外打出一次。',
    fits: (d) => playable(d) && d.type !== 'power',
  },
  {
    id: 'vigorous',
    name: '充沛',
    color: '#f0a33a',
    desc: () => '每场战斗中第一次打出时，获得 1 点能量。',
    fits: (d) => playable(d),
    onFirstPlay: (g) => g.gainEnergy(1),
  },
  {
    id: 'guarded',
    name: '守护',
    color: '#6fa8dc',
    desc: (n) => `打出时获得 ${n} 点格挡。`,
    fits: (d) => playable(d) && d.type === 'attack',
    onPlay: (g, _c, n) => g.gainBlock(g.player, n),
  },
  {
    id: 'venom',
    name: '淬毒',
    color: '#5fbf5a',
    desc: (n) => `打出时给予随机敌人 ${n} 层中毒。`,
    fits: (d) => playable(d) && d.type === 'attack',
    onPlay: (g, _c, n) => g.apply(g.randomEnemy(), 'poison', n),
  },
]);
