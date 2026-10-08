// Middle-earth from orbit: Tolkien's map (./middleearth-geo.mjs) laid on the
// sphere and painted as a world seen from space. The map's sheet is put on
// the planet by an azimuthal equidistant projection about the middle of the
// map (35° north), so its shapes keep their proportions however far round
// the globe they reach; everything finer than the map (the coasts' wander,
// the ridges, the grain of the lands, the clouds) is noise on the sphere
// itself, so nothing stretches toward the poles. The map's lands are
// sampled through a gentle warp, so where one gives way to the next is
// ragged, as on a real world, not a drawn line. Past the map the Great Sea
// goes all the way round to a continent of its own on the far side.
//
// The forests are a canopy, crowns at three sizes dark in their middles
// with lighter edges, so Mirkwood and Fangorn have a grain from orbit.
//
// Makes middleearth at 4096 (-xl, KTX2), 2048 (-hq), 1024 and 512 (-sm);
// -normal (its -hq at twice the strength, for close in) and -clouds (RGBA)
// at 2048, 1024 and 512; -night at 1024 and 512; -rough and -glow at 1024:
// the clouds, and the pall of Mordor's smoke over the Black Land.

import { COAST, LAKES, RIVERS, RANGES, PEAKS, FORESTS, LANDS, CITIES, FARMS } from './middleearth-geo.mjs';
import { cells, clamp, curve, eachTexel, fbm, hex, mix, mix3, normalMap, perlin, raster, ramp, rand, ridged, sampler, save, smooth, bakeSize } from './sphere.mjs';

// (8192 × 4096 with --ultra: sphere.mjs's bakeSize)
const [W, H] = bakeSize();
const LAT0 = (35 * Math.PI) / 180;
const MID = [430, 300]; // the sheet's middle, at (LAT0, the map's middle meridian)
const K = 509; // sheet units a radian: the 800-wide sheet spans 90°
const NEAR = 1.85; // radians from the middle inside which the map is drawn

// the sheet's raster: what's drawn from the map
const BOX = { x0: -280, y0: -280, x1: 1300, y1: 980 };

function svgOf(body, density) {
  const w = (BOX.x1 - BOX.x0) * density;
  const h = (BOX.y1 - BOX.y0) * density;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${BOX.x0} ${BOX.y0} ${BOX.x1 - BOX.x0} ${BOX.y1 - BOX.y0}"><rect x="${BOX.x0}" y="${BOX.y0}" width="${BOX.x1 - BOX.x0}" height="${BOX.y1 - BOX.y0}" fill="#000"/>${body}</svg>`;
}

async function layer(body, density, soften = 0) {
  const w = (BOX.x1 - BOX.x0) * density;
  const h = (BOX.y1 - BOX.y0) * density;
  const data = await raster(svgOf(body, density), w, h, soften * density);
  const s = sampler(data, w, h);
  return (x, y) => s((x - BOX.x0) * density, (y - BOX.y0) * density);
}

const poly = (pts, extra = '') => `<path d="${curve(pts)}" fill="#fff" ${extra}/>`;
const line = (pts, width, extra = '') => `<path d="${curve(pts, false)}" fill="none" stroke="#fff" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const MORDOR_WALLS = RANGES.slice(6, 8);

export async function bake() {
  console.log('middle-earth: drawing the map');
  const land = await layer(poly(COAST), 2);
  const landSoft = await layer(poly(COAST), 1, 5); // the coast's band, for the noise to move about in
  const shelf = await layer(poly(COAST), 1, 22); // the continental shelf, deepening away from the coast
  const lakes = await layer(LAKES.map((l) => poly(l)).join(''), 3, 1);
  const rivers = await layer(RIVERS.map(([w, pts]) => line(pts, w * 0.62)).join(''), 3, 0.35);
  const valleys = await layer(RIVERS.map(([w, pts]) => line(pts, w * 3)).join(''), 1, 3);
  const core = await layer(RANGES.map(([w, h, , pts]) => line(pts, w * 0.55, `stroke-opacity="${h}"`)).join(''), 2, 2.5);
  const foot = await layer(RANGES.map(([w, h, , pts]) => line(pts, w * 1.9, `stroke-opacity="${h}"`)).join(''), 1, 8);
  const snowy = await layer(RANGES.filter((r) => r[2]).map(([w, , , pts]) => line(pts, w * 1.2)).join(''), 1, 3);
  const walls = await layer(MORDOR_WALLS.map(([w, , , pts]) => line(pts, w * 1.5)).join(''), 1, 4);
  const cones = await layer(PEAKS.map(([x, y, r, h]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" fill-opacity="${h}"/>`).join(''), 2, 3.5);
  const forest = {};
  for (const kind of ['dark', 'gold', 'old', 'green', 'jungle']) forest[kind] = await layer(FORESTS.filter((f) => f[0] === kind).map(([, pts]) => poly(pts)).join(''), 1, kind === 'jungle' ? 14 : 2.5);
  const L = {};
  const SOFT = { harad: 30, rhun: 30, angmar: 26, dunland: 18, rohan: 15, brown: 14, gondor: 14, shire: 10, marsh: 6, mordor: 4, gorgoroth: 6 };
  for (const [name, pts] of Object.entries(LANDS)) L[name] = await layer(poly(pts), 1, SOFT[name]);
  const pall = await layer(poly(LANDS.mordor), 1, 26);
  // lights at night: the cities, then their farms and villages
  const r = rand(11);
  let dots = CITIES.map(([x, y, b]) => `<circle cx="${x}" cy="${y}" r="${1.2 + b * 2.4}" fill="#fff" fill-opacity="${b}"/>`).join('');
  for (const [cx, cy, rx, ry, n, b] of FARMS) {
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r());
      dots += `<circle cx="${(cx + Math.cos(a) * rx * d).toFixed(1)}" cy="${(cy + Math.sin(a) * ry * d).toFixed(1)}" r="${(0.5 + r() * 0.6).toFixed(2)}" fill="#fff" fill-opacity="${(b * (0.5 + r())).toFixed(2)}"/>`;
    }
  }
  const lights = await layer(dots, 3, 0.9);

  console.log('middle-earth: painting the globe');
  const n1 = perlin(1);
  const n2 = perlin(2);
  const n3 = perlin(3);
  // the forests' canopy: crowns at three sizes (stands, trees, and the
  // grain between), each dark in its middle with a lighter, sunlit edge
  const CANOPY = [12000, 48000, 190000].map((count, k) => ({ cell: cells(61 + k, count), s: Math.sqrt((4 * Math.PI) / count), w: [0.5, 0.3, 0.2][k] }));
  const canopyAt = (x, y, z) => {
    let v = 0;
    for (const { cell, s, w } of CANOPY) {
      const { f1, f2, id } = cell(x, y, z);
      const edge = 1 - smooth(0, s * 0.42, f2 - f1); // 1 on the crowns' edges
      const tone = ((id * 2654435761) % 1000) / 1000; // each crown its own shade
      v += w * (edge * 0.75 + tone * 0.25);
    }
    return v;
  };
  const n4 = perlin(4);
  const n5 = perlin(5);
  const n6 = perlin(6);
  const nc = perlin(9);
  const nw = perlin(10);
  const albedo = new Float32Array(W * H * 3);
  const height = new Float32Array(W * H);
  const rough = new Float32Array(W * H * 3);
  const night = new Float32Array(W * H * 3);
  const glow = new Float32Array(W * H * 3);
  const clouds = new Float32Array(W * H * 4);

  const c0 = [Math.cos(LAT0), Math.sin(LAT0), 0];
  const e0 = [0, 0, -1];
  const n0 = [-Math.sin(LAT0), Math.cos(LAT0), 0];

  const deep = ramp([[0, '#2f7a84'], [0.18, '#1f5a72'], [0.45, '#123553'], [0.8, '#0b2343'], [1, '#091c38']]);
  const steppe = ramp([[0, '#77713f'], [0.5, '#8f8552'], [1, '#a3935f']]);
  const desert = ramp([[0, '#9c6f42'], [0.3, '#bb8f58'], [0.65, '#d2ad76'], [1, '#e4c891']]);
  const arid = ramp([[0, '#56702f'], [0.25, '#6e7840'], [0.4, '#878253'], [0.55, '#9a8858'], [0.72, '#b8915c'], [0.86, '#cba36c'], [1, '#dcbb85']]);
  const grass = ramp([[0, '#36532a'], [0.35, '#4a6a2d'], [0.65, '#617335'], [0.85, '#7a7a43'], [1, '#8a7f4d']]);
  const C = Object.fromEntries(
    Object.entries({
      snow: '#eef2f5', rock: '#6a6258', rockHi: '#8b8378', rockLo: '#4a443d', rockDark: '#3a3431', rockDarkHi: '#6a6058', tundra: '#7a7663', taiga: '#2f432c', ice: '#dfe7ee',
      shire: '#507a30', shireHi: '#628a39', rohan: '#8a8a4c', rohanHi: '#a09a58', gondor: '#476f30', gondorHi: '#567f38', brown: '#6f6040', brownHi: '#80704c',
      marsh: '#43462b', marshWater: '#2a3934', gorgoroth: '#2a2420', ash: '#4a423b', nurn: '#4d4233', nurnHi: '#5e4f3a', dunland: '#646640', angmar: '#585a48',
      dark: '#1d311d', darker: '#142414', gold: '#a99445', goldGreen: '#4f6a2a', old: '#22351c', green: '#2c4823', jungle: '#21401f', jungleHi: '#2f5726',
      wood: '#33502a', river: '#2a5868', lake: '#204d68',
    }).map(([k, v]) => [k, hex(v)]),
  );

  eachTexel(W, H, (x, y, z, i, lat) => {
    // where this is on the map's sheet
    const ang = Math.acos(clamp(x * c0[0] + y * c0[1] + z * c0[2], -1, 1));
    const tx = x * e0[0] + y * e0[1] + z * e0[2];
    const ty = x * n0[0] + y * n0[1] + z * n0[2];
    const tl = Math.hypot(tx, ty) || 1;
    const sx = MID[0] + (K * ang * tx) / tl;
    const sy = MID[1] - (K * ang * ty) / tl;
    const near = ang < NEAR;
    const latD = (lat * 180) / Math.PI;
    const alat = Math.abs(latD);
    // the warp the map's lands are sampled through, in sheet units
    // (a wavelength of 3200 / f sheet units for a noise at frequency f)
    const ux = sx + fbm(nw, x * 14, y * 14, z * 14, { octaves: 4 }) * 24 + fbm(nw, x * 70 + 3, y * 70, z * 70, { octaves: 3 }) * 8;
    const uy = sy + fbm(nw, x * 14 + 11, y * 14, z * 14, { octaves: 4 }) * 24 + fbm(nw, x * 70, y * 70 + 3, z * 70, { octaves: 3 }) * 8;
    // part of that warp, for what should keep closer to the map
    const vx = sx + (ux - sx) * 0.35;
    const vy = sy + (uy - sy) * 0.35;

    // ── land and sea ──
    const wander = fbm(n1, x * 9, y * 9, z * 9, { octaves: 5 }) * 0.7 + fbm(n2, x * 48, y * 48, z * 48, { octaves: 3 }) * 0.3;
    let coastK;
    let shelfK;
    if (near) {
      const v = mix(land(sx, sy), landSoft(sx, sy), 0.6) + wander * 0.3;
      coastK = smooth(0.47, 0.53, v);
      shelfK = shelf(sx, sy) + wander * 0.12;
    } else {
      // the far side: a continent of its own, out past the Great Sea
      const far = fbm(n3, x * 1.6 + 3, y * 1.6, z * 1.6, { octaves: 6 }) + wander * 0.16 + smooth(2.1, 2.6, ang) * 0.32 - 0.18;
      coastK = smooth(-0.015, 0.015, far);
      shelfK = clamp(0.5 + far * 2.4);
    }
    const isLand = coastK;
    const lakeK = near ? smooth(0.4, 0.6, lakes(vx, vy) + wander * 0.2) : 0;
    const riverK = near ? smooth(0.15, 0.6, rivers(sx, sy)) * isLand : 0;

    // ── relief ──
    const hills = (fbm(n2, x * 11, y * 11, z * 11, { octaves: 5 }) * 0.5 + 0.5) ** 1.7;
    const rc = near ? core(vx, vy) : 0;
    const rf = near ? foot(ux, uy) : 0;
    const cone = near ? cones(sx, sy) : 0;
    const valley = near ? valleys(sx, sy) : 0;
    const farR = near ? 0 : smooth(0.6, 0.85, ridged(n5, x * 4, y * 4, z * 4, { octaves: 4 })) * 0.6;
    // the ridges: branching crests and the gullies between them
    const rd = rc + rf + farR > 0.01 ? ridged(n5, x * 85, y * 85, z * 85, { octaves: 5 }) : 0.4;
    const rl = rf + farR > 0.01 ? ridged(n6, x * 22, y * 22, z * 22, { octaves: 4 }) : 0.4;
    const mount = rc * (0.1 + 0.72 * rd ** 1.5) + rf * 0.18 * (0.3 + rl) + farR * (0.25 + 0.7 * rd * rl);
    // (in a forest, the canopy is a little relief of its own)
    const inWood = near ? Math.max(forest.dark(ux, uy), forest.gold(ux, uy), forest.old(ux, uy), forest.green(ux, uy), forest.jungle(ux, uy)) : 0;
    const canopy = inWood > 0.05 ? canopyAt(x, y, z) : 0.5;
    const elev = (0.05 + hills * 0.15 * (1 - valley * 0.7) + mount + cone * 0.9 + inWood * (canopy - 0.5) * 0.05) * isLand;
    const h = elev * (1 - lakeK) * (1 - riverK * 0.6);
    height[i] = h * 0.0105;

    // ── colour ──
    const grain = fbm(n3, x * 64, y * 64, z * 64, { octaves: 3 }) * 0.5 + 0.5; // fine mottling
    const mid = fbm(n6, x * 16, y * 16, z * 16, { octaves: 4 }) * 0.5 + 0.5;
    const rag = fbm(n6, x * 120 + 5, y * 120, z * 120, { octaves: 3 }) * 0.5 + 0.5; // ragged edges
    const moist = fbm(n4, x * 4, y * 4, z * 4, { octaves: 4 }) * 0.5 + 0.5;
    const edge = (f, a = 0.3, b = 0.7, k = 0.3) => smooth(a, b, f + (rag - 0.5) * k * 1.6 + (grain - 0.5) * k * 0.6);
    // woods scattered over the open country
    const woods = smooth(0.6, 0.72, fbm(n3, x * 48, y * 48, z * 48, { octaves: 4 }) * 0.5 + 0.5 + moist * 0.1);
    let col = grass(clamp(moist * 0.75 + mid * 0.35 + grain * 0.1 - 0.12));
    col = mix3(col, C.wood, woods * 0.55);
    // the north: taiga into tundra, the ice beyond
    col = mix3(col, C.taiga, smooth(50, 58, latD + (mid - 0.5) * 10 + (rag - 0.5) * 8) * 0.85);
    col = mix3(col, mix3(C.tundra, hex('#8a8673'), grain), smooth(59, 65, latD + (mid - 0.5) * 8 + (rag - 0.5) * 7));
    let mordor = 0;
    let gorg = 0;
    if (near) {
      // the lands of the map, as how dry each is: one ground running from
      // the Shire's green through Rohan's grass and the steppe of Rhûn to
      // Harad's sand, so each gives way to the next as real country does
      const lr = L.rohan(ux, uy);
      const lb = L.brown(ux, uy);
      const lh = L.harad(ux, uy);
      const dryness = 0.08 + lh * 0.92 + L.rhun(ux, uy) * 0.42 + lr * 0.3 + lb * 0.5 + L.dunland(ux, uy) * 0.18 + L.angmar(ux, uy) * 0.2 - L.shire(ux, uy) * 0.12 - L.gondor(ux, uy) * 0.1 + (mid - 0.5) * 0.22 + (rag - 0.5) * 0.08;
      const dunes = 0.5 + 0.5 * Math.sin((sx * 0.7 + sy * 0.3) * 0.8 + fbm(n1, x * 26, y * 26, z * 26, { octaves: 4 }) * 9);
      const plateau = smooth(0.68, 0.85, ridged(n6, x * 22, y * 22, z * 22, { octaves: 3 })) * lh;
      const dryCol = mix3(arid(clamp(dryness + (grain - 0.5) * 0.08 + (dunes - 0.5) * 0.06 * lh)), hex('#8a5f3c'), plateau * 0.3);
      col = mix3(col, dryCol, smooth(0.12, 0.55, dryness));
      // the Brown Lands, laid waste; Rohan's grass a little golden; the marshes
      col = mix3(col, mix3(C.brown, C.brownHi, grain), smooth(0.4, 0.8, lb + (rag - 0.5) * 0.3) * 0.45);
      col = mix3(col, mix3(C.rohan, C.rohanHi, grain), smooth(0.4, 0.85, lr + (rag - 0.5) * 0.3) * 0.3);
      col = mix3(col, grain > 0.6 ? C.marshWater : C.marsh, edge(L.marsh(ux, uy)) * 0.85);
      // Mordor: the ash of Gorgoroth, Nurn's poor fields round its bitter sea
      mordor = edge(L.mordor(vx, vy), 0.35, 0.65, 0.15);
      gorg = edge(L.gorgoroth(ux, uy), 0.3, 0.7);
      col = mix3(col, mix3(C.nurn, C.nurnHi, grain), mordor);
      col = mix3(col, mix3(C.gorgoroth, C.ash, smooth(0.35, 0.85, grain * 0.6 + mid * 0.4)), gorg * mordor);
      // the forests, ragged at their edges, with clearings
      const fk = (f) => edge(f(ux, uy), 0.35, 0.65, 0.45) * (0.8 + 0.2 * grain);
      col = mix3(col, mix3(C.dark, C.darker, grain), fk(forest.dark));
      col = mix3(col, mix3(C.goldGreen, C.gold, smooth(0.45, 0.85, grain * 0.8 + rag * 0.2) * 0.75), fk(forest.gold));
      col = mix3(col, mix3(C.old, C.darker, grain * 0.5), fk(forest.old));
      col = mix3(col, C.green, fk(forest.green) * 0.9);
      col = mix3(col, mix3(C.jungle, C.jungleHi, grain), edge(forest.jungle(ux, uy), 0.3, 0.7, 0.4) * 0.9);
      // the canopy over all of them: crowns dark in the middle, lighter at the edge
      col = col.map((c) => c * mix(1, 0.7 + 0.8 * canopy, smooth(0.15, 0.6, inWood)));
      // the East beyond the map: steppe, and forest in the wet
      col = mix3(col, mix3(steppe(grain), C.taiga, smooth(0.52, 0.68, moist)), smooth(940, 1060, ux) * 0.8);
    } else {
      // the far continent: green in the wet, sand in the dry belts
      const dry = smooth(0.42, 0.6, 1 - moist) * smooth(8, 18, alat) * (1 - smooth(32, 42, alat));
      col = mix3(col, desert(clamp(grain * 0.4 + mid * 0.6)), dry);
    }
    // the mountains: rock (black in Mordor's walls), lit on the crests,
    // dark in the gullies, snow on the high cold tops
    const wallK = near ? smooth(0.25, 0.55, walls(vx, vy)) : 0;
    const rockK = smooth(0.12, 0.42, rc * 0.9 + rf * 0.35 + cone + farR * 0.8);
    const rock = mix3(mix3(C.rockLo, C.rockHi, smooth(0.35, 0.85, rd)), mix3(C.rockDark, C.rockDarkHi, smooth(0.45, 0.95, rd)), wallK);
    col = mix3(col, rock, rockK * 0.92);
    const snowLine = 1.08 - smooth(25, 65, alat) * 0.42;
    const snowK = smooth(snowLine, snowLine + 0.1, h + (rd - 0.5) * 0.45) * (near ? 0.2 + snowy(sx, sy) * 0.8 : 0.6) * (1 - wallK);
    col = mix3(col, C.snow, clamp(snowK));
    // lighter on the heights, darker down the river valleys
    col = col.map((c) => c * (0.92 + h * 0.18 - valley * 0.05));
    // the poles: land ice and pack ice, cracked
    const polar = smooth(73, 75, alat + fbm(n4, x * 10, y * 10, z * 10, { octaves: 5 }) * 5) * (0.92 + 0.08 * grain);
    // water: shallows round the coasts, the deep further out
    const sea = deep(clamp(1 - shelfK + fbm(n1, x * 14, y * 14, z * 14, { octaves: 3 }) * 0.07));
    col = mix3(sea, col, isLand);
    col = mix3(col, C.lake, lakeK * isLand);
    col = mix3(col, C.river, riverK);
    col = mix3(col, mix3(C.ice, C.snow, grain), polar);

    const o = i * 3;
    albedo[o] = col[0];
    albedo[o + 1] = col[1];
    albedo[o + 2] = col[2];
    // water and ice catch the sun; land doesn't
    const water = Math.max(1 - isLand, lakeK * isLand, riverK);
    rough[o] = rough[o + 1] = rough[o + 2] = mix(mix(mix(0.94, 0.34, water), 0.72, clamp(snowK) * isLand), 0.6, polar);

    // ── lights ──
    if (near) {
      const lit = lights(sx, sy) * isLand * (1 - polar);
      night[o] = lit * 1.6;
      night[o + 1] = lit * 1.3;
      night[o + 2] = lit * 0.85;
      // Isengard's fires burn redder
      const ise = Math.exp(-((sx - 378) ** 2 + (sy - 362) ** 2) / 18);
      night[o] += ise * 0.9;
      night[o + 1] += ise * 0.35;
      // what burns day and night: Orodruin and its lava, the Eye on
      // Barad-dûr, Minas Morgul's corpse-light, and the fires of Gorgoroth
      const dd = Math.hypot(sx - 652, sy - 410);
      const doom = Math.exp(-(dd * dd) / 5);
      const flows = dd < 13 ? smooth(0.82, 0.96, ridged(n5, x * 170, y * 170, z * 170, { octaves: 2 })) * smooth(13, 3, dd) : 0;
      const eye = Math.exp(-((sx - 712) ** 2 + (sy - 392) ** 2) / 1.2);
      const morgul = Math.exp(-((sx - 588) ** 2 + (sy - 440) ** 2) / 1.6);
      const fires = gorg * mordor * smooth(0.88, 0.97, ridged(n2, x * 120, y * 120, z * 120, { octaves: 3 })) * 0.55;
      glow[o] = clamp(doom * 1.4 + flows * 0.95 + eye * 1.6 + fires * 0.8 + morgul * 0.3);
      glow[o + 1] = clamp(doom * 0.55 + flows * 0.3 + eye * 0.35 + fires * 0.16 + morgul * 0.95);
      glow[o + 2] = clamp(doom * 0.12 + flows * 0.04 + eye * 0.05 + morgul * 0.55);
    }

    // ── the sky ──
    // clouds: warped noise, thick in the storm belts, thin over the deserts
    const wx = fbm(nw, x * 3, y * 3, z * 3, { octaves: 3 }) * 0.9;
    const wy = fbm(nw, x * 3 + 7, y * 3, z * 3, { octaves: 3 }) * 0.9;
    const cv = fbm(nc, x * 4.5 + wx, y * 4.5 + wy, z * 4.5 - wx, { octaves: 6 });
    const belt = 0.55 + 0.35 * smooth(40, 58, alat) + 0.2 * smooth(12, 0, alat) - 0.35 * smooth(14, 22, alat) * (1 - smooth(30, 38, alat));
    const dryLand = near ? L.harad(sx, sy) * 0.4 : 0;
    const ca = smooth(0.08, 0.42, cv + (belt - 0.55) * 0.5 - dryLand * 0.3) * 0.92;
    // Mordor's smoke: a brown-black pall over the Black Land, reaching west
    // over Ithilien toward the city
    let smokeK = 0;
    if (near) {
      const wisp = smooth(0.42, 0.78, fbm(nw, x * 22 + wy, y * 60, z * 22 - wx, { octaves: 5 }) * 0.5 + 0.5);
      const px = sx - 646;
      const plume = Math.exp(-((px < 0 ? px / 70 : px / 18) ** 2) - ((sy - 408 - Math.min(0, px) * 0.12) / 16) ** 2);
      smokeK = clamp(pall(sx + 10, sy) * 0.5 * wisp + plume * (0.3 + 0.45 * wisp));
    }
    const cloud = mix3([0.97, 0.97, 0.98], [0.2, 0.17, 0.15], smokeK / Math.max(0.001, Math.max(ca, smokeK)));
    const ao = 1 - smooth(0.3, 0.9, cv) * 0.18; // thick cloud a little greyer underneath
    const q = i * 4;
    clouds[q] = cloud[0] * ao;
    clouds[q + 1] = cloud[1] * ao;
    clouds[q + 2] = cloud[2] * ao;
    clouds[q + 3] = Math.max(ca, smokeK * 0.78);
  });

  console.log('middle-earth: saving');
  await save(albedo, W, H, 3, 'middleearth', [[4096, '-xl'], [2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 88 });
  // (the -hq relief, worn near, at twice the strength: close in, the ranges should stand up)
  await save(normalMap(height, W, H, 2), W, H, 3, 'middleearth-normal', [[2048, '-hq']], { quality: 90 });
  await save(normalMap(height, W, H, 1), W, H, 3, 'middleearth-normal', [[1024, ''], [512, '-sm']], { quality: 90 });
  await save(rough, W, H, 3, 'middleearth-rough', [[1024, '']], { quality: 84 });
  // (lights and glow are small soft points: 1024 holds them)
  await save(night, W, H, 3, 'middleearth-night', [[1024, ''], [512, '-sm']], { quality: 86 });
  await save(glow, W, H, 3, 'middleearth-glow', [[1024, '']], { quality: 88 });
  await save(clouds, W, H, 4, 'middleearth-clouds', [[2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 82, alphaQuality: 80 });
}
