// 把 vite 构建产物内联为单个 HTML 文件：
//   dist/spire-reforged.html  —— 可直接双击打开的完整页面
//   dist/artifact.html        —— 去掉 <html>/<head>/<body> 外壳的版本（用于发布为 Artifact）
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
let html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = readdirSync(join(dist, 'assets'));

html = html.replace(/<script type="module" crossorigin src="\.\/assets\/([^"]+)"><\/script>/, (_, f) => {
  const js = readFileSync(join(dist, 'assets', f), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">${js}</script>`;
});
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/assets\/([^"]+)">/, (_, f) => {
  const css = readFileSync(join(dist, 'assets', f), 'utf8');
  return `<style>${css}</style>`;
});
if (/assets\//.test(html)) throw new Error('仍有未内联的资源引用');
writeFileSync(join(dist, 'spire-reforged.html'), html);

// Artifact 版本：保留 <title>、字体链接、样式与脚本
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
// 只过滤脚本、样式之前的那些标签行：内联后的代码里也可能出现这些字样（例如提示文字“添加到主屏幕”），
// 按行过滤会把整行代码删掉、让脚本报错
const codeAt = head.search(/<script|<style/);
const tags = codeAt < 0 ? head : head.slice(0, codeAt);
const code = codeAt < 0 ? '' : head.slice(codeAt);
const keepHead =
  tags
    .split('\n')
    .filter((l) => !/<meta charset|<meta name="viewport"|mobile-web-app|theme-color|apple-touch-icon|rel="manifest"|添加到主屏幕/.test(l))
    .join('\n') + code;
// 防止再出现同样的问题：Artifact 版本的脚本必须与完整版一字不差
const scriptOf = (s) => s.slice(s.indexOf('<script type="module">'), s.indexOf('</script>', s.indexOf('<script type="module">')));
if (scriptOf(keepHead) !== scriptOf(html)) throw new Error('Artifact 版本的脚本与完整版不一致');
writeFileSync(join(dist, 'artifact.html'), `${keepHead.trim()}\n${body.trim()}\n`);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0);
console.log(`spire-reforged.html: ${kb(html)} KB（资源 ${assets.length} 个已内联）`);
