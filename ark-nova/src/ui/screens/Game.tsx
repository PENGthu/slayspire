// 对局界面：桌面为左右两栏（动物园 / 公共区），手机为分页。
import { useEffect } from 'preact/hooks';
import { decision, ranking } from '../../game/engine';
import { getMap } from '../../game/maps';
import { scoringCp } from '../../game/engine';
import { cpPoints } from '../../game/rules';
import type { GameState } from '../../game/types';
import {
  animalTargets,
  ghostCells,
  myDecision,
  onMapCell,
  onMapHover,
  placeAnimal,
  placingType,
  rotate,
  validAnchors,
} from '../interact';
import { act, markGuideSeen, me, quitToMenu, saveSettings, set, state, uncover, useStore } from '../store';
import { ScoreBar } from '../components/Common';
import {
  CardModal,
  ChooseModal,
  DecisionBar,
  PickModal,
  ProjectModal,
  ReleaseModal,
} from '../components/Decision';
import { ActionRow, AssocPanel, BreakTrack, DisplayPanel, HandPanel, LogPanel, PlayerChips, PlayerDetail, PlayerStats } from '../components/Panels';
import { ZooMap } from '../components/ZooMap';
import { Modal } from '../components/Common';
import { RulesContent } from './Rules';

export function GameScreen() {
  const s = useStore();
  const g = s.g!;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'r' || e.key === 'R') {
        if (placingType(state.g!)) rotate();
      } else if (e.key === 'Escape') {
        if (state.modal) set({ modal: null });
        else {
          state.sel.build = null;
          state.sel.card = null;
          state.sel.action = null;
          set({});
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const mine = myDecision(g);
  const viewIdx = s.view;
  const viewP = g.players[viewIdx];
  const isActiveView = !!mine && mine.p === viewIdx;
  const ghost = isActiveView ? ghostCells(g) : null;
  const anchors = isActiveView && placingType(g) ? validAnchors(g) : undefined;
  const targets = isActiveView && mine?.k === 'animals' && s.sel.card ? animalTargets(g) : undefined;
  const meIdx = me();

  const zoo = (
    <div class="zoo-area">
      <div class="zoo-head" style={{ '--pc': viewP.color }}>
        <b>{viewP.name}</b> 的动物园 <small>{getMap(viewP.map).name}</small>
        {viewIdx !== meIdx && (
          <button class="mini" onClick={() => set({ view: meIdx })}>
            回到我的动物园
          </button>
        )}
      </div>
      <PlayerStats g={g} pi={viewIdx} />
      <div class="map-wrap">
        <ZooMap
          p={viewP}
          fresh={s.fresh}
          ghost={ghost}
          anchors={anchors}
          targets={targets}
          onCell={isActiveView ? onMapCell : undefined}
          onHover={isActiveView ? onMapHover : undefined}
          onBuilding={targets ? placeAnimal : undefined}
        />
        {ghost && !ghost.ok && ghost.err && <div class="map-err">{ghost.err}</div>}
        {placingType(g) && isActiveView && (
          <div class="map-tools">
            <button onClick={rotate}>⟳ 旋转</button>
            {ghost?.ok && matchMedia('(hover: none)').matches && (
              <button
                class="primary"
                onClick={() => {
                  onMapCell(state.sel.anchor!);
                }}
              >
                放在这里
              </button>
            )}
          </div>
        )}
      </div>
      <div class="map-legend">
        <span>💧 水域</span>
        <span>🪨 岩石</span>
        <span class="lg-upg">II 需要升级的建造</span>
        <span>💰🃏⭐✖️ 覆盖后获得奖励</span>
      </div>
    </div>
  );

  const right = (
    <div class="side">
      <div class="tabs">
        <button class={s.tab === 'public' ? 'on' : ''} onClick={() => set({ tab: 'public' })}>
          公共区
        </button>
        <button class={s.tab === 'players' ? 'on' : ''} onClick={() => set({ tab: 'players' })}>
          玩家
        </button>
        <button class={s.tab === 'log' ? 'on' : ''} onClick={() => set({ tab: 'log' })}>
          日志
        </button>
      </div>
      <div class="side-body">
        {s.tab === 'public' && (
          <>
            <DisplayPanel g={g} />
            <AssocPanel g={g} />
          </>
        )}
        {s.tab === 'players' && <PlayersTab g={g} />}
        {s.tab === 'log' && <LogPanel g={g} />}
      </div>
    </div>
  );

  const bottom = (
    <div class="bottom">
      <DecisionBar g={g} />
      <div class="bottom-row">
        <div class="my-actions">
          <div class="label">行动卡（强度 1→5）</div>
          <ActionRow g={g} pi={meIdx} />
        </div>
        <div class="my-hand">
          <div class="label">
            手牌 <small>右键或点 i 查看详情</small>
          </div>
          <HandPanel g={g} pi={meIdx} />
        </div>
      </div>
    </div>
  );

  return (
    <div class={`game mtab-${s.mobileTab}`}>
      <div class="topbar">
        <button class="logo" onClick={() => set({ modal: { k: 'menu' } })} title="菜单">
          🦒 <span>方舟动物园</span>
        </button>
        <BreakTrack g={g} />
        <PlayerChips g={g} />
        <div class="top-buttons">
          <button onClick={() => set({ modal: { k: 'rules' } })} title="规则说明">
            ？
          </button>
          <button onClick={() => set({ modal: { k: 'menu' } })} title="菜单">
            ☰
          </button>
        </div>
      </div>
      <div class="mobile-tabs">
        {(
          [
            ['zoo', '动物园'],
            ['hand', '手牌'],
            ['public', '公共区'],
            ['players', '玩家'],
            ['log', '日志'],
          ] as const
        ).map(([k, label]) => (
          <button class={s.mobileTab === k ? 'on' : ''} onClick={() => set({ mobileTab: k })}>
            {label}
          </button>
        ))}
      </div>
      <div class="main">
        {zoo}
        {right}
        <div class="mobile-only m-hand">
          <HandPanel g={g} pi={meIdx} />
        </div>
        <div class="mobile-only m-public">
          <DisplayPanel g={g} />
          <AssocPanel g={g} />
        </div>
        <div class="mobile-only m-players">
          <PlayersTab g={g} />
        </div>
        <div class="mobile-only m-log">
          <LogPanel g={g} />
        </div>
      </div>
      {bottom}
      <Overlays g={g} />
    </div>
  );
}

function PlayersTab({ g }: { g: GameState }) {
  return (
    <div class="players-tab">
      {g.players.map((p, i) => (
        <details open={i === state.view}>
          <summary style={{ '--pc': p.color }}>
            <b>{p.name}</b> {p.ai ? `（AI · ${{ easy: '简单', normal: '普通', hard: '困难' }[p.ai]}）` : ''}
            <ScoreBar p={p} thin />
            <button class="mini" onClick={() => set({ view: i, mobileTab: 'zoo' })}>
              看动物园
            </button>
          </summary>
          <PlayerDetail g={g} pi={i} />
        </details>
      ))}
    </div>
  );
}

function Overlays({ g }: { g: GameState }) {
  const m = state.modal;
  return (
    <>
      <PickModal g={g} />
      <ChooseModal g={g} />
      {m?.k === 'card' && <CardModal id={m.id} />}
      {m?.k === 'project' && <ProjectModal g={g} id={m.id} fromHand={m.fromHand} display={m.display} />}
      {m?.k === 'release' && <ReleaseModal g={g} id={m.id} level={m.level} fromHand={m.fromHand} display={m.display} />}
      {m?.k === 'rules' && (
        <Modal title="规则速查" onClose={() => set({ modal: null })} wide>
          <RulesContent />
        </Modal>
      )}
      {m?.k === 'menu' && <MenuModal />}
      {m?.k === 'guide' && <GuideModal />}
      {m?.k === 'confirm' && (
        <Modal title={m.text} onClose={() => set({ modal: null })}>
          <div class="modal-actions">
            <button onClick={() => set({ modal: null })}>取消</button>
            <button
              class="primary"
              onClick={() => {
                set({ modal: null });
                m.onYes();
              }}
            >
              {m.yes}
            </button>
          </div>
        </Modal>
      )}
      {state.cover !== null && (
        <div class="cover">
          <div class="cover-box" style={{ '--pc': g.players[state.cover].color }}>
            <h2>轮到 {g.players[state.cover].name}</h2>
            <p>请把设备交给 {g.players[state.cover].name}，准备好后点击下面的按钮。</p>
            <button class="primary big" onClick={uncover}>
              我准备好了
            </button>
          </div>
        </div>
      )}
      {g.over && <GameOver g={g} />}
      <Toasts />
    </>
  );
}

function MenuModal() {
  const s = state;
  return (
    <Modal title="菜单" onClose={() => set({ modal: null })}>
      <div class="choose-list">
        <button class="choice" onClick={() => set({ modal: { k: 'guide' } })}>
          🧭 新手指引
        </button>
        <button class="choice" onClick={() => set({ modal: { k: 'rules' } })}>
          📖 规则速查
        </button>
        <div class="setting">
          AI 速度：
          {(['fast', 'normal', 'slow'] as const).map((v) => (
            <button
              class={s.settings.aiSpeed === v ? 'on' : ''}
              onClick={() => {
                s.settings.aiSpeed = v;
                set({});
                saveSettings();
              }}
            >
              {{ fast: '快', normal: '正常', slow: '慢' }[v]}
            </button>
          ))}
        </div>
        <div class="setting">
          音效：
          <button
            class={s.settings.sound ? 'on' : ''}
            onClick={() => {
              s.settings.sound = !s.settings.sound;
              set({});
              saveSettings();
            }}
          >
            {s.settings.sound ? '开' : '关'}
          </button>
        </div>
        <div class="setting">
          同屏换人时遮挡手牌：
          <button
            class={s.settings.cover ? 'on' : ''}
            onClick={() => {
              s.settings.cover = !s.settings.cover;
              set({});
              saveSettings();
            }}
          >
            {s.settings.cover ? '开' : '关'}
          </button>
        </div>
        <button
          class="choice"
          onClick={() => {
            set({ modal: null });
            quitToMenu();
          }}
        >
          🏠 回到主菜单（进度已自动保存）
        </button>
      </div>
    </Modal>
  );
}

function GuideModal() {
  const close = () => {
    markGuideSeen();
    set({ modal: null });
  };
  return (
    <Modal title="🧭 新手指引" onClose={close}>
      <div class="guide">
        <div class="guide-step">
          <b>🎯 目标</b>
          <p>吸引力（🎟️，主要来自动物）从左往右走，保护点数（🌿，主要来自保护项目）从右往左走。两个标记相遇就触发终局，交错得越多分越高。</p>
        </div>
        <div class="guide-step">
          <b>🃏 每回合选一张行动卡</b>
          <p>底部 5 张行动卡，位置 1–5 就是强度。用过的卡回到 1 号位，没用的卡会慢慢变强。点一张卡，确认强度后执行。</p>
        </div>
        <div class="guide-step">
          <b>🏗️ 先建围栏，再放动物</b>
          <p>建造时在底部选建筑，再在地图上点亮的格子放下（R 键旋转）。动物需要足够大的空围栏，有的还要靠近水 💧 或岩石 🪨。</p>
        </div>
        <div class="guide-step">
          <b>🤝 协会拿保护点数</b>
          <p>协会行动派工人去拿声望、合作动物园、大学，或者在右侧协会版图上支持保护项目——这是保护点数的主要来源。</p>
        </div>
        <div class="guide-step">
          <b>☕ 休息与收入</b>
          <p>抽牌和赞助拿钱会推动顶部的休息标记。到头时所有人按吸引力拿收入，手牌弃到上限。</p>
        </div>
        <p class="hint">右键或点卡牌上的 i 查看详情；点顶部玩家查看他们的动物园；随时可以从 ☰ 菜单打开规则速查。</p>
      </div>
      <div class="modal-actions">
        <button class="primary" onClick={close}>
          开始吧
        </button>
      </div>
    </Modal>
  );
}

function GameOver({ g }: { g: GameState }) {
  const order = ranking(g);
  const win = g.solo ? (g.players[0].final?.score ?? -1) >= 0 : true;
  return (
    <div class="gameover">
      <div class="go-box">
        <h2>{g.solo ? (win ? '🎉 挑战成功！' : '挑战失败') : `🏆 ${g.players[order[0]].name} 获胜！`}</h2>
        <table>
          <thead>
            <tr>
              <th>名次</th>
              <th>玩家</th>
              <th>吸引力</th>
              <th>保护点数</th>
              <th>终局奖励</th>
              <th>得分</th>
            </tr>
          </thead>
          <tbody>
            {order.map((i, r) => {
              const p = g.players[i];
              return (
                <tr style={{ '--pc': p.color }}>
                  <td>{r + 1}</td>
                  <td>
                    <b style={{ color: p.color }}>{p.name}</b>
                  </td>
                  <td>{p.appeal}</td>
                  <td>
                    {p.cp}（{cpPoints(p.cp)} 分）
                  </td>
                  <td class="bd">
                    {p.final?.breakdown.filter((b) => b.cp).map((b) => (
                      <div>
                        {b.label} +{b.cp}
                      </div>
                    ))}
                  </td>
                  <td>
                    <b class={(p.final?.score ?? 0) >= 0 ? 'pos' : 'neg'}>{p.final?.score}</b>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p class="hint">得分 = 吸引力 + 保护点数换算分 − 100（两个标记交错的距离）。</p>
        <div class="modal-actions">
          <button onClick={() => set({ screen: 'menu' })}>主菜单</button>
          <button class="primary" onClick={() => set({ screen: 'setup' })}>
            再来一局
          </button>
        </div>
      </div>
    </div>
  );
}

function Toasts() {
  const g = state.g;
  return (
    <>
      <div class="toasts">
        {state.toasts.map((t) => (
          <div class={`toast ${t.kind}`} key={t.key}>
            {t.text}
          </div>
        ))}
      </div>
      {g && (
        <div class="feed">
          {state.feed.map((x) => (
            <div class="feed-item" key={x.key} style={{ '--pc': g.players[x.p].color }}>
              <b>{g.players[x.p].name}</b> {x.text}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export { act, decision, scoringCp };
