// Painting textures for the 3D games on canvases, so nothing is downloaded:
// a seeded random source, and a normal map made from a height field so
// painted relief catches the light.

// A tangent-space normal map from a height field in the red channel (RGBA
// bytes). It wraps at the edges, so a tiled texture shows no seams.
export function heightToNormal(src, w, h, strength = 2) {
  const out = new Uint8ClampedArray(w * h * 4);
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      // canvas rows run down the page, texture v runs up it
      const nx = -dx;
      const ny = dy;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * w + x) * 4;
      out[i] = (nx / len) * 127.5 + 127.5;
      out[i + 1] = (ny / len) * 127.5 + 127.5;
      out[i + 2] = (1 / len) * 127.5 + 127.5;
      out[i + 3] = 255;
    }
  }
  return out;
}

// A seeded random number source, so a texture paints the same every time.
export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A normal-map canvas from a height canvas (its red channel).
export function normalCanvas(height, strength = 3) {
  const w = height.width;
  const h = height.height;
  const src = height.getContext('2d').getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(w, h);
  img.data.set(heightToNormal(src, w, h, strength));
  ctx.putImageData(img, 0, 0);
  return out;
}

// ── tileable noise, for surfaces that shouldn't look painted on ──

// A lattice of seeded random values that repeats every `period` cells, read
// with smooth interpolation: value noise that tiles.
export function tileNoise(seed = 1, period = 8) {
  const r = rng(seed);
  const n = period * period;
  const lattice = new Float32Array(n);
  for (let i = 0; i < n; i++) lattice[i] = r();
  const at = (x, y) => lattice[(((y % period) + period) % period) * period + (((x % period) + period) % period)];
  const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  // x and y in cells; the result is 0 to 1
  return (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = ease(x - x0);
    const fy = ease(y - y0);
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

// Layers of that noise, each twice as fine and half as strong: fbm that
// tiles over 0..1 in u and v. `ridged` folds each layer into creases.
export function tileFbm(seed = 1, { base = 4, octaves = 5, gain = 0.5, ridged = false } = {}) {
  const layers = [];
  for (let o = 0; o < octaves; o++) layers.push({ f: base * 2 ** o, n: tileNoise(seed * 31 + o * 17 + 1, base * 2 ** o) });
  let norm = 0;
  for (let o = 0; o < octaves; o++) norm += gain ** o;
  return (u, v) => {
    let sum = 0;
    let amp = 1;
    for (const l of layers) {
      let s = l.n(u * l.f, v * l.f);
      if (ridged) s = 1 - Math.abs(s * 2 - 1);
      sum += s * amp;
      amp *= gain;
    }
    return sum / norm;
  };
}

// Cells: the distance to the nearest of a jittered grid of points (0 at a
// point, towards 1 at the walls between), tiling over 0..1. Pebbles, cracks,
// plates.
export function tileCells(seed = 1, cells = 8) {
  const r = rng(seed);
  const px = new Float32Array(cells * cells);
  const py = new Float32Array(cells * cells);
  for (let i = 0; i < cells * cells; i++) {
    px[i] = r();
    py[i] = r();
  }
  return (u, v) => {
    const x = u * cells;
    const y = v * cells;
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    let best = 9;
    let second = 9;
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        const gx = cx + i;
        const gy = cy + j;
        const k = (((gy % cells) + cells) % cells) * cells + (((gx % cells) + cells) % cells);
        const d = Math.hypot(gx + px[k] - x, gy + py[k] - y);
        if (d < best) {
          second = best;
          best = d;
        } else if (d < second) second = d;
      }
    return { near: Math.min(1, best), edge: Math.min(1, second - best) };
  };
}

// Four kinds of noise in one tiling RGBA image, for shaders to read at
// several scales instead of each computing its own: R soft fbm, G ridged
// fbm, B cells (bright at the walls), A fine grain.
export function noiseAtlas(size = 256, seed = 1) {
  const soft = tileFbm(seed, { base: 4, octaves: 5 });
  const ridge = tileFbm(seed + 7, { base: 4, octaves: 5, ridged: true });
  const cells = tileCells(seed + 13, 12);
  const grain = rng(seed + 29);
  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const i = (y * size + x) * 4;
      out[i] = soft(u, v) * 255;
      out[i + 1] = ridge(u, v) * 255;
      out[i + 2] = (1 - Math.min(1, cells(u, v).edge * 2.4)) * 255;
      out[i + 3] = grain() * 255;
    }
  return out;
}

// A surface from one function: `surface(u, v)` gives { r, g, b } (0..255),
// a height `h` and a roughness `rough` (both 0..1) for each texel, and this
// returns the colour map, the normal map made from the heights, and the
// roughness map, as RGBA buffers that tile if the function does.
export function surfaceMaps(size, surface, { strength = 3 } = {}) {
  const color = new Uint8ClampedArray(size * size * 4);
  const height = new Uint8ClampedArray(size * size * 4);
  const rough = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const s = surface(x / size, y / size);
      const i = (y * size + x) * 4;
      color[i] = s.r;
      color[i + 1] = s.g;
      color[i + 2] = s.b;
      color[i + 3] = 255;
      height[i] = Math.max(0, Math.min(1, s.h ?? 0.5)) * 255;
      // roughness in green, where a standard material reads it
      const k = Math.max(0, Math.min(1, s.rough ?? 0.9)) * 255;
      rough[i] = 255;
      rough[i + 1] = k;
      rough[i + 2] = 0;
      rough[i + 3] = 255;
    }
  return { color, normal: heightToNormal(height, size, size, strength), rough, size };
}

// An RGBA buffer as a canvas.
export function bufferCanvas(data, size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  img.data.set(data);
  ctx.putImageData(img, 0, 0);
  return c;
}
