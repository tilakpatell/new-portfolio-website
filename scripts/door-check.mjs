/* global window, document */
// A browser check of the landings' doors and people (universe/landings/).
// With the dev server up (npx vite --port 5173):
//   OUT=/tmp/shots node scripts/door-check.mjs [planet ...]
// For each planet it lands, waits for the crew to be out, then puts you at
// each of the landing's spots in turn (a door, someone with a line), reads
// the prompt, and at the first door presses G and checks the page that
// opens is the planet's own. Headless Chromium draws in software, slowly.
import { chromium } from 'playwright-core';

const out = process.env.OUT ?? '.';
const planets = process.argv.slice(2).length ? process.argv.slice(2) : ['rickmorty'];
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const problems = [];
const check = (ok, what) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) problems.push(what);
};

for (const id of planets) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-universe-ship', '"falcon"');
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173/?quality=mid#/universe', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
  await page.evaluate((id) => {
    const d = window.__universeDebug;
    const p = d.planets.find((x) => x.id === id);
    const c = p.group.position;
    const r = p.radius;
    d.state.ship = { ...d.state.ship, x: c.x + r * 1.25, y: c.y + r * 0.3, z: c.z + r * 0.25, speed: 0, vy: 0 };
  }, id);
  await page.waitForTimeout(2000);
  check(await page.evaluate(() => window.__universeDebug.startFoot()), `${id}: landed`);
  // (out of the ship: skip the walk down the ramp)
  const walking = await page
    .waitForFunction(() => window.__universeDebug.foot.phase === 'walk' || (window.__universeDebug.foot.phase === 'out' && window.__universeDebug.foot.debug?.me), null, { timeout: 240000, polling: 1000 })
    .then(() => true, () => false);
  check(walking, `${id}: the crew are out`);
  // the landing's spots, once its things have come
  await page.waitForTimeout(20000);
  await page.evaluate(() => {
    const S = window.__universeDebug.foot.debug;
    S.phase = 'walk';
  });
  const list = await page.evaluate(() => window.__universeDebug.foot.spots.map((s) => ({ n: s.n, label: s.label, say: s.say })));
  console.log(`     ${id}: ${list.length} spots`);
  let opened = false;
  for (let i = 0; i < list.length; i++) {
    const near = await page.evaluate((i) => {
      const S = window.__universeDebug.foot.debug;
      const s = window.__universeDebug.foot.spots[i];
      S.me = { ...S.me, n: s.n, h: 0, vh: 0, speed: 0, side: 0 };
      return window.__universeDebug.foot.info()?.near ?? null;
    }, i);
    await page.waitForTimeout(1500);
    const prompt = await page.evaluate(() => document.querySelector('.universe-prompt')?.textContent ?? '');
    check(Boolean(near) && Boolean(prompt), `${id}: spot ${i} answers: ${prompt || JSON.stringify(near)}`);
    await page.screenshot({ path: `${out}/${id}-door-${i}.png`, timeout: 180000 });
    if (near?.label && !opened) {
      opened = true;
      const before = await page.evaluate(() => window.location.hash);
      await page.keyboard.press('g');
      const after = await page.waitForFunction((b) => window.location.hash !== b && window.location.hash, before, { timeout: 30000 }).then((h) => h.jsonValue(), () => null);
      check(Boolean(after) && !after.includes('universe'), `${id}: G at ${near.label} opens ${after}`);
      break;
    }
  }
  await ctx.close();
}
console.log(problems.length ? `${problems.length} problems` : 'all ok');
await browser.close();
