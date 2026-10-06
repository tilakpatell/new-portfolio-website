// Breaking Bad's planet: New Mexico's high desert as a whole world, where the
// show was made. Ranges in long north–south lines with basins between them
// (the Basin and Range, worked out by noise stretched east–west), mesas
// stepped in the Chinle's red, white and purple bands (Ghost Ranch,
// Abiquiú), black lava of the malpais with cinder cones on it, White Sands'
// gypsum dunes in the low basins, dry washes, pale playas, juniper dotting
// the slopes and pine on the high ranges. One great river, the Rio Grande,
// winds down the face the map shows first, green with its bosque; on it,
// Albuquerque, its streets a grid, the Sandias' steep west face over it and
// the interstates crossing at the Big I, lit at night in sodium orange.
//
// Makes breakingbad (+ -sm), -normal (+ -sm), -rough, -night (+ -sm),
// -clouds (alpha, + -sm): summer's thunderheads over the mountains.

import { clamp, eachTexel, fbm, hex, mix, mix3, normalMap, perlin, ramp, ridged, save, smooth } from './sphere.mjs';

const W = 4096;
const H = 2048;
const LAT0 = (35 * Math.PI) / 180; // Albuquerque's latitude, on the face shown first
const CITY = 0.045; // the city's radius, in radians (drawn far bigger than life, to be seen)

export async function bake() {
  const n1 = perlin(21);
  const n2 = perlin(22);
  const n3 = perlin(23);
  const n4 = perlin(24);
  const n5 = perlin(25);
  const n6 = perlin(26);
  const nc = perlin(27);
  const albedo = new Float32Array(W * H * 3);
  const height = new Float32Array(W * H);
  const rough = new Float32Array(W * H * 3);
  const night = new Float32Array(W * H * 3);
  const clouds = new Float32Array(W * H * 3);

  // the city's frame: its middle, east and north
  const c0 = [Math.cos(LAT0), Math.sin(LAT0), 0];
  const e0 = [0, 0, -1];
  const n0 = [-Math.sin(LAT0), Math.cos(LAT0), 0];

  // the river's course east and west as it comes down, in radians
  const meander = (latD) => fbm(n6, 0, latD * 0.06, 3, { octaves: 5 }) * 0.16 + Math.sin(latD * 0.7) * 0.008;
  const floor = ramp([[0, '#b48a58'], [0.35, '#c79d66'], [0.65, '#d4ae78'], [1, '#e2c592']]);
  const grassland = ramp([[0, '#a99560'], [1, '#bea86f']]);
  // the Chinle's bands, up a mesa's side
  const STRATA = ['#9c4f36', '#b8673f', '#e6d6b3', '#8f6a6a', '#c98a52', '#a4553a', '#efe2c4', '#b07a55'].map(hex);
  const C = Object.fromEntries(
    Object.entries({
      caliche: '#e3d3ab', basalt: '#3b3430', basaltHi: '#524640', cinder: '#5a2e22', gypsum: '#f4f1ea', gypsumShade: '#e2ddd0', playa: '#ddd2bb',
      juniper: '#4c5634', pine: '#36452b', granite: '#7d5a4c', graniteHi: '#a87e6a', bosque: '#66733f', river: '#4f6a63', wash: '#e6d4ad',
      urban: '#9b9184', street: '#6c665f', freeway: '#55514c', snow: '#f1f2f0',
    }).map(([k, v]) => [k, hex(v)]),
  );

  eachTexel(W, H, (x, y, z, i, lat, lon) => {
    const latD = (lat * 180) / Math.PI;
    // the Basin and Range: noise stretched east–west, so its ridges run north–south
    const along = (k) => [x * k * 2.6, y * k * 0.7, z * k * 2.6];
    // provinces, as New Mexico has them: the Basin and Range's mountains in
    // one, the Colorado Plateau's mesas in another, open desert between
    const province = fbm(n5, x * 1.3 + 7, y * 1.3, z * 1.3, { octaves: 3 });
    const rangeProv = smooth(-0.02, 0.18, province);
    const plateauProv = smooth(0.06, 0.24, -province);
    const [ax, ay, az] = along(3.2);
    const ranges = smooth(0.58, 0.86, ridged(n1, ax, ay, az, { octaves: 5 })) * (0.15 + 0.85 * rangeProv);
    const basin = fbm(n2, x * 2.2, y * 2.2, z * 2.2, { octaves: 4 }) * 0.5 + 0.5;
    const detail = ridged(n3, x * 70, y * 70, z * 70, { octaves: 4 });
    // mesas: a plateau field stepped into terraces, each with a cliff
    const mesaF = fbm(n4, x * 5, y * 5, z * 5, { octaves: 5 }) * 0.5 + 0.5;
    const mesaZone = plateauProv;
    const steps = 5;
    const t = clamp((mesaF - 0.35) * 2.2) * steps;
    const level = Math.floor(t);
    const cliff = smooth(0.74, 0.86, t - level) * (1 - smooth(0.9, 0.99, t - level)); // the steep face up to the next step
    const terrace = (level + smooth(0.78, 0.98, t - level)) / steps;
    const mesa = terrace * mesaZone;
    // the low country, where the lava, the sands and the playas lie
    const low = 1 - smooth(0.25, 0.6, ranges + mesa * 0.8 + basin * 0.3);

    // ── the Rio Grande and the city ──
    const ca = clamp(x * c0[0] + y * c0[1] + z * c0[2], -1, 1);
    const ang = Math.acos(ca);
    const ex = x * e0[0] + y * e0[1] + z * e0[2];
    const ny = x * n0[0] + y * n0[1] + z * n0[2];
    // the river: a meridian on the near face, wandering, from the north
    // down past the city and on south
    let dlon = lon - Math.PI;
    if (dlon > Math.PI) dlon -= Math.PI * 2;
    const wander = meander(latD) - meander(35); // (through the city)
    const riverD = Math.abs(dlon - wander) * Math.cos(lat);
    const onRiver = latD < 62 && latD > -12 ? 1 : smooth(-22, -12, latD) * (1 - smooth(62, 70, latD));
    const water = smooth(0.0016, 0.0009, riverD) * onRiver;
    const bosque = smooth(0.006, 0.0025, riverD + (fbm(n3, x * 90, y * 90, z * 90, { octaves: 2 }) * 0.0015)) * onRiver;
    const valley = smooth(0.05, 0.004, riverD) * onRiver;
    // the Sandias: a long block just east of the river by the city, its west face a wall, its east side a long slope
    const sx = ex - 0.028;
    const sandiaLen = smooth(0.065, 0.04, Math.abs(ny + 0.005));
    const sandia = (sx < 0 ? smooth(-0.009, 0, sx) : smooth(0.03, 0, sx)) * sandiaLen * (ang < 0.3 ? 1 : 0);
    // Albuquerque: inside CITY of the middle, between the river and the mountain
    const sprawl = 1 + fbm(n2, x * 40, y * 40, z * 40, { octaves: 3 }) * 0.6;
    const cityK = smooth(CITY, CITY * 0.55, Math.hypot((ex + 0.004) * 1.35, ny * 0.8) * sprawl) * (1 - smooth(0.015, 0.03, sx + 0.012));
    // its grid of big blocks, turned a little as the city is
    const gx = (ex * 0.98 + ny * 0.2) / 0.006;
    const gy = (ny * 0.98 - ex * 0.2) / 0.006;
    const lineX = smooth(0.2, 0.08, Math.abs(gx - Math.round(gx)));
    const lineY = smooth(0.2, 0.08, Math.abs(gy - Math.round(gy)));
    const streets = Math.max(lineX, lineY);
    // the interstates: I-25 north–south beside the river, I-40 east–west through the canyon, crossing at the Big I
    const i25 = smooth(0.0011, 0.0004, Math.abs(ex - 0.004 - Math.sin(ny * 30) * 0.002)) * smooth(0.1, 0.05, Math.abs(ny));
    const i40 = smooth(0.0011, 0.0004, Math.abs(ny - 0.002 + Math.sin(ex * 26) * 0.002)) * smooth(0.1, 0.05, Math.abs(ex));
    const freeway = Math.max(i25, i40) * (ang < 0.3 ? 1 : 0);

    // ── relief ──
    const lava = smooth(0.69, 0.73, fbm(n5, x * 9, y * 9, z * 9, { octaves: 5 }) * 0.5 + 0.5) * low * (1 - valley);
    const cones = lava > 0.2 ? smooth(0.85, 0.97, ridged(n6, x * 120, y * 120, z * 120, { octaves: 1 })) : 0;
    const sands = smooth(0.72, 0.76, fbm(n6, x * 5 + 9, y * 5, z * 5, { octaves: 4 }) * 0.5 + 0.5) * low * (1 - lava);
    const playa = smooth(0.7, 0.76, fbm(n4, x * 6 + 2, y * 6, z * 6, { octaves: 4 }) * 0.5 + 0.5) * low * (1 - lava) * (1 - sands);
    const dunes = 0.5 + 0.5 * Math.sin((x * 3 + z * 2) * 900 + fbm(n2, x * 60, y * 60, z * 60, { octaves: 3 }) * 6);
    // dry washes: where a fine noise crosses zero, on the lower ground
    const wash = smooth(0.012, 0.003, Math.abs(fbm(n3, x * 22, y * 22, z * 22, { octaves: 4 }))) * (1 - ranges) * (1 - mesa * 0.6);
    let h = 0.12 + basin * 0.12 + ranges * (0.35 + detail * 0.6) + mesa * 0.42 + sandia * (0.75 + detail * 0.35) + cones * 0.12 + lava * 0.02;
    h -= valley * 0.08 + wash * 0.025;
    h = h * (1 - water) + 0.04 * water;
    height[i] = h * 0.015;

    // ── colour ──
    const grain = fbm(n3, x * 80, y * 80, z * 80, { octaves: 3 }) * 0.5 + 0.5;
    const mid = fbm(n4, x * 6, y * 6, z * 6, { octaves: 5 }) * 0.5 + 0.5;
    const big = fbm(n6, x * 2.5 + 3, y * 2.5, z * 2.5, { octaves: 4 }) * 0.5 + 0.5;
    let col = floor(clamp(mid * 0.6 + big * 0.3 + grain * 0.15 - 0.05));
    col = mix3(col, hex('#a8714a'), smooth(0.58, 0.75, big) * 0.45); // red soils
    col = mix3(col, hex('#8f7550'), smooth(0.4, 0.25, big) * 0.35); // darker scrub
    col = mix3(col, grassland(grain), smooth(0.5, 0.7, basin) * 0.45);
    col = mix3(col, C.caliche, smooth(0.66, 0.82, mid) * 0.3);
    // the mesas' bands, by height up their sides
    if (mesa > 0.01) {
      // each step its own stratum, flat-topped; the cliffs between show the
      // bands above and fall into shadow
      const top = STRATA[level % STRATA.length];
      const face = mix3(STRATA[(level + 1) % STRATA.length], STRATA[(level + 3) % STRATA.length], grain);
      // the tops are caprock, close to the desert round them; the colour is in the cliffs
      const cap = mix3(col, top, 0.3 + 0.15 * grain);
      const s = mix3(cap, face.map((c) => c * 0.8), smooth(0.05, 0.6, cliff));
      col = mix3(col, s, smooth(0.02, 0.12, mesa));
    }
    // the ranges: bare rock low, juniper on the slopes, pine on the tops, a little snow on the highest
    const rock = mix3(hex('#6f5a4a'), hex('#a3826a'), smooth(0.35, 0.85, detail));
    col = mix3(col, rock, smooth(0.1, 0.45, ranges) * 0.9);
    const dots = smooth(0.62, 0.72, fbm(n2, x * 260, y * 260, z * 260, { octaves: 2 }) * 0.5 + 0.5);
    col = mix3(col, C.juniper, dots * smooth(0.25, 0.6, ranges + sandia) * 0.55);
    col = mix3(col, C.pine, smooth(0.86, 1.0, h + (grain - 0.5) * 0.1) * 0.8);
    col = mix3(col, C.snow, smooth(1.0, 1.08, h + (detail - 0.5) * 0.2) * smooth(30, 50, Math.abs(latD)));
    // the Sandias: pink granite down the west face, forest on the crest
    col = mix3(col, mix3(C.granite, C.graniteHi, detail), smooth(0.1, 0.5, sandia) * (sx < 0.004 ? 1 : 0.35));
    col = mix3(col, C.pine, smooth(0.55, 0.85, sandia) * smooth(-0.004, 0.006, sx) * 0.85);
    // the low country
    col = mix3(col, mix3(C.basalt, C.basaltHi, grain), lava);
    col = mix3(col, C.cinder, cones);
    col = mix3(col, mix3(C.gypsumShade, C.gypsum, dunes), sands);
    col = mix3(col, C.playa, playa * 0.9);
    col = mix3(col, C.wash, wash * 0.55);
    // the river, its cottonwoods, and the city
    col = mix3(col, C.bosque, bosque * 0.9);
    col = mix3(col, mix3(C.urban, hex('#a99c8a'), grain), cityK * 0.85);
    col = mix3(col, C.street, streets * cityK * 0.6);
    col = mix3(col, C.freeway, freeway * 0.85);
    col = mix3(col, C.river, water);
    // a little lighter on the heights
    col = col.map((c) => c * (0.94 + h * 0.08));

    const o = i * 3;
    albedo[o] = col[0];
    albedo[o + 1] = col[1];
    albedo[o + 2] = col[2];
    rough[o] = rough[o + 1] = rough[o + 2] = mix(mix(0.95, 0.86, sands + playa * 0.5), 0.3, water);

    // ── night: sodium orange, the grid and the freeways brightest; the towns up and down the river ──
    const towns = [
      [0.26, 0.02, 0.012, 0.5], // Santa Fe
      [-0.38, -0.01, 0.014, 0.55], // Las Cruces
      [0.1, -0.012, 0.008, 0.35], // Bernalillo
      [-0.22, 0.004, 0.008, 0.3], // Socorro
    ];
    let lit = cityK * (0.35 + streets * 0.9) * (0.6 + 0.4 * grain) + freeway * 0.9;
    for (const [tn, te, tr, b] of towns) lit += smooth(tr, tr * 0.3, Math.hypot(ex - te, ny - tn)) * b * (0.5 + 0.5 * streets);
    lit *= ang < 0.6 ? 1 : 0;
    night[o] = lit * 1.0;
    night[o + 1] = lit * 0.62;
    night[o + 2] = lit * 0.26;

    // ── the sky: a few thunderheads building over the ranges ──
    const cv = fbm(nc, x * 6, y * 6, z * 6, { octaves: 6 });
    const ck = smooth(0.18, 0.42, cv + ranges * 0.18 - 0.08) * 0.8;
    clouds[o] = clouds[o + 1] = clouds[o + 2] = ck;
  });

  await save(albedo, W, H, 3, 'breakingbad', [[2048, ''], [1024, '-sm']], { quality: 88 });
  await save(normalMap(height, W, H, 1), W, H, 3, 'breakingbad-normal', [[2048, ''], [1024, '-sm']], { quality: 90 });
  await save(rough, W, H, 3, 'breakingbad-rough', [[1024, '']], { quality: 84 });
  // (the lights, and a few soft clouds: 1024 holds them)
  await save(night, W, H, 3, 'breakingbad-night', [[1024, ''], [512, '-sm']], { quality: 86 });
  await save(clouds, W, H, 3, 'breakingbad-clouds', [[1024, ''], [512, '-sm']], { quality: 80 });
}
