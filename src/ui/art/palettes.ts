/** 各职业/卡色的绘画色板 */
export interface Pal {
  /** 背景暗部 */
  dark: string;
  /** 背景中间调 */
  mid: string;
  /** 主体背后的光 */
  light: string;
  /** 强调色（衣物、能量） */
  accent: string;
  /** 次要强调色 */
  accent2: string;
}

export const PALS: Record<string, Pal> = {
  ironclad: { dark: '#1c0806', mid: '#5a1a12', light: '#ff9a52', accent: '#b8321f', accent2: '#e8b04a' },
  silent: { dark: '#07150f', mid: '#1d4430', light: '#c4f08a', accent: '#2f6a44', accent2: '#8fd16a' },
  regent: { dark: '#120c26', mid: '#3d2a5a', light: '#ffd77a', accent: '#d9821f', accent2: '#f6e3a6' },
  necrobinder: { dark: '#150818', mid: '#44183f', light: '#f0a0e4', accent: '#8f3a86', accent2: '#d6b8ff' },
  defect: { dark: '#06111f', mid: '#173a63', light: '#8af0ff', accent: '#4f7fb0', accent2: '#7ef2ff' },
  colorless: { dark: '#14120e', mid: '#433d31', light: '#f6e6b8', accent: '#8a7d62', accent2: '#e8d9a8' },
  curse: { dark: '#0b0510', mid: '#2a1033', light: '#b45ad6', accent: '#5e2a6e', accent2: '#e07ad8' },
  status: { dark: '#111216', mid: '#33363e', light: '#c8ccd6', accent: '#6a6e78', accent2: '#a8acb8' },
};

/** 材质色 */
export const M = {
  steel: '#cdd3dd',
  steelDark: '#7a8394',
  gold: '#e0a93c',
  goldDark: '#8f5f1a',
  leather: '#6b4426',
  wood: '#7a4f2a',
  bone: '#ece2c8',
  boneDark: '#a99a7a',
  blood: '#c4162a',
  bloodDark: '#62060f',
  flame1: '#fff2a8',
  flame2: '#ffbe3d',
  flame3: '#ff6a1f',
  flame4: '#c2200e',
  poison: '#93e04c',
  poisonDark: '#2f6a16',
  ice: '#c8f2ff',
  iceDark: '#4f9fd0',
  bolt: '#fff7a8',
  boltDark: '#e8b52a',
  void: '#2c1745',
  voidLight: '#a865ff',
  skin: '#e2ab8a',
  skinDark: '#9e6448',
  stone: '#8e8a84',
  stoneDark: '#4c4844',
  white: '#fbf6ea',
};
