/* global window, document, getComputedStyle */
// Screenshots of Dimension C-137 (#/c-137) from where Morty stands, for
// checking how a place looks. Morty is sent to each view through the dev
// hook, the way a door sends him (window.__C137__.goto: a place that loads
// when it's entered is built first), and each shot waits till nothing's
// still loading (__C137__.ready()) and a few frames have been drawn. With
// the dev server up:
//
//   OUT=<dir> node scripts/c137-shots.mjs [name …]
//
// One PNG a view, <OUT>/<name>.png, of the world without its HUD (HUD=1
// keeps it). BASE sets the dev server (default http://127.0.0.1:5197),
// CHROME the browser (else the sandbox's Chromium, else a local Edge or
// Chrome), W and H the window (1280 × 720), FRAMES how many frames to wait
// once it's ready. Headless browsers draw in software (SwiftShader), slowly:
// the first view waits for the whole world to build.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5197';
const OUT = process.env.OUT ?? '.';
const W = Number(process.env.W ?? 1280);
const H = Number(process.env.H ?? 720);
const FRAMES = Number(process.env.FRAMES ?? 12);
const N = Math.PI / 2; // facing north (rules.js: a heading turns +x round to (cos face, -sin face))

// Where Morty stands for each view, as rules.js measures it: the area, and
// [x, z, face]. The camera is where the game puts it, behind him, unless
// `cam` swings it round as a drag would: [turn (radians, from behind him),
// pitch (the game's is 0.17; up to 0.95)].
// (Indoors the game's camera sits 3.6 m back and is pulled in at a wall, so
// in the small rooms Morty stands where there's room behind him, and the
// camera looks down over his head.)
export const VIEWS = {
  // just in from the garage door, looking across the worktable: the portal, Portal panic, the hatch and Rick at his bench
  garage: { area: 'garage', at: [-299.4, 104.2, 1.85], cam: [0, 0.3] },
  // in the den's doorway, looking across the living room: Jerry on the couch, and Beth in the kitchen beyond
  living: { area: 'house', at: [-297.8, -6.6, -2.3], cam: [0.35, 0.3] },
  // just inside the door: Summer, her bed and her desk
  summer: { area: 'upstairs', at: [-301.4, 398.4, 2.6], cam: [0, 0.35] },
  // at the foot of the ladder, looking down the clone lab
  basement: { area: 'basement', at: [-300, 508, N] },
  // on the sidewalk at the foot of the front walk, the house and the garage ahead
  street: { area: 'street', at: [-8, -4, N] },
};

const names = process.argv.slice(2);
for (const n of names) if (!VIEWS[n]) throw new Error(`no view ${n} (there are ${Object.keys(VIEWS).join(', ')})`);
mkdirSync(OUT, { recursive: true });

const exe = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"home"');
  window.localStorage.setItem('tp-worlds', '"load"'); // (a software browser is asked before the 3D downloads: always load)
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
// (a file that won't load, by its address: the console's own line doesn't say which)
page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text()));
page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
await page.goto(`${BASE}/#/c-137`, { waitUntil: 'domcontentloaded' });
// the hook's there once the world's built; if it couldn't start, the page shows cards instead
await page.waitForFunction(() => window.__C137__?.goto || document.querySelector('.rm-world')?.dataset.mode === 'cards', null, { timeout: 600000, polling: 1000 });
if (!(await page.evaluate(() => Boolean(window.__C137__?.goto)))) throw new Error(`the 3D world didn't start (${errors.slice(0, 3).join('; ') || 'no errors'})`);
// the world at the top of the window, under the nav (it only draws while it's on screen)
await page.evaluate(() => document.querySelector('.rm-world')?.scrollIntoView({ block: 'start' }));
if (!process.env.HUD) await page.addStyleTag({ content: '.rm-world-stage > :not(.rm-world-canvas), .guide-btn, .guide-nudge { visibility: hidden !important; }' });

for (const name of names.length ? names : Object.keys(VIEWS)) {
  const { area, at, cam } = VIEWS[name];
  await page.waitForFunction(() => window.__C137__.ready(), null, { timeout: 300000, polling: 250 });
  if (!(await page.evaluate(([a, x, z, f]) => window.__C137__.goto(a, x, z, f), [area, ...at]))) throw new Error(`${name}: Morty wouldn't go`);
  await page.waitForFunction(() => window.__C137__.ready(), null, { timeout: 300000, polling: 250 });
  if (cam)
    await page.evaluate(([turn, pitch]) => {
      const s = window.__C137__.sim;
      s.yaw += turn;
      s.pitch = pitch;
      s.dragAt = s.t;
    }, cam);
  // a few frames drawn there (the camera settled, the figures posed), and the door's fade gone
  const f0 = await page.evaluate(() => window.__C137__.sim.frame);
  await page.waitForFunction((f) => window.__C137__.sim.frame >= f, f0 + FRAMES, { timeout: 120000, polling: 100 });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.rm-fade')).opacity === '0', null, { timeout: 10000 });
  await page.locator('.rm-world-canvas').screenshot({ path: `${OUT}/${name}.png`, timeout: 120000 });
  console.log(`${OUT}/${name}.png`);
}
if (errors.length) console.log('errors', errors.slice(0, 8));
await browser.close();
