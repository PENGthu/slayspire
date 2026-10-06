import type { IntentKind } from '../../game/types';
import { potionArtUrl, relicArtUrl } from '../art/itemArt';
import { portraitUrl } from '../art/portraitArt';

/** 意图图标（内联 SVG） */
export function IntentIcon({ kind, dmg = 0 }: { kind: IntentKind; dmg?: number }) {
  const sword = (
    <g>
      <path d="M25 2.5 L29.5 7 L13.5 23 L9 18.5 Z" fill={dmg >= 25 ? '#ffb3a8' : '#eef0f6'} stroke="#111" stroke-width="1.3" />
      <path d="M26.5 4 L13 17.5" stroke="#9aa0b5" stroke-width="1" />
      <path d="M6.5 16.5 L15.5 25.5 L13.5 27.5 L4.5 18.5 Z" fill="#c99236" stroke="#111" stroke-width="1.2" />
      <path d="M9 23 L3.5 28.5" stroke="#6a4316" stroke-width="3.2" stroke-linecap="round" />
    </g>
  );
  const shield = (
    <path d="M16 3 L27 7 V15 C27 22 22 27 16 29.5 C10 27 5 22 5 15 V7 Z" fill="#5d97d6" stroke="#0b1d33" stroke-width="1.6" />
  );
  const up = <path d="M16 3 L27 15 H20.5 V29 H11.5 V15 H5 Z" fill="#7fd06a" stroke="#0f2a0c" stroke-width="1.5" />;
  const drop = (
    <path d="M16 3 C16 3 27 15.5 27 21 A11 11 0 0 1 5 21 C5 15.5 16 3 16 3 Z" fill="#a873d8" stroke="#1a0b2a" stroke-width="1.5" />
  );
  const small = (el: preact.JSX.Element, x: number, y: number) => (
    <g transform={`translate(${x} ${y}) scale(0.55)`}>{el}</g>
  );
  let body: preact.JSX.Element;
  switch (kind) {
    case 'attack':
      body = sword;
      break;
    case 'attackDefend':
      body = (
        <g>
          {sword}
          {small(shield, 16, 15)}
        </g>
      );
      break;
    case 'attackBuff':
      body = (
        <g>
          {sword}
          {small(up, 16, 14)}
        </g>
      );
      break;
    case 'attackDebuff':
      body = (
        <g>
          {sword}
          {small(drop, 16, 14)}
        </g>
      );
      break;
    case 'defend':
      body = shield;
      break;
    case 'defendBuff':
      body = (
        <g>
          {shield}
          {small(up, 15, 14)}
        </g>
      );
      break;
    case 'buff':
      body = up;
      break;
    case 'debuff':
      body = drop;
      break;
    case 'strongDebuff':
      body = (
        <g>
          <circle cx="16" cy="14" r="11" fill="#c6b8e0" stroke="#1a0b2a" stroke-width="1.5" />
          <rect x="11" y="22" width="10" height="7" rx="2" fill="#c6b8e0" stroke="#1a0b2a" stroke-width="1.5" />
          <circle cx="12" cy="14" r="3" fill="#2a1240" />
          <circle cx="20" cy="14" r="3" fill="#2a1240" />
        </g>
      );
      break;
    case 'sleep':
      body = (
        <text x="16" y="24" text-anchor="middle" font-size="22" font-weight="700" fill="#cfe3ff" stroke="#000" stroke-width="1">
          Zz
        </text>
      );
      break;
    case 'stun':
      body = (
        <path
          d="M16 2 L19 12 L29 12 L21 18 L24 28 L16 22 L8 28 L11 18 L3 12 L13 12 Z"
          fill="#ffe08a"
          stroke="#3a2a00"
          stroke-width="1.4"
        />
      );
      break;
    case 'escape':
      body = <path d="M4 12 H18 V5 L29 16 L18 27 V20 H4 Z" fill="#e6e6e6" stroke="#111" stroke-width="1.4" />;
      break;
    case 'summon':
      body = (
        <g>
          <circle cx="16" cy="16" r="12.5" fill="#6a4c8c" stroke="#120a1c" stroke-width="1.5" />
          <path d="M16 9 V23 M9 16 H23" stroke="#fff" stroke-width="3.2" stroke-linecap="round" />
        </g>
      );
      break;
    case 'heal':
      body = (
        <path
          d="M16 28 C6 21 3 15 3 10.5 A6.5 6.5 0 0 1 16 8 A6.5 6.5 0 0 1 29 10.5 C29 15 26 21 16 28 Z"
          fill="#7fd06a"
          stroke="#0f2a0c"
          stroke-width="1.5"
        />
      );
      break;
    default:
      body = (
        <text x="16" y="25" text-anchor="middle" font-size="24" font-weight="700" fill="#e9dcff" stroke="#000" stroke-width="1">
          ?
        </text>
      );
  }
  return <svg viewBox="0 0 32 32">{body}</svg>;
}

export const INTENT_DESC: Record<IntentKind, string> = {
  attack: '这名敌人打算发动攻击。',
  attackBuff: '这名敌人打算发动攻击并强化自身。',
  attackDebuff: '这名敌人打算发动攻击并施加负面效果。',
  attackDefend: '这名敌人打算发动攻击并获得格挡。',
  buff: '这名敌人打算强化自身。',
  debuff: '这名敌人打算对你施加负面效果。',
  strongDebuff: '这名敌人打算对你施加强力的负面效果。',
  defend: '这名敌人打算获得格挡。',
  defendBuff: '这名敌人打算获得格挡并强化自身。',
  escape: '这名敌人打算逃跑。',
  sleep: '这名敌人正在沉睡。',
  stun: '这名敌人被眩晕了。',
  unknown: '这名敌人的意图不明。',
  summon: '这名敌人打算召唤帮手。',
  heal: '这名敌人打算回复生命。',
};

// ---------------------------------------------------------------------------
// 角色立绘
// ---------------------------------------------------------------------------

export function Portrait({ char, size = 1 }: { char: string; size?: number }) {
  const url = portraitUrl(char);
  return url ? <img src={url} width={120 * size} height={160 * size} class="portrait-svg" alt="" draggable={false} /> : null;
}

/** 充能球图标 */
export function OrbArt({ color, art }: { color: string; art: string }) {
  return (
    <span class="orb-art" style={{ background: `radial-gradient(circle at 36% 30%, ${color} 0%, #24406a 58%, #0b1424 100%)`, boxShadow: `0 0 14px ${color}88, inset 0 0 6px rgba(0,0,0,0.5)` }}>
      {art}
    </span>
  );
}

/** 奥斯提：巨大的骸骨之手 */
export function OstyArt({ size = 1 }: { size?: number }) {
  const url = portraitUrl('osty');
  return url ? <img src={url} width={100 * size} height={133 * size} class="portrait-svg" alt="" draggable={false} /> : null;
}

/** 遗物图标（尺寸随所在元素的字号缩放） */
export function RelicIcon({ id }: { id: string }) {
  return <img class="item-icon" src={relicArtUrl(id)} alt="" draggable={false} />;
}

/** 药水图标 */
export function PotionIcon({ id }: { id: string }) {
  return <img class="item-icon" src={potionArtUrl(id)} alt="" draggable={false} />;
}
