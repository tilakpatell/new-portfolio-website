// The universe map's sky (public/textures/universe/sky-glow.webp and
// sky-glow-sm.webp): the light of the Milky Way, for skyShader.js, which
// draws the stars and the fine detail itself, at the screen's own
// resolution. So all its file has to give is the band's light, clean.
//
// It's baked from a real photograph: ESO's all-sky panorama by Serge Brunier
// (eso0932a, https://www.eso.org/public/images/eso0932a/, CC BY 4.0), the
// lossless 6000 × 3000 original, so there are no JPEG blocks to blur away.
// (The sky before was Solar System Scope's repaint of this same panorama,
// tinted blue and smeared; sky-hq.webp and sky.webp, which
// build-universe-textures.py makes from it, stay as they were for the Earth's
// background.) The photo:
// - is turned the way the old sky lay (upside down, the Magellanic Clouds
//   above the band, and 3° round), so everything placed against the band
//   stays where it was;
// - has its stars taken out: each pixel held to a little over the light
//   round it, so points of light (and the bright stars' spikes) go, while
//   the dust lanes (dark), the nebulae and the star clouds (wider) stay
//   sharp;
// - has the night's own floor taken off (airglow and the faint stars no
//   opening can tell apart), so the sky between is black;
// - is brought to the brightness the scene is lit for, its colour kept: the
//   core's gold, the lanes' brown, the nebulae's pink.
//
//   NODE_USE_ENV_PROXY=1 node scripts/bake-universe-sky.mjs
//
// (it downloads the 29 MB original to scripts/.cache the first time)

import sharp from 'sharp';
import { existsSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';

const DIR = 'public/textures/universe';
const SOURCE_URL = 'https://cdn.eso.org/images/original/eso0932a.tif';
const SOURCE = 'scripts/.cache/eso0932a.tif';
const OUT = [
  { file: `${DIR}/sky-glow.webp`, width: 4096 },
  { file: `${DIR}/sky-glow-sm.webp`, width: 2048 },
];
const TURN = 50; // pixels of the 6000 the panorama is turned by, round to where the old sky's band lay
const GAIN = 0.85; // the band's light, as bright as the scene is lit for
const SATURATION = 1.15;

if (!existsSync(SOURCE)) {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`${SOURCE_URL}: ${res.status}`);
  await mkdir('scripts/.cache', { recursive: true });
  await writeFile(SOURCE, Buffer.from(await res.arrayBuffer()));
}

const { data, info } = await sharp(SOURCE).flip().removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const N = W * H;

// to linear light, turned
const toLinear = new Float32Array(256).map((_, i) => {
  const v = i / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
});
const rgb = [0, 1, 2].map(() => new Float32Array(N));
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const s = (y * W + ((x + TURN) % W)) * C;
    const i = y * W + x;
    for (let c = 0; c < 3; c++) rgb[c][i] = toLinear[data[s + c]];
  }
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
  const k = l > 0 ? (Math.max(0, clean[i] - floor) / l) * GAIN : 0;
  const c = [rgb[0][i] * k, rgb[1][i] * k, rgb[2][i] * k];
  const g = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  for (let j = 0; j < 3; j++) out[i * 3 + j] = Math.round(Math.min(1, Math.max(0, toSrgb(g + (c[j] - g) * SATURATION))) * 65535);
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
