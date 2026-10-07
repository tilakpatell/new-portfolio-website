// The planet bakers' shared kit: seeded 3D noise sampled on the unit sphere
// (so nothing stretches at the poles or seams at the date line), the
// equirectangular grid three's SphereGeometry maps (u east from the −x side,
// v from the north pole down), relief turned into a tangent-space normal
// map, and WebP out through sharp, supersampled and brought down with
// Lanczos so coasts and ridges come out clean at the size the map ships at.

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

// ── noise ──

// A seeded random (mulberry32).
export function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Improved Perlin noise in 3D, seeded: about −1…1.
export function perlin(seed) {
  const r = rand(seed);
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
  return (x, y, z) => {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const Z = Math.floor(z);
    x -= X;
    y -= Y;
    z -= Z;
    const xi = X & 255;
    const yi = Y & 255;
    const zi = Z & 255;
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);
    const A = p[xi] + yi;
    const AA = p[A] + zi;
    const AB = p[A + 1] + zi;
    const B = p[xi + 1] + yi;
    const BA = p[B] + zi;
    const BB = p[B + 1] + zi;
    const l = (a, b, t) => a + t * (b - a);
    return l(
      l(l(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u), l(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
      l(l(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u), l(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v),
      w,
    );
  };
}

// Fractal sums of a noise: plain (fbm, about −1…1), ridged (0…1, sharp
// crests where the noise crosses zero) and billowed (0…1, rounded heaps).
export function fbm(n, x, y, z, { octaves = 6, lacunarity = 2.03, gain = 0.5 } = {}) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += n(x, y, z) * amp;
    norm += amp;
    amp *= gain;
    x *= lacunarity;
    y *= lacunarity;
    z *= lacunarity;
  }
  return sum / norm;
}

export function ridged(n, x, y, z, { octaves = 6, lacunarity = 2.07, gain = 0.5 } = {}) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let prev = 1;
  for (let i = 0; i < octaves; i++) {
    let v = 1 - Math.abs(n(x, y, z));
    v *= v;
    sum += v * amp * prev;
    norm += amp;
    prev = Math.min(1, v * 1.6);
    amp *= gain;
    x *= lacunarity;
    y *= lacunarity;
    z *= lacunarity;
  }
  return sum / norm;
}

// Cellular noise on the sphere: the distances to the nearest and second
// nearest of a seeded scatter of points (F1, F2), for cracks, cells, creases.
export function cells(seed, count) {
  const r = rand(seed);
  const pts = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const z = r() * 2 - 1;
    const a = r() * Math.PI * 2;
    const s = Math.sqrt(1 - z * z);
    pts.set([Math.cos(a) * s, z, Math.sin(a) * s], i * 3);
  }
  // a coarse lat-long bucket grid, so a lookup only checks nearby points
  const B = Math.max(4, Math.round(Math.sqrt(count / 2)));
  const buckets = Array.from({ length: B * B * 2 }, () => []);
  const key = (x, y, z) => {
    const lat = Math.floor(((Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI + 0.5) * B) % B);
    const lon = Math.floor(((Math.atan2(z, x) / (2 * Math.PI) + 0.5) * B * 2) % (B * 2));
    return [Math.min(B - 1, lat), Math.min(B * 2 - 1, lon)];
  };
  for (let i = 0; i < count; i++) {
    const [a, b] = key(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
    buckets[a * B * 2 + b].push(i);
  }
  const fn = (x, y, z) => {
    const [a, b] = key(x, y, z);
    let f1 = 9;
    let f2 = 9;
    let id = -1;
    const span = 2 + Math.ceil(1.5 / Math.max(0.1, Math.sqrt(1 - y * y))); // wider near the poles
    for (let da = -2; da <= 2; da++) {
      const aa = a + da;
      if (aa < 0 || aa >= B) continue;
      for (let db = -span; db <= span; db++) {
        const bb = (((b + db) % (B * 2)) + B * 2) % (B * 2);
        for (const i of buckets[aa * B * 2 + bb]) {
          const dx = x - pts[i * 3];
          const dy = y - pts[i * 3 + 1];
          const dz = z - pts[i * 3 + 2];
          const d = dx * dx + dy * dy + dz * dz;
          if (d < f1) {
            f2 = f1;
            f1 = d;
            id = i;
          } else if (d < f2) f2 = d;
        }
      }
    }
    return { f1: Math.sqrt(f1), f2: Math.sqrt(f2), id };
  };
  fn.points = pts; // (each cell's middle, as x, y, z runs)
  return fn;
}

// ── maths ──

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const mix = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
export const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// A colour along a ramp of [t, '#rrggbb'] stops.
export function ramp(stops) {
  const s = stops.map(([t, c]) => [t, hex(c)]);
  return (x) => {
    if (x <= s[0][0]) return s[0][1];
    for (let i = 1; i < s.length; i++) {
      if (x <= s[i][0]) return mix3(s[i - 1][1], s[i][1], (x - s[i - 1][0]) / (s[i][0] - s[i - 1][0]));
    }
    return s[s.length - 1][1];
  };
}

// ── the grid ──

// Every texel of a w×h equirectangular map as a direction on the unit
// sphere, the way three's SphereGeometry lays its uvs on: fn(x, y, z, i, lat, lon)
export function eachTexel(w, h, fn) {
  for (let py = 0; py < h; py++) {
    const theta = ((py + 0.5) / h) * Math.PI;
    const st = Math.sin(theta);
    const y = Math.cos(theta);
    for (let px = 0; px < w; px++) {
      const phi = ((px + 0.5) / w) * Math.PI * 2;
      fn(-Math.cos(phi) * st, y, Math.sin(phi) * st, py * w + px, Math.PI / 2 - theta, phi);
    }
  }
}

// A direction to (u, v) in the same layout, v from the top.
export function toUv(x, y, z) {
  let phi = Math.atan2(z, -x);
  if (phi < 0) phi += Math.PI * 2;
  return [phi / (Math.PI * 2), Math.acos(clamp(y, -1, 1)) / Math.PI];
}

// A tangent-space normal map from a height field on the map (heights in
// planet radii; the map wraps in u). The sphere's tangent frame runs east
// (+u) and north (+v in three, up the image), so the slopes go in as is.
export function normalMap(height, w, h, strength) {
  const out = new Float32Array(w * h * 3);
  for (let py = 0; py < h; py++) {
    const theta = ((py + 0.5) / h) * Math.PI;
    // a texel's width in radii shrinks toward the poles; held off zero so
    // the poles don't turn to needles
    const dx = Math.max(0.05, Math.sin(theta)) * ((2 * Math.PI) / w);
    const dy = Math.PI / h;
    const up = Math.max(0, py - 1);
    const dn = Math.min(h - 1, py + 1);
    for (let px = 0; px < w; px++) {
      const l = (px - 1 + w) % w;
      const r = (px + 1) % w;
      const sx = (height[py * w + r] - height[py * w + l]) / (2 * dx);
      const sy = (height[up * w + px] - height[dn * w + px]) / ((dn - up) * dy);
      let nx = -sx * strength;
      let ny = -sy * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (py * w + px) * 3;
      out[i] = nx * 0.5 + 0.5;
      out[i + 1] = ny * 0.5 + 0.5;
      out[i + 2] = nz * 0.5 + 0.5;
    }
  }
  return out;
}

// A separable blur of a single-channel field (wrapping in x), for soft masks.
export function blur(field, w, h, radius) {
  if (radius < 0.5) return field;
  const k = Math.ceil(radius * 2.5);
  const weights = Array.from({ length: k * 2 + 1 }, (_, i) => Math.exp(-((i - k) ** 2) / (2 * radius * radius)));
  const sum = weights.reduce((a, b) => a + b, 0);
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -k; i <= k; i++) s += field[y * w + ((x + i + w) % w)] * weights[i + k];
      tmp[y * w + x] = s / sum;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -k; i <= k; i++) s += tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x] * weights[i + k];
      out[y * w + x] = s / sum;
    }
  }
  return out;
}

// ── out ──

const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../../public/textures/universe');

// Float data (0…1, `channels` a texel) to a WebP at each size asked for,
// e.g. save(rgb, 4096, 2048, 3, 'middleearth', [[4096, '-xl'], [2048, '-hq'], [1024, ''], [512, '-sm']]).
// The `-xl` size (a colour map at 4096, worn near on ultra) is a KTX2
// instead (UASTC through scripts/ktx2.mjs, flipped for three's UVs, sRGB):
// a quarter of the graphics memory a 4096 WebP takes once decoded. With
// PLANETS_XL=only in the environment just the -xl files are written (the
// rest left as they are); with PLANETS_XL=skip, all but them (a quick look).
const XL_MAX = 6 * 1024 * 1024; // (an -xl past this is too much download for one map)
const K8_MAX = 24 * 1024 * 1024; // (and an -8k past this)

// --ultra (scripts/build-fandom-planets.mjs sets PLANETS_8K=1): every map
// baked at 8192 × 4096, and only the colour maps that have an -xl written,
// as `-8k.ktx2` (worn near at ultra, over the -xl: universe/planetMaps.js),
// each listed in k8.json, which is how the site knows it's there.
export const ULTRA = process.env.PLANETS_8K === '1';
export const bakeSize = () => (ULTRA ? [8192, 4096] : [4096, 2048]);

// a colour map as KTX2 at `width`, under `max` (harder rate-distortion
// first, the small lossy kind last)
async function writeKtx2(buf, w, h, channels, width, file, max) {
  const png = await sharp(buf, { raw: { width: w, height: h, channels }, limitInputPixels: false })
    .resize(width, Math.round((width * h) / w), { kernel: 'lanczos3' })
    .png()
    .toBuffer();
  const { encodeImage } = await import('../ktx2.mjs');
  let ktx2 = null;
  let how = '';
  for (const [opts, label] of [[{ rdo: 1 }, 'UASTC'], [{ rdo: 3 }, 'UASTC rdo 3'], [{ rdo: 6 }, 'UASTC rdo 6'], [{ etc1s: true }, 'ETC1S']]) {
    // (at 8192, UASTC level 1: level 2 takes over 20 minutes a map)
    ({ ktx2 } = await encodeImage(png, { role: 'color', flipY: true, ...(width > 4096 ? { level: 1 } : {}), ...opts }));
    how = label;
    if (ktx2.byteLength <= max) break;
  }
  fs.writeFileSync(file, ktx2);
  console.log(`  ${path.basename(file)}  ${(ktx2.byteLength / 1024).toFixed(0)} KB (${how})`);
}

export async function save(data, w, h, channels, name, sizes, { quality = 86, alphaQuality = 90 } = {}) {
  fs.mkdirSync(OUT, { recursive: true });
  if (ULTRA && !sizes.some(([, suffix]) => suffix === '-xl')) return;
  const buf = Buffer.alloc(w * h * channels);
  for (let i = 0; i < buf.length; i++) buf[i] = Math.round(clamp(data[i]) * 255);
  if (ULTRA) {
    await writeKtx2(buf, w, h, channels, 8192, path.join(OUT, `${name}-8k.ktx2`), K8_MAX);
    const list = path.join(OUT, 'k8.json');
    const had = fs.existsSync(list) ? JSON.parse(fs.readFileSync(list, 'utf8')) : [];
    fs.writeFileSync(list, `${JSON.stringify([...new Set([...had, name])].sort())}\n`);
    return;
  }
  for (const [width, suffix] of sizes) {
    if (process.env.PLANETS_XL === 'only' && suffix !== '-xl') continue;
    if (process.env.PLANETS_XL === 'skip' && suffix === '-xl') continue;
    if (suffix === '-xl') {
      await writeKtx2(buf, w, h, channels, width, path.join(OUT, `${name}${suffix}.ktx2`), XL_MAX);
      continue;
    }
    const file = path.join(OUT, `${name}${suffix}.webp`);
    await sharp(buf, { raw: { width: w, height: h, channels } })
      .resize(width, Math.round((width * h) / w), { kernel: 'lanczos3' })
      .webp({ quality, alphaQuality, effort: 6, smartSubsample: true })
      .toFile(file);
    console.log(`  ${path.basename(file)}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  }
}

// An SVG drawn into a single-channel field (its red, 0…255), w×h, blurred
// by `soften` pixels if asked.
export async function raster(svg, w, h, soften = 0) {
  let img = sharp(Buffer.from(svg), { limitInputPixels: false }).resize(w, h, { fit: 'fill' }).removeAlpha().extractChannel(0);
  if (soften > 0.3) img = sharp(await img.png().toBuffer(), { limitInputPixels: false }).blur(soften).extractChannel(0);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 1 || info.width !== w || info.height !== h) throw new Error(`raster: ${info.width}×${info.height}×${info.channels}, wanted ${w}×${h}×1`);
  return new Uint8Array(data.buffer, data.byteOffset, w * h);
}

// A field (0…255) sampled bilinearly at (x, y) in its own pixels, 0…1
// (clamped at the edges).
export function sampler(field, w, h) {
  return (x, y) => {
    x = clamp(x - 0.5, 0, w - 1.001);
    y = clamp(y - 0.5, 0, h - 1.001);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = x - x0;
    const ty = y - y0;
    const i = y0 * w + x0;
    const a = field[i] + (field[i + 1] - field[i]) * tx;
    const b = field[i + w] + (field[i + w + 1] - field[i + w]) * tx;
    return (a + (b - a) * ty) / 255;
  };
}

// A smooth closed (or open) SVG path through points, as Catmull-Rom curves.
export function curve(pts, closed = true) {
  const n = pts.length;
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0]} ${p2[1]}`;
  }
  return closed ? `${d} Z` : d;
}
