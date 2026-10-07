/* global window, requestAnimationFrame */
// A browser check of the Minecraft tribute (src/components/minecraft/): with
// the dev server up (npx vite --port 5188 --strictPort --host 127.0.0.1),
//   OUT=/tmp/shots node scripts/mc-check.mjs
// It opens #/dot-matrix/minecraft, waits for the world module and 25 loaded
// chunks, screenshots the title, starts, walks forward for 3 seconds,
// jumps, and screenshots that; it prints the player's place, the chunks
// loaded and drawn, the draw calls and a frame's time, and fails on any page
// error. Headless Chromium draws in software unless GPU=1: the waits are long.
// On Windows set CHROME to Edge ("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe").
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const out = process.env.OUT ?? '.';
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const seed = process.env.SEED ?? '1';
const size = { width: Number(process.env.W ?? 1100), height: Number(process.env.H ?? 700) };
const gpu = process.env.GPU === '1';
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium',
  args: gpu ? ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=default'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
await ctx.addInitScript((seed) => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
  // (the guide's note for a first visit would sit over the shots)
  window.localStorage.setItem('tp-guide-seen', JSON.stringify(['/dot-matrix/minecraft']));
  // a known world, so the shots compare from run to run
  window.localStorage.setItem('tp-mc', JSON.stringify({ v: 1, data: { seed: Number(seed) } }));
}, seed);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const world = () => 'window.__RUNTIME__?.current?.module?.id === "minecraft" ? window.__RUNTIME__.current.world : null';

const state = (label) =>
  page.evaluate(
    ([label, w]) => {
      const world = eval(w);
      const g = world?.game;
      const p = g?.player;
      return { label, status: window.__RUNTIME__?.status, seed: g?.seed, ticks: g?.ticks, player: p ? [p.x.toFixed(2), p.y.toFixed(2), p.z.toFixed(2), p.onGround] : null, ...world?.debug.stats() };
    },
    [label, world()],
  );
// the 3D read straight off the GL context (a software-drawn canvas's screenshot can come back cleared), and the page
const shot = async (name) => {
  const r = await page.evaluate((w) => {
    const world = eval(w);
    const gl = window.__RUNTIME__?.gfx?.renderer?.getContext();
    if (!world || !gl) return null;
    const t = performance.now();
    world.draw();
    gl.finish();
    const ms = performance.now() - t;
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let s = '';
    for (let i = 0; i < px.length; i += 0x8000) s += String.fromCharCode(...px.subarray(i, i + 0x8000));
    return { W, H, ms, data: btoa(s) };
  }, world());
  if (r) {
    await sharp(Buffer.from(r.data, 'base64'), { raw: { width: r.W, height: r.H, channels: 4 } }).flip().removeAlpha().png().toFile(`${out}/mc-${name}-3d.png`);
    console.log(`  a frame drawn in ${r.ms.toFixed(1)} ms`);
  }
  await page.screenshot({ path: `${out}/mc-${name}.png`, timeout: 180000 }).catch((e) => console.log('shot failed', name, String(e).slice(0, 120)));
};
const step = async (label) => {
  console.log(JSON.stringify(await state(label)));
  await shot(label);
};
const until = (cond, arg) => page.waitForFunction(([w, cond, arg]) => { const x = eval(w); return Boolean(x) && new Function('g', 'w', 'arg', `return ${cond}`)(x.game, x, arg); }, [world(), cond, arg], { timeout: 600000, polling: 250 });
const ticks = async (n) => {
  const t0 = await page.evaluate((w) => eval(w).game.ticks, world());
  await until('g.ticks >= arg', t0 + n);
};

await page.goto(`${base}/#/dot-matrix/minecraft`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction((w) => Boolean(eval(w)) && window.__RUNTIME__?.status === 'on', world(), { timeout: 300000 });
await until('g.world.chunks.size >= 25');
await step('title');

await page.click('.mc-title .mc-btn');
await until("document.querySelector('.mc-hotbar') && g.world.loaded(g.player.x, g.player.z)");
await ticks(10);
await step('play');

await page.keyboard.down('KeyW');
await ticks(60);
await page.keyboard.press('Space');
await page.keyboard.up('KeyW');
await ticks(20);
await step('walk');
// frames a second with the whole view loaded, counted off the runtime's own frames
const fps = await page.evaluate((w) => new Promise((done) => {
  const g = eval(w).game;
  let frames = 0;
  const t0 = performance.now();
  const count = () => {
    frames++;
    if (performance.now() - t0 < 3000) requestAnimationFrame(count);
    else done({ fps: (frames / (performance.now() - t0)) * 1000, ticks: g.ticks });
  };
  requestAnimationFrame(count);
}), world());
console.log(`  ${fps.fps.toFixed(1)} frames a second`);

// turn round and look down the hill
await page.evaluate((w) => {
  const g = eval(w).game;
  g.player.yaw += Math.PI * 0.75;
  g.player.pitch = -0.35;
}, world());
await ticks(4);
await step('look');

// from above: the lie of the land
await page.evaluate((w) => {
  const x = eval(w);
  const p = x.game.player;
  x.debug.teleport(p.x, p.y + 30, p.z);
  p.pitch = -0.6;
}, world());
await page.evaluate((w) => eval(w).pause(true), world());
await page.waitForTimeout(500);
await page.evaluate((w) => eval(w).pause(false), world());
await step('overview');

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
