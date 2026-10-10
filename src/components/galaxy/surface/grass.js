// Where a world's grass grows (the blades themselves are lib/three/grass's,
// Bruno's, standing on the ground map; groundPaint.js paints the map with
// this): none on steep ground, under water, on the places' built ground or
// the landing pad; in drifts by a noise. Pure, so a test can read it.
//
// A site's `grass`: { h: [lo, hi] metres, w: blade width, cover: 0…1 how
// much of the land it covers, scale: the drifts' size in metres, slope:
// [steep, flat] (the ground's normal y it fades in over), above: metres
// over the water it starts, wind: how hard it blows here (0…1) }
//
//   coverAt(grid, site, x, z, { e }) → 0…1
//   coverMap(grid, site, { size }) → RGBA bytes over the walkable square
//     (red: cover, green: how tall, blue: how dry), row by row from -z
import { HALF } from './terrain';
import { fbm, smoothstep } from './noise';

// the cover picture's size (texels a side) over the walkable square
const COVER = 256;

// How much grass grows at one point of the land (0…1): none on steep
// ground, under the water, on the places' built ground or round the landing
// pad; in drifts by a noise (the cover map reads this per texel, the ground
// map's painter per point)
// the landing pads a site lays on the ground, as [x, z, r] (r a little
// past their edge), its own and its places' (found once a site)
const PADS = new WeakMap();
function padsOf(site) {
  let list = PADS.get(site);
  if (list) return list;
  list = [];
  const add = (t, ox = 0, oz = 0) => {
    if (t.kind !== 'pad' || !t.at) return;
    const r = t.opts?.r ?? 14;
    list.push([ox + t.at[0], oz + t.at[1], (t.opts?.shape === 'square' ? r * 1.42 : r) + 3]);
  };
  for (const t of site.things ?? []) add(t);
  for (const p of site.places ?? []) for (const t of p.things ?? []) add(t, p.at[0], p.at[1]);
  PADS.set(site, list);
  return list;
}

export function coverAt(grid, site, x, z, { e = 2.5 } = {}) {
  const g = site.grass;
  if (!g) return 0;
  const seed = (site.ground?.seed ?? 1) + 101;
  const [steep, flat] = g.slope ?? [0.84, 0.94];
  const water = site.water?.level ?? null;
  const above = g.above ?? 0.4;
  const cover = g.cover ?? 0.7;
  const scale = g.scale ?? 90;
  let k = smoothstep(steep, flat, grid.normalAt(x, z, e)[1]);
  if (k > 0 && water != null) k *= smoothstep(water + above, water + above + 0.6, grid.heightAt(x, z));
  if (k > 0) {
    for (const p of site.places ?? []) {
      if (!p.flat) continue;
      k *= smoothstep(p.flat.r, p.flat.r + 6, Math.hypot(x - p.at[0], z - p.at[1]));
      if (k <= 0) break;
    }
    const land = site.land?.at ?? [0, 0];
    k *= smoothstep(26, 32, Math.hypot(x - land[0], z - land[1]));
    // (and none through the landing pads laid on it)
    for (const [px, pz, r] of padsOf(site)) {
      if (k <= 0) break;
      k *= smoothstep(r, r + 4, Math.hypot(x - px, z - pz));
    }
  }
  if (k <= 0) return 0;
  // (in drifts, not everywhere alike)
  const n = fbm(x / scale, z / scale, { octaves: 3, seed }) * 0.5 + 0.5;
  return k * smoothstep(1 - cover - 0.2, 1 - cover + 0.2, n);
}

// Where grass grows, how tall and how dry, over the walkable square
// (±HALF): RGBA bytes, row by row from -z, column by column from -x. Pure,
// so a test can read it.
export function coverMap(grid, site, { size = COVER } = {}) {
  const g = site.grass ?? {};
  const out = new Uint8Array(size * size * 4);
  const seed = (site.ground?.seed ?? 1) + 101;
  const scale = g.scale ?? 90;
  const step = (2 * HALF) / size;
  for (let j = 0; j < size; j++) {
    const z = -HALF + (j + 0.5) * step;
    for (let i = 0; i < size; i++) {
      const x = -HALF + (i + 0.5) * step;
      const k = coverAt(grid, site, x, z, { e: step * 0.5 });
      const tall = 0.55 + 0.45 * (fbm(x / (scale * 0.4), z / (scale * 0.4), { octaves: 2, seed: seed + 7 }) * 0.5 + 0.5);
      const dry = smoothstep(-0.15, 0.45, fbm(x / (scale * 1.7), z / (scale * 1.7), { octaves: 2, seed: seed + 13 }));
      const o = (j * size + i) * 4;
      out[o] = Math.round(k * 255);
      out[o + 1] = Math.round(tall * 255);
      out[o + 2] = Math.round(dry * 255);
      out[o + 3] = 255;
    }
  }
  return out;
}
