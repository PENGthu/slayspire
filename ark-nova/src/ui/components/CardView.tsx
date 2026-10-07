// 卡牌外观：动物卡、赞助卡、保护项目卡。三种尺寸：sm（手牌）、md（展示区）、lg（详情）。
// 卡牌功能复刻原版，文字由本作撰写，插图为自绘的风景加表情符号。
import { card } from '../../game/content';
import { releaseLabel } from '../../game/query';
import { cpPoints } from '../../game/rules';
import type { AnimalCard, Icon, ProjectCard, SponsorCard } from '../../game/types';
import { IconBadge, abilityName, abilityText, animalColor, gainParts, iconLabel, reqShortLabel, reqText, specialName } from '../meta';
import { CardArt } from './CardArt';

export type CardSize = 'sm' | 'md' | 'lg';

interface Props {
  id: string;
  size?: CardSize;
  selected?: boolean;
  playable?: boolean;
  dim?: boolean;
  badge?: string;
  onClick?: () => void;
  onInfo?: () => void;
}

export function CardView({ id, size = 'md', selected, playable, dim, badge, onClick, onInfo }: Props) {
  const c = card(id);
  const cls = ['card', `card-${c.kind}`, `card-${size}`, selected && 'selected', playable && 'playable', dim && 'dim', onClick && 'clickable']
    .filter(Boolean)
    .join(' ');
  const onCtx = (e: MouseEvent) => {
    if (!onInfo) return;
    e.preventDefault();
    onInfo();
  };
  return (
    <div class={cls} onClick={onClick} onContextMenu={onCtx} style={c.kind === 'animal' ? { '--cc': animalColor(c) } : undefined}>
      {c.kind === 'animal' && <AnimalBody a={c} size={size} />}
      {c.kind === 'sponsor' && <SponsorBody s={c} size={size} />}
      {c.kind === 'project' && <ProjectBody p={c} size={size} />}
      {badge && <span class="card-badge">{badge}</span>}
      {onInfo && size !== 'lg' && (
        <button
          class="card-info"
          title="查看详情"
          onClick={(e) => {
            e.stopPropagation();
            onInfo();
          }}
        >
          i
        </button>
      )}
    </div>
  );
}

export { animalColor };

function Icons({ icons, size }: { icons: Icon[]; size: CardSize }) {
  if (!icons.length) return null;
  return (
    <div class="card-icons">
      {icons.map((i) => (
        <IconBadge icon={i} size={size === 'lg' ? 26 : 18} />
      ))}
    </div>
  );
}

function AnimalBody({ a, size }: { a: AnimalCard; size: CardSize }) {
  const abs = a.abilities ?? [];
  return (
    <>
      <div class="card-top">
        <span class="cost" title="费用">
          {a.cost}
        </span>
        <span class="card-num">#{a.num}</span>
        <span class={`size ${a.noStandard ? 'pet' : ''}`} title={a.noStandard ? '只能放进儿童动物园' : `需要不小于 ${a.size} 格的标准围栏`}>
          {a.noStandard ? '🎠' : a.size}
        </span>
      </div>
      <div class="card-art">
        <CardArt c={a} />
        <span class="emoji">{a.emoji}</span>
        {a.special && !a.noStandard && (
          <span class="alt-encl" title={`也可以放进${specialName(a.special.kind)}（占 ${a.special.units} 格容量）`}>
            {a.special.kind === 'reptile' ? '🏚️' : '🪺'}
            {a.special.units}
          </span>
        )}
        <Icons icons={a.icons} size={size} />
      </div>
      <div class="card-name">
        {a.name}
        {size === 'lg' && <small>{a.en}</small>}
      </div>
      <div class="card-req">
        {(a.water ?? 0) > 0 && <span title={`围栏需与 ${a.water} 个水域格相邻`}>💧{a.water}</span>}
        {(a.rock ?? 0) > 0 && <span title={`围栏需与 ${a.rock} 个岩石格相邻`}>🪨{a.rock}</span>}
        {(a.req ?? []).map((r) => (
          <span class="req" title={reqText(r)}>
            {reqShortLabel(r)}
          </span>
        ))}
      </div>
      {abs.length > 0 && (
        <div class="card-ability" title={abs.map((ab) => `${abilityName(ab)}：${abilityText(ab)}`).join('\n')}>
          {size === 'lg' ? (
            abs.map((ab) => (
              <p>
                <b>{abilityName(ab)}</b>：{abilityText(ab)}
              </p>
            ))
          ) : (
            <b>{abs.map(abilityName).join(' · ')}</b>
          )}
        </div>
      )}
      <div class="card-reward">
        <span class="r-appeal" title="吸引力">
          {a.appeal}
        </span>
        {(a.cp ?? 0) > 0 && (
          <span class="r-cp" title="保护点数">
            {a.cp}
          </span>
        )}
        {(a.rep ?? 0) > 0 && (
          <span class="r-rep" title="声望">
            {a.rep}
          </span>
        )}
      </div>
      {size === 'lg' && (
        <div class="card-detail">
          {a.noStandard ? <p>宠物动物：只能放进儿童动物园（最多 3 只）。</p> : <p>需要不小于 {a.size} 格的标准围栏。</p>}
          {a.special && !a.noStandard && (
            <p>
              也可以放进{specialName(a.special.kind)}，占 {a.special.units} 格容量（共 5 格）。
            </p>
          )}
          {(a.water ?? 0) > 0 && <p>放在标准围栏时，围栏需要与至少 {a.water} 个水域格相邻（同时算作水图标）。</p>}
          {(a.rock ?? 0) > 0 && <p>放在标准围栏时，围栏需要与至少 {a.rock} 个岩石格相邻（同时算作岩石图标）。</p>}
          {(a.req ?? []).map((r) => (
            <p>{reqText(r)}。</p>
          ))}
          <p>
            打出时：吸引力 +{a.appeal}
            {a.cp ? `，保护点数 +${a.cp}` : ''}
            {a.rep ? `，声望 +${a.rep}` : ''}。
          </p>
        </div>
      )}
    </>
  );
}

function SponsorBody({ s, size }: { s: SponsorCard; size: CardSize }) {
  return (
    <>
      <div class="card-top">
        <span class="level" title={`等级 ${s.level}：需要强度不低于 ${s.level} 的赞助行动`}>
          {s.level}
        </span>
        <span class="card-num">#{s.num}</span>
        <span class="kind-tag">赞助</span>
      </div>
      <div class="card-art">
        <CardArt c={s} />
        <span class="emoji">{s.emoji}</span>
        <Icons icons={s.icons} size={size} />
      </div>
      <div class="card-name">
        {s.name}
        {size === 'lg' && <small>{s.en}</small>}
      </div>
      {(s.req ?? []).length > 0 && (
        <div class="card-req">
          {s.req!.map((r) => (
            <span class="req" title={reqText(r)}>
              {reqShortLabel(r)}
            </span>
          ))}
        </div>
      )}
      <div class="card-text">{s.text}</div>
      {size === 'lg' && (
        <div class="card-detail">
          <p>等级 {s.level}：需要强度不低于 {s.level} 的赞助行动才能打出（升级后可以一次打出多张，总等级不超过强度 + 1）。</p>
          {(s.req ?? []).map((r) => (
            <p>{reqText(r)}。</p>
          ))}
          {s.icons.length > 0 && <p>提供图标：{s.icons.map(iconLabel).join('、')}。</p>}
          {s.gain && <p>立即获得：{gainParts(s.gain).map((x, i) => [i ? '，' : '', x])}</p>}
          {s.building && <p>专属建筑：打出时免费放进你的动物园（{s.building.shape.length} 格，形状见插图右下角），遵守建造规则。</p>}
        </div>
      )}
    </>
  );
}

function goalView(p: ProjectCard, size: CardSize) {
  const icon = (i: Icon) => <IconBadge icon={i} size={size === 'lg' ? 30 : 22} />;
  switch (p.goal.k) {
    case 'icon':
      return icon(p.goal.icon);
    case 'kinds':
      return <span class="goal-text">{p.goal.of === 'category' ? '不同种类' : '不同大洲'}</span>;
    case 'small':
      return <span class="goal-text">小型动物</span>;
    case 'large':
      return <span class="goal-text">大型动物</span>;
    case 'release':
      return (
        <>
          {icon(p.goal.icon)}
          <span class="goal-text">放归</span>
        </>
      );
    case 'breed':
      return (
        <>
          {icon(p.goal.cat)}
          <span class="goal-text">繁育</span>
        </>
      );
  }
}

export function projectGoalText(p: ProjectCard): string {
  switch (p.goal.k) {
    case 'icon':
      return `${iconLabel(p.goal.icon)}图标`;
    case 'kinds':
      return p.goal.of === 'category' ? '不同的动物种类图标' : '不同的大洲图标';
    case 'small':
      return '小型动物（体型 ≤2）';
    case 'large':
      return '大型动物（体型 ≥4）';
    case 'release':
      return `把 1 只带${iconLabel(p.goal.icon)}图标的动物放归野外（失去它的吸引力）`;
    case 'breed':
      return `动物园里有 1 只${iconLabel(p.goal.cat)}动物，并且有与它同大洲的合作动物园`;
  }
}

export function levelNeedText(p: ProjectCard, i: number): string {
  const lv = p.levels[i];
  if (p.goal.k === 'release') return releaseLabel(i);
  if (p.goal.k === 'breed') return `${lv.cp}🌿${lv.rep ? `+${lv.rep}⭐` : ''}`;
  return `×${lv.need}`;
}

function ProjectBody({ p, size }: { p: ProjectCard; size: CardSize }) {
  return (
    <>
      <div class="card-top">
        <span class="kind-tag">保护项目</span>
        <span class="card-num">{p.base ? '基础' : `#${p.num}`}</span>
      </div>
      <div class="card-art small">
        <CardArt c={p} />
        <span class="emoji">{p.emoji}</span>
        <div class="goal">{goalView(p, size)}</div>
      </div>
      <div class="card-name">{p.name}</div>
      <div class="levels">
        {p.levels.map((lv, i) => (
          <div class="lv">
            <span class="need">{p.goal.k === 'breed' ? `第 ${i + 1} 档` : levelNeedText(p, i)}</span>
            <span class="r-cp">{lv.cp}</span>
          </div>
        ))}
      </div>
      {size === 'lg' && (
        <div class="card-detail">
          <p>目标：{projectGoalText(p)}。</p>
          <p>每一档只能由一位玩家占据，每位玩家每个项目只能支持一次。支持时从地图左侧拿走 1 个玩家标记放到这一档，获得露出的奖励。</p>
          {p.levels.map((lv, i) => (
            <p>
              {p.goal.k === 'release' ? `放归${releaseLabel(i)}的动物` : p.goal.k === 'breed' ? `第 ${i + 1} 档` : `达到 ${lv.need} 个`}：获得 {lv.cp} 保护点数（约{' '}
              {cpPoints(lv.cp) + 14} 分）{lv.rep ? `，声望 +${lv.rep}` : ''}
            </p>
          ))}
          {p.base && <p>基础项目：开局随机摆出 3 个，其余的可以被“主张”“统治”能力拿到手里。</p>}
        </div>
      )}
    </>
  );
}
