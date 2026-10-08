// The two gas giants among the fandoms, from Solar System Scope's largest
// maps (CC BY 4.0, from their copies on Wikimedia Commons; credited on the
// map and in the README), recoloured as scripts/build-universe-textures.py
// first did it from the 2K ones: Jupiter in saffron for the music room,
// Saturn's bands sharpened in gold and red for Marvel. From the 4096-wide
// originals, so a strong card gets them at 2048.
//
// Makes music and marvel at 2048 (-hq), 1024 and 512 (-sm). Fetches once into
// node_modules/.cache/universe.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { clamp, ramp, save, bakeSize } from './sphere.mjs';

const CACHE = path.resolve('node_modules/.cache/universe');
const UA = { 'User-Agent': 'tilakpatell.com universe build (https://tilakpatell.com)' };
const SOURCES = {
  jupiter: 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Solarsystemscope_texture_8k_jupiter.jpg',
  saturn: 'https://upload.wikimedia.org/wikipedia/commons/1/1e/Solarsystemscope_texture_8k_saturn.jpg',
};

async function fetchOnce(name) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, `${name}-8k.jpg`);
  if (fs.existsSync(file) && fs.statSync(file).size) return file;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(SOURCES[name], { headers: UA });
    if (res.ok) {
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      return file;
    }
    console.log(`  retrying ${name}: ${res.status}`);
    await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
  }
  throw new Error(`could not fetch ${name}`);
}

// The map as luminance (0…1) and RGB, at w×h.
async function read(file, w, h, blur = 0) {
  let img = sharp(file).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha();
  if (blur) img = sharp(await img.png().toBuffer()).blur(blur);
  const { data } = await img.raw().toBuffer({ resolveWithObject: true });
  const n = w * h;
  const rgb = new Float32Array(n * 3);
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 3] / 255;
    const g = data[i * 3 + 1] / 255;
    const b = data[i * 3 + 2] / 255;
    rgb.set([r, g, b], i * 3);
    lum[i] = r * 0.299 + g * 0.587 + b * 0.114;
  }
  return { rgb, lum };
}

// Stretched between two percentiles, 0…1.
function stretch(l, lo = 2, hi = 98) {
  const sorted = Float32Array.from(l).sort();
  const a = sorted[Math.floor((sorted.length * lo) / 100)];
  const b = sorted[Math.floor((sorted.length * hi) / 100)];
  return l.map((v) => clamp((v - a) / Math.max(b - a, 1e-6)));
}

export async function bake() {
  const [W, H] = bakeSize(); // (8192 × 4096 with --ultra, from Solar System Scope's 8K)
  // the music room: Jupiter in saffron
  {
    const { rgb, lum } = await read(await fetchOnce('jupiter'), W, H);
    const l = stretch(lum);
    const saffron = ramp([[0, '#4a1c05'], [0.3, '#a64a0e'], [0.55, '#e3832a'], [0.8, '#ffc46e'], [1, '#fff1d6']]);
    const out = new Float32Array(W * H * 3);
    for (let i = 0; i < W * H; i++) {
      const c = saffron(l[i]);
      for (let k = 0; k < 3; k++) out[i * 3 + k] = c[k] * 0.88 + rgb[i * 3 + k] * 0.12;
    }
    await save(out, W, H, 3, 'music', [[4096, '-xl'], [2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 88 });
  }
  // Marvel: Saturn's bands, sharpened, in gold and red
  {
    const file = await fetchOnce('saturn');
    const { lum } = await read(file, W, H);
    const { lum: soft } = await read(file, W, H, 36);
    const l = stretch(lum.map((v, i) => v + (v - soft[i]) * 2.5), 1, 99);
    const gold = ramp([[0, '#4a0d0d'], [0.28, '#8f2220'], [0.45, '#b8562a'], [0.62, '#d6a03c'], [0.82, '#efcf72'], [1, '#fff3c8']]);
    const out = new Float32Array(W * H * 3);
    for (let i = 0; i < W * H; i++) out.set(gold(l[i]), i * 3);
    await save(out, W, H, 3, 'marvel', [[4096, '-xl'], [2048, '-hq'], [1024, ''], [512, '-sm']], { quality: 88 });
  }
}
