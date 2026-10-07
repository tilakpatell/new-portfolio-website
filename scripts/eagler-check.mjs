/* global window, document */
// A browser check of Minecraft behind the password (src/components/eagler/):
// with the dev server up,
//   EAGLER_PASSWORD=… OUT=<folder> node scripts/eagler-check.mjs [1.12.2]
// It opens #/dot-matrix/minecraft, tries a wrong password (it must be
// refused), unlocks, plays the client named (the first by default), waits for
// the game's title screen to draw, screenshots it, and fails on any page
// error. On Windows set CHROME to Edge, and GPU=1 to draw on the graphics chip.
import { chromium } from 'playwright-core';

const out = process.env.OUT ?? '.';
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const password = process.env.EAGLER_PASSWORD;
const want = process.argv[2] ?? null;
if (!password) {
  console.error('set EAGLER_PASSWORD');
  process.exit(2);
}
const gpu = process.env.GPU === '1';
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium',
  args: gpu ? ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=default', '--autoplay-policy=no-user-gesture-required'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: Number(process.env.W ?? 1280), height: Number(process.env.H ?? 760) } });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-guide-seen', JSON.stringify(['/dot-matrix/minecraft']));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
// (a public LAN relay being down is the relay's trouble, not the page's: noted, not failed)
const notes = [];
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text().slice(0, 300);
  if (t.includes("WebSocket connection to 'wss://relay.")) notes.push(t);
  // (the game page's own autofocus, ignored in a cross-origin frame; the site focuses the frame itself)
  else if (t.startsWith('Blocked autofocusing')) return;
  else errors.push(t);
});

await page.goto(`${base}/#/dot-matrix/minecraft`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[type=password]', { timeout: 120000 });
await page.screenshot({ path: `${out}/eg-locked.png` });

// a wrong password is refused
await page.fill('input[type=password]', 'not-the-password');
await page.click('button[type=submit]');
await page.waitForSelector('.eg-error', { timeout: 60000 });
console.log('wrong password:', await page.textContent('.eg-error'));

await page.fill('input[type=password]', password);
await page.click('button[type=submit]');
await page.waitForSelector('text=Play Minecraft', { timeout: 60000 });
await page.screenshot({ path: `${out}/eg-menu.png` });
const label = want ? `Play Minecraft ${want}` : null;
const t0 = Date.now();
if (label) await page.click(`text=${label}`);
else await page.locator('text=Play Minecraft').first().click();
await page.waitForSelector('iframe.eg-frame', { timeout: 300000 });
console.log(`opened in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// the game in the player's frame (an origin of its own): wait for its canvas, then for the title screen to draw
const frame = page.frameLocator('iframe.eg-frame');
await frame.locator('canvas').first().waitFor({ timeout: 180000 });
await page.waitForTimeout(Number(process.env.WAIT ?? 15000));
await page.screenshot({ path: `${out}/eg-game.png` });
const game = page.frames().find((f) => f !== page.mainFrame() && f.url().startsWith('blob:'));
if (!game) errors.push('the game is not running in the player');
const info = game
  ? await game.evaluate(() => {
      const c = document.querySelector('canvas');
      // walled off: the site's page and its storage out of reach
      let reach = 'none';
      try {
        reach = window.parent.document.title;
      } catch {
        reach = 'none';
      }
      return { canvas: c ? [c.width, c.height] : null, title: document.title, origin: window.location.origin, site: window.parent === window ? 'top' : 'framed', siteReach: reach, siteKey: window.localStorage.getItem('tp-mc-key') };
    })
  : null;
console.log('game:', JSON.stringify(info));
const siteOrigin = new URL(base).origin;
if (info && (info.origin === siteOrigin || info.siteReach !== 'none' || info.siteKey)) errors.push(`the game is not walled off from the site: ${JSON.stringify(info)}`);
const stored = await page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.startsWith('tp-mc')));
console.log('kept:', stored.join(', '));

if (notes.length) console.log(`relays: ${notes.length} down (${[...new Set(notes.map((n) => n.split("'")[1]))].join(', ')})`);
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
