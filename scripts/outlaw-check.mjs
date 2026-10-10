/* global window, document */
// A browser check of the harder hunters (hunterRules.js's skills and new
// traits, difficulty.js): starts Vite in-process, opens the universe map in
// Chromium (CHROME, or Playwright's own), sends a pack with a missile boat
// and a repair shuttle at the X-wing on the chosen difficulty, and looks:
// they fly at the difficulty's skill, the missile boat fires missiles, the
// flight settings show the difficulty. OUT=dir for the screenshots.
//   OUT=/tmp/shots node scripts/outlaw-check.mjs [hard]
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const out = process.env.OUT ?? '.';
const level = process.argv[2] ?? 'hard';
const server = await createServer({ server: { port: 0, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const port = server.httpServer.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--use-angle=metal', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--ignore-gpu-blocklist'] });
const problems = [];
const errors = [];
const check = (ok, what) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) problems.push(what);
};
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript((lvl) => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-3d', 'on');
    window.localStorage.setItem('tp-sound', 'off');
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-universe-ship', '"xwing"');
    window.localStorage.setItem('tp-universe-controls', JSON.stringify({ difficulty: lvl }));
  }, level);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`http://localhost:${port}/#/universe`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship && window.__universeDebug?.hunters, null, { timeout: 180000 });
  await page.waitForTimeout(2000);
  const dbg = (fn, arg) => page.evaluate(fn, arg);
  // a pack with the new kinds in it, after you
  await dbg(() => {
    const d = window.__universeDebug;
    d.state.ship.speed = 5.5;
    d.hunters.pack('empire', d.state.ship, { kinds: ['missileboat', 'repairshuttle', 'tie', 'interceptor'], heat: 0 });
  });
  const packs = await dbg(() => window.__universeDebug.hunters.packs);
  check(packs.length === 1 && packs[0].alive.includes('missileboat') && packs[0].alive.includes('repairshuttle'), `the pack came: ${JSON.stringify(packs[0]?.alive)}`);
  const want = { story: 'rookie', normal: 'regular', hard: 'veteran', outlaw: 'elite' }[level];
  check(['rookie', 'regular', 'veteran', 'elite'].indexOf(packs[0]?.skill) >= ['rookie', 'regular', 'veteran', 'elite'].indexOf(want), `they fly at the ${level} skill or better: ${packs[0]?.skill}`);
  // watch a while for a missile in the air
  let missile = false;
  for (let i = 0; i < 60 && !missile; i++) {
    await page.waitForTimeout(500);
    missile = await dbg(() => window.__universeDebug.hunters.packs.length > 0 && Boolean(window.__universeDebug.state.missileSaid));
  }
  check(missile, 'the missile boat fired a missile at you');
  await page.screenshot({ path: `${out}/outlaw-fight.png` });
  // the flight settings show the difficulty
  await page.keyboard.press('o');
  await page.waitForTimeout(400);
  const seg = await dbg(() => [...document.querySelectorAll('.universe-settings fieldset')].find((f) => f.textContent.includes('Difficulty'))?.querySelector('[aria-pressed="true"]')?.textContent ?? null);
  check(seg && seg.toLowerCase() === level, `the settings show ${level}: ${seg}`);
  await page.screenshot({ path: `${out}/outlaw-settings.png` });
  check(errors.length === 0, `no errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
if (problems.length) process.exitCode = 1;
