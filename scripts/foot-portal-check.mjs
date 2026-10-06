/* global window */
// A browser check of the portal gun's kills on foot (lib/three/portalFx.js):
// with the dev server up (npx vite --port 5173), lands Rick's cruiser on a
// planet, calls a squad in, locks on the nearest trooper and fires until
// one goes, then takes a screenshot every so often as the portal takes
// them. Headless Chromium draws in software, slowly: the waits are long.
//
//   OUT=lab/portal node scripts/foot-portal-check.mjs [planet] [--gun freeze|shrink]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : dflt;
};
const gun = flag('--gun', null);
const out = process.env.OUT ?? '.';
mkdirSync(out, { recursive: true });
const planet = args[0] ?? 'rickmorty';
const URL = 'http://127.0.0.1:5173/?quality=low#/universe';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 800, height: 500 } });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-universe-ship', '"cruiser"');
});
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`${m.type()}: ${m.text()}`));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
await page.waitForTimeout(3000);
const shot = (name) => page.screenshot({ path: `${out}/${name}.png`, timeout: 180000 });

const ok = await page.evaluate((id) => {
  const d = window.__universeDebug;
  const p = d.planets.find((x) => x.id === id);
  if (!p) return false;
  const c = p.group.position;
  const r = p.radius ?? 18;
  const s = d.state.ship;
  d.state.ship = { ...s, x: c.x + r * 1.25, y: c.y + r * 0.3, z: c.z + r * 0.25, speed: 0, vy: 0 };
  return true;
}, planet);
if (!ok) throw new Error(`no such planet: ${planet}`);
await page.waitForTimeout(2500);
console.log(await page.evaluate(() => window.__universeDebug.startFoot()) ? 'ok   landing' : 'FAIL landing');
await page.waitForFunction(() => window.__universeDebug.foot.phase === 'walk', null, { timeout: 300000, polling: 500 });
await page.waitForTimeout(4000);
if (gun) console.log(await page.evaluate((g) => window.__universeDebug.foot.gadget?.(g), gun) ? `ok   gadget ${gun}` : `FAIL gadget ${gun}`);
// a squad, now
await page.evaluate(() => {
  const S = window.__universeDebug.foot.debug;
  S.cleared = true;
  S.nextSquad = 0;
});
await page.waitForFunction(() => window.__universeDebug.foot.info()?.troops.length > 0, null, { timeout: 180000, polling: 500 });
await page.waitForTimeout(6000);
// lock on the nearest and stand four metres from it, facing it, out of your own eyes for the view
await page.evaluate(() => {
  const f = window.__universeDebug.foot;
  const S = f.debug;
  f.cycle();
  const t = S.troops.find((o) => o.id === S.lock) ?? S.troops[0];
  const len = (v) => Math.hypot(v[0], v[1], v[2]);
  const unit = (v) => v.map((x) => x / len(v));
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const R = S.R;
  const gap = (4 * 0.027) / R; // radians apart
  const d = Math.acos(Math.max(-1, Math.min(1, dot(S.me.n, t.n))));
  const k = d > gap ? 1 - gap / d : 0;
  const n = unit(S.me.n.map((x, i) => x + (t.n[i] - x) * k));
  const to = t.n.map((x, i) => x - n[i]);
  const f0 = unit(to.map((x, i) => x - n[i] * dot(to, n)));
  S.me.n = n;
  S.me.f = f0;
  S.lock = t.id;
  if (!S.cam.first) f.first();
});
await page.waitForTimeout(5000);
await shot('0-squad');
// fire at the nearest until one goes
let killed = null;
for (let i = 0; i < 40 && !killed; i++) {
  killed = await page.evaluate(() => {
    const f = window.__universeDebug.foot;
    const S = f.debug;
    S.cool = 0;
    S.health = 100;
    f.fire();
    const gone = S.troops.find((o) => !o.alive);
    return gone ? { id: gone.id, kind: gone.kind, how: gone.how ?? null, dead: gone.dead } : null;
  });
  await page.waitForTimeout(700);
}
console.log(killed ? `ok   kill: ${killed.kind} (${killed.how ?? 'shot'})` : 'FAIL no kill');
for (let i = 1; i <= 8; i++) {
  await page.waitForTimeout(i === 1 ? 300 : 2200);
  const s = await page.evaluate(() => {
    const S = window.__universeDebug.foot.debug;
    const gone = S.troops.find((o) => !o.alive);
    if (!gone) return 'gone';
    const got = S._figs.get(gone.id);
    const sw = got?.swallow;
    const g = got?.group;
    let clipped = 0;
    let plane = null;
    g?.traverse((o) => {
      if (o.isMesh && o.material?.clippingPlanes?.length) {
        clipped++;
        plane = o.material.clippingPlanes[0];
      }
    });
    const d = (name) => {
      const b = g?.getObjectByName(name);
      if (!b || !plane) return '-';
      const p = b.getWorldPosition(new b.position.constructor());
      return plane.distanceToPoint(p).toFixed(3);
    };
    const f = (v) => v.toArray().map((x) => x.toFixed(3)).join(',');
    return `${gone.kind} dead ${gone.dead.toFixed(2)}s swallow t=${sw?.t.toFixed(2)} cut=${sw?.cut} done=${sw?.done} clipped=${clipped} head=${d('Head')} foot=${d('LeftFoot')} hips=${d('Hips')} pos=${g && f(g.position)} start=${sw?.landed && f(sw.landed.from)} lie=${sw?.landed && f(sw.landed.at)}`;
  });
  console.log(`     ${i}: ${s}`);
  await shot(`${i}-portal`);
}
console.log(errors.length ? `${errors.length} errors/warnings:\n${[...new Set(errors)].slice(0, 30).join('\n')}` : 'no errors');
await browser.close();
