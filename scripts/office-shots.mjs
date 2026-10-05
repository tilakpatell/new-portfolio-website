/* global window, document */
// Screenshots of the walkable office (/scranton) from fixed cameras, for
// checking how it looks. With the dev server up (npx vite --port 5173):
//   OUT=/tmp/shots node scripts/office-shots.mjs [quality] [name…]
// Headless Chromium draws in software (SwiftShader), slowly: each shot
// waits for a few frames to land. Cameras are set through the dev hook
// (window.__OFFICE__.sim.debugCam).
import { chromium } from 'playwright-core';

const out = process.env.OUT ?? '.';
const quality = process.argv[2] ?? 'high';
const only = process.argv.slice(3);
const W = Number(process.env.W ?? 960);
const H = Number(process.env.H ?? 540);
export const VIEWS = {
  bullpen: { at: [0.6, 1.75, 2.9], look: [-6, 1.0, -2] },
  reception: { at: [-6.4, 1.7, -3.2], look: [-9.6, 1.0, -1.4] },
  lobby: { at: [-14.1, 1.7, -5.7], look: [-10.4, 1.4, -7.4] },
  michael: { at: [-4.9, 1.7, -4.5], look: [-7.6, 1.0, -7.2] },
  conference: { at: [1.0, 1.7, -4.5], look: [-3, 0.9, -6.6] },
  kitchen: { at: [2.0, 1.7, -1.4], look: [8, 1.0, -2] },
  annex: { at: [9.3, 1.7, 3.2], look: [13, 1.0, -3] },
  warehouse: { at: [31, 2.6, -6.5], look: [44, 1.2, 3] },
  lot: { at: [57, 2.2, -12], look: [70, 1.0, 0] },
  counter: { at: [2.9, 1.55, -0.75], look: [2.5, 0.6, -2.5] },
};
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"home"');
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => (m.type() === 'error' ? errors.push(m.text()) : m.text().startsWith('office:') && console.log(m.text())));
await page.goto(`http://localhost:5173/?quality=${quality}#/scranton`, { waitUntil: 'domcontentloaded' });
// a weak device is asked before the world downloads: say yes
await page.waitForFunction(
  () => {
    const yes = [...document.querySelectorAll('#office-world button')].find((b) => b.textContent.trim() === 'Load the 3D');
    yes?.click();
    return window.__OFFICE__?.api?.ready;
  },
  null,
  { timeout: 240000, polling: 1000 },
);
await page.waitForTimeout(Number(process.env.SETTLE ?? 8000));
// PRE: a function body run in the page first (window.__OFFICE__ is there), for probing
if (process.env.PRE) console.log('pre', JSON.stringify(await page.evaluate(new Function(`return (async () => { ${process.env.PRE} })()`)), null, 0));
const info = await page.evaluate(() => window.__OFFICE__.api.info());
console.log('info', JSON.stringify(info));
const names = only.length ? only : Object.keys(VIEWS);
for (const name of names) {
  const v = name === 'jim' ? null : VIEWS[name];
  await page.evaluate((cam) => {
    window.__OFFICE__.sim.debugCam = cam;
  }, v);
  await page.waitForTimeout(Number(process.env.WAIT ?? 5000));
  await page.locator('#office-world canvas').first().screenshot({ path: `${out}/${name}.png`, timeout: 180000 });
  console.log('shot', name);
}
const logs = await page.evaluate(() => window.__officeLog ?? null);
if (logs) console.log(logs);
console.log('errors', errors.slice(0, 8));
// and all of them on one sheet
if (names.length > 1) {
  const sharp = (await import('sharp')).default;
  const w = 640;
  const h = Math.round((w * H) / W);
  const comps = await Promise.all(names.map(async (n, i) => ({ input: await sharp(`${out}/${n}.png`).resize(w, h).toBuffer(), left: (i % 2) * w, top: Math.floor(i / 2) * h })));
  await sharp({ create: { width: w * 2, height: h * Math.ceil(names.length / 2), channels: 3, background: '#000' } }).composite(comps).png().toFile(`${out}/sheet.png`);
}
await browser.close();
