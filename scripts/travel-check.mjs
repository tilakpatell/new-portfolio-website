/* global window, document */
// A browser check of the flown trip down to a world and back up (galaxy/travel.js):
// with the dev server up (npx vite --port 5188 --strictPort --host 127.0.0.1),
//   OUT=/tmp/shots node scripts/travel-check.mjs [system]
// It puts the ship off the planet, lands (the dive, the handover), waits for
// the surface's page, takes off (the handover back) and waits for space. It
// prints, at each step, the route, the runtime's world and how many canvases
// there are (one, the runtime's, all along: the handover's cover aside), with screenshots, and fails on
// any page error. Headless Chromium draws in software: the waits are long.
import { chromium } from 'playwright-core';

const id = process.argv[2] ?? 'tatooine';
const out = process.env.OUT ?? '.';
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-quality', 'low');
  window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
  window.localStorage.setItem('tp-universe-ship', JSON.stringify('xwing'));
  window.sessionStorage.setItem('tp-galaxy-intro', '1');
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const where = (label) =>
  page.evaluate((label) => {
    const rt = window.__RUNTIME__;
    return { label, route: window.location.hash, world: rt?.current?.module?.id ?? null, status: rt?.status, canvases: document.querySelectorAll('canvas:not(.world-snapshot)').length };
  }, label);
const shot = (name) => page.screenshot({ path: `${out}/travel-${name}.png`, timeout: 120000 }).catch(() => {});
const log = [];
const step = async (label) => {
  const w = await where(label);
  log.push(w);
  console.log(JSON.stringify(w));
  await shot(label);
};

await page.goto(`${base}/#/galaxy/${id}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__galaxyDebug?.state?.ship && window.__RUNTIME__?.status === 'on', null, { timeout: 240000 });
await step('space');

// just off the planet, still: the page's land button comes up
await page.evaluate(() => {
  const { state } = window.__galaxyDebug;
  const r = state.sys.body.r;
  Object.assign(state.ship, { x: r * 1.6, y: r * 0.2, z: 0, speed: 0 });
});
await page.waitForSelector('.galaxy-land', { timeout: 120000 });
await page.click('.galaxy-land');
await page.waitForTimeout(1500);
await step('diving');
await page.waitForTimeout(2500);
await step('diving-deep');
await page.waitForFunction(() => window.location.hash.includes('/surface'), null, { timeout: 300000 });
await step('handed-down');
await page.waitForFunction(() => document.querySelector('.surface-page')?.dataset.phase && document.querySelector('.surface-page').dataset.phase !== 'landing', null, { timeout: 300000 }).catch(() => {});
await step('surface');

// up again
await page.evaluate(() => document.querySelector('.surface-world')?.click());
await page.waitForFunction(() => /#\/galaxy\/[a-z]+$/.test(window.location.hash), null, { timeout: 300000 });
await step('handed-up');
await page.waitForTimeout(2000);
await step('space-again');

await browser.close();
const bad = log.filter((w) => w.canvases > 1);
if (errors.length) console.log('errors:\n' + errors.join('\n'));
if (bad.length) console.log('more than one canvas at', bad.map((w) => w.label).join(', '));
const worlds = log.map((w) => w.world).join(' → ');
console.log('worlds:', worlds);
process.exit(errors.length || bad.length ? 1 : 0);
