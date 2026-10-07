/* global window */
// A figure's clips at four moments each, a row a clip, for judging how a
// Meshy figure moves (scripts/meshy-invincible.mjs's anims), through the dev
// server (npx vite --port 5188) and scripts/preview/clip-shot.html.
//
//   node scripts/clip-shot.mjs <file.glb> <out.png> [clip,clip…]

import { chromium } from 'playwright-core';
import { join, relative } from 'node:path';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5188';
const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const [file, out, clips = ''] = process.argv.slice(2);
const rel = relative(process.cwd(), join(process.cwd(), file)).split('\\').join('/');
const url = `/${rel.startsWith('public/') ? rel.slice('public/'.length) : rel}`;
const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 2400 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/scripts/preview/clip-shot.html?url=${encodeURIComponent(url)}${clips ? `&clips=${clips}` : ''}`);
  await page.waitForFunction(() => window.__done, null, { timeout: 300000 }).catch((e) => {
    throw new Error(errors[0] ?? e.message);
  });
  const canvas = await page.$('canvas');
  await canvas.screenshot({ path: out });
  console.log(out, await page.title());
} finally {
  await browser.close();
}
