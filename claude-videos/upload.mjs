// 用 biliup 把 claude-videos/ 里的视频投稿到 B站。
//   npm run upload:video -- 2026-10-22-trailer.mp4 [--title 标题] [--tag a,b] [--dry-run]
// 稿件信息按「命令行参数 > 同名 .json > 默认值」合并；登录态 cookies.json 由 `biliup login` 生成，不入库。
import { existsSync, readFileSync } from 'node:fs';
import { basename, extname, isAbsolute, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = new URL('./', import.meta.url).pathname;
const bin = process.env.BILIUP_BIN || 'biliup';
const cookie = resolve(process.env.BILIUP_COOKIE || join(dir, 'cookies.json'));

const defaults = {
  tid: 17, // 单机游戏
  tag: '杀戮尖塔,卡牌构筑,Roguelike,独立游戏,Claude',
  copyright: 1, // 1 自制 2 转载
  desc: '《尖塔重铸 · Spire Reforged》，致敬《杀戮尖塔 2》的网页版卡牌构筑 Roguelike。\n在线游玩：https://pengthu.github.io/games/spire-reforged/',
};
const fields = ['title', 'tid', 'tag', 'desc', 'cover', 'copyright', 'source', 'dynamic', 'dtime'];

function parseArgs(argv) {
  const files = [];
  const opts = {};
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') dryRun = true;
    else if (a === '-h' || a === '--help') usage(0);
    else if (a.startsWith('--')) {
      const key = a.slice(2);
      if (!fields.includes(key) || i + 1 >= argv.length) usage(1, `未知或缺少值的参数：${a}`);
      opts[key] = argv[++i];
    } else files.push(a);
  }
  if (!files.length) usage(1, '请指定要上传的视频文件');
  return { files, opts, dryRun };
}

function usage(code, msg) {
  if (msg) console.error(msg);
  console.log(`用法：npm run upload:video -- <视频…> [--${fields.join(' <值>] [--')} <值>] [--dry-run]
  视频路径可以是 claude-videos/ 下的文件名；同名 .json（如 trailer.json）可写入上述字段。
  环境变量：BILIUP_BIN（biliup 可执行文件，默认 biliup）、BILIUP_COOKIE（登录态，默认 claude-videos/cookies.json）`);
  process.exit(code);
}

function locate(file) {
  for (const p of [file, join(dir, file)]) if (existsSync(p)) return isAbsolute(p) ? p : resolve(p);
  throw new Error(`找不到视频：${file}`);
}

function metaFor(video, opts) {
  const sidecar = video.slice(0, -extname(video).length) + '.json';
  const fromFile = existsSync(sidecar) ? JSON.parse(readFileSync(sidecar, 'utf8')) : {};
  // 默认标题：去掉日期前缀和扩展名的文件名
  const title = basename(video, extname(video)).replace(/^\d{4}-\d{2}-\d{2}-/, '');
  const meta = { ...defaults, title, ...fromFile, ...opts };
  if (Array.isArray(meta.tag)) meta.tag = meta.tag.join(',');
  if (meta.cover && !isAbsolute(meta.cover)) meta.cover = resolve(dir, meta.cover);
  if ([...meta.title].length > 80) throw new Error(`标题超过 80 字：${meta.title}`);
  if (!meta.tag) throw new Error('至少需要一个标签');
  if (String(meta.copyright) === '2' && !meta.source) throw new Error('转载稿件需要填写 source');
  return meta;
}

const { files, opts, dryRun } = parseArgs(process.argv.slice(2));
if (!dryRun && !existsSync(cookie)) {
  console.error(`未找到登录态 ${cookie}\n先运行：${bin} -u ${cookie} login`);
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const video = locate(file);
  const meta = metaFor(video, opts);
  const args = ['-u', cookie, 'upload'];
  for (const k of fields) if (meta[k] !== undefined && meta[k] !== '') args.push(`--${k}`, String(meta[k]));
  args.push(video);
  console.log(`\n▶ ${basename(video)}  《${meta.title}》`);
  if (dryRun) {
    console.log([bin, ...args.map((a) => (/[\s,，]/.test(a) ? JSON.stringify(a) : a))].join(' '));
    continue;
  }
  const r = spawnSync(bin, args, { stdio: 'inherit' });
  if (r.error?.code === 'ENOENT') {
    console.error(`找不到 ${bin}，请先安装 biliup（见 claude-videos/README.md）`);
    process.exit(1);
  }
  if (r.status !== 0) {
    failed++;
    console.error(`✗ 上传失败：${basename(video)}`);
  } else console.log(`✓ 已提交：${basename(video)}`);
}
process.exit(failed ? 1 : 0);
