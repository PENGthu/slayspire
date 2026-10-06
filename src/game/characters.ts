import type { CharId } from './types';

export interface CharDef {
  id: CharId;
  name: string;
  title: string;
  desc: string;
  hp: number;
  gold: number;
  relic: string;
  deck: string[];
  /** 主题色 */
  color: string;
  art: string;
  mechanic: string;
}

export const CHARACTERS: Record<CharId, CharDef> = {
  ironclad: {
    id: 'ironclad',
    name: '铁甲战士',
    title: '燃血的老兵',
    desc: '铁甲军团最后的幸存者。用恶魔之力换来了不死之躯，以力量和消耗压垮敌人。',
    hp: 80,
    gold: 99,
    relic: 'burning_blood',
    deck: ['strike_r', 'strike_r', 'strike_r', 'strike_r', 'strike_r', 'defend_r', 'defend_r', 'defend_r', 'defend_r', 'bash'],
    color: '#c0392b',
    art: 'ironclad',
    mechanic: '力量 · 消耗 · 自我伤害',
  },
  silent: {
    id: 'silent',
    name: '静默猎手',
    title: '雾林的猎人',
    desc: '来自雾林的猎手。用毒药、小刀和弃牌技巧，以千百道伤口拖垮强敌。',
    hp: 70,
    gold: 99,
    relic: 'ring_of_snake',
    deck: [
      'strike_g', 'strike_g', 'strike_g', 'strike_g', 'strike_g',
      'defend_g', 'defend_g', 'defend_g', 'defend_g', 'defend_g',
      'neutralize', 'survivor',
    ],
    color: '#3f9b5a',
    art: 'silent',
    mechanic: '中毒 · 小刀 · 弃牌',
  },
  regent: {
    id: 'regent',
    name: '储君',
    title: '群星的继承者',
    desc: '星辰王朝的继承人。积攒星辰之力，锻造君王之刃，以天体的力量裁决万物。',
    hp: 75,
    gold: 99,
    relic: 'divine_right',
    deck: ['strike_o', 'strike_o', 'strike_o', 'strike_o', 'defend_o', 'defend_o', 'defend_o', 'defend_o', 'falling_star', 'venerate'],
    color: '#e08a1e',
    art: 'regent',
    mechanic: '星辰 · 铸造君王之刃',
  },
  necrobinder: {
    id: 'necrobinder',
    name: '亡灵契约师',
    title: '与死亡缔约者',
    desc: '一位与死亡签下契约的施法者。召唤骸骨伙伴奥斯提替她作战，并以灾厄宣告敌人的终结。',
    hp: 70,
    gold: 99,
    relic: 'bound_phylactery',
    deck: [
      'strike_n', 'strike_n', 'strike_n', 'strike_n',
      'defend_n', 'defend_n', 'defend_n', 'defend_n',
      'bodyguard', 'unleash',
    ],
    color: '#b0509a',
    art: 'necrobinder',
    mechanic: '召唤奥斯提 · 灾厄 · 灵魂',
  },
  defect: {
    id: 'defect',
    name: '故障机器人',
    title: '觉醒的机械',
    desc: '一具在尖塔深处苏醒的战斗机械。生成闪电、冰霜、黑暗与等离子充能球，并用集中强化它们。',
    hp: 70,
    gold: 99,
    relic: 'cracked_core',
    deck: ['strike_b', 'strike_b', 'strike_b', 'strike_b', 'defend_b', 'defend_b', 'defend_b', 'defend_b', 'zap', 'dualcast'],
    color: '#3a8fd6',
    art: 'defect',
    mechanic: '充能球 · 集中',
  },
  claude: {
    id: 'claude',
    name: 'Claude（小克）',
    title: '终端里的小助手',
    desc: '从命令行里蹦出来的橙色小家伙。先思考再动手：写进上下文，装满就压缩成摘要，还会调用工具。',
    hp: 72,
    gold: 99,
    relic: 'the_spark',
    deck: ['strike_c', 'strike_c', 'strike_c', 'strike_c', 'defend_c', 'defend_c', 'defend_c', 'defend_c', 'ponder', 'tool_use'],
    color: '#d97757',
    art: 'claude',
    mechanic: '思考 · 上下文 · 工具',
  },
};

export const CHAR_ORDER: CharId[] = ['ironclad', 'silent', 'regent', 'necrobinder', 'defect', 'claude'];
