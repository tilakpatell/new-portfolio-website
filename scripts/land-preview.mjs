// A planet's land, seen from above before a triangle is drawn: renders the
// masks of a square of cells (src/lib/land/cell.js) to a PNG, so a river's
// shape and the flora's clumps can be judged from a seed. Height is the grey
// underlay (dark low, light high), grass (G) is green over it (darker under
// the crowns' shade), water depth (B) blue, the sea and the lakes and rivers
// alike; the props are discs over it by kind (KINDS), a tree's and a bush's
// half as wide as the shade it casts (the shade shows in the grass round
// it), the rest their own small size.
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
// a prop's colour and its radius in metres when it casts no shade
const KINDS = {
  tree: [[18, 72, 30], 1.2],
  bush: [[70, 130, 40], 1],
  rock: [[120, 116, 112], 2],
  crate: [[220, 40, 40], 0.8],
  plant: [[40, 160, 90], 0.6],
  flower: [[240, 90, 200], 0.6],
  grass: [[190, 220, 90], 0.6],
  mushroom: [[200, 60, 30], 0.6],
  pebble: [[200, 185, 150], 0.5],
  path: [[230, 210, 160], 0.8],
};
const shadeOf = new Map([...spec.flora.species, ...spec.flora.cover].flatMap((r) => r.names.map((n) => [n, r.shade])));
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
  // the props over it, the small first (2 px a metre)
  const discs = [];
  for (const { cell, gx, gz } of made)
    for (const p of cell.props) {
      const [colour, size] = KINDS[p.kind] ?? [[255, 255, 255], 0.5];
      const shade = shadeOf.get(p.name) ?? 0;
      const at = [gx * MASK + ((p.x - cell.cx * CELL) / CELL) * MASK, gz * MASK + ((p.z - cell.cz * CELL) / CELL) * MASK];
      discs.push({ at, r: ((shade ? shade * p.scale * 0.5 : size) * MASK) / CELL, colour, alpha: shade ? 0.7 : 0.95 });
    }
  discs.sort((a, b) => a.r - b.r);
  for (const { at, r, colour, alpha } of discs)
    for (let y = Math.max(0, Math.floor(at[1] - r)); y <= Math.min(H - 1, Math.ceil(at[1] + r)); y++)
      for (let x = Math.max(0, Math.floor(at[0] - r)); x <= Math.min(W - 1, Math.ceil(at[0] + r)); x++) {
        if (Math.hypot(x + 0.5 - at[0], y + 0.5 - at[1]) > r) continue;
        const o = (y * W + x) * 3;
        for (let c = 0; c < 3; c++) px[o + c] += (colour[c] - px[o + c]) * alpha;
      }
  let img = sharp(px, { raw: { width: W, height: H, channels: 3 } });
  if (W > 2048) img = img.resize(2048, Math.round((2048 * H) / W));
  await img.png().toFile(file);
  console.log(file, `(${list.length} cells, heights ${lo.toFixed(1)}…${hi.toFixed(1)} m, ${discs.length} props)`);
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
