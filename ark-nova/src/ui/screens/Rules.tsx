// 规则说明（菜单中的完整说明，以及对局中的速查弹窗）。
import { ACTION_INFO, ACTION_TEXT, REP_BONUSES, REP_CAP_BASIC, SOLO_BREAKS, TILES, UNIVERSITIES, appealIncome } from '../../game/rules';
import { ACTIONS } from '../../game/types';
import { BONUS_INFO, MAPS, MAP_IDS } from '../../game/maps';
import { BUILDINGS, BUILDABLE } from '../../game/buildings';
import { set } from '../store';
import { CAT_EMOJI, CONT_COLOR, CONT_SHORT } from '../meta';
import { categoryName, continentName } from '../../game/query';
import { CATEGORIES, CONTINENTS } from '../../game/types';

export function RulesContent() {
  return (
    <div class="rules">
      <section>
        <h3>目标：让两个标记相遇</h3>
        <p>
          每位玩家在计分轨上有两个相向而行的标记：<b class="g-appeal">吸引力</b>从 0 往前走（主要来自动物），<b class="g-cp">保护点数</b>从另一端往回走（主要来自保护项目）。保护点数前 10 点每点算 2 分，之后每点 3 分。
        </p>
        <p>
          当某位玩家的 <b>吸引力 + 保护点数换算分 ≥ 100</b>（两个标记相遇）时，触发游戏结束：其他玩家各再进行 1 个回合，然后结算终局计分卡和赞助卡的终局奖励。<b>得分 = 吸引力 + 保护点数换算分 − 100</b>，最高者获胜。只靠一种标记很难赢。
        </p>
      </section>
      <section>
        <h3>回合：5 张行动卡轮转</h3>
        <p>
          每位玩家有 5 张行动卡，放在 1–5 号位，<b>所在的位置就是它的强度</b>。轮到你时，选一张行动卡按强度执行，然后把它移到 1 号位，原来在它左边的卡依次右移。开局时「动物」在 1 号位，其余随机。
        </p>
        <p>
          也可以不执行行动：把任意一张卡移到 1 号位，获得 1 个 <b>X 标记</b>（最多 5 个）。执行行动时，每花 1 个 X 标记强度 +1（可以超过 5）。
        </p>
        <p>每张行动卡都可以升级到 II 面，效果更强。整局只有 4 次升级机会：保护点数达到 2（也可以改为拿一名协会工人）、声望达到 5、结交第 2 个合作动物园、与第 2 所大学合作。所以总有一张行动卡升不了级——想清楚留下哪一张。</p>
        <p>动物行动 I 在强度足够打出 2 只动物时，如果只打出 1 只，可以忽略这只动物的 1 个条件（水域、岩石、声望、图标或升级要求）。</p>
        <table class="action-table">
          <tbody>
            {ACTIONS.map((a) => (
              <tr>
                <td style={{ color: ACTION_INFO[a].color }}>
                  <b>
                    {ACTION_INFO[a].emoji} {ACTION_INFO[a].name}
                  </b>
                </td>
                <td>
                  <b>I：</b>
                  {ACTION_TEXT[a][0]}
                  <br />
                  <b>II：</b>
                  {ACTION_TEXT[a][1]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h3>动物园地图与建筑</h3>
        <p>
          建筑必须与地图边缘或已有建筑相邻，不能建在水域和岩石上；标有 II 的格子需要升级的建造行动。覆盖带图标的格子时立即获得奖励（
          {Object.values(BONUS_INFO)
            .map((b) => `${b.icon}${b.label}`)
            .join('、')}
          ）。建筑可以旋转和翻转。
        </p>
        <ul>
          {BUILDABLE.map((t) => (
            <li>
              <b>{BUILDINGS[t].name}</b>（{BUILDINGS[t].shape.length} 格）：{BUILDINGS[t].text}
            </li>
          ))}
        </ul>
        <p>地图（每位玩家可以选不同的地图）：</p>
        <ul>
          {MAP_IDS.map((id) => (
            <li>
              <b>{MAPS[id].name}</b>：{MAPS[id].desc}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>动物</h3>
        <p>
          打出动物需要一座足够大的空标准围栏（一座围栏住一只动物），有些动物也可以住进爬行馆、大型鸟舍（按容量），宠物只能住进儿童动物园。卡上的 💧 / 🪨 表示所在建筑需要与多少格水域 / 岩石相邻；⭐ 表示需要的声望，II 表示需要升级的动物行动，🔬 表示需要研究图标。
        </p>
        <p>打出后获得卡上的吸引力、保护点数和声望，结算能力，并提供卡上的图标。拥有对应大洲的合作动物园时，打出该洲动物便宜 3 元。</p>
        <p>
          图标：
          {CONTINENTS.map((c) => (
            <span class="legend-icon" style={{ background: CONT_COLOR[c] }}>
              {CONT_SHORT[c]} {continentName(c)}
            </span>
          ))}
          {CATEGORIES.map((c) => (
            <span class="legend-icon cat">
              {CAT_EMOJI[c]} {categoryName(c)}
            </span>
          ))}
          <span class="legend-icon cat">🔬 研究</span>
        </p>
      </section>
      <section>
        <h3>协会与保护项目</h3>
        <p>
          协会行动派出协会工人完成任务：价值 2 声望 +2；价值 3 结交一个合作动物园（每洲一个，最多 4 个，第 3、4 个需要升级的协会行动）；价值 4 与一所大学合作（
          {UNIVERSITIES.map((u) => `${u.name}：${u.text}`).join('；')}）；价值 5 支持一个保护项目。已经有工人（任何玩家的）的任务需要 2 名工人。工人在休息时回到玩家手中。
        </p>
        <p>
          保护项目有三档，达到要求（图标数量等）就能支持其中一档，获得对应的保护点数；每档只能由一位玩家占据，每位玩家每个项目只能支持一次。手牌中的项目卡也可以在价值 5 的任务中打出并立即支持；升级的协会行动还可以直接从展示区（声望范围内，额外支付位置编号的钱）打出项目。「放归」类项目需要把一只足够大的动物放归野外：它离开你的动物园，你失去它的吸引力，围栏重新空出。
        </p>
      </section>
      <section>
        <h3>声望与奖励</h3>
        <p>声望（最高 15）决定你能从展示区拿取的范围，并在以下位置给予奖励：</p>
        <ul>
          {REP_BONUSES.map((b) => (
            <li>
              声望 {b.at}：{b.text}
            </li>
          ))}
        </ul>
        <p>
          卡牌行动升级之前，声望最高只能到 {REP_CAP_BASIC}；升级后最高 15，再往上每点声望改为 1 点吸引力。
        </p>
        <p>
          保护点数轨的奖励：<b>2</b> 升级一张行动卡或获得一名协会工人；<b>5</b> 和 <b>8</b> 拿 5 元，或拿走旁边的一块奖励板块（每块只有一位玩家能拿，每局从
          {TILES.map((t) => t.name).join('、')} 中随机摆出 4 块）；<b>10</b> 第一位到达的玩家触发：所有玩家从开局的 2 张终局计分卡中保留 1 张。
        </p>
        <p>协会工人：开局 1 名，最多 4 名。来源：保护点数 2 的奖励、声望 8、第 3 个合作动物园，以及部分赞助卡。</p>
      </section>
      <section>
        <h3>休息</h3>
        <p>
          卡牌行动让休息标记前进 2 格，赞助行动改为拿钱时前进等于强度的格数。标记到达终点时，在当前回合结束后休息：每位玩家把手牌弃到上限（3 张，部分大学和赞助卡可以提高），协会工人回到玩家手中，展示区弃掉最前面 2 张并补满，然后所有人获得收入：吸引力收入（吸引力 0 时 {appealIncome(0)} 元，10 时 {appealIncome(10)} 元，30 时 {appealIncome(30)} 元，60 时 {appealIncome(60)} 元）、售货亭收入（每座相邻建筑 1 元）和赞助卡收入。触发休息的玩家获得 1 个 X 标记。
        </p>
      </section>
      <section>
        <h3>开局</h3>
        <p>每人 25 元、声望 1，从 8 张牌中保留 4 张，拿 2 张终局计分卡（保密，有人达到保护点数 10 时每人弃掉 1 张）。座次越靠后，开局吸引力越高（0 / 1 / 2 / 3 / 4）。</p>
        <p>平局时，支持保护项目多的玩家获胜，再相同则比较剩余的钱。</p>
        <p>单人挑战：每个回合结束时休息标记自动前进 1 格；在第 {SOLO_BREAKS} 次休息结束前让两个标记相遇（得分 ≥ 0）即获胜，大约有 35 个回合。</p>
        <p>5 人为扩展玩法（原作 1–4 人）：休息轨延长到 19 格，其余规则不变。</p>
      </section>
      <section>
        <h3>联机对战</h3>
        <ul>
          <li>一人在「联机对战」里创建房间，把邀请链接或 6 位房间号发给朋友；朋友打开链接、选一个空位坐下。空位也可以交给 AI。</li>
          <li>房主的浏览器保存进度、运行 AI，对局中请保持房主页面打开。房主刷新或关掉页面后，从「联机对战」里继续主持即可，其他人会自动跟上。</li>
          <li>掉线的玩家用原来的设备重新打开邀请链接就能回到座位；房主可以先让 AI 托管他的座位。</li>
          <li>开局选牌、休息弃牌这类需要每个人都做的选择，没轮到时可以提前选好，轮到时自动提交。</li>
        </ul>
      </section>
      <section>
        <h3>操作提示</h3>
        <ul>
          <li>点击底部的行动卡，确认强度（可以加 X 标记）后执行。</li>
          <li>建造时先在底部选建筑，再在地图上点击放置；按 R 或「旋转」改变朝向。手机上第一次点击预览位置，再点一次确认。</li>
          <li>打出动物时先点手牌中亮边的动物，再点地图上高亮的围栏。</li>
          <li>没有抽到新牌之前，可以用「撤销」回到上一步。</li>
          <li>右键（或点卡牌上的 i）查看卡牌详情；点击顶部的玩家可以查看他们的动物园。</li>
        </ul>
      </section>
    </div>
  );
}

export function RulesScreen() {
  return (
    <div class="page-screen">
      <div class="page-head">
        <button onClick={() => set({ screen: 'menu' })}>← 返回</button>
        <h2>规则说明</h2>
      </div>
      <div class="page-body">
        <RulesContent />
      </div>
    </div>
  );
}
