/* global window */
// A browser check of the rocks at speed (rockHits.js, scene.js's rocksHit).
// With the dev server up (npx vite --port 5173):
//   OUT=/tmp/shots node scripts/rocks-check.mjs [xwing|falcon|cruiser|rv]
// It puts the ship just short of a rock in the belt, nose on to it, at the
// pulse drive's speed, and checks the rock's smashed, the shields took it and
// the ship's been knocked back down to the boost; then the same at the
// boost, which is only a bump.
import { chromium } from 'playwright-core';

const out = process.env.OUT ?? '.';
const URL = 'http://localhost:5173/?quality=low#/universe';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
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
}, process.argv[2] ?? 'xwing');
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
await page.waitForTimeout(2500);

// the ship `gap` units short of a middling belt rock, nose on to it (heading 0
// flies down −z), at `speed`
const aim = (speed, pick, gap = 6) =>
  page.evaluate(
    ({ speed, pick, gap }) => {
      const d = window.__universeDebug;
      const f = d.rockFields.find((o) => o.id === 'belt');
      const i = f.grid.rocks.findIndex((o, k) => k > pick && o.r > 0.6 && o.r < 1.2 && !d.smashed.get('belt').has(k));
      const o = f.grid.rocks[i];
      const a = f.field.group.rotation.y;
      const x = o.x * Math.cos(a) + o.z * Math.sin(a);
      const z = -o.x * Math.sin(a) + o.z * Math.cos(a);
      const s = d.state;
      s.auto = null;
      s.safeUntil = -1e9;
      s.shield = 100;
      s.ship = { ...s.ship, x, y: o.y, z: z + gap, heading: 0, pitch: 0, bank: 0, speed, vy: 0 };
      return { i, r: o.r };
    },
    { speed, pick, gap },
  );
const after = (i) => page.evaluate((i) => ({ gone: window.__universeDebug.smashed.get('belt').size > 0, which: [...window.__universeDebug.smashed.get('belt').keys()], target: i, shield: window.__universeDebug.state.shield, speed: window.__universeDebug.state.ship.speed, note: window.__universeDebug.state.note?.text ?? null }), i);

const fast = await aim(300, 0);
await page.waitForFunction(() => window.__universeDebug.smashed.get('belt').size > 0, null, { timeout: 20000 }).catch(() => {});
const a = await after(fast.i);
console.log('at speed:', fast, a);
check(a.gone, 'the rock hit at speed is smashed');
check(a.shield < 100, 'the shields took it');
check(a.speed <= 120, 'the ship is knocked back down under the pulse drive');
check(/rock/i.test(a.note ?? ''), 'the HUD says so');
await page.screenshot({ path: `${out}/rocks-hit.png` });

await page.waitForTimeout(1500);
await page.evaluate(() => window.__universeDebug.smashed.get('belt').clear());
// (just short of it: in software GL the belt turns on the wall clock while the ship flies a
// few frames a second, so a rock further off has moved out of the way by the time it's there)
const slow = await aim(12, fast.i + 1, 0.95);
await page.waitForFunction(() => window.__universeDebug.smashed.get('belt').size > 0, null, { timeout: 30000 }).catch(() => {});
const b = await after(slow.i);
console.log('at cruise:', slow, b);
check(b.gone, 'a rock hit at cruise is smashed too');
check(b.shield === 100, 'but at cruise the shields take nothing');

console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(problems.length || errors.length ? 1 : 0);
