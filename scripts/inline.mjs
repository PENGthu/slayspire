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
const keepHead = head
  .split('\n')
  .filter((l) => !/<meta charset|<meta name="viewport"|mobile-web-app|theme-color|apple-touch-icon|rel="manifest"|添加到主屏幕/.test(l))
  .join('\n');
writeFileSync(join(dist, 'artifact.html'), `${keepHead.trim()}\n${body.trim()}\n`);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0);
console.log(`spire-reforged.html: ${kb(html)} KB（资源 ${assets.length} 个已内联）`);
