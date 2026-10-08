// Dimension C-137's planet, drawn the way Rick and Morty draws an alien
// world: flat colour in three cel tones a biome, every shape inked round its
// edge (two texels at 2048, found on the biome's id, not its colour).
// Teal seas stepped deeper away from the coast, purple continents with
// lilac highlands and pale peaks, pink deserts, lime jungle, lakes of
// glowing green ooze (flat lime: no tones), a few big cartoon craters with a
// lit rim and a shadow cast across the floor from it, ice at the poles, and
// clouds as the show's puffs: white, a lavender underside, inked.
//
// Makes rickmorty and rickmorty-clouds (RGBA) at 2048 (-hq), 1024 and 512
// (-sm), rickmorty-glow (the ooze) and rickmorty-rough (sea 0.25, land 0.9)
// at 1024. ONLY=rough makes the roughness map alone.

import { clamp, eachTexel, fbm, hex, perlin, ridged, save, bakeSize } from './sphere.mjs';

// (8192 × 4096 with --ultra: sphere.mjs's bakeSize)
const [W, H] = bakeSize();
const deg = Math.PI / 180;

// region ids, and their colours: [base, shade]
const R = { DEEP: 0, SEA: 1, SHALLOW: 2, LAND: 3, HIGH: 4, PEAK: 5, DESERT: 6, JUNGLE: 7, OOZE: 8, ICE: 9, CRATER: 10, RIM: 11, SHADOW: 12 };
const COLOURS = [
  ['#17708a', '#13617a'],
  ['#1f8fa3', '#1b8196'],
  ['#4ccfc6', '#41bdb6'],
  ['#7d4cb5', '#6a3e9e'],
  ['#a87ad6', '#9467c4'],
  ['#ead9ff', '#d6c0f5'],
  ['#f19dc9', '#e086b6'],
  ['#8bcf45', '#6fb536'],
  ['#b9f24c', '#a6e33c'],
  ['#e4f8ff', '#cbeaf6'],
  ['#5a3488', '#4e2d78'],
  ['#b993e6', '#a47fd3'],
  ['#3a1f60', '#331b55'],
  // (a third, lighter tone of each: an eighth of the way to white)
].map(([a, b]) => [hex(a), hex(b), hex(a).map((v) => v + (1 - v) * 0.125)]);
const INK = hex('#1c0f30');

// the craters: [lat, phi, radius in radians]
const CRATERS = [
  [18, Math.PI + 0.35, 0.09],
  [-24, Math.PI - 0.3, 0.06],
  [42, Math.PI - 0.9, 0.05],
  [-10, 0.6, 0.08],
  [30, 1.9, 0.055],
].map(([la, ph, r]) => [[-Math.cos(ph) * Math.cos(la * deg), Math.sin(la * deg), Math.sin(ph) * Math.cos(la * deg)], r]);

// each crater's floor, moved a third of its radius toward the south-east:
// where the moved floor doesn't reach is the crescent its rim shades, a
// shadow drawn in from the upper left, as the show lights its craters
const SHADED = CRATERS.map(([c, r]) => {
  const east = [c[2], 0, -c[0]];
  const len = Math.hypot(...east) || 1;
  const e = east.map((v) => v / len);
  const north = [c[1] * e[2] - c[2] * e[1], c[2] * e[0] - c[0] * e[2], c[0] * e[1] - c[1] * e[0]];
  const m = c.map((v, k) => v + (e[k] - north[k] * 0.6) * r * 0.33);
  const ml = Math.hypot(...m);
  return m.map((v) => v / ml);
});

// Where the id changes within `r` texels, ink: the outlines.
function inkPass(ids, w, h, r, test) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const me = ids[i];
      let edge = 0;
      for (let dy = -r; dy <= r && !edge; dy++) {
        const yy = Math.min(h - 1, Math.max(0, y + dy));
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue;
          const other = ids[yy * w + ((x + dx + w) % w)];
          if (other !== me && test(me, other)) {
            edge = 1;
            break;
          }
        }
      }
      out[i] = edge;
    }
  }
  return out;
}

export async function bake() {
  const n1 = perlin(41);
  const n2 = perlin(42);
  const n3 = perlin(43);
  const n4 = perlin(44);
  const n5 = perlin(45);
  const nc = perlin(46);
  const ids = new Uint8Array(W * H);
  const shade = new Uint8Array(W * H);
  const cloudIds = new Uint8Array(W * H); // 0 none, 1 cloud, 2 its underside

  eachTexel(W, H, (x, y, z, i, lat) => {
    const alat = Math.abs(lat / deg);
    const field = fbm(n1, x * 2.2, y * 2.2, z * 2.2, { octaves: 5 }) + fbm(n2, x * 9, y * 9, z * 9, { octaves: 2 }) * 0.05;
    const sea = 0.04;
    let id;
    if (field < sea) id = field < sea - 0.2 ? R.DEEP : field < sea - 0.06 ? R.SEA : R.SHALLOW;
    else {
      const up = field - sea + ridged(n3, x * 5, y * 5, z * 5, { octaves: 2 }) * 0.12;
      const wet = fbm(n4, x * 3, y * 3, z * 3, { octaves: 3 });
      id = R.LAND;
      if (wet > 0.16) id = R.JUNGLE;
      else if (wet < -0.18) id = R.DESERT;
      if (up > 0.26) id = R.HIGH;
      if (up > 0.38) id = R.PEAK;
      if (fbm(n5, x * 6, y * 6, z * 6, { octaves: 3 }) > 0.3 && up > 0.03 && up < 0.18) id = R.OOZE;
    }
    CRATERS.forEach(([c, r], k) => {
      const d = Math.acos(clamp(x * c[0] + y * c[1] + z * c[2], -1, 1));
      const m = SHADED[k];
      if (d < r) id = d > r * 0.8 ? R.RIM : Math.acos(clamp(x * m[0] + y * m[1] + z * m[2], -1, 1)) > r * 0.8 ? R.SHADOW : R.CRATER;
      else if (d < r * 1.15 && field >= sea) id = R.HIGH;
    });
    if (alat > 72 + fbm(n2, x * 6, y * 6, z * 6, { octaves: 3 }) * 8) id = R.ICE;
    ids[i] = id;
    // the cel tones: darker where a slow noise is high, lighter where it's
    // low (not the ooze, which is flat, nor the shadow)
    const tone = fbm(n3, x * 3.5 + 3, y * 3.5, z * 3.5, { octaves: 2 });
    shade[i] = id <= R.SHALLOW || id === R.OOZE || id === R.SHADOW ? 0 : tone > 0.14 ? 1 : tone < -0.16 ? 2 : 0;
    // the puffs: a hard edge on a lumpy field, the underside a little lower in it
    const cv = fbm(nc, x * 5, y * 5, z * 5, { octaves: 5 }) + fbm(nc, x * 18 + 4, y * 18, z * 18, { octaves: 2 }) * 0.2;
    cloudIds[i] = cv > 0.26 ? (cv < 0.3 ? 2 : 1) : 0;
  });

  console.log('c-137: inking');
  // the coasts thick and dark; inside, a thinner line between lands
  const coast = inkPass(ids, W, H, 3, (a, b) => (a <= R.SHALLOW) !== (b <= R.SHALLOW));
  const inner = inkPass(ids, W, H, 2, (a, b) => a > R.SHALLOW && b > R.SHALLOW);
  const reefs = inkPass(ids, W, H, 1, (a, b) => a <= R.SHALLOW && b <= R.SHALLOW);
  const cloudInk = inkPass(cloudIds, W, H, 3, (a, b) => (a === 0) !== (b === 0));

  const albedo = new Float32Array(W * H * 3);
  const glow = new Float32Array(W * H * 3);
  const clouds = new Float32Array(W * H * 4);
  const ooze = hex('#b6f04a');
  for (let i = 0; i < W * H; i++) {
    let c = COLOURS[ids[i]][shade[i]];
    if (inner[i]) c = c.map((v) => v * 0.55);
    if (reefs[i]) c = c.map((v) => v * 0.82 + 0.06);
    if (coast[i]) c = INK;
    albedo.set(c, i * 3);
    if (ids[i] === R.OOZE && !coast[i] && !inner[i]) glow.set(ooze.map((v) => v * 0.75), i * 3);
    const q = i * 4;
    if (cloudInk[i]) {
      clouds.set([...INK.map((v) => v * 1.4), 0.9], q);
    } else if (cloudIds[i]) {
      clouds.set(cloudIds[i] === 2 ? [0.78, 0.74, 0.93, 0.96] : [0.98, 0.97, 1, 0.97], q);
    }
  }

  // how rough: the seas glossy, so they catch the sun (a glint, not a white
  // disc: the planet's own floor is 0.22), the ooze glossier, land matte
  const rough = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) rough[i] = ids[i] <= R.SHALLOW ? 0.25 : ids[i] === R.OOZE ? 0.3 : 0.9;

  // (ONLY=rough: just the roughness map, the others left as they are)
  const only = process.env.ONLY;
  if (only !== 'rough') {
    await save(albedo, W, H, 3, 'rickmorty', [[4096, '-xl'], [2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 90 });
    await save(glow, W, H, 3, 'rickmorty-glow', [[1024, '']], { quality: 88 });
    await save(clouds, W, H, 4, 'rickmorty-clouds', [[2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 86, alphaQuality: 90 });
  }
  await save(rough, W, H, 1, 'rickmorty-rough', [[1024, '']], { quality: 88 });
}
