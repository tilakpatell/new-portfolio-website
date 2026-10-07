/* global window */
// A browser check of the Galactic Civil War in the galaxy (galaxy/gcw.js,
// warfront.js, battles.js; the war table on the holotable). With the dev
// server up (npx vite --port 5188):
//   OUT=/tmp/shots node scripts/galaxy-war-check.mjs [system] [quality]
// It finds the battle on now (the major order's, unless a system's named),
// drops in there, checks the battle's at its planet and you're in it on the
// Rebels' side, looks at it from a few places, takes its objectives down
// with the battle's own hit() (as your shots would), checks the war's tally
// counted it, and opens the war table: screenshots as it goes
// (war-<n>-<what>.png).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const out = process.env.OUT ?? '.';
const quality = process.argv[3] ?? 'mid';
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
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !/GPU stall|swiftshader|WebGL/i.test(m.text()) && errors.push(m.text()));
let shot = 0;
const snap = (what) => page.screenshot({ path: `${out}/war-${shot++}-${what}.png` });

// which system: the one named, or the major order's
await page.goto(`${base}/?quality=${quality}#/galaxy`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__galaxy === 'function' && Boolean(window.__galaxy().system), null, { timeout: 180000 });
const table = await page.evaluate(async () => (await import('/src/components/galaxy/warState.js')).warNow());
const sysId = process.argv[2] ?? table.major;
const row = table.systems.find((s) => s.id === sysId);
console.log('war:', table.epoch, 'major', table.major, '·', sysId, row?.owner, row?.control, row?.battle?.id, row?.battle?.fighting ? 'fighting' : 'lull');
check(Boolean(row?.battle), `there's a battle on at ${sysId}`);

await page.goto(`${base}/?quality=${quality}#/galaxy/${sysId}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction((id) => typeof window.__galaxy === 'function' && window.__galaxy().system === id, sysId, { timeout: 180000 });
await page.waitForFunction(() => !window.__galaxy().jump, null, { timeout: 120000 }).catch(() => {});
await page.waitForFunction(() => Boolean(window.__galaxy().war?.battle), null, { timeout: 60000 }).catch(() => {});
await page.addStyleTag({ content: '.galaxy-panel, .comms { display: none !important; }' });
const info = await page.evaluate(() => window.__galaxy().war);
console.log('battle:', info?.laid?.name, JSON.stringify(info?.battle));
check(Boolean(info?.battle), 'the battle is there when you drop in');
check(info?.laid && Math.hypot(...info.laid.at) > 0, 'it’s fought off the planet');
const you = await page.evaluate(() => window.__galaxyDebug.war.battle?.you.team);
check(you === 0, 'you’re in it on the Rebels’ side');

const pin = (fn, arg) =>
  page.evaluate(
    ([f, a]) => {
      const d = window.__galaxyDebug;
      const pose = new Function('d', 'a', f)(d, a);
      d.state.safeUntil = 1e12;
      d.state.shield = 100;
      d.pin(pose);
    },
    [fn, arg],
  );
// the whole of it, from behind the Rebel line: the planet beyond
await pin(`
  const b = d.war.battle; const own = b.capitals.find((c) => c.team === 0 && c.role === 'flagship');
  const other = b.capitals.find((c) => c.team === 1 && c.role === 'flagship');
  const dx = other.pos.x - own.pos.x, dz = other.pos.z - own.pos.z; const l = Math.hypot(dx, dz);
  const x = own.pos.x - dx / l * 60, z = own.pos.z - dz / l * 60;
  return { x, y: own.pos.y + 30, z, heading: Math.atan2(-dx, -dz), pitch: -0.2, bank: 0 };
`);
await page.waitForTimeout(9000);
await snap('panorama');
// the Imperial flagship, close
await pin(`
  const b = d.war.battle; const f = b.capitals.find((c) => c.team === b.defender && c.role === 'flagship');
  const s = f.size; const x = f.pos.x - f.fwd.x * s * 0.2 + f.right.x * s * 0.7, z = f.pos.z - f.fwd.z * s * 0.2 + f.right.z * s * 0.7;
  return { x, y: f.pos.y + s * 0.18, z, heading: Math.atan2(x - f.pos.x, z - f.pos.z), pitch: -0.15, bank: 0 };
`);
await page.waitForTimeout(7000);
await snap('flagship');
// in among the fighters, the planet below
await pin(`
  const b = d.war.battle; const c = { x: 0, y: 0, z: 0 }; let n = 0;
  for (const f of b.fighters) if (f.alive) { c.x += f.pos.x; c.y += f.pos.y; c.z += f.pos.z; n++; }
  c.x /= n; c.y /= n; c.z /= n;
  return { x: c.x - 18, y: c.y + 4, z: c.z - 6, heading: Math.atan2(-18, -6), pitch: -0.05, bank: 0 };
`);
await page.waitForTimeout(6000);
await snap('dogfight');
const lock = await page.evaluate(() => (window.__galaxyDebug.war.targets ?? []).length);
check(lock > 0, 'its fighters and objectives are there to lock on to');

// the objectives, from your guns
const hitAll = (phase) =>
  page.evaluate((p) => {
    const w = window.__galaxyDebug.war;
    const b = w.battle;
    const flag = b.capitals.find((c) => c.team === b.defender && c.role === 'flagship');
    for (const s of flag.subs.filter((o) => o.phase === p)) for (let i = 0; i < 300 && s.alive; i++) w.hit({ x: s.pos.x, y: s.pos.y + 2, z: s.pos.z }, { x: s.pos.x, y: s.pos.y - 0.01, z: s.pos.z }, 3);
    return flag.subs.map((s) => s.alive);
  }, phase);
const attacking = await page.evaluate(() => window.__galaxyDebug.war.battle.attacker === 0);
if (attacking) {
  await hitAll(1);
  await page.waitForTimeout(3000);
  check((await page.evaluate(() => window.__galaxyDebug.war.battle.phase)) === 2, 'both shield generators down: phase 2');
  await snap('shield-down');
  await hitAll(2);
  await page.waitForTimeout(2000);
  // (watching the flagship, for the break-up)
  await pin(`
    const b = d.war.battle; const f = b.capitals.find((c) => c.team === b.defender && c.role === 'flagship');
    const s = f.size; const x = f.pos.x + f.right.x * s * 1.1 - f.fwd.x * s * 0.1, z = f.pos.z + f.right.z * s * 1.1 - f.fwd.z * s * 0.1;
    return { x, y: f.pos.y + s * 0.3, z, heading: Math.atan2(x - f.pos.x, z - f.pos.z), pitch: -0.25, bank: 0 };
  `);
  await hitAll(3);
  await page.waitForTimeout(12000);
  await snap('breaking');
  const mine = await page.evaluate(() => window.__galaxy().war.mine);
  check(mine >= 12, `the war counted what you did (${mine} points)`);
}
// the war table
await page.keyboard.press('m');
await page.waitForSelector('.holomap', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1500);
await snap('war-table');
check((await page.locator('.holomap-warcard, .holomap-order').count()) > 0, 'the holotable shows the war');
console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(problems.length || errors.length ? 1 : 0);
