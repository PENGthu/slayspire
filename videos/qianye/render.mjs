// Usage:
//   node render.mjs preview <outdir> t1 t2 ...   -> PNG stills at the given seconds
//   node render.mjs timeline <out.json>          -> export timeline (scenes, sfx, typing)
//   node render.mjs full <outdir> [workers]      -> segment MP4s rendered in parallel
const { chromium } = await import('/opt/node-tools/node_modules/playwright/index.mjs').catch(() => import('playwright'));
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/index.html`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--disable-gpu-vsync', '--font-render-hinting=none'] }).catch(() => chromium.launch());
async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await page.goto(URL_);
  await page.evaluate(() => window.READY);
  return page;
}
async function frameJpeg(page, t, q = 0.93) {
  const b64 = await page.evaluate(([t, q]) => { renderFrame(t); return document.getElementById('c').toDataURL('image/jpeg', q).split(',')[1]; }, [t, q]);
  return Buffer.from(b64, 'base64');
}

const [mode, out, ...rest] = process.argv.slice(2);
if (mode === 'preview') {
  fs.mkdirSync(out, { recursive: true });
  const page = await openPage();
  for (const s of rest) {
    const t = parseFloat(s);
    const b64 = await page.evaluate(t => { renderFrame(t); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }, t);
    fs.writeFileSync(path.join(out, `f_${t.toFixed(2)}.png`), Buffer.from(b64, 'base64'));
  }
} else if (mode === 'timeline') {
  const page = await openPage();
  const tl = await page.evaluate(() => exportTimeline());
  fs.writeFileSync(out, JSON.stringify(tl, null, 1));
  console.log('total', tl.total, 'scenes', tl.scenes.length);
} else if (mode === 'full') {
  fs.mkdirSync(out, { recursive: true });
  const workers = parseInt(rest[0] || '3', 10);
  const probe = await openPage();
  const tl = await probe.evaluate(() => exportTimeline());
  await probe.close();
  const N = Math.round(tl.total * tl.fps);
  const per = Math.ceil(N / workers);
  const t0 = Date.now();
  let done = 0;
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const a = w * per, b = Math.min(N, a + per);
    const page = await openPage();
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(tl.fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-threads', '1', path.join(out, `seg_${w}.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = a; f < b; f++) {
      const buf = await frameJpeg(page, f / tl.fps);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (++done % 300 === 0) console.log(`${done}/${N} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    await page.close();
  }));
  fs.writeFileSync(path.join(out, 'list.txt'), Array.from({ length: workers }, (_, w) => `file 'seg_${w}.mp4'`).join('\n') + '\n');
  console.log('done', N, 'frames in', ((Date.now() - t0) / 1000).toFixed(0), 's');
}
await browser.close();
server.close();
