// 卡面插图（本作自行绘制）：按动物的大洲、种类、水域 / 岩石需求生成一幅小风景，
// 赞助卡画出专属建筑的形状或人物聚光灯，保护项目画地球与树叶；动物本身用表情符号表示。
import { hexCorners, hexToPixel } from '../../game/hex';
import type { AnimalCard, Card, Category, Continent, ProjectCard, SponsorCard } from '../../game/types';

const SKY: Record<Continent | 'none', [string, string]> = {
  africa: ['#f6c77e', '#fbe7bf'],
  europe: ['#a9cbe8', '#e3eef7'],
  asia: ['#f2b8ae', '#fbe6dc'],
  americas: ['#a6d8bd', '#e6f4e6'],
  australia: ['#f3c98a', '#fbe9c8'],
  none: ['#f6c6d6', '#fdeef3'],
};

const GROUND: Record<Category | 'none', [string, string]> = {
  predator: ['#d9b36a', '#c49a50'],
  herbivore: ['#a9cc6c', '#8db455'],
  bird: ['#b9d98e', '#9cc472'],
  reptile: ['#dcc58e', '#c8ad72'],
  primate: ['#78b065', '#5f9850'],
  bear: ['#8fae7a', '#728f60'],
  petting: ['#b5d985', '#98c268'],
  none: ['#b5d985', '#98c268'],
};

const CONTS: Continent[] = ['africa', 'europe', 'asia', 'americas', 'australia'];
const CATS: Category[] = ['predator', 'herbivore', 'bird', 'reptile', 'primate', 'bear', 'petting'];

/** 简单的确定性伪随机（按卡牌编号） */
function rnd(seed: number, k: number): number {
  const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function Sky({ id, colors }: { id: string; colors: [string, string] }) {
  return (
    <>
      <defs>
        <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={colors[1]} />
          <stop offset="1" stop-color={colors[0]} />
        </linearGradient>
      </defs>
      <rect width="100" height="60" fill={`url(#sky-${id})`} />
    </>
  );
}

function AnimalScene({ a }: { a: AnimalCard }) {
  const cont = (a.icons.find((i) => CONTS.includes(i as Continent)) as Continent | undefined) ?? 'none';
  const cat = (a.icons.find((i) => CATS.includes(i as Category)) as Category | undefined) ?? 'none';
  const s = a.num;
  const [g1, g2] = GROUND[cat];
  const sunX = 15 + rnd(s, 1) * 70;
  const h1 = 34 + rnd(s, 2) * 8;
  const h2 = 30 + rnd(s, 3) * 10;
  const id = `a${a.num}`;
  const decor = [];
  if (cat === 'predator' || (cat === 'herbivore' && cont === 'africa')) {
    // 金合欢树
    const tx = rnd(s, 4) > 0.5 ? 80 : 18;
    decor.push(
      <g opacity="0.75">
        <rect x={tx - 1} y="30" width="2" height="14" fill="#6b4b2a" />
        <ellipse cx={tx} cy="29" rx="12" ry="3.5" fill="#5f7d3a" />
      </g>,
    );
  }
  if (cat === 'primate') {
    decor.push(
      <g fill="#3f7d3a" opacity="0.8">
        <ellipse cx="6" cy="4" rx="12" ry="7" />
        <ellipse cx="94" cy="3" rx="13" ry="7" />
        <path d="M14 6 Q16 18 13 26" stroke="#4f6b2a" stroke-width="1" fill="none" />
        <path d="M86 6 Q83 16 86 22" stroke="#4f6b2a" stroke-width="1" fill="none" />
      </g>,
    );
  }
  if (cat === 'bird') {
    decor.push(
      <g fill="none" stroke="#4d5b66" stroke-width="0.9" opacity="0.7">
        <path d={`M${20 + rnd(s, 5) * 20} 14 q3 -3 6 0 q3 -3 6 0`} />
        <path d={`M${60 + rnd(s, 6) * 20} 9 q2 -2 4 0 q2 -2 4 0`} />
      </g>,
      <ellipse cx={30 + rnd(s, 7) * 40} cy="18" rx="10" ry="3.2" fill="#ffffff" opacity="0.7" />,
    );
  }
  if (cat === 'bear') {
    decor.push(
      <g fill="#3f6b4a" opacity="0.75">
        <path d="M8 40 L14 22 L20 40 Z" />
        <path d="M16 42 L22 26 L28 42 Z" />
        <path d="M80 41 L87 24 L94 41 Z" />
      </g>,
    );
  }
  if (cat === 'reptile') {
    decor.push(<path d="M0 46 Q25 38 50 45 T100 43 L100 60 L0 60 Z" fill="#e8d39c" opacity="0.8" />);
  }
  if (cat === 'petting') {
    decor.push(
      <g stroke="#8a6a46" stroke-width="1.2" opacity="0.75">
        <path d="M0 44 H100 M0 49 H100" />
        {[6, 22, 38, 54, 70, 86].map((x) => (
          <path d={`M${x} 40 V52`} />
        ))}
      </g>,
    );
  }
  if (cat === 'herbivore' && cont !== 'africa') {
    decor.push(
      <g fill="#6f9d45" opacity="0.8">
        {[12, 30, 70, 88].map((x, k) => (
          <path d={`M${x} 52 l2 -6 l2 6 l2 -5 l2 5 Z`} transform={`translate(${rnd(s, 10 + k) * 4} 0)`} />
        ))}
      </g>,
    );
  }
  return (
    <>
      <Sky id={id} colors={SKY[cont]} />
      <circle cx={sunX} cy="12" r="6" fill="#fff6c8" opacity="0.85" />
      <path d={`M0 ${h1} Q25 ${h1 - 9} 50 ${h1} T100 ${h2} L100 60 L0 60 Z`} fill={g1} opacity="0.7" />
      <path d={`M0 46 Q30 ${40 + rnd(s, 8) * 4} 60 45 T100 44 L100 60 L0 60 Z`} fill={g2} />
      {decor}
      {(a.water ?? 0) > 0 && (
        <g>
          <path d="M0 50 Q12 46 24 50 T48 50 L48 60 L0 60 Z" fill="#6fb2d9" />
          <path d="M3 54 q3 -2 6 0 t6 0 M20 56 q3 -2 6 0 t6 0" stroke="#dff1fb" stroke-width="0.8" fill="none" />
        </g>
      )}
      {(a.rock ?? 0) > 0 && (
        <g>
          <path d="M70 60 L76 47 L83 51 L88 44 L96 52 L100 60 Z" fill="#9a8f80" />
          <path d="M76 47 L79 53 M88 44 L89 52" stroke="#7d7264" stroke-width="0.8" />
        </g>
      )}
      <ellipse cx="50" cy="52" rx="17" ry="3" fill="#000" opacity="0.13" />
    </>
  );
}

/** 赞助卡专属建筑的形状（平顶六边形） */
function ShapeDiagram({ shape, color }: { shape: [number, number][]; color: string }) {
  const S = 5.2;
  const pts = shape.map(([q, r]) => hexToPixel(q, r, S));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return (
    <g transform={`translate(${82 - cx} ${44 - cy})`}>
      {pts.map(([x, y]) => (
        <polygon
          points={hexCorners(x, y, S - 0.3)
            .map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`)
            .join(' ')}
          fill={color}
          stroke="#7a5a1e"
          stroke-width="0.6"
        />
      ))}
    </g>
  );
}

function SponsorScene({ c }: { c: SponsorCard }) {
  const id = `s${c.num}`;
  const science = c.icons.includes('science');
  const colors: [string, string] = science ? ['#9cc3dc', '#e4f0f7'] : c.person ? ['#e8c27a', '#fbefd2'] : ['#e6cf8f', '#fbf3dc'];
  return (
    <>
      <Sky id={id} colors={colors} />
      {c.person && (
        <g>
          <path d="M50 0 L28 60 L72 60 Z" fill="#fffbe8" opacity="0.55" />
          <ellipse cx="50" cy="54" rx="22" ry="4" fill="#c79a4a" opacity="0.5" />
        </g>
      )}
      {science && !c.person && (
        <g fill="none" stroke="#5c8fb0" stroke-width="0.7" opacity="0.6">
          <circle cx="16" cy="14" r="5" />
          <circle cx="24" cy="10" r="2.5" />
          <path d="M16 14 L24 10 M80 12 l6 10 h-12 Z" />
        </g>
      )}
      {!c.person && !science && (
        <g fill="#d6b56a" opacity="0.5">
          <rect x="6" y="40" width="10" height="20" />
          <rect x="18" y="34" width="8" height="26" />
          <path d="M4 40 L11 33 L18 40 Z" />
        </g>
      )}
      {c.building && <ShapeDiagram shape={c.building.shape} color="#f2d488" />}
      <ellipse cx="50" cy="52" rx="16" ry="3" fill="#000" opacity="0.1" />
    </>
  );
}

function ProjectScene({ p }: { p: ProjectCard }) {
  const id = `p${p.num}`;
  const release = p.goal.k === 'release';
  const breed = p.goal.k === 'breed';
  const colors: [string, string] = release ? ['#8fc6a0', '#e2f3e6'] : breed ? ['#c8b2e0', '#f1eaf8'] : ['#9fcf9a', '#eaf6e6'];
  return (
    <>
      <Sky id={id} colors={colors} />
      <circle cx="50" cy="34" r="20" fill="#7fb6d6" opacity="0.35" />
      <path d="M38 24 q6 -4 10 2 q4 6 -2 10 q-6 2 -8 -4 Z M56 38 q6 -2 8 4 q-2 6 -8 4 Z" fill="#5f9b5a" opacity="0.4" />
      <g fill="#4f8b45" opacity="0.6">
        <path d="M6 54 q8 -14 16 0 q-8 -4 -16 0 Z" />
        <path d="M78 54 q8 -14 16 0 q-8 -4 -16 0 Z" />
      </g>
    </>
  );
}

export function CardArt({ c }: { c: Card }) {
  return (
    <svg class="card-art-bg" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {c.kind === 'animal' && <AnimalScene a={c} />}
      {c.kind === 'sponsor' && <SponsorScene c={c} />}
      {c.kind === 'project' && <ProjectScene p={c} />}
    </svg>
  );
}
