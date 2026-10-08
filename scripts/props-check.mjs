/* global window */
// A browser check of the landings' loose things (universe/landings/
// physics.js): lands on each planet as scripts/landing-check.mjs does,
// waits for the crew to be out and the engine to be in, then knocks each
// of the first few loose things with a shot and says whether it moved
// where it's drawn. With the dev server up (npx vite --port 5173):
//   node scripts/props-check.mjs [planet ...] [--allow-empty]
// Exit code 1 if a planet's engine never came (or is off on a desktop), it
// came down where there's nothing loose (unless --allow-empty: it says
// which biome), or a knocked thing didn't move.
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const allowEmpty = args.includes('--allow-empty');
const named = args.filter((a) => !a.startsWith('--'));
const planets = named.length ? named : ['middleearth', 'breakingbad'];
const URL = `http://localhost:${process.env.PORT ?? 5173}/?quality=mid#/universe`;
const WALK_MS = Number(process.env.WALK_MS ?? 240000);
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-universe-ship', JSON.stringify('falcon'));
});
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => (m.type() === 'error' || /landing physics/.test(m.text())) && errors.push(`${m.type()}: ${m.text()}`));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
await page.waitForTimeout(3000);
let bad = 0;
for (const id of planets) {
  const ok = await page.evaluate((id) => {
    const d = window.__universeDebug;
    const p = d.planets.find((x) => x.id === id);
    if (!p) return false;
    const c = p.group.position;
    const r = p.radius ?? 18;
    d.state.ship = { ...d.state.ship, x: c.x + r * 1.25, y: c.y + r * 0.3, z: c.z + r * 0.25, speed: 0, vy: 0 };
    return true;
  }, id);
  if (!ok) {
    console.log('FAIL', id, 'no such planet');
    bad++;
    continue;
  }
  await page.waitForTimeout(2500);
  // (named, and tried for a while: on software GL the ship's model and the
  // landable planet can take a good few seconds to be there)
  let landed = false;
  for (let k = 0; k < 45 && !landed; k++) {
    landed = await page.evaluate((id) => window.__universeDebug.startFoot({ id }), id);
    if (!landed) await page.waitForTimeout(2000);
  }
  if (!landed) {
    console.log('FAIL', id, 'the ship would not set down');
    bad++;
    continue;
  }
  await page.waitForFunction(() => window.__universeDebug.foot.phase === 'walk', null, { timeout: WALK_MS, polling: 500 }).catch(() => {});
  const phase = await page.evaluate(() => window.__universeDebug.foot.phase);
  if (phase !== 'walk') console.log('    ', id, `crew not out yet (phase ${phase})`);
  await page.waitForFunction(() => window.__universeDebug.foot.physics().engine !== 'loading', null, { timeout: 60000, polling: 500 }).catch(() => {});
  // (and every loose thing a body: on software GL a frame of the first
  // landing can take seconds, compiling)
  await page.waitForFunction(() => { const p = window.__universeDebug.foot.physics(); return p.engine !== 'ready' || p.simulated >= p.bodies; }, null, { timeout: 180000, polling: 1000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const before = await page.evaluate(() => {
    const f = window.__universeDebug.foot;
    const p = f.physics();
    return { biome: f.biome?.title ?? null, engine: p.engine, bodies: p.bodies, simulated: p.simulated, pushers: p.pushers, kinds: p.kinds, loose: p.loose };
  });
  console.log(`     ${id}:`, JSON.stringify({ ...before, kinds: [...new Set(before.kinds)], loose: before.loose.length }));
  if (before.engine !== 'ready') {
    console.log('FAIL', id, `engine ${before.engine}`);
    bad++;
  }
  if (!before.loose.length && !allowEmpty) {
    console.log('FAIL', id, `nothing loose where it came down (${before.biome ?? 'the planet’s own landing'})`);
    bad++;
  }
  if (before.bodies && !before.simulated) console.log('    ', id, 'first body:', JSON.stringify(await page.evaluate(() => window.__universeDebug.foot.physics().bodyAt(0))));
  // (the lightest loose ones: a fixed lamp post doesn't move when it's
  // shot, and a bolt barely slides a crate)
  for (const i of before.loose.slice(0, 4)) {
    const was = await page.evaluate((i) => window.__universeDebug.foot.physics().drawn(i), i);
    const hit = await page.evaluate((i) => Boolean(window.__universeDebug.foot.physics().knock(i)), i);
    await page.waitForTimeout(2500);
    const now = await page.evaluate((i) => window.__universeDebug.foot.physics().drawn(i), i);
    const moved = Math.hypot(now[0] - was[0], now[1] - was[1], now[2] - was[2]) / 0.027;
    const good = hit && moved > 0.05;
    if (!good) bad++;
    console.log(good ? 'ok  ' : 'FAIL', id, `#${i} ${before.kinds[i] ?? ''}: hit ${hit}, moved ${moved.toFixed(2)} m`);
  }
  await page.evaluate(() => window.__universeDebug.foot.end());
  await page.waitForTimeout(1500);
}
console.log(errors.length ? `${errors.length} errors:\n${[...new Set(errors)].slice(0, 20).join('\n')}` : 'no errors');
await browser.close();
process.exit(bad ? 1 : 0);
