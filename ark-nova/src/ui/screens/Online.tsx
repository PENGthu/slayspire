// 联机：创建 / 加入房间、房间大厅，以及对局中的联机状态条与房间面板。
import { useEffect, useState } from 'preact/hooks';
import { MAPS, MAP_IDS } from '../../game/maps';
import type { AiLevel, GameState } from '../../game/types';
import {
  createRoom,
  current,
  hostStart,
  inviteLink,
  joinRoom,
  leaveRoom,
  linkCode,
  clearLinkCode,
  lobby,
  myCid,
  normalizeCode,
  resumeHost,
  resumeGuest,
  resumeMySeat,
  savedGuest,
  savedHost,
  savedName,
  SERVERS,
  takeover,
  validCode,
} from '../../net/online';
import { MAX_SEATS, type Seat } from '../../net/room';
import { Modal } from '../components/Common';
import { set, state, toast, useStore } from '../store';

const AI_LABEL: Record<AiLevel, string> = { easy: 'AI · 简单', normal: 'AI · 普通', hard: 'AI · 困难' };

function defaultName(): string {
  return savedName() || `园长${Math.floor(Math.random() * 90 + 10)}`;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast('已复制');
  } catch {
    window.prompt('复制下面的内容', text);
  }
}

// ———————————————————————————————————————————— 创建 / 加入

export function OnlineScreen() {
  useStore();
  const [name, setName] = useState(defaultName);
  const [code, setCode] = useState(() => linkCode() ?? '');
  // 从邀请链接进来时只显示加入
  const [fromLink, setFromLink] = useState(() => !!linkCode());
  const [server, setServer] = useState('');
  const [busy, setBusy] = useState(false);
  const host = savedHost();
  const guest = savedGuest();
  const okName = name.trim().length > 0;
  const join = () => {
    const c = normalizeCode(code);
    if (!validCode(c)) return toast('房间号是 6 位字母和数字', 'error');
    if (!okName) return toast('先写一个名字', 'error');
    clearLinkCode();
    joinRoom(c, name.trim());
  };
  return (
    <div class="menu-screen">
      <div class="menu-box setup online-box">
        <h2>🌐 联机对战</h2>
        <p class="hint">
          每人用自己的手机或电脑打开这个网页。一人创建房间，把邀请链接或房间号发给朋友；朋友打开链接就能入座。2–5 人，空位可以交给 AI。
        </p>
        <label class="field">
          你的名字
          <input value={name} maxLength={10} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        </label>
        <div class="online-cols">
          <div class="online-card">
            <h3>加入房间</h3>
            <input
              class="code-input"
              placeholder="房间号"
              value={code}
              maxLength={8}
              onInput={(e) => setCode(normalizeCode((e.target as HTMLInputElement).value))}
              onKeyDown={(e) => e.key === 'Enter' && join()}
            />
            <button class="primary big" disabled={!okName || code.length < 6} onClick={join}>
              加入
            </button>
          </div>
          {fromLink ? (
            <button class="ghost" onClick={() => setFromLink(false)}>
              我要自己开房间
            </button>
          ) : (
            <div class="online-card">
              <h3>创建房间</h3>
              <p class="hint">你是房主：进度保存在你的浏览器里，AI 也在你这里运行。对局中请保持页面打开。</p>
              <label class="field small">
                线路
                <select value={server} onChange={(e) => setServer((e.target as HTMLSelectElement).value)}>
                  <option value="">自动选择最快的</option>
                  {SERVERS.map((s) => (
                    <option value={s.key}>{s.name}</option>
                  ))}
                </select>
              </label>
              <button
                class="primary big"
                disabled={!okName || busy}
                onClick={async () => {
                  setBusy(true);
                  await createRoom(name.trim(), server || null);
                  setBusy(false);
                }}
              >
                {busy ? '连接中…' : '创建房间'}
              </button>
            </div>
          )}
        </div>
        {(host || guest) && (
          <div class="resume-row">
            {host && (
              <button onClick={() => resumeHost()}>
                继续主持房间 <b>{host.code}</b>
                {host.g ? <small>（对局进行中）</small> : null}
              </button>
            )}
            {guest && (
              <button onClick={() => resumeGuest()}>
                回到房间 <b>{guest.code}</b>
              </button>
            )}
          </div>
        )}
        <p class="note small">
          消息经免费的公共 MQTT 服务器转发（只有拿到房间号的人能找到房间）。如果连不上，房主可以换一条线路重新建房。
        </p>
        <div class="modal-actions">
          <button
            onClick={() => {
              clearLinkCode();
              set({ screen: 'menu' });
            }}
          >
            返回
          </button>
        </div>
      </div>
    </div>
  );
}

// ———————————————————————————————————————————— 大厅

export function LobbyScreen() {
  const s = useStore();
  const c = current();
  const L = lobby();
  const net = s.net;
  // 每秒刷新一次（在线状态）
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 2000);
    return () => clearInterval(t);
  }, []);

  if (!net || !c || !L) {
    const missing = c?.missing;
    return (
      <div class="menu-screen">
        <div class="menu-box setup online-box">
          <h2>🌐 {net?.role === 'host' ? '创建房间' : `加入房间 ${net?.room ?? ''}`}</h2>
          {missing ? (
            <p>
              找不到这个房间。请检查房间号，或者确认房主的页面还开着。
              <br />
              <small class="hint">如果房主换了线路，请使用房主新发的链接。</small>
            </p>
          ) : (
            <p class="connecting">
              <span class="spinner" /> {net?.link === 'online' ? '正在寻找房间…' : '正在连接联机服务器…'}
            </p>
          )}
          <div class="modal-actions">
            <button onClick={() => leaveRoom()}>返回</button>
          </div>
        </div>
      </div>
    );
  }

  const isHost = net.role === 'host';
  const cid = myCid();
  const mySeat = L.seats.findIndex((x) => x.cid === cid);
  const open = L.seats.filter((x) => x.kind === 'open').length;
  const link = inviteLink(L.room);
  const watchers = L.online.filter((o) => !L.seats.some((x) => x.cid === o)).length;

  return (
    <div class="menu-screen">
      <div class="menu-box setup online-box">
        <div class="lobby-head">
          <h2>🌐 房间</h2>
          <LinkDot />
        </div>
        <div class="room-code">
          <div>
            <small>房间号</small>
            <b>{L.room}</b>
          </div>
          <div class="room-share">
            <button onClick={() => copy(link)}>复制邀请链接</button>
            {typeof navigator.share === 'function' && (
              <button
                onClick={() =>
                  navigator.share({ title: '方舟动物园 · 联机', text: `来玩方舟动物园！房间号 ${L.room}`, url: link }).catch(() => undefined)
                }
              >
                分享
              </button>
            )}
          </div>
        </div>
        <p class="hint">把链接发给朋友，打开就能入座；也可以在「联机对战」里输入房间号。</p>

        {isHost && (
          <div class="setup-row">
            人数：
            {[2, 3, 4, 5].slice(0, MAX_SEATS - 1).map((n) => (
              <button class={L.seats.length === n ? 'on' : ''} onClick={() => current()?.host?.setCount(n)}>
                {n === 5 ? '5（扩展）' : n}
              </button>
            ))}
          </div>
        )}

        <div class="seats lobby-seats">
          {L.seats.map((seat, i) => (
            <SeatRow seat={seat} i={i} isHost={isHost} mine={seat.cid === cid} canClaim={!isHost && seat.kind === 'open'} online={!!seat.cid && L.online.includes(seat.cid)} />
          ))}
        </div>
        {watchers > 0 && <p class="hint">另有 {watchers} 人在观战。</p>}

        {isHost ? (
          <>
            <label class="check">
              <input type="checkbox" checked={L.shuffle} onChange={(e) => current()?.host?.setShuffle((e.target as HTMLInputElement).checked)} />
              随机决定座次（后手玩家开局有少量吸引力补偿）
            </label>
            {open > 0 && <p class="hint">还有 {open} 个空位：等朋友加入，或者把空位改成 AI。</p>}
            <div class="modal-actions">
              <button
                onClick={() =>
                  set({
                    modal: {
                      k: 'confirm',
                      text: '解散房间？',
                      yes: '解散',
                      onYes: () => leaveRoom(true),
                    },
                  })
                }
              >
                解散房间
              </button>
              <button class="primary big" disabled={open > 0} onClick={hostStart}>
                开始游戏
              </button>
            </div>
          </>
        ) : (
          <>
            <p class="waiting-host">
              {L.started ? (
                <>
                  <span class="spinner" /> 游戏已经开始，正在同步对局…
                </>
              ) : mySeat >= 0 ? (
                <>
                  <span class="spinner" /> 已入座，等待房主 <b>{L.hostName}</b> 开始游戏
                </>
              ) : (
                '选一个空位坐下（不坐也可以观战）'
              )}
            </p>
            <div class="modal-actions">
              <button onClick={() => leaveRoom()}>离开房间</button>
            </div>
          </>
        )}
      </div>
      {s.modal?.k === 'confirm' && <ConfirmModal />}
    </div>
  );
}

function ConfirmModal() {
  const m = state.modal;
  if (m?.k !== 'confirm') return null;
  return (
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
  );
}

function SeatRow({ seat, i, isHost, mine, canClaim, online }: { seat: Seat; i: number; isHost: boolean; mine: boolean; canClaim: boolean; online: boolean }) {
  const c = current();
  const kindValue = seat.kind === 'ai' ? (seat.ai ?? 'normal') : seat.kind;
  const canMap = isHost || mine;
  return (
    <div class={`seat lobby-seat ${mine ? 'mine' : ''}`}>
      <span class="seat-no">{i + 1}</span>
      <span class="seat-who">
        {seat.kind === 'open' ? (
          <i class="hint">空位</i>
        ) : (
          <>
            {seat.kind === 'ai' ? '🤖' : <span class={`dot ${online || seat.kind === 'host' ? 'on' : ''}`} />}
            {isHost && seat.kind === 'host' ? (
              <input value={seat.name} maxLength={10} onChange={(e) => c?.host?.setName(i, (e.target as HTMLInputElement).value)} />
            ) : (
              <b>{seat.name}</b>
            )}
            {seat.kind === 'host' && <small>房主</small>}
            {mine && seat.kind !== 'host' && <small>（你）</small>}
          </>
        )}
      </span>
      <span class="seat-kind">
        {isHost && seat.kind !== 'host' ? (
          seat.kind === 'guest' ? (
            <button class="mini" onClick={() => c?.host?.setSeat(i, 'open')}>
              请离座位
            </button>
          ) : (
            <select
              value={kindValue}
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                if (v === 'open') c?.host?.setSeat(i, 'open');
                else c?.host?.setSeat(i, 'ai', v as AiLevel);
              }}
            >
              <option value="open">等待玩家</option>
              <option value="easy">{AI_LABEL.easy}</option>
              <option value="normal">{AI_LABEL.normal}</option>
              <option value="hard">{AI_LABEL.hard}</option>
            </select>
          )
        ) : canClaim ? (
          <button class="primary mini" onClick={() => c?.guest?.claim(i)}>
            坐这里
          </button>
        ) : mine && !isHost ? (
          <button class="mini" onClick={() => c?.guest?.leaveSeat()}>
            离开座位
          </button>
        ) : (
          <small class="hint">{seat.kind === 'ai' ? AI_LABEL[seat.ai ?? 'normal'] : seat.kind === 'host' ? '' : '玩家'}</small>
        )}
      </span>
      <select
        value={seat.map}
        disabled={!canMap}
        title={MAPS[seat.map]?.desc}
        onChange={(e) => {
          const v = (e.target as HTMLSelectElement).value;
          if (isHost) c?.host?.setMap(i, v);
          else c?.guest?.setMap(i, v);
        }}
      >
        {MAP_IDS.map((id) => (
          <option value={id}>{MAPS[id].name}</option>
        ))}
      </select>
    </div>
  );
}

/** 连接状态小圆点 */
export function LinkDot() {
  const net = state.net;
  if (!net) return null;
  const c = current();
  const hostAway = net.role === 'guest' && c?.guest && c.guest.lobby && !c.guest.hostOnline();
  const label = net.link !== 'online' ? (net.link === 'connecting' ? '连接中' : '已断开') : hostAway ? '房主离线' : '在线';
  return (
    <span class={`link-dot ${net.link} ${hostAway ? 'away' : ''}`} title={c ? `线路：${c.server.name}` : ''}>
      <i /> {label}
    </span>
  );
}

// ———————————————————————————————————————————— 对局中

/** 顶栏上的房间按钮 */
export function OnlineBadge() {
  const s = state;
  if (!s.net) return null;
  return (
    <button class="online-badge" onClick={() => set({ modal: { k: 'room' } })} title="房间信息">
      🌐 {s.net.room} <LinkDot />
    </button>
  );
}

/** 不能行动时的提示条 */
export function NetBanner({ g }: { g: GameState }) {
  const s = state;
  const c = current();
  if (!s.net || !c) return null;
  const seat = s.net.seat;
  let text: string | null = null;
  if (s.net.link !== 'online') text = s.net.link === 'connecting' ? '正在连接联机服务器…' : '网络断开了，正在重新连接…';
  else if (c.guest?.syncing) text = '正在同步对局…';
  else if (c.guest && !c.guest.hostOnline()) text = `房主 ${c.guest.lobby?.hostName ?? ''} 暂时不在线，等房主回来就能继续`;
  if (text) return <div class="net-banner warn">{text}</div>;
  if (seat >= 0 && g.players[seat]?.ai && !g.over)
    return (
      <div class="net-banner">
        你的座位正由 AI 托管
        {c.guest && (
          <button class="mini primary" onClick={resumeMySeat}>
            我回来了
          </button>
        )}
        {c.host && (
          <button class="mini primary" onClick={() => takeover(seat, null)}>
            取消托管
          </button>
        )}
      </div>
    );
  if (seat < 0 && !g.over) return <div class="net-banner">你在观战</div>;
  return null;
}

/** 房间面板：邀请链接、在线状态、房主的托管开关 */
export function RoomModal({ g }: { g: GameState }) {
  const c = current();
  const L = lobby();
  if (!c || !L || !state.net) return null;
  const isHost = !!c.host;
  const link = inviteLink(L.room);
  return (
    <Modal title={`🌐 房间 ${L.room}`} onClose={() => set({ modal: null })}>
      <div class="room-modal">
        <div class="room-share">
          <button onClick={() => copy(link)}>复制邀请链接</button>
          <small class="hint">中途加入的人会观战；掉线的玩家用原来的设备重新打开链接即可回到座位。</small>
        </div>
        <table class="room-players">
          <tbody>
            {g.players.map((p, i) => {
              const owner = L.owners[i];
              const online = owner ? L.online.includes(owner) : false;
              return (
                <tr>
                  <td>
                    <b style={{ color: p.color }}>{p.name}</b>
                  </td>
                  <td>
                    {owner === null ? (
                      <small>{AI_LABEL[p.ai ?? 'normal']}</small>
                    ) : (
                      <span class={`dot ${online ? 'on' : ''}`} title={online ? '在线' : '离线'} />
                    )}
                    {owner === L.host && <small> 房主</small>}
                    {owner !== null && p.ai && <small> AI 托管中</small>}
                  </td>
                  <td>
                    {isHost && owner !== null && owner !== L.host && (
                      <button class="mini" onClick={() => takeover(i, p.ai ? null : 'normal')}>
                        {p.ai ? '取消托管' : 'AI 托管'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {isHost && <p class="hint">有人掉线时，可以先让 AI 替他行动；他回来后点「我回来了」或由你取消托管。你是房主：关掉页面会让所有人暂停，之后从「联机对战」继续主持即可。</p>}
      </div>
      <div class="modal-actions">
        <button onClick={() => set({ modal: null })}>关闭</button>
      </div>
    </Modal>
  );
}

/** 链接进来时直接加入（已经有名字时） */
export function autoJoinFromLink(): boolean {
  const code = linkCode();
  if (!code) return false;
  const name = savedName();
  if (!name) {
    set({ screen: 'online' });
    return true;
  }
  clearLinkCode();
  joinRoom(code, name);
  return true;
}
