// 保护项目：需要一定数量的图标（或放归一只动物）才能支持。每一档只能由一位玩家占据，
// 每位玩家每个项目只能支持一次。基础项目开局摆在协会版图上，其余项目在牌库中，由玩家打出。
import type { Icon, ProjectCard, ProjectGoal, ScoringCard } from '../types';

export const PROJECTS: ProjectCard[] = [];

function P(
  id: string,
  name: string,
  emoji: string,
  goal: ProjectGoal,
  levels: [number, number][],
  text: string,
  base = false,
) {
  PROJECTS.push({
    kind: 'project',
    id,
    num: 0,
    name,
    emoji,
    goal,
    levels: levels.map(([need, cp]) => ({ need, cp })),
    base,
    text,
  });
}

const icon = (i: Icon): ProjectGoal => ({ k: 'icon', icon: i });

// —— 牌库中的项目
P('p_africa', '非洲保育计划', '🌍', icon('africa'), [[5, 5], [4, 4], [2, 2]], '需要非洲图标。');
P('p_asia', '亚洲保育计划', '🏯', icon('asia'), [[5, 5], [4, 4], [2, 2]], '需要亚洲图标。');
P('p_americas', '美洲保育计划', '🌎', icon('americas'), [[5, 5], [4, 4], [2, 2]], '需要美洲图标。');
P('p_europe', '欧洲保育计划', '🏰', icon('europe'), [[4, 5], [3, 4], [2, 2]], '需要欧洲图标。');
P('p_australia', '大洋洲保育计划', '🌏', icon('australia'), [[4, 5], [3, 4], [2, 2]], '需要大洋洲图标。');
P('p_predator', '捕食者保护', '🐾', icon('predator'), [[5, 5], [4, 4], [2, 2]], '需要捕食者图标。');
P('p_herbivore', '草食动物保护', '🌿', icon('herbivore'), [[5, 5], [4, 4], [2, 2]], '需要草食动物图标。');
P('p_bird', '鸟类保护', '🪶', icon('bird'), [[5, 5], [4, 4], [2, 2]], '需要鸟类图标。');
P('p_reptile', '爬行动物保护', '🐢', icon('reptile'), [[4, 5], [3, 4], [2, 2]], '需要爬行动物图标。');
P('p_primate', '灵长类保护', '🐒', icon('primate'), [[4, 5], [3, 4], [2, 2]], '需要灵长类图标。');
P('p_bear', '熊类保护', '🐻', icon('bear'), [[3, 5], [2, 4], [1, 2]], '需要熊图标。');
P('p_science', '野外科研', '🔬', icon('science'), [[5, 5], [4, 4], [2, 2]], '需要研究图标。');
P('p_petting', '亲子自然课堂', '🧸', icon('petting'), [[3, 4], [2, 3], [1, 2]], '需要宠物图标。');
P('p_release_big', '大型动物放归', '🏞️', { k: 'release' }, [[5, 5], [4, 4], [3, 3]],'放归一只体型 ≥ 档位数字的动物：它离开你的动物园，你失去它的吸引力，围栏重新空出。');
P('p_release_bird', '鸟类放飞', '🕊️', { k: 'release', filter: { cat: 'bird' } }, [[3, 4], [2, 3], [1, 2]], '放飞一只体型 ≥ 档位数字的鸟类：它离开你的动物园，你失去它的吸引力。');
P('p_release_reptile', '爬行动物放归', '🦎', { k: 'release', filter: { cat: 'reptile' } }, [[3, 4], [2, 3], [1, 2]], '放归一只体型 ≥ 档位数字的爬行动物：它离开你的动物园，你失去它的吸引力。');
P('p_waterways', '湿地修复', '💧', { k: 'metric', metric: { m: 'waterAnimals' }, label: '与水域相邻的围栏中的动物' }, [[4, 5], [3, 4], [2, 2]], '需要放在与水域相邻的建筑中的动物。');
P('p_mountains', '高山生态', '⛰️', { k: 'metric', metric: { m: 'rockAnimals' }, label: '与岩石相邻的围栏中的动物' }, [[4, 5], [3, 4], [2, 2]], '需要放在与岩石相邻的建筑中的动物。');
P('p_large', '大型动物保育', '🐘', { k: 'metric', metric: { m: 'animals', filter: { minSize: 4 } }, label: '体型 4 以上的动物' }, [[4, 5], [3, 4], [2, 2]], '需要体型 4 以上的动物。');
P('p_small', '小型动物保护', '🐿️', { k: 'metric', metric: { m: 'animals', filter: { maxSize: 2 } }, label: '体型 2 以下的动物' }, [[6, 5], [4, 4], [3, 2]], '需要体型 2 以下的动物（含宠物）。');
P('p_special', '特色场馆计划', '🏛️', { k: 'metric', metric: { m: 'specialAnimals' }, label: '特殊场馆中的动物' }, [[5, 5], [4, 4], [2, 2]], '需要住在特殊场馆中的动物。');
P('p_universities', '高校联合研究', '🎓', { k: 'metric', metric: { m: 'universities' }, label: '大学' }, [[3, 5], [2, 3], [1, 2]], '需要合作的大学。');
P('p_partners', '国际保育联盟', '🌐', { k: 'metric', metric: { m: 'partners' }, label: '合作动物园' }, [[4, 5], [3, 4], [2, 2]], '需要合作动物园。');
P('p_visitors', '访客自然教育', '⛱️', { k: 'metric', metric: { m: 'pavilions' }, label: '凉亭' }, [[4, 4], [3, 3], [2, 2]], '需要凉亭。');
P('p_full', '满员繁育计划', '🏡', { k: 'metric', metric: { m: 'fullEnclosures' }, label: '住有动物的标准围栏' }, [[7, 5], [5, 4], [3, 2]], '需要住有动物的标准围栏。');
P('p_release_herb', '草食动物放归', '🦌', { k: 'release', filter: { cat: 'herbivore' } }, [[4, 5], [3, 3], [2, 2]], '放归一只体型 ≥ 档位数字的草食动物：它离开你的动物园，你失去它的吸引力。');

// —— 基础项目（每局随机 3 个）
P('b_species', '物种多样性', '🧩', { k: 'metric', metric: { m: 'catKinds' }, label: '不同动物种类' }, [[5, 5], [4, 3], [3, 2]], '需要不同种类的动物图标。', true);
P('b_habitat', '栖息地多样性', '🗺️', { k: 'metric', metric: { m: 'contKinds' }, label: '不同大洲' }, [[5, 5], [4, 3], [3, 2]], '需要不同大洲的图标。', true);
P('b_release', '放归野外', '🌲', { k: 'release' }, [[4, 5], [3, 3], [1, 2]], '放归一只体型 ≥ 档位数字的动物：它离开你的动物园，你失去它的吸引力。', true);
P('b_network', '保护网络', '🤝', { k: 'metric', metric: { m: 'partnersUnis' }, label: '合作动物园与大学' }, [[5, 5], [4, 3], [3, 2]], '需要合作动物园和大学（合计）。', true);
P('b_scale', '动物园规模', '🏟️', { k: 'metric', metric: { m: 'animals' }, label: '动物' }, [[9, 5], [7, 3], [5, 2]], '需要动物园中的动物数量。', true);
P('b_research', '科学研究', '🧪', icon('science'), [[4, 4], [3, 3], [2, 2]], '需要研究图标。', true);

// ———————————————————————————————————————————— 终局计分卡
export const SCORING: ScoringCard[] = [
  { id: 's_large', name: '大型动物专家', emoji: '🐘', metric: { m: 'animals', filter: { minSize: 4 } }, tiers: [[2, 1], [3, 2], [4, 3], [5, 4]], text: '体型 4 以上的动物' },
  { id: 's_small', name: '小型动物乐园', emoji: '🐿️', metric: { m: 'animals', filter: { maxSize: 2 } }, tiers: [[4, 1], [6, 2], [8, 3], [10, 4]], text: '体型 2 以下的动物（含宠物）' },
  { id: 's_science', name: '科研先锋', emoji: '🔬', metric: { m: 'icon', icon: 'science' }, tiers: [[3, 1], [4, 2], [5, 3], [6, 4]], text: '研究图标' },
  { id: 's_network', name: '国际合作', emoji: '🤝', metric: { m: 'partnersUnis' }, tiers: [[3, 1], [4, 2], [5, 3], [6, 4]], text: '合作动物园与大学' },
  { id: 's_full', name: '满园春色', emoji: '🏡', metric: { m: 'fullEnclosures' }, tiers: [[5, 1], [7, 2], [9, 3], [11, 4]], text: '住有动物的标准围栏' },
  { id: 's_builder', name: '建筑大师', emoji: '🏗️', metric: { m: 'covered' }, tiers: [[32, 1], [38, 2], [44, 3], [50, 4]], text: '被建筑覆盖的格子' },
  { id: 's_water', name: '水景动物园', emoji: '💧', metric: { m: 'waterAnimals' }, tiers: [[3, 1], [4, 2], [5, 3], [6, 4]], text: '与水域相邻的建筑中的动物' },
  { id: 's_rock', name: '岩石园景', emoji: '⛰️', metric: { m: 'rockAnimals' }, tiers: [[3, 1], [4, 2], [5, 3], [6, 4]], text: '与岩石相邻的建筑中的动物' },
  { id: 's_sponsors', name: '赞助网络', emoji: '💼', metric: { m: 'sponsors' }, tiers: [[3, 1], [4, 2], [5, 3], [6, 4]], text: '打出的赞助卡' },
  { id: 's_reputation', name: '声名远扬', emoji: '⭐', metric: { m: 'rep' }, tiers: [[8, 1], [10, 2], [12, 3], [14, 4]], text: '声望' },
  { id: 's_species', name: '物种大全', emoji: '🧩', metric: { m: 'catKinds' }, tiers: [[4, 1], [5, 2], [6, 3], [7, 4]], text: '不同的动物种类' },
  { id: 's_world', name: '环游世界', emoji: '🌐', metric: { m: 'contKinds' }, tiers: [[2, 1], [3, 2], [4, 3], [5, 4]], text: '不同大洲（动物与合作动物园）' },
  { id: 's_special', name: '特色场馆', emoji: '🏛️', metric: { m: 'specialAnimals' }, tiers: [[2, 1], [4, 2], [6, 3], [8, 4]], text: '住在特殊场馆中的动物' },
  { id: 's_kiosks', name: '游客经济', emoji: '🍦', metric: { m: 'kiosks' }, tiers: [[2, 1], [3, 2], [4, 3], [5, 4]], text: '售货亭' },
  { id: 's_upgrades', name: '高效运营', emoji: '⬆️', metric: { m: 'upgrades' }, tiers: [[2, 1], [3, 2], [4, 3], [5, 4]], text: '升级的行动卡' },
];
