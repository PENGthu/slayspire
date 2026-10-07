// 卡牌图鉴：按类型、大洲、种类筛选。
import { useState } from 'preact/hooks';
import { ANIMALS, PROJECTS, SCORING, SPONSORS } from '../../game/content';
import { categoryName, continentName } from '../../game/query';
import type { Category, Continent } from '../../game/types';
import { CATEGORIES, CONTINENTS } from '../../game/types';
import { CardView } from '../components/CardView';
import { ScoringCardView } from '../components/Common';
import { CardModal } from '../components/Decision';
import { set, useStore } from '../store';

type Kind = 'animal' | 'sponsor' | 'project' | 'scoring';

export function CompendiumScreen() {
  const s = useStore();
  const [kind, setKind] = useState<Kind>('animal');
  const [cont, setCont] = useState<Continent | 'all' | 'none'>('all');
  const [cat, setCat] = useState<Category | 'all'>('all');
  const [q, setQ] = useState('');
  const match = (name: string, en = '') => !q || name.includes(q) || en.toLowerCase().includes(q.toLowerCase());
  let list: string[] = [];
  if (kind === 'animal') {
    list = ANIMALS.filter(
      (a) =>
        (cont === 'all' || (cont === 'none' ? !a.continents.length : a.continents.includes(cont))) &&
        (cat === 'all' || a.categories.includes(cat)) &&
        match(a.name, a.en),
    ).map((a) => a.id);
  } else if (kind === 'sponsor') list = SPONSORS.filter((c) => match(c.name, c.text)).map((c) => c.id);
  else if (kind === 'project') list = PROJECTS.filter((c) => match(c.name)).map((c) => c.id);
  return (
    <div class="page-screen">
      <div class="page-head">
        <button onClick={() => set({ screen: 'menu' })}>← 返回</button>
        <h2>卡牌图鉴</h2>
        <input placeholder="搜索名称…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      </div>
      <div class="filters">
        {(
          [
            ['animal', `动物 ${ANIMALS.length}`],
            ['sponsor', `赞助 ${SPONSORS.length}`],
            ['project', `保护项目 ${PROJECTS.length}`],
            ['scoring', `终局计分 ${SCORING.length}`],
          ] as const
        ).map(([k, label]) => (
          <button class={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
            {label}
          </button>
        ))}
      </div>
      {kind === 'animal' && (
        <div class="filters small">
          <button class={cont === 'all' ? 'on' : ''} onClick={() => setCont('all')}>
            全部大洲
          </button>
          {CONTINENTS.map((c) => (
            <button class={cont === c ? 'on' : ''} onClick={() => setCont(c)}>
              {continentName(c)}
            </button>
          ))}
          <button class={cont === 'none' ? 'on' : ''} onClick={() => setCont('none')}>
            宠物
          </button>
          <span class="sep" />
          <button class={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>
            全部种类
          </button>
          {CATEGORIES.filter((c) => c !== 'petting').map((c) => (
            <button class={cat === c ? 'on' : ''} onClick={() => setCat(c)}>
              {categoryName(c)}
            </button>
          ))}
        </div>
      )}
      <div class="page-body grid">
        {kind === 'scoring'
          ? SCORING.map((c) => <ScoringCardView id={c.id} />)
          : list.map((id) => <CardView id={id} size="md" onClick={() => set({ modal: { k: 'card', id } })} />)}
      </div>
      {s.modal?.k === 'card' && <CardModal id={s.modal.id} />}
    </div>
  );
}
