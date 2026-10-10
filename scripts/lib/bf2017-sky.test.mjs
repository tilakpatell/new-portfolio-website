import { FloatType } from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { describe, expect, it } from 'vitest';
import { encodeRgbe, halve, luminance, normalise } from './bf2017-sky.mjs';

const read = (buf) => {
  const l = new HDRLoader();
  l.setDataType(FloatType);
  return l.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
};
// a w × h picture, RGBA floats, each texel from f(x, y)
const picture = (w, h, f) => {
  const d = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = f(x, y);
      d.set([r, g, b, 1], (y * w + x) * 4);
    }
  return { data: d, width: w, height: h };
};

describe('a level’s probe, made the site’s', () => {
  it('writes Radiance RGBE that three reads back, bright and dark, to within its 8-bit mantissa', () => {
    const p = picture(16, 8, (x, y) => [x * 100 + 0.5, y * 0.01 + 0.001, x === 3 && y === 2 ? 60000 : 0.25]);
    const back = read(encodeRgbe(p));
    expect(back.width).toBe(16);
    expect(back.height).toBe(8);
    for (let i = 0; i < 16 * 8; i++)
      for (let c = 0; c < 3; c++) {
        const want = p.data[i * 4 + c];
        expect(Math.abs(back.data[i * 4 + c] - want), `${i}.${c}`).toBeLessThanOrEqual(Math.max(...[0, 1, 2].map((k) => p.data[i * 4 + k])) / 128 + 1e-6);
      }
  });

  it('halves a face by averaging each 2 × 2', () => {
    const h = halve(picture(4, 2, (x) => [x, 0, 10]));
    expect([h.width, h.height]).toEqual([2, 1]);
    expect(Array.from(h.data.slice(0, 4))).toEqual([0.5, 0, 10, 1]);
    expect(Array.from(h.data.slice(4, 8))).toEqual([2.5, 0, 10, 1]);
  });

  it('brings the game’s light units to the site’s: the six faces’ mean light made `mean`', () => {
    const faces = [0, 1, 2, 3, 4, 5].map((i) => picture(2, 2, () => [i * 100, i * 100, i * 100]));
    const out = normalise(faces, 0.8);
    const all = out.flatMap((f) => [...Array(4).keys()].map((i) => luminance(f.data, i)));
    expect(all.reduce((a, b) => a + b, 0) / all.length).toBeCloseTo(0.8, 5);
    // (the faces themselves untouched)
    expect(faces[1].data[0]).toBe(100);
  });
});
