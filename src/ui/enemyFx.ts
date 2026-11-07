/**
 * 怪物的动作：每个敌人行动前，按它这一步的行动类型先做一个预备动作——
 * 攻击前后仰蓄力、防御时举盾、强化时聚气、施加负面效果时朝玩家射出一道咒光、
 * 召唤时法阵旋转、睡觉打鼾、眩晕晃脑袋。随后引擎结算这一步（出击、伤害数字等由 fx.ts 播放）。
 * 另外还有开场入场、召唤出的新敌人现身，以及倒下时的消散。
 */
import type { IntentKind } from '../game/types';
import { rectInStage } from './components/Tooltip';
import { sfx } from './sound';
import { speed } from './store';

interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}

/** 元素在特效层里的位置 */
function boxIn(layer: HTMLElement, el: Element): Box {
  const o = rectInStage(layer);
  const s = rectInStage(el);
  return { l: s.l - o.l, t: s.t - o.t, r: s.r - o.l, b: s.b - o.t };
}

const cx = (b: Box) => (b.l + b.r) / 2;
const cy = (b: Box) => (b.t + b.b) / 2;

function spriteOf(root: HTMLElement, uid: number): { host: HTMLElement; sprite: HTMLElement } | null {
  const host = root.querySelector(`[data-cuid="${uid}"]`) as HTMLElement | null;
  if (!host) return null;
  const sprite = (host.querySelector('.sprite') as HTMLElement | null) ?? host;
  return typeof sprite.animate === 'function' ? { host, sprite } : null;
}

/** 立绘本身的投影（动画里改 filter 时要带上，否则影子会消失） */
const SHADOW = 'drop-shadow(0 10px 8px rgba(0, 0, 0, 0.6))';
const glow = (c: string, r = 14) => `${SHADOW} drop-shadow(0 0 ${r}px ${c})`;

/** 在特效层放一个临时元素，动画结束后移除 */
function addFx(layer: HTMLElement, cls: string, x: number, y: number, html = ''): HTMLElement {
  const el = document.createElement('div');
  el.className = `efx ${cls}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  if (html) el.textContent = html;
  layer.appendChild(el);
  return el;
}

function run(el: HTMLElement, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation {
  const a = el.animate(frames, opts);
  const total = Number(opts.duration ?? 0) + Number(opts.delay ?? 0);
  a.onfinish = () => el.remove();
  setTimeout(() => el.remove(), total + 400);
  return a;
}

/** 一团上升的光点（强化、治疗） */
function motes(layer: HTMLElement, b: Box, color: string, n: number, dur: number) {
  for (let i = 0; i < n; i++) {
    const x = b.l + (b.r - b.l) * (0.15 + Math.random() * 0.7);
    const y = b.b - (b.b - b.t) * Math.random() * 0.4;
    const m = addFx(layer, 'mote', x, y);
    m.style.background = color;
    m.style.boxShadow = `0 0 8px ${color}`;
    const rise = 50 + Math.random() * 60;
    run(m, [
      { transform: 'translate(-50%, 0) scale(0.4)', opacity: 0 },
      { transform: `translate(-50%, ${-rise * 0.4}px) scale(1)`, opacity: 1, offset: 0.3 },
      { transform: `translate(-50%, ${-rise}px) scale(0.3)`, opacity: 0 },
    ], { duration: dur, delay: Math.random() * dur * 0.4, easing: 'ease-out', fill: 'backwards' });
  }
}

/** 环形光圈（盾、法阵） */
function ring(layer: HTMLElement, b: Box, cls: string, dur: number, from = 0.6, to = 1.15) {
  const size = Math.max(b.r - b.l, b.b - b.t) * 0.95;
  const el = addFx(layer, cls, cx(b), cy(b));
  el.style.width = el.style.height = `${size}px`;
  run(el, [
    { transform: `translate(-50%, -50%) scale(${from}) rotate(0deg)`, opacity: 0 },
    { transform: `translate(-50%, -50%) scale(${(from + to) / 2}) rotate(60deg)`, opacity: 0.9, offset: 0.4 },
    { transform: `translate(-50%, -50%) scale(${to}) rotate(140deg)`, opacity: 0 },
  ], { duration: dur, easing: 'ease-out' });
}

/** 飘起的字（打鼾的 Z、眩晕的星星） */
function drift(layer: HTMLElement, b: Box, text: string, cls: string, n: number, dur: number) {
  for (let i = 0; i < n; i++) {
    const el = addFx(layer, cls, cx(b) + 10 + i * 12, b.t + 10, text);
    run(el, [
      { transform: 'translate(-50%, 0) scale(0.6)', opacity: 0 },
      { transform: `translate(calc(-50% + ${8 + i * 6}px), -20px) scale(1)`, opacity: 1, offset: 0.35 },
      { transform: `translate(calc(-50% + ${18 + i * 10}px), -46px) scale(1.1)`, opacity: 0 },
    ], { duration: dur, delay: i * dur * 0.22, easing: 'ease-out', fill: 'backwards' });
  }
}

/** 咒光：从 a 飞向 b 的紫色光球 */
function bolt(layer: HTMLElement, a: Box, b: Box, dur: number): Promise<void> {
  const el = addFx(layer, 'hex-bolt', cx(a), cy(a));
  const dx = cx(b) - cx(a);
  const dy = cy(b) - cy(a);
  sfx('bolt');
  const anim = run(el, [
    { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
    { transform: `translate(calc(-50% + ${dx * 0.45}px), calc(-50% + ${dy * 0.45 - 60}px)) scale(1)`, opacity: 1, offset: 0.45 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.4)`, opacity: 0.2 },
  ], { duration: dur, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' });
  return new Promise((res) => {
    anim.finished.then(() => res(), () => res());
    setTimeout(res, dur + 100);
  });
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 从 a 指向 b 的单位向量（横屏时大致朝左右，竖屏时敌人在上、玩家在下） */
function towards(a: Element, b: Element | null, fallback: 1 | -1): { ux: number; uy: number } {
  if (!b) return { ux: fallback, uy: 0 };
  const ra = a.getBoundingClientRect();
  const rb = b.getBoundingClientRect();
  const dx = rb.left + rb.width / 2 - (ra.left + ra.width / 2);
  const dy = rb.top + rb.height / 2 - (ra.top + ra.height / 2);
  const len = Math.hypot(dx, dy);
  return len > 1 ? { ux: dx / len, uy: dy / len } : { ux: fallback, uy: 0 };
}

/**
 * 敌人行动前的预备动作。返回的函数在这一步结算后调用，让立绘回到原位
 * （攻击时正好与出击的前冲同时发生）。
 */
export async function enemyWindup(root: HTMLElement | null, layer: HTMLElement | null, uid: number, intent: IntentKind, playerUid: number): Promise<() => void> {
  const none = () => {};
  if (!root || !layer) return none;
  const p = spriteOf(root, uid);
  if (!p) return none;
  const { sprite } = p;
  const b = boxIn(layer, sprite);
  const me = root.querySelector(`[data-cuid="${playerUid}"] .sprite`);
  // 朝向玩家的方向：蓄力时往反方向后仰，施法时朝玩家前倾
  const { ux, uy } = towards(sprite, me, -1);
  const tilt = Math.round(-ux * 6);
  let anim: Animation | null = null;
  const pose = (frames: Keyframe[], dur: number, hold = true) => {
    anim = sprite.animate(frames, { duration: dur, easing: 'cubic-bezier(0.3, 0, 0.3, 1)', fill: hold ? 'forwards' : 'none' });
  };
  const release = () => {
    const a = anim as Animation | null;
    if (!a) return;
    // 平稳地回到原位，而不是一下子跳回去
    const cur = getComputedStyle(sprite);
    const back = sprite.animate([{ transform: cur.transform, filter: cur.filter }, { transform: 'none', filter: SHADOW }], { duration: 160, easing: 'ease-out' });
    a.cancel();
    back.onfinish = () => back.cancel();
  };
  switch (intent) {
    case 'attack':
    case 'attackBuff':
    case 'attackDebuff':
    case 'attackDefend': {
      // 向后仰、压低身子蓄力，眼里冒红光
      const d = speed(340);
      sfx('windup');
      pose([
        { transform: 'translate(0, 0) rotate(0deg) scale(1, 1)', filter: SHADOW },
        { transform: `translate(${-ux * 18}px, ${-uy * 14 + 5}px) rotate(${tilt}deg) scale(1.04, 0.92)`, filter: glow('rgba(255, 70, 50, 0.85)', 12) },
      ], d);
      await wait(d);
      return release;
    }
    case 'defend':
    case 'defendBuff': {
      const d = speed(320);
      sfx('shieldUp');
      ring(layer, b, 'shield-ring', d + speed(300));
      pose([
        { transform: 'translateY(0) scale(1, 1)', filter: SHADOW },
        { transform: 'translateY(3px) scale(0.95, 1.03)', filter: glow('rgba(110, 180, 255, 0.95)', 16) },
      ], d);
      await wait(d);
      return release;
    }
    case 'buff': {
      const d = speed(400);
      sfx('powerUp');
      motes(layer, b, '#ffb347', 9, d + speed(200));
      pose([
        { transform: 'translateY(0) scale(1)', filter: SHADOW },
        { transform: 'translateY(-4px) scale(1.06, 0.97)', filter: glow('rgba(255, 150, 60, 0.8)', 10), offset: 0.5 },
        { transform: 'translateY(-8px) scale(1.1)', filter: glow('rgba(255, 120, 40, 1)', 20) },
      ], d);
      await wait(d);
      return release;
    }
    case 'debuff':
    case 'strongDebuff': {
      // 施法：前倾、紫光，然后朝玩家射出咒光，命中时再结算
      const d = speed(280);
      sfx('hex');
      pose([
        { transform: 'translate(0, 0) rotate(0deg)', filter: SHADOW },
        { transform: `translate(${ux * 10}px, ${uy * 10 - 4}px) rotate(${-tilt}deg) scale(1.04)`, filter: glow('rgba(180, 90, 255, 0.95)', 16) },
      ], d);
      await wait(d);
      if (me) await bolt(layer, b, boxIn(layer, me), speed(intent === 'strongDebuff' ? 420 : 340));
      return release;
    }
    case 'summon': {
      const d = speed(460);
      sfx('summon');
      ring(layer, b, 'summon-ring', d + speed(300), 0.5, 1.35);
      pose([
        { transform: 'translateY(0) scale(1)', filter: SHADOW },
        { transform: 'translateY(-10px) scale(1.08)', filter: glow('rgba(120, 255, 170, 0.9)', 18) },
      ], d);
      await wait(d);
      return release;
    }
    case 'heal': {
      const d = speed(320);
      motes(layer, b, '#8df07a', 7, d + speed(200));
      pose([{ filter: SHADOW }, { filter: glow('rgba(140, 240, 120, 0.95)', 18) }], d);
      await wait(d);
      return release;
    }
    case 'sleep': {
      const d = speed(520);
      sfx('snore');
      drift(layer, b, 'z', 'snore-z', 3, d);
      pose([
        { transform: 'rotate(0deg) scale(1, 1)' },
        { transform: 'rotate(-3deg) scale(1.03, 0.97)', offset: 0.5 },
        { transform: 'rotate(0deg) scale(1, 1)' },
      ], d, false);
      await wait(d);
      return none;
    }
    case 'stun': {
      const d = speed(460);
      sfx('stunned');
      drift(layer, b, '★', 'stun-star', 3, d);
      pose([
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(-8deg)', offset: 0.25 },
        { transform: 'rotate(7deg)', offset: 0.6 },
        { transform: 'rotate(0deg)' },
      ], d, false);
      await wait(d);
      return none;
    }
    default: {
      // 逃跑、未知：原地一跳
      const d = speed(240);
      pose([
        { transform: 'translateY(0)' },
        { transform: 'translateY(-14px) scale(1.03, 0.98)', offset: 0.45 },
        { transform: 'translateY(0)' },
      ], d, false);
      await wait(d);
      return none;
    }
  }
}

/** 出击：整个角色朝目标冲过去再弹回（横屏时敌人向左、玩家向右；竖屏时上下） */
export function strike(host: HTMLElement, target: Element | null, dir: 1 | -1) {
  if (typeof host.animate !== 'function') return;
  const { ux, uy } = towards(host, target, dir);
  host.animate(
    [
      { transform: 'translate(0, 0)' },
      { transform: `translate(${ux * 58}px, ${uy * 58}px) scale(1.04)`, offset: 0.28 },
      { transform: 'translate(0, 0)' },
    ],
    { duration: 320, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
  );
}

/** 玩家打出技能 / 能力牌时的施法动作 */
export function playerCast(root: HTMLElement | null, uid: number, kind: 'skill' | 'power') {
  if (!root) return;
  const p = spriteOf(root, uid);
  if (!p) return;
  const c = kind === 'power' ? 'rgba(255, 210, 120, 0.95)' : 'rgba(150, 210, 255, 0.85)';
  p.sprite.animate(
    [
      { transform: 'translateY(0) scale(1)', filter: SHADOW },
      { transform: `translateY(-8px) scale(${kind === 'power' ? 1.07 : 1.04})`, filter: glow(c, kind === 'power' ? 22 : 14), offset: 0.4 },
      { transform: 'translateY(0) scale(1)', filter: SHADOW },
    ],
    { duration: kind === 'power' ? 560 : 380, easing: 'ease-out' },
  );
}

/** 获得格挡：一圈蓝色护盾闪一下 */
export function shieldFlash(layer: HTMLElement, host: HTMLElement) {
  const sprite = host.querySelector('.sprite') ?? host;
  ring(layer, boxIn(layer, sprite), 'shield-ring', 420, 0.85, 1.1);
}

/** 强化 / 负面效果落在身上：金色光点上升，或紫色光点下沉 */
export function auraFx(layer: HTMLElement, host: HTMLElement, good: boolean) {
  const sprite = host.querySelector('.sprite') ?? host;
  const b = boxIn(layer, sprite);
  if (good) motes(layer, b, '#ffd27a', 5, 600);
  else {
    for (let i = 0; i < 5; i++) {
      const m = addFx(layer, 'mote', b.l + (b.r - b.l) * (0.2 + Math.random() * 0.6), b.t + (b.b - b.t) * 0.3);
      m.style.background = '#b06cff';
      m.style.boxShadow = '0 0 8px #b06cff';
      run(m, [
        { transform: 'translate(-50%, 0) scale(1)', opacity: 0 },
        { transform: 'translate(-50%, 16px) scale(1)', opacity: 1, offset: 0.3 },
        { transform: `translate(-50%, ${50 + Math.random() * 30}px) scale(0.3)`, opacity: 0 },
      ], { duration: 650, delay: i * 50, easing: 'ease-in', fill: 'backwards' });
    }
  }
}

/** 倒下：先闪白，再失去颜色、塌下去、化作烟尘散开 */
export function deathFx(layer: HTMLElement, host: HTMLElement, boss: boolean) {
  const sprite = host.querySelector('.sprite') as HTMLElement | null;
  if (!sprite || typeof sprite.animate !== 'function') return;
  const b = boxIn(layer, sprite);
  if (b.r - b.l <= 0) return;
  const ghost = sprite.cloneNode(true) as HTMLElement;
  ghost.classList.add('death-ghost');
  Object.assign(ghost.style, { position: 'absolute', left: `${b.l}px`, top: `${b.t}px`, width: `${b.r - b.l}px`, height: `${b.b - b.t}px`, margin: '0', animation: 'none', opacity: '1' });
  layer.appendChild(ghost);
  // 原来的立绘立刻藏起来，由残影接着演
  host.classList.add('dying');
  setTimeout(() => host.classList.remove('dying'), 2500);
  const dur = boss ? 1600 : 950;
  run(ghost, [
    { transform: 'none', filter: SHADOW, opacity: 1 },
    { transform: 'translateX(-5px) scale(1.03)', filter: 'brightness(3) saturate(0)', opacity: 1, offset: 0.12 },
    { transform: 'translateX(4px)', filter: 'brightness(1.2) grayscale(0.6)', opacity: 1, offset: 0.24 },
    { transform: 'translateY(8px) scale(1, 0.92)', filter: 'brightness(0.55) grayscale(1) blur(1px)', opacity: 0.85, offset: 0.5 },
    { transform: 'translateY(28px) scale(1.08, 0.55)', filter: 'brightness(0.3) grayscale(1) blur(5px)', opacity: 0 },
  ], { duration: dur, easing: 'ease-in' });
  // 烟尘
  const n = boss ? 22 : 12;
  for (let i = 0; i < n; i++) {
    const x = b.l + (b.r - b.l) * (0.1 + Math.random() * 0.8);
    const y = b.t + (b.b - b.t) * (0.35 + Math.random() * 0.6);
    const s = addFx(layer, 'smoke', x, y);
    const sz = (boss ? 26 : 18) + Math.random() * 22;
    s.style.width = s.style.height = `${sz}px`;
    run(s, [
      { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0 },
      { transform: `translate(calc(-50% + ${(Math.random() - 0.5) * 30}px), calc(-50% - ${10 + Math.random() * 20}px)) scale(1)`, opacity: 0.75, offset: 0.35 },
      { transform: `translate(calc(-50% + ${(Math.random() - 0.5) * 70}px), calc(-50% - ${40 + Math.random() * 50}px)) scale(1.8)`, opacity: 0 },
    ], { duration: dur * (0.8 + Math.random() * 0.5), delay: dur * 0.2 + Math.random() * dur * 0.25, easing: 'ease-out', fill: 'backwards' });
  }
  sfx(boss ? 'bossDie' : 'die');
}

/** 开场：敌人依次从右侧走进来 */
export function enterFx(host: HTMLElement, i: number) {
  if (typeof host.animate !== 'function') return;
  host.animate(
    [
      { transform: 'translateX(90px)', opacity: 0 },
      { transform: 'translateX(0)', opacity: 1 },
    ],
    { duration: speed(520), delay: speed(120 + i * 120), easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', fill: 'backwards' },
  );
}

/** 召唤出的新敌人：在法阵里由亮光凝聚成形 */
export function spawnFx(layer: HTMLElement | null, host: HTMLElement) {
  const sprite = (host.querySelector('.sprite') as HTMLElement | null) ?? host;
  if (typeof sprite.animate !== 'function') return;
  if (layer) ring(layer, boxIn(layer, sprite), 'summon-ring', 700, 0.4, 1.2);
  sprite.animate(
    [
      { transform: 'translateY(-30px) scale(0.4)', filter: 'brightness(4) saturate(0)', opacity: 0 },
      { transform: 'translateY(-6px) scale(1.08)', filter: 'brightness(1.8)', opacity: 1, offset: 0.6 },
      { transform: 'translateY(0) scale(1)', filter: SHADOW, opacity: 1 },
    ],
    { duration: 620, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
  );
}
