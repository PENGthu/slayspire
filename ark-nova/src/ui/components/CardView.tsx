// 卡牌外观：动物卡、赞助卡、保护项目卡。三种尺寸：sm（手牌）、md（展示区）、lg（详情）。
import { card } from '../../game/content';
import { cpPoints } from '../../game/rules';
import type { AnimalCard, ProjectCard, SponsorCard } from '../../game/types';
import {
  CONT_COLOR,
  IconBadge,
  abilityName,
  abilityText,
  gainParts,
  iconLabel,
  metricText,
  reqText,
  specialName,
} from '../meta';

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

export function animalColor(a: AnimalCard): string {
  if (!a.continents.length) return '#c56a8a';
  return CONT_COLOR[a.continents[0]];
}

function AnimalBody({ a, size }: { a: AnimalCard; size: CardSize }) {
  return (
    <>
      <div class="card-top">
        <span class="cost" title="费用">
          {a.cost}
        </span>
        <span class="card-num">#{a.num}</span>
        <span class={`size ${a.size === 0 ? 'pet' : ''}`} title={a.size ? `需要不小于 ${a.size} 格的标准围栏` : '只能放进儿童动物园'}>
          {a.size === 0 ? '🎠' : a.size}
        </span>
      </div>
      <div class="card-art">
        <span class="emoji">{a.emoji}</span>
        {a.special && a.size > 0 && (
          <span class="alt-encl" title={`也可以放进${specialName(a.special.kind)}（占 ${a.special.units} 格容量）`}>
            {a.special.kind === 'reptile' ? '🏛️' : a.special.kind === 'aviary' ? '🪺' : '🎠'}
            {a.special.units}
          </span>
        )}
        <div class="card-icons">
          {a.continents.map((c) => (
            <IconBadge icon={c} size={size === 'lg' ? 26 : 18} />
          ))}
          {a.categories.map((c) => (
            <IconBadge icon={c} size={size === 'lg' ? 26 : 18} />
          ))}
        </div>
      </div>
      <div class="card-name">
        {a.name}
        {size === 'lg' && <small>{a.en}</small>}
      </div>
      <div class="card-req">
        {(a.water ?? 0) > 0 && <span title={`围栏需与 ${a.water} 格水域相邻`}>💧{a.water}</span>}
        {(a.rock ?? 0) > 0 && <span title={`围栏需与 ${a.rock} 格岩石相邻`}>🪨{a.rock}</span>}
        {(a.req ?? []).map((r) => (
          <span class="req" title={reqText(r)}>
            {r.k === 'rep' ? `⭐${r.n}` : r.k === 'upgrade' ? 'II' : r.k === 'icon' ? `${r.icon === 'science' ? '🔬' : iconLabel(r.icon)}${r.n}` : '🤝'}
          </span>
        ))}
      </div>
      {a.ability && (
        <div class="card-ability" title={abilityText(a.ability)}>
          <b>{abilityName(a.ability)}</b>
          {size === 'lg' && <span>：{abilityText(a.ability)}</span>}
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
          {a.size === 0 ? <p>宠物动物：只能放进儿童动物园。</p> : <p>需要不小于 {a.size} 格的标准围栏。</p>}
          {a.special && a.size > 0 && (
            <p>
              也可以放进{specialName(a.special.kind)}，占 {a.special.units} 格容量。
            </p>
          )}
          {(a.water ?? 0) > 0 && <p>所在建筑需要与至少 {a.water} 格水域相邻。</p>}
          {(a.rock ?? 0) > 0 && <p>所在建筑需要与至少 {a.rock} 格岩石相邻。</p>}
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
        <span class="level" title={`需要强度不低于 ${s.level} 的赞助行动`}>
          {s.level}
        </span>
        <span class="card-num">#{s.num}</span>
        <span class="kind-tag">赞助</span>
      </div>
      <div class="card-art">
        <span class="emoji">{s.emoji}</span>
        {s.icons.length > 0 && (
          <div class="card-icons">
            {s.icons.map((i) => (
              <IconBadge icon={i} size={size === 'lg' ? 26 : 18} />
            ))}
          </div>
        )}
      </div>
      <div class="card-name">{s.name}</div>
      {(s.req ?? []).length > 0 && (
        <div class="card-req">
          {s.req!.map((r) => (
            <span class="req" title={reqText(r)}>
              {r.k === 'rep' ? `⭐${r.n}` : r.k === 'icon' ? `${r.icon === 'science' ? '🔬' : iconLabel(r.icon)}${r.n}` : 'II'}
            </span>
          ))}
        </div>
      )}
      <div class="card-text">{s.text}</div>
      {size === 'lg' && (
        <div class="card-detail">
          <p>等级 {s.level}：需要强度不低于 {s.level} 的赞助行动才能打出。</p>
          {(s.req ?? []).map((r) => (
            <p>{reqText(r)}。</p>
          ))}
          {s.icons.length > 0 && <p>提供图标：{s.icons.map(iconLabel).join('、')}。</p>}
          {s.gain && <p>立即获得：{gainParts(s.gain).map((x, i) => [i ? '，' : '', x])}</p>}
          {s.building && <p>专属建筑：打出时免费放进你的动物园（{s.building.shape.length} 格），遵守建造规则。</p>}
        </div>
      )}
    </>
  );
}

function ProjectBody({ p, size }: { p: ProjectCard; size: CardSize }) {
  const goal =
    p.goal.k === 'icon' ? (
      <IconBadge icon={p.goal.icon} size={size === 'lg' ? 30 : 22} />
    ) : p.goal.k === 'release' ? (
      <span class="goal-text">放归</span>
    ) : (
      <span class="goal-text">{metricText(p.goal.metric)}</span>
    );
  return (
    <>
      <div class="card-top">
        <span class="kind-tag">保护项目</span>
        <span class="card-num">{p.base ? '基础' : `#${p.num}`}</span>
      </div>
      <div class="card-art small">
        <span class="emoji">{p.emoji}</span>
        <div class="goal">{goal}</div>
      </div>
      <div class="card-name">{p.name}</div>
      <div class="levels">
        {p.levels.map((lv) => (
          <div class="lv">
            <span class="need">{p.goal.k === 'release' ? `体型≥${lv.need}` : `×${lv.need}`}</span>
            <span class="r-cp">{lv.cp}</span>
          </div>
        ))}
      </div>
      {size === 'lg' && (
        <div class="card-detail">
          <p>{p.text}</p>
          <p>每一档只能由一位玩家占据，每位玩家每个项目只能支持一次。</p>
          {p.levels.map((lv) => (
            <p>
              {p.goal.k === 'release' ? `放归体型 ≥ ${lv.need} 的动物` : `达到 ${lv.need} 个`}：获得 {lv.cp} 保护点数（约 {cpPoints(lv.cp)} 分）
            </p>
          ))}
        </div>
      )}
    </>
  );
}
