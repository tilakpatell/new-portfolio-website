/* global localStorage */ // (used inside page.evaluate, in the browser)
/* global window, document */
// A browser check of the universe nav map (NavMap.jsx): opens it, picks a
// world, flies there at super speed, jumps to a wonder, then the phone layout.
// Needs the dev server (npx vite --port 5173) and Chrome; screenshots go to $OUT.
//   OUT=/tmp/shots node scripts/navmap-check.mjs
import { chromium } from 'playwright-core';
const out = process.env.OUT;
const browser = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  localStorage.setItem('tp-intro', '1');
  localStorage.setItem('tp-start', '"universe"');
  localStorage.setItem('tp-universe-ship', '"falcon"');
  localStorage.setItem('tp-universe-panel', '"open"');
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:5173/?quality=low#/universe', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 90000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}/1-map.png` });
// the map button
await page.evaluate((sel) => { const el = sel.includes('>> nth=') ? document.querySelectorAll(sel.split(' >> ')[0])[+sel.split('nth=')[1]] : document.querySelector(sel); if (!el) throw new Error('no ' + sel); el.click(); }, '.universe-navmap-btn');
await page.waitForSelector('.navmap', { timeout: 40000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/2-navmap.png` });
// pick Avengers HQ
await page.evaluate((sel) => { const el = sel.includes('>> nth=') ? document.querySelectorAll(sel.split(' >> ')[0])[+sel.split('nth=')[1]] : document.querySelector(sel); if (!el) throw new Error('no ' + sel); el.click(); }, '.navmap-places button[aria-label^="Avengers HQ"]');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/3-picked.png` });
const times = await page.$$eval('.navmap-drive-time', (els) => els.map((e) => e.textContent));
console.log('times', times);
// super speed, go
await page.evaluate((sel) => { const el = sel.includes('>> nth=') ? document.querySelectorAll(sel.split(' >> ')[0])[+sel.split('nth=')[1]] : document.querySelector(sel); if (!el) throw new Error('no ' + sel); el.click(); }, '.navmap-drive[data-drive="super"]');
await page.evaluate((sel) => { const el = sel.includes('>> nth=') ? document.querySelectorAll(sel.split(' >> ')[0])[+sel.split('nth=')[1]] : document.querySelector(sel); if (!el) throw new Error('no ' + sel); el.click(); }, '.navmap-go');
await page.waitForTimeout(500);
const t0 = Date.now();
let s;
for (let i = 0; i < 12; i++) {
  s = await page.evaluate(() => { const u = window.__universe(); return { at: u.at, auto: u.auto, speed: u.ship?.speed }; });
  if (i % 5 === 0) console.log('t', ((Date.now() - t0) / 1000).toFixed(1), JSON.stringify(s));
  if (s.at === 'marvel' && !s.auto) break;
  await page.waitForTimeout(1000);
}
console.log('arrived?', JSON.stringify(s), 'url', page.url());
await page.screenshot({ path: `${out}/4-arrived.png` });
// hyperspeed to the Citadel (a wonder), by the nav map
await page.keyboard.press('m');
await page.waitForSelector('.navmap', { timeout: 40000 });
await page.evaluate(() => { const i = document.querySelector('.navmap-search input'); i.focus(); });
await page.keyboard.type('citadel');
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
await page.evaluate((sel) => { const el = sel.includes('>> nth=') ? document.querySelectorAll(sel.split(' >> ')[0])[+sel.split('nth=')[1]] : document.querySelector(sel); if (!el) throw new Error('no ' + sel); el.click(); }, '.navmap-drive[data-drive="hyper"]');
await page.screenshot({ path: `${out}/5-hyper-pick.png` });
await page.evaluate((sel) => { const el = sel.includes('>> nth=') ? document.querySelectorAll(sel.split(' >> ')[0])[+sel.split('nth=')[1]] : document.querySelector(sel); if (!el) throw new Error('no ' + sel); el.click(); }, '.navmap-go');
await page.waitForTimeout(900);
console.log('overlay', await page.evaluate(() => !!document.querySelector('.hyperspace-canvas, [class*=hyperspace]')));
await page.screenshot({ path: `${out}/6-jumping.png` });
await page.waitForTimeout(3500);
const after = await page.evaluate(() => { const u = window.__universe(); return { ship: u.ship && { x: Math.round(u.ship.x), z: Math.round(u.ship.z) }, auto: u.auto }; });
console.log('after jump', JSON.stringify(after));
await page.screenshot({ path: `${out}/7-after-jump.png` });
// the map again: hyperdrive charging
await page.keyboard.press('m');
await page.waitForSelector('.navmap', { timeout: 40000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/8-charging.png` });
const status = await page.$eval('.navmap-status', (e) => e.innerText);
console.log('status', status.replace(/\n/g, ' | '));
// home system view
await page.evaluate((sel) => { const el = sel.includes('>> nth=') ? document.querySelectorAll(sel.split(' >> ')[0])[+sel.split('nth=')[1]] : document.querySelector(sel); if (!el) throw new Error('no ' + sel); el.click(); }, '.navmap-views button:nth-child(2)');
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/9-home.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
console.log('closed by escape', (await page.$('.navmap')) === null);
// phone
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
await phone.addInitScript(() => { localStorage.setItem('tp-intro', '1'); localStorage.setItem('tp-start', '"universe"'); localStorage.setItem('tp-universe-ship', '"xwing"'); });
const p2 = await phone.newPage();
p2.on('pageerror', (e) => errors.push('phone: ' + String(e)));
await p2.goto('http://localhost:5173/?quality=low#/universe', { waitUntil: 'domcontentloaded' });
await p2.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 90000 });
await p2.waitForTimeout(2500);
await p2.screenshot({ path: `${out}/10-phone-map.png`, timeout: 90000 });
await p2.evaluate((sel) => { const el = sel.includes('>> nth=') ? document.querySelectorAll(sel.split(' >> ')[0])[+sel.split('nth=')[1]] : document.querySelector(sel); if (!el) throw new Error('no ' + sel); el.click(); }, '.universe-navmap-btn');
await p2.waitForSelector('.navmap', { timeout: 40000 });
await p2.waitForTimeout(600);
await p2.screenshot({ path: `${out}/11-phone-navmap.png`, timeout: 90000 });
await p2.evaluate((sel) => { const el = sel.includes('>> nth=') ? document.querySelectorAll(sel.split(' >> ')[0])[+sel.split('nth=')[1]] : document.querySelector(sel); if (!el) throw new Error('no ' + sel); el.click(); }, '.navmap-list button >> nth=8');
await p2.waitForTimeout(1500);
await p2.screenshot({ path: `${out}/12-phone-picked.png`, timeout: 90000 });
console.log('errors', JSON.stringify(errors.slice(0, 10)));
await browser.close();
