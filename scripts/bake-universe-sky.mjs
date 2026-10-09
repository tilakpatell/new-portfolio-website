// The universe map's sky (public/textures/universe/sky-glow.webp and
// sky-glow-sm.webp): the light of the Milky Way, which the map now uses only
// to light what it draws (scene.js's spaceEnvironment); the sky itself is
// galaxy/sky.js's. So all its file has to give is the band's light, clean.
//
// It's baked from a real photograph: ESO's all-sky panorama by Serge Brunier
// (eso0932a, https://www.eso.org/public/images/eso0932a/, CC BY 4.0), the
// lossless 6000 × 3000 original, so there are no JPEG blocks to blur away.
// (The sky before was Solar System Scope's repaint of this same panorama,
// tinted blue and smeared; sky-hq.webp and sky.webp, which
// build-universe-textures.py makes from it, stay as they were for the Earth's
// background.) The photo:
// - is brought to the true sky, where the stars are (the Hipparcos catalogue): the
//   mosaic is turned 3.8° off the galactic frame and bent a little where it
//   was stitched; scripts/fit-universe-sky.py measures both against the
//   Hipparcos stars (scripts/data/universe-sky-fit.json), and the photo is
//   read through them, then laid upside down (the Magellanic Clouds above
//   the band) and a little round, as the sky before it lay;
// - has its stars taken out: each pixel held to a little over the light
//   round it, so points of light (and the bright stars' spikes) go, while
//   the dust lanes (dark), the nebulae and the star clouds (wider) stay
//   sharp;
// - has the night's own floor taken off (airglow and the faint stars no
//   opening can tell apart), so the sky between is black;
// - is brought to the brightness the scene is lit for, with a little more
//   contrast and colour than the photo's own: the core's gold, the lanes'
//   brown, the nebulae's pink.
//
//   NODE_USE_ENV_PROXY=1 node scripts/bake-universe-sky.mjs [--check]
//
// (it downloads the 29 MB original to scripts/.cache the first time)

import sharp from 'sharp';
import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// how far round the photo's frame is turned (in its width) to put its stars
// where the true ones are; the star catalogue that shared it is gone
const SKY_TURN = 50 / 6000;

const DIR = 'public/textures/universe';
const SOURCE_URL = 'https://cdn.eso.org/images/original/eso0932a.tif';
const SOURCE = 'scripts/.cache/eso0932a.tif';
const OUT = [
  { file: `${DIR}/sky-glow.webp`, width: 4096 },
  { file: `${DIR}/sky-glow-sm.webp`, width: 2048 },
];
const GAIN = 0.78; // the band's light, as bright as the scene is lit for
const PIVOT = 0.03; // and its contrast, about the band's own light: the faint
const CONTRAST = 0.25; // halo and the lanes darker, the star clouds brighter
const SATURATION = 1.3;
// and white-balanced: the photo holds its green back (the band's light came
// out magenta, red and blue each a fifth over green), where the Milky Way's
// light, all its stars together, is a warm white
const BALANCE = [0.89, 1, 0.875];

if (!existsSync(SOURCE)) {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`${SOURCE_URL}: ${res.status}`);
  await mkdir('scripts/.cache', { recursive: true });
  await writeFile(SOURCE, Buffer.from(await res.arrayBuffer()));
}

const { data, info } = await sharp(SOURCE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const N = W * H;

// the photo in linear light, in its own frame (l 0 in the middle, rising to
// the left, north up)
const toLinear = new Float32Array(256).map((_, i) => {
  const v = i / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
});
const photo = [0, 1, 2].map((c) => Float32Array.from({ length: N }, (_, i) => toLinear[data[i * C + c]]));

// brought to the true sky, the frame the stars are in: each texel of the sky
// (the frame the map's old photo sky drew in: upside down, SKY_TURN
// round) is the true place it shows, turned and bent the way the photo has
// it (FIT), read from the photo between its four nearest pixels
const FIT = JSON.parse(await readFile('scripts/data/universe-sky-fit.json', 'utf8'));
const DEG = Math.PI / 180;
const [lons, lats] = [360 / FIT.grid, 180 / FIT.grid + 1];
function bend(l, b) {
  const i = Math.min(lats - 2, Math.max(0, Math.floor((b + 90) / FIT.grid)));
  const j = Math.floor(l / FIT.grid);
  const fi = (b + 90) / FIT.grid - i;
  const fj = l / FIT.grid - j;
  const at = (ii, jj) => FIT.bend[ii][((jj % lons) + lons) % lons];
  return [0, 1].map((k) => at(i, j)[k] * (1 - fi) * (1 - fj) + at(i, j + 1)[k] * (1 - fi) * fj + at(i + 1, j)[k] * fi * (1 - fj) + at(i + 1, j + 1)[k] * fi * fj);
}
const R = FIT.rotation;
const rgb = [0, 1, 2].map(() => new Float32Array(N));
for (let y = 0; y < H; y++) {
  const b = -90 + (180 * (y + 0.5)) / H;
  for (let x = 0; x < W; x++) {
    const l = 360 * (0.5 - SKY_TURN - (x + 0.5) / W);
    const t = [Math.cos(b * DEG) * Math.cos(l * DEG), Math.cos(b * DEG) * Math.sin(l * DEG), Math.sin(b * DEG)];
    const q = R.map((r) => r[0] * t[0] + r[1] * t[1] + r[2] * t[2]);
    const lq = (((Math.atan2(q[1], q[0]) / DEG) % 360) + 360) % 360;
    const bq = Math.asin(Math.max(-1, Math.min(1, q[2]))) / DEG;
    const [dl, db] = bend(lq, bq);
    const lp = lq + dl / Math.max(Math.cos(bq * DEG), 0.05);
    const bp = bq + db;
    const px = ((((180 - lp) / 360) * W - 0.5) % W + W) % W;
    const py = Math.min(H - 1, Math.max(0, ((90 - bp) / 180) * H - 0.5));
    const x0 = Math.floor(px);
    const y0 = Math.min(H - 2, Math.floor(py));
    const fx = px - x0;
    const fy = py - y0;
    const x1 = (x0 + 1) % W;
    const i = y * W + x;
    for (let c = 0; c < 3; c++) {
      const p = photo[c];
      rgb[c][i] = (p[y0 * W + x0] * (1 - fx) + p[y0 * W + x1] * fx) * (1 - fy) + (p[(y0 + 1) * W + x0] * (1 - fx) + p[(y0 + 1) * W + x1] * fx) * fy;
    }
  }
}
photo.length = 0;

// --check: the photo as brought to the true sky, stars and all, to measure
// against the stars (scripts/fit-universe-sky.py's numbers, end to end)
if (process.argv.includes('--check')) {
  const check = new Uint8Array(N);
  for (let i = 0; i < N; i++) check[i] = Math.round(255 * Math.min(1, (0.2126 * rgb[0][i] + 0.7152 * rgb[1][i] + 0.0722 * rgb[2][i]) ** (1 / 2.2)));
  await sharp(check, { raw: { width: W, height: H, channels: 1 } }).png().toFile('scripts/.cache/sky-check.png');
  console.log('scripts/.cache/sky-check.png');
  process.exit(0);
}
const lum = new Float32Array(N);
for (let i = 0; i < N; i++) lum[i] = 0.2126 * rgb[0][i] + 0.7152 * rgb[1][i] + 0.0722 * rgb[2][i];

// a gaussian blur, sigma s pixels: along x wrapping (the panorama's edges
// meet), along y held at the poles
function blur(src, s) {
  const r = Math.ceil(s * 3);
  const w = Array.from({ length: 2 * r + 1 }, (_, k) => Math.exp(-((k - r) ** 2) / (2 * s * s)));
  const total = w.reduce((a, b) => a + b);
  const along = (from, horizontal) => {
    const to = new Float32Array(N);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let sum = 0;
        for (let k = -r; k <= r; k++) sum += w[k + r] * (horizontal ? from[y * W + ((x + k + W) % W)] : from[Math.min(H - 1, Math.max(0, y + k)) * W + x]);
        to[y * W + x] = sum / total;
      }
    }
    return to;
  };
  return along(along(src, true), false);
}

// the stars out: each pixel held to a little over the light round it (a
// blur's worth, so it's round, never square), twice over (the second pass
// for the bright stars' halos, which the first leaves standing). Dark lanes
// sit under the light round them, so they're never touched; star clouds and
// nebulae are wider than the blur, so they stay
let clean = lum;
for (const [sigma, over] of [
  [2.5, 1.12],
  [6, 1.25],
  [14, 1.6],
]) {
  const round = blur(clean, sigma);
  const next = new Float32Array(N);
  for (let i = 0; i < N; i++) next[i] = Math.min(clean[i], round[i] * over);
  clean = next;
}
// and the dark grain the stars leave between them filled: each pixel brought
// up to most of the light round it (a lane is dark all round, so it stays)
const round = blur(clean, 2.5);
for (let i = 0; i < N; i++) clean[i] = Math.max(clean[i], round[i] * 0.8);
clean = blur(clean, 1);

// the floor: the starless light's median over the sky's top and bottom eighths
const sample = [];
for (let y = 0; y < H; y++) {
  if (y > H / 8 && y < H - H / 8) continue;
  for (let x = 0; x < W; x += 7) sample.push(clean[y * W + x]);
}
sample.sort((a, b) => a - b);
const floor = sample[sample.length >> 1];

// out, at the starless light (colour kept), floor off, brought up
const out = new Uint16Array(N * 3);
const toSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
let bandSum = 0;
let bandCount = 0;
for (let i = 0; i < N; i++) {
  const l = lum[i];
  const lit = Math.max(0, clean[i] - floor) * GAIN;
  const k = l > 0 ? (lit / l) * (lit / PIVOT) ** CONTRAST : 0;
  const c = [rgb[0][i] * k, rgb[1][i] * k, rgb[2][i] * k];
  const g = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  for (let j = 0; j < 3; j++) out[i * 3 + j] = Math.round(Math.min(1, Math.max(0, toSrgb((g + (c[j] - g) * SATURATION) * BALANCE[j]))) * 65535);
  const y = Math.floor(i / W);
  if (y > H * 0.45 && y < H * 0.55) {
    bandSum += g;
    bandCount++;
  }
}
console.log(`floor ${floor.toFixed(5)}, band ${(bandSum / bandCount).toFixed(5)} (linear)`);

for (const { file, width } of OUT) {
  await sharp(out, { raw: { width: W, height: H, channels: 3 } })
    .resize(width, width / 2, { kernel: 'lanczos3' })
    .toColourspace('srgb')
    .webp({ quality: 97, smartSubsample: true, effort: 6, preset: 'photo' })
    .toFile(file);
  console.log(`${file}: ${width}x${width / 2}, ${Math.round(statSync(file).size / 1024)} KB`);
}
