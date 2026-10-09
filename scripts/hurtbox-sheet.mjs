/* global window */
// A picture of the hurtboxes over a galaxy world's hostiles, for the eye:
// the world opened in headless Chromium (software WebGL), a quest begun so
// its figures come out, their hurtboxes drawn as wire (the scene's
// hurtboxes(true) dev hook: lib/three/combat/hitboxRig.js's debug), the
// view held on them, and a screenshot saved, with what the physics world
// counted that frame. Through the dev server (npx vite --port 5188).
//
//   OUT=docs/superpowers/evidence/rapier-body node scripts/hurtbox-sheet.mjs [world] [quest]
//   QUALITY=mid …  (the device tier)
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [world = 'tatooine', quest = null] = process.argv.slice(2);
const out = process.env.OUT ?? 'docs/superpowers/evidence/rapier-body';
const quality = process.env.QUALITY ?? 'mid';
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => {
  localStorage.setItem('tp-intro', '1');
  localStorage.setItem('tp-start', '"universe"');
  localStorage.setItem('tp-universe-ship', '"xwing"');
  localStorage.setItem('tp-galaxy-panel', '"tucked"');
  sessionStorage.setItem('tp-galaxy-intro', '1');
  localStorage.setItem('tp-worlds', JSON.stringify('load'));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${base}/?quality=${quality}&debug#/galaxy/${world}/surface`, { waitUntil: 'load' });
// (the ship comes down: the landing advanced, as surface-shot.mjs does, until you're on foot)
await page.waitForFunction(() => window.__surface?.()?.phase, null, { timeout: 180000 });
await page.waitForTimeout(3000);
for (let i = 0; i < 6 && (await page.evaluate(() => window.__surfaceScene?.you?.().phase)) !== 'walk'; i++) {
  await page.evaluate(() => window.__surfaceDo?.('advance', 30));
  await page.waitForTimeout(2000);
}
await page.waitForFunction(() => window.__surfaceScene?.you?.().phase === 'walk', null, { timeout: 60000 });
const id = await page.evaluate((q) => window.__surfaceScene.quest(q), quest);
if (!id) throw new Error(`no quest on ${world}`);
// (its figures load; wait for one rigged, or for any after a while)
await page.waitForFunction(() => (window.__surfaceScene.physics()?.figures ?? []).some((f) => f.rigged), null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(1500);
const phys = await page.evaluate(() => window.__surfaceScene.physics());
const figures = phys.figures.filter((f) => f.at);
if (!figures.length) throw new Error(`no figures came out of quest ${id} on ${world}`);
// you set down 6 m from the first figure (a figure far from you sleeps, its rig
// with it), then the view from 5 m off it, looking at its chest
const [fx, fz] = figures[0].at;
const you = await page.evaluate(() => window.__surfaceScene.you());
const dx = you.x - fx;
const dz = you.z - fz;
const d = Math.hypot(dx, dz) || 1;
await page.evaluate(([x, z]) => window.__surfaceScene.put(x, z), [fx + (dx / d) * 6, fz + (dz / d) * 6]);
await page.waitForTimeout(1500);
const drawn = await page.evaluate(() => window.__surfaceScene.hurtboxes(true));
await page.evaluate(([from, at]) => window.__surfaceScene.view(from, at), [[fx + (dx / d) * 5, 1.6, fz + (dz / d) * 5], [fx, 1.1, fz]]);
await page.waitForTimeout(1500);
const file = join(out, `hurtboxes-${world}.jpg`);
await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
await page.evaluate(() => window.__surfaceScene.hurtboxes(false));
const after = await page.evaluate(() => window.__surfaceScene.physics());
writeFileSync(join(out, `hurtboxes-${world}.json`), JSON.stringify({ world, quest: id, quality, rigs: drawn, figures, physics: { rays: after.rays, sweeps: after.sweeps, bolts: after.bolts, bodies: after.bodies, substeps: after.substeps }, errors }, null, 2));
console.log(`${file}: ${drawn} rig(s) drawn over ${figures.length} figure(s); ${errors.length} page error(s)`);
await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
