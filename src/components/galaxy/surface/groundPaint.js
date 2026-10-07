// A world's ground as one function of a point, for the ground map
// (lib/three/groundmap): the colour the ground shader paints there
// (ground.js's rule, written once more in JS so the map, the grass and
// the light the ground bounces up agree with the floor) and how much grass
// grows (grass.js's coverAt). Pure, so it's tested.
//
//   groundPainter(site, grid, { shade }) → { paint(x, z, out) → grass,
//     height(x, z) }
//     out: [r, g, b], linear (three's working space); grass 0…1
//     shade: [{ at: [x, z], r }]: the trees' crowns, under which the ground
//     is darker (SHADE.colour of itself) and the grass thinner (SHADE.grass)
//   mapAreaOf() → { x0, z0, w, d }: the walkable square (±HALF, round the
//     origin as the terrain grid lies), what the map covers
//
// The rule, as the shader has it: the low colour below hLow and the high
// above hHigh (the boundary wandered by a broad noise), patches of the
// accent where its noise is over 1 − accentCover, the deep colour in the
// hollows of a mid noise, rock where the slope is past rockAt, and a
// darkening toward the water's edge (the `wet` band); under the water, the
// deep colour. Where grass grows, the grass's own colour over it, as much as
// grows (its `mid`, toward its `dry` in drifts, as the old blades had them):
// the blades take the map's colour, and from far off a meadow is its grass.

import * as THREE from 'three';
import { fbm, smoothstep } from './noise';
import { coverAt } from './grass';
import { HALF } from './terrain';

export const SHADE = { colour: 0.75, grass: 0.4 };
// metres: a shade circle is found by the cells it touches, not by looking at them all
const CELL = 40;

export const mapAreaOf = () => ({ x0: -HALF, z0: -HALF, w: 2 * HALF, d: 2 * HALF });

// the shade circles by the cells each one touches → (x, z) → the list there
function bucket(shade) {
  const cells = new Map();
  for (const s of shade) {
    const [i0, i1] = [Math.floor((s.at[0] - s.r) / CELL), Math.floor((s.at[0] + s.r) / CELL)];
    const [j0, j1] = [Math.floor((s.at[1] - s.r) / CELL), Math.floor((s.at[1] + s.r) / CELL)];
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const k = `${i},${j}`;
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(s);
      }
  }
  return (x, z) => cells.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? null;
}

const col = (c, fallback) => new THREE.Color(c ?? fallback);
const n01 = (x, z, scale, seed) => fbm(x / scale, z / scale, { octaves: 3, seed }) * 0.5 + 0.5;
const mix = (a, b, t, out) => {
  for (let i = 0; i < 3; i++) out[i] = a[i] + (b[i] - a[i]) * t;
};

export function groundPainter(site, grid, { shade = [] } = {}) {
  const p = site.ground?.palette ?? {};
  const seed = site.ground?.seed ?? 1;
  const low = col(p.low, '#808080').toArray();
  const high = col(p.high, p.low ?? '#808080').toArray();
  const rock = col(p.rock, p.low ?? '#808080').toArray();
  const accent = col(p.accent, p.high ?? p.low ?? '#808080').toArray();
  const deep = col(p.deep, p.low ?? '#808080').toArray();
  const wetColour = col(p.wet?.color, '#000000').toArray();
  const hLow = p.hLow ?? 0;
  const hHigh = p.hHigh ?? 30;
  const rockAt = p.rockAt ?? 0.42;
  const accentCover = p.accentCover ?? 0;
  const patch = p.patch ?? 0.5;
  const wetLevel = p.wet?.level ?? null;
  const wetBand = p.wet?.band ?? 1.5;
  const water = site.water?.level ?? null;
  const g = site.grass ?? null;
  const grassMid = g?.mid ? col(g.mid).toArray() : null;
  const grassDry = g?.mid ? col(g.dry ?? g.mid).toArray() : null;
  const dryScale = (g?.scale ?? 90) * 1.7;
  const drySeed = seed + 101 + 13;
  const tmp = [0, 0, 0];
  const shadeAt = shade.length ? bucket(shade) : () => null;
  return {
    height: (x, z) => grid.heightAt(x, z),
    paint(x, z, out) {
      const h0 = grid.heightAt(x, z);
      if (water != null && h0 < water) {
        out[0] = deep[0];
        out[1] = deep[1];
        out[2] = deep[2];
        return 0;
      }
      const nBig = n01(x, z, 560, seed) * 0.65 + n01(x, z, 140, seed + 1) * 0.35;
      const nMid = n01(x, z, 70, seed + 2) * 0.6 + n01(x, z, 22, seed + 3) * 0.4;
      const h = h0 + (nBig - 0.5) * (hHigh - hLow) * 0.35;
      mix(low, high, smoothstep(hLow, hHigh, h), out);
      if (accentCover > 0) mix(out, accent, smoothstep(1 - accentCover, 1 - accentCover + 0.12, nBig * 0.7 + nMid * 0.45), out);
      mix(out, deep, smoothstep(0.62, 0.8, nMid) * 0.35 * patch, out);
      const slope = 1 - Math.max(0, Math.min(1, grid.normalAt(x, z)[1]));
      const k = smoothstep(rockAt, rockAt + 0.14, slope + (nMid - 0.5) * 0.16);
      if (k > 0) {
        // (strata)
        const strata = 0.78 + 0.4 * n01(x * 0.004 + z * 0.003, h0 * 0.035, 1, seed + 4);
        for (let i = 0; i < 3; i++) tmp[i] = rock[i] * strata;
        mix(out, tmp, k, out);
      }
      if (wetLevel != null) mix(out, wetColour, (1 - smoothstep(wetLevel, wetLevel + wetBand, h0)) * 0.75, out);
      let grass = coverAt(grid, site, x, z);
      if (grass > 0 && grassMid) {
        mix(grassMid, grassDry, smoothstep(-0.15, 0.45, fbm(x / dryScale, z / dryScale, { octaves: 2, seed: drySeed })), tmp);
        mix(out, tmp, grass, out);
      }
      for (const s of shadeAt(x, z) ?? []) {
        if (Math.hypot(x - s.at[0], z - s.at[1]) > s.r) continue;
        for (let i = 0; i < 3; i++) out[i] *= SHADE.colour;
        grass *= SHADE.grass;
      }
      return grass;
    },
  };
}
