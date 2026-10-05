import type { Fx } from '../game/combat';
import { rectInStage } from './components/Tooltip';
import { sfx } from './sound';

/** 把战斗引擎产生的特效事件渲染成浮动文字、抖动等 DOM 动画 */
export function playFx(layer: HTMLElement | null, root: HTMLElement | null, fxs: Fx[], friendly: number[]) {
  if (!layer || !root) return;
  // 同一目标的多个浮动数字错开显示
  const stack: Record<number, number> = {};
  for (const f of fxs) {
    const host = root.querySelector(`[data-cuid="${f.uid}"]`) as HTMLElement | null;
    if (!host) continue;
    const sprite = (host.querySelector('.sprite') as HTMLElement | null) ?? host;
    const r = rectInStage(sprite);
    const cx = (r.l + r.r) / 2;
    const cy = r.t + (r.b - r.t) * 0.45;
    const k = (stack[f.uid] = (stack[f.uid] ?? 0) + 1);
    const delay = (k - 1) * 110;
    switch (f.kind) {
      case 'dmg':
        float(layer, cx + jitter(), cy, f.n ? String(f.n) : '0', `dmg ${f.n ? '' : 'zero'}`, delay);
        if (f.n) {
          shake(host, delay);
          slash(layer, cx, cy, delay);
          sfx('hit');
          if (friendly[0] === f.uid) hurtFlash(layer, f.n, delay);
          if (f.n >= 15) screenShake(root, f.n, delay);
        }
        break;
      case 'hploss':
        float(layer, cx + jitter(), cy, String(f.n), 'hploss', delay);
        shake(host, delay);
        break;
      case 'blocked':
        float(layer, cx - 40, cy + 30, `格挡 ${f.n}`, 'blocked', delay);
        break;
      case 'block':
        float(layer, cx, cy + 20, `+${f.n}`, 'block', delay);
        sfx('block');
        break;
      case 'heal':
        float(layer, cx, cy, `+${f.n}${f.text ? ' ' + f.text : ''}`, 'heal', delay);
        sfx('heal');
        break;
      case 'die':
        sfx('die');
        break;
      case 'buff':
        if (f.text) float(layer, cx, r.t - 10, f.text + (f.n && f.n !== 1 ? ` ${f.n > 0 ? '+' : ''}${f.n}` : ''), 'buff', delay);
        sfx('buff');
        break;
      case 'debuff':
        if (f.text) float(layer, cx, r.t - 10, f.text + (f.n && Math.abs(f.n) !== 1 ? ` ${f.n}` : ''), 'debuff', delay);
        sfx('debuff');
        break;
      case 'negated':
        float(layer, cx, r.t - 10, '抵消', 'text', delay);
        break;
      case 'text':
        if (f.text) float(layer, cx, r.t - 24, f.text, 'text', delay);
        break;
      case 'stars':
        float(layer, cx + 60, r.t, `★+${f.n}`, 'stars', delay);
        break;
      case 'summon':
        float(layer, cx, cy, `召唤 +${f.n}`, 'summon', delay);
        break;
      case 'lunge': {
        const cls = friendly.includes(f.uid) ? 'lunge-r' : 'lunge-l';
        host.classList.add(cls);
        setTimeout(() => host.classList.remove(cls), 170);
        break;
      }
      default:
        break;
    }
  }
}

const jitter = () => (Math.random() - 0.5) * 40;

function float(layer: HTMLElement, x: number, y: number, text: string, cls: string, delay: number) {
  const el = document.createElement('div');
  el.className = `fx ${cls}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.animationDelay = `${delay}ms`;
  el.style.opacity = '0';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1100 + delay);
}

/** 玩家受伤时屏幕边缘泛红 */
function hurtFlash(layer: HTMLElement, n: number, delay: number) {
  const el = document.createElement('div');
  el.className = 'hurt-flash';
  el.style.animationDelay = `${delay}ms`;
  el.style.setProperty('--hurt', String(Math.min(1, 0.35 + n / 40)));
  layer.appendChild(el);
  setTimeout(() => el.remove(), 600 + delay);
}

function screenShake(root: HTMLElement, n: number, delay: number) {
  if (typeof root.animate !== 'function') return;
  const a = Math.min(12, 3 + n / 5);
  setTimeout(() => {
    root.animate(
      [
        { transform: 'translate(0,0)' },
        { transform: `translate(${-a}px, ${a / 2}px)` },
        { transform: `translate(${a}px, ${-a / 3}px)` },
        { transform: `translate(${-a / 2}px, ${a / 3}px)` },
        { transform: 'translate(0,0)' },
      ],
      { duration: 280, easing: 'ease-out' },
    );
  }, delay);
}

function shake(host: HTMLElement, delay: number) {
  setTimeout(() => {
    host.classList.remove('hurt');
    void host.offsetWidth;
    host.classList.add('hurt');
    setTimeout(() => host.classList.remove('hurt'), 340);
  }, delay);
}

function slash(layer: HTMLElement, x: number, y: number, delay: number) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'slash');
  svg.style.left = `${x}px`;
  svg.style.top = `${y}px`;
  svg.style.animationDelay = `${delay}ms`;
  svg.style.opacity = '0';
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', 'M15 80 Q50 50 88 14 Q56 56 20 86 Z');
  p.setAttribute('fill', '#fff6e0');
  p.setAttribute('opacity', '0.9');
  svg.appendChild(p);
  layer.appendChild(svg);
  setTimeout(() => svg.remove(), 450 + delay);
}
