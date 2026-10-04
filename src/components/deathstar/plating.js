// Textures for the 3D Death Star, painted at start on canvases (no image
// downloads). The plating is drawn twice in step: once in colour and once as
// a height field, and the height becomes a normal map, so panel edges,
// insets, vents, rivets and pipes catch the light as real relief.
import { heightToNormal } from '../../lib/texture';

export { heightToNormal };

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const canvas = (w, h = w) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
const grey = (v) => {
  const n = Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${n},${n},${n})`;
};
const tone = (v, blue = 6) => `rgb(${Math.round(v)},${Math.round(v + blue * 0.4)},${Math.round(v + blue)})`;

// Station plating: `kind` 'surface' (big plates, some windows) or 'wall' (the
// trench's sides: denser, with vents and pipe runs).
export function paintPlating({ seed = 1, size = 1024, kind = 'surface' } = {}) {
  const rand = rng(seed);
  const color = canvas(size);
  const height = canvas(size);
  const lit = canvas(size);
  const c = color.getContext('2d');
  const hgt = height.getContext('2d');
  const l = lit.getContext('2d');
  const k = size / 512;
  const cells = 8;
  const cell = size / cells;
  const wall = kind === 'wall';

  // both maps at once: a rectangle at a height, in a colour
  const box = (x, y, w, h, z, col) => {
    hgt.fillStyle = grey(z * 255);
    hgt.fillRect(x, y, w, h);
    c.fillStyle = col;
    c.fillRect(x, y, w, h);
  };
  // a raised plate with a lit top-left lip and a shadowed bottom-right one
  const plate = (x, y, w, h, z, v) => {
    box(x, y, w, h, z, tone(v));
    const e = Math.max(1, 1.5 * k);
    c.fillStyle = tone(v + 18);
    c.fillRect(x, y, w, e);
    c.fillRect(x, y, e, h);
    c.fillStyle = tone(v - 22);
    c.fillRect(x, y + h - e, w, e);
    c.fillRect(x + w - e, y, e, h);
  };
  // a pipe across: a rounded height profile, light along its top
  const pipe = (x, y, w, h, v) => {
    for (let i = 0; i < h; i++) {
      const p = Math.sin((i / Math.max(1, h - 1)) * Math.PI);
      hgt.fillStyle = grey((0.55 + p * 0.35) * 255);
      hgt.fillRect(x, y + i, w, 1);
      c.fillStyle = tone(v - 20 + p * 46, 10);
      c.fillRect(x, y + i, w, 1);
    }
  };

  // the seams under everything
  box(0, 0, size, size, 0.18, tone(34, 4));
  l.fillStyle = '#000';
  l.fillRect(0, 0, size, size);

  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      const x = i * cell;
      const y = j * cell;
      const gap = 2.5 * k;
      const v = 74 + rand() * 38 - (wall ? 8 : 0);
      plate(x + gap, y + gap, cell - gap * 2, cell - gap * 2, 0.55 + rand() * 0.08, v);
      const r = rand();
      const pad = cell * 0.14;
      if (r < 0.2) {
        // an inset hatch
        const w = cell * (0.35 + rand() * 0.35);
        const h = cell * (0.25 + rand() * 0.35);
        const ix = x + pad + rand() * (cell - w - pad * 2);
        const iy = y + pad + rand() * (cell - h - pad * 2);
        box(ix, iy, w, h, 0.38, tone(v - 26));
        box(ix + 2 * k, iy + 2 * k, w - 4 * k, 1.5 * k, 0.32, tone(v - 40));
      } else if (r < 0.42) {
        // a raised block
        const w = cell * (0.25 + rand() * 0.4);
        const h = cell * (0.2 + rand() * 0.4);
        plate(x + pad + rand() * (cell - w - pad * 2), y + pad + rand() * (cell - h - pad * 2), w, h, 0.78, v + 10);
      } else if (r < (wall ? 0.66 : 0.54)) {
        // a vent: slats
        const w = cell * (0.4 + rand() * 0.4);
        const n = 4 + Math.floor(rand() * 5);
        const sh = (cell * 0.5) / n;
        const vx = x + (cell - w) / 2;
        const vy = y + cell * 0.25;
        box(vx - k, vy - k, w + 2 * k, sh * n + 2 * k, 0.3, tone(28));
        for (let s = 0; s < n; s++) box(vx, vy + s * sh, w, sh * 0.55, 0.62, tone(v - 12));
      } else if (r < 0.62) {
        // a grid of small squares
        const n = 3;
        const s = cell * 0.13;
        for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) plate(x + pad + a * s * 1.6, y + pad + b * s * 1.6, s, s, 0.7, v - 6);
      }
      // rivets at the plate's corners, on some
      if (rand() < 0.35) {
        const rr = 1.6 * k;
        for (const [ax, ay] of [[0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]]) {
          hgt.fillStyle = grey(0.85 * 255);
          hgt.beginPath();
          hgt.arc(x + cell * ax, y + cell * ay, rr, 0, Math.PI * 2);
          hgt.fill();
          c.fillStyle = tone(v + 26);
          c.beginPath();
          c.arc(x + cell * ax, y + cell * ay, rr, 0, Math.PI * 2);
          c.fill();
        }
      }
      // lit windows, a few
      if (rand() < (wall ? 0.12 : 0.16)) {
        const n = 1 + Math.floor(rand() * 4);
        const wy = y + cell * (0.2 + rand() * 0.6);
        for (let s = 0; s < n; s++) {
          const wx = x + cell * 0.18 + s * cell * 0.16;
          const ww = cell * 0.09;
          const wh = cell * 0.05;
          box(wx, wy, ww, wh, 0.4, tone(22));
          l.fillStyle = rand() < 0.75 ? '#ffd9a0' : '#bcd8ff';
          l.fillRect(wx, wy, ww, wh);
        }
      }
    }
  }
  // pipe runs along the trench walls
  if (wall) {
    for (const py of [0.3, 0.62]) {
      if (rand() < 0.8) pipe(0, size * py, size, Math.round(cell * 0.16), 96);
    }
  }
  // grime: soft blotches darken the colour a little, unevenly
  c.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 160; i++) {
    const gx = rand() * size;
    const gy = rand() * size;
    const gr = (20 + rand() * 90) * k;
    const grad = c.createRadialGradient(gx, gy, 0, gx, gy, gr);
    const a = 0.08 + rand() * 0.14;
    grad.addColorStop(0, `rgba(70,64,60,${a})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = grad;
    c.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  }
  c.globalCompositeOperation = 'source-over';

  // the normal map from the height, and roughness: seams and vents rougher
  const hd = hgt.getImageData(0, 0, size, size).data;
  const normal = canvas(size);
  const nctx = normal.getContext('2d');
  const nimg = nctx.createImageData(size, size);
  nimg.data.set(heightToNormal(hd, size, size, 3.2 * (size / 1024) + 1.2));
  nctx.putImageData(nimg, 0, 0);
  const rough = canvas(size);
  const rctx = rough.getContext('2d');
  const rimg = rctx.createImageData(size, size);
  for (let i = 0; i < hd.length; i += 4) {
    const r = 255 - hd[i] * 0.55;
    rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = Math.max(110, Math.min(250, r));
    rimg.data[i + 3] = 255;
  }
  rctx.putImageData(rimg, 0, 0);
  return { color, normal, rough, lit };
}

// Yavin: a banded gas giant, stretched round a sphere.
export function paintGasGiant({ seed = 3, w = 1024, h = 512 } = {}) {
  const rand = rng(seed);
  const cv = canvas(w, h);
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  const bands = Array.from({ length: 14 }, () => ({ f: 2 + rand() * 18, p: rand() * 6, a: rand() }));
  const palette = [
    [196, 140, 92],
    [228, 186, 138],
    [168, 112, 74],
    [214, 162, 116],
    [140, 92, 64],
  ];
  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      let s = v * 9;
      for (const b of bands) s += Math.sin(u * Math.PI * 2 * Math.round(b.f / 4 + 1) + b.p + v * b.f) * 0.06 * b.a;
      const t = ((s % palette.length) + palette.length) % palette.length;
      const i0 = Math.floor(t);
      const f = t - i0;
      const c0 = palette[i0];
      const c1 = palette[(i0 + 1) % palette.length];
      const i = (y * w + x) * 4;
      img.data[i] = c0[0] + (c1[0] - c0[0]) * f;
      img.data[i + 1] = c0[1] + (c1[1] - c0[1]) * f;
      img.data[i + 2] = c0[2] + (c1[2] - c0[2]) * f;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// A soft round dot, for stars.
export function starSprite(size = 64) {
  const cv = canvas(size);
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return cv;
}
