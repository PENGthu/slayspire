# claude-videos · Claude 生成的视频

专门存放由 Claude 生成的视频（宣传片、玩法演示、录屏、动画等）。本目录不参与游戏构建，不会被打包进 `dist/spire-reforged.html`。

## 存放约定

- **命名**：`YYYY-MM-DD-简短描述.扩展名`，例如 `2026-10-22-claude-character-trailer.mp4`；同一天多个版本加 `-v2`、`-v3`
- **格式**：优先 `.mp4`（H.264），短循环动画可用 `.webm` 或 `.gif`
- **大小**：GitHub 单个文件上限 100 MB，超过 50 MB 会有警告，请先压缩再提交
- **说明**：生成视频用到的脚本、分镜或提示词，可以放在同名的 `.md` 文件里，例如 `2026-10-22-claude-character-trailer.md`

## 上传到 B站

用 biliup 的命令行工具 [biliup-rs](https://github.com/biliup/biliup-rs) 投稿，脚本是 [`upload.mjs`](upload.mjs)。

1. **安装 biliup**：从 [biliup-rs Releases](https://github.com/biliup/biliup-rs/releases) 下载对应平台的压缩包，解压出 `biliup` 可执行文件放进 `PATH`（也可以用环境变量 `BILIUP_BIN` 指定路径）。注意 `pip install biliup` 装的是录播服务，不含这个命令行工具
2. **登录**（只需一次）：`biliup -u claude-videos/cookies.json login`，选择扫码登录。`cookies.json` 就是账号登录态，已加入 `.gitignore`，**不要提交、不要外传**；也可以放在别处，用环境变量 `BILIUP_COOKIE` 指定
3. **上传**：

   ```bash
   npm run upload:video -- 2026-10-22-claude-character-trailer.mp4 --dry-run   # 先预览将执行的命令
   npm run upload:video -- 2026-10-22-claude-character-trailer.mp4
   ```

稿件信息按「命令行参数 > 同名 `.json` > 默认值」合并。同名 `.json` 例如 `2026-10-22-claude-character-trailer.json`：

```json
{
  "title": "小克登场！尖塔重铸新角色 Claude 演示",
  "tid": 17,
  "tag": ["杀戮尖塔", "卡牌构筑", "Claude"],
  "desc": "视频简介",
  "cover": "2026-10-22-claude-character-trailer.jpg"
}
```

| 字段 | 说明 | 默认值 |
| --- | --- | --- |
| `title` | 标题，最多 80 字 | 文件名去掉日期前缀 |
| `tid` | 分区 ID | `17`（单机游戏） |
| `tag` | 标签，逗号分隔或数组 | 杀戮尖塔、卡牌构筑、Roguelike、独立游戏、Claude |
| `desc` | 简介 | 游戏介绍 + 在线游玩链接 |
| `cover` | 封面图片路径（相对本目录） | B站自动截取 |
| `copyright` | `1` 自制，`2` 转载（需同时填 `source`） | `1` |
| `dynamic` | 空间动态文字 | 无 |
| `dtime` | 定时发布，10 位时间戳，需晚于提交时间 4 小时以上 | 立即发布 |

> biliup 走的是 B站网页投稿接口，不是官方开放 API，接口变动或频繁上传可能导致失败或触发风控。

## 目录清单

| 文件 | 日期 | 说明 |
| --- | --- | --- |
| _（暂无）_ | | |
