// The layers a land is summed from, in metres: broad swells, rolling
// hills, dunes along the wind, mesas, ridges, mountains round the horizon,
// channels, islands, a level. The galaxy's surfaces (galaxy/surface/terrain.js)
// and the planets' land (this folder) both sum them, so they agree on what a
// hill is. The flight's planets add a wind to the ridges, a range with no
// `to` and the blocks of a city (lib/land/flight).
//
// Pure: imports nothing but the galaxy's noise (galaxy/surface/noise.js, a
// pure module), and runs in Node and in a worker.
//
//   LAYERS[type](x, z, layer, seed) → metres
//   fieldAt(spec, x, z) → the sum of spec.relief, layer i seeded spec.seed + i,
//     each times its weight (1 when left out), on spec.base (0)
//   noise2(x, z, seed) → the galaxy's value noise, −1…1, a bump a unit
//     (passed on: cell.js clumps the flora by it)

import { fbm, hash2, noise2, ridged, smoothstep } from '../../components/galaxy/surface/noise.js';

export { noise2 };

export const BLOCK_WALL = 14; // m a metre: a tower's wall, steep, not sheer

export const LAYERS = {
  // broad rises and falls, ±height
  swell: (x, z, l, seed) => fbm(x / l.scale, z / l.scale, { octaves: 4, seed }) * l.height,
  // rolling hills, 0…height (`gain` under 0.5: rounder, the cartoon kind)
  hills: (x, z, l, seed) => (fbm(x / l.scale, z / l.scale, { octaves: l.octaves ?? 5, gain: l.gain ?? 0.5, seed }) * 0.5 + 0.5) * l.height,
  // dunes: crests across the wind, sharp on top, strung out along it; 0…height
  dunes: (x, z, l, seed) => {
    const a = l.wind ?? 0;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const u = x * c - z * s; // along the wind
    const v = x * s + z * c; // across it
    const crest = ridged(u / (l.scale * 2.6), v / l.scale, { octaves: 3, seed, gain: 0.45 });
    const where = smoothstep(-0.35, 0.35, fbm(x / (l.scale * 6), z / (l.scale * 6), { octaves: 2, seed: seed + 5 }));
    return crest ** 1.6 * l.height * (0.35 + 0.65 * where);
  },
  // flat-topped mesas with steep sides: 0…height where the noise is over `cover`
  mesas: (x, z, l, seed) => {
    const m = fbm(x / l.scale, z / l.scale, { octaves: 4, seed });
    const up = smoothstep(l.cover, l.cover + (l.cliff ?? 0.05), m);
    const ledge = smoothstep(l.cover - 0.12, l.cover - 0.06, m) * 0.18; // a step at the foot
    return (up * (1 + fbm(x / 40, z / 40, { octaves: 2, seed: seed + 3 }) * 0.04) + ledge * (1 - up)) * l.height;
  },
  // sharp ridges: 0…height; with a `wind` (an angle) they run long and
  // parallel along it, as a fold range's do
  ridges: (x, z, l, seed) => {
    if (l.wind === undefined) return ridged(x / l.scale, z / l.scale, { octaves: l.octaves ?? 5, seed }) * l.height;
    const c = Math.cos(l.wind);
    const s = Math.sin(l.wind);
    return ridged((x * c - z * s) / (l.scale * 4), (x * s + z * c) / l.scale, { octaves: l.octaves ?? 5, seed }) * l.height;
  },
  // mountains round the horizon, rising from `from` metres out to their full
  // height by `to`; with no `to`, a range at its full height everywhere
  mountains: (x, z, l, seed) => {
    const r = Math.hypot(x, z);
    if (r < l.from) return 0;
    const k = l.to === undefined ? 1 : smoothstep(l.from, l.to, r);
    return k * (0.3 + 0.7 * ridged(x / l.scale, z / l.scale, { octaves: 6, seed })) * l.height;
  },
  // rivers (of water, lava, salt): channels `depth` deep where the noise crosses zero
  channels: (x, z, l, seed) => {
    const n = fbm(x / l.scale, z / l.scale, { octaves: 3, seed });
    const wobble = noise2(x / 23, z / 23, seed + 9) * 0.012;
    return -(1 - smoothstep(0, l.width ?? 0.06, Math.abs(n + wobble))) * l.depth;
  },
  // an island (or a hill, or a crater with a negative height): `height` at
  // `at`, falling away to nothing by `r`, its edge broken up
  island: (x, z, l, seed) => {
    const [cx, cz] = l.at ?? [0, 0];
    const far = Math.hypot(x - cx, z - cz);
    const ragged = l.ragged ?? 0.35;
    // (out of its reach however the edge is broken, fbm being -1…1: no noise needed)
    if (far * (1 - ragged) >= l.r && (l.core ?? 0.25) < 1) return 0;
    const d = far * (1 + fbm(x / (l.r * 0.5), z / (l.r * 0.5), { octaves: 3, seed }) * ragged);
    return smoothstep(l.r, l.r * (l.core ?? 0.25), d) * l.height;
  },
  // a constant
  level: (x, z, l) => l.height,
  // a city from the air: a grid of `cell`-metre lots, `gap` of street
  // between them, a share `cover` built on, each tower's height seeded from
  // its lot (hMin…hMax), flat on top. Its walls lean in at BLOCK_WALL
  // metres a metre, not straight up, so no two points 4 m apart differ by
  // more than a ship at its slowest can climb
  blocks: (x, z, l, seed) => {
    const ix = Math.floor(x / l.cell);
    const iz = Math.floor(z / l.cell);
    const half = l.gap / 2;
    const u = x - ix * l.cell;
    const v = z - iz * l.cell;
    const inside = Math.min(u - half, l.cell - half - u, v - half, l.cell - half - v);
    if (inside <= 0 || hash2(ix, iz, seed + 7) >= l.cover) return 0;
    return Math.min(l.hMin + hash2(ix, iz, seed) * (l.hMax - l.hMin), inside * BLOCK_WALL);
  },
};

// The land's height from its relief alone: no rivers, no flats
export function fieldAt(spec, x, z) {
  const relief = spec.relief;
  const seed = spec.seed | 0;
  let h = spec.base ?? 0;
  for (let i = 0; i < relief.length; i++) {
    const l = relief[i];
    h += LAYERS[l.type](x, z, l, seed + i) * (l.weight ?? 1);
  }
  return h;
}
