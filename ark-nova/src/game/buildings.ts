// 建筑：标准围栏（1–5 格）、售货亭、凉亭、三种特殊场馆。赞助卡的专属建筑在打出时动态注册。
import type { Axial } from './hex';
import type { SpecialKind } from './types';

export type BuildingKind = 'enclosure' | 'kiosk' | 'pavilion' | 'special' | 'sponsor';

export interface BuildingDef {
  id: string;
  name: string;
  emoji: string;
  kind: BuildingKind;
  shape: Axial[];
  special?: SpecialKind;
  capacity?: number;
  /** 只能用升级后的建造行动建造 */
  needsUpgrade?: boolean;
  /** 每座动物园只能有一座 */
  unique?: boolean;
  text: string;
}

export const BUILDINGS: Record<string, BuildingDef> = {
  E1: { id: 'E1', name: '1 格围栏', emoji: '▫️', kind: 'enclosure', shape: [[0, 0]], text: '标准围栏，可容纳 1 只体型不超过 1 的动物。' },
  E2: {
    id: 'E2',
    name: '2 格围栏',
    emoji: '▫️',
    kind: 'enclosure',
    shape: [
      [0, 0],
      [1, 0],
    ],
    text: '标准围栏，可容纳 1 只体型不超过 2 的动物。',
  },
  E3: {
    id: 'E3',
    name: '3 格围栏',
    emoji: '▫️',
    kind: 'enclosure',
    shape: [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    text: '标准围栏，可容纳 1 只体型不超过 3 的动物。',
  },
  E4: {
    id: 'E4',
    name: '4 格围栏',
    emoji: '▫️',
    kind: 'enclosure',
    shape: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    text: '标准围栏，可容纳 1 只体型不超过 4 的动物。',
  },
  E5: {
    id: 'E5',
    name: '5 格围栏',
    emoji: '▫️',
    kind: 'enclosure',
    shape: [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ],
    text: '标准围栏，可容纳 1 只体型不超过 5 的动物。',
  },
  kiosk: {
    id: 'kiosk',
    name: '售货亭',
    emoji: '🍦',
    kind: 'kiosk',
    shape: [[0, 0]],
    text: '休息时，每座相邻的建筑为它带来 1 元收入。售货亭之间至少相隔 2 格。',
  },
  pavilion: { id: 'pavilion', name: '凉亭', emoji: '⛱️', kind: 'pavilion', shape: [[0, 0]], text: '建成时获得 1 点吸引力。' },
  petting: {
    id: 'petting',
    name: '儿童动物园',
    emoji: '🎠',
    kind: 'special',
    special: 'petting',
    capacity: 3,
    unique: true,
    shape: [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    text: '特殊场馆（每座动物园限 1 座）：可容纳 3 只宠物动物。',
  },
  reptile: {
    id: 'reptile',
    name: '爬行馆',
    emoji: '🏛️',
    kind: 'special',
    special: 'reptile',
    capacity: 5,
    unique: true,
    needsUpgrade: true,
    shape: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [1, 1],
    ],
    text: '特殊场馆（限 1 座，需要升级的建造行动）：容量 5，可放入标有爬行馆的爬行动物。',
  },
  aviary: {
    id: 'aviary',
    name: '大型鸟舍',
    emoji: '🪺',
    kind: 'special',
    special: 'aviary',
    capacity: 5,
    unique: true,
    needsUpgrade: true,
    shape: [
      [0, 0],
      [1, 0],
      [1, -1],
      [0, 1],
      [-1, 1],
    ],
    text: '特殊场馆（限 1 座，需要升级的建造行动）：容量 5，可放入标有鸟舍的鸟类。',
  },
};

/** 建造行动可以选择的建筑（按顺序显示） */
export const BUILDABLE = ['E1', 'E2', 'E3', 'E4', 'E5', 'kiosk', 'pavilion', 'petting', 'reptile', 'aviary'];

export function buildingDef(type: string): BuildingDef {
  const d = BUILDINGS[type];
  if (!d) throw new Error(`未知建筑 ${type}`);
  return d;
}

export function registerBuilding(def: BuildingDef) {
  BUILDINGS[def.id] = def;
}

export function enclosureSize(type: string): number {
  const d = BUILDINGS[type];
  return d?.kind === 'enclosure' ? d.shape.length : 0;
}
