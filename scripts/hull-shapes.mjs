/* global window */
// Bakes src/components/universe/hullShapes.js: each capital ship's shape for
// flying into, fitted to its model (universe/hullFit.js). For every kind with
// a hull (wars.js's HULLS) and every big ship the galaxy's systems place, it
// makes the galaxy's slot of it at length 1 in the page, waits for its model,
// samples its surface and fits the spheres. With the dev server up
// (npx vite --port 5188) and Chromium where Playwright keeps it:
//   node scripts/hull-shapes.mjs
//   CHROME=… BASE=… MAX=40 (spheres a ship) KINDS=destroyer,venator (just these, merged in)
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';

const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const max = Number(process.env.MAX ?? 40);
const file = new URL('../src/components/universe/hullShapes.js', import.meta.url);

// the kinds: HULLS's, and the galaxy's placed ships over 3 units long
const kinds = new Set();
const wars = readFileSync(new URL('../src/components/universe/wars.js', import.meta.url), 'utf8');
const hulls = wars.slice(wars.indexOf('export const HULLS'), wars.indexOf('};', wars.indexOf('export const HULLS')));
for (const [, k] of hulls.matchAll(/^\s+(\w+): \[\[/gm)) kinds.add(k);
const systems = readFileSync(new URL('../src/components/galaxy/systems.js', import.meta.url), 'utf8');
for (const [, k, size] of systems.matchAll(/kind: '(\w+)'[^}]*?size: ([\d.]+)/g)) if (Number(size) > 3) kinds.add(k);
for (const k of ['coreship', 'deathstar2', 'deathstar', 'cloudcity', 'gate']) kinds.delete(k); // (round, world.js's ROUND, or a station with its own)
const only = process.env.KINDS?.split(',');

const browser = await chromium.launch({ executablePath: chrome, args: ['--use-angle=metal', '--use-gl=angle', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-worlds', '"load"');
  window.sessionStorage.setItem('tp-galaxy-intro', '1');
});
await page.goto(`${base}/#/galaxy/tatooine?quality=low`);
await page.waitForFunction(() => window.__galaxyDebug?.models, null, { timeout: 120000 });
const shapes = await page.evaluate(
  async ({ list, max }) => {
    const { fitHull, sampleSurface } = await import('/src/components/universe/hullFit.js');
    const { MODELS } = await import('/src/components/galaxy/models.js');
    const { createFleet } = await import('/src/components/universe/glbFleet.js');
    const { models } = window.__galaxyDebug;
    const fleet = createFleet();
    const wait = async (done, ms) => {
      const t0 = performance.now();
      while (!done() && performance.now() - t0 < ms) await new Promise((r) => setTimeout(r, 100));
    };
    // (centred, its biggest side 1: as the galaxy's models.js fits one)
    const unit = (pts) => {
      const lo = [Infinity, Infinity, Infinity];
      const hi = [-Infinity, -Infinity, -Infinity];
      for (const p of pts)
        for (let i = 0; i < 3; i++) {
          lo[i] = Math.min(lo[i], p[i]);
          hi[i] = Math.max(hi[i], p[i]);
        }
      const k = 1 / Math.max(...hi.map((v, i) => v - lo[i]));
      return pts.map((p) => p.map((v, i) => (v - (lo[i] + hi[i]) / 2) * k));
    };
    const out = {};
    for (const kind of list) {
      // the galaxy's (a kind that loads: its model, not its stand-in), else the universe map's fleet
      const s = models.slot(kind, 1);
      if (MODELS[kind]) await wait(() => s.real, 60000);
      let pts = s.ready ? sampleSurface(s.holder, { step: 0.02 }) : [];
      let from = s.real ? 'model' : 'built';
      models.drop(s);
      if (!pts.length) {
        fleet.want([kind]);
        await wait(() => fleet.loaded?.(kind) || fleet.has?.(kind), 20000);
        const m = fleet.make(kind);
        if (!m) continue;
        pts = sampleSurface(m.group, { step: 0.02 });
        from = m.model ? 'universe model' : 'universe built';
      }
      if (pts.length) out[kind] = { spheres: fitHull(unit(pts), { max }), real: from };
    }
    return out;
  },
  { list: (only ?? [...kinds]).filter((k) => kinds.has(k) || only), max },
);
await browser.close();

// merged into what's there (KINDS bakes a few)
let old = {};
try {
  const src = readFileSync(file, 'utf8');
  old = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
} catch {
  // (a first bake)
}
const all = { ...old, ...Object.fromEntries(Object.entries(shapes).map(([k, v]) => [k, v.spheres])) };
const sorted = Object.fromEntries(Object.keys(all).sort().map((k) => [k, all[k]]));
const body = JSON.stringify(sorted).replace(/\],"/g, '],\n  "').replace(/^\{/, '{\n  ').replace(/\}$/, ',\n}');
writeFileSync(
  file,
  `// Each capital ship's shape for flying into: [x, y, z, r] spheres at length 1
// (nose +z, +y up, centred as the galaxy's models.js fits it), fitted to its
// model's surface by universe/hullFit.js. Made by scripts/hull-shapes.mjs:
// bake again when a model changes. wars.js's hullOf reads it.
export const SHAPES = ${body};
`,
);
for (const [k, v] of Object.entries(shapes)) console.log(k.padEnd(14), String(v.spheres.length).padStart(3), v.real);
const missed = (only ?? [...kinds]).filter((k) => !shapes[k]);
if (missed.length) console.log('no model:', missed.join(', '));
