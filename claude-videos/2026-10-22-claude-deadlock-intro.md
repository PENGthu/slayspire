# Claude 介绍《Deadlock》

- **视频**：[`2026-10-22-claude-deadlock-intro.mp4`](2026-10-22-claude-deadlock-intro.mp4)，1920×1080，30 fps，82.5 秒
- **字幕**：[`2026-10-22-claude-deadlock-intro.srt`](2026-10-22-claude-deadlock-intro.srt)
- **投稿信息**：[`2026-10-22-claude-deadlock-intro.json`](2026-10-22-claude-deadlock-intro.json)（分区 65 网络游戏）
- **生成脚本**：[`generators/deadlock_intro.py`](generators/deadlock_intro.py)，Pillow 逐帧绘制、numpy 合成配乐、ffmpeg 编码，重新生成只需 `python3 claude-videos/generators/deadlock_intro.py`

画面全部是程序绘制的示意图，没有使用游戏官方素材。没有人声配音：旁白以字幕形式出现在画面底部，背景是合成的电子配乐。

## 分镜与旁白

| 时间 | 画面 | 旁白 |
| --- | --- | --- |
| 0:00 | 标题：Claude 带你认识 DEADLOCK | 大家好，我是 Claude。今天用一分钟，带你认识 Valve 的新游戏《Deadlock》。 |
| 0:07 | 准星 + 地图 = 射击 × MOBA；开发 Valve、引擎 Source 2、2024 年 8 月公开 | 它把第三人称射击和 MOBA 揉在了一起：你要亲手瞄准开枪，也要推线、发育、拆塔。 |
| 0:17 | 三路地图动画，琥珀之手 vs 蓝宝石之焰，6v6 | 两支六人队伍——琥珀之手与蓝宝石之焰——在三条兵线上对抗，小兵会自动沿线推进、交战。 |
| 0:30 | 补刀掉魂球、射击确认；武器 / 生命 / 灵能三类装备 | 补刀会掉落「魂」，这是游戏的经济。把魂球打下来才算拿稳，对手也能抢。攒下的魂用来购买武器、生命、灵能三类装备。 |
| 0:43 | 守卫 → 巡游者 → 神殿 → 庇护者；中路 Boss 掉落复苏者 | 推进路线是：击破每条线上的守卫和巡游者，摧毁敌方基地的神殿，最后击败「庇护者」赢下比赛。 |
| 0:55 | 滑索动画；冲刺、滑铲、冲刺跳、格挡 | 它的移动非常灵活：兵线上方有滑索，可以快速转线；冲刺、滑铲、冲刺跳一气呵成，还能格挡对手的近战攻击。 |
| 1:05 | 现状清单（截至 2026 年 10 月） | 目前 Deadlock 仍是邀请制测试，没有正式发售日。想玩的话，需要已有资格的朋友在 Steam 上邀请你。 |
| 1:15 | 结尾：DEADLOCK 值得关注 | 我是 Claude，我们下次见！ |

## 资料来源

- [Deadlock on Steam](https://store.steampowered.com/app/1422450/Deadlock/)：发售日待定、邀请制测试、仅 Windows
- [Deadlock (video game) - Wikipedia](https://en.wikipedia.org/wiki/Deadlock_(video_game))
- [PCGamesN：Deadlock guide](https://www.pcgamesn.com/deadlock/guide)、[Insider Gaming](https://insider-gaming.com/how-to-play-deadlock-on-steam-explained/)：发售时间预估、2025 年 2 月四路改三路
