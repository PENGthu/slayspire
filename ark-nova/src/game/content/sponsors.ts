// 赞助卡：等级 = 打出所需的赞助行动强度。提供图标、立即收益、持续效果、休息收入、终局保护点数或专属建筑。
import type { Gain, Icon, Requirement, SponsorCard, SponsorEffect } from '../types';

export const SPONSORS: SponsorCard[] = [];

interface Opts {
  icons?: Icon[];
  req?: Requirement[];
  gain?: Gain;
  gainPer?: SponsorCard['gainPer'];
  effects?: SponsorEffect[];
  building?: SponsorCard['building'];
}

function S(id: string, name: string, emoji: string, level: number, text: string, o: Opts = {}) {
  SPONSORS.push({
    kind: 'sponsor',
    id,
    num: 0,
    name,
    emoji,
    level,
    icons: o.icons ?? [],
    req: o.req,
    gain: o.gain,
    gainPer: o.gainPer,
    effects: o.effects,
    building: o.building,
    text,
  });
}

const SCI = (n: number): Requirement => ({ k: 'icon', icon: 'science', n });
const REP = (n: number): Requirement => ({ k: 'rep', n });

// —— 研究
S('field_lab', '野外研究站', '🔬', 2, '立即抽 1 张牌。', { icons: ['science'], gain: { cards: 1 } });
S('research_institute', '野生动物研究所', '🏫', 3, '声望 +1。', { icons: ['science'], gain: { rep: 1 } });
S('veterinary_school', '兽医学院', '🩺', 4, '声望 +2。', { icons: ['science', 'science'], req: [SCI(1)], gain: { rep: 2 } });
S('gene_bank', '基因库', '🧬', 5, '终局：每 2 个研究图标获得 1 保护点数（最多 3）。', {
  icons: ['science'],
  req: [SCI(2)],
  effects: [{ k: 'end', metric: { m: 'icon', icon: 'science' }, per: 2, cp: 1, max: 3 }],
});
S('behaviour_lab', '动物行为学实验室', '🧠', 3, '每当你打出灵长类动物，获得 1 点吸引力。', {
  icons: ['science'],
  effects: [{ k: 'onPlay', filter: { cat: 'primate' }, gain: { appeal: 1 } }],
});
S('university_partner', '大学合作办公室', '🎓', 2, '立即获得 4 元。', { icons: ['science'], gain: { money: 4 } });

// —— 大洲专家
S('africa_expert', '非洲专家', '🌍', 3, '每当你打出非洲动物，获得 2 元。', {
  icons: ['africa'],
  effects: [{ k: 'onPlay', filter: { cont: 'africa' }, gain: { money: 2 } }],
});
S('europe_expert', '欧洲专家', '🏰', 2, '每当你打出欧洲动物，获得 2 元。', {
  icons: ['europe'],
  effects: [{ k: 'onPlay', filter: { cont: 'europe' }, gain: { money: 2 } }],
});
S('asia_expert', '亚洲专家', '🏯', 3, '每当你打出亚洲动物，获得 2 元。', {
  icons: ['asia'],
  effects: [{ k: 'onPlay', filter: { cont: 'asia' }, gain: { money: 2 } }],
});
S('americas_expert', '美洲专家', '🌎', 3, '每当你打出美洲动物，获得 2 元。', {
  icons: ['americas'],
  effects: [{ k: 'onPlay', filter: { cont: 'americas' }, gain: { money: 2 } }],
});
S('australia_expert', '大洋洲专家', '🌏', 2, '每当你打出大洋洲动物，获得 2 元。', {
  icons: ['australia'],
  effects: [{ k: 'onPlay', filter: { cont: 'australia' }, gain: { money: 2 } }],
});

// —— 种类
S('raptor_center', '猛禽救护中心', '🪶', 3, '每当你打出鸟类，获得 1 点吸引力。', {
  icons: ['bird'],
  effects: [{ k: 'onPlay', filter: { cat: 'bird' }, gain: { appeal: 1 } }],
});
S('herpetology', '爬行动物学会', '🦎', 3, '每当你打出爬行动物，获得 2 元。', {
  icons: ['reptile'],
  effects: [{ k: 'onPlay', filter: { cat: 'reptile' }, gain: { money: 2 } }],
});
S('primate_fund', '灵长类保护基金', '🐵', 4, '每当你打出灵长类动物，获得 1 点吸引力和 1 元。', {
  icons: ['primate'],
  effects: [{ k: 'onPlay', filter: { cat: 'primate' }, gain: { appeal: 1, money: 1 } }],
});
S('big_cat_alliance', '大型猫科动物联盟', '🐾', 4, '每当你打出捕食者，获得 1 点吸引力。', {
  icons: ['predator'],
  effects: [{ k: 'onPlay', filter: { cat: 'predator' }, gain: { appeal: 1 } }],
});
S('grassland_society', '草原保护协会', '🌾', 3, '每当你打出草食动物，获得 2 元。', {
  icons: ['herbivore'],
  effects: [{ k: 'onPlay', filter: { cat: 'herbivore' }, gain: { money: 2 } }],
});
S('bear_rescue', '熊类救助站', '🐻', 4, '立即获得 2 点吸引力。打出熊的费用减少 3 元。', {
  icons: ['bear'],
  gain: { appeal: 2 },
  effects: [{ k: 'discount', filter: { cat: 'bear' }, n: 3 }],
});
S('petting_sponsor', '亲子乐园赞助商', '🧸', 1, '每当你打出宠物动物，获得 2 元。', {
  icons: ['petting'],
  effects: [{ k: 'onPlay', filter: { cat: 'petting' }, gain: { money: 2 } }],
});
S('small_animal_program', '小型动物计划', '🐁', 2, '每当你打出体型 1–2 的动物，获得 2 元。', {
  effects: [{ k: 'onPlay', filter: { maxSize: 2 }, gain: { money: 2 } }],
});
S('large_animal_program', '大型动物计划', '🐘', 4, '每当你打出体型 4 以上的动物，获得 2 点吸引力。', {
  req: [REP(3)],
  effects: [{ k: 'onPlay', filter: { minSize: 4 }, gain: { appeal: 2 } }],
});

// —— 收入
S('ice_cream', '冰淇淋工坊', '🍨', 2, '休息时，你每有 1 个售货亭，额外获得 2 元（最多 8 元）。', {
  effects: [{ k: 'incomePer', metric: { m: 'kiosks' }, per: 1, money: 2, max: 8 }],
});
S('souvenir_shop', '纪念品商店', '🛍️', 2, '休息时，额外获得 3 元。', { effects: [{ k: 'income', money: 3 }] });
S('restaurant', '园区餐厅', '🍽️', 3, '立即获得 1 点吸引力。休息时，额外获得 3 元。', {
  gain: { appeal: 1 },
  effects: [{ k: 'income', money: 3 }],
});
S('night_zoo', '夜间动物园', '🌙', 4, '休息时，你每有 3 只动物，额外获得 2 元。', {
  effects: [{ k: 'incomePer', metric: { m: 'animals' }, per: 3, money: 2 }],
});
S('combo_ticket', '联票计划', '🎟️', 2, '休息时，你每有 1 个合作动物园，额外获得 2 元。', {
  effects: [{ k: 'incomePer', metric: { m: 'partners' }, per: 1, money: 2 }],
});
S('parking', '停车场', '🅿️', 1, '立即获得 5 元。', { gain: { money: 5 } });
S('donor_dinner', '捐赠者晚宴', '🥂', 3, '立即获得 10 元。', { gain: { money: 10 } });

// —— 建筑相关
S('contractor', '建筑承包商', '🏗️', 2, '每当你建造标准围栏，获得 2 元。', {
  effects: [{ k: 'onBuild', building: 'enclosure', gain: { money: 2 } }],
});
S('landscape', '景观设计事务所', '🌳', 3, '每当你建造凉亭，额外获得 1 点吸引力。立即获得 1 个 X 标记。', {
  gain: { x: 1 },
  effects: [{ k: 'onBuild', building: 'pavilion', gain: { appeal: 1 } }],
});
S('kiosk_chain', '连锁小吃店', '🌭', 1, '每当你建造售货亭，获得 3 元。', {
  effects: [{ k: 'onBuild', building: 'kiosk', gain: { money: 3 } }],
});

// —— 专属建筑
S('observation_tower', '观景塔', '🗼', 2, '专属建筑（1 格）。建成时，每座相邻的建筑带来 1 点吸引力（最多 4）。', {
  building: { shape: [[0, 0]] },
});
S('nature_center', '自然教育中心', '🏡', 3, '专属建筑（2 格）。获得 3 点吸引力。', {
  icons: ['science'],
  gain: { appeal: 3 },
  building: {
    shape: [
      [0, 0],
      [1, 0],
    ],
  },
});
S('animal_hospital', '动物医院', '🏥', 3, '专属建筑（2 格）。声望 +2。', {
  icons: ['science'],
  gain: { rep: 2 },
  building: {
    shape: [
      [0, 0],
      [0, 1],
    ],
  },
});
S('aquarium', '水族馆', '🐠', 4, '专属建筑（3 格，须与水域相邻）。获得 6 点吸引力。', {
  gain: { appeal: 6 },
  building: {
    shape: [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    water: true,
  },
});
S('visitor_center', '游客中心', '🏛️', 5, '专属建筑（3 格）。获得 4 点吸引力。休息时额外获得 4 元。', {
  gain: { appeal: 4 },
  effects: [{ k: 'income', money: 4 }],
  building: {
    shape: [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
  },
});
S('rainforest_house', '热带雨林馆', '🌴', 5, '专属建筑（4 格）。获得 5 点吸引力和 1 保护点数。', {
  icons: ['primate', 'bird'],
  req: [REP(4)],
  gain: { appeal: 5, cp: 1 },
  building: {
    shape: [
      [0, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
    ],
  },
});

// —— 声望、保护与终局
S('wildlife_fund', '野生动物基金会', '🐼', 5, '立即获得 2 保护点数。', { req: [REP(3)], gain: { cp: 2 } });
S('conservation_education', '保护教育计划', '📚', 3, '终局：你每支持 2 个保护项目，获得 1 保护点数（最多 3）。', {
  effects: [{ k: 'end', metric: { m: 'projects' }, per: 2, cp: 1, max: 3 }],
});
S('breeding_center', '繁育中心', '🥚', 4, '终局：你每有 4 只动物，获得 1 保护点数（最多 3）。', {
  icons: ['science'],
  effects: [{ k: 'end', metric: { m: 'animals' }, per: 4, cp: 1, max: 3 }],
});
S('international_program', '国际合作计划', '🤝', 4, '终局：你每有 1 个合作动物园，获得 1 保护点数（最多 3）。', {
  effects: [{ k: 'end', metric: { m: 'partners' }, per: 1, cp: 1, max: 3 }],
});
S('media_partner', '媒体合作伙伴', '📺', 3, '声望 +2。', { gain: { rep: 2 } });
S('celebrity', '名人代言', '🌟', 5, '声望 +2，获得 3 点吸引力。', { req: [REP(5)], gain: { rep: 2, appeal: 3 } });
S('volunteers', '志愿者计划', '🙋', 1, '获得 1 个 X 标记。', { gain: { x: 1 } });
S('management_training', '管理培训', '📋', 4, '获得 1 名协会工人。', { gain: { worker: 1 } });
S('strategic_plan', '战略规划', '🗺️', 3, '获得 2 个 X 标记，声望 +1。', { gain: { x: 2, rep: 1 } });
S('school_partnership', '学校合作', '🏫', 1, '获得 1 点吸引力，抽 1 张牌。', { gain: { appeal: 1, cards: 1 } });
S('friends_of_zoo', '动物园之友协会', '💚', 2, '每当你支持一个保护项目，获得 3 元。', {
  effects: [{ k: 'onProject', gain: { money: 3 } }],
});
S('wildlife_photographer', '野生动物摄影师', '📷', 2, '每当其他玩家打出体型 4 以上的动物，你获得 2 元。', {
  effects: [{ k: 'onOtherPlay', filter: { minSize: 4 }, gain: { money: 2 } }],
});
S('diversity_award', '多样性奖', '🏅', 3, '立即：你的动物园中每有 1 种不同的动物种类，获得 1 点吸引力。', {
  gainPer: { metric: { m: 'catKinds' }, per: 1, gain: { appeal: 1 }, max: 7 },
});
S('travel_agency', '旅行社', '✈️', 3, '立即：你的动物园中每有 1 个不同大洲的图标，获得 2 元。', {
  gainPer: { metric: { m: 'contKinds' }, per: 1, gain: { money: 2 }, max: 5 },
});
S('library', '自然历史图书馆', '📖', 2, '手牌上限 +2。立即抽 1 张牌。', {
  gain: { cards: 1 },
  effects: [{ k: 'handLimit', n: 2 }],
});
S('scouts', '物种侦察队', '🔭', 2, '你的声望范围（可以拿取的展示区位置）+1。', { effects: [{ k: 'range', n: 1 }] });
