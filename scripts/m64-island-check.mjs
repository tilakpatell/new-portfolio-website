/* global window, document */
// A browser check of the giant N64 on Dot Matrix island: with the dev server
// up (npx vite --port 5188 --strictPort --host 127.0.0.1),
//   OUT=/tmp/shots node scripts/m64-island-check.mjs
// it stands the hero in front of the N64, checks the prompt, presses B, waits
// for the Mario 64 tribute's title over the page (over the nav too), presses
// Esc, and checks the island is back and moving. It fails on any page error.
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
const out = process.env.OUT ?? '.';
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 900, height: 560 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${base}/#/dot-matrix`);
await page.waitForFunction(() => window.__DMG__, null, { timeout: 600000 });
console.log('island up');
await page.evaluate(() => Object.assign(window.__DMG__.sim.g.hero, { x: 30.2, z: 14.4, y: 0, face: Math.PI }));
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}/island-n64.png`, timeout: 180000 });
console.log('prompt', await page.locator('.dm-prompt, [class*=prompt]').allTextContents());
await page.keyboard.press('KeyX');
await page.waitForFunction(() => window.__RUNTIME__?.current?.module?.id === 'mario64' && window.__RUNTIME__.current.world?.game?.mode === 'title', null, { timeout: 600000, polling: 500 });
console.log('mario64 title open', await page.locator('.m64[data-mode=overlay]').count());
await page.waitForTimeout(2000);
await page.screenshot({ path: `${out}/island-m64.png`, timeout: 180000 });
const png = await page.evaluate(() => { const w = window.__RUNTIME__.current.world; w.draw(); return window.__RUNTIME__.gfx.canvas.toDataURL('image/png'); });
writeFileSync(`${out}/island-m64-3d.png`, Buffer.from(png.split(',')[1], 'base64'));
console.log('on top of the nav', await page.evaluate(() => document.elementFromPoint(450, 40)?.closest('.m64') != null));
await page.keyboard.press('Escape');
await page.waitForFunction(() => !document.querySelector('.m64'), null, { timeout: 60000 });
const x0 = await page.evaluate(() => window.__DMG__.sim.g.hero.x);
await page.keyboard.down('KeyD');
await page.waitForTimeout(2500);
await page.keyboard.up('KeyD');
const x1 = await page.evaluate(() => window.__DMG__.sim.g.hero.x);
console.log('island live again, hero moved', x0.toFixed(2), '->', x1.toFixed(2), 'overflow', await page.evaluate(() => document.documentElement.style.overflow));
await page.screenshot({ path: `${out}/island-back.png`, timeout: 180000 });
console.log(errors.length ? errors : 'no page errors');
await browser.close();
if (errors.length) process.exit(1);
