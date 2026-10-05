/* global window, document */
// A browser check of the director's flare, rift and leviathans (scene.js). With the
// dev server up (npx vite --port 5173) and Chrome at $CHROME:
//   OUT=/tmp/shots node scripts/events-check.mjs [cruiser|xwing|falcon|rv]
// It asks the director for each in turn and checks the scene plays it out:
// the rift opens and takes the ship through, the flare goes, the leviathans pass.
import { chromium } from 'playwright-core';

const out = process.env.OUT ?? '.';
const URL = 'http://localhost:5173/?quality=low#/universe';
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [];
const problems = [];
const check = (ok, what) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) problems.push(what);
};
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript((s) => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-universe-ship', JSON.stringify(s));
  window.localStorage.setItem('tp-universe-drive', '"super"');
}, process.argv[2] ?? 'rv');
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
await page.waitForTimeout(2500);
const dbg = (fn) => page.evaluate(fn);

// the director brings each on when asked: the scene must call happen() within a few frames
await dbg(() => window.__universeDebug.director.soon('rift'));
await page.waitForFunction(() => Boolean(window.__universeDebug.pieces.riftAt), null, { timeout: 30000 }).catch(() => {});
const riftAt = await dbg(() => window.__universeDebug.pieces.riftAt?.toArray());
check(Boolean(riftAt), `a rift opened at ${JSON.stringify(riftAt)}`);
await page.waitForTimeout(1000);
await page.screenshot({ path: `${out}/rift.png`, timeout: 120000 });
// fly the ship into it: put the ship at the rift and let a frame run
const before = await dbg(() => ({ ...window.__universe().ship }));
await dbg(() => {
  const d = window.__universeDebug;
  const r = d.pieces.riftAt;
  d.state.ship.x = r.x;
  d.state.ship.y = r.y;
  d.state.ship.z = r.z;
});
// (the rift takes 0.6 s of the scene's own clock to open, which is a while in software GL)
await page.waitForFunction((b) => Math.hypot(window.__universe().ship.x - b.x, window.__universe().ship.z - b.z) > 100, before, { timeout: 90000 }).catch(() => {});
const after = await dbg(() => ({ ship: { ...window.__universe().ship } }));
const moved = Math.hypot(after.ship.x - before.x, after.ship.z - before.z);
check(moved > 100, `through the rift: the ship is ${moved.toFixed(0)} units from where it was`);
await page.waitForFunction(() => !window.__universeDebug.pieces.riftAt, null, { timeout: 90000 }).catch(() => {});
check(await dbg(() => !window.__universeDebug.pieces.riftAt), 'the rift closed behind it');

await dbg(() => window.__universeDebug.director.soon('flare'));
await page.waitForFunction(() => window.__universeDebug.pieces.flareGoing, null, { timeout: 30000 }).catch(() => {});
check(await dbg(() => window.__universeDebug.pieces.flareGoing), 'a flare is going');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/flare.png`, timeout: 120000 });

await dbg(() => window.__universeDebug.director.soon('leviathan'));
await page.waitForFunction(() => window.__universeDebug.leviathans.busy, null, { timeout: 30000 }).catch(() => {});
check(await dbg(() => window.__universeDebug.leviathans.busy), 'leviathans are passing');
await page.waitForTimeout(6000);
await page.screenshot({ path: `${out}/leviathan.png`, timeout: 120000 });
console.log('comms:', await dbg(() => document.querySelector('.universe-comms')?.textContent ?? ''));

console.log('errors:', errors);
console.log(problems.length ? `FAILED: ${problems.length}` : 'ALL OK');
await browser.close();
process.exit(problems.length || errors.length ? 1 : 0);
