// Breaking Bad's planet: New Mexico, where the show was made and set, as the
// face the planet shows (./breakingbad-geo.mjs: the real state, in
// degrees, laid on a sheet in kilometres round Albuquerque and put on the
// globe by the azimuthal projection Middle-earth uses). The Rio Grande runs
// down the middle from the San Juans to El Paso, green with its bosque and
// the valley's fields, through the gorge at Taos, past Santa Fe's
// Sangre de Cristos, the Jemez's caldera and Albuquerque under the Sandias'
// west wall, Elephant Butte, the Organs and Las Cruces. White Sands lies
// bright in the Tularosa basin between the San Andres and the Sacramentos
// with the black Carrizozo flow above it; the Llano Estacado is a pale flat
// table east of the Pecos; the Chihuahuan desert is red and tan in the
// south, the Gila's forest dark in the south-west, the Colorado Plateau's
// mesas banded red, white and purple in the north-west. Albuquerque is a
// grid of grey-tan blocks with I-25 and I-40 crossing at the Big I, by day
// and lit at night. Past the sheet the world goes on as the Basin and
// Range: ranges in long north–south lines, basins, mesas, lava and dunes.
//
// Makes breakingbad at 4096 (-xl, KTX2), 2048 (-hq), 1024 and 512 (-sm);
// -normal at 2048, 1024 and 512; -night and -clouds (alpha) at 1024 and
// 512; -rough at 1024: summer's thunderheads over the mountains.

import { ABQ, BIG_I, CALDERA, CITY, DESERT, GILA, KM_PER_RAD, LAKES, LLANO, MALPAIS, PEAKS, PLAINS, PLATEAU, PLAYAS, RANGES, REDROCK, RIVERS, ROADS, SANDS, TOWNS, VOLCANOES, sheet } from './breakingbad-geo.mjs';
import { clamp, curve, eachTexel, fbm, hex, mix, mix3, normalMap, perlin, ramp, raster, ridged, sampler, save, smooth, bakeSize } from './sphere.mjs';

// (8192 × 4096 with --ultra: sphere.mjs's bakeSize)
const [W, H] = bakeSize();
const LAT0 = (ABQ[0] * Math.PI) / 180; // Albuquerque, the middle of the face shown first
// the sheet's raster: what's drawn from the map, in sheet km (a margin round the 1000-km sheet)
const BOX = { x0: -60, y0: -60, x1: 1060, y1: 1060 };
const CITY_K = 1.6; // the city drawn bigger than life about its middle, so its grid reads from orbit
const BLOCK = 4.2; // km between the city's big streets (a mile, drawn bigger)

const at = (p) => sheet(p).map((v) => +v.toFixed(2));
const pts = (list) => list.map(at);
const cityPt = (p) => {
  const [x, y] = at(p);
  const [cx, cy] = at(BIG_I);
  return [cx + (x - cx) * CITY_K, cy + (y - cy) * CITY_K];
};
const poly = (list, extra = '') => `<path d="${curve(list)}" fill="#fff" ${extra}/>`;
const line = (list, width, extra = '') => `<path d="${curve(list, false)}" fill="none" stroke="#fff" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const disc = ([x, y], r, extra = '', fill = '#fff') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;

async function layer(body, density, soften = 0) {
  const w = (BOX.x1 - BOX.x0) * density;
  const h = (BOX.y1 - BOX.y0) * density;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${BOX.x0} ${BOX.y0} ${BOX.x1 - BOX.x0} ${BOX.y1 - BOX.y0}"><rect x="${BOX.x0}" y="${BOX.y0}" width="${BOX.x1 - BOX.x0}" height="${BOX.y1 - BOX.y0}" fill="#000"/>${body}</svg>`;
  const s = sampler(await raster(svg, w, h, soften * density), w, h);
  return (x, y) => s((x - BOX.x0) * density, (y - BOX.y0) * density);
}

export async function bake() {
  console.log('breaking bad: drawing new mexico');
  const grande = RIVERS[0];
  const river = await layer(RIVERS.map(([, w, p]) => line(pts(p), w)).join(''), 2, 0.3);
  const valley = await layer(RIVERS.map(([, w, p]) => line(pts(p), w * 4 + 5)).join(''), 1, 5);
  // the Rio Grande's bosque and farms: a green strip, wider in the valleys, narrow in the gorges
  const bosque = await layer(line(pts(grande[2]), 7), 2, 1.6);
  const fields = await layer(line(pts(grande[2].filter(([lat]) => lat < 35.5 && lat > 32.0)), 15), 1, 4);
  const lakes = await layer(LAKES.map(([, p]) => poly(pts(p))).join(''), 2, 0.4);
  const core = await layer(RANGES.map((r) => line(pts(r.stroke), r.width * 0.45, `stroke-opacity="${r.height}"`)).join(''), 2, 2.2);
  const foot = await layer(RANGES.map((r) => line(pts(r.stroke), r.width * 1.5, `stroke-opacity="${r.height}"`)).join(''), 1, 7);
  const forested = await layer(RANGES.filter((r) => r.forest).map((r) => line(pts(r.stroke), r.width * 1.1)).join(''), 1, 4);
  const snowy = await layer(RANGES.filter((r) => r.snow).map((r) => line(pts(r.stroke), r.width * 0.22)).join('') + PEAKS.filter((p) => p[5]).map(([, la, lo, r]) => disc(at([la, lo]), r * 0.3)).join(''), 1, 1.5);
  // the Sandias' and Manzanos' west faces: a wall over the valley
  const wall = await layer(RANGES.filter((r) => r.westWall).map((r) => line(pts(r.stroke).map(([x, y]) => [x - r.width * 0.32, y]), r.width * 0.3)).join(''), 2, 1.2);
  // (each volcano a cone: a radial ramp, its summit the brightest)
  const cone = '<defs><radialGradient id="cone"><stop offset="0" stop-color="#fff"/><stop offset="0.25" stop-color="#ddd"/><stop offset="1" stop-color="#000"/></radialGradient></defs>';
  const peaks = await layer(cone + PEAKS.map(([, la, lo, r, h]) => disc(at([la, lo]), r, `fill-opacity="${h}"`, 'url(#cone)')).join('') + VOLCANOES.map((v) => disc(cityPt(v), 1.4, 'fill-opacity="0.5"', 'url(#cone)')).join(''), 2, 0.8);
  const cc = at(CALDERA.centre);
  const caldera = await layer(`<circle cx="${cc[0]}" cy="${cc[1]}" r="${CALDERA.r}" fill="none" stroke="#fff" stroke-width="${CALDERA.rim}"/>` + disc(at(CALDERA.dome), CALDERA.domeR, 'fill-opacity="0.7"'), 2, 2.4);
  const calderaFloor = await layer(disc(cc, CALDERA.r - CALDERA.rim * 0.6), 1, 2);
  const region = async (list, soft) => layer((Array.isArray(list[0][0]) ? list : [list]).map((p) => poly(pts(p))).join(''), 1, soft);
  const sands = await layer(poly(pts(SANDS)), 2, 1.2);
  const malpais = await region(MALPAIS, 1.2);
  const playas = await region(PLAYAS, 1.5);
  const llano = await region(LLANO, 10);
  const plains = await region(PLAINS, 30);
  const desert = await region(DESERT, 35);
  const plateau = await region(PLATEAU, 30);
  const redrock = await region(REDROCK, 8);
  const gila = await region(GILA, 14);
  const city = await layer(poly(CITY.map(cityPt)), 2, 1.2);
  const roads = await layer(ROADS.map(([, p]) => line(pts(p), 0.9)).join(''), 2, 0.3);
  // through the city the interstates are drawn wide: the Big I's cross
  const [bx, by] = at(BIG_I);
  const cityRoads = await layer(ROADS.slice(0, 2).map(([, p]) => line(p.map(cityPt), 2.2)).join(''), 2, 0.3);
  const towns = await layer(TOWNS.map(([, la, lo, r, b]) => disc(at([la, lo]), r * 0.7, `fill-opacity="${b}"`)).join(''), 2, 2.5);

  console.log('breaking bad: painting the globe');
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

  // the sheet's frame on the globe: its middle, east and north
  const c0 = [Math.cos(LAT0), Math.sin(LAT0), 0];
  const e0 = [0, 0, -1];
  const n0 = [-Math.sin(LAT0), Math.cos(LAT0), 0];

  // the desert floor, tan to red going south
  const floor = ramp([[0, '#b98e5c'], [0.35, '#c99f69'], [0.65, '#d5b07a'], [1, '#e3c693']]);
  const chihuahuan = ramp([[0, '#a8603e'], [0.3, '#bb7a4c'], [0.6, '#c99460'], [1, '#d8b07c']]);
  const grassland = ramp([[0, '#9c8d58'], [0.5, '#ae9d64'], [1, '#c0ae74']]);
  // the Chinle's bands, up a mesa's side
  const STRATA = ['#9c4f36', '#b8673f', '#e6d6b3', '#8f6a6a', '#c98a52', '#a4553a', '#efe2c4', '#b07a55'].map(hex);
  const C = Object.fromEntries(
    Object.entries({
      caliche: '#e3d3ab', basalt: '#2f2a27', basaltHi: '#4a403a', cinder: '#5a2e22', gypsum: '#fffaf0', gypsumShade: '#e8ddc8', playa: '#e2d8c2', llano: '#cbb487', llanoHi: '#d8c49a', caprock: '#9a7a55',
      juniper: '#4a5533', pine: '#2f4026', pineHi: '#3e5130', granite: '#8a6352', graniteHi: '#b48a74', bosque: '#4d6230', bosqueHi: '#627a3a', farm: '#7d8a45', farmDry: '#a79a63',
      river: '#3f5a55', lake: '#2c5a6a', urban: '#a59a89', urbanHi: '#bdb2a0', street: '#6d675f', freeway: '#4a4744', snow: '#f1f2f0', meadow: '#8c9a58',
    }).map(([k, v]) => [k, hex(v)]),
  );
  // the luminance of the valley and the mesa beside it, measured as we go (the contrast it must read with)
  const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const tally = { valley: [0, 0], mesa: [0, 0] };

  eachTexel(W, H, (x, y, z, i, lat) => {
    const latD = (lat * 180) / Math.PI;
    // where this is on the sheet
    const ang = Math.acos(clamp(x * c0[0] + y * c0[1] + z * c0[2], -1, 1));
    const tx = x * e0[0] + y * e0[1] + z * e0[2];
    const ty = x * n0[0] + y * n0[1] + z * n0[2];
    const tl = Math.hypot(tx, ty) || 1;
    const sx = 500 + (KM_PER_RAD * ang * tx) / tl;
    const sy = 500 - (KM_PER_RAD * ang * ty) / tl;
    const edge = Math.min(sx - BOX.x0, BOX.x1 - sx, sy - BOX.y0, BOX.y1 - sy);
    const inS = ang < 2.6 ? smooth(0, 70, edge) : 0; // on the sheet, fading out at its edge
    const S = inS > 0;
    const g = (f) => (S ? f(sx, sy) * inS : 0);
    // the regions are read through a warp (km), so where one country gives way to the next is ragged, not drawn
    const ux = sx + fbm(n5, x * 16, y * 16, z * 16, { octaves: 4 }) * 26 + fbm(n6, x * 70 + 3, y * 70, z * 70, { octaves: 3 }) * 8;
    const uy = sy + fbm(n5, x * 16 + 11, y * 16, z * 16, { octaves: 4 }) * 26 + fbm(n6, x * 70, y * 70 + 3, z * 70, { octaves: 3 }) * 8;
    const gw = (f) => (S ? f(ux, uy) * inS : 0);
    // part of that warp, for what should keep closer to the map (the ranges, the sands, the lava)
    const vx = sx + (ux - sx) * 0.3;
    const vy = sy + (uy - sy) * 0.3;
    const gv = (f) => (S ? f(vx, vy) * inS : 0);

    // ── the Basin and Range, everywhere (quieter on the sheet, where the real ranges are) ──
    const along = (k) => [x * k * 2.6, y * k * 0.7, z * k * 2.6];
    const province = fbm(n5, x * 1.3 + 7, y * 1.3, z * 1.3, { octaves: 3 });
    const rangeProv = smooth(-0.02, 0.18, province);
    const [ax, ay, az] = along(3.2);
    const proRanges = smooth(0.58, 0.86, ridged(n1, ax, ay, az, { octaves: 5 })) * (0.15 + 0.85 * rangeProv) * (1 - inS * 0.88);
    const basin = fbm(n2, x * 2.2, y * 2.2, z * 2.2, { octaves: 4 }) * 0.5 + 0.5;
    const detail = ridged(n3, x * 70, y * 70, z * 70, { octaves: 4 });
    const grain = fbm(n3, x * 80, y * 80, z * 80, { octaves: 3 }) * 0.5 + 0.5;
    const mid = fbm(n4, x * 6, y * 6, z * 6, { octaves: 5 }) * 0.5 + 0.5;
    const big = fbm(n6, x * 2.5 + 3, y * 2.5, z * 2.5, { octaves: 4 }) * 0.5 + 0.5;
    const rag = fbm(n6, x * 140 + 5, y * 140, z * 140, { octaves: 3 }) * 0.5 + 0.5;

    // the regions of the sheet (the plateau's mesas off it are wherever the noise puts them)
    const plat = S ? gw(plateau) : smooth(0.06, 0.24, -province);
    const llanoK = smooth(0.25, 0.75, gw(llano));
    const plainsK = gw(plains) * (1 - llanoK);
    const desertK = gw(desert);
    const gilaK = gw(gila);
    const redK = gw(redrock);
    // mesas: a plateau field stepped into terraces, each with a cliff
    const mesaF = fbm(n4, x * 5, y * 5, z * 5, { octaves: 5 }) * 0.5 + 0.5 + redK * 0.12;
    const t = clamp((mesaF - 0.35) * 2.2) * 5;
    const level = Math.floor(t);
    const cliff = smooth(0.74, 0.86, t - level) * (1 - smooth(0.9, 0.99, t - level));
    const mesa = ((level + smooth(0.78, 0.98, t - level)) / 5) * plat;

    // the real ranges, the volcanoes and the caldera
    const rc = gv(core);
    const rf = gv(foot);
    const pk = gv(peaks);
    const ring = g(caldera);
    const wallK = g(wall);
    const rd = rc + rf + proRanges + ring > 0.01 ? ridged(n5, x * 160, y * 160, z * 160, { octaves: 5 }) : 0.4;
    const rl = rf + ring > 0.01 ? ridged(n6, x * 45, y * 45, z * 45, { octaves: 4 }) : 0.4;
    const mount = rc * (0.15 + 0.95 * rd ** 1.4) + pk * 0.25 * rd + rf * 0.3 * (0.3 + rl) * (0.6 + 0.6 * rd) + pk * 0.85 + ring * (0.35 + 0.4 * rd) + wallK * 0.25;
    // the rivers, their valleys, the lakes
    const water = S ? smooth(0.25, 0.6, river(sx, sy)) * inS : 0;
    const lakeK = S ? smooth(0.35, 0.6, lakes(sx, sy)) * inS : 0;
    const valleyK = g(valley);
    const bosqueK = S ? smooth(0.2, 0.6, bosque(sx, sy) + (rag - 0.5) * 0.35) * inS : 0;
    const fieldK = g(fields);
    const low = (1 - smooth(0.25, 0.6, proRanges + mount + mesa * 0.8 + basin * 0.3)) * (1 - llanoK * 0.7);
    // the low country: lava, sand, playas
    const flows = smooth(0.3, 0.6, gv(malpais) + (rag - 0.5) * 0.4);
    const lava = Math.max(flows, smooth(0.69, 0.73, fbm(n5, x * 9, y * 9, z * 9, { octaves: 5 }) * 0.5 + 0.5) * low * (1 - inS));
    const cones = lava > 0.2 ? smooth(0.85, 0.97, ridged(n6, x * 120, y * 120, z * 120, { octaves: 1 })) * (1 - inS) : 0;
    const sandK = smooth(0.3, 0.6, gv(sands) + (rag - 0.5) * 0.45);
    const proSands = smooth(0.72, 0.76, fbm(n6, x * 5 + 9, y * 5, z * 5, { octaves: 4 }) * 0.5 + 0.5) * low * (1 - lava) * (1 - inS);
    const sandsK = Math.max(sandK, proSands);
    const playa = Math.max(g(playas), smooth(0.7, 0.76, fbm(n4, x * 6 + 2, y * 6, z * 6, { octaves: 4 }) * 0.5 + 0.5) * low * (1 - lava) * (1 - sandsK) * (1 - inS));
    // (White Sands' dunes are crescents marching north-east: a fine ripple, broken up)
    const dunes = smooth(0.25, 0.75, fbm(n2, x * 420, y * 160, z * 420, { octaves: 3 }) * 0.5 + 0.5) * 0.6 + grain * 0.4;
    const wash = smooth(0.012, 0.003, Math.abs(fbm(n3, x * 22, y * 22, z * 22, { octaves: 4 }))) * (1 - proRanges) * (1 - mesa * 0.6) * (1 - llanoK);
    // the city
    const cityK = g(city);
    const gx = (sx - bx) / BLOCK;
    const gy = (sy - by) / BLOCK;
    const streets = Math.max(smooth(0.16, 0.06, Math.abs(gx - Math.round(gx))), smooth(0.16, 0.06, Math.abs(gy - Math.round(gy))));
    const bigI = S ? smooth(0.2, 0.6, cityRoads(sx, sy)) * inS : 0;
    const road = S ? smooth(0.2, 0.6, roads(sx, sy)) * inS * 0.55 : 0;

    // ── relief ──
    let h = 0.12 + basin * 0.12 * (1 - llanoK * 0.8) + proRanges * (0.35 + detail * 0.6) + mesa * 0.42 + mount + cones * 0.12 + lava * 0.02;
    h += llanoK * 0.08; // the Llano: a table, high and flat
    h -= valleyK * 0.1 + wash * 0.025 + g(calderaFloor) * 0.12;
    h = h * (1 - water) * (1 - lakeK) + 0.04 * Math.max(water, lakeK);
    height[i] = h * 0.022;

    // ── colour ──
    let col = floor(clamp(mid * 0.6 + big * 0.3 + grain * 0.15 - 0.05));
    col = mix3(col, hex('#a8714a'), smooth(0.58, 0.75, big) * 0.45 * (1 - inS * 0.5)); // red soils
    col = mix3(col, hex('#8f7550'), smooth(0.4, 0.25, big) * 0.35); // darker scrub
    col = mix3(col, grassland(grain), smooth(0.5, 0.7, basin) * 0.45);
    col = mix3(col, C.caliche, smooth(0.66, 0.82, mid) * 0.3);
    // the regions: the Chihuahuan's reds south, the high plains' grass, the Llano's pale table
    col = mix3(col, chihuahuan(clamp(mid * 0.55 + grain * 0.25 + rag * 0.15 - 0.05)), desertK * 0.6);
    col = mix3(col, mix3(grassland(clamp(grain * 0.6 + mid * 0.4)), C.meadow, smooth(0.6, 0.8, mid) * 0.3), plainsK * 0.85);
    // the Llano: a pale table, its farms' irrigated circles dotted over it
    const pivot = (() => {
      const q = 7; // km between the pivots
      const cx = ux / q - Math.floor(ux / q) - 0.5;
      const cy = uy / q - Math.floor(uy / q) - 0.5;
      const on = fbm(n2, Math.floor(ux / q) * 0.37, Math.floor(uy / q) * 0.37, 1.7, { octaves: 2 }) > 0.12;
      return on ? smooth(0.42, 0.36, Math.hypot(cx, cy)) : 0;
    })();
    col = mix3(col, mix3(C.llano, C.llanoHi, smooth(0.3, 0.8, grain * 0.5 + mid * 0.5)), llanoK * 0.85);
    col = mix3(col, mix3(C.farm, C.farmDry, smooth(0.3, 0.7, rag)), pivot * llanoK * 0.55);
    // its western edge, the Caprock: a broken escarpment, darker
    col = mix3(col, C.caprock, smooth(0.15, 0.5, llanoK * (1 - llanoK) * 4) * smooth(0.3, 0.6, rd * 0.5 + grain * 0.5) * 0.6);
    // the mesas' bands, by height up their sides; redder in the Chinle's country
    if (mesa > 0.01) {
      const top = STRATA[level % STRATA.length];
      const face = mix3(STRATA[(level + 1) % STRATA.length], STRATA[(level + 3) % STRATA.length], grain);
      const cap = mix3(col, top, 0.3 + 0.15 * grain + redK * 0.3);
      const s = mix3(cap, face.map((c) => c * 0.8), smooth(0.05, 0.6, cliff));
      col = mix3(col, s, smooth(0.02, 0.12, mesa) * (0.55 + redK * 0.35));
    }
    col = mix3(col, mix3(STRATA[0], STRATA[1], grain), redK * 0.35);
    // juniper and piñon dotting the middle country
    const dots = smooth(0.62, 0.72, fbm(n2, x * 260, y * 260, z * 260, { octaves: 2 }) * 0.5 + 0.5);
    // the ranges: bare rock low, juniper on the slopes, pine on the tops, snow on the highest
    // the ranges: rock lit on the crests and dark in the gullies, juniper
    // on the lower slopes, pine in patches up high, snow on the highest
    const rockK = smooth(0.06, 0.38, rc * 0.9 + rf * 0.4 + pk + ring + proRanges);
    const rock = mix3(mix3(hex('#5e4c3e'), hex('#8a7058'), smooth(0.25, 0.7, rd)), hex('#b0947a'), smooth(0.75, 0.98, rd) * 0.6);
    col = mix3(col, rock, rockK * 0.9);
    col = mix3(col, C.juniper, dots * smooth(0.1, 0.5, rf + rc + proRanges) * 0.55);
    const patch = smooth(0.38, 0.62, rd * 0.55 + fbm(n4, x * 110, y * 110, z * 110, { octaves: 3 }) * 0.35 + 0.25);
    const forestK = (S ? smooth(0.2, 0.6, forested(sx, sy)) * inS : 0) * smooth(0.3, 0.55, h + (grain - 0.5) * 0.15) * patch;
    col = mix3(col, mix3(C.pine, C.pineHi, smooth(0.3, 0.9, rd)), clamp(Math.max(forestK * 0.85, smooth(0.86, 1.0, h + (grain - 0.5) * 0.1) * 0.8 * (1 - inS))));
    // the Gila's wilderness, forest over its mountains and mesas
    const gilaPatch = smooth(0.48, 0.58, rag * 0.25 + fbm(n4, x * 55, y * 55, z * 55, { octaves: 5 }) * 0.55 + 0.4 + h * 0.5);
    col = mix3(col, mix3(C.pine, C.juniper, smooth(0.5, 0.9, grain) * 0.6), gilaK * gilaPatch * 0.85);
    // the Sandias' and Manzanos' west walls: pink granite (the watermelon at sunset)
    col = mix3(col, mix3(C.granite, C.graniteHi, rd), smooth(0.2, 0.6, wallK) * 0.85);
    // the Valles Caldera's floor: grassland, green in the summer
    col = mix3(col, mix3(C.meadow, C.farm, grain), g(calderaFloor) * 0.8);
    const snowK = Math.max(g(snowy) * smooth(0.7, 0.9, h + (rd - 0.5) * 0.5), smooth(1.0, 1.08, h + (detail - 0.5) * 0.2) * smooth(30, 50, Math.abs(latD)) * (1 - inS));
    col = mix3(col, C.snow, clamp(snowK));
    // the low country: lava, white sand, playas, washes
    col = mix3(col, mix3(C.basalt, C.basaltHi, grain), lava);
    col = mix3(col, C.cinder, cones);
    col = mix3(col, mix3(C.gypsumShade, C.gypsum, dunes), sandsK);
    col = mix3(col, C.playa, playa * 0.9);
    col = mix3(col, hex('#e6d4ad'), wash * 0.5 * (1 - inS * 0.5));
    // the valley: fields and the bosque's cottonwoods, the river in them
    col = mix3(col, mix3(C.farm, C.farmDry, smooth(0.4, 0.75, rag)), fieldK * smooth(0.25, 0.55, rag + grain * 0.3) * 0.75);
    col = mix3(col, mix3(C.bosque, C.bosqueHi, grain), bosqueK * 0.95);
    col = mix3(col, C.bosque, smooth(0.3, 0.7, valleyK) * 0.3 * (1 - bosqueK));
    // the city: grey-tan blocks, each its own shade (houses, a park, a
    // mall's roofs), its streets between, the Big I's cross
    const blockShade = fbm(n2, Math.floor(gx) * 0.71, Math.floor(gy) * 0.71, 4.2, { octaves: 2 }) * 0.5 + 0.5;
    col = mix3(col, mix3(mix3(C.urban, C.urbanHi, smooth(0.3, 0.8, blockShade)), C.farm, smooth(0.78, 0.86, blockShade) * 0.6), cityK * 0.88);
    col = mix3(col, C.street, streets * cityK * 0.38);
    col = mix3(col, C.freeway, Math.max(bigI * smooth(0.2, 0.8, cityK + 0.3), road * 0.55));
    col = mix3(col, C.river, water);
    col = mix3(col, C.lake, lakeK);
    // a little lighter on the heights
    col = col.map((c) => c * (0.94 + h * 0.08));

    // (the valley against the mesa beside it, along the Rio Grande's middle course)
    if (S && sy > 380 && sy < 860 && cityK < 0.1) {
      if (bosqueK > 0.8) {
        tally.valley[0] += lum(col);
        tally.valley[1]++;
      } else if (valleyK < 0.05 && mount < 0.05 && sandsK < 0.1 && lava < 0.1 && Math.abs(sx - sheet([34.0, -106.89])[0]) < 60) {
        tally.mesa[0] += lum(col);
        tally.mesa[1]++;
      }
    }

    const o = i * 3;
    albedo[o] = col[0];
    albedo[o + 1] = col[1];
    albedo[o + 2] = col[2];
    rough[o] = rough[o + 1] = rough[o + 2] = mix(mix(0.95, 0.9, playa * 0.5), 0.3, Math.max(water, lakeK));

    // ── night: sodium orange; the city's grid and the Big I brightest, the towns, the interstates faint ──
    let lit = 0;
    if (S) {
      // (a town's lights in its streets, not a disc)
      const tl = towns(sx, sy) * inS;
      const tStreets = tl > 0.01 ? Math.max(smooth(0.22, 0.08, Math.abs(gx * 2.2 - Math.round(gx * 2.2))), smooth(0.22, 0.08, Math.abs(gy * 2.2 - Math.round(gy * 2.2)))) : 0;
      lit = cityK * (0.3 + streets * 0.75) * (0.6 + 0.4 * grain) + bigI * cityK * 1.1 + tl * (0.25 + 0.75 * tStreets) * (0.5 + 0.5 * grain) + road * 0.12 * (1 - cityK);
    }
    night[o] = lit;
    night[o + 1] = lit * 0.62;
    night[o + 2] = lit * 0.26;

    // ── the sky: summer's thunderheads building over the ranges ──
    const cv = fbm(nc, x * 6, y * 6, z * 6, { octaves: 6 });
    const ck = smooth(0.18, 0.42, cv + (proRanges + rf * 0.8 + pk * 0.6) * 0.2 - 0.08) * 0.8;
    clouds[o] = clouds[o + 1] = clouds[o + 2] = ck;
  });
  const v = tally.valley[0] / Math.max(1, tally.valley[1]);
  const m = tally.mesa[0] / Math.max(1, tally.mesa[1]);
  console.log(`  the valley ${v.toFixed(3)} against the mesa ${m.toFixed(3)}: contrast ${(m - v).toFixed(3)} (at least 0.18)`);

  console.log('breaking bad: saving');
  await save(albedo, W, H, 3, 'breakingbad', [[4096, '-xl'], [2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 88 });
  await save(normalMap(height, W, H, 1), W, H, 3, 'breakingbad-normal', [[2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 90 });
  await save(rough, W, H, 3, 'breakingbad-rough', [[1024, '']], { quality: 84 });
  // (the lights, and a few soft clouds: 1024 holds them)
  await save(night, W, H, 3, 'breakingbad-night', [[1024, ''], [512, '-sm']], { quality: 86 });
  await save(clouds, W, H, 3, 'breakingbad-clouds', [[1024, ''], [512, '-sm']], { quality: 80 });
}
