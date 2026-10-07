// 动物能力的名称与说明（原版关键词，说明文字为本作撰写），以及单人模式的替换规则。
import { ACTION_INFO } from './rules';
import type { Ability, Continent } from './types';

const CONT: Record<Continent, string> = { africa: '非洲', europe: '欧洲', asia: '亚洲', americas: '美洲', australia: '大洋洲' };

export function abilityName(ab: Ability): string {
  switch (ab.k) {
    case 'sprint':
      return `冲刺 ${ab.n}`;
    case 'hunter':
      return `狩猎 ${ab.n}`;
    case 'perception':
      return `洞察 ${ab.n}`;
    case 'snap':
      return `抢夺 ${ab.n}`;
    case 'boost':
      return `助推：${ACTION_INFO[ab.action].name}`;
    case 'actionNow':
      return `行动：${ACTION_INFO[ab.action].name}`;
    case 'multiplier':
      return `倍增：${ACTION_INFO[ab.action].name}`;
    case 'clever':
      return '聪慧';
    case 'pack':
      return '群猎';
    case 'iconic':
      return `代表动物：${CONT[ab.cont]}`;
    case 'pouch':
      return `育儿袋 ${ab.n}`;
    case 'sunbathe':
      return `日光浴 ${ab.n}`;
    case 'venom':
      return `毒液 ${ab.n}`;
    case 'constrict':
      return '绞杀';
    case 'hypnosis':
      return `催眠 ${ab.n}`;
    case 'jump':
      return `跳跃 ${ab.n}`;
    case 'dig':
      return `掘地 ${ab.n}`;
    case 'posture':
      return `炫耀 ${ab.n}`;
    case 'resist':
      return '抗性';
    case 'assert':
      return '主张';
    case 'dominance':
      return '统治';
    case 'scavenge':
      return `拾荒 ${ab.n}`;
    case 'inventive':
      return `机灵 ${ab.n}`;
    case 'inventiveBear':
      return '机灵：熊';
    case 'inventivePrimate':
      return '机灵：灵长类';
    case 'fullThroated':
      return '高声呼唤';
    case 'flock':
      return '群居';
    case 'sponsorMagnet':
      return '赞助磁铁';
    case 'pilfer':
      return `掠夺 ${ab.n}`;
    case 'determination':
      return '决心';
    case 'peacock':
      return '开屏';
    case 'petting':
      return '萌宠';
  }
}

export function abilityText(ab: Ability): string {
  switch (ab.k) {
    case 'sprint':
      return `从牌库抽 ${ab.n} 张牌。`;
    case 'hunter':
      return `翻开牌库顶的 ${ab.n} 张牌，把其中 1 张动物卡加入手牌，其余弃掉。`;
    case 'perception':
      return `从牌库抽 ${ab.n} 张牌，保留 ${ab.keep} 张，其余弃掉。`;
    case 'snap':
      return ab.n > 1 ? `执行 ${ab.n} 次：从展示区任意位置拿 1 张牌（中间会补充展示区）。` : '从展示区任意位置拿 1 张牌。';
    case 'boost':
      return `这个行动结束后，可以把「${ACTION_INFO[ab.action].name}」行动卡放到 1 号位或 5 号位。`;
    case 'actionNow':
      return `这个行动结束后，可以再执行「${ACTION_INFO[ab.action].name}」行动。`;
    case 'multiplier':
      return `在你的「${ACTION_INFO[ab.action].name}」行动卡上放 1 个倍增标记：下次使用时可以执行 2 次（休息时清除）。`;
    case 'clever':
      return '这个行动结束后，可以把任一行动卡放到 1 号位。';
    case 'pack':
      return '你的动物园里每有 1 个食肉类图标，吸引力 +1。';
    case 'iconic':
      return `所有动物园里每有 1 个${CONT[ab.cont]}图标，吸引力 +1（最多 8）。`;
    case 'pouch':
      return `可以把最多 ${ab.n} 张手牌压在这张卡下，每张吸引力 +2。`;
    case 'sunbathe':
      return `可以出售最多 ${ab.n} 张手牌，每张 4 元。`;
    case 'venom':
      return `吸引力比你高的每位玩家获得 ${ab.n} 个毒液标记。（单人：改为机灵 ${ab.n}）`;
    case 'constrict':
      return '吸引力比你高、保护点数比你高的玩家，每项各获得 1 个绞杀标记。（单人：改为聪慧）';
    case 'hypnosis':
      return `这个行动结束后，可以执行吸引力最高的玩家 1–${ab.n} 号位上的 1 张行动卡（用后放回其 1 号位）。（单人：改为决心）`;
    case 'jump':
      return `休息标记前进 ${ab.n} 格，获得 ${ab.n} 元。`;
    case 'dig':
      return `最多 ${ab.n} 次：弃掉展示区的 1 张牌并补充，或者弃 1 张手牌再从牌库抽 1 张。`;
    case 'posture':
      return `最多 ${ab.n} 次：免费建造 1 个售货亭或凉亭。`;
    case 'resist':
      return '抽 2 张终局计分卡，保留 1 张，弃掉另 1 张。';
    case 'assert':
      return '可以把 1 个没用到的基础保护项目加入手牌。';
    case 'dominance':
      return '如果“灵长类”基础保护项目没用到，可以把它加入手牌。';
    case 'scavenge':
      return `洗混弃牌堆，抽 ${ab.n} 张，保留 1 张，其余弃掉。`;
    case 'inventive':
      return `获得 ${ab.n} 个 X 标记。`;
    case 'inventiveBear':
      return '所有动物园里每有 1 个熊图标，获得 1 个 X 标记（最多 3 个）。';
    case 'inventivePrimate':
      return '你的灵长类图标达到 1 / 3 / 5 个时，获得 1 / 2 / 3 个 X 标记。';
    case 'fullThroated':
      return '获得 1 名协会工人。';
    case 'flock':
      return '可以与 1 只食草动物合住同一个标准围栏（围栏要放得下它）。';
    case 'sponsorMagnet':
      return '把展示区所有的赞助卡加入手牌。';
    case 'pilfer':
      return ab.n > 1
        ? '分别向吸引力最高和保护点数最高的玩家掠夺：由对方决定给你 1 张随机手牌或 5 元。（单人：改为冲刺 2）'
        : '向吸引力最高的玩家掠夺：由对方决定给你 1 张随机手牌或 5 元。（单人：改为冲刺 1）';
    case 'determination':
      return '这个行动结束后，可以再执行 1 个其他行动。';
    case 'peacock':
      return '如果可能，可以免费建造 1 座大型鸟舍（不需要升级）。';
    case 'petting':
      return '只能住儿童动物园。你的动物园里每有 1 个萌宠图标，吸引力 +3。';
  }
}

/** 单人模式下替换的能力 */
export function soloAbility(ab: Ability): Ability {
  switch (ab.k) {
    case 'venom':
      return { k: 'inventive', n: ab.n };
    case 'constrict':
      return { k: 'clever' };
    case 'hypnosis':
      return { k: 'determination' };
    case 'pilfer':
      return { k: 'sprint', n: ab.n };
    default:
      return ab;
  }
}

/** 在行动结束之后才结算的能力 */
export function isPostAbility(ab: Ability): boolean {
  return ab.k === 'boost' || ab.k === 'actionNow' || ab.k === 'determination' || ab.k === 'clever' || ab.k === 'hypnosis';
}
