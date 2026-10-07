/* global window */
// A browser check of Rick's cruiser's portal jump (lib/three/portalGate.js),
// on the universe map and in the galaxy: loads the page with the cruiser,
// waits for the ship, then jumps it somewhere with the page's clock under
// Playwright's control, and takes a frame every STEP ms through the whole
// jump (the shot out ahead, the gate opening, the cruiser flying into it,
// the page's portal wiping in, the vortex, the hole opening on the exit
// gate, the cruiser coming out, the gate shutting, the camera back behind
// it), so the frames are the same however slow the machine draws them.
// With the dev server up (npx vite --port 5188):
//   OUT=/tmp/shots node scripts/portal-check.mjs [universe|galaxy] [to]
//   STEP=150 (ms of the page's clock between frames) END=3800
// Exit code 1 on a page error or a console error that isn't noise.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const where = process.argv[2] ?? 'universe';
const out = process.env.OUT ?? '.';
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const step = Number(process.env.STEP ?? 150);
const end = Number(process.env.END ?? 3800);
const NOISE = [/WebSocket|wss:\/\/|relay|nostr/i, /net::ERR_|Failed to load resource/i, /SwiftShader|software WebGL|GPU stall|GL Driver Message|Automatic fallback|WebGL: too many errors/i, /AudioContext was not allowed/i, /\[vite\]|preload/i];
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-universe-ship', JSON.stringify('cruiser'));
  window.localStorage.setItem('tp:universe-seat', JSON.stringify('chase'));
  window.sessionStorage.setItem('tp-galaxy-intro', '1');
});
const page = await ctx.newPage();
await page.clock.install();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !NOISE.some((n) => n.test(m.text())) && errors.push(m.text()));
const t0 = Date.now();
await page.goto(`${base}/?quality=high#/${where === 'galaxy' ? 'galaxy/tatooine' : 'universe'}`, { waitUntil: 'domcontentloaded' });
await page.clock.resume();
const ready = where === 'galaxy' ? () => Boolean(window.__galaxy?.()?.ship) : () => Boolean(window.__universe?.()?.ship);
await page.waitForFunction(ready, null, { timeout: 600000, polling: 1000 }).catch(() => errors.push('the ship never came up'));
console.log(`${where}: ship up in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
await page.waitForTimeout(4000);
// (a first frame, with time to draw it: on software WebGL the first after the page loads can take minutes)
await page.screenshot({ path: `${out}/portal-${where}-first.png`, timeout: 600000 });
// (the galaxy brings the ship in to the system with a jump's way out first: a jump can't start till it's done)
if (where === 'galaxy') await page.waitForFunction(() => !window.__galaxy()?.jump, null, { timeout: 120000, polling: 500 }).catch(() => errors.push('still arriving'));
const to = process.argv[3] ?? (where === 'galaxy' ? 'naboo' : await page.evaluate(() => window.__universeDebug.positions().find((id) => id !== window.__universe().at && id !== 'home') ?? 'starwars'));
// (the page's clock stopped first: on a slow machine a round trip into the page is a good part of the jump)
// (well ahead: the clock runs on while the call comes back, the more so on a heavy page)
const pause = async () => {
  for (let ahead = 4000; ; ahead *= 2) {
    try {
      return await page.clock.pauseAt((await page.evaluate(() => Date.now())) + ahead);
    } catch (e) {
      if (ahead > 60000 || !/past/.test(String(e))) throw e;
    }
  }
};
await pause();
if (where === 'galaxy') {
  // (the galaxy comes round onto the course first: stepped through, the jump proper starts at its spool)
  console.log(`jump to ${to}: ${await page.evaluate((id) => window.__galaxyDebug.startJump(id), to)}`);
  for (let i = 0; i < 120 && (await page.evaluate(() => window.__galaxy()?.jump?.phase === 'align')); i++) await page.clock.runFor(50);
} else console.log(`jump to ${to}: ${await page.evaluate((id) => window.__universeDebug.travel(id, 'hyper'), to)}`);
for (let t = 0; t <= end; t += step) {
  await page.screenshot({ path: `${out}/portal-${where}-${String(t).padStart(4, '0')}.png`, timeout: 300000 });
  const s = await page.evaluate(() => (window.__galaxy ? window.__galaxy()?.jump : window.__universeDebug?.state?.portal && { phase: window.__universeDebug.state.portal.phase, off: window.__universeDebug.state.portal.off }));
  console.log(t, JSON.stringify(s));
  // (the galaxy holds its tunnel till the next system's built: let it)
  if (where === 'galaxy' && (await page.evaluate(() => window.__galaxy()?.jump?.phase === 'tunnel'))) {
    await page.clock.resume();
    await page.waitForFunction(() => window.__galaxy()?.jump?.phase !== 'tunnel', null, { timeout: 300000, polling: 200 }).catch(() => errors.push('stuck in the tunnel'));
    await pause();
  }
  await page.clock.runFor(step);
}
console.log(errors.length ? `ERRORS:\n${errors.slice(0, 8).join('\n')}` : 'no errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
