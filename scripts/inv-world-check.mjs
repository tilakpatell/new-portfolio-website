/* global window, document */
// A browser check of the Invincible world (components/invincible/world).
// With the dev server up (npx vite --port 5173):
//   OUT=/tmp/shots node scripts/inv-world-check.mjs [shot …]
// It opens /invincible, waits for the city, and frames it from the places
// the QA cares about (dev hook window.__INVWORLD__: `sim.h` is where he is,
// `sim.yaw`/`sim.pitch` the camera, `sim.snap` puts the camera and his pose
// straight where they're going). Headless Chrome draws in software, slowly.
import { chromium } from 'playwright-core';

const out = process.env.OUT ?? '.';
const W = Number(process.env.W ?? 960);
const H = Number(process.env.H ?? 540);
const Q = process.env.Q ?? 'low';
const URL = `http://localhost:5173/?quality=${Q}#/invincible`;
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: W < 600, isMobile: W < 600 });
await ctx.addInitScript(([q, intro]) => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-3d', '"on"');
  window.localStorage.setItem('tp-worlds', '"load"');
  window.localStorage.setItem('tp-quality', JSON.stringify(q));
  // (a first visit drops him in from the sky: INTRO=1 to see it, otherwise he's already on the lawn)
  if (intro) window.localStorage.removeItem('tp-inv-world-at');
  else window.localStorage.setItem('tp-inv-world-at', JSON.stringify({ x: -2044, y: 0, z: 253.5, face: 1.694 }));
}, [Q, Boolean(process.env.INTRO)]);
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const t0 = Date.now();
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__INVWORLD__?.api && document.querySelector('.iw-canvas[data-on]'), null, { timeout: 240000 });
console.log('city up in', ((Date.now() - t0) / 1000).toFixed(1), 's');

// shots: [name, hero { p, mode, v }, yaw, pitch, time]
const SHOTS = {
  spawn: { at: null, time: 'noon' },
  street: { p: [40, 18, 200], mode: 'air', yaw: Math.PI, pitch: -0.22 },
  curb: { p: [44, 3, 120], mode: 'air', yaw: Math.PI, pitch: -0.12 },
  streetnight: { p: [40, 18, 200], mode: 'air', yaw: Math.PI, pitch: -0.22, time: 'night' },
  downtown: { p: [-300, 140, 600], mode: 'air', yaw: Math.PI * 0.9, pitch: -0.12 },
  high: { p: [-900, 1400, 1500], mode: 'air', yaw: Math.PI * 0.85, pitch: -0.45 },
  suburb: { p: [-2060, 30, 330], mode: 'air', yaw: Math.PI, pitch: -0.25 },
  river: { p: [1150, 25, 600], mode: 'air', yaw: Math.PI, pitch: -0.05 },
  boost: { p: [0, 220, 900], mode: 'air', v: [0, 0, -250], yaw: Math.PI, pitch: -0.1 },
  porch: { place: 'home', back: 9, up: 1.5 },
  gda: { place: 'gda', back: 12, up: 2 },
  burger: { place: 'burgermart', back: 12, up: 2 },
  school: { place: 'school', back: 22, up: 4 },
  plaza: { place: 'guardians', back: 26, up: 8 },
  eve: { follow: 'eve', back: 16 },
  jet: { follow: 'jet', back: 70 },
  clouds: { p: [600, 1150, 900], mode: 'air', yaw: Math.PI * 0.8, pitch: 0.02 },
  rings: { p: [-2060, 22, 262], mode: 'air', yaw: 2.2, pitch: 0.05 },
  card: { p: [0, 38, 30], mode: 'air', yaw: Math.PI, pitch: 0.1 },
  rescue: { rescue: true, back: 28 },
  fight: { fight: true },
  climb: { p: [0, 7600, 600], mode: 'air', yaw: Math.PI, pitch: 0.12 },
  orbit: { space: 'earth' },
  orbitnight: { space: 'earth', time: 'night' },
  moon: { space: 'moon', back: 70 },
  reentry: { space: 'reentry' },
  allen: { space: 'allen', back: 14 },
  mars: { space: 'mars', back: 90 },
  thragg: { space: 'thragg', back: 18 },
  dusk: { p: [-300, 160, 700], mode: 'air', yaw: Math.PI * 0.9, pitch: -0.1, time: 'dusk' },
  night: { p: [-300, 160, 700], mode: 'air', yaw: Math.PI * 0.9, pitch: -0.1, time: 'night' },
};
const want = process.argv.slice(2);
await page.waitForTimeout(3000); // (a few frames first, so everyone's somewhere)
for (const [name, s] of Object.entries(SHOTS)) {
  if (want.length && !want.includes(name)) continue;
  await page.evaluate(async (s) => {
    const { api, sim } = window.__INVWORLD__;
    sim.snap = true;
    if (s.time) await api.setTime(s.time);
    if (s.fight) {
      // the Flaxans: start them now, give a few time to come through, and face the portal
      sim.invadeAt = 0;
      sim.speedup = 8; // (software rendering is slow: run the clock faster while they come through)
      await new Promise((r) => setTimeout(r, 9000));
      sim.speedup = 1;
      sim.h = { ...sim.h, p: [1100, 140, -410], v: [0, 0, 0], spd: 0, mode: 'air', crouch: 0, stun: 0, face: Math.PI / 2 };
      sim.yaw = Math.PI / 2 - 0.15;
      sim.pitch = 0.12;
      sim.dragAt = 1e9;
    } else if (s.space) {
      // up through the top of the sky, if he isn't out there already
      if (api.zone !== 'space') {
        sim.h = { ...sim.h, p: [0, 8990, 0], v: [0, 300, 0], spd: 300, dir: [0, 1, 0], mode: 'air', exited: false, crouch: 0, stun: 0 };
        sim.yaw = Math.PI;
        sim.pitch = 0.3;
        for (let i = 0; i < 40 && api.zone !== 'space'; i++) await new Promise((r) => setTimeout(r, 250));
      }
      const { bodies, allen, thragg } = api.debug;
      const RE = 60000;
      let target;
      if (s.space === 'reentry') {
        // coming down fast over the city: the air burns
        sim.h = { ...sim.h, p: [200, RE + 16000, 300], v: [0, -800, 0], spd: 800, dir: [0, -1, 0], mode: 'air', reentered: false };
        sim.yaw = Math.PI;
        sim.pitch = -0.35;
      } else if (s.space === 'earth') {
        sim.h = { ...sim.h, p: [0, RE + 30000, 9000], v: [0, 0, 0], spd: 0, mode: 'air' };
        sim.yaw = Math.PI;
        sim.pitch = -0.7;
      } else {
        const b = bodies.find((q) => q.id === s.space);
        target = b ? b.c : s.space === 'allen' ? allen : thragg;
        // stand off from it on the side toward the Earth, looking at it
        const l = Math.hypot(...target);
        const n = target.map((v) => -v / l);
        const off = (b ? b.r : 0) + s.back;
        // (and a little to one side, so he isn't in the way)
        const p = target.map((v, i) => v + n[i] * off + (i === 0 ? off * 0.35 : 0));
        const d = target.map((v, i) => v - p[i]);
        const dl = Math.hypot(...d);
        sim.h = { ...sim.h, p, v: [0, 0, 0], spd: 0, mode: 'air', perch: null };
        sim.yaw = Math.atan2(d[0], d[2]) + 0.3;
        sim.pitch = Math.asin(d[1] / dl);
      }
      sim.dragAt = 1e9;
    } else if (s.rescue) {
      // call an emergency in now, and frame it
      sim.quests = { ...sim.quests, nextCall: 0 };
      await new Promise((r) => setTimeout(r, 2500));
      const q = sim.quests.rescue;
      if (q) {
        const face = 2.4;
        sim.h = { ...sim.h, p: [q.p[0] - Math.sin(face) * s.back, q.p[1] + 2, q.p[2] - Math.cos(face) * s.back], v: [0, 0, 0], spd: 0, mode: 'air', crouch: 0, stun: 0, face };
        sim.yaw = face;
        sim.pitch = 0.05;
        sim.dragAt = 1e9;
      }
    } else if (s.place || s.follow) {
      // stand back from a place's door (or from someone flying), looking at it
      const { debug } = api;
      let at;
      let face;
      if (s.place) {
        const pl = debug.world.places.find((q) => q.id === s.place);
        at = [pl.door[0], 0, pl.door[1]];
        face = Math.atan2(pl.x - pl.door[0], pl.z - pl.door[1]);
      } else {
        const q = s.follow === 'eve' ? debug.npcs.eve.p : debug.jet.position;
        const v = s.follow === 'eve' ? debug.npcs.eve.v : debug.jet.velocity;
        at = [q.x, q.y - 1, q.z];
        face = Math.atan2(v.x, v.z) + 0.5;
      }
      const p = [at[0] - Math.sin(face) * s.back, at[1] + (s.up ?? 0), at[2] - Math.cos(face) * s.back];
      sim.h = { ...sim.h, p, v: [0, 0, 0], spd: 0, mode: s.place && !s.up ? 'ground' : 'air', crouch: 0, stun: 0, face };
      sim.hold = Boolean(s.follow);
      sim.yaw = face;
      sim.pitch = s.place ? 0.05 : -0.05;
      sim.dragAt = 1e9;
    } else if (s.p) {
      sim.hold = false;
      sim.h = { ...sim.h, p: [...s.p], v: s.v ?? [0, 0, 0], spd: Math.hypot(...(s.v ?? [0, 0, 0])), dir: s.v ? s.v.map((x) => x / Math.hypot(...s.v)) : [0, 0, 1], mode: s.mode, crouch: 0, stun: 0, face: s.yaw };
      sim.yaw = s.yaw;
      sim.pitch = s.pitch;
      sim.dragAt = 1e9;
    }
  }, s);
  // a few frames to settle (and, flat out, to let him go)
  await page.waitForTimeout(s.v ? 2500 : 4000);
  if (s.v) await page.evaluate((s) => Object.assign(window.__INVWORLD__.sim.h, { p: [...s.p] }), s);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/inv-${name}.png`, timeout: 180000 });
  const info = await page.evaluate(() => window.__INVWORLD__.api.info());
  console.log(name, 'calls', info.calls, 'tris', info.triangles, 'tier', info.tier);
}
console.log(errors.length ? `errors:\n${errors.slice(0, 12).join('\n')}` : 'no page errors');
await browser.close();
