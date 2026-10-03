// Paints the site's "ink and wash" artwork: watercolour versions of a few
// photos, with pigment pooling, soft ink lines, paper grain and ragged
// brush-bled edges that fade into the page. The paintings are ordinary
// transparent WebP files, so they cost nothing at runtime and sit on any theme.
//
// Run: node scripts/paint.mjs        (after scripts/photos.mjs)
//      node scripts/paint.mjs mandala (only these)
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url);
const PHOTOS = new URL('public/photos/', ROOT);
const OUT = new URL('public/art/', ROOT);
const DATA = new URL('src/data/art.js', ROOT);

// `mask` shapes the painted area: brush (a loose rectangle), band (fades top
// and bottom, for wide strips), circle (a mandala) or arch (a temple arch).
// `median` and `blur` set how broad the brush is (smaller keeps more detail).
const JOBS = [
  { name: 'akshardham-nj', from: 'us-960', width: 900, mask: 'brush', saturation: 0.7 },
  { name: 'akshardham-delhi', from: 'in-960', width: 900, mask: 'brush', saturation: 0.7 },
  { name: 'mountains', from: 'hero-1920', width: 1600, mask: 'band', saturation: 0.55, crop: { top: 0, height: 0.62 } },
  { name: 'elephants', from: 'h-elephants-960', width: 960, mask: 'band', saturation: 0.6 },
  { name: 'frieze', from: 'h-elephants-1600', width: 1400, mask: 'band', saturation: 0.6, crop: { top: 0.36, height: 0.36 }, median: 5, blur: 0.7 },
  { name: 'colonnade', from: 'h-colonnade-960', width: 820, mask: 'arch', saturation: 0.65 },
  { name: 'mandala', from: 'h-dome-1440', width: 1000, mask: 'circle', saturation: 0.75 },
];

// Value noise and fractal noise, deterministic per seed.
function hash(x, y, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
function noise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, seed, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * freq, y * freq, seed + o * 31);
    norm += amp;
    freq *= 2;
    amp *= 0.5;
  }
  return sum / norm;
}
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// 0 at the edge of the painted shape, rising to 1 well inside it.
function shape(kind, x, y, w, h) {
  if (kind === 'circle') {
    const r = Math.hypot(x - w / 2, y - h / 2) / (Math.min(w, h) / 2);
    return 1 - r;
  }
  if (kind === 'band') {
    const d = Math.min(y, h - y) / (h / 2);
    const side = Math.min(1, Math.min(x, w - x) / (w * 0.08));
    return Math.min(d, side * 0.9 + 0.1 * d);
  }
  if (kind === 'arch') {
    const pad = w * 0.05;
    const hw = w / 2 - pad;
    const cx = w / 2;
    const top = pad;
    const archH = hw * 0.95;
    const dx = Math.abs(x - cx);
    if (dx > hw) return -(dx - hw) / w;
    // A cusped arch: an ellipse crown with a slight point at the top.
    const t = dx / hw;
    const yTop = top + archH * (1 - Math.sqrt(1 - t * t)) * (1 - 0.18 * (1 - t));
    const inside = Math.min(y - yTop, h - pad - y, hw - dx);
    return inside / (w * 0.22);
  }
  // brush: a loose rectangle
  return Math.min(x, w - x, y, h - y) / (Math.min(w, h) / 2);
}

async function paint(job) {
  let img = sharp(fileURLToPath(new URL(`${job.from}.webp`, PHOTOS)));
  const meta = await img.metadata();
  if (job.crop) {
    const top = Math.round(meta.height * job.crop.top);
    const height = Math.round(meta.height * job.crop.height);
    img = img.extract({ left: 0, top, width: meta.width, height });
  }
  const base = sharp(await img.resize({ width: job.width }).toBuffer());
  // The wash: blur and a wide median flatten the photo into pools of colour.
  const washImg = sharp(
    await base
      .clone()
      .blur(job.blur ?? 1.4)
      .median(job.median ?? 9)
      .modulate({ saturation: job.saturation ?? 0.65, brightness: 1.05 })
      .removeAlpha()
      .toBuffer(),
  );
  const { data: wash, info } = await washImg.clone().raw().toBuffer({ resolveWithObject: true });
  const laplace = { width: 3, height: 3, kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] };
  // Where two washes meet, the paint dries into a darker line.
  const { data: dried } = await washImg.clone().greyscale().convolve(laplace).raw().toBuffer({ resolveWithObject: true });
  // A light ink drawing from the photo's main shapes (blurred first, so leaves and gravel don't speckle).
  const { data: edges } = await base
    .clone()
    .greyscale()
    .blur(2)
    .convolve(laplace)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h } = info;
  const out = Buffer.alloc(w * h * 4);
  const paper = [250, 246, 238];
  const ink = [58, 44, 34];
  const seed = job.name.length * 101;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      // the painted area, with a ragged, bled edge
      const n = fbm(x / 70, y / 70, seed);
      const m = smooth(0.02, job.mask === 'circle' ? 0.3 : 0.38, shape(job.mask, x, y, w, h) + (n - 0.5) * 0.42);
      if (m <= 0.001) continue;
      const grain = fbm(x / 2.2, y / 2.2, seed + 7, 2);
      const blot = fbm(x / 26, y / 26, seed + 13, 3);
      let r = wash[i * 3];
      let g = wash[i * 3 + 1];
      let b = wash[i * 3 + 2];
      // colours settle into a few washes rather than smooth photographic tone
      const qr = Math.round(r / 22) * 22;
      const qg = Math.round(g / 22) * 22;
      const qb = Math.round(b / 22) * 22;
      r = r * 0.5 + qr * 0.5;
      g = g * 0.5 + qg * 0.5;
      b = b * 0.5 + qb * 0.5;
      // pigment settles unevenly, and the paper shows through
      const settle = 0.88 + 0.2 * blot + 0.1 * (grain - 0.5);
      r = r * settle * 0.86 + paper[0] * 0.14;
      g = g * settle * 0.86 + paper[1] * 0.14;
      b = b * settle * 0.86 + paper[2] * 0.14;
      // dried edges between washes
      const dry = Math.max(0, Math.min(1, (dried[i] - 6) / 40)) * 0.28;
      r *= 1 - dry;
      g *= 1 - dry;
      b *= 1 - dry;
      // wet edges pool darker where the wash dried
      const pool = Math.exp(-(((m - 0.3) / 0.16) ** 2)) * 0.22;
      r *= 1 - pool;
      g *= 1 - pool;
      b *= 1 - pool;
      // ink line work from the photo's edges
      const e = Math.max(0, Math.min(1, (edges[i] - 10) / 40)) ** 1.3;
      r = r * (1 - 0.42 * e) + ink[0] * 0.42 * e;
      g = g * (1 - 0.42 * e) + ink[1] * 0.42 * e;
      b = b * (1 - 0.42 * e) + ink[2] * 0.42 * e;
      // pale areas (skies, highlights) stay mostly paper: let the page show through
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const alpha = m * (0.3 + 0.7 * smooth(0.97, 0.62, lum)) * (0.92 + 0.08 * grain);
      out[i * 4] = Math.max(0, Math.min(255, r));
      out[i * 4 + 1] = Math.max(0, Math.min(255, g));
      out[i * 4 + 2] = Math.max(0, Math.min(255, b));
      out[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
    }
  }
  const webp = await sharp(out, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 76, alphaQuality: 70, effort: 6 }).toBuffer();
  await writeFile(new URL(`${job.name}.webp`, OUT), webp);
  return { name: job.name, width: w, height: h, bytes: webp.length };
}

await mkdir(OUT, { recursive: true });
const only = process.argv.slice(2);
const done = [];
for (const job of JOBS) {
  if (only.length && !only.includes(job.name)) continue;
  const r = await paint(job);
  done.push(r);
  console.log(`${r.name.padEnd(18)} ${r.width}x${r.height}  ${Math.round(r.bytes / 1024)} KB`);
}
const prev = await import(`${DATA.href}?t=${Date.now()}`).then((m) => m.ART).catch(() => ({}));
const art = { ...prev };
for (const r of done) art[r.name] = { width: r.width, height: r.height };
await writeFile(DATA, `// Generated by scripts/paint.mjs. Do not edit by hand.\nexport const ART = ${JSON.stringify(art, null, 2)};\n`);
