// The Caribbean as a whole world, for Pirates of the Caribbean: the real
// sea (./caribbean-geo.mjs, traced from the charts in degrees and put on
// the globe by the azimuthal projection Middle-earth uses) as the face the
// planet shows. Florida and the Bahamas' banks at the top, their shallows
// the pale turquoise that makes the sea there two colours; Cuba,
// Hispaniola (Haiti browner than the Dominican side, as it is from orbit),
// Jamaica and Puerto Rico across the middle with their mountains; the
// Lesser Antilles curving down the east to Trinidad; the Yucatán, the
// Mosquito Coast and the Spanish Main round the west and south. Every
// island is ringed by its turquoise shallows and a reef's light line, the
// banks' edges break white, and the deep is navy, darkest in the Cayman
// Trough and the Puerto Rico Trench. Tortuga is where it is, off
// Hispaniola's north coast; Port Royal at the end of the Palisadoes;
// Isla de Muerta out in the open sea under its fog. Past the chart the
// world goes on as warm sea with island arcs of its own, and Davy Jones's
// maelstrom turns out in the open water. Overhead, trade-wind cumulus in
// rows and a hurricane wound tight round its eye; at night, lanterns in the
// ports, Tortuga's and Port Royal's brightest.
//
// Makes caribbean at 4096 (-xl, KTX2), 2048 (-hq), 1024 and 512 (-sm);
// -clouds (alpha) at 2048, 1024 and 512; -normal at 2048 and 1024;
// -rough and -night at 1024.

import { BANKS, CENTRE, KM, LAKES, LANDS, MARKS, PORTS, RANGES, SMALL, UNITS_PER_RAD, sheet } from './caribbean-geo.mjs';
import { clamp, curve, eachTexel, fbm, hex, mix, mix3, normalMap, perlin, ramp, raster, ridged, sampler, save, smooth, bakeSize } from './sphere.mjs';

// (8192 × 4096 with --ultra: sphere.mjs's bakeSize)
const [W, H] = bakeSize();
const deg = Math.PI / 180;
const BOX = { x0: -330, y0: -330, x1: 1360, y1: 1040 };
const [CX, CY] = sheet(CENTRE);
const SMALL_K = 1.5; // the small islands drawn a little bigger than life, so the arc reads from orbit

// a point on the sphere as three's sphere lays it out (phi round from −x)
const on = (latD, phi) => [-Math.cos(phi) * Math.cos(latD * deg), Math.sin(latD * deg), Math.sin(phi) * Math.cos(latD * deg)];
// a frame at a point: east and north, to measure things laid flat round it
function frame(latD, phi) {
  const c = on(latD, phi);
  const e = [Math.sin(phi), 0, Math.cos(phi)];
  const n = [Math.cos(phi) * Math.sin(latD * deg), Math.cos(latD * deg), -Math.sin(phi) * Math.sin(latD * deg)];
  return (x, y, z) => {
    const d = x * c[0] + y * c[1] + z * c[2];
    return [x * e[0] + y * e[1] + z * e[2], x * n[0] + y * n[1] + z * n[2], d];
  };
}
// the island arcs out past the chart: great-circle-ish curves of islands, [lat, phi] points
const ARCS = [
  [[-14, 3.9], [-20, 4.3], [-22, 4.8], [-18, 5.2]],
  [[30, 5.6], [34, 6.0], [32, 0.4], [26, 0.7]],
  [[-30, 1.2], [-26, 1.6], [-30, 2.0]],
];
const ARC_PTS = ARCS.map((pts) => {
  const out = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const a = on(...pts[k]);
    const b = on(...pts[k + 1]);
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

// ── the chart, drawn ──
const at = (p) => sheet(p).map((v) => +v.toFixed(2));
const pts = (list) => list.map(at);
const poly = (list, extra = '') => `<path d="${curve(list)}" fill="#fff" ${extra}/>`;
const outline = (list, width, extra = '') => `<path d="${curve(list)}" fill="none" stroke="#fff" stroke-width="${width}" stroke-linejoin="round" ${extra}/>`;
const line = (list, width, extra = '') => `<path d="${curve(list, false)}" fill="none" stroke="#fff" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
// a small island: a capsule along its length (a long cay is a strip, not a lens)
const ellipse = ([, la, lo, long, wide, turn], k = SMALL_K, extra = '') => {
  const [x, y] = at([la, lo]);
  const w = Math.max(1.4, (wide / KM) * k);
  const half = Math.max(0, (long / KM / 2) * k - w / 2);
  const a = (turn * Math.PI) / 180;
  const dx = Math.sin(a) * half;
  const dy = -Math.cos(a) * half;
  return `<line x1="${(x - dx).toFixed(2)}" y1="${(y - dy).toFixed(2)}" x2="${(x + dx).toFixed(2)}" y2="${(y + dy).toFixed(2)}" stroke="#fff" stroke-width="${w.toFixed(2)}" stroke-linecap="round" ${extra}/>`;
};
async function layer(body, density, soften = 0) {
  const w = (BOX.x1 - BOX.x0) * density;
  const h = (BOX.y1 - BOX.y0) * density;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${BOX.x0} ${BOX.y0} ${BOX.x1 - BOX.x0} ${BOX.y1 - BOX.y0}"><rect x="${BOX.x0}" y="${BOX.y0}" width="${BOX.x1 - BOX.x0}" height="${BOX.y1 - BOX.y0}" fill="#000"/>${body}</svg>`;
  const s = sampler(await raster(svg, w, h, soften * density), w, h);
  return (x, y) => s((x - BOX.x0) * density, (y - BOX.y0) * density);
}

export async function bake() {
  console.log('the caribbean: drawing the chart');
  const landSvg = LANDS.map((l) => poly(pts(l.pts))).join('') + SMALL.map((e) => ellipse(e)).join('');
  const land = await layer(landSvg, 2, 0.35);
  const landSoft = await layer(landSvg, 1, 2.5);
  const rim = await layer(landSvg, 1, 6); // the turquoise ring every island stands in
  const shelf = await layer(landSvg, 1, 18); // the shallows going out to the deep
  const hills = await layer(LANDS.map((l) => poly(pts(l.pts), `fill-opacity="${l.hills}"`)).join(''), 1, 6);
  const banks = await layer(BANKS.map((b) => poly(pts(b.pts), `fill-opacity="${b.shoal}"`)).join(''), 1, 3);
  // the reefs: a light line where each bank drops off, and a fringe just off every coast
  const reefs = await layer(BANKS.filter((b) => b.shoal > 0.7).map((b) => outline(pts(b.pts), 0.9)).join('') + LANDS.filter((l) => l.kind === 'island').map((l) => outline(pts(l.pts), 1.1)).join(''), 2, 0.5);
  const core = await layer(RANGES.map((r) => line(pts(r.stroke), (r.width / KM) * 0.45, `stroke-opacity="${r.height}"`)).join(''), 2, 1.5);
  const foot = await layer(RANGES.map((r) => line(pts(r.stroke), (r.width / KM) * 1.4, `stroke-opacity="${r.height}"`)).join(''), 1, 4);
  const snowy = await layer(RANGES.filter((r) => r.snow).map((r) => line(pts(r.stroke), (r.width / KM) * 0.18)).join(''), 1, 1);
  const lakes = await layer(LAKES.map(([, p]) => poly(pts(p))).join(''), 2, 0.4);
  const ports = await layer(PORTS.map(([, la, lo, r, b]) => { const [x, y] = at([la, lo]); return `<circle cx="${x}" cy="${y}" r="${r / KM}" fill="#fff" fill-opacity="${b}"/>`; }).join(''), 2, 1.5);
  const [mdx, mdy] = at(MARKS.islaDeMuerta);

  console.log('the caribbean: painting the globe');
  const n1 = perlin(31);
  const n2 = perlin(32);
  const n3 = perlin(33);
  const n4 = perlin(34);
  const n5 = perlin(35);
  const n6 = perlin(36);
  const nc = perlin(37);
  const nw = perlin(38);
  const albedo = new Float32Array(W * H * 3);
  const height = new Float32Array(W * H);
  const rough = new Float32Array(W * H * 3);
  const night = new Float32Array(W * H * 3);
  const clouds = new Float32Array(W * H * 3);

  const LAT0 = CENTRE[0] * deg;
  const c0 = [Math.cos(LAT0), Math.sin(LAT0), 0];
  const e0 = [0, 0, -1];
  const n0 = [-Math.sin(LAT0), Math.cos(LAT0), 0];
  const maelstrom = frame(-2, Math.PI + 1.25); // (out in the Atlantic, east of Barbados)
  const hurricane = frame(24, Math.PI - 0.85);

  const sea = ramp([[0, '#c4efe0'], [0.1, '#86dfd2'], [0.22, '#3fc6c9'], [0.38, '#1796b4'], [0.55, '#0d6b9e'], [0.75, '#0a5089'], [0.9, '#073b6c'], [1, '#05294f']]);
  const jungle = ramp([[0, '#4a8636'], [0.4, '#356f2c'], [0.75, '#285c25'], [1, '#1f4c20']]);
  const C = Object.fromEntries(
    Object.entries({
      sand: '#efe2bf', sandWet: '#d8c99f', surf: '#e8fbff', rock: '#6d6152', rockHi: '#8a7b68', crater: '#3c342d', snow: '#f2f4f5',
      cane: '#7f9a48', caneHi: '#9aa85a', haiti: '#7b7448', haitiHi: '#8e8258', scrub: '#6a7f3e', glades: '#6d7a45', gladesWet: '#566a3c',
      dry: '#9a8a5a', dryHi: '#b09a68', cay: '#c9c69a', lake: '#2a6178',
    }).map(([k, v]) => [k, hex(v)]),
  );

  eachTexel(W, H, (x, y, z, i, lat) => {
    const latD = lat / deg;
    const alat = Math.abs(latD);
    // where this is on the chart, and the real latitude and longitude there
    const ang = Math.acos(clamp(x * c0[0] + y * c0[1] + z * c0[2], -1, 1));
    const tx = x * e0[0] + y * e0[1] + z * e0[2];
    const ty = x * n0[0] + y * n0[1] + z * n0[2];
    const tl = Math.hypot(tx, ty) || 1;
    const sx = CX + (UNITS_PER_RAD * ang * tx) / tl;
    const sy = CY - (UNITS_PER_RAD * ang * ty) / tl;
    const edge = Math.min(sx - BOX.x0, BOX.x1 - sx, sy - BOX.y0, BOX.y1 - sy);
    const inS = ang < 2.6 ? smooth(0, 90, edge) : 0;
    const S = inS > 0;
    const rlon = (sx / 1000) * 30 - 90;
    const rlat = 30 - (sy / 700) * 20;
    const fine = fbm(n2, x * 34, y * 34, z * 34, { octaves: 4 });
    const grain = fbm(n2, x * 90, y * 90, z * 90, { octaves: 3 }) * 0.5 + 0.5;
    const rag = fbm(n6, x * 160 + 5, y * 160, z * 160, { octaves: 3 }) * 0.5 + 0.5;

    // ── where the land is: the chart on the face, island arcs past it ──
    let chartLand = 0;
    let rimK = 0;
    let shelfK = 0;
    let bankK = 0;
    let reefK = 0;
    let hillK = 0;
    if (S) {
      const wobble = fbm(n1, x * 60, y * 60, z * 60, { octaves: 4 }) * 0.25 + fbm(n3, x * 200, y * 200, z * 200, { octaves: 2 }) * 0.12;
      chartLand = smooth(0.46, 0.54, mix(land(sx, sy), landSoft(sx, sy), 0.4) + wobble * 0.3);
      rimK = rim(sx, sy);
      shelfK = shelf(sx, sy);
      // (a bank's edge is ragged, its floor patched with sand and grass)
      const bw = fbm(n3, x * 24, y * 24, z * 24, { octaves: 5 }) * 0.5;
      bankK = smooth(0.1, 0.6, banks(sx, sy) + wobble * 0.35 + bw * 0.4) * (0.8 + 0.2 * smooth(-0.2, 0.3, bw));
      reefK = smooth(0.2, 0.7, reefs(sx, sy)) * (0.55 + 0.45 * smooth(-0.1, 0.25, fine));
      hillK = hills(sx, sy);
    }
    let chain = 0;
    for (const a of ARC_PTS) chain = Math.max(chain, Math.exp(-((arcDistance(x, y, z, a) / 0.05) ** 2)));
    const field = fbm(n1, x * 5, y * 5, z * 5, { octaves: 6 });
    const proLand = field + chain * (0.28 + fine * 0.5) + fine * 0.08 - 0.36 - smooth(40, 60, alat) * 0.3 - inS * 2;
    const proK = smooth(-0.004, 0.004, proLand);
    const landK = Math.max(chartLand * inS, proK);
    const beach = S ? smooth(0.3, 0.5, landSoft(sx, sy)) * (1 - smooth(0.6, 0.85, landSoft(sx, sy))) * inS : smooth(-0.004, 0.004, proLand) * (1 - smooth(0.006, 0.02, proLand));

    // ── the sea: shallow round the coasts and over the banks, the deep navy, darkest in the trenches ──
    const proBank = fbm(n3, x * 3.2, y * 3.2, z * 3.2, { octaves: 5 }) + chain * 0.15 + Math.max(0, proLand + 0.12) * 1.5 - 0.3 - smooth(28, 42, alat) * 0.5;
    const proShallow = Math.max(smooth(-0.16, 0, proLand) ** 1.3, smooth(-0.05, 0.18, proBank)) * (1 - inS);
    const chartShallow = Math.max(smooth(0.02, 0.4, rimK) * 0.9, bankK * 0.8, smooth(0.04, 0.3, shelfK) * 0.55) * inS;
    const shallow = Math.max(proShallow, chartShallow);
    // the Cayman Trough, between Cuba and Jamaica, and the Puerto Rico Trench north of the islands
    const cayman = S ? Math.exp(-(((rlat - (19.3 - (rlon + 81) * 0.02)) / 0.55) ** 2)) * smooth(-87, -84, rlon) * smooth(-75.5, -77.5, rlon) : 0;
    const prTrench = S ? Math.exp(-(((rlat - (19.85 - Math.max(0, rlon + 66) * 0.3)) / 0.45) ** 2)) * smooth(-70, -67, rlon) * smooth(-60.5, -63, rlon) : 0;
    const floorV = fbm(n4, x * 14, y * 14, z * 14, { octaves: 4 });
    const depth = clamp(1 - shallow * 0.92 + floorV * 0.14 * (0.4 + shallow) + fbm(n5, x * 4, y * 4, z * 4, { octaves: 3 }) * 0.06 - 0.08 + (cayman + prTrench) * 0.25 * inS);
    const proReef = smooth(0.012, 0.0, Math.abs(proBank - 0.035)) * (0.4 + 0.6 * smooth(-0.1, 0.2, fine)) * 0.4 * (1 - inS);
    const reef = Math.max(proReef, reefK * inS * (1 - landK) * 0.6);

    // ── relief ──
    const peaks = ridged(n5, x * 120, y * 120, z * 120, { octaves: 5 });
    const rc = S ? core(sx, sy) * inS : 0;
    const rf = S ? foot(sx, sy) * inS : 0;
    const proHi = clamp(proLand * 3.2);
    const hi = Math.max(proHi * (1 - inS), clamp(hillK * 0.45 + rc * (0.4 + 0.6 * peaks) + rf * 0.35 * (0.4 + peaks)));
    const elev = landK * (0.03 + hi * (0.4 + peaks * 0.6));
    const crater = landK * smooth(0.55, 0.62, proHi) * smooth(0.72, 0.85, fbm(n4, x * 60, y * 60, z * 60, { octaves: 2 }) * 0.5 + 0.5) * (1 - inS);
    const lakeK = S ? smooth(0.35, 0.6, lakes(sx, sy)) * inS * landK : 0;
    height[i] = (elev - crater * 0.15) * (1 - lakeK) * 0.014;

    // ── colour ──
    let water = sea(depth);
    // sand ripples on the banks, and the darker patches of seagrass
    water = mix3(water, hex('#5fb8a2'), smooth(0.55, 0.7, fbm(n4, x * 26, y * 26, z * 26, { octaves: 4 }) * 0.5 + 0.5) * shallow * 0.35);
    // the banks' floor: paler sand where it's shallowest, tidal channels cut through
    water = mix3(water, hex('#a9e6da'), bankK * smooth(0.55, 0.75, floorV * 0.5 + 0.5 + rag * 0.25) * 0.3 * inS);
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
    // the land: jungle by height; Cuba's cane fields, Haiti's bare hills,
    // Florida's glades, the Yucatán's scrub, the Main drier, the Bahamas' cays pale
    let ground = jungle(clamp(hi * 0.9 + (grain - 0.5) * 0.3));
    if (S) {
      const cuba = rlat > 19.7 && rlat < 23.4 && rlon > -85.1 && rlon < -74;
      const haiti = rlat > 17.9 && rlat < 20.2 && rlon < -71.7 && rlon > -74.6;
      const florida = rlat > 24.9;
      const yucatan = rlat > 17.8 && rlon < -86.7 && rlon > -91.5;
      const main = rlat < 12.5 && rlon > -77;
      const bahamas = rlat > 20.8 && rlat < 27.5 && rlon > -79.5 && rlon < -71 && !cuba;
      if (cuba) ground = mix3(ground, mix3(C.cane, C.caneHi, smooth(0.3, 0.8, rag * 0.6 + grain * 0.4)), (1 - smooth(0.25, 0.5, hi)) * 0.7);
      if (haiti) ground = mix3(ground, mix3(C.haiti, C.haitiHi, grain), 0.6 * smooth(-71.7, -72.0, rlon));
      if (florida) ground = mix3(ground, mix3(C.glades, C.gladesWet, smooth(0.4, 0.7, rag)), rlat < 27 ? 0.75 : 0.45);
      if (yucatan) ground = mix3(ground, mix3(C.scrub, C.dry, grain * 0.4), 0.7);
      if (main) ground = mix3(ground, mix3(C.dry, C.dryHi, grain), (1 - smooth(0.2, 0.5, hi)) * 0.55 * smooth(-71, -68, rlon));
      if (bahamas) ground = mix3(ground, mix3(C.scrub, C.cay, grain), 0.55);
    }
    ground = mix3(ground, mix3(C.rock, C.rockHi, peaks), smooth(0.6, 0.9, hi + (peaks - 0.5) * 0.2) * 0.7);
    ground = mix3(ground, C.snow, S ? smooth(0.3, 0.7, snowy(sx, sy)) * smooth(0.5, 0.75, hi + (peaks - 0.5) * 0.3) * inS : 0);
    ground = mix3(ground, C.crater, crater);
    ground = mix3(ground, mix3(C.sandWet, C.sand, grain), beach * 0.8);
    ground = mix3(ground, C.lake, lakeK);
    const col = mix3(water, ground, landK);
    const o = i * 3;
    albedo[o] = col[0];
    albedo[o + 1] = col[1];
    albedo[o + 2] = col[2];
    // the sea glints, the land doesn't
    rough[o] = rough[o + 1] = rough[o + 2] = mix(mix(0.22, 0.4, reef), mix(0.88, 0.92, hi), landK * (1 - lakeK));

    // ── lanterns at night ──
    let lit = S ? ports(sx, sy) * inS * landK * (0.55 + 0.45 * grain) : 0;
    night[o] = lit;
    night[o + 1] = lit * 0.7;
    night[o + 2] = lit * 0.35;

    // ── the sky ──
    // trade-wind cumulus in rows (stretched east–west), towers over the islands;
    // fields of cloud and wide clear sky between
    const where = fbm(nc, x * 2.2 + 5, y * 2.2, z * 2.2, { octaves: 4 });
    const rows = fbm(nc, x * 9, y * 34, z * 9, { octaves: 4 });
    const puffs = fbm(nw, x * 26, y * 26, z * 26, { octaves: 5 });
    const deck = fbm(nw, x * 7 + 2, y * 7, z * 7, { octaves: 5 });
    let ck = smooth(0.22, 0.44, rows * 0.4 + puffs * 0.7 + where * 0.6 + landK * 0.15 - 0.04) * (0.5 + 0.5 * smooth(0, 0.3, puffs));
    ck = Math.max(ck, smooth(0.24, 0.47, deck + where * 0.5 - 0.14) * (0.55 + 0.45 * smooth(-0.1, 0.3, puffs)) * 0.8);
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
    if (S) {
      const fd = Math.hypot(sx - mdx, sy - mdy) * (1 + fbm(nw, x * 70, y * 70, z * 70, { octaves: 3 }) * 0.9);
      ck = Math.max(ck, smooth(12, 1.5, fd) * (0.5 + 0.35 * smooth(-0.2, 0.3, puffs)));
    }
    clouds[o] = clouds[o + 1] = clouds[o + 2] = clamp(ck);
  });

  // (ONLY=normal: just the relief, at 2048 for ultra too, the others left as they are)
  const only = process.env.ONLY;
  if (only !== 'normal') await save(albedo, W, H, 3, 'caribbean', [[4096, '-xl'], [2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 88 });
  await save(normalMap(height, W, H, 1), W, H, 3, 'caribbean-normal', [[2048, '-hq'], [1024, '']], { quality: 90 });
  if (only === 'normal') return;
  await save(rough, W, H, 3, 'caribbean-rough', [[1024, '']], { quality: 84 });
  await save(night, W, H, 3, 'caribbean-night', [[1024, '']], { quality: 86 });
  await save(clouds, W, H, 3, 'caribbean-clouds', [[2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 80 });
}
