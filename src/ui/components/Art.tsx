import type { IntentKind } from '../../game/types';

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
// 角色立绘（简化的剪影风格）
// ---------------------------------------------------------------------------

export function Portrait({ char, size = 1 }: { char: string; size?: number }) {
  const w = 120 * size;
  const h = 160 * size;
  return (
    <svg viewBox="0 0 120 160" width={w} height={h} class="portrait-svg">
      {char === 'ironclad' && <Ironclad />}
      {char === 'silent' && <Silent />}
      {char === 'regent' && <Regent />}
      {char === 'necrobinder' && <Necrobinder />}
      {char === 'defect' && <Defect />}
    </svg>
  );
}

function Ironclad() {
  return (
    <g stroke="#120806" stroke-width="2" stroke-linejoin="round">
      {/* 披风 */}
      <path d="M38 52 C24 80 22 120 30 150 L90 150 C96 118 94 82 82 52 Z" fill="#6e1712" />
      {/* 腿 */}
      <path d="M46 108 L44 152 L56 152 L59 112 Z" fill="#2b2a30" />
      <path d="M74 108 L76 152 L64 152 L61 112 Z" fill="#2b2a30" />
      <path d="M42 148 L58 148 L58 156 L40 156 Z" fill="#4a3424" />
      <path d="M62 148 L78 148 L80 156 L62 156 Z" fill="#4a3424" />
      {/* 躯干铠甲 */}
      <path d="M40 56 L80 56 L84 104 C72 112 48 112 36 104 Z" fill="#a8301f" />
      <path d="M46 62 L74 62 L76 86 C66 92 54 92 44 86 Z" fill="#c64a33" />
      <path d="M38 98 L82 98 L84 108 L36 108 Z" fill="#3a2a1e" />
      <rect x="55" y="98" width="10" height="10" fill="#c99236" />
      {/* 肩甲 */}
      <ellipse cx="36" cy="58" rx="14" ry="11" fill="#8e2618" />
      <ellipse cx="84" cy="58" rx="14" ry="11" fill="#8e2618" />
      {/* 手臂 */}
      <path d="M26 64 L22 96 L32 98 L36 68 Z" fill="#c98d6a" />
      <path d="M94 64 L100 92 L90 96 L84 68 Z" fill="#c98d6a" />
      {/* 头 */}
      <path d="M48 28 C48 16 72 16 72 28 L72 44 C70 52 50 52 48 44 Z" fill="#d6a27c" />
      <path d="M45 30 C42 12 60 6 66 10 C74 4 82 16 76 30 L72 24 L66 28 L60 22 L54 28 L48 24 Z" fill="#1c1514" />
      <path d="M53 38 L58 37 M62 37 L67 38" stroke="#2a1410" stroke-width="2.2" />
      <path d="M55 46 L65 46" stroke="#7a3a2a" stroke-width="1.6" />
      {/* 大剑 */}
      <g transform="rotate(-28 100 92)">
        <rect x="96" y="20" width="9" height="76" fill="#d8dce6" />
        <path d="M96 20 L100.5 8 L105 20 Z" fill="#d8dce6" />
        <rect x="88" y="94" width="25" height="6" fill="#c99236" />
        <rect x="97" y="100" width="7" height="18" fill="#4a2a14" />
      </g>
    </g>
  );
}

function Silent() {
  return (
    <g stroke="#06120a" stroke-width="2" stroke-linejoin="round">
      {/* 斗篷 */}
      <path d="M60 10 C36 12 30 40 32 60 C24 90 20 130 26 152 L94 152 C100 130 96 90 88 60 C90 40 84 12 60 10 Z" fill="#2d5a3a" />
      <path d="M60 18 C44 20 40 40 42 54 L78 54 C80 40 76 20 60 18 Z" fill="#0d1a12" />
      {/* 眼睛 */}
      <ellipse cx="52" cy="42" rx="4" ry="2.4" fill="#c8f7a5" stroke="none" />
      <ellipse cx="68" cy="42" rx="4" ry="2.4" fill="#c8f7a5" stroke="none" />
      {/* 面罩 */}
      <path d="M44 48 C52 56 68 56 76 48 L76 56 C68 62 52 62 44 56 Z" fill="#3f2d22" />
      {/* 身体 */}
      <path d="M44 62 L76 62 L80 110 L40 110 Z" fill="#3b4a3a" />
      <path d="M42 100 L78 100 L79 108 L41 108 Z" fill="#5a3b24" />
      <circle cx="60" cy="104" r="3.5" fill="#c99236" />
      {/* 腿 */}
      <path d="M46 110 L44 152 L56 152 L58 112 Z" fill="#24302a" />
      <path d="M74 110 L76 152 L64 152 L62 112 Z" fill="#24302a" />
      {/* 匕首 */}
      <g transform="rotate(35 26 96)">
        <path d="M22 66 L26 58 L30 66 L30 92 L22 92 Z" fill="#d6e2d6" />
        <rect x="18" y="92" width="16" height="4" fill="#5a3b24" />
        <rect x="23" y="96" width="6" height="12" fill="#2a1a10" />
      </g>
      <g transform="rotate(-35 94 96)">
        <path d="M90 66 L94 58 L98 66 L98 92 L90 92 Z" fill="#d6e2d6" />
        <rect x="86" y="92" width="16" height="4" fill="#5a3b24" />
        <rect x="91" y="96" width="6" height="12" fill="#2a1a10" />
      </g>
    </g>
  );
}

function Regent() {
  return (
    <g stroke="#1a0e02" stroke-width="2" stroke-linejoin="round">
      {/* 星光 */}
      <circle cx="96" cy="50" r="16" fill="#ffd56b" opacity="0.35" stroke="none" />
      <path d="M96 36 L99 46 L110 47 L101 53 L104 64 L96 57 L88 64 L91 53 L82 47 L93 46 Z" fill="#ffe08a" />
      {/* 披风 */}
      <path d="M40 52 C26 86 24 124 30 152 L90 152 C96 124 94 86 80 52 Z" fill="#9a4a0e" />
      {/* 长袍 */}
      <path d="M42 58 L78 58 L86 152 L34 152 Z" fill="#d9821f" />
      <path d="M56 58 L64 58 L66 152 L54 152 Z" fill="#f4e6c8" />
      <path d="M38 98 L82 98 L83 106 L37 106 Z" fill="#6a3608" />
      <circle cx="60" cy="102" r="4" fill="#ffe08a" />
      {/* 领子 */}
      <path d="M42 56 C50 66 70 66 78 56 L74 50 C66 56 54 56 46 50 Z" fill="#f4e6c8" />
      {/* 手臂 */}
      <path d="M40 62 L30 92 L38 96 L46 68 Z" fill="#d9821f" />
      <path d="M80 62 L92 70 L88 78 L76 70 Z" fill="#d9821f" />
      <circle cx="92" cy="70" r="5" fill="#f0c9a4" />
      {/* 头 */}
      <path d="M48 30 C48 18 72 18 72 30 L71 44 C68 52 52 52 49 44 Z" fill="#f0c9a4" />
      <path d="M46 34 C44 22 50 16 60 16 C70 16 76 22 74 34 L70 28 L50 28 Z" fill="#f5e3b5" />
      <circle cx="55" cy="38" r="1.8" fill="#2a1a08" stroke="none" />
      <circle cx="65" cy="38" r="1.8" fill="#2a1a08" stroke="none" />
      {/* 王冠 */}
      <path d="M46 20 L48 6 L54 14 L60 4 L66 14 L72 6 L74 20 Z" fill="#f2c040" />
      <circle cx="60" cy="13" r="2.4" fill="#d9472b" />
    </g>
  );
}

function Necrobinder() {
  return (
    <g stroke="#14061a" stroke-width="2" stroke-linejoin="round">
      {/* 灵光 */}
      <ellipse cx="60" cy="90" rx="52" ry="70" fill="#b05bd0" opacity="0.12" stroke="none" />
      {/* 法杖 */}
      <rect x="92" y="30" width="5" height="122" fill="#3a2a2e" />
      <circle cx="94.5" cy="26" r="10" fill="#efe6d6" />
      <circle cx="91" cy="25" r="2.4" fill="#2a1030" stroke="none" />
      <circle cx="98" cy="25" r="2.4" fill="#2a1030" stroke="none" />
      <path d="M90 31 L99 31" stroke="#2a1030" stroke-width="1.5" />
      {/* 长袍 */}
      <path d="M60 16 C40 18 36 44 38 58 C30 92 26 128 28 152 L92 152 C94 128 90 92 82 58 C84 44 80 18 60 16 Z" fill="#6b2a64" />
      <path d="M48 60 L72 60 L78 152 L42 152 Z" fill="#8f3a86" />
      <path d="M58 60 L62 60 L62 152 L58 152 Z" fill="#d9a3d0" />
      {/* 脸 */}
      <path d="M50 34 C50 24 70 24 70 34 L69 48 C66 54 54 54 51 48 Z" fill="#e7dcef" />
      <path d="M53 38 L57 41 M67 38 L63 41" stroke="#3a1040" stroke-width="2.4" />
      <path d="M56 47 L64 47" stroke="#8a4a8a" stroke-width="1.4" />
      {/* 兜帽 */}
      <path d="M44 40 C40 18 54 10 60 10 C66 10 80 18 76 40 L72 30 C66 22 54 22 48 30 Z" fill="#4a1a46" />
      {/* 手 */}
      <path d="M38 70 L28 100 L36 104 L46 74 Z" fill="#6b2a64" />
      <circle cx="32" cy="104" r="6" fill="#d18ce8" opacity="0.8" />
      <path d="M86 74 L94 90 L90 94 L80 80 Z" fill="#6b2a64" />
    </g>
  );
}

function Defect() {
  return (
    <g stroke="#06121c" stroke-width="2" stroke-linejoin="round">
      {/* 线缆尾巴 */}
      <path d="M44 104 C26 112 18 132 30 150" fill="none" stroke="#2a3a4a" stroke-width="5" />
      {/* 腿 */}
      <path d="M46 108 L42 152 L56 152 L58 112 Z" fill="#3b4c63" />
      <path d="M74 108 L78 152 L64 152 L62 112 Z" fill="#3b4c63" />
      <path d="M40 148 L58 148 L58 156 L38 156 Z" fill="#1f2a38" />
      <path d="M62 148 L80 148 L82 156 L62 156 Z" fill="#1f2a38" />
      {/* 躯干 */}
      <path d="M38 56 L82 56 L86 104 C74 112 46 112 34 104 Z" fill="#5b7fa8" />
      <path d="M44 62 L76 62 L78 96 C68 102 52 102 42 96 Z" fill="#7aa0c8" />
      <circle cx="60" cy="80" r="10" fill="#0e2233" />
      <circle cx="60" cy="80" r="6.5" fill="#7ef2ff" stroke="none" />
      <circle cx="60" cy="80" r="14" fill="#7ef2ff" opacity="0.18" stroke="none" />
      {/* 肩与手臂 */}
      <circle cx="34" cy="60" r="10" fill="#4a6688" />
      <circle cx="86" cy="60" r="10" fill="#4a6688" />
      <path d="M26 66 L18 98 L28 100 L36 70 Z" fill="#3b4c63" />
      <path d="M94 66 L104 96 L94 100 L84 70 Z" fill="#3b4c63" />
      <rect x="14" y="96" width="16" height="9" rx="3" fill="#2a3a4a" />
      <rect x="92" y="96" width="16" height="9" rx="3" fill="#2a3a4a" />
      {/* 头 */}
      <rect x="44" y="20" width="32" height="30" rx="8" fill="#6d8fb8" />
      <rect x="47" y="30" width="26" height="9" rx="4" fill="#0e2233" />
      <rect x="49" y="32" width="22" height="5" rx="2.5" fill="#7ef2ff" stroke="none" />
      <path d="M60 20 L60 10" stroke="#2a3a4a" stroke-width="3" />
      <circle cx="60" cy="8" r="3.5" fill="#ff7a6a" />
      <rect x="54" y="48" width="12" height="8" fill="#3b4c63" />
    </g>
  );
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
  return (
    <svg viewBox="0 0 100 110" width={100 * size} height={110 * size}>
      <g stroke="#2a2418" stroke-width="2" fill="#eee6d2" stroke-linejoin="round">
        <path d="M30 70 C28 90 36 104 50 106 C66 106 74 92 72 72 Z" />
        <rect x="26" y="26" width="10" height="44" rx="5" transform="rotate(-12 31 48)" />
        <rect x="40" y="12" width="10" height="56" rx="5" />
        <rect x="54" y="14" width="10" height="54" rx="5" />
        <rect x="67" y="24" width="9" height="46" rx="4.5" transform="rotate(10 71 47)" />
        <rect x="12" y="58" width="9" height="30" rx="4.5" transform="rotate(-50 16 73)" />
        <path d="M33 40 L36 40 M45 34 L45 37 M59 34 L59 37 M71 40 L68 40" stroke="#8a7f68" />
        <circle cx="44" cy="84" r="3" fill="#2a2418" stroke="none" />
        <circle cx="58" cy="84" r="3" fill="#2a2418" stroke="none" />
      </g>
    </svg>
  );
}
