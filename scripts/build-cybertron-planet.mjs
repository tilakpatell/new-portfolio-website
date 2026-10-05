// Cybertron's maps, worked out here once and saved as webp in
// public/textures/universe/ for the universe map's planet and the Cybertron
// page's: a world built over, the way War for Cybertron, Fall of Cybertron
// and Prime show it from space. Tiers of plating stepped like terraces, cut
// into rectangles on the cube's faces (so they run square, the way built
// things do, and never pinch at the poles); a network of straight-walled
// chasms, stepped down in ledges, energon running along the floors of some;
// the city-states (Iacon, Kaon, Polyhex, Praxus, Vos, Tyger Pax, Tarn,
// Helex, Altihex, Simfur, Uraya) as great discs of rings and spokes; the
// polar works; the Sea of Rust; the war's craters and fires. Sampled in 3D on
// the sphere, so there's no seam.
//
//   transformers.webp / -sm   the colour
//   transformers-normal.webp  the relief, as a tangent-space normal map
//   transformers-glow.webp    what glows, packed: red the energon, green the
//                             fires, blue the cities' lights (for the night
//                             side), so each side's energon can be its own
//                             colour. Lossless: lossy webp would smear one
//                             channel into the next.
//
// node scripts/build-cybertron-planet.mjs   (about a minute)

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'textures', 'universe');
const W = +(process.env.CY_W ?? 4096); // worked out at this size, saved at half (and a quarter)
const H = W / 2;

// ── noise ──
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// a hash of up to four integers, 0…1
function hash(a, b = 0, c = 0, d = 0) {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647) + Math.imul(d | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// improved Perlin noise in 3D, about −1…1
function perlin(seed) {
  const r = rng(seed);
  const p = new Uint8Array(512);
  const base = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  for (let i = 0; i < 512; i++) p[i] = base[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y, z) => {
    const k = h & 15;
    const u = k < 8 ? x : y;
    const v = k < 4 ? y : k === 12 || k === 14 ? x : z;
    return ((k & 1) === 0 ? u : -u) + ((k & 2) === 0 ? v : -v);
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  return (x, y, z) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);
    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;
    return lerp(
      lerp(lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u), lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u), lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v),
      w,
    );
  };
}
const N1 = perlin(11);
const N2 = perlin(23);
const N3 = perlin(37);
const N4 = perlin(41);
const fbm = (n, x, y, z, oct = 5, gain = 0.5) => {
  let s = 0;
  let a = 0.5;
  let f = 1;
  let norm = 0;
  for (let o = 0; o < oct; o++) {
    s += a * n(x * f, y * f, z * f);
    norm += a;
    a *= gain;
    f *= 2.03;
  }
  return 0.5 + 0.5 * (s / norm) * 1.4;
};
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

// The map's direction for a latitude and longitude, in degrees, the way
// three.js's sphere is UV-mapped (u from 0 at the back, round to the east).
function dir(latDeg, lonDeg) {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return [-Math.cos(lon) * Math.cos(lat), Math.sin(lat), Math.sin(lon) * Math.cos(lat)];
}
// a basis on the surface at c (for the angle round it)
function basis(c) {
  const up = Math.abs(c[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
  const e1 = norm(cross(up, c));
  const e2 = cross(c, e1);
  return [e1, e2];
}

// ── the city-states: discs of rings and spokes ──
// side: a(utobot) d(ecepticon) n(either); r: radius, radians; rings, spokes
const CITIES = [
  { name: 'Iacon', at: dir(38, 180), r: 0.3, rings: 6, spokes: 12, side: 'a' },
  { name: 'Kaon', at: dir(-22, 20), r: 0.26, rings: 5, spokes: 8, side: 'd' },
  { name: 'Polyhex', at: dir(8, 250), r: 0.17, rings: 4, spokes: 6, side: 'd' },
  { name: 'Praxus', at: dir(22, 118), r: 0.16, rings: 4, spokes: 10, side: 'a' },
  { name: 'Vos', at: dir(52, 300), r: 0.15, rings: 3, spokes: 6, side: 'd' },
  { name: 'Tyger Pax', at: dir(-8, 150), r: 0.13, rings: 3, spokes: 8, side: 'n' },
  { name: 'Tarn', at: dir(-46, 330), r: 0.14, rings: 4, spokes: 6, side: 'd' },
  { name: 'Helex', at: dir(-30, 230), r: 0.12, rings: 3, spokes: 8, side: 'n' },
  { name: 'Altihex', at: dir(12, 60), r: 0.12, rings: 3, spokes: 6, side: 'a' },
  { name: 'Simfur', at: dir(-58, 95), r: 0.1, rings: 3, spokes: 6, side: 'n' },
  { name: 'Uraya', at: dir(60, 60), r: 0.11, rings: 3, spokes: 8, side: 'a' },
  // the polar works: the biggest discs of all
  { name: 'north pole', at: [0, 1, 0], r: 0.36, rings: 8, spokes: 16, side: 'n', pole: true },
  { name: 'south pole', at: [0, -1, 0], r: 0.3, rings: 6, spokes: 12, side: 'n', pole: true },
].map((c) => ({ ...c, cos: Math.cos(c.r * 1.25), b: basis(c.at) }));

// where the war is burning: scorched plating, craters, fires
const WAR = [
  { at: dir(-5, 60), r: 0.32 }, // the front between Kaon and Altihex
  { at: dir(-12, 160), r: 0.26 }, // Tyger Pax
  { at: dir(24, 210), r: 0.22 }, // Iacon's outskirts
  { at: dir(-40, 270), r: 0.25 },
  { at: dir(30, 330), r: 0.2 },
].map((w) => ({ ...w, cos: Math.cos(w.r) }));

// the Sea of Rust, and a lesser waste
const RUST = [dir(-34, 205), dir(-12, 300)];

// craters: most of them where the fighting was
const cr = rng(97);
const CRATERS = [];
for (let i = 0; i < 150; i++) {
  let c;
  if (i < 90) {
    const w = WAR[i % WAR.length];
    const [e1, e2] = basis(w.at);
    const a = cr() * Math.PI * 2;
    const d = Math.sqrt(cr()) * w.r;
    c = norm([0, 1, 2].map((k) => w.at[k] * Math.cos(d) + (e1[k] * Math.cos(a) + e2[k] * Math.sin(a)) * Math.sin(d)));
  } else {
    const z = cr() * 2 - 1;
    const a = cr() * Math.PI * 2;
    const s = Math.sqrt(1 - z * z);
    c = [Math.cos(a) * s, z, Math.sin(a) * s];
  }
  const rad = 0.006 + cr() ** 3 * 0.05;
  CRATERS.push({ c, rad, cos: Math.cos(rad * 2.2), fire: i < 90 && cr() < 0.5 });
}

// ── the plating: rectangles on the cube's faces ──
// Each face is cut in a grid, then each cell split again and again at random,
// the longer side first, like the panels on a hull. Gives the plate's id and
// how far (in face units, 2 across) the point is from its edge at each level.
const GRID = 4;
const DEPTH = 6;
function plating(p) {
  const ax = Math.abs(p[0]);
  const ay = Math.abs(p[1]);
  const az = Math.abs(p[2]);
  let face;
  let a;
  let b;
  let m;
  if (ax >= ay && ax >= az) [face, a, b, m] = [p[0] > 0 ? 0 : 1, p[2], p[1], ax];
  else if (ay >= az) [face, a, b, m] = [p[1] > 0 ? 2 : 3, p[0], p[2], ay];
  else [face, a, b, m] = [p[2] > 0 ? 4 : 5, p[0], p[1], az];
  // equal-angle: the cells come out near enough square on the sphere
  const u = (Math.atan(a / m) / (Math.PI / 4) + 1) * 0.5 * GRID;
  const v = (Math.atan(b / m) / (Math.PI / 4) + 1) * 0.5 * GRID;
  const cu = Math.floor(u);
  const cv = Math.floor(v);
  let x0 = cu;
  let x1 = cu + 1;
  let y0 = cv;
  let y1 = cv + 1;
  const edges = [Math.min(u - x0, x1 - u, v - y0, y1 - v)];
  let id = hash(face, cu, cv, 1);
  const ids = [id];
  for (let d = 0; d < DEPTH; d++) {
    const h = hash(Math.floor(id * 1e9), d, face, 7);
    if (d > 1 && h < 0.18) {
      edges.push(edges[edges.length - 1]);
      ids.push(id);
      continue;
    }
    const wide = x1 - x0 >= y1 - y0;
    const cut = 0.25 + Math.round(hash(Math.floor(id * 1e9), d, 3) * 4) * 0.125; // 0.25…0.75 in eighths
    if (wide) {
      const s = x0 + (x1 - x0) * cut;
      if (u < s) x1 = s;
      else x0 = s;
      id = hash(Math.floor(id * 1e9), d, u < s ? 1 : 2, 11);
    } else {
      const s = y0 + (y1 - y0) * cut;
      if (v < s) y1 = s;
      else y0 = s;
      id = hash(Math.floor(id * 1e9), d, v < s ? 3 : 4, 13);
    }
    edges.push(Math.min(u - x0, x1 - u, v - y0, y1 - v));
    ids.push(id);
  }
  // the plate's place in it (0…1 each way), for the details on it
  return { id, ids, edges, face, fu0: u / GRID, fv0: v / GRID, fu: (u - x0) / (x1 - x0), fv: (v - y0) / (y1 - y0), size: Math.min(x1 - x0, y1 - y0) };
}

// ── the chasms: the edges of big cells, straight-walled, stepped ──
// (the edges of a 3D Voronoi diagram meet the sphere in straight-ish lines)
function voronoi(x, y, z, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  let f1 = 9;
  let f2 = 9;
  let id1 = 0;
  let id2 = 0;
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++) {
        const cx = xi + i;
        const cy = yi + j;
        const cz = zi + k;
        const px = cx + hash(cx, cy, cz, seed);
        const py = cy + hash(cx, cy, cz, seed + 1);
        const pz = cz + hash(cx, cy, cz, seed + 2);
        const d = Math.hypot(px - x, py - y, pz - z);
        const id = hash(cx, cy, cz, seed + 3);
        if (d < f1) {
          f2 = f1;
          id2 = id1;
          f1 = d;
          id1 = id;
        } else if (d < f2) {
          f2 = d;
          id2 = id;
        }
      }
  return { f1, f2, id1, id2 };
}

// a tower on a city plate: a few of the small plates, picked
const win2 = (pl) => hash(Math.floor(pl.id * 1e9), 99) < 0.18 && pl.fu > 0.25 && pl.fu < 0.75 && pl.fv > 0.25 && pl.fv < 0.75;

const BIG = 2.1; // the great chasms' cells, per radius
const SMALL = 5.5; // the lesser trenches'

// ── one point of the planet ──
// h: height (in planet radii); col: sRGB colour; glow: [energon, fire, lights]
function sample(p) {
  const [x, y, z] = p;
  // the tiers: the land is stepped in great terraces
  const t0 = fbm(N1, x * 1.3 + 3, y * 1.3, z * 1.3, 4);
  const tiers = 5;
  const tf = t0 * tiers;
  const tier = Math.floor(tf);
  const tEdge = smooth(0, 0.08, tf - tier); // a cliff at the foot of each tier
  let h = (tier + tEdge) * 0.0045;

  // the plating
  const pl = plating(p);
  const [e0, e1, e2, , , , e6] = pl.edges;
  const plateLift = (hash(Math.floor(pl.id * 1e9), 5) - 0.5) * 0.0016;
  h += plateLift * smooth(0, 0.015, e2);
  // seams, wide between the grid's cells and fine between the smallest plates
  const seam0 = smooth(0.0, 0.014, e0);
  const seam1 = smooth(0.0, 0.016, e1);
  const seam2 = smooth(0.0, 0.009, e2);
  const seamN = smooth(0.0, 0.005, e6);
  h -= (1 - seam0) * 0.0022 + (1 - seam1) * 0.0012 + (1 - seam2) * 0.0007 + (1 - seamN) * 0.00035;

  // the Sea of Rust: a basin of old plating gone to rust and dust in the south
  const rd = Math.min(Math.acos(clamp(dot(p, RUST[0]))), Math.acos(clamp(dot(p, RUST[1]))) + 0.18);
  const rust = smooth(0.42, 0.22, rd + (fbm(N2, x * 2.2 + 7, y * 2.2 - 2, z * 2.2, 5) - 0.5) * 0.5);
  h -= rust * 0.004;

  // the great chasms, and the lesser trenches
  const wx = x + (fbm(N3, x * 4, y * 4, z * 4, 3) - 0.5) * 0.05;
  const wy = y + (fbm(N3, x * 4 + 9, y * 4, z * 4, 3) - 0.5) * 0.05;
  const wz = z + (fbm(N3, x * 4, y * 4 + 9, z * 4, 3) - 0.5) * 0.05;
  const vb = voronoi(wx * BIG, wy * BIG, wz * BIG, 101);
  const pairB = hash(Math.floor(Math.min(vb.id1, vb.id2) * 1e9), Math.floor(Math.max(vb.id1, vb.id2) * 1e9), 5);
  const openB = pairB < 0.72; // not every edge is a chasm
  const dB = (vb.f2 - vb.f1) / BIG; // about the distance to the edge, in radii
  const wB = 0.018 + 0.022 * fbm(N4, x * 3, y * 3, z * 3, 2);
  let chasm = 0;
  let floor = 0;
  let ledge = 0;
  if (openB && dB < wB) {
    const k = 1 - dB / wB; // 0 at the lip, 1 on the floor's line
    const steps = Math.floor(k * 4) / 4 + smooth(0, 0.15, (k * 4) % 1) / 4; // stepped ledges
    chasm = steps;
    ledge = smooth(0.12, 0.0, (k * 4) % 1) * (k < 0.9 ? 1 : 0); // the lip of each ledge catches the light
    floor = smooth(0.5, 0.97, k);
    h -= steps * 0.03;
  }
  const vs = voronoi(x * SMALL + 40, y * SMALL, z * SMALL, 202);
  const pairS = hash(Math.floor(Math.min(vs.id1, vs.id2) * 1e9), Math.floor(Math.max(vs.id1, vs.id2) * 1e9), 9);
  const dS = (vs.f2 - vs.f1) / SMALL;
  const wS = 0.0045;
  let trench = 0;
  if (pairS < 0.28 && dS < wS) {
    trench = smooth(0, 0.6, 1 - dS / wS);
    h -= trench * 0.006;
  }

  // the city-states, and the polar works
  let city = 0; // how built-up (lights)
  let cityRing = 0; // lit rings
  let hub = 0;
  let cityGap = 0;
  let side = 'n';
  for (const c of CITIES) {
    const cd = dot(p, c.at);
    if (cd < c.cos) continue;
    const d = Math.acos(clamp(cd, -1, 1));
    const k = d / c.r; // 0 at the centre, 1 at the edge
    if (k > 1.25) continue;
    const ang = Math.atan2(dot(p, c.b[1]), dot(p, c.b[0]));
    const inside = smooth(1.1, 0.95, k);
    city = Math.max(city, inside * (c.pole ? 0.35 : 1));
    side = inside > 0.5 ? c.side : side;
    // terraced rings, rising to the centre
    const ringK = k * c.rings;
    const ringF = ringK % 1;
    const ringI = Math.floor(ringK);
    const ringWall = smooth(0.0, 0.06, ringF) * smooth(1.0, 0.94, ringF);
    h += inside * ((c.rings - ringI) * 0.0028 * ringWall - (1 - ringWall) * 0.004);
    cityGap = Math.max(cityGap, inside * (1 - ringWall));
    if (hash(ringI, c.rings, Math.floor(c.r * 1000)) < 0.6) cityRing = Math.max(cityRing, inside * (1 - ringWall) * (ringI > 0 ? 1 : 0));
    // spokes, out from the centre
    const sp = Math.abs(((ang / (Math.PI * 2)) * c.spokes + 100.5) % 1 - 0.5) * (Math.PI * 2 * d) / c.spokes; // distance from the spoke's line, in radii
    const spoke = smooth(0.01, 0.003, sp) * smooth(0.18, 0.3, k) * inside;
    h -= spoke * 0.006;
    cityRing = Math.max(cityRing, spoke * 0.45);
    // the citadel at the middle
    hub = Math.max(hub, smooth(0.16, 0.0, k));
    h += smooth(0.18, 0.0, k) * 0.012 + smooth(0.06, 0.0, k) * 0.01;
  }
  city *= 1 - rust * 0.8;

  // the war
  let war = 0;
  for (const w of WAR) {
    const wd = dot(p, w.at);
    if (wd < w.cos) continue;
    war = Math.max(war, smooth(w.r, w.r * 0.3, Math.acos(clamp(wd, -1, 1))));
  }
  war *= smooth(0.42, 0.62, fbm(N4, x * 5 + 1, y * 5, z * 5, 3)) * 1.4;
  war = clamp(war);
  let crater = 0;
  let craterFire = 0;
  for (const c of CRATERS) {
    const cd = dot(p, c.c);
    if (cd < c.cos) continue;
    const k = Math.acos(clamp(cd, -1, 1)) / c.rad;
    const bowl = smooth(1.0, 0.0, k);
    const rim = Math.exp(-((k - 1) ** 2) * 18) * 0.35;
    h += (rim - bowl * bowl) * c.rad * 0.25;
    crater = Math.max(crater, bowl);
    if (c.fire) craterFire = Math.max(craterFire, smooth(0.6, 0.0, k));
  }

  // ── colour ──
  // gunmetal mostly, the big plates each their own shade, a few blued, fewer
  // bronze, very few gilded; the small plates vary it a little
  const big = pl.ids[2];
  const pid = pl.id;
  const pick = hash(Math.floor(big * 1e9), 77);
  let col = mix(hex('#353a42'), hex('#7a828d'), big ** 1.2);
  if (pick < 0.03) col = mix(hex('#5a4a38'), hex('#7a6448'), big);
  else if (pick < 0.16) col = mix(hex('#38455a'), hex('#566a86'), big);
  col = mul(col, 0.93 + 0.14 * hash(Math.floor(pid * 1e9), 3));
  const fine = fbm(N2, x * 60, y * 60, z * 60, 3);
  col = mul(col, 0.92 + 0.16 * fine);
  // and the land as a whole uneven: whole regions darker or paler, the
  // higher tiers paler
  col = mul(col, (0.72 + 0.5 * fbm(N4, x * 2.6 + 4, y * 2.6, z * 2.6, 4)) * (0.88 + 0.06 * tier));
  // worn bright along the plates' edges, dark in the seams
  col = mix(col, mul(col, 1.45), (1 - smooth(0.003, 0.01, e2)) * seam2 * 0.7);
  col = mul(col, 0.45 + 0.55 * seam0 * seam1 * (0.7 + 0.3 * seam2) * (0.85 + 0.15 * seamN));
  // the tiers' cliffs are dark
  col = mul(col, 0.6 + 0.4 * tEdge);
  // chasms: walls darker the deeper, each ledge's lip catching the light
  col = mul(col, (1 - chasm * 0.7) * (1 + ledge * 0.9));
  col = mul(col, 1 - trench * 0.35);
  // the cities: brighter metal in rings, the citadel paler still, and towers
  const tower = city * (win2(pl) ? 1 : 0);
  col = mix(col, mul(hex('#8b939e'), 0.75 + 0.25 * fine), city * 0.42 * seam1 * (1 - cityGap));
  col = mix(col, hex('#c2cad4'), tower * 0.45);
  col = mix(col, hex('#c5ccd6'), hub * 0.4);
  // rust and dust in the sea
  const rustCol = mix(hex('#3a2519'), hex('#7a4a2e'), fbm(N3, x * 18, y * 18, z * 18, 4));
  col = mix(col, mix(rustCol, hex('#8f6a48'), smooth(0.6, 0.85, fbm(N1, x * 40, y * 40, z * 40, 3)) * 0.5), rust * 0.85);
  // scorched where the war is, black in the craters
  col = mix(col, mul(hex('#1a1512'), 0.6 + 0.6 * fine), war * 0.6);
  col = mul(col, 1 - crater * 0.6);

  // ── what glows ──
  // energon: along the chasms' floors and the lit rings, and the conduits
  // between some of the big plates
  // the highways: long straight runs of energon along the plating's grid
  const HW = 18;
  let conduit = 0;
  for (const [a, b, axis] of [[pl.fu0, pl.fv0, 0], [pl.fv0, pl.fu0, 1]]) {
    const line = Math.round(a * HW);
    const off = Math.abs(a * HW - line) / HW; // face units (0…1 across)
    if (off < 0.0016 && hash(pl.face, axis, line, 5) < 0.14 && hash(pl.face, axis, line * 7 + Math.floor(b * 5), 9) < 0.55) conduit = Math.max(conduit, smooth(0.0016, 0.0003, off));
  }
  conduit *= 1 - rust;
  let energon = floor * floor * (pairB < 0.3 ? 0.85 : 0.4) + cityRing * 0.85 + conduit * 0.22;
  energon *= 1 - war * 0.6;
  // fire: the burning parts of the front, the craters' floors, chasms that burn
  const flick = smooth(0.45, 0.8, fbm(N1, x * 30 + 5, y * 30, z * 30, 3));
  let fire = war * flick * 0.8 + craterFire * (0.5 + 0.5 * flick) + floor * war * 1.2;
  fire = clamp(fire);
  // the lights of the night side: the cities' grids and windows, and a
  // scattering everywhere else that's lived in
  const sub = pl.fu > 0.2 && pl.fu < 0.8 && pl.fv > 0.2 && pl.fv < 0.8;
  const win = sub && hash(Math.floor(pid * 1e9), Math.floor(pl.fu * 6), Math.floor(pl.fv * 6)) < 0.5 && (pl.fu * 6) % 1 > 0.3 && (pl.fv * 6) % 1 > 0.3 ? 1 : 0;
  const streets = 1 - smooth(0.0, 0.004, Math.min(e2, e1));
  let lights = city * (win * 0.7 + streets * 0.9) * (0.5 + 0.5 * hash(Math.floor(pid * 1e9), 8));
  lights += (1 - city) * (1 - rust) * streets * (hash(Math.floor(pid * 1e9), 13) < 0.08 ? 0.6 : 0);
  lights = clamp(lights * (1 - war * 0.7));

  return { h, col, glow: [clamp(energon), fire, lights], side };
}

// ── work it out ──
console.time('cybertron');
const height = new Float32Array(W * H);
const colourF = new Float32Array(W * H * 3);
const glow = new Uint8Array(W * H * 3);
for (let j = 0; j < H; j++) {
  const v = 1 - (j + 0.5) / H;
  const lat = (v - 0.5) * Math.PI;
  const cl = Math.cos(lat);
  const sl = Math.sin(lat);
  for (let i = 0; i < W; i++) {
    const lon = ((i + 0.5) / W) * Math.PI * 2;
    const p = [-Math.cos(lon) * cl, sl, Math.sin(lon) * cl];
    const s = sample(p);
    const k = j * W + i;
    height[k] = s.h;
    for (let c = 0; c < 3; c++) {
      colourF[k * 3 + c] = s.col[c];
      glow[k * 3 + c] = Math.round(clamp(s.glow[c]) * 255);
    }
  }
  if (j % 256 === 0) console.log(`  row ${j}/${H}`);
}

// shade the hollows: how far each point lies below the land round it
// (a blur of the height at two reaches), darker the deeper it sits
function blur(src, r) {
  const tmp = new Float32Array(W * H);
  const out = new Float32Array(W * H);
  for (let j = 0; j < H; j++) {
    const lat = (0.5 - (j + 0.5) / H) * Math.PI;
    const rx = Math.min(W / 4, Math.round(r / Math.max(0.05, Math.cos(lat)))); // as wide on the sphere at every latitude
    let acc = 0;
    for (let i = -rx; i <= rx; i++) acc += src[j * W + ((i + W) % W)];
    for (let i = 0; i < W; i++) {
      tmp[j * W + i] = acc / (2 * rx + 1);
      acc += src[j * W + ((i + rx + 1) % W)] - src[j * W + ((i - rx + W) % W)];
    }
  }
  for (let i = 0; i < W; i++) {
    let acc = 0;
    const at = (j) => tmp[Math.min(H - 1, Math.max(0, j)) * W + i];
    for (let j = -r; j <= r; j++) acc += at(j);
    for (let j = 0; j < H; j++) {
      out[j * W + i] = acc / (2 * r + 1);
      acc += at(j + r + 1) - at(j - r);
    }
  }
  return out;
}
const near = blur(height, 6);
const far = blur(height, 28);
const colour = new Uint8Array(W * H * 3);
for (let k = 0; k < W * H; k++) {
  const cavity = Math.max(0, near[k] - height[k]) * 90 + Math.max(0, far[k] - height[k]) * 22;
  const ridge = Math.max(0, height[k] - near[k]) * 40;
  const ao = clamp(1 - cavity * 0.7, 0.35, 1) * (1 + Math.min(0.25, ridge));
  for (let c = 0; c < 3; c++) colour[k * 3 + c] = Math.round(clamp(colourF[k * 3 + c] * ao) * 255);
}

// the relief, as a tangent-space normal map: east along u, north along v
const normal = new Uint8Array(W * H * 3);
const STRENGTH = 1.0;
for (let j = 0; j < H; j++) {
  const lat = (0.5 - (j + 0.5) / H) * Math.PI;
  const cl = Math.max(0.08, Math.cos(lat));
  const du = ((2 * Math.PI) / W) * cl * 2; // arc length across two pixels east
  const dv = (Math.PI / H) * 2;
  for (let i = 0; i < W; i++) {
    const e = height[j * W + ((i + 1) % W)];
    const w = height[j * W + ((i - 1 + W) % W)];
    const n = height[Math.max(0, j - 1) * W + i];
    const s = height[Math.min(H - 1, j + 1) * W + i];
    const gx = ((e - w) / du) * STRENGTH;
    const gy = ((n - s) / dv) * STRENGTH;
    const l = Math.hypot(gx, gy, 1);
    const k = (j * W + i) * 3;
    normal[k] = Math.round((0.5 - (0.5 * gx) / l) * 255);
    normal[k + 1] = Math.round((0.5 - (0.5 * gy) / l) * 255);
    normal[k + 2] = Math.round((0.5 + 0.5 / l) * 255);
  }
}
console.timeEnd('cybertron');

const save = async (buf, name, w, opts) => {
  await sharp(buf, { raw: { width: W, height: H, channels: 3 } })
    .resize(w, w / 2, { kernel: 'lanczos3' })
    .webp({ effort: 6, ...opts })
    .toFile(path.join(OUT, name));
  console.log('  wrote', name);
};
console.log('saving…');
await save(colour, 'transformers.webp', 2048, { quality: 82 });
await save(colour, 'transformers-sm.webp', 1024, { quality: 80 });
await save(normal, 'transformers-normal.webp', 2048, { quality: 88 });
await save(glow, 'transformers-glow.webp', 2048, { lossless: true });
