/* global window */
// A browser check of the 2017 soldier's body on a galaxy world (lane P1 of
// docs/superpowers/specs/2026-10-10-bf2017-physics-design.md): it opens
// /galaxy/<world>/surface, waits for the scene, and puts the player on the
// body. On a world whose level hands its physics engine to the scene (lane
// P0's stream calls the handle's usePhysics) that engine is used; otherwise,
// or with FIXTURE=1, it builds a course in the page (through Vite's dev
// modules: lib/physics/world.js) beside where you stand and hands that over:
// a floor, a 0.5 m wall, a 0.4 m step, a 0.9 m crate and a beam 1.3 m up.
// Then, by the keys, it walks into the wall (held), up the step (risen),
// jumps onto the crate (stood on its top), and crouches under the beam
// (through; standing, stopped), and writes
// docs/superpowers/evidence/bf2017-physics/p1/<world>.json and four JPEG shots.
// With the dev server up (npx vite --port 5188):
//   node scripts/physics-check.mjs hoth
//   CHROME=<chrome or edge> BASE=http://127.0.0.1:5188 ANGLE=d3d11 FIXTURE=1 OUT=<dir> …
// Headless Chromium draws in software: the frames are slow, the positions
// are what is checked, and the shots are what it looked like.

import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [world = 'hoth'] = process.argv.slice(2);
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const out = process.env.OUT ?? 'docs/superpowers/evidence/bf2017-physics/p1';
const angle = process.env.ANGLE ?? 'swiftshader'; // (d3d11, metal or vulkan: the machine's graphics chip, frames fast enough to walk on)
const levelWait = Number(process.env.LEVEL_WAIT ?? 20000);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', `--use-angle=${angle}`, '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' }); // (reduced motion: on foot at once, no landing)
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-galaxy-panel', JSON.stringify('tucked'));
  window.sessionStorage.setItem('tp-galaxy-intro', '1');
  window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
  window.performance.setResourceTimingBufferSize(100000); // (so three's URL is still in the list when the course is drawn)
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${base}/?debug&quality=high&calibrate=off#/galaxy/${world}/surface`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => Boolean(window.__surfaceScene?.renderer && window.__surfaceDo), null, { timeout: 240000 });
const debug = () =>
  page.evaluate(() => {
    try {
      return window.__surfaceDo('debug');
    } catch (e) {
      return { error: String(e.stack) };
    }
  });
// (reduced motion: on foot at once, no landing to skip)
await page.waitForFunction(() => { try { return window.__surfaceDo('debug')?.phase === 'walk'; } catch { return false; } }, null, { timeout: 60000 }).catch(async () => {
  console.error(`never on foot: ${JSON.stringify(await debug().then((d) => ({ phase: d?.phase, riding: d?.riding, error: d?.error })))}; errors: ${errors.slice(0, 5).join(' | ')}`);
  process.exit(1);
});

// the level's own engine, if it hands one over; else the fixture course
let source = 'level';
if (process.env.FIXTURE) source = 'fixture';
else await page.waitForFunction(() => window.__surfaceDo('debug')?.body?.ready, null, { timeout: levelWait }).catch(() => (source = 'fixture'));

// the course's lanes, side by side along x from where you stand, each run along +z
const first = await debug();
if (!first?.you) {
  console.error(`no player to read: ${first?.error ?? JSON.stringify(first)}`);
  process.exit(1);
}
const at = first.you;
const O = { x: at.x, y: at.y, z: at.z };
const LANES = { wall: -6, step: -2, crate: 2, beam: 6 };
if (source === 'fixture') {
  await page.evaluate(
    async ({ O, LANES }) => {
      const { createPhysics } = await import('/src/lib/physics/world.js');
      const p = await createPhysics({ gravity: -15.5 });
      // (drawn too, for the shots: three as the page loaded it, the same module)
      const url = performance.getEntriesByType('resource').find((e) => /\/deps\/three\.js/.test(e.name))?.name;
      const THREE = url ? await import(url) : null;
      const scene = window.__surfaceScene.scene;
      const box = (x, y, z, hx, hy, hz, group = 'object') => {
        p.add({ type: 'fixed', position: [O.x + x, O.y + y, O.z + z], group, colliders: [{ shape: 'cuboid', args: [hx, hy, hz] }] });
        if (!THREE || group === 'floor') return;
        const m = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.55 }));
        m.position.set(O.x + x, O.y + y, O.z + z);
        scene.add(m);
      };
      box(0, -0.5, 0, 40, 0.5, 40, 'floor');
      box(LANES.wall, 0.25, 8, 1, 0.25, 5);
      box(LANES.step, 0.2, 8, 1, 0.2, 6);
      box(LANES.crate, 0.45, 4, 0.8, 0.45, 0.8);
      box(LANES.beam, 1.3 + 0.2, 5, 1, 0.2, 0.5);
      window.__physicsCheck = p;
      await window.__surfaceDo('usePhysics', p);
    },
    { O, LANES },
  );
  await page.waitForFunction(() => window.__surfaceDo('debug')?.body?.ready, null, { timeout: 20000 });
}

const frames = []; // (frames drawn in each hold: software GL is slow)
// (the page focused, for the keys)
await page.mouse.click(640, 300);
await page.keyboard.press('Escape');
// put you at a lane's start, facing +z (the camera too: forward is +z)
async function startAt(lane) {
  await page.evaluate(({ x, z }) => window.__surfaceDo('teleport', x, z, 0, null), { x: O.x + LANES[lane], z: O.z });
  await page.waitForTimeout(800);
}
// keys held a while: where you were as they were let go
async function hold(keys, ms) {
  const f0 = (await debug()).frames;
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  const seen = await you();
  for (const k of [...keys].reverse()) await page.keyboard.up(k);
  await page.waitForTimeout(300);
  frames.push((await debug()).frames - f0);
  return seen;
}
const you = async () => {
  const d = await debug();
  if (!d?.you) throw new Error(`the scene would not say where you are: ${d?.error ?? JSON.stringify(d)}`);
  return { x: +(d.you.x - O.x).toFixed(3), y: +(d.you.y - O.y).toFixed(3), z: +(d.you.z - O.z).toFixed(3), grounded: d.you.grounded, pose: d.body?.pose ?? null };
};
const shot = (name) => page.screenshot({ path: join(out, `${world}-${name}.jpg`), type: 'jpeg', quality: 72 });

const checks = [];
const check = (name, ok, seen) => checks.push({ name, ok: Boolean(ok), seen });

await startAt('wall');
await hold(['KeyW'], 2500);
const wall = await you();
check('a 0.5 m wall holds you', wall.z < 3 && wall.z > 1.5 && wall.y < 0.1, wall);
await shot('wall');

await startAt('step');
await hold(['KeyW'], 2500);
const step = await you();
check('a 0.4 m step is climbed', step.y > 0.3 && step.z > 3, step);
await shot('step');

await startAt('crate');
// (walking at it, the jump pressed 1.5 m short of its face, by where you are, not by the clock)
await page.keyboard.down('KeyW');
for (let i = 0; i < 100 && (await you()).z < 1.5; i++) await page.waitForTimeout(20);
await page.keyboard.press('Space');
for (let i = 0; i < 60 && !((await you()).y > 0.8); i++) await page.waitForTimeout(20);
await page.keyboard.up('KeyW');
await page.waitForTimeout(900);
const crate = await you();
check('a jump lands you on the 0.9 m crate', crate.y > 0.8 && crate.grounded, crate);
await shot('crate');

await startAt('beam');
await hold(['KeyW'], 2500);
const standing = await you();
check('standing, the 1.3 m beam stops you', standing.z < 4.5, standing);
await startAt('beam');
await hold(['KeyZ'], 600);
const crouched = await hold(['KeyZ', 'KeyW'], 2500);
check('crouched, you pass under it', crouched.z > 5.5 && crouched.pose === 'crouch', crouched);
await shot('beam');

const report = { world, source, at: O, checks, frames, errors, angle, note: 'positions are checked; the shots are what it looked like (in software GL the frames are too few to walk on: run it on a graphics chip, ANGLE=d3d11)' };
writeFileSync(join(out, `${world}.json`), `${JSON.stringify(report, null, 2)}\n`);
for (const c of checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name} ${JSON.stringify(c.seen)}`);
console.log(`source: ${source}; frames per hold: ${frames.join(', ')}; errors: ${errors.length}`);
await browser.close();
process.exit(checks.every((c) => c.ok) ? 0 : 1);
