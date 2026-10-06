/* global window */
// A browser check of a crew's war on the universe map (universe/front.js,
// battle.js, battleScene.js; the wars' data in wars.js): Rick and Morty's,
// flying the cruiser, or Breaking Bad's in the RV.
//   OUT=/tmp/shots node scripts/universe-war-check.mjs [cruiser|rv] [quality]
// With BASE unset it starts its own Vite (on 5293) and stops it after; with
// BASE set (a dev server already up) it uses that. CHROME is the Chromium to
// drive (Playwright's own on a Mac, with the Metal GPU, by default).
// It puts the ship at the front, checks it's in the fight on its crew's side
// with no side to pick, looks at it from a few places, takes the shield
// generators, the bridge and the reactor down with the battle's own hit()
// (as your shots would), watches the flagship break in two, checks the war
// moved on and was saved, then opens the nav map and sends the autopilot to
// the front: screenshots as it goes (uwar-<n>-<what>.png).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';

const out = process.env.OUT ?? '.';
const crew = process.argv[2] ?? 'cruiser';
const quality = process.argv[3] ?? 'high';
const warId = { cruiser: 'rickmorty', rv: 'breakingbad' }[crew];
mkdirSync(out, { recursive: true });

let server = null;
let base = process.env.BASE;
if (!base) {
  const { createServer } = await import('vite');
  server = await createServer({ server: { host: '127.0.0.1', port: 5293, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
  await server.listen();
  base = 'http://127.0.0.1:5293';
}
const chrome = process.env.CHROME ?? `${homedir()}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const args = process.platform === 'darwin' ? ['--use-angle=metal', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ executablePath: chrome, args });
const errors = [];
const problems = [];
const check = (ok, what) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) problems.push(what);
};
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(
    ([s, w]) => {
      window.localStorage.setItem('tp-intro', '1');
      window.localStorage.setItem('tp-start', '"universe"');
      window.localStorage.setItem('tp-sound', 'off');
      window.localStorage.setItem('tp-universe-ship', JSON.stringify(s));
      window.localStorage.removeItem(`tp-war-${w}`);
    },
    [crew, warId],
  );
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/GPU stall|swiftshader|WebGL/i.test(m.text()) && errors.push(m.text()));
  await page.goto(`${base}/?quality=${quality}#/universe`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content: '.universe-panel { display: none !important; }' });
  let shot = 0;
  const snap = (what) => page.screenshot({ path: `${out}/uwar-${shot++}-${what}.png`, timeout: 90000 });
  const dbg = (fn, arg) => page.evaluate(fn, arg);
  // the ship somewhere, nose toward a point (heading atan2(−dx, −dz) faces
  // (dx, dz)), nothing hurting it while this looks round
  const place = (fn) =>
    dbg((f) => {
      const d = window.__universeDebug;
      const p = new Function('d', f)(d);
      const s = d.state;
      s.auto = null;
      s.safeUntil = 1e12;
      s.shield = 100;
      const dx = p.look[0] - p.at[0];
      const dy = p.look[1] - p.at[1];
      const dz = p.look[2] - p.at[2];
      s.ship = { ...s.ship, x: p.at[0], y: p.at[1], z: p.at[2], heading: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), bank: 0, speed: p.speed ?? 0, vy: 0 };
    }, fn);

  // at the front, on our side of it, facing the other side's line
  const where = await dbg(() => window.__universeDebug.front()?.where() ?? null);
  check(Boolean(where), `the ${crew}'s crew has a front`);
  if (!where) throw new Error('no front');
  console.log('front:', where.name, where.at);
  await place(`
    const w = d.front().where(); const a = w.at;
    const [h, e] = [w.sectors[0].at, w.sectors[w.sectors.length - 1].at];
    const l = Math.hypot(e[0] - h[0], e[2] - h[2]); const ax = [(e[0] - h[0]) / l, (e[2] - h[2]) / l]; // (from our home to theirs)
    return { at: [a[0] - 40 * ax[0], a[1] + 6, a[2] - 40 * ax[1]], look: a, speed: 3 };
  `);
  await page.waitForTimeout(6000);
  const joined = await dbg(() => ({ joined: window.__universeDebug.front().joined, inZone: window.__universeDebug.front().inZone }));
  check(joined.inZone, 'flying in puts you in the battle');
  check(joined.joined === 0, 'on your crew’s side, with no side to pick');
  check((await page.locator('.battle-ask').count()) === 0, 'and nothing asks which side');
  await page.waitForTimeout(8000);
  const info = await dbg(() => window.__universeDebug.front().info);
  console.log('battle:', JSON.stringify(info.battle));
  check(info.battle.fighters[0] > 0 && info.battle.fighters[1] > 0, 'both sides have fighters up');
  await snap('fight');
  // the whole of it, from behind our flagship, the other one beyond
  await place(`
    const b = d.front().battle;
    const own = b.capitals.find((c) => c.team === 0 && c.role === 'flagship');
    const other = b.capitals.find((c) => c.team === 1 && c.role === 'flagship');
    const dx = other.pos.x - own.pos.x, dz = other.pos.z - own.pos.z, l = Math.hypot(dx, dz);
    return { at: [own.pos.x - (dx / l) * own.size * 1.4, own.pos.y + own.size * 0.6, own.pos.z - (dz / l) * own.size * 1.4], look: [other.pos.x, other.pos.y, other.pos.z] };
  `);
  await page.waitForTimeout(9000);
  await snap('panorama');
  // each side's flagship, close
  for (const team of [0, 1]) {
    await place(`
      const b = d.front().battle; const f = b.capitals.find((c) => c.team === ${team} && c.role === 'flagship');
      const s = f.size;
      return { at: [f.pos.x + f.right.x * s * 0.8 + f.fwd.x * s * 0.2, f.pos.y + s * 0.3, f.pos.z + f.right.z * s * 0.8 + f.fwd.z * s * 0.2], look: [f.pos.x, f.pos.y, f.pos.z] };
    `);
    await page.waitForTimeout(7000);
    await snap(`flagship-${team}`);
  }

  // the objectives, from your guns: the defender's flagship's
  const hitAll = (phase) =>
    dbg((p) => {
      const b = window.__universeDebug.front().battle;
      const flag = b.capitals.find((c) => c.team === b.defender && c.role === 'flagship');
      for (const s of flag.subs.filter((o) => o.phase === p)) for (let i = 0; i < 300 && s.alive; i++) b.hit({ x: s.pos.x, y: s.pos.y + 2, z: s.pos.z }, { x: s.pos.x, y: s.pos.y - 0.01, z: s.pos.z }, 3);
      return flag.subs.map((s) => s.alive);
    }, phase);
  const attacker = await dbg(() => window.__universeDebug.front().battle.attacker);
  check(attacker === 0, 'the crew’s side attacks first');
  await place(`
    const b = d.front().battle; const f = b.capitals.find((c) => c.team === b.defender && c.role === 'flagship');
    const s = f.size;
    return { at: [f.pos.x + f.right.x * s * 1.1 - f.fwd.x * s * 0.1, f.pos.y + s * 0.35, f.pos.z + f.right.z * s * 1.1 - f.fwd.z * s * 0.1], look: [f.pos.x, f.pos.y, f.pos.z] };
  `);
  await page.waitForTimeout(2000);
  await snap('objectives');
  await hitAll(1);
  await page.waitForTimeout(3000);
  check((await dbg(() => window.__universeDebug.front().battle.phase)) === 2, 'with both generators down it’s phase 2');
  await snap('shield-down');
  await hitAll(2);
  await page.waitForTimeout(2000);
  await hitAll(3);
  await page.waitForTimeout(3500);
  await snap('breaking');
  await page.waitForFunction(() => window.__universeDebug.front().battle?.over ?? window.__universeDebug.front().info?.over, null, { timeout: 300000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await snap('broken');
  const end = await dbg(() => ({ over: window.__universeDebug.front().battle?.over ?? null, state: window.__universeDebug.front().info.state }));
  console.log('end:', JSON.stringify(end));
  check(end.over?.winner === 0 && end.over?.why === 'flagship', 'the reactor gone, the crew’s side wins');
  const saved = await dbg((w) => window.localStorage.getItem(`tp-war-${w}`), warId);
  check(Boolean(saved) && JSON.parse(saved).front !== 3, 'the war moved on, and is saved');

  // the nav map: the war's line and the front, and the autopilot there
  await dbg(() => {
    const s = window.__universeDebug.state;
    s.ship = { ...s.ship, x: s.ship.x + 1200, speed: 0 };
  });
  await page.waitForTimeout(1500);
  await page.keyboard.press('m');
  await page.waitForSelector('.navmap-frontbtn', { timeout: 20000 }).catch(() => {});
  check((await page.locator('.navmap-war-sector').count()) === 7, 'the nav map draws the war’s seven sectors');
  await snap('navmap');
  await page.locator('.navmap-frontbtn').click().catch((e) => console.log('click:', String(e).slice(0, 200)));
  await page.waitForTimeout(1500);
  check((await dbg(() => window.__universeDebug.state.auto?.id ?? null)) === 'front', 'the nav map’s front button sends the autopilot there');
  console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
} finally {
  await browser.close();
  await server?.close();
}
process.exit(problems.length || errors.length ? 1 : 0);
