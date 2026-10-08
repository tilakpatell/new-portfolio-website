/* global window, document */
// A browser check of the law (wanted.js, law.js): starts Vite in-process,
// opens the universe map in Chromium (CHROME, or Playwright's own) as the
// X-wing, commits a crime the law sees, and looks: the stars and the bounty
// on the HUD, the ISB sent, the search once you're out of their sight, the
// stars gone once it runs out, the bounty still there, and what landing
// with it says. OUT=dir for the screenshots.
//   OUT=/tmp/shots node scripts/wanted-check.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const out = process.env.OUT ?? '.';
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
  await ctx.addInitScript(() => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-3d', 'on');
    window.localStorage.setItem('tp-sound', 'off');
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-universe-ship', '"xwing"');
    window.localStorage.removeItem('tp:universe-wanted');
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`http://localhost:${port}/#/universe`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship && window.__universeDebug?.law, null, { timeout: 180000 });
  await page.waitForTimeout(2000);
  const dbg = (fn, arg) => page.evaluate(fn, arg);
  const hud = () => dbg(() => {
    const el = document.querySelector('.universe-wanted');
    return el && { on: el.hasAttribute('data-on'), lit: el.querySelectorAll('i[data-lit]').length, word: el.querySelector('.universe-wanted-word')?.textContent, bounty: el.querySelector('.universe-wanted-bounty')?.textContent };
  });
  // a patrol shot down in front of the law
  await dbg(() => {
    const d = window.__universeDebug;
    d.state.ship.speed = 3;
    d.law.crime('killPatrol', d.state.ship, { seen: true });
  });
  await page.waitForTimeout(1200);
  const w1 = await dbg(() => window.__universeDebug.wanted.state());
  check(w1.stars === 2 && w1.bounty === 250 && w1.phase === 'pursuit', `wanted at two stars, 250 on you: ${JSON.stringify({ s: w1.stars, b: w1.bounty, p: w1.phase })}`);
  const h1 = await hud();
  check(h1?.on && h1.lit === 2 && /250/.test(h1.bounty ?? ''), `the HUD shows it: ${JSON.stringify(h1)}`);
  const packs = await dbg(() => window.__universeDebug.hunters.packs.filter((p) => p.faction === 'isb'));
  check(packs.length === 1 && packs[0].alive.includes('isbenforcer'), `the ISB came: ${JSON.stringify(packs.map((p) => [p.alive, p.skill]))}`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/wanted-chase.png` });
  // out of their sight: far off, quickly
  await dbg(() => {
    const d = window.__universeDebug;
    d.state.ship.x += 400;
    d.state.ship.z += 400;
  });
  await page.waitForFunction(() => window.__universeDebug.wanted.phase === 'search', null, { timeout: 20000 }).catch(() => {});
  check((await dbg(() => window.__universeDebug.wanted.phase)) === 'search', 'out of sight, they search');
  const h2 = await hud();
  check(/Searching/.test(h2?.word ?? ''), `the HUD says so: ${h2?.word}`);
  await page.screenshot({ path: `${out}/wanted-search.png` });
  await page.waitForFunction(() => window.__universeDebug.wanted.stars === 0, null, { timeout: 60000 }).catch(() => {});
  const w2 = await dbg(() => window.__universeDebug.wanted.state());
  check(w2.stars === 0 && w2.bounty === 250, `they lost you, and the bounty stays: ${JSON.stringify({ s: w2.stars, b: w2.bounty })}`);
  await page.waitForTimeout(800);
  const gone = await dbg(() => window.__universeDebug.hunters.packs.filter((p) => p.faction === 'isb' && !p.gone).length);
  check(gone === 0, 'the ISB gave up');
  // landing with it on you and an empty wallet: what's owed
  await dbg(() => window.__universeDebug.law.arrive({ credits: 0, spend: () => false }));
  const note = await dbg(() => window.__universeDebug.state.note?.text ?? '');
  check(/bounty/.test(note), `landing says what's owed: ${note}`);
  check(errors.length === 0, `no errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
if (problems.length) process.exitCode = 1;
