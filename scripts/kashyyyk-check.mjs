/* global window */
// A browser check of a world's battle (surface/skirmish.js): loads the
// world's surface (Kashyyyk unless named), your allegiance as asked, puts
// you at each of a few stops (or switches you to the other side), lets the
// battle run, and takes a few frames at each (soldiers taking cover,
// firing, falling), reading the battle's state back each time.
// With the dev server up (npx vite --port 5188):
//   OUT=/tmp/shots node scripts/kashyyyk-check.mjs [world] [light|dark]
//   STOPS='x,z,yaw;x,z,yaw,side' (where you stand, or the side you switch to)
//   FRAMES=2 GAP=700 (frames at each stop, ms apart)
// Exit code 1 on a page error or a console error that isn't noise.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const world = process.argv[2] ?? 'kashyyyk';
const side = process.argv[3] ?? 'light';
const out = process.env.OUT ?? '.';
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const frames = Number(process.env.FRAMES ?? 2);
const gap = Number(process.env.GAP ?? 700);
const NOISE = [/WebSocket|wss:\/\/|relay|nostr/i, /net::ERR_|Failed to load resource/i, /SwiftShader|software WebGL|GPU stall|GL Driver Message|Automatic fallback|WebGL: too many errors/i, /AudioContext was not allowed/i, /\[vite\]|preload/i];
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript((a) => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-universe-ship', JSON.stringify('falcon'));
  window.localStorage.setItem('tp-galaxy-allegiance', JSON.stringify(a));
  window.sessionStorage.setItem('tp-galaxy-intro', '1');
}, side);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !NOISE.some((n) => n.test(m.text())) && errors.push(m.text()));
const t0 = Date.now();
await page.goto(`${base}/?quality=high#/galaxy/${world}/surface`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__surface?.()?.phase === 'walk', null, { timeout: 600000 }).catch(() => errors.push('the scene never got to walking'));
console.log(`${world}: scene up in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
await page.waitForFunction(() => Boolean(window.__surfaceScene?.api?.ground?.stats?.baked), null, { timeout: 150000, polling: 1000 }).catch(() => {});
// each stop: x,z,yaw[,side] (a side: the battle fought for it from there on, you at its rally point)
const STOPS = (process.env.STOPS ?? (world === 'kashyyyk' ? '42,50,0;16,64,0.9;0,0,0,sep;0,0,0,rep' : '0,0,0')).split(';').map((s) => s.split(','));
const shot = async (name) => {
  await page.screenshot({ path: `${out}/${world}-${name}.png`, timeout: 120000 });
  const v = await page.evaluate(() => window.__surfaceDo('skirmishDebug'));
  console.log(`${name}:`, JSON.stringify(v && { t: v.t, side: v.side, up: v.up, kills: v.kills, you: v.kills, atYou: v.atYou, modes: v.modes, health: v.health }));
};
// (the battle a while on, without drawing it, so it's in full swing)
await page.evaluate(() => window.__surfaceDo('advance', 15));
for (const [i, stop] of STOPS.entries()) {
  const [x, z, yaw] = stop.slice(0, 3).map(Number);
  if (stop[3]) await page.evaluate((id) => window.__surfaceDo('skirmishSide', id), stop[3]);
  else await page.evaluate(([px, pz, py]) => window.__surfaceDo('teleport', px, pz, py), [x, z, yaw]);
  await page.waitForTimeout(2500);
  for (let f = 0; f < frames; f++) {
    await shot(`${i}${stop[3] ? `-${stop[3]}` : ''}-${f}`);
    await page.waitForTimeout(gap);
  }
}
console.log(errors.length ? `ERRORS:\n${errors.slice(0, 8).join('\n')}` : 'no errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
