/* global window */
// A browser check of the Rick and Morty sector (universe/portals.js). With
// the dev server up (npx vite --port 5173):
//   OUT=/tmp/shots node scripts/sector-check.mjs [--ship cruiser]
// It flies the ship from the home system into the portal by the Rick and
// Morty planet on the autopilot, out by the Citadel in the sector, on to
// Gazorpazorp on super speed, sets it down there, and back home through the
// Citadel's portal, taking a screenshot at each and printing what failed and
// any errors. Headless Chromium draws in software, slowly: the waits are long.
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : dflt;
};
const ship = flag('--ship', 'cruiser');
const out = process.env.OUT ?? '.';
const URL = 'http://localhost:5173/?quality=low#/universe';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript((s) => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-universe-ship', JSON.stringify(s));
}, ship);
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(`${m.type()}: ${m.text()}`));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
await page.waitForTimeout(3000);
const shot = (name) => page.screenshot({ path: `${out}/${name}.png`, timeout: 180000 });
let failed = 0;
const say = (ok, what) => {
  if (!ok) failed++;
  console.log(ok ? 'ok  ' : 'FAIL', what);
};
const where = () => page.evaluate(() => {
  const s = window.__universeDebug.state;
  return { x: s.ship.x, y: s.ship.y, z: s.ship.z, at: s.at, auto: s.auto?.id ?? null, note: s.note?.text ?? null };
});
const until = (fn, arg, seconds) => page.waitForFunction(fn, arg, { timeout: seconds * 1000, polling: 500 }).then(() => true, () => false);

// a look at a portal: the ship put still a way off it, facing it
const lookAt = (id) => page.evaluate((pid) => {
  const d = window.__universeDebug;
  const w = d.wonders.find((x) => x.id === pid);
  const s = d.state.ship;
  d.state.ship = { ...s, x: w.at[0] + 60, y: w.at[1] + 4, z: w.at[2] + 20, heading: Math.atan2(60, 20), speed: 0, vy: 0, pitch: 0, bank: 0 };
}, id);
await lookAt('rmportal');
await page.waitForTimeout(4000);
await shot('sector-0-portal');

// 1. into the portal by the Rick and Morty planet, on the autopilot
const went = await page.evaluate(() => window.__universeDebug.travel('rmportal', 'super'));
say(went, 'autopilot to the portal');
say(await until(() => window.__universeDebug.state.ship.z < -20000, null, 400), 'through the portal into the sector');
let w = await where();
console.log('     out at', w.x.toFixed(0), w.y.toFixed(0), w.z.toFixed(0), '·', w.note);
await page.waitForTimeout(2500);
await shot('sector-1-citadel');

// 2. on to Gazorpazorp on super speed, and down onto it
say(await page.evaluate(() => window.__universeDebug.travel('gazorpazorp', 'super')), 'autopilot to Gazorpazorp');
say(await until(() => window.__universeDebug.state.at === 'gazorpazorp' && !window.__universeDebug.state.auto, null, 400), 'at Gazorpazorp');
await shot('sector-2-gazorpazorp');
const landed = await page.evaluate(() => window.__universeDebug.startFoot());
say(landed, 'landing on Gazorpazorp');
if (landed) {
  say(await until(() => window.__universeDebug.foot.phase === 'walk', null, 180), 'crew out on Gazorpazorp');
  await page.waitForTimeout(4000);
  await shot('sector-2-down');
  await page.evaluate(() => window.__universeDebug.foot.end());
  await until(() => !window.__universeDebug.foot.phase, null, 60);
  await page.waitForTimeout(2000);
}

// 3. home through the Citadel's portal
await lookAt('rmportal-back');
await page.waitForTimeout(4000);
await shot('sector-3-portal-home');
say(await page.evaluate(() => window.__universeDebug.travel('rmportal-back', 'super')), 'autopilot to the portal home');
say(await until(() => window.__universeDebug.state.ship.z > -20000, null, 400), 'back through into the main map');
w = await where();
console.log('     out at', w.x.toFixed(0), w.y.toFixed(0), w.z.toFixed(0), '·', w.note);
await page.waitForTimeout(2500);
await shot('sector-4-home');

console.log(errors.length ? `${errors.length} errors:\n${[...new Set(errors)].slice(0, 30).join('\n')}` : 'no errors');
await browser.close();
process.exit(failed ? 1 : 0);
