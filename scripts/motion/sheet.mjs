/* global window */
// A made clip's judging sheet: four moments of it on Luke (the start, the
// strike, on from it, the end) above the same four of a library clip, from
// scripts/preview/motion.html through the dev server.
//
//   node scripts/motion/sheet.mjs NAME OUT.png [--with sword.heavy.a]
//   (BASE: the dev server, default http://127.0.0.1:5188; CHROME: the browser)

import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';

export async function sheet(name, out, { with: other = 'sword.heavy.a', base = process.env.BASE ?? 'http://127.0.0.1:5188', chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' } = {}) {
  const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}/scripts/preview/motion.html?clip=${encodeURIComponent(name)}&with=${encodeURIComponent(other)}&sheet=1`);
    await page.waitForFunction(() => window.__done, null, { timeout: 300000 }).catch((e) => {
      throw new Error(errors[0] ?? e.message);
    });
    await (await page.$('canvas')).screenshot({ path: out });
    return JSON.parse(await page.title());
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const [name, out] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--with');
  if (!name || !out) {
    console.error('usage: node scripts/motion/sheet.mjs NAME OUT.png [--with sword.heavy.a]');
    process.exit(1);
  }
  console.log(out, await sheet(name, out, { with: args.includes('--with') ? args[args.indexOf('--with') + 1] : undefined }));
}
