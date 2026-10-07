/**
 * 收获动画：拿到的东西从来源位置飞向顶栏（金币、药水栏、遗物栏、牌组），落地时目标轻轻弹一下。
 * 飞行的是来源元素的复制品，挂在舞台上、不响应点击，结束后移除。
 */
import type { Run } from '../game/run';
import { potionArtUrl, relicArtUrl } from './art/itemArt';
import { rectInStage, stageInfo } from './components/Tooltip';
import { act, state } from './store';

export interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
}

const centered = (r: Rect, w: number, h: number): Rect => {
  const cx = (r.l + r.r) / 2;
  const cy = (r.t + r.b) / 2;
  return { l: cx - w / 2, t: cy - h / 2, r: cx + w / 2, b: cy + h / 2 };
};

/** 让元素弹一下（重复触发时从头播放） */
export function pop(el: Element) {
  el.classList.remove('gain-pop');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('gain-pop');
  setTimeout(() => el.classList.remove('gain-pop'), 500);
}

/**
 * 从 src 飞向 findTarget() 找到的元素。目标在这次操作渲染之后才出现（新遗物、刚放进栏位的药水），
 * 所以等两帧再找。
 */
export function flyGain(
  src: Element,
  findTarget: () => Element | null,
  opts: { endScale?: number; duration?: number; delay?: number; hideTarget?: boolean; from?: Rect } = {},
) {
  const stage = stageInfo.el;
  if (!stage || typeof (src as HTMLElement).animate !== 'function') return;
  const own = rectInStage(src);
  const w = own.r - own.l;
  const h = own.b - own.t;
  if (w <= 0 || h <= 0) return;
  // 可以从别处出发（例如从宝箱里升起）：保持 src 的大小，中心放在 opts.from 的中心
  const from = opts.from ? centered(opts.from, w, h) : own;
  const ghost = src.cloneNode(true) as HTMLElement;
  ghost.classList.remove('hovered', 'picked', 'dragging');
  ghost.classList.add('gain-fly');
  ghost.removeAttribute('style');
  Object.assign(ghost.style, {
    position: 'absolute',
    left: `${from.l}px`,
    top: `${from.t}px`,
    width: `${w}px`,
    height: `${h}px`,
    margin: '0',
    zIndex: '400',
    pointerEvents: 'none',
  });
  stage.appendChild(ghost);
  const duration = opts.duration ?? 560;
  const delay = opts.delay ?? 0;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const target = findTarget();
      if (!target) {
        ghost.remove();
        return;
      }
      // 新出现的遗物、药水先藏起来，等飞到了再显示，免得同时看到两个
      const hidden = opts.hideTarget ? ((target.querySelector('.item-icon') as HTMLElement | null) ?? (target as HTMLElement)) : null;
      if (hidden) hidden.style.visibility = 'hidden';
      const to = rectInStage(target);
      const dx = (to.l + to.r) / 2 - (from.l + from.r) / 2;
      const dy = (to.t + to.b) / 2 - (from.t + from.b) / 2;
      const s = opts.endScale ?? Math.min(1, Math.max(0.15, (to.r - to.l) / w));
      const anim = ghost.animate(
        [
          { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
          // 先略微抬起放大，再沿弧线落向目标
          { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 50}px) scale(${Math.max(s, 1) * 1.08})`, opacity: 1, offset: 0.35 },
          { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.85 },
        ],
        { duration, delay, fill: 'backwards', easing: 'cubic-bezier(0.4, 0, 0.25, 1)' },
      );
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        ghost.remove();
        if (hidden) hidden.style.visibility = '';
        pop(target);
      };
      anim.onfinish = finish;
      setTimeout(finish, delay + duration + 250);
    }),
  );
}

/** 一串金币从 a 飞向 b（舞台坐标）；全部落地后调用 onLand */
function coinShower(a: Rect, b: Rect, coins: number, onLand?: () => void) {
  const stage = stageInfo.el;
  if (!stage || typeof stage.animate !== 'function') return;
  const dx = (b.l + b.r) / 2 - (a.l + a.r) / 2;
  const dy = (b.t + b.b) / 2 - (a.t + a.b) / 2;
  for (let k = 0; k < coins; k++) {
    const coin = document.createElement('span');
    coin.className = 'gain-fly coin-fly';
    coin.textContent = '🪙';
    Object.assign(coin.style, { position: 'absolute', left: `${(a.l + a.r) / 2 - 11}px`, top: `${(a.t + a.b) / 2 - 11}px`, zIndex: '400', pointerEvents: 'none' });
    stage.appendChild(coin);
    const jitter = (k - (coins - 1) / 2) * 14;
    const anim = coin.animate(
      [
        { transform: 'translate(0px, 0px) scale(0.9)', opacity: 1 },
        { transform: `translate(${dx * 0.5 + jitter}px, ${dy * 0.5 - 40}px) scale(1.1)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx + jitter * 0.4}px, ${dy}px) scale(0.6)`, opacity: 0 },
      ],
      { duration: 420, delay: k * 70, fill: 'backwards', easing: 'cubic-bezier(0.4, 0, 0.3, 1)' },
    );
    anim.onfinish = () => {
      coin.remove();
      if (k === coins - 1) onLand?.();
    };
    setTimeout(() => coin.remove(), 420 + k * 70 + 400);
  }
}

/** 付钱：几枚金币从顶栏的金币数飞向买下的东西（元素或舞台坐标），金币数闪一下 */
export function spendGold(to: Element | Rect, coins = 3) {
  const from = document.querySelector('.topbar .tb-gold .ico');
  if (!from) return;
  coinShower(rectInStage(from), to instanceof Element ? rectInStage(to) : to, coins);
  const counter = document.querySelector('.topbar .tb-gold');
  if (counter) {
    counter.classList.remove('spend-flash');
    void (counter as HTMLElement).offsetWidth;
    counter.classList.add('spend-flash');
    setTimeout(() => counter.classList.remove('spend-flash'), 600);
  }
}

/** 得到金币：一串金币从 from（元素或舞台坐标）飞向顶栏的金币数，落地时金币数弹一下 */
export function gainGoldFx(from: Element | Rect, coins = 5) {
  const counter = document.querySelector('.topbar .tb-gold');
  if (!counter) return;
  const a = from instanceof Element ? rectInStage(from) : from;
  coinShower(a, rectInStage(counter), coins, () => pop(counter));
}

/** 买不起：轻轻摇一下 */
export function deny(el: Element) {
  el.classList.remove('deny-shake');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('deny-shake');
  setTimeout(() => el.classList.remove('deny-shake'), 450);
}

/** 移除卡牌：这张牌在原处烧掉、消失（原来的元素先藏起来） */
export function burnAway(el: Element) {
  const stage = stageInfo.el;
  if (!stage || typeof (el as HTMLElement).animate !== 'function') return;
  const r = rectInStage(el);
  if (r.r - r.l <= 0) return;
  const ghost = el.cloneNode(true) as HTMLElement;
  ghost.classList.remove('hovered', 'picked');
  ghost.classList.add('gain-fly');
  ghost.removeAttribute('style');
  Object.assign(ghost.style, { position: 'absolute', left: `${r.l}px`, top: `${r.t}px`, width: `${r.r - r.l}px`, height: `${r.b - r.t}px`, margin: '0', zIndex: '400', pointerEvents: 'none' });
  stage.appendChild(ghost);
  (el as HTMLElement).style.visibility = 'hidden';
  const anim = ghost.animate(
    [
      { transform: 'scale(1)', filter: 'brightness(1)', opacity: 1 },
      { transform: 'scale(1.06)', filter: 'brightness(1.8) sepia(0.8) saturate(3) hue-rotate(-20deg)', opacity: 1, offset: 0.35 },
      { transform: 'translateY(-24px) scale(0.92)', filter: 'brightness(0.4) sepia(1) blur(2px)', opacity: 0 },
    ],
    { duration: 700, easing: 'ease-in' },
  );
  anim.onfinish = () => ghost.remove();
  setTimeout(() => ghost.remove(), 1100);
}

/** 顶栏上的收获目标 */
export const gainTargets = {
  gold: () => document.querySelector('.topbar .tb-gold'),
  deck: () => document.querySelector('.topbar [aria-label="查看牌组"]'),
  potion: (slot: number) => () => document.querySelectorAll('.topbar .tb-potions .potion-slot')[slot] ?? null,
  relic: (id: string) => () => document.querySelector(`.relic-bar [data-relic="${id}"]`),
};

/** 遗物、药水图标从 from 的中心飞向目标（界面上没有现成的图标可以复制时用） */
function flyIcon(url: string, from: Rect, findTarget: () => Element | null, delay: number) {
  const stage = stageInfo.el;
  if (!stage) return;
  const img = document.createElement('img');
  img.className = 'item-icon';
  img.src = url;
  img.alt = '';
  const sz = 56;
  const c = centered(from, sz, sz);
  Object.assign(img.style, { position: 'absolute', left: `${c.l}px`, top: `${c.t}px`, width: `${sz}px`, height: `${sz}px`, visibility: 'hidden' });
  stage.appendChild(img);
  // flyGain 当场复制出飞行物，复制完这个临时图标就没用了
  flyGain(img, findTarget, { hideTarget: true, delay, duration: 640 });
  img.remove();
}

/** 生命变化：数字从生命值下方飘出（回复绿色、受伤红色），生命值弹一下或抖一下 */
function hpFloat(text: string, kind: 'heal' | 'hurt' | 'max', delay: number) {
  const stage = stageInfo.el;
  const counter = document.querySelector('.topbar .tb-hp');
  if (!stage || !counter || typeof stage.animate !== 'function') return;
  const r = rectInStage(counter);
  const el = document.createElement('div');
  el.className = `gain-fly hp-float ${kind}`;
  el.textContent = text;
  // 左边与生命值对齐（生命值在屏幕左侧，居中的话长文字会超出屏幕）
  Object.assign(el.style, { position: 'absolute', left: `${r.l + 6}px`, top: `${r.b + 4}px`, zIndex: '400', pointerEvents: 'none', transformOrigin: 'left center' });
  stage.appendChild(el);
  const anim = el.animate(
    [
      { transform: 'translateY(-6px) scale(0.6)', opacity: 0 },
      { transform: 'translateY(4px) scale(1.15)', opacity: 1, offset: 0.2 },
      { transform: 'translateY(10px) scale(1)', opacity: 1, offset: 0.7 },
      { transform: 'translateY(26px) scale(1)', opacity: 0 },
    ],
    { duration: 1300, delay, fill: 'backwards', easing: 'ease-out' },
  );
  anim.onfinish = () => el.remove();
  setTimeout(() => el.remove(), delay + 1700);
  setTimeout(() => (kind === 'hurt' ? deny(counter) : pop(counter)), delay + 120);
}

const signed = (n: number) => (n > 0 ? `+${n}` : `−${-n}`);

interface GainSnap {
  gold: number;
  hp: number;
  maxHp: number;
  relics: Map<string, number>;
  potions: (string | null)[];
  inCombat: boolean;
}

function snapGains(run: Run): GainSnap {
  return {
    gold: run.gold,
    hp: run.hp,
    maxHp: run.maxHp,
    relics: new Map(run.relics.map((r) => [r.id, r.counter])),
    potions: [...run.potions],
    inCombat: !!run.combat,
  };
}

function stageCenter(): Rect {
  const { w, h } = stageInfo;
  return centered({ l: 0, t: 0, r: w, b: h }, 80, 80);
}

/**
 * 执行一次选择（事件选项、篝火、先古之民的祝福……），并把结果演出来：
 * 金币、遗物、药水从点下的按钮飞向顶栏，丢的金币从顶栏飞向按钮，生命变化在生命值下方飘字，
 * 计数变化的遗物弹一下。牌的增减由卡牌展示和移除动画负责。
 */
export function actWithGains(run: Run, src: Element | null, fn: () => void) {
  const from = src && src.isConnected ? rectInStage(src) : stageCenter();
  const before = snapGains(run);
  act(fn);
  // 换了一局（放弃、读档）就不演了
  if (state.run !== run) return;
  let delay = 0;
  const dg = run.gold - before.gold;
  if (dg > 0) gainGoldFx(from, Math.min(9, 3 + Math.floor(dg / 40)));
  else if (dg < 0) spendGold(from, Math.min(7, 2 + Math.floor(-dg / 40)));
  for (const r of run.relics) {
    if (!before.relics.has(r.id)) {
      flyIcon(relicArtUrl(r.id), from, gainTargets.relic(r.id), delay);
      delay += 140;
    } else if (before.relics.get(r.id) !== r.counter) {
      const find = gainTargets.relic(r.id);
      requestAnimationFrame(() => requestAnimationFrame(() => find() && pop(find()!)));
    }
  }
  run.potions.forEach((p, i) => {
    if (!p || p === before.potions[i]) return;
    flyIcon(potionArtUrl(p), from, gainTargets.potion(i), delay);
    delay += 140;
  });
  // 进了战斗时顶栏显示的是战斗中的生命，不再飘字
  if (!before.inCombat && !run.combat) {
    const dMax = run.maxHp - before.maxHp;
    // 加最大生命会同时加当前生命，减最大生命会把当前生命压到上限以内：这部分不重复飘字
    const dHp = run.hp - (dMax > 0 ? before.hp + dMax : Math.min(before.hp, run.maxHp));
    let t = 0;
    if (dMax) {
      hpFloat(`最大生命 ${signed(dMax)}`, dMax > 0 ? 'max' : 'hurt', t);
      t += 260;
    }
    if (dHp) hpFloat(signed(dHp), dHp > 0 ? 'heal' : 'hurt', t);
  }
}
