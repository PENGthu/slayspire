// 原版基础游戏的保护项目（12 个基础项目 + 20 张项目卡）与 11 张终局计分卡。
// 支持项目：每档只能被一位玩家占据，每位玩家每个项目只能支持一次（迁徙记录例外）。
import type { Category, Continent, Icon, ProjectCard, ProjectGoal, ProjectLevel, ScoringCard } from '../types';

type P = Omit<ProjectCard, 'kind' | 'id'>;

const lv = (pairs: [number, number][]): ProjectLevel[] => pairs.map(([need, cp]) => ({ need, cp }));
const icon = (i: Icon): ProjectGoal => ({ k: 'icon', icon: i });
const RELEASE = lv([
  [0, 5],
  [1, 4],
  [2, 3],
]);
const BREED: ProjectLevel[] = [
  { need: 1, cp: 2, rep: 2 },
  { need: 1, cp: 1, rep: 2 },
  { need: 1, cp: 2 },
];

const release = (num: number, name: string, en: string, emoji: string, i: Continent | Category): P => ({
  num,
  name,
  en,
  emoji,
  goal: { k: 'release', icon: i },
  levels: RELEASE,
});
const breed = (num: number, name: string, en: string, emoji: string, cat: Category): P => ({ num, name, en, emoji, goal: { k: 'breed', cat }, levels: BREED });

const L: P[] = [
  { num: 101, name: '物种多元化', en: 'Species Diversity', emoji: '🧩', base: true, goal: { k: 'kinds', of: 'category' }, levels: lv([[5, 5], [4, 3], [3, 2]]) },
  { num: 102, name: '起源地多元化', en: 'Habitat Diversity', emoji: '🗺️', base: true, goal: { k: 'kinds', of: 'continent' }, levels: lv([[5, 5], [4, 3], [3, 2]]) },
  { num: 103, name: '非洲', en: 'Africa', emoji: '🌍', base: true, goal: icon('africa'), levels: lv([[5, 5], [4, 3], [2, 2]]) },
  { num: 104, name: '美洲', en: 'Americas', emoji: '🌎', base: true, goal: icon('americas'), levels: lv([[5, 5], [4, 3], [2, 2]]) },
  { num: 105, name: '澳洲', en: 'Australia', emoji: '🦘', base: true, goal: icon('australia'), levels: lv([[5, 5], [4, 4], [2, 2]]) },
  { num: 106, name: '亚洲', en: 'Asia', emoji: '🏯', base: true, goal: icon('asia'), levels: lv([[5, 5], [4, 3], [2, 2]]) },
  { num: 107, name: '欧洲', en: 'Europe', emoji: '🏰', base: true, goal: icon('europe'), levels: lv([[5, 5], [4, 4], [2, 2]]) },
  { num: 108, name: '灵长类', en: 'Primates', emoji: '🐒', base: true, goal: icon('primate'), levels: lv([[5, 5], [4, 4], [2, 2]]) },
  { num: 109, name: '爬行类', en: 'Reptiles', emoji: '🦎', base: true, goal: icon('reptile'), levels: lv([[5, 5], [4, 4], [2, 2]]) },
  { num: 110, name: '食肉类', en: 'Predators', emoji: '🐾', base: true, goal: icon('predator'), levels: lv([[5, 5], [4, 4], [2, 2]]) },
  { num: 111, name: '食草类', en: 'Herbivores', emoji: '🌿', base: true, goal: icon('herbivore'), levels: lv([[5, 5], [4, 4], [2, 2]]) },
  { num: 112, name: '鸟类', en: 'Birds', emoji: '🪶', base: true, goal: icon('bird'), levels: lv([[5, 5], [4, 4], [2, 2]]) },
  release(113, '巴伐利亚森林国家公园', 'Bavarian Forest National Park', '🌲', 'europe'),
  release(114, '优胜美地国家公园', 'Yosemite National Park', '🏞️', 'americas'),
  release(115, '安通国家公园', 'Angthong National Park', '🏝️', 'asia'),
  release(116, '塞伦盖蒂国家公园', 'Serengeti National Park', '🌅', 'africa'),
  release(117, '蓝山国家公园', 'Blue Mountains National Park', '⛰️', 'australia'),
  release(118, '热带大草原', 'Savanna', '🦁', 'predator'),
  release(119, '低矮山脉', 'Low Mountain Range', '🕊️', 'bird'),
  release(120, '竹林', 'Bamboo Forest', '🎋', 'herbivore'),
  release(121, '海蚀洞', 'Sea Cave', '🌊', 'reptile'),
  release(122, '丛林', 'Jungle', '🌴', 'primate'),
  breed(123, '鸟类动物繁育计划', 'Bird Breeding Program', '🦩', 'bird'),
  breed(124, '食肉类动物繁育计划', 'Predator Breeding Program', '🐯', 'predator'),
  breed(125, '爬行类动物繁育计划', 'Reptile Breeding Program', '🐍', 'reptile'),
  breed(126, '食草类动物繁育计划', 'Herbivore Breeding Program', '🦌', 'herbivore'),
  breed(127, '灵长类动物繁育计划', 'Primate Breeding Program', '🐵', 'primate'),
  { num: 128, name: '水生态', en: 'Aquatic', emoji: '💧', goal: icon('water'), levels: lv([[5, 4], [4, 3], [2, 2]]) },
  { num: 129, name: '地质学', en: 'Geological', emoji: '🪨', goal: icon('rock'), levels: lv([[5, 4], [4, 3], [2, 2]]) },
  { num: 130, name: '小型动物', en: 'Small Animals', emoji: '🐿️', goal: { k: 'small' }, levels: lv([[8, 4], [5, 3], [2, 2]]) },
  { num: 131, name: '大型动物', en: 'Large Animals', emoji: '🐘', goal: { k: 'large' }, levels: lv([[4, 4], [3, 3], [2, 2]]) },
  { num: 132, name: '科研', en: 'Research', emoji: '🔬', goal: icon('science'), levels: lv([[5, 4], [4, 3], [2, 2]]) },
];

export const PROJECTS: ProjectCard[] = L.map((p) => ({ ...p, kind: 'project', id: `p${p.num}` }));

// ———————————————————————————————————————————— 终局计分卡（原版数值）
export const SCORING: ScoringCard[] = [
  { id: 'e001', num: 1, name: '大型动物公园', emoji: '🐘', tiers: [[1, 1], [2, 2], [4, 3], [5, 4]], text: '大型动物（体型 ≥4）' },
  { id: 'e002', num: 2, name: '小型动物公园', emoji: '🐿️', tiers: [[3, 1], [6, 2], [8, 3], [10, 4]], text: '小型动物（体型 ≤2）' },
  { id: 'e003', num: 3, name: '科研动物园', emoji: '🔬', tiers: [[3, 1], [4, 2], [5, 3], [6, 4]], text: '研究图标' },
  {
    id: 'e004',
    num: 4,
    name: '主题建筑动物园',
    emoji: '🏗️',
    tiers: [],
    text: '以下每满足一项获得 1 保护点数：所有水域格都与建筑相邻；所有岩石格都与建筑相邻；所有边缘格都被覆盖；整张地图都被覆盖',
  },
  { id: 'e005', num: 5, name: '公益保护动物园', emoji: '🌿', tiers: [[3, 1], [4, 2], [5, 3], [6, 4]], text: '支持过的保护项目' },
  { id: 'e006', num: 6, name: '自然动物园', emoji: '🌾', tiers: [[6, 1], [12, 2], [18, 3], [24, 4]], text: '没有建筑的可建造格' },
  { id: 'e007', num: 7, name: '人气动物园', emoji: '🎓', tiers: [[6, 1], [9, 2], [12, 3], [15, 4]], text: '声望' },
  { id: 'e008', num: 8, name: '慈善动物园', emoji: '💼', tiers: [[3, 1], [6, 2], [8, 3], [10, 4]], text: '打出的赞助卡' },
  {
    id: 'e009',
    num: 9,
    name: '综合物种动物园',
    emoji: '🧩',
    tiers: [],
    text: '每种你比右手边玩家多的动物种类图标，获得 1 保护点数（最多 4 点）',
  },
  { id: 'e010', num: 10, name: '岩石公园', emoji: '⛰️', tiers: [[1, 1], [3, 2], [5, 3], [7, 4]], text: '岩石图标' },
  { id: 'e011', num: 11, name: '水生态公园', emoji: '💧', tiers: [[2, 1], [4, 2], [6, 3], [8, 4]], text: '水图标' },
];
