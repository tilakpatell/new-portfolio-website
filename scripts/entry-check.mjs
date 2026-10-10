/* global window, document, requestAnimationFrame */
// A browser check of flying in (universe/entry.js, scene.js's flyInto). With
// the dev server up (npx vite --port 5173):
//   OUT=/tmp/shots node scripts/entry-check.mjs [--planet middleearth] [--moon birdworld] [--crash breakingbad] [--ship falcon] [--phone]
// It parks off a planet and checks G doesn't take it in and the prompt says
// to fly down into the air; flies the ship level into the planet's air at
// cruise speed and checks it goes straight on into that world's page, with
// no landing (the crew never step out); does the same for a Rick and Morty
// moon (Bird World: straight to Birdperson); then flies into another planet
// at the boost and checks that's still a crash, and that the crash takes the
// page on into that world's page. Screenshots of each moment go to OUT.
// Headless Chromium draws in software, slowly: the waits are long, and the
// scene's clock runs in frames (at most 50 ms each), so the timings are the
// scene's own, not the wall's.
import { chromium } from 'playwright-core';
import { byId } from '../src/components/universe/universes.js';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : dflt;
};
const ship = flag('--ship', 'falcon');
const planet = flag('--planet', 'middleearth');
const moon = flag('--moon', 'birdworld');
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
const shot = (name) => page.screenshot({ path: `${out}/entry-${name}.png`, timeout: 180000 });
const snap = () => page.evaluate(() => window.__universe());
const open = async () => {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  // (a key, so the ship's being flown, and then the scene's clock running:
  // in software its first frames are a long time coming)
  await page.keyboard.press('w');
  await page.waitForFunction(() => window.__universeDebug.state.clock > 0.5, null, { timeout: 600000, polling: 250 }).catch(() => null);
};
const leftFor = async () => {
  await page.waitForFunction(() => !/#\/universe/.test(window.location.hash), null, { timeout: 600000, polling: 100 }).catch(() => null);
  return page.evaluate(() => window.location.hash.replace(/^#/, '').replace(/\?.*$/, ''));
};

// 1. G at the planet: nothing (flying in is the way in), and the prompt says
// so, with no key to press
await open();
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
await page.waitForFunction((id) => window.__universe().landable === id, planet, { timeout: 600000, polling: 100 }).catch(() => null);
const prompt = await page.evaluate(() => {
  const el = document.querySelector('.universe-prompt');
  return { text: el?.textContent ?? '', key: el ? window.getComputedStyle(el, '::before').content : '' };
});
ok(/Fly down into the air to enter/.test(prompt.text) && (prompt.key === 'none' || prompt.key === 'normal'), `${planet}: the prompt says to fly down into the air to enter its world, with no key (${prompt.text}; badge ${prompt.key})`);
const clock1 = await page.evaluate(() => window.__universeDebug.state.clock);
await page.keyboard.press('g');
await page.waitForFunction((c) => window.__universeDebug.state.clock > c + 1.5, clock1, { timeout: 600000, polling: 100 }).catch(() => null);
let s = await snap();
ok(!s.foot && !s.crash && !s.auto && /#\/universe/.test(await page.evaluate(() => window.location.hash)), `${planet}: G at a planet does nothing (foot ${JSON.stringify(s.foot?.phase)}, autopilot ${JSON.stringify(s.auto)})`);

// 2. Level into the air at cruise, a planet and a moon: straight on into the
// world's page, never a landing (no foot scene, ever) nor a crash
for (const id of [planet, moon]) {
  await open();
  await page.evaluate(() => {
    window.__landed = false;
    window.__crashed = false;
    const watch = () => {
      const u = window.__universe?.();
      if (u?.foot) window.__landed = true;
      if (u?.crash) window.__crashed = true;
      if (/#\/universe/.test(window.location.hash)) requestAnimationFrame(watch);
    };
    watch();
  });
  ok(await page.evaluate((id) => window.__universeDebug.diveAt(id, 5.5), id), `${id}: put just off its air at cruise`);
  await page.waitForTimeout(400);
  await shot(`${id}-1-in`);
  const to = await leftFor();
  const seen = await page.evaluate(() => ({ landed: window.__landed, crashed: window.__crashed }));
  ok(to === byId(id).to, `${id}: flying into its air at cruise goes straight into its world (${to}, want ${byId(id).to})`);
  ok(!seen.landed && !seen.crashed, `${id}: no landing on the way, nor a crash (landed ${seen.landed}, crashed ${seen.crashed})`);
  await page.waitForTimeout(2500);
  await shot(`${id}-2-world`);
}

// 3. Into another planet at the boost: still a crash, on into its page
await open();
ok(await page.evaluate((id) => window.__universeDebug.diveAt(id, 20), crashInto), `${crashInto}: put just off its air at the boost`);
await page.keyboard.down('w');
await page.keyboard.down('Shift');
await page.waitForFunction(() => window.__universe().crash || window.__universe().foot || !/#\/universe/.test(window.location.hash), null, { timeout: 600000, polling: 30 }).catch(() => null);
await page.keyboard.up('Shift');
await page.keyboard.up('w');
s = await snap().catch(() => null);
ok(Boolean(s?.crash) && !s.foot, `${crashInto}: flying in at the boost is a crash, not a way in (crash ${JSON.stringify(s?.crash)}, foot ${JSON.stringify(s?.foot?.phase)})`);
await page.waitForTimeout(1200);
await shot(`${crashInto}-crash`);
const hash = await leftFor();
ok(hash === (byId(crashInto).crashTo ?? byId(crashInto).to), `${crashInto}: the crash took the page on into its world (${hash})`);

console.log(errors.length ? `${errors.length} errors:\n${[...new Set(errors)].slice(0, 30).join('\n')}` : 'no errors');
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
