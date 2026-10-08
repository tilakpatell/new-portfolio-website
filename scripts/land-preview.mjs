// A planet's land, seen from above before a triangle is drawn: renders the
// masks of a square of cells (src/lib/land/cell.js) to a PNG, so a river's
// shape can be judged from a seed. Height is the grey underlay (dark low,
// light high), grass (G) is green over it, water depth (B) blue, the sea and
// the lakes and rivers alike.
//
//   node scripts/land-preview.mjs <seed> [type] [--cells K] [cx cz ...]
//
// With no cx cz: a K × K square of cells (3 by default) round (0, 0), to
// scripts/.cache/land-<seed>-<type>-<K>.png. With them: each cell alone, to
// scripts/.cache/land-<seed>-<cx>-<cz>.png.

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { CELL, MASK, heightAt, makeCell } from '../src/lib/land/cell.js';
import { LAND_TYPES, landSpec } from '../src/lib/land/spec.js';

const args = process.argv.slice(2);
if (!args.length) {
  console.error('usage: node scripts/land-preview.mjs <seed> [type] [--cells K] [cx cz ...]');
  process.exit(1);
}
const seed = args.shift();
const type = LAND_TYPES.includes(args[0]) ? args.shift() : 'temperate';
let cells = 3;
const k = args.indexOf('--cells');
if (k >= 0) {
  cells = Math.max(1, parseInt(args[k + 1], 10) || 3);
  args.splice(k, 2);
}
const spec = landSpec(seed, type);
const out = join(dirname(fileURLToPath(import.meta.url)), '.cache');
mkdirSync(out, { recursive: true });

async function render(list, w, h, file) {
  // the cells' masks laid side by side, +x right and +z down
  const made = list.map(([cx, cz, gx, gz]) => ({ cell: makeCell(spec, cx, cz), gx, gz }));
  let lo = Infinity;
  let hi = -Infinity;
  for (const { cell } of made) for (const v of cell.heights) [lo, hi] = [Math.min(lo, v), Math.max(hi, v)];
  const W = w * MASK;
  const H = h * MASK;
  const px = Buffer.alloc(W * H * 3);
  for (const { cell, gx, gz } of made)
    for (let j = 0; j < MASK; j++)
      for (let i = 0; i < MASK; i++) {
        const t = (j * MASK + i) * 4;
        const g = cell.mask[t + 1] / 255;
        const b = cell.mask[t + 2] / 255;
        const ht = (heightAt(cell, ((i + 0.5) * CELL) / MASK, ((j + 0.5) * CELL) / MASK) - lo) / (hi - lo || 1);
        const grey = 50 + 170 * ht;
        let r = grey;
        let gg = grey;
        let bb = grey;
        r += (grey * 0.45 - r) * g;
        gg += (Math.min(255, grey * 0.9 + 60) - gg) * g;
        bb += (grey * 0.35 - bb) * g;
        const wet = b > 0 ? 0.55 + 0.45 * b : 0;
        r += (20 - r) * wet;
        gg += (90 + 60 * (1 - b) - gg) * wet;
        bb += (200 - bb) * wet;
        const o = ((gz * MASK + j) * W + gx * MASK + i) * 3;
        px[o] = r;
        px[o + 1] = gg;
        px[o + 2] = bb;
      }
  let img = sharp(px, { raw: { width: W, height: H, channels: 3 } });
  if (W > 2048) img = img.resize(2048, Math.round((2048 * H) / W));
  await img.png().toFile(file);
  console.log(file, `(${list.length} cells, heights ${lo.toFixed(1)}…${hi.toFixed(1)} m)`);
}

if (args.length >= 2) {
  for (let i = 0; i + 1 < args.length; i += 2) {
    const cx = parseInt(args[i], 10);
    const cz = parseInt(args[i + 1], 10);
    await render([[cx, cz, 0, 0]], 1, 1, join(out, `land-${seed}-${cx}-${cz}.png`));
  }
} else {
  const half = Math.floor(cells / 2);
  const list = [];
  for (let gz = 0; gz < cells; gz++) for (let gx = 0; gx < cells; gx++) list.push([gx - half, gz - half, gx, gz]);
  await render(list, cells, cells, join(out, `land-${seed}-${type}-${cells}.png`));
}
