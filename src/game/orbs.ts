import type { Combat } from './combat';

/** 充能球（故障机器人） */
export type OrbId = 'lightning' | 'frost' | 'dark' | 'plasma';

export interface Orb {
  id: OrbId;
  /** 黑暗充能球累积的激发伤害 */
  n: number;
}

export interface OrbDef {
  id: OrbId;
  name: string;
  art: string;
  color: string;
  /** 回合开始时触发被动（等离子），否则在回合结束时触发 */
  startOfTurn?: boolean;
  passiveVal: (g: Combat, o: Orb) => number;
  evokeVal: (g: Combat, o: Orb) => number;
  passive: (g: Combat, o: Orb) => void;
  evoke: (g: Combat, o: Orb) => void;
  desc: (g: Combat, o: Orb) => string;
}

const focus = (g: Combat) => g.pw(g.player, 'focus');

function zap(g: Combat, n: number) {
  if (n <= 0) return;
  if (g.has(g.player, 'electrodynamics')) {
    for (const e of g.alive) g.thorns(e, n, g.player);
  } else {
    const e = g.randomEnemy();
    if (e) g.thorns(e, n, g.player);
  }
}

export const ORBS: Record<OrbId, OrbDef> = {
  lightning: {
    id: 'lightning',
    name: '闪电',
    art: '⚡',
    color: '#8fd3ff',
    passiveVal: (g) => Math.max(0, 3 + focus(g)),
    evokeVal: (g) => Math.max(0, 8 + focus(g)),
    passive: (g, o) => zap(g, ORBS.lightning.passiveVal(g, o)),
    evoke: (g, o) => zap(g, ORBS.lightning.evokeVal(g, o)),
    desc: (g, o) =>
      `被动：回合结束时，对随机敌人造成 ${ORBS.lightning.passiveVal(g, o)} 点伤害。\n激发：对随机敌人造成 ${ORBS.lightning.evokeVal(g, o)} 点伤害。`,
  },
  frost: {
    id: 'frost',
    name: '冰霜',
    art: '❄️',
    color: '#b8ecff',
    passiveVal: (g) => Math.max(0, 2 + focus(g)),
    evokeVal: (g) => Math.max(0, 5 + focus(g)),
    passive: (g, o) => g.gainBlock(g.player, ORBS.frost.passiveVal(g, o)),
    evoke: (g, o) => g.gainBlock(g.player, ORBS.frost.evokeVal(g, o)),
    desc: (g, o) => `被动：回合结束时，获得 ${ORBS.frost.passiveVal(g, o)} 点格挡。\n激发：获得 ${ORBS.frost.evokeVal(g, o)} 点格挡。`,
  },
  dark: {
    id: 'dark',
    name: '黑暗',
    art: '🌑',
    color: '#b48cff',
    passiveVal: (g) => Math.max(0, 6 + focus(g)),
    evokeVal: (_g, o) => o.n,
    passive: (g, o) => {
      o.n += ORBS.dark.passiveVal(g, o);
    },
    evoke: (g, o) => {
      const t = [...g.alive].sort((a, b) => a.hp - b.hp)[0];
      if (t) g.thorns(t, o.n, g.player);
    },
    desc: (g, o) =>
      `被动：回合结束时，激发伤害提高 ${ORBS.dark.passiveVal(g, o)}。\n激发：对生命最低的敌人造成 ${o.n} 点伤害。`,
  },
  plasma: {
    id: 'plasma',
    name: '等离子',
    art: '🔆',
    color: '#ffd76b',
    startOfTurn: true,
    passiveVal: () => 1,
    evokeVal: () => 2,
    passive: (g) => g.gainEnergy(1),
    evoke: (g) => g.gainEnergy(2),
    desc: () => '被动：回合开始时，获得 1 点能量。\n激发：获得 2 点能量。',
  },
};

export const ORB_IDS: OrbId[] = ['lightning', 'frost', 'dark', 'plasma'];
