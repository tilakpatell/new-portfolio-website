/* global window */
// A browser check of the landings' loose things (universe/landings/
// physics.js): lands on each planet as scripts/landing-check.mjs does,
// waits for the crew to be out and the engine to be in, then knocks the
// lightest two loose things and the heaviest two with a shot (passing over
// one whose shot meets something else first) and says how far each moved
// where it's drawn, once it's still. With the dev server up (npx vite
// --port 5173):
//   node scripts/props-check.mjs [planet ...] [--allow-empty]
// Exit code 1 if a planet's engine never came (or is off on a desktop), it
// came down where there's nothing loose (unless --allow-empty: it says
// which biome), or a knocked thing didn't move between 0.3 and 25 m (a
// crate slides, a pebble isn't sent out of sight).
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const allowEmpty = args.includes('--allow-empty');
const named = args.filter((a) => !a.startsWith('--'));
// (Marvel's crates at 8 kg and a table at 14; the office's AC units at 25)
const planets = named.length ? named : ['middleearth', 'breakingbad', 'marvel', 'office'];
const URL = `http://localhost:${process.env.PORT ?? 5173}/?quality=mid#/universe`;
const WALK_MS = Number(process.env.WALK_MS ?? 240000);
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-universe-ship', JSON.stringify('falcon'));
  // (frames drawn, to tell a thing at rest from a page that drew nothing)
  window.__frames = 0;
  const tick = () => {
    window.__frames++;
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
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
  // (the lightest two loose ones and the heaviest two, by the mass they
  // stand at: a fixed lamp post doesn't move when it's shot, and a bolt's
  // knock falls off with mass, so the heaviest are the ones it might not
  // shift; one whose shot meets something else first, a neighbour or a
  // fixed thing, is passed over for the next)
  const tried = new Set();
  for (const order of [before.loose, [...before.loose].reverse()]) {
    let knocked = 0;
    for (const i of order) {
      if (knocked >= 2) break;
      if (tried.has(i)) continue;
      tried.add(i);
      const was = await page.evaluate((i) => window.__universeDebug.foot.physics().drawn(i), i);
      const met = await page.evaluate((i) => {
        const p = window.__universeDebug.foot.physics();
        const hit = p.knock(i);
        if (!hit) return null;
        const u = hit.entry.user;
        if (u.position === p.bodyAt(i).position) return { self: true };
        return { self: false, kind: u.object?.name || u.meshes?.[0]?.parent?.name || '?', fixed: Boolean(u.body.fixed) };
      }, i);
      if (met && !met.self) {
        console.log('skip', id, `#${i} ${before.kinds[i] ?? ''}: the shot met ${met.fixed ? 'a fixed' : 'a loose'} ${met.kind} first`);
        continue;
      }
      knocked++;
      const hit = Boolean(met);
      // (watched till it's still: on software GL a frame can take most of
      // a second and the engine steps at most four 1/60 s a frame, so a
      // knock plays out several times slower than it would; still is twice
      // not moved over a few frames)
      let now = was;
      let seen = await page.evaluate(() => window.__frames);
      for (let k = 0, still = 0; k < 40 && still < 2; k++) {
        await page.waitForTimeout(k ? 1000 : 2500);
        const [at, frames] = await page.evaluate((i) => [window.__universeDebug.foot.physics().drawn(i), window.__frames], i);
        if (frames - seen < 4) continue;
        still = Math.hypot(at[0] - now[0], at[1] - now[1], at[2] - now[2]) / 0.027 < 0.005 ? still + 1 : 0;
        now = at;
        seen = frames;
      }
      const moved = Math.hypot(now[0] - was[0], now[1] - was[1], now[2] - was[2]) / 0.027;
      const good = hit && moved >= 0.3 && moved <= 25;
      if (!good) bad++;
      console.log(good ? 'ok  ' : 'FAIL', id, `#${i} ${before.kinds[i] ?? ''}: hit ${hit}, moved ${moved.toFixed(2)} m`);
    }
  }
  await page.evaluate(() => window.__universeDebug.foot.end());
  await page.waitForTimeout(1500);
}
console.log(errors.length ? `${errors.length} errors:\n${[...new Set(errors)].slice(0, 20).join('\n')}` : 'no errors');
await browser.close();
process.exit(bad ? 1 : 0);
