/* global window, document, MutationObserver */
// A browser check of flying in to land (universe/entry.js, reentry.js,
// footScene.js's entry). With the dev server up (npx vite --port 5173):
//   OUT=/tmp/shots node scripts/entry-check.mjs [--planet middleearth] [--crash breakingbad] [--ship falcon] [--phone]
// It flies the ship level into a planet's air at cruise speed and checks the
// way in takes it down (the burn, the clouds, out under them, the place's
// name) and the crew step out; takes off and checks it climbs out past the
// air; parks off the planet and checks G no longer lands it; then flies
// into another planet at the boost and checks that's still a crash, and that
// the crash takes the page on into that world's page. Screenshots of each
// moment go to OUT. Headless Chromium draws in software, slowly: the waits
// are long, and the scene's clock runs in frames (at most 50 ms each), so
// the timings are the scene's own, not the wall's.
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : dflt;
};
const ship = flag('--ship', 'falcon');
const planet = flag('--planet', 'middleearth');
const crashInto = flag('--crash', 'breakingbad');
const phone = args.includes('--phone');
const out = process.env.OUT ?? '.';
const base = process.env.BASE ?? 'http://localhost:5173';
const URL = `${base}/?quality=${phone ? 'low' : 'mid'}#/universe`;
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
let failed = 0;
const ok = (good, what) => {
  if (!good) failed++;
  console.log(good ? 'ok  ' : 'FAIL', what);
};
const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: phone });
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
const shot = (name) => page.screenshot({ path: `${out}/entry-${name}.png`, timeout: 180000 });
const snap = () => page.evaluate(() => window.__universe());
// waits for the scene's own clock (the entry's `t`) to pass `t` seconds
const entryPast = (t) => page.waitForFunction((t) => (window.__universe().foot?.entry?.t ?? Infinity) >= t, t, { timeout: 180000, polling: 100 });

// 1. Level into the air at cruise: the way in, and out onto the ground
// (the place's name is up for 6.5 s of the wall's time, which in software
// can be a second of the scene's: it's caught as it comes)
await page.evaluate(() => {
  window.__cards = [];
  new MutationObserver(() => {
    const el = document.querySelector('.universe-arrive-title');
    if (el && !window.__cards.includes(el.textContent)) window.__cards.push(el.textContent, window.__universe().foot?.entry?.t ?? null);
  }).observe(document.body, { childList: true, subtree: true });
});
ok(await page.evaluate((id) => window.__universeDebug.diveAt(id, 5.5), planet), `${planet}: put just off its air`);
await page.waitForFunction(() => window.__universe().foot?.entry, null, { timeout: 60000, polling: 50 }).catch(() => null);
let s = await snap();
ok(s.foot?.phase === 'land' && s.foot.entry, `${planet}: flying into its air at cruise starts the way in (phase ${s.foot?.phase}, crash ${JSON.stringify(s.crash)})`);
for (const [t, name] of [
  [0.6, '1-burn'],
  [1.6, '2-burn-deep'],
  [2.85, '3-clouds'],
  [3.6, '4-out-under-the-clouds'],
  [5.2, '5-settling'],
]) {
  await entryPast(t).catch(() => null);
  await shot(`${planet}-${name}`);
}
const [card, cardAt] = await page.evaluate(() => window.__cards);
ok(Boolean(card) && cardAt > 3, `${planet}: the place's name comes up out under the clouds (${card}, ${cardAt?.toFixed?.(2)} s in)`);
await page.waitForFunction(() => window.__universe().foot?.phase === 'walk', null, { timeout: 600000, polling: 250 }).catch(() => null);
s = await snap();
ok(s.foot?.phase === 'walk' && !s.foot.entry, `${planet}: down, and the crew out (phase ${s.foot?.phase})`);
await page.waitForTimeout(2500);
await shot(`${planet}-6-out`);

// 2. Back in and up: out past the air
await page.evaluate(() => window.__universeDebug.foot.board());
await page.waitForFunction(() => !window.__universe().foot, null, { timeout: 600000, polling: 250 }).catch(() => null);
s = await snap();
const air = await page.evaluate((id) => {
  const d = window.__universeDebug;
  const p = d.planets.find((x) => x.id === id);
  const c = p.group.position;
  const sh = d.state.ship;
  return { dist: Math.hypot(sh.x - c.x, sh.y - c.y, sh.z - c.z), top: p.radius * 1.2 };
}, planet);
ok(!s.foot && air.dist > air.top, `${planet}: took off and climbed out past the air (${air.dist.toFixed(2)} from its middle, the air's top ${air.top.toFixed(2)})`);
await shot(`${planet}-7-up`);
// (and flying straight on from there, level, takes it away, not back down into the air)
const clock0 = await page.evaluate(() => window.__universeDebug.state.clock);
await page.keyboard.down('w');
await page.waitForFunction((c) => window.__universeDebug.state.clock > c + 3 || window.__universe().foot, clock0, { timeout: 600000, polling: 100 }).catch(() => null);
await page.keyboard.up('w');
s = await snap();
const away = await page.evaluate((id) => {
  const d = window.__universeDebug;
  const c = d.planets.find((x) => x.id === id).group.position;
  const sh = d.state.ship;
  return Math.hypot(sh.x - c.x, sh.y - c.y, sh.z - c.z);
}, planet);
ok(!s.foot && away > air.dist, `${planet}: flying on level after taking off goes away from it, not back in (${away.toFixed(2)} from its middle)`);

// 3. G at the planet: no landing (flying in is the only way down), and the
// prompt says so, with no key to press
await page.evaluate((id) => {
  const d = window.__universeDebug;
  d.diveAt(id, 0);
  // (back off a little further, still at it, nose level and still)
  const p = d.planets.find((x) => x.id === id);
  const c = p.group.position;
  const sh = d.state.ship;
  const k = 1.5;
  d.state.ship = { ...sh, x: c.x + (sh.x - c.x) * k, z: c.z + (sh.z - c.z) * k, speed: 0 };
}, planet);
await page.waitForFunction((id) => window.__universe().landable === id, planet, { timeout: 60000, polling: 100 }).catch(() => null);
const prompt = await page.evaluate(() => {
  const el = document.querySelector('.universe-prompt');
  return { text: el?.textContent ?? '', key: el ? window.getComputedStyle(el, '::before').content : '' };
});
ok(/Fly down into the air/.test(prompt.text) && (prompt.key === 'none' || prompt.key === 'normal'), `${planet}: the prompt says to fly down into the air, with no key (${prompt.text}; badge ${prompt.key})`);
const clock1 = await page.evaluate(() => window.__universeDebug.state.clock);
await page.keyboard.press('g');
await page.waitForFunction((c) => window.__universeDebug.state.clock > c + 1.5, clock1, { timeout: 600000, polling: 100 }).catch(() => null);
s = await snap();
ok(!s.foot && !s.crash && !s.auto, `${planet}: G at a planet does nothing (foot ${JSON.stringify(s.foot?.phase)}, autopilot ${JSON.stringify(s.auto)})`);

// 4. Into another planet at the boost: still a crash, on into its page
ok(await page.evaluate((id) => window.__universeDebug.diveAt(id, 20), crashInto), `${crashInto}: put just off its air at the boost`);
await page.keyboard.down('w');
await page.keyboard.down('Shift');
await page.waitForFunction(() => window.__universe().crash || window.__universe().foot, null, { timeout: 60000, polling: 30 }).catch(() => null);
await page.keyboard.up('Shift');
await page.keyboard.up('w');
s = await snap();
ok(Boolean(s.crash) && !s.foot, `${crashInto}: flying in at the boost is a crash, not a landing (crash ${JSON.stringify(s.crash)}, foot ${JSON.stringify(s.foot?.phase)})`);
await page.waitForTimeout(1200);
await shot(`${crashInto}-crash`);
await page.waitForFunction(() => !/#\/universe/.test(window.location.hash), null, { timeout: 600000, polling: 250 }).catch(() => null);
const hash = await page.evaluate(() => window.location.hash);
ok(!/#\/universe/.test(hash), `${crashInto}: the crash took the page on into its world (${hash})`);

console.log(errors.length ? `${errors.length} errors:\n${[...new Set(errors)].slice(0, 30).join('\n')}` : 'no errors');
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
