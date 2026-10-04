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
