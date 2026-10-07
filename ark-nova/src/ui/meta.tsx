// 界面用的名称、颜色、图标与卡牌文字。
import type { ComponentChildren } from 'preact';
import { ACTION_INFO } from '../game/rules';
import type { Ability, AnimalCard, Category, Continent, Gain, Icon, Metric, Requirement, SponsorCard, SponsorEffect } from '../game/types';
import { categoryName, continentName } from '../game/query';

export const CONT_COLOR: Record<Continent, string> = {
  africa: '#d9822b',
  europe: '#4a72b0',
  asia: '#c4433a',
  americas: '#2f8f5b',
  australia: '#b8901c',
};

export const CONT_SHORT: Record<Continent, string> = { africa: '非', europe: '欧', asia: '亚', americas: '美', australia: '澳' };

export const CAT_EMOJI: Record<Category, string> = {
  predator: '🐾',
  herbivore: '🌿',
  bird: '🪶',
  reptile: '🦎',
  primate: '🐒',
  bear: '🐻',
  petting: '🧸',
};

export const CAT_COLOR: Record<Category, string> = {
  predator: '#8c3b2a',
  herbivore: '#4f7d2c',
  bird: '#2f7f9d',
  reptile: '#5f7a37',
  primate: '#8a5a2b',
  bear: '#5b4637',
  petting: '#c56a8a',
};

const CONTS = ['africa', 'europe', 'asia', 'americas', 'australia'];

export function IconBadge({ icon, size = 22, count }: { icon: Icon; size?: number; count?: number }) {
  const isCont = CONTS.includes(icon);
  const bg = icon === 'science' ? '#3c6e8f' : isCont ? CONT_COLOR[icon as Continent] : CAT_COLOR[icon as Category];
  const label = icon === 'science' ? '🔬' : isCont ? CONT_SHORT[icon as Continent] : CAT_EMOJI[icon as Category];
  return (
    <span
      class={`icon-badge ${isCont ? 'cont' : 'cat'}`}
      style={{ background: bg, width: size, height: size, fontSize: size * (isCont ? 0.55 : 0.6) }}
      title={iconLabel(icon)}
    >
      {label}
      {count !== undefined && <sup>{count}</sup>}
    </span>
  );
}

export function iconLabel(i: Icon): string {
  if (i === 'science') return '研究';
  if (CONTS.includes(i)) return continentName(i as Continent);
  return categoryName(i as Category);
}

export function actionName(a: string): string {
  return ACTION_INFO[a as keyof typeof ACTION_INFO]?.name ?? a;
}

export function abilityName(ab: Ability): string {
  switch (ab.k) {
    case 'sprint':
      return `冲刺 ${ab.n}`;
    case 'hunter':
      return `狩猎 ${ab.n}`;
    case 'perception':
      return `洞察 ${ab.n}`;
    case 'snap':
      return `抢先 ${ab.n}`;
    case 'boost':
      return `助推：${actionName(ab.action)}`;
    case 'clever':
      return '聪慧';
    case 'pack':
      return `群居：${categoryName(ab.cat)}`;
    case 'iconic':
      return `标志：${continentName(ab.cont)}`;
    case 'pouch':
      return '育儿袋';
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
      return '坚韧';
    case 'assert':
      return '霸主';
    case 'trade':
      return '交换';
    case 'scavenge':
      return `拾荒 ${ab.n}`;
    case 'xtoken':
      return `耐心 ${ab.n}`;
    case 'money':
      return `募捐 ${ab.n}`;
  }
}

export function abilityText(ab: Ability): string {
  switch (ab.k) {
    case 'sprint':
      return `从牌库抽 ${ab.n} 张牌。`;
    case 'hunter':
      return `翻开牌库顶 ${ab.n} 张，可以保留其中 1 张动物卡，其余弃掉。`;
    case 'perception':
      return `从牌库抽 ${ab.n} 张，保留其中 2 张，其余弃掉。`;
    case 'snap':
      return `从展示区任意位置拿 ${ab.n} 张牌（不受声望范围限制）。`;
    case 'boost':
      return `把你的「${actionName(ab.action)}」行动卡移到 5 号位。`;
    case 'clever':
      return '把你的任意一张行动卡移到 5 号位。';
    case 'pack':
      return `你的动物园中每有 1 个${categoryName(ab.cat)}图标（含它自己），获得 1 点吸引力，最多 5 点。`;
    case 'iconic':
      return `你的动物园中每有 1 个${continentName(ab.cont)}图标（含它自己），获得 1 点吸引力，最多 5 点。`;
    case 'pouch':
      return '可以把 1 张手牌放进它的育儿袋，获得 2 点吸引力。';
    case 'sunbathe':
      return `可以出售最多 ${ab.n} 张手牌，每张 4 元。`;
    case 'venom':
      return `吸引力比你高的每位对手失去 ${ab.n} 元。`;
    case 'constrict':
      return '吸引力比你高的每位对手，把各自 5 号位的行动卡移到 1 号位。';
    case 'hypnosis':
      return `选择一位对手位于 1–${ab.n} 号位的行动卡，以它所在位置的强度和正反面为你执行，之后那张卡移到对手的 1 号位。`;
    case 'jump':
      return `休息标记前进 ${ab.n} 格，获得 ${ab.n} 元。`;
    case 'dig':
      return `可以弃掉最多 ${ab.n} 张手牌，再抽同样数量的牌。`;
    case 'posture':
      return `免费建造 ${ab.n} 个凉亭。`;
    case 'resist':
      return '抽 2 张终局计分卡，保留 1 张。';
    case 'assert':
      return '免费建造一座爬行馆或大型鸟舍（不需要升级的建造行动）。';
    case 'trade':
      return '可以用 1 张手牌交换展示区（声望范围内）的 1 张牌。';
    case 'scavenge':
      return `从弃牌堆随机翻开 ${ab.n} 张，保留 1 张。`;
    case 'xtoken':
      return `获得 ${ab.n} 个 X 标记。`;
    case 'money':
      return `获得 ${ab.n} 元。`;
  }
}

export function reqText(r: Requirement): string {
  switch (r.k) {
    case 'icon':
      return `需要 ${r.n} 个${iconLabel(r.icon)}图标`;
    case 'rep':
      return `需要声望 ${r.n}`;
    case 'upgrade':
      return `需要升级的「${actionName(r.action)}」`;
    case 'partner':
      return `需要${continentName(r.continent)}合作动物园`;
  }
}

export function gainParts(gn: Gain): ComponentChildren[] {
  const out: ComponentChildren[] = [];
  if (gn.appeal) out.push(<span class="g-appeal">吸引力 +{gn.appeal}</span>);
  if (gn.cp) out.push(<span class="g-cp">保护点数 +{gn.cp}</span>);
  if (gn.rep) out.push(<span class="g-rep">声望 +{gn.rep}</span>);
  if (gn.money) out.push(<span class="g-money">+{gn.money} 元</span>);
  if (gn.x) out.push(<span>X 标记 +{gn.x}</span>);
  if (gn.cards) out.push(<span>抽 {gn.cards} 张</span>);
  if (gn.worker) out.push(<span>协会工人 +{gn.worker}</span>);
  if (gn.upgrade) out.push(<span>升级行动卡</span>);
  return out;
}

export function metricText(m: Metric): string {
  switch (m.m) {
    case 'icon':
      return `${iconLabel(m.icon)}图标`;
    case 'animals':
      return '动物';
    case 'kiosks':
      return '售货亭';
    case 'pavilions':
      return '凉亭';
    case 'partners':
      return '合作动物园';
    case 'universities':
      return '大学';
    case 'partnersUnis':
      return '合作动物园与大学';
    case 'sponsors':
      return '赞助卡';
    case 'projects':
      return '支持的保护项目';
    case 'catKinds':
      return '动物种类';
    case 'contKinds':
      return '大洲';
    case 'rep':
      return '声望';
    case 'covered':
      return '被覆盖的格子';
    case 'fullEnclosures':
      return '住满的围栏';
    case 'waterAnimals':
      return '水边的动物';
    case 'rockAnimals':
      return '岩石边的动物';
    case 'specialAnimals':
      return '特殊场馆中的动物';
    case 'upgrades':
      return '升级的行动卡';
    case 'money':
      return '钱';
  }
}

export function effectSummary(e: SponsorEffect): string {
  switch (e.k) {
    case 'income':
      return `休息收入 +${e.money}`;
    case 'incomePer':
      return `休息时每 ${e.per} 个${metricText(e.metric)} +${e.money} 元`;
    default:
      return '';
  }
}

export function sponsorHasBuilding(c: SponsorCard): boolean {
  return !!c.building;
}

export function animalSizeLabel(a: AnimalCard): string {
  if (a.size === 0) return '宠物';
  return String(a.size);
}

export function specialName(kind: string): string {
  return { petting: '儿童动物园', reptile: '爬行馆', aviary: '大型鸟舍' }[kind] ?? kind;
}
