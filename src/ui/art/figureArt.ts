/**
 * 房间里的人物与景物：商人、篝火、先古之民。画布 200×200。
 */
import { INK, circle, doc, dot, ellipse, fill, glow, ink, limb, line, memo, place, starPath } from './kit';
import { flameBody } from './motifs';
import { M } from './palettes';

const dark = (d: string, o = 0.24) => fill(d, '#000', o);
const hi = (d: string, w = 2.4, o = 0.55) => line(d, '#fff', w, o);
const eye = (x: number, y: number, r: number, col: string) => glow(x, y, r * 3, col, 0.6) + circle(x, y, r, col, 2) + dot(x - r * 0.3, y - r * 0.3, r * 0.3, '#fff', 0.9);

function merchant(): string {
  return (
    `<ellipse cx="100" cy="192" rx="74" ry="7" fill="#000" opacity="0.45"/>` +
    // 背包
    ink('M110 40 L176 50 L182 170 L118 176 Z', '#6a4a2a') +
    dark('M150 46 L176 50 L182 170 L152 174 Z', 0.25) +
    ink('M118 70 L178 76 M120 104 L180 110 M120 138 L181 144', 'none', 2.4) +
    ink('M126 20 L166 26 L162 50 L124 46 Z', '#8a5a3a') +
    ink('M150 4 C160 0 172 8 168 20 L150 22 Z', '#3a6aa0', 2.4) +
    place(ink('M-6 -30 L6 -30 L6 30 L-6 30 Z', '#c8a040', 2) + circle(0, -34, 6, '#e0c060', 2), 186, 60, 0.8, 16) +
    ink('M126 150 C126 140 146 140 146 150 L146 170 L126 170 Z', '#c0302a', 2.4) +
    // 斗篷
    ink('M100 36 C70 38 60 66 62 86 C50 120 40 160 40 190 L150 190 C152 160 142 120 132 86 C134 66 128 38 100 36 Z', '#4a2a4a') +
    dark('M104 36 C126 40 134 66 132 86 C142 120 152 160 150 190 L120 190 C126 150 120 110 112 86 C116 64 112 46 104 36 Z', 0.28) +
    line('M70 120 C66 150 60 170 58 186', '#2a1a2a', 2.4, 0.7) +
    // 兜帽脸
    ink('M100 44 C80 46 76 64 78 76 C80 88 90 94 100 94 C110 94 120 88 122 76 C124 64 120 46 100 44 Z', '#1a0e18') +
    eye(90, 70, 4, '#ffd060') +
    eye(108, 70, 4, '#ffd060') +
    ink('M86 80 C80 92 84 100 92 98 C94 92 92 86 92 80 Z', '#c89a7a', 2) +
    fill('M84 84 C92 100 112 100 118 86 C114 108 88 110 84 84 Z', '#d8d0c8', 0.85) +
    // 手持提灯
    limb('M70 110 C56 120 50 134 52 146', '#4a2a4a', 11) +
    circle(52, 148, 7, '#c89a7a') +
    line('M52 154 L52 162', INK, 2) +
    glow(52, 178, 36, '#ffb050', 0.75) +
    ink('M42 164 L62 164 L60 190 L44 190 Z', '#ffd890') +
    line('M42 164 L62 164 M44 190 L60 190', INK, 3) +
    hi('M80 54 C84 46 92 42 100 42', 2.4, 0.4)
  );
}

function campfire(): string {
  return (
    glow(100, 120, 110, '#ff9a3a', 0.55) +
    `<ellipse cx="100" cy="186" rx="80" ry="12" fill="#000" opacity="0.45"/>` +
    [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const a = Math.PI + (i / 6) * Math.PI;
      return ellipse(100 + Math.cos(a) * 66, 178 + Math.sin(a) * -8 + 6, 14, 9, i % 2 ? M.stone : M.stoneDark, 2.6);
    }).join('') +
    limb('M50 182 L150 160', '#5a3a22', 14) +
    limb('M50 160 L150 182', '#6a4a2a', 14) +
    line('M60 178 L140 158', '#2a1a10', 2, 0.6) +
    place(flameBody(), 100, 118, 1.2) +
    [0, 1, 2, 3, 4, 5, 6, 7].map((i) => dot(60 + i * 12, 30 + ((i * 37) % 60), 2.4, '#ffe08a', 0.9)).join('')
  );
}

// ---------------------------------------------------------------- 先古之民

function neow(): string {
  return (
    glow(100, 100, 110, '#7ad8ff', 0.4) +
    ink('M190 90 C176 40 120 24 70 40 C30 54 10 90 18 124 C26 160 70 176 120 170 C170 164 196 130 190 90 Z', '#4a86b8') +
    dark('M120 26 C170 34 196 70 190 110 C186 140 166 162 136 168 C170 130 166 70 120 26 Z', 0.25) +
    fill('M20 120 C40 150 90 166 140 158 C110 172 50 168 24 140 Z', '#e8f4ff', 0.85) +
    [0, 1, 2, 3, 4].map((i) => line(`M${40 + i * 16} ${130 + i * 4} C${60 + i * 16} ${142 + i * 4} ${84 + i * 16} ${146 + i * 4} ${100 + i * 16} ${144 + i * 4}`, '#a8d0f0', 2, 0.8)).join('') +
    ink('M48 92 C56 86 66 86 72 92', 'none', 3) +
    ink('M94 84 C102 78 112 78 118 84', 'none', 3) +
    [0, 1, 2, 3, 4, 5].map((i) => place(fill(starPath(0, 0, 6, 2, 4), '#e8fbff'), 70 + i * 20, 54 + (i % 2) * 10, 1)).join('') +
    ink('M150 150 C170 170 190 172 196 160 C186 154 172 146 160 136 Z', '#3a76a8') +
    hi('M40 70 C60 44 90 36 120 34', 3, 0.5)
  );
}

function orobas(): string {
  return (
    glow(100, 96, 110, '#c08aff', 0.45) +
    ink('M100 90 C70 30 16 20 10 60 C6 90 40 110 96 104 Z', '#7a4ac0') +
    ink('M100 90 C130 30 184 20 190 60 C194 90 160 110 104 104 Z', '#6a3ab0') +
    ink('M98 104 C60 120 30 160 46 180 C64 190 86 150 100 112 Z', '#5a2a9a') +
    ink('M102 104 C140 120 170 160 154 180 C136 190 114 150 100 112 Z', '#4a2088') +
    eye(48, 60, 9, '#ffd060') +
    eye(152, 60, 9, '#ffd060') +
    eye(60, 160, 6, '#ffd060') +
    eye(140, 160, 6, '#ffd060') +
    ink('M90 50 C90 36 110 36 110 50 L112 150 C108 160 92 160 88 150 Z', '#2a1a3a') +
    eye(100, 60, 6, '#f0e0ff') +
    limb('M94 40 C86 20 74 14 66 18 M106 40 C114 20 126 14 134 18', INK, 2.4)
  );
}

function pael(): string {
  let s = glow(100, 100, 110, '#ff5a6a', 0.4);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const x2 = 100 + Math.cos(a) * 90;
    const y2 = 100 + Math.sin(a) * 80;
    s += limb(`M100 100 C${100 + Math.cos(a + 0.5) * 50} ${100 + Math.sin(a + 0.5) * 50} ${x2 - Math.cos(a) * 10} ${y2} ${x2} ${y2}`, '#a83a4a', 10);
    s += circle(x2, y2, 6, '#e88a9a', 2);
  }
  s += circle(100, 100, 50, '#c84a5a') + dark('M120 56 C150 70 156 120 130 144 C140 116 140 82 120 56 Z', 0.25);
  s += ink('M56 100 C76 70 124 70 144 100 C124 130 76 130 56 100 Z', '#f4ece0');
  s += circle(100, 100, 18, '#7a1a2a') + dot(100, 100, 8, INK) + dot(94, 94, 4, '#fff', 0.9);
  return s;
}

function tezcatara(): string {
  return (
    glow(100, 100, 110, '#ffa040', 0.55) +
    place(flameBody(), 100, 104, 1.9) +
    ink('M80 70 C80 50 120 50 120 70 C120 90 110 100 100 100 C90 100 80 90 80 70 Z', '#ffe0a0') +
    eye(90, 72, 4, '#c03a10') +
    eye(110, 72, 4, '#c03a10') +
    line('M94 88 C98 90 102 90 106 88', '#7a2a0a', 2) +
    ink('M76 56 L80 38 L88 50 L100 30 L112 50 L120 38 L124 56 Z', M.gold, 2.4) +
    limb('M76 110 C56 120 46 106 40 90 M124 110 C144 120 154 106 160 90', '#ffb040', 8) +
    glow(40, 86, 16, '#fff2b0', 0.9) +
    glow(160, 86, 16, '#fff2b0', 0.9)
  );
}

function nonupeipe(): string {
  let s = glow(100, 100, 110, '#ffd040', 0.5);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    s += `<ellipse cx="${(100 + Math.cos(a) * 80).toFixed(1)}" cy="${(104 + Math.sin(a) * 50).toFixed(1)}" rx="11" ry="8" fill="${M.gold}" stroke="${INK}" stroke-width="2.2"/>`;
  }
  s += ink('M60 70 L50 30 L80 56 Z', M.gold, 2.4) + ink('M140 70 L150 30 L120 56 Z', M.gold, 2.4);
  s += circle(100, 100, 48, '#e8b830') + circle(100, 100, 38, '#f6d060', 2.4);
  s += dark('M120 60 C146 72 154 120 128 142 C138 116 138 82 120 60 Z', 0.2);
  s += ink('M80 92 C84 86 92 86 96 92', 'none', 3) + ink('M104 92 C108 86 116 86 120 92', 'none', 3);
  s += ink('M90 112 C96 120 104 120 110 112', 'none', 3);
  s += line('M70 104 L54 100 M70 110 L54 112 M130 104 L146 100 M130 110 L146 112', INK, 1.6);
  s += ink(starPath(100, 70, 7, 3, 4), '#fff6d0', 1.6);
  return s;
}

function vakuu(): string {
  return (
    glow(100, 100, 110, '#8af0a0', 0.4) +
    ink('M40 190 C40 140 60 110 100 104 C140 110 160 140 160 190 Z', '#4a2a6a') +
    [0, 1, 2, 3].map((i) => fill(`M${54 + i * 26} 120 L${66 + i * 26} 150 L${54 + i * 26} 180 L${42 + i * 26} 150 Z`, i % 2 ? '#3a8a5a' : '#8a3a8a', 0.9)).join('') +
    ink('M58 40 C40 20 30 30 34 50 C40 64 56 60 60 50 Z', '#8a3a8a') +
    ink('M142 40 C160 20 170 30 166 50 C160 64 144 60 140 50 Z', '#3a8a5a') +
    circle(34, 52, 6, M.gold) +
    circle(166, 52, 6, M.gold) +
    ink('M60 50 C60 20 140 20 140 50 C144 90 126 110 100 110 C74 110 56 90 60 50 Z', '#f4ece0') +
    fill('M100 24 C124 24 140 34 140 50 C144 90 126 110 100 110 Z', '#1a1a20', 0.85) +
    eye(82, 62, 7, '#8af0a0') +
    eye(118, 62, 7, '#ff5aff') +
    ink('M80 86 C90 96 110 96 120 86 C112 102 88 102 80 86 Z', '#3a1a2a', 2)
  );
}

function darv(): string {
  return (
    `<ellipse cx="100" cy="192" rx="74" ry="7" fill="#000" opacity="0.45"/>` +
    glow(100, 100, 100, '#7af0e0', 0.25) +
    ink('M50 190 C40 150 50 100 92 80 C140 70 166 110 160 190 Z', '#3a5a5a') +
    dark('M120 76 C150 90 166 130 160 190 L130 190 C140 140 134 100 120 76 Z', 0.28) +
    // 罐子
    [
      [60, 150, '#c8a040'],
      [86, 162, '#8a4ac0'],
      [118, 156, '#4aa0c0'],
      [140, 168, '#c04a3a'],
    ]
      .map(([x, y, c]) => place(ink('M-10 -14 L10 -14 L8 -8 C18 -4 18 14 10 18 L-10 18 C-18 14 -18 -4 -8 -8 Z', c as string, 2.4) + glow(0, 2, 12, c as string, 0.5), x as number, y as number, 1))
      .join('') +
    ink('M74 60 C70 34 86 20 100 20 C116 20 130 34 126 60 C124 78 112 88 100 88 C88 88 76 78 74 60 Z', '#5a7a6a') +
    ink('M80 44 C86 34 114 34 120 44', 'none', 3) +
    eye(88, 56, 5, '#7af0e0') +
    eye(112, 56, 5, '#7af0e0') +
    fill('M80 70 C88 90 112 90 120 70 C118 104 82 104 80 70 Z', '#c8c0a8', 0.9) +
    limb('M60 110 C40 120 30 140 34 160', '#3a5a5a', 11) +
    limb('M34 160 L30 120', '#5a3a1a', 4) +
    glow(30, 112, 20, '#7af0e0', 0.8) +
    ink('M24 108 L36 108 L34 122 L26 122 Z', '#c8f8f0')
  );
}

function chest(open: boolean): string {
  const wood = '#8a5a2a';
  return (
    `<ellipse cx="100" cy="186" rx="78" ry="9" fill="#000" opacity="0.45"/>` +
    (open ? glow(100, 90, 90, '#ffe08a', 0.75) : '') +
    ink('M30 100 L170 100 L166 182 L34 182 Z', wood) +
    dark('M100 100 L170 100 L166 182 L100 182 Z', 0.22) +
    line('M32 128 L168 128 M33 156 L167 156', '#4a2a10', 2.4, 0.8) +
    ink('M28 96 L44 96 L44 184 L28 184 Z', '#c8a040', 2.4) +
    ink('M156 96 L172 96 L172 184 L156 184 Z', '#b8902a', 2.4) +
    (open
      ? ink('M30 100 C30 60 170 60 170 100 L176 40 C150 6 50 6 24 40 Z', '#7a4a20') + ink('M24 40 C50 6 150 6 176 40 L170 50 C146 22 54 22 30 50 Z', '#c8a040', 2.4) +
        [0, 1, 2, 3, 4].map((i) => ellipse(60 + i * 20, 98 - (i % 2) * 6, 11, 7, M.gold, 2)).join('') +
        [0, 1, 2].map((i) => dot(70 + i * 30, 60 - i * 6, 3, '#fff6d0')).join('')
      : ink('M30 100 C30 54 170 54 170 100 Z', '#9a6a32') + dark('M100 56 C140 58 170 74 170 100 L100 100 Z', 0.2) + ink('M28 98 L172 98 L172 108 L28 108 Z', '#c8a040', 2.4) +
        ink('M88 92 L112 92 L112 122 L88 122 Z', '#e0c060', 2.4) + dot(100, 104, 4, INK) + line('M100 106 L100 114', INK, 2.4)) +
    hi('M40 108 L38 176', 2.4, 0.4)
  );
}

const chest_closed = () => chest(false);
const chest_open = () => chest(true);

const ART: Record<string, () => string> = { chest_closed, chest_open, merchant, campfire, neow, orobas, pael, tezcatara, nonupeipe, vakuu, darv };

export function figureSvg(id: string): string {
  const fn = ART[id];
  if (!fn) return '';
  return doc(200, 200, `<g filter="url(#paint)">${fn()}</g>`, 6).replace('preserveAspectRatio="xMidYMid slice"', 'preserveAspectRatio="xMidYMax meet" overflow="visible"');
}

const cache = memo((id: string) => figureSvg(id));

export function figureUrl(id: string): string | null {
  return ART[id] ? cache(id) : null;
}
