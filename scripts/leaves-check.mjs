/* global window */
// A browser check of a landing's fallen leaves and crowns
// (universe/landings/litter.js, canopy.js): waits for the page's own
// warm-up (scene.js prepare, gpuWork's warmDraw: everything drawn once,
// hidden things too, as a player's page is before the map's first frame;
// its draw made again with the foot scene in, as on a page that opens by a
// planet you can land on), lands on each planet as scripts/props-check.mjs
// does, waits for the crew to be out and the landing shown, then says
// whether the leaves are down and as many as the place and the device have,
// whether they're drawn (the ground round your feet, one frame drawn with
// the leaves hidden and again with them shown: some of its pixels must
// differ), whether the crowns are in the canopy's shader, whether a blast
// at your feet throws them (and, with motion turned down, doesn't) and they
// all come down again after, and whether anything's shader was made in a
// frame once the landing was shown (lib/three/frameGuard's slips). With the
// dev server up (npx vite --port 5173, or PORT=5188):
//   OUT=/tmp/shots node scripts/leaves-check.mjs [planet ...] [--spot lat,lon] [--phone] [--reduced] [--quality high]
// --spot forces where it comes down (footScene.js's DEV ?spot=: 36.9,3.4 is
// Lothlórien); --phone is a phone's screen at the low level; --reduced asks
// for reduced motion. It takes screenshots of the ground before the blast
// and after it. Exit code 1 on any failure.
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : dflt;
};
const bool = (name) => (args.includes(name) ? (args.splice(args.indexOf(name), 1), true) : false);
const spot = flag('--spot', null);
const phone = bool('--phone');
const reduced = bool('--reduced');
const quality = flag('--quality', phone ? 'low' : 'mid');
const out = process.env.OUT ?? '.';
const WALK_MS = Number(process.env.WALK_MS ?? 480000); // (software GL: the crew take minutes to walk out)
const PREPARE_MS = Number(process.env.PREPARE_MS ?? 1200000); // (software GL: the page's warm-up compiles every shader, many minutes)
// (the leaves drawn: of the ground round your feet, at least this many
// pixels differ between the frame with them hidden and with them shown)
const DRAWN_MIN = 40;
const planets = args.length ? args : ['middleearth'];
const tagOf = (id) => [id, spot?.replace(',', '_'), phone && 'phone', reduced && 'reduced', quality !== 'mid' && !phone && quality].filter(Boolean).join('-');
// how many leaves each place lays round you, at each level (litter.js's
// leafCount of its density: landings.js's LEAVES), by its biome's title
// (or the planet, with none)
const COUNTS = {
  'The Shire': { high: 416, mid: 320, low: 160 },
  'The old forest': { high: 640, mid: 320, low: 160 },
  Earth: { high: 192, mid: 160, low: 96 },
  marvel: { high: 160, mid: 128, low: 96 },
  music: { high: 160, mid: 128, low: 96 },
};
// (the level the page picks: litter.js's leafLevel, a 1280 × 800 window not small at high)
const level = quality === 'low' ? 'low' : quality === 'mid' || phone ? 'mid' : 'high'; // (a phone's screen is small: no higher than mid)
const URL = `http://localhost:${process.env.PORT ?? 5173}/?quality=${quality}${spot ? `&spot=${spot}` : ''}#/universe`;
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [];
const notes = [];
const slips = [];
const viewport = phone ? { width: 390, height: 844 } : { width: 1280, height: 800 };
const ctx = await browser.newContext({ viewport, hasTouch: phone, reducedMotion: reduced ? 'reduce' : 'no-preference' });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-universe-ship', JSON.stringify('falcon'));
});
const page = await ctx.newPage();
let shown = false; // (the landing's shown: a frame's shader from here on is a slip)
// (a shader that won't build, or anything thrown, fails it; the frame
// guard's word on a shader made in a frame, once the landing's shown; any
// other error's said, not counted: a fetch the sandbox refuses)
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  const text = m.text();
  if (/Shader Error|WebGLProgram/.test(text)) errors.push(`${m.type()}: ${text}`);
  else if (/frameGuard/.test(text)) slips.push(`${shown ? 'after' : 'before'} the landing was shown: ${text}`);
  else if (m.type() === 'error') notes.push(text);
});
page.on('response', (r) => r.status() >= 400 && notes.push(`${r.status()} ${r.url()}`));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
// (the page's warm-up first: what it sends is what a player's graphics
// chip has before any landing. lib/three/useScene marks the map's box
// data-gl="on" once that's done and its first frame drawn; on the low
// level there's none, and it's on at once)
const t0 = Date.now();
const warm = await page.waitForSelector('[data-gl="on"]', { timeout: PREPARE_MS }).then(() => true, () => false);
console.log(`     the page's warm-up ${warm ? `done in ${((Date.now() - t0) / 1000).toFixed(0)} s` : `not done in ${PREPARE_MS / 1000} s`}`);
if (!warm) {
  console.log('FAIL the page never finished its warm-up');
  await browser.close();
  process.exit(1);
}
// The leaves' mesh is the foot scene's, made as a planet you can land on
// comes near: on a page that opens by one it's in the warm-up, which draws
// it (hidden things too) before it has a leaf laid. Opened out here, it
// isn't, so (above the low level, where there's no warm-up) the foot scene
// is asked for now and the warm-up's draw (gpuWork's warmDraw, the page's
// own passes, as scene.js's prepare ends) made again with it in: what a
// landing then sends is what one on that page sends.
if (level !== 'low') {
  const rewarm = await page.evaluate(async () => {
    const d = window.__universeDebug;
    // (its stand-in's begin asks for its code and lands nowhere: scene.js)
    if (d.foot.debug == null) d.foot.begin();
    const t = performance.now();
    while (d.foot.debug == null && performance.now() - t < 180000) await new Promise((r) => setTimeout(r, 250));
    if (d.foot.debug == null) return 'the foot scene never came';
    const { warmDraw } = await import('/src/lib/three/gpuWork.js');
    await warmDraw(d.renderer, () => d.post.render(64, 64), [d.scene]);
    return null;
  });
  if (rewarm) {
    console.log(`FAIL ${rewarm}`);
    await browser.close();
    process.exit(1);
  }
}
await page.waitForTimeout(3000);
const leaves = () => page.evaluate(() => {
  const l = window.__universeDebug.foot.leaves();
  return l && { on: l.on, level: l.level, count: l.count, half: l.half, airborne: l.airborne, asleep: l.asleep, near: l.near, ready: l.ready, canopy: l.canopy };
});
// whether the leaves are drawn: the ground round your feet (the lower
// part of the screen, round where they are on it, or the nearest it shows
// of them when the camera has them just under its edge, as it often has
// over your shoulder) in one frame drawn three times, the
// leaves' mesh hidden, hidden again and then shown, and how many of its
// pixels differ (the two hidden ones: what differs anyway, the film
// grain moving each draw). Read straight after each draw, in the one
// task, so the canvas still has it.
const drawnAt = () =>
  page.evaluate(() => {
    const d = window.__universeDebug;
    const S = d.foot.debug;
    const { THREE, renderer, camera, post, scene } = d;
    let mesh = null;
    scene.traverse((o) => (mesh ??= o.isMesh && o.name === 'leaves' && o.geometry.getAttribute('aLeafSeed') ? o : null));
    if (!mesh || !S?.me) return { error: mesh ? 'no one out walking' : 'no leaves mesh' };
    const size = renderer.getSize(new THREE.Vector2());
    const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
    mesh.parent.updateWorldMatrix(true, false);
    const feet = mesh.parent.localToWorld(new THREE.Vector3(...S.me.n).multiplyScalar(S.R)).project(camera);
    const where = feet.toArray().map((a) => Number(a.toFixed(2)));
    if (!(feet.z < 1 && Math.abs(feet.x) < 1.5 && Math.abs(feet.y) < 1.5)) return { error: `your feet aren't anywhere near the screen (${where})` };
    const w = Math.round(buf.x * 0.5);
    const h = Math.round(buf.y * 0.4);
    const cx = ((feet.x + 1) / 2) * buf.x;
    const cy = ((feet.y + 1) / 2) * buf.y;
    const x = Math.round(Math.min(buf.x - w, Math.max(0, cx - w / 2)));
    const y = Math.round(Math.min(buf.y - h, Math.max(0, cy - h / 2)));
    const gl = renderer.getContext();
    const grab = (shown) => {
      mesh.visible = shown;
      post.render(size.x, size.y);
      renderer.setRenderTarget(null);
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    };
    const was = mesh.visible;
    const off = grab(false);
    const again = grab(false);
    const on = grab(true);
    mesh.visible = was;
    const apart = (a, b) => {
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 12) n++;
      return n;
    };
    const lit = off.some((v, i) => i % 4 !== 3 && v > 0);
    return { differ: apart(off, on), noise: apart(off, again), of: w * h, box: [x, y, w, h], feet: where, lit, leaves: mesh.geometry.instanceCount };
  });
// (the scene alone: the page's panels and HUD out of the way for it)
const shot = async (id, name) => {
  const hide = await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }' });
  await page.screenshot({ path: `${out}/leaves-${tagOf(id)}-${name}.png`, timeout: 180000 });
  await hide.evaluate((el) => el.remove());
};

let bad = 0;
const fail = (id, why) => {
  bad++;
  console.log('FAIL', id, why);
};
for (const id of planets) {
  shown = false;
  const was = bad;
  const ok = await page.evaluate((id) => {
    const d = window.__universeDebug;
    const p = d.planets.find((x) => x.id === id);
    if (!p) return false;
    const c = p.group.position;
    const r = p.radius ?? 18;
    d.state.ship = { ...d.state.ship, x: c.x + r * 1.25, y: c.y + r * 0.3, z: c.z + r * 0.25, speed: 0, vy: 0 };
    return true;
  }, id);
  if (!ok) {
    fail(id, 'no such planet');
    continue;
  }
  await page.waitForTimeout(2500);
  let landed = false;
  for (let k = 0; k < 45 && !landed; k++) {
    landed = await page.evaluate((id) => window.__universeDebug.startFoot({ id }), id);
    if (!landed) await page.waitForTimeout(2000);
  }
  if (!landed) {
    fail(id, 'the ship would not set down');
    continue;
  }
  await page.waitForFunction(() => window.__universeDebug.foot.phase === 'walk' && window.__universeDebug.foot.leaves()?.ready, null, { timeout: WALK_MS, polling: 500 }).catch(() => {});
  const biome = await page.evaluate(() => window.__universeDebug.foot.biome);
  const at = await page.evaluate(() => ({ phase: window.__universeDebug.foot.phase, ready: window.__universeDebug.foot.leaves()?.ready }));
  if (at.phase !== 'walk' || !at.ready) {
    fail(id, `not out on a shown landing (phase ${at.phase}, shown ${at.ready})`);
    continue;
  }
  shown = true;
  // (nothing's shader made in a frame once it's shown)
  const s0 = await page.evaluate(() => window.__tpGuardSlips ?? 0);
  await page.waitForTimeout(3000);
  const s1 = await page.evaluate(() => window.__tpGuardSlips ?? 0);
  if (s1 > s0) fail(id, `${s1 - s0} shader(s) made in a frame once the landing was shown`);
  const info = await leaves();
  const place = biome?.title ?? id;
  console.log(`     ${id}:`, JSON.stringify({ biome, place, ...info }));
  const want = COUNTS[place]?.[level];
  if (!info?.on) fail(id, 'no leaves down');
  else if (want == null) fail(id, `no count known for ${place}`);
  else if (info.count !== want) fail(id, `${info.count} leaves, not ${want} (${place}, ${level})`);
  if (!info?.canopy?.includes('|canopy:')) fail(id, `the crowns aren't in the canopy's shader (${info?.canopy})`);
  await shot(id, 'ground');
  if (!(info?.near > 0)) fail(id, 'no leaves round your feet');
  // (down by the sim's count is one thing; drawn is another: a leaf whose
  // seed never reached the graphics chip is drawn at size 0)
  const drawn = await drawnAt();
  console.log(`     ${id}: drawn`, JSON.stringify(drawn));
  if (drawn.error) fail(id, `can't tell whether the leaves are drawn: ${drawn.error}`);
  else if (!drawn.lit) fail(id, 'the ground round your feet read back black: nothing to compare');
  else if (drawn.differ - drawn.noise < DRAWN_MIN) fail(id, `the leaves aren't drawn: ${drawn.differ} of ${drawn.of} pixels round your feet differ with them shown (${drawn.noise} anyway)`);
  // a blast at your feet: up they go (and with motion turned down, not;
  // waited for by the frame, not the clock: software GL draws a few a second)
  const up = (await leaves()).airborne;
  const thrown = await page.evaluate(() => window.__universeDebug.foot.leaves().blast(3));
  if (reduced) await page.waitForTimeout(3000);
  else await page.waitForFunction((up) => window.__universeDebug.foot.leaves().airborne > up, up, { timeout: 15000, polling: 100 }).catch(() => {});
  const after = await leaves();
  console.log(`     ${id}: blast threw ${thrown}, ${after.airborne} in the air (${up} before), ${after.asleep} asleep`);
  if (reduced) {
    if (thrown !== 0 || after.airborne !== 0 || after.asleep !== after.count) fail(id, `with motion turned down, ${thrown} thrown, ${after.airborne} in the air and ${after.asleep} of ${after.count} asleep`);
  } else if (!(thrown > 0 && after.airborne > up)) fail(id, `a blast threw ${thrown}, and ${after.airborne - up} more went up`);
  await shot(id, 'blast');
  // and down again (in the sim's time: a slow frame steps one of his frames, so wait by them)
  const t0 = Date.now();
  const down = await page.waitForFunction(() => window.__universeDebug.foot.leaves().airborne === 0, null, { timeout: 90000, polling: 500 }).then(() => true, () => false);
  console.log(`     ${id}: all down again ${down ? `in ${((Date.now() - t0) / 1000).toFixed(1)} s` : 'never'}`);
  if (!down) fail(id, 'leaves still in the air 90 s on');
  if (bad === was) console.log('ok  ', id, place);
  await page.evaluate(() => window.__universeDebug.foot.end());
  await page.waitForTimeout(1500);
}
for (const s of slips) console.log('    ', s);
if (slips.some((s) => s.startsWith('after'))) bad++;
for (const n of [...new Set(notes)].slice(0, 10)) console.log('     (said:', n, ')');
console.log(errors.length ? `${errors.length} errors:\n${[...new Set(errors)].slice(0, 20).join('\n')}` : 'no errors');
if (errors.length) bad++;
await browser.close();
process.exit(bad ? 1 : 0);
