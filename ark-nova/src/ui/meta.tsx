// 界面用的名称、颜色、图标与卡牌文字。
import type { ComponentChildren } from 'preact';
import { abilityName, abilityText } from '../game/abilities';
import { categoryName, continentName, reqLabel } from '../game/query';
import { ACTION_INFO } from '../game/rules';
import type { AnimalCard, Category, Continent, Gain, Icon, Requirement } from '../game/types';

export { abilityName, abilityText };

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

export function iconStyle(icon: Icon): { bg: string; label: string; cont: boolean } {
  if (icon === 'science') return { bg: '#3c6e8f', label: '🔬', cont: false };
  if (icon === 'water') return { bg: '#3f8fc0', label: '💧', cont: false };
  if (icon === 'rock') return { bg: '#86796a', label: '🪨', cont: false };
  if (CONTS.includes(icon)) return { bg: CONT_COLOR[icon as Continent], label: CONT_SHORT[icon as Continent], cont: true };
  return { bg: CAT_COLOR[icon as Category], label: CAT_EMOJI[icon as Category], cont: false };
}

export function IconBadge({ icon, size = 22, count }: { icon: Icon; size?: number; count?: number }) {
  const st = iconStyle(icon);
  return (
    <span
      class={`icon-badge ${st.cont ? 'cont' : 'cat'}`}
      style={{ background: st.bg, width: size, height: size, fontSize: size * (st.cont ? 0.55 : 0.6) }}
      title={iconLabel(icon)}
    >
      {st.label}
      {count !== undefined && <sup>{count}</sup>}
    </span>
  );
}

export function iconLabel(i: Icon): string {
  if (i === 'science') return '研究';
  if (i === 'water') return '水';
  if (i === 'rock') return '岩石';
  if (CONTS.includes(i)) return continentName(i as Continent);
  return categoryName(i as Category);
}

export function actionName(a: string): string {
  return ACTION_INFO[a as keyof typeof ACTION_INFO]?.name ?? a;
}

export function reqText(r: Requirement): string {
  return `需要${reqLabel(r)}`;
}

/** 条件的简短标记 */
export function reqShortLabel(r: Requirement): string {
  switch (r.k) {
    case 'icon':
      return `${iconStyle(r.icon).label}${r.n}`;
    case 'rep':
      return `⭐${r.n}`;
    case 'upgrade':
      return 'II';
    case 'partner':
      return '🤝';
    case 'partners':
      return `🤝${r.n}`;
    case 'appealMax':
      return `≤${r.n}`;
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

export function animalSizeLabel(a: AnimalCard): string {
  if (a.noStandard) return '宠物';
  return String(a.size);
}

export function specialName(kind: string): string {
  return { petting: '儿童动物园', reptile: '爬行馆', aviary: '大型鸟舍' }[kind] ?? kind;
}

/** 动物卡的主色（第一个大洲） */
export function animalColor(a: AnimalCard): string {
  const c = a.icons.find((i) => CONTS.includes(i)) as Continent | undefined;
  return c ? CONT_COLOR[c] : '#c56a8a';
}
