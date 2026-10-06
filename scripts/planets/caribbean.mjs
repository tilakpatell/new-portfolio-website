// The Caribbean as a whole world, for Pirates of the Caribbean: a planet
// of warm sea. Deep blue water over the abyss, the shallow banks the
// Bahamas have (turquoise going to pale sand, a line of surf where they
// drop off), island arcs like the Antilles' curving across it, and
// volcanic islands of jungle ringed with white beaches. On the near face,
// Tortuga, as shaped as its name (the turtle); out in the open sea, Davy
// Jones's maelstrom turning; overhead, trade-wind cumulus in rows, towers
// over the islands, and a hurricane wound tight round its eye. At night,
// lanterns in the ports.
//
// Makes caribbean and -clouds (alpha) at 2048 (-hq), 1024 and 512 (-sm);
// -normal, -rough and -night at 1024.

import { clamp, eachTexel, fbm, hex, mix, mix3, normalMap, perlin, ramp, ridged, save, smooth } from './sphere.mjs';

const W = 4096;
const H = 2048;
const deg = Math.PI / 180;

// a point on the sphere as three's sphere lays it out (phi round from −x)
const at = (latD, phi) => [-Math.cos(phi) * Math.cos(latD * deg), Math.sin(latD * deg), Math.sin(phi) * Math.cos(latD * deg)];
// a frame at a point: east and north, to measure things laid flat round it
function frame(latD, phi) {
  const c = at(latD, phi);
  const e = [Math.sin(phi), 0, Math.cos(phi)];
  const n = [Math.cos(phi) * Math.sin(latD * deg), Math.cos(latD * deg), -Math.sin(phi) * Math.sin(latD * deg)];
  return (x, y, z) => {
    const d = x * c[0] + y * c[1] + z * c[2];
    return [x * e[0] + y * e[1] + z * e[2], x * n[0] + y * n[1] + z * n[2], d];
  };
}
// the island arcs: great-circle-ish curves of islands, [lat, phi] points
const ARCS = [
  [[24, 2.6], [19, 2.9], [16, 3.2], [13, 3.35], [10, 3.4]], // the Antilles, on the near face
  [[-14, 3.9], [-20, 4.3], [-22, 4.8], [-18, 5.2]],
  [[30, 5.6], [34, 6.0], [32, 0.4], [26, 0.7]],
  [[-30, 1.2], [-26, 1.6], [-30, 2.0]],
];

// each arc as a run of points along it (unit vectors), for the nearest by dot product
const ARC_PTS = ARCS.map((pts) => {
  const out = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const a = at(...pts[k]);
    const b = at(...pts[k + 1]);
    for (let s = 0; s < 16; s++) {
      const t = s / 16;
      const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      const l = Math.hypot(...p);
      out.push(p[0] / l, p[1] / l, p[2] / l);
    }
  }
  return Float64Array.from(out);
});

function arcDistance(x, y, z, pts) {
  let best = -1;
  for (let k = 0; k < pts.length; k += 3) {
    const d = x * pts[k] + y * pts[k + 1] + z * pts[k + 2];
    if (d > best) best = d;
  }
  return Math.acos(clamp(best, -1, 1));
}

export async function bake() {
  const n1 = perlin(31);
  const n2 = perlin(32);
  const n3 = perlin(33);
  const n4 = perlin(34);
  const n5 = perlin(35);
  const nc = perlin(37);
  const nw = perlin(38);
  const albedo = new Float32Array(W * H * 3);
  const height = new Float32Array(W * H);
  const rough = new Float32Array(W * H * 3);
  const night = new Float32Array(W * H * 3);
  const clouds = new Float32Array(W * H * 3);

  const tortuga = frame(20, Math.PI + 0.08);
  const maelstrom = frame(-6, Math.PI + 0.75);
  const hurricane = frame(24, Math.PI - 0.85);
  const fogIsle = frame(8, Math.PI - 0.32); // Isla de Muerta, always in fog
  const PORTS = [
    [frame(20, Math.PI + 0.08), 0.012, 0.55], // Tortuga
    [frame(14.5, Math.PI + 0.22), 0.01, 0.7], // Port Royal
    [frame(27, Math.PI - 0.55), 0.008, 0.4], // Shipwreck Cove
    [frame(11, Math.PI + 0.3), 0.006, 0.3],
  ];

  const sea = ramp([[0, '#c4efe0'], [0.1, '#86dfd2'], [0.22, '#41c3c6'], [0.38, '#1796b4'], [0.55, '#0d6b9e'], [0.75, '#0a5089'], [1, '#073b6c']]);
  const jungle = ramp([[0, '#3e7f34'], [0.4, '#2f6c2b'], [0.75, '#245a24'], [1, '#1d4a1f']]);
  const C = Object.fromEntries(Object.entries({ sand: '#efe2bf', sandWet: '#d8c99f', surf: '#e8fbff', rock: '#6d6152', rockHi: '#8a7b68', crater: '#3c342d' }).map(([k, v]) => [k, hex(v)]));

  eachTexel(W, H, (x, y, z, i, lat) => {
    const latD = lat / deg;
    const alat = Math.abs(latD);
    // ── where the land is ──
    let chain = 0;
    for (const a of ARC_PTS) chain = Math.max(chain, Math.exp(-((arcDistance(x, y, z, a) / 0.05) ** 2)));
    const field = fbm(n1, x * 5, y * 5, z * 5, { octaves: 6 });
    const fine = fbm(n2, x * 34, y * 34, z * 34, { octaves: 4 });
    // islands: the big ones from the field's peaks, the arcs' strings of small ones
    let land = field + chain * (0.28 + fine * 0.5) + fine * 0.08 - 0.36 - smooth(40, 60, alat) * 0.3;
    // Tortuga: a turtle, its shell, head and four flippers
    const [tx, ty, td] = tortuga(x, y, z);
    if (td > 0.95) {
      const e = (cx, cy, rx, ry, a = 0) => {
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const u = ((tx - cx) * ca + (ty - cy) * sa) / rx;
        const v = (-(tx - cx) * sa + (ty - cy) * ca) / ry;
        return 1 - Math.hypot(u, v);
      };
      const turtle = Math.max(e(0, 0, 0.034, 0.024), e(0.044, 0.002, 0.011, 0.009), e(0.02, 0.026, 0.016, 0.006, 0.6), e(0.02, -0.024, 0.016, 0.006, -0.6), e(-0.024, 0.02, 0.012, 0.005, -0.7), e(-0.024, -0.018, 0.012, 0.005, 0.7), e(-0.04, 0, 0.008, 0.003));
      land = Math.max(land, turtle * 0.6 + fine * 0.03);
    }
    // the banks: wide shallows round some islands and out on their own
    const bank = fbm(n3, x * 3.2, y * 3.2, z * 3.2, { octaves: 5 }) + chain * 0.15 + Math.max(0, land + 0.12) * 1.5 - 0.3 - smooth(28, 42, alat) * 0.5;
    const landK = smooth(-0.004, 0.004, land);
    const beach = smooth(-0.004, 0.004, land) * (1 - smooth(0.006, 0.02, land));
    // how deep: shallow by the land and over the banks
    const nearLand = smooth(-0.16, 0, land) ** 1.3;
    const bankS = smooth(-0.05, 0.18, bank);
    const shallow = Math.max(nearLand, bankS);
    // the banks' floor: sandy and paler in places, darker channels cut through
    const floorV = fbm(n4, x * 14, y * 14, z * 14, { octaves: 4 });
    // surf where the bank drops off into the deep
    const reef = smooth(0.012, 0.0, Math.abs(bank - 0.035)) * (0.4 + 0.6 * smooth(-0.1, 0.2, fine)) * 0.4;
    const depth = clamp(1 - shallow * 0.92 + floorV * 0.14 * (0.4 + shallow) + fbm(n5, x * 4, y * 4, z * 4, { octaves: 3 }) * 0.06);

    // ── relief ──
    const peaks = ridged(n5, x * 40, y * 40, z * 40, { octaves: 5 });
    const hi = clamp(land * 3.2);
    const elev = landK * (0.03 + hi * (0.4 + peaks * 0.6));
    // a few volcanic islands have a crater at the top
    const crater = landK * smooth(0.55, 0.62, hi) * smooth(0.72, 0.85, fbm(n4, x * 60, y * 60, z * 60, { octaves: 2 }) * 0.5 + 0.5);
    height[i] = (elev - crater * 0.15) * 0.012;

    // ── colour ──
    const grain = fbm(n2, x * 90, y * 90, z * 90, { octaves: 3 }) * 0.5 + 0.5;
    let water = sea(depth);
    // sand ripples on the banks, and the darker patches of seagrass
    water = mix3(water, hex('#5fb8a2'), smooth(0.55, 0.7, fbm(n4, x * 26, y * 26, z * 26, { octaves: 4 }) * 0.5 + 0.5) * shallow * 0.35);
    water = mix3(water, C.surf, reef);
    // the maelstrom: water wound round a dark heart, foam streaming in
    const [mx, my, md] = maelstrom(x, y, z);
    if (md > 0.99) {
      const rr = Math.hypot(mx, my);
      if (rr < 0.11) {
        const th = Math.atan2(my, mx);
        const arms = 0.5 + 0.5 * Math.sin(th * 3 + Math.log(rr + 0.003) * 8 + fine * 1.5);
        const fade = smooth(0.11, 0.04, rr);
        water = mix3(water, hex('#04213a'), smooth(0.06, 0.0, rr) * 0.85);
        water = mix3(water, hex('#dff4f5'), smooth(0.68, 0.95, arms) * fade * smooth(0.004, 0.016, rr) * 0.85);
      }
    }
    let ground = jungle(clamp(hi * 0.9 + (grain - 0.5) * 0.3));
    ground = mix3(ground, mix3(C.rock, C.rockHi, peaks), smooth(0.55, 0.85, hi + (peaks - 0.5) * 0.2) * 0.8);
    ground = mix3(ground, C.crater, crater);
    ground = mix3(ground, mix3(C.sandWet, C.sand, grain), beach);
    const col = mix3(water, ground, landK);
    const o = i * 3;
    albedo[o] = col[0];
    albedo[o + 1] = col[1];
    albedo[o + 2] = col[2];
    rough[o] = rough[o + 1] = rough[o + 2] = mix(mix(0.28, 0.4, reef), mix(0.85, 0.92, hi), landK);

    // ── lanterns at night ──
    let lit = 0;
    for (const [f, r, b] of PORTS) {
      const [px, py, pd] = f(x, y, z);
      if (pd > 0.99) lit += smooth(r, r * 0.2, Math.hypot(px, py)) * b * (0.6 + 0.4 * grain);
    }
    lit *= landK;
    night[o] = lit;
    night[o + 1] = lit * 0.7;
    night[o + 2] = lit * 0.35;

    // ── the sky ──
    // trade-wind cumulus in rows (stretched east–west), towers over the islands
    // fields of cloud and wide clear sky between: a slow field decides
    // where, the rows and puffs what it looks like there
    const where = fbm(nc, x * 2.2 + 5, y * 2.2, z * 2.2, { octaves: 4 });
    const rows = fbm(nc, x * 9, y * 34, z * 9, { octaves: 4 });
    const puffs = fbm(nw, x * 26, y * 26, z * 26, { octaves: 5 });
    const deck = fbm(nw, x * 7 + 2, y * 7, z * 7, { octaves: 5 });
    let ck = smooth(0.2, 0.42, rows * 0.4 + puffs * 0.7 + where * 0.6 + nearLand * 0.2 - 0.02) * (0.5 + 0.5 * smooth(0, 0.3, puffs));
    // and here and there a broad deck of stratocumulus
    ck = Math.max(ck, smooth(0.22, 0.45, deck + where * 0.5 - 0.12) * (0.55 + 0.45 * smooth(-0.1, 0.3, puffs)) * 0.85);
    ck *= 1 - smooth(45, 70, alat) * 0.3;
    // the hurricane: bands wound into an eyewall, the eye clear
    const [hx, hy, hd] = hurricane(x, y, z);
    if (hd > 0.98) {
      const rr = Math.hypot(hx, hy);
      if (rr < 0.16) {
        const th = Math.atan2(hy, hx);
        const band = 0.5 + 0.5 * Math.sin(th * 2 - Math.log(rr + 0.004) * 5 + puffs * 2);
        const wall = smooth(0.006, 0.012, rr) * smooth(0.03, 0.016, rr);
        const storm = Math.max(wall, smooth(0.4, 0.8, band) * smooth(0.16, 0.05, rr) * smooth(0.008, 0.02, rr));
        ck = Math.max(ck * (1 - smooth(0.12, 0.02, rr)), storm * 0.95);
      }
    }
    // Isla de Muerta, under its fog
    const [fx, fy, fd] = fogIsle(x, y, z);
    if (fd > 0.99) ck = Math.max(ck, smooth(0.034, 0.004, Math.hypot(fx, fy) * (1 + fbm(nw, x * 70, y * 70, z * 70, { octaves: 3 }) * 0.9)) * (0.45 + 0.35 * smooth(-0.2, 0.3, puffs)));
    clouds[o] = clouds[o + 1] = clouds[o + 2] = clamp(ck);
  });

  await save(albedo, W, H, 3, 'caribbean', [[2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 88 });
  await save(normalMap(height, W, H, 1), W, H, 3, 'caribbean-normal', [[1024, '']], { quality: 90 });
  await save(rough, W, H, 3, 'caribbean-rough', [[1024, '']], { quality: 84 });
  await save(night, W, H, 3, 'caribbean-night', [[1024, '']], { quality: 86 });
  await save(clouds, W, H, 3, 'caribbean-clouds', [[2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 80 });
}
