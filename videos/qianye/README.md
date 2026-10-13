# 前夜 · Claude 诞生之前

一部约 5 分钟（308 秒，1920×1080，30fps）的字幕动画短片，讲述 Claude 诞生之前发生的事：
2017 年的 Transformer、2020 年的规模定律与 GPT-3、2021 年 Anthropic 成立与 HHH 原则、
2022 年的 RLHF、可解释性研究、夏天“暂不发布”的决定、ChatGPT 的爆发、宪法式 AI，
直到 2023 年 3 月 14 日 Claude 发布。

全部画面与配乐都由代码生成：

| 文件 | 作用 |
| --- | --- |
| `main.js` / `index.html` | Canvas 场景与时间轴；`renderFrame(t)` 按时间确定性地绘制任意一帧 |
| `render.mjs` | 用 Playwright 驱动 Chromium 逐帧渲染，多进程并行编码为 H.264 |
| `music.py` | 按时间轴用 numpy/scipy 合成配乐与音效（钢琴、垫音、低音冲击、打字声、时钟声） |
| `build.sh` | 一键下载字体并完成渲染、配乐、混流，输出 `qianye.mp4` |

```bash
./build.sh            # 约 5–7 分钟（4 核）
```

资料来源：Anthropic《Introducing Claude》(2023-03-14)、TechCrunch 等公开报道，
以及 arXiv 1706.03762 · 2001.08361 · 2005.14165 · 2112.00861 · 2204.05862 · 2212.08073。
“名字致敬克劳德·香农”为公开流传的说法；片中的终端、原则清单与对话界面均为示意。
