/* global window */
// A browser check of a landing's fallen leaves and crowns (universe/
// landings/litter.js, canopy.js): lands on each planet as scripts/
// props-check.mjs does, waits for the crew to be out and the landing shown,
// then says whether the leaves are down and as many as the place and the
// device have, whether the crowns are in the canopy's shader, whether a
// blast at your feet throws them (and, with motion turned down, doesn't)
// and they all come down again after, and whether anything's shader was
// made in a frame once the landing was shown (lib/three/frameGuard's
// slips). With the dev server up (npx vite --port 5173, or PORT=5188):
//   OUT=/tmp/shots node scripts/leaves-check.mjs [planet ...] [--spot lat,lon] [--phone] [--reduced] [--quality high]
// --spot forces where it comes down (footScene.js's DEV ?spot=: 36.9,3.4 is
// Lothlórien); --phone is a phone's screen at the low level; --reduced asks
// for reduced motion. It takes screenshots of the ground before the blast
// and after it. Exit code 1 on any failure.
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : dflt;
};
const bool = (name) => (args.includes(name) ? (args.splice(args.indexOf(name), 1), true) : false);
const spot = flag('--spot', null);
const phone = bool('--phone');
const reduced = bool('--reduced');
const quality = flag('--quality', phone ? 'low' : 'mid');
const out = process.env.OUT ?? '.';
const WALK_MS = Number(process.env.WALK_MS ?? 480000); // (software GL: the crew take minutes to walk out)
const planets = args.length ? args : ['middleearth'];
const tagOf = (id) => [id, spot?.replace(',', '_'), phone && 'phone', reduced && 'reduced', quality !== 'mid' && !phone && quality].filter(Boolean).join('-');
// how many leaves each place lays round you, at each level (litter.js's
// leafCount of its density: landings.js's LEAVES), by its biome's title
// (or the planet, with none)
const COUNTS = {
  'The Shire': { high: 416, mid: 320, low: 160 },
  'The old forest': { high: 640, mid: 320, low: 160 },
  Earth: { high: 192, mid: 160, low: 96 },
  marvel: { high: 160, mid: 128, low: 96 },
  music: { high: 160, mid: 128, low: 96 },
};
// (the level the page picks: litter.js's leafLevel, a 1280 × 800 window not small at high)
const level = quality === 'low' ? 'low' : quality === 'mid' || phone ? 'mid' : 'high'; // (a phone's screen is small: no higher than mid)
const URL = `http://localhost:${process.env.PORT ?? 5173}/?quality=${quality}${spot ? `&spot=${spot}` : ''}#/universe`;
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [];
const notes = [];
const slips = [];
const viewport = phone ? { width: 390, height: 844 } : { width: 1280, height: 800 };
const ctx = await browser.newContext({ viewport, hasTouch: phone, reducedMotion: reduced ? 'reduce' : 'no-preference' });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-universe-ship', JSON.stringify('falcon'));
});
const page = await ctx.newPage();
let shown = false; // (the landing's shown: a frame's shader from here on is a slip)
// (a shader that won't build, or anything thrown, fails it; the frame
// guard's word on a shader made in a frame, once the landing's shown; any
// other error's said, not counted: a fetch the sandbox refuses)
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  const text = m.text();
  if (/Shader Error|WebGLProgram/.test(text)) errors.push(`${m.type()}: ${text}`);
  else if (/frameGuard/.test(text)) slips.push(`${shown ? 'after' : 'before'} the landing was shown: ${text}`);
  else if (m.type() === 'error') notes.push(text);
});
page.on('response', (r) => r.status() >= 400 && notes.push(`${r.status()} ${r.url()}`));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
await page.waitForTimeout(3000);
const leaves = () => page.evaluate(() => {
  const l = window.__universeDebug.foot.leaves();
  return l && { on: l.on, level: l.level, count: l.count, half: l.half, airborne: l.airborne, asleep: l.asleep, near: l.near, ready: l.ready, canopy: l.canopy };
});
// (the scene alone: the page's panels and HUD out of the way for it)
const shot = async (id, name) => {
  const hide = await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }' });
  await page.screenshot({ path: `${out}/leaves-${tagOf(id)}-${name}.png`, timeout: 180000 });
  await hide.evaluate((el) => el.remove());
};

let bad = 0;
const fail = (id, why) => {
  bad++;
  console.log('FAIL', id, why);
};
for (const id of planets) {
  shown = false;
  const was = bad;
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
    fail(id, 'no such planet');
    continue;
  }
  await page.waitForTimeout(2500);
  let landed = false;
  for (let k = 0; k < 45 && !landed; k++) {
    landed = await page.evaluate((id) => window.__universeDebug.startFoot({ id }), id);
    if (!landed) await page.waitForTimeout(2000);
  }
  if (!landed) {
    fail(id, 'the ship would not set down');
    continue;
  }
  await page.waitForFunction(() => window.__universeDebug.foot.phase === 'walk' && window.__universeDebug.foot.leaves()?.ready, null, { timeout: WALK_MS, polling: 500 }).catch(() => {});
  const biome = await page.evaluate(() => window.__universeDebug.foot.biome);
  const at = await page.evaluate(() => ({ phase: window.__universeDebug.foot.phase, ready: window.__universeDebug.foot.leaves()?.ready }));
  if (at.phase !== 'walk' || !at.ready) {
    fail(id, `not out on a shown landing (phase ${at.phase}, shown ${at.ready})`);
    continue;
  }
  shown = true;
  // (nothing's shader made in a frame once it's shown)
  const s0 = await page.evaluate(() => window.__tpGuardSlips ?? 0);
  await page.waitForTimeout(3000);
  const s1 = await page.evaluate(() => window.__tpGuardSlips ?? 0);
  if (s1 > s0) fail(id, `${s1 - s0} shader(s) made in a frame once the landing was shown`);
  const info = await leaves();
  const place = biome?.title ?? id;
  console.log(`     ${id}:`, JSON.stringify({ biome, place, ...info }));
  const want = COUNTS[place]?.[level];
  if (!info?.on) fail(id, 'no leaves down');
  else if (want == null) fail(id, `no count known for ${place}`);
  else if (info.count !== want) fail(id, `${info.count} leaves, not ${want} (${place}, ${level})`);
  if (!info?.canopy?.includes('|canopy:')) fail(id, `the crowns aren't in the canopy's shader (${info?.canopy})`);
  await shot(id, 'ground');
  if (!(info?.near > 0)) fail(id, 'no leaves round your feet');
  // a blast at your feet: up they go (and with motion turned down, not;
  // waited for by the frame, not the clock: software GL draws a few a second)
  const up = (await leaves()).airborne;
  const thrown = await page.evaluate(() => window.__universeDebug.foot.leaves().blast(3));
  if (reduced) await page.waitForTimeout(3000);
  else await page.waitForFunction((up) => window.__universeDebug.foot.leaves().airborne > up, up, { timeout: 15000, polling: 100 }).catch(() => {});
  const after = await leaves();
  console.log(`     ${id}: blast threw ${thrown}, ${after.airborne} in the air (${up} before), ${after.asleep} asleep`);
  if (reduced) {
    if (thrown !== 0 || after.airborne !== 0 || after.asleep !== after.count) fail(id, `with motion turned down, ${thrown} thrown, ${after.airborne} in the air and ${after.asleep} of ${after.count} asleep`);
  } else if (!(thrown > 0 && after.airborne > up)) fail(id, `a blast threw ${thrown}, and ${after.airborne - up} more went up`);
  await shot(id, 'blast');
  // and down again (in the sim's time: a slow frame steps one of his frames, so wait by them)
  const t0 = Date.now();
  const down = await page.waitForFunction(() => window.__universeDebug.foot.leaves().airborne === 0, null, { timeout: 90000, polling: 500 }).then(() => true, () => false);
  console.log(`     ${id}: all down again ${down ? `in ${((Date.now() - t0) / 1000).toFixed(1)} s` : 'never'}`);
  if (!down) fail(id, 'leaves still in the air 90 s on');
  if (bad === was) console.log('ok  ', id, place);
  await page.evaluate(() => window.__universeDebug.foot.end());
  await page.waitForTimeout(1500);
}
for (const s of slips) console.log('    ', s);
if (slips.some((s) => s.startsWith('after'))) bad++;
for (const n of [...new Set(notes)].slice(0, 10)) console.log('     (said:', n, ')');
console.log(errors.length ? `${errors.length} errors:\n${[...new Set(errors)].slice(0, 20).join('\n')}` : 'no errors');
if (errors.length) bad++;
await browser.close();
process.exit(bad ? 1 : 0);
