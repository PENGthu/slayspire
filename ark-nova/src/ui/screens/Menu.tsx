// 主菜单与开局设置。
import { useState } from 'preact/hooks';
import { MAPS, MAP_IDS } from '../../game/maps';
import { SOLO_ROUNDS } from '../../game/rules';
import type { AiLevel } from '../../game/types';
import { loadSaved, resumeGame, set, startGame, state, useStore } from '../store';

export function MenuScreen() {
  const s = useStore();
  const saved = s.hasSave ? loadSaved() : null;
  return (
    <div class="menu-screen">
      <div class="menu-box">
        <div class="menu-logo">
          <span class="big-emoji">🦒🐘🦜</span>
          <h1>方舟动物园</h1>
          <p class="sub">Ark Nova · 网页同人版</p>
        </div>
        <div class="menu-buttons">
          {saved && (
            <button class="primary big" onClick={() => resumeGame(saved)}>
              继续游戏
              <small>
                {saved.players.map((p) => p.name).join(' vs ')} · 第 {Math.floor(saved.turn / saved.players.length) + 1} 轮
              </small>
            </button>
          )}
          <button class={saved ? 'big' : 'primary big'} onClick={() => set({ screen: 'setup' })}>
            新游戏
            <small>和 AI 对战，或多人同屏轮流</small>
          </button>
          <button class="big" onClick={() => set({ screen: 'online' })}>
            🌐 联机对战
            <small>每人用自己的手机或电脑，开房间一起玩</small>
          </button>
          <button class="big" onClick={() => set({ screen: 'rules' })}>
            规则说明
          </button>
          <button class="big" onClick={() => set({ screen: 'compendium' })}>
            卡牌图鉴
          </button>
        </div>
        <p class="note">
          建造你的现代动物园：修建围栏、引进动物、结交合作伙伴、支持野生动物保护项目。1–4 人（另有 5 人扩展），可以和 AI 对战、多人同屏轮流，也可以开房间用各自的设备联机。进度自动保存在本机浏览器。
        </p>
        <p class="note small">
          粉丝自制的非商业作品，复刻原作《方舟动物园》（Ark Nova，Mathias Wigge 设计，Feuerland Spiele 出版）基础游戏的规则、地图与卡牌功能；卡牌文字由本作重新撰写，插图为自绘，与原作出版方无关。喜欢的话请支持正版桌游。
        </p>
      </div>
    </div>
  );
}

interface Seat {
  name: string;
  kind: 'human' | AiLevel;
  map: string;
}

const AI_NAMES = ['小熊猫园长', '企鹅园长', '树懒园长', '狐獴园长'];

export function SetupScreen() {
  useStore();
  const [count, setCount] = useState(2);
  const [seats, setSeats] = useState<Seat[]>([
    { name: '你', kind: 'human', map: 'mA' },
    { name: AI_NAMES[0], kind: 'normal', map: 'm1' },
    { name: AI_NAMES[1], kind: 'normal', map: 'm2' },
    { name: AI_NAMES[2], kind: 'normal', map: 'm3' },
    { name: AI_NAMES[3], kind: 'normal', map: 'm4' },
  ]);
  const [soloAppeal, setSoloAppeal] = useState(10);
  const [shuffleOrder, setShuffleOrder] = useState(true);
  const upd = (i: number, patch: Partial<Seat>) => setSeats(seats.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const start = () => {
    let players = seats.slice(0, count).map((s, i) => ({
      name: s.name.trim() || `玩家 ${i + 1}`,
      ai: s.kind === 'human' ? null : s.kind,
      map: s.map,
    }));
    if (shuffleOrder && count > 1) {
      players = players
        .map((p) => ({ p, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .map((x) => x.p);
    }
    startGame({ players, seed: (Math.random() * 2 ** 32) >>> 0, soloAppeal: count === 1 ? soloAppeal : undefined });
  };
  return (
    <div class="menu-screen">
      <div class="menu-box setup">
        <h2>新游戏</h2>
        <div class="setup-row">
          玩家人数：
          {[1, 2, 3, 4, 5].map((n) => (
            <button class={count === n ? 'on' : ''} onClick={() => setCount(n)}>
              {n === 1 ? '1（单人挑战）' : n === 5 ? '5（扩展）' : n}
            </button>
          ))}
        </div>
        {count === 5 && <p class="hint">原作支持 1–4 人。5 人是扩展玩法：休息轨延长到 19 格，其余规则不变，一局会比较长。</p>}
        {count === 1 && (
          <>
            <p class="hint">单人挑战（原版规则）：共 6 轮，每轮 {SOLO_ROUNDS.join(' / ')} 个回合，每轮结束休息。最后一次休息后得分 ≥ 0 即获胜。</p>
            <div class="setup-row">
              起始吸引力（难度）：
              {[
                [20, '入门'],
                [15, '简单'],
                [10, '普通'],
                [5, '困难'],
                [0, '专家'],
              ].map(([v, label]) => (
                <button class={soloAppeal === v ? 'on' : ''} onClick={() => setSoloAppeal(v as number)}>
                  {label}（{v}）
                </button>
              ))}
            </div>
          </>
        )}
        <div class="seats">
          {seats.slice(0, count).map((s, i) => (
            <div class="seat">
              <span class="seat-no">{i + 1}</span>
              <input value={s.name} maxLength={10} onInput={(e) => upd(i, { name: (e.target as HTMLInputElement).value })} />
              <select value={s.kind} onChange={(e) => upd(i, { kind: (e.target as HTMLSelectElement).value as Seat['kind'] })}>
                <option value="human">人类</option>
                {count > 1 && <option value="easy">AI · 简单</option>}
                {count > 1 && <option value="normal">AI · 普通</option>}
                {count > 1 && <option value="hard">AI · 困难</option>}
              </select>
              <select value={s.map} onChange={(e) => upd(i, { map: (e.target as HTMLSelectElement).value })} title={MAPS[s.map].desc}>
                {MAP_IDS.map((id) => (
                  <option value={id}>{MAPS[id].name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div class="map-descs">
          {[...new Set(seats.slice(0, count).map((s) => s.map))].map((id) => (
            <p>
              <b>{MAPS[id].name}</b>：{MAPS[id].desc}
            </p>
          ))}
        </div>
        {count > 1 && (
          <label class="check">
            <input type="checkbox" checked={shuffleOrder} onChange={(e) => setShuffleOrder((e.target as HTMLInputElement).checked)} />
            随机决定座次（后手玩家开局有少量吸引力补偿）
          </label>
        )}
        <div class="modal-actions">
          <button onClick={() => set({ screen: 'menu' })}>返回</button>
          <button class="primary big" disabled={count === 1 && seats[0].kind !== 'human'} onClick={start}>
            开始游戏
          </button>
        </div>
      </div>
    </div>
  );
}

export { state };
