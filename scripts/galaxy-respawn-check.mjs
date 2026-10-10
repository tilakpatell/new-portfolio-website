/* global window, document */
// A browser check of coming back into a galaxy battle after a death
// (universe/battleHome.js, warfront.js's respawn, galaxy/scene.js's crash).
// With the dev server up (npx vite --port 5188):
//   OUT=/tmp/shots SIDE=empire node scripts/galaxy-respawn-check.mjs [quality]
// It swears to SIDE (the Rebellion unless it's said), forces a battle at
// Endor, flies you into the middle of it (so you've been in it), shoots you
// down (the page's dev hook), and once you're back checks you came in
// behind your own side's line (at battle.homeFor's point, facing the other
// side), shielded (the battle's AI fire flies through you, a "Shielded"
// chip over the cluster) and that a shot of your own ends it. Screenshots:
// respawn-<n>-<what>.png.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const out = process.env.OUT ?? '.';
const quality = process.argv[2] ?? 'mid';
const side = process.env.SIDE ?? 'rebel';
const base = process.env.BASE ?? 'http://localhost:5188';
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(out, { recursive: true });
const problems = [];
const check = (ok, what) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) problems.push(what);
};
const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-universe-ship', JSON.stringify('xwing'));
  window.localStorage.setItem('tp-galaxy-panel', JSON.stringify('tucked'));
  window.localStorage.removeItem('tp-gcw');
  window.sessionStorage.setItem('tp-galaxy-intro', '1');
  window.localStorage.setItem('tp-worlds', JSON.stringify('load')); // (the 3D, without the gate's asking)
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 200)));
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
let shot = 0;
const snap = (what) => page.screenshot({ path: `${out}/respawn-${++shot}-${what}.png` });

await page.goto(`${base}/?quality=${quality}#/galaxy`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__galaxy === 'function' && Boolean(window.__galaxy().system), null, { timeout: 300000 });
await page.waitForFunction(() => Boolean(window.__galaxyOath), null, { timeout: 60000 });
await page.evaluate((s) => window.__galaxyOath.swear(s), side);
await page.goto(`${base}/?quality=${quality}#/galaxy/endor`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__galaxy === 'function' && window.__galaxy().system === 'endor', null, { timeout: 300000 });
await page.waitForFunction(() => !window.__galaxy().jump, null, { timeout: 120000 }).catch(() => {});
await page.evaluate((s) => window.__galaxyDebug.war.force(s), side);
log('battle forced');

// into the middle of it, so you've been in it
await page.evaluate(() => {
  const d = window.__galaxyDebug;
  const at = d.war.info.laid.at;
  d.pin({ x: at[0], y: at[1] + 6, z: at[2], heading: 0, pitch: 0, bank: 0 });
});
await page.waitForFunction(() => window.__galaxyDebug.war.info.tookPart === true, null, { timeout: 60000 });
const team = await page.evaluate(() => window.__galaxyDebug.war.battle.you.team);
check(team !== null, `in the battle on a side (team ${team})`);
// shot down
await page.evaluate(() => window.__galaxyDebug.destroy());
await page.waitForFunction(() => Boolean(window.__galaxyDebug.state.crash?.back), null, { timeout: 180000 });
await page.waitForFunction(() => !window.__galaxyDebug.state.crash, null, { timeout: 180000 });
log('back');
const back = await page.evaluate(() => {
  const d = window.__galaxyDebug;
  const s = d.state.ship;
  const b = d.war.battle;
  const home = b.homeFor(b.you.team);
  const own = b.capitals.filter((c) => c.team === b.you.team && c.alive);
  const theirs = b.capitals.filter((c) => c.team !== b.you.team && c.alive);
  const near = (list) => Math.min(...list.map((c) => Math.hypot(c.pos.x - s.x, c.pos.y - s.y, c.pos.z - s.z)));
  return {
    off: Math.hypot(s.x - home.pos.x, s.y - home.pos.y, s.z - home.pos.z),
    facing: -Math.sin(s.heading) * home.fwd.x - Math.cos(s.heading) * home.fwd.z,
    nearOwn: near(own),
    nearTheirs: near(theirs),
    safe: d.state.respawnSafe && d.state.clock < d.state.safeUntil,
    chip: Boolean(document.querySelector('.fc-buff[data-kind="safe"]')),
  };
});
log(JSON.stringify(back));
await snap('back');
check(back.off < 12, `back at your side's rally point (${back.off.toFixed(1)} units off it, as the ship's moved since)`);
check(back.facing > 0.9, `facing the other side (${back.facing.toFixed(2)})`);
check(back.nearOwn < back.nearTheirs, `nearer your own fleet (${back.nearOwn.toFixed(0)}) than theirs (${back.nearTheirs.toFixed(0)})`);
check(back.safe, 'shielded');
check(back.chip, 'a "Shielded" chip over the cluster');
// a shot of your own ends it
await page.keyboard.down('f');
await page.waitForTimeout(400);
await page.keyboard.up('f');
const after = await page.evaluate(() => ({ safe: window.__galaxyDebug.state.respawnSafe }));
check(!after.safe, 'firing ends the shield');
await browser.close();
if (problems.length) {
  console.log(`\n${problems.length} problem(s)`);
  process.exit(1);
}
console.log('\nall good');
