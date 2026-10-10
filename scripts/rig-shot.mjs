/* global window */
// A figure on a rig of its own playing the game's clips from its pack (a
// walker's walk, its turn, its death), four moments a clip, for judging that
// the clips sit on the body (lane V of the 2017 pipeline: docs/superpowers/
// plans/2026-10-10-bf2017-phaseV-vehicles.md), through the dev server (npx
// vite --port 5188 --strictPort --host 127.0.0.1) and
// scripts/preview/rig-shot.html. It prints each clip's lowest foot at the
// four moments, so a foot under the ground or a body in the air shows.
//
//   node scripts/rig-shot.mjs <file.glb> <rig> <out.png> [clip,clip…] [--view side|three]

import { chromium } from 'playwright-core';
import { join, relative } from 'node:path';
import { parseArgs } from './lib/args.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5188';
const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const args = parseArgs(process.argv.slice(2));
const [file, rig, out, clips = ''] = args._;
const rel = relative(process.cwd(), join(process.cwd(), file)).split('\\').join('/');
const url = `/${rel.startsWith('public/') ? rel.slice('public/'.length) : rel}`;
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({
    viewport: { width: 960, height: 4800 },
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${BASE}/scripts/preview/rig-shot.html?url=${encodeURIComponent(url)}&rig=${rig}${clips ? `&clips=${clips}` : ''}${args.view ? `&view=${args.view}` : ''}`);
  await page
    .waitForFunction(() => window.__done, null, { timeout: 300000 })
    .catch((e) => {
      throw new Error(errors[0] ?? e.message);
    });
  const canvas = await page.$('canvas');
  await canvas.screenshot({ path: out });
  for (const line of JSON.parse(await page.title())) console.log(line);
  if (errors.length) console.log('errors:', errors.join('\n'));
} finally {
  await browser.close();
}
