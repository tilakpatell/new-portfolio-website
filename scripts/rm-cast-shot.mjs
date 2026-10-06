/* global window */
// Rick and Morty's Meshy figures beside Rick, through the dev server
// (npx vite --port 5197) and scripts/preview/rm-cast.html in headless
// Chromium or Edge, for judging their rigs: each clip from each side, one
// PNG apiece.
//
//   node scripts/rm-cast-shot.mjs <out-prefix> name:height,… [idle,walk,run] [front,side] [--fit]
//
// BASE sets the dev server (default http://127.0.0.1:5197) and CHROME the
// browser (else the sandbox's Chromium, else a local Edge or Chrome).

import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5197';
const args = process.argv.slice(2);
const fit = args.includes('--fit');
const [prefix, only, clips = 'idle,walk,run', views = 'front,side'] = args.filter((a) => a !== '--fit');
if (!prefix || !only) throw new Error('node scripts/rm-cast-shot.mjs <out-prefix> name:height,… [clips] [views] [--fit]');

const exe = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 700 } });
page.on('pageerror', (e) => console.error('page error:', e.message));
// (a clip's pose is clearest a little way in: a stride, a seated settle)
const T = { idle: 0.3, walk: 0.25, run: 0.25, sit: 0.5 };
for (const clip of clips.split(',')) {
  for (const view of views.split(',')) {
    await page.goto(`${BASE}/scripts/preview/rm-cast.html?only=${only}&clip=${clip}&t=${T[clip] ?? 0.3}&view=${view}${fit ? '&fit=1' : ''}`);
    const r = await page.waitForFunction(() => window.__ready, null, { timeout: 180000 }).then((h) => h.jsonValue());
    const file = `${prefix}-${clip}-${view}.png`;
    await page.screenshot({ path: file });
    console.log(`${file}${r.missing.length ? ` (didn't load: ${r.missing.join(', ')})` : ''}`);
  }
}
await browser.close();
