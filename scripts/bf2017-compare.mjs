#!/usr/bin/env node
/* global window, requestAnimationFrame */
// The compare harness (the galaxy-on-the-game design's decision 8, lane G6):
// the site's game world shot from a level's own cameras, laid beside the
// owner's screenshots of the real game from the same cameras.
//
//   node scripts/bf2017-compare.mjs <level> [--mode a,b] [--tier high] [--locators] [--gizmos [n]] [--size 1280x720] [--wait 900000]
//   node scripts/bf2017-compare.mjs <level> --list [--mode a,b] [--locators]
//   node scripts/bf2017-compare.mjs --page
//
//   <level>    the map rulebook's name or the game's key (hoth, hoth_01)
//   mode       whose cameras (by layer; default every mode the map has
//              cameras for). The world runs the level's built mode
//              (Galactic Assault) whatever cameras are shot: a camera is a
//              place to look from, the level is the same
//   tier       the quality forced through tp-quality (default high)
//   locators   the layer's locators too (EOR and outro spots; level, no pitch)
//   gizmos     then the overlay on (?gizmos=1's), shot from the first n
//              Galactic Assault cameras (default 2) to gizmos-<key>-<camera>.png
//   list       the cameras and the file names the game's shots take; no browser
//   page       rebuild index.html from the shots on disk; no browser
//
// Shots go to docs/superpowers/evidence/bf2017-parity/site/<key>/<camera>.jpg
// (git-ignored) and a .thumb.jpg 480 wide beside each (committed), with a
// check.json the parity ledger reads. The owner's shots are
// game/<key>/<camera>.jpg (git-ignored but for *.thumb.jpg); the README says
// how to take them. index.html pairs them, with the mean absolute
// difference at 256 wide and notes.md's line for the camera.
//
// Headless Chromium here draws in software GL (a Hoth landing takes 1–4
// minutes, each camera another minute while its cells stream in); the
// WebGPU leg is the owner's laptop.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { camerasFor, comparePage, levelKey, meanError, modeOfLayer, notesOf } from './lib/bf2017-parity.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EV = join(ROOT, 'docs/superpowers/evidence/bf2017-parity');
const args = parseArgs(process.argv.slice(2));
const sharp = (await import('sharp')).default;

function mapOf(name) {
  const dir = join(ROOT, 'src/data/bf2017/maps');
  for (const f of readdirSync(dir).filter((n) => /^[a-z0-9_]+\.json$/.test(n))) {
    const rows = JSON.parse(readFileSync(join(dir, f), 'utf8')).rows;
    if (!rows?.level) continue;
    const short = f.replace(/\.json$/, '');
    if (name === short || name === levelKey(rows.level)) return { short, key: levelKey(rows.level), rows };
  }
  throw new Error(`no map rulebook for ${name}`);
}

async function raw(file) {
  return sharp(file).resize(256, 144, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true }).then(({ data, info }) => ({ data, channels: info.channels }));
}

async function buildPage() {
  const notes = notesOf(existsSync(join(EV, 'notes.md')) ? readFileSync(join(EV, 'notes.md'), 'utf8') : '');
  const levels = [];
  const out = {};
  const site = join(EV, 'site');
  for (const level of existsSync(site) ? readdirSync(site).sort() : []) {
    const list = JSON.parse(readFileSync(join(site, level, 'cameras.json'), 'utf8'));
    const shots = [];
    for (const c of list) {
      const full = join(site, level, `${c.file}.jpg`);
      const thumb = join(site, level, `${c.file}.thumb.jpg`);
      if (!existsSync(full) && !existsSync(thumb)) continue;
      const gameFull = join(EV, 'game', level, `${c.file}.jpg`);
      const gameThumb = join(EV, 'game', level, `${c.file}.thumb.jpg`);
      const game = existsSync(gameFull) ? gameFull : existsSync(gameThumb) ? gameThumb : null;
      const error = game ? +meanError(await raw(existsSync(full) ? full : thumb), await raw(game)).toFixed(4) : null;
      const rel = (p) => p.slice(EV.length + 1).replaceAll('\\', '/');
      shots.push({ id: c.id, file: c.file, mode: c.mode, site: rel(existsSync(full) ? full : thumb), game: game && rel(game), error, note: notes[c.file] ?? '' });
    }
    levels.push({ level, shots });
    out[level] = shots.map(({ id, mode, error }) => ({ id, mode, error }));
  }
  writeFileSync(join(EV, 'index.html'), comparePage(levels));
  writeFileSync(join(EV, 'compare.json'), `${JSON.stringify(out, null, 1)}\n`);
  console.log(`compare: ${levels.reduce((n, l) => n + l.shots.length, 0)} cameras on ${levels.length} levels, ${Object.values(out).flat().filter((s) => s.error != null).length} paired with the game; wrote index.html`);
}

if (args.page) {
  await buildPage();
  process.exit(0);
}

const name = args._[0];
if (!name) {
  console.error('usage: node scripts/bf2017-compare.mjs <level> [--mode a,b] [--tier high] [--locators] [--list] | --page');
  process.exit(2);
}
const map = mapOf(name);
const withCameras = [...new Set((map.rows.cameras ?? []).map((c) => modeOfLayer(c.layer, c.mode)))];
const modes = args.mode ? String(args.mode).split(',') : withCameras;
const cams = camerasFor(map.rows, modes, { locators: Boolean(args.locators) });

if (args.list) {
  console.log(`${map.key}: ${cams.length} cameras for ${modes.join(', ')} (the game's shot of each: docs/superpowers/evidence/bf2017-parity/game/${map.key}/<file>.jpg)`);
  for (const c of cams) console.log(`  ${c.file}.jpg  ${c.mode}  ${c.kind}  at ${c.at.map((v) => v.toFixed(1)).join(', ')}  yaw ${c.yaw.toFixed(3)}  pitch ${c.pitch.toFixed(3)}`);
  process.exit(0);
}

const OUT = join(EV, 'site', map.key);
mkdirSync(OUT, { recursive: true });
const TIER = args.tier ?? 'high';
const [W, H] = String(args.size ?? '1280x720').split('x').map(Number);
const WAIT = Number(args.wait ?? 900000);
const ROUTE = `/battlefront/${map.short}/galacticAssault`;

const { chromium } = await import('playwright-core');
const exe = process.env.CHROMIUM ?? readdirSync('/opt/pw-browsers', { withFileTypes: true }).filter((d) => /^chromium-\d+$/.test(d.name)).map((d) => `/opt/pw-browsers/${d.name}/chrome-linux/chrome`).find(existsSync);
if (!exe) {
  console.error('no Chromium (set CHROMIUM=/path/to/chrome)');
  process.exit(2);
}
const swift = process.platform === 'linux' && !process.env.DISPLAY;
const { createServer } = await import('vite');
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { host: '127.0.0.1', port: 0, hmr: false, watch: null }, logLevel: 'error',
  // (the scan from the page alone, three's node build bundled up front: a
  // re-optimise half-way through the landing breaks its dynamic imports)
  optimizeDeps: { entries: ['index.html'], include: ['react-icons/lib', 'three/webgpu', 'three/tsl'] } });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ executablePath: exe, args: [...(swift ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []), '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
await ctx.addInitScript((q) => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
  window.localStorage.setItem('tp-quality', q);
}, TIER);
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
const frames = (n) => page.evaluate((k) => new Promise((done) => {
  let left = k;
  const tick = () => (--left <= 0 ? done() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), n);

const result = { leg: 'webgl', tier: TIER, errors, shots: {} };
const t0 = Date.now();
try {
  await page.goto(`${base}/#${ROUTE}?gpu=webgl`, { waitUntil: 'domcontentloaded', timeout: WAIT });
  await page.waitForFunction(() => Boolean(window.__battlefront?.view), null, { timeout: WAIT, polling: 1000 });
  await page.waitForFunction(() => window.__battlefront.view().level.loaded, null, { timeout: WAIT, polling: 1000 });
  result.loadedMs = Date.now() - t0;
  // the picture alone: the HUD and the deploy screen hidden
  await page.addStyleTag({ content: '* { visibility: hidden !important; } canvas, .bf-gizmo-legend, .bf-gizmo-legend *, .bf-gizmo-label { visibility: visible !important; }' });
  for (const c of cams) {
    const t = Date.now();
    await page.evaluate((cam) => window.__battlefront.do('camera', cam), c);
    await frames(3);
    await page.waitForFunction(() => window.__battlefront.view().level.loaded, null, { timeout: WAIT, polling: 1000 });
    await frames(20);
    const file = join(OUT, `${c.file}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 88, timeout: WAIT });
    await sharp(file).resize(480).jpeg({ quality: 70 }).toFile(join(OUT, `${c.file}.thumb.jpg`));
    result.shots[c.file] = `site/${map.key}/${c.file}.thumb.jpg`;
    console.log(`  ${c.file} (${c.mode}) in ${((Date.now() - t) / 1000).toFixed(0)} s`);
  }
  // the overlay's shots: the layer's rows over the level from the first
  // cameras, the legend and the labels on (evidence/bf2017-parity/gizmos-*.png)
  if (args.gizmos) {
    await page.evaluate(() => window.__battlefront.do('gizmos', true));
    for (const c of cams.filter((x) => x.mode === 'galacticAssault').slice(0, Number(args.gizmos) || 2)) {
      await page.evaluate((cam) => window.__battlefront.do('camera', cam), c);
      await frames(3);
      await page.waitForFunction(() => window.__battlefront.view().level.loaded, null, { timeout: WAIT, polling: 1000 });
      await frames(20);
      await page.waitForTimeout(500);
      const file = join(EV, `gizmos-${map.key}-${c.file}.png`);
      const png = await page.screenshot({ timeout: WAIT });
      await sharp(png).resize(960).png({ palette: true, quality: 80 }).toFile(file);
      result.shots[`gizmos-${c.file}`] = file.slice(EV.length + 1);
    }
    result.gizmos = await page.evaluate(() => window.__battlefront.do('gizmos', true).counts);
  }
} catch (e) {
  result.failed = String(e).split('\n')[0];
  result.gates = true;
}
result.ms = Date.now() - t0;
await browser.close();
await server.close();

writeFileSync(join(OUT, 'cameras.json'), `${JSON.stringify(cams, null, 1)}\n`);
writeFileSync(join(OUT, 'check.json'), `${JSON.stringify({ route: ROUTE, size: [W, H], swiftshader: swift, results: [result] }, null, 2)}\n`);
console.log(JSON.stringify({ ...result, shots: Object.keys(result.shots).length }, null, 2));
await buildPage();
process.exit(result.failed || errors.length ? 1 : 0);
