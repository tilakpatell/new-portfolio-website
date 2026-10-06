/* global window */
// A browser look at the solar flare's ejection (setpieces.js's flare, cme.js).
// With the dev server up (npx vite --port 5173):
//   OUT=/tmp/shots node scripts/flare-check.mjs [xwing|falcon|cruiser|rv] [tag]
// It parks the ship off the home sun, faces it, asks the director for a flare
// and takes a screenshot every few seconds while it plays out (flare-<tag>-<n>.png),
// and checks the shockwave reaches the ship (the shields take it).
import { chromium } from 'playwright-core';

const out = process.env.OUT ?? '.';
const tag = process.argv[3] ?? 'now';
const URL = 'http://localhost:5173/?quality=high#/universe';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript((s) => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-universe-ship', JSON.stringify(s));
}, process.argv[2] ?? 'xwing');
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
await page.waitForTimeout(2500);
// hide the panel so the sky's in view
await page.addStyleTag({ content: '.universe-panel, [class*="universe-panel"] { display: none !important; }' });

// 220 units off the sun (at the map's middle, 32 across), nose on to it a little off its middle, still
const placed = await page.evaluate(() => {
  const d = window.__universeDebug;
  const s = d.state;
  s.auto = null;
  s.safeUntil = -1e9;
  s.shield = 100;
  s.ship = { ...s.ship, x: 45, y: 12, z: 220, heading: 0.05, pitch: -0.04, bank: 0, speed: 0, vy: 0 };
  d.director.soon('flare');
  return true;
});
console.log('placed', placed);
await page.waitForFunction(() => window.__universeDebug.pieces.flareGoing, null, { timeout: 60000 }).catch(() => console.log('FAIL the flare never started'));
let n = 0;
let hit = false;
for (let k = 0; k < 14; k++) {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/flare-${tag}-${n++}.png` });
  const s = await page.evaluate(() => ({ going: window.__universeDebug.pieces.flareGoing, shield: window.__universeDebug.state.shield }));
  if (s.shield < 100) hit = true;
  if (!s.going) break;
}
console.log(hit ? 'ok   the shockwave reached the ship' : 'FAIL the shockwave never reached the ship');
console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(hit && !errors.length ? 0 : 1);
