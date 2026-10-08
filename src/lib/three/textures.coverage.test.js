import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { coverageMips, coverageTexture } from './textures';
import { createKit } from '../../components/galaxy/surface/kit';

const CUT = 0.3;

// the fraction of a level's texels over the cut
const covered = ({ width, height, data }) => {
  let on = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > CUT * 255) on++;
  return on / (width * height);
};

// a w × h image, each texel's RGBA from at(x, y)
const image = (width, height, at) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(at(x, y), (y * width + x) * 4);
  return { width, height, data };
};

const CLEAR = [0, 0, 0, 0];

describe('coverage-preserving mips', () => {
  it('keeps an opaque disc as thick at every level, and within 0.03 of full size down to 16 texels a side', () => {
    const disc = image(64, 64, (x, y) => ((x + 0.5 - 32) ** 2 + (y + 0.5 - 32) ** 2 <= 16 ** 2 ? [200, 230, 170, 255] : CLEAR));
    const { mipmaps, coverage } = coverageMips(disc, { cut: CUT });
    expect(coverage).toBeCloseTo(0.196, 2);
    expect(mipmaps.map((m) => `${m.width}×${m.height}`)).toEqual(['64×64', '32×32', '16×16', '8×8', '4×4', '2×2', '1×1']);
    expect(mipmaps[0]).toBe(disc);
    // (never thinner than full size: what keeps a far crown from going bald)
    for (const m of mipmaps) expect(covered(m), `${m.width}×${m.height}`).toBeGreaterThanOrEqual(coverage);
    // (from 8 a side down the levels are too coarse to land within 0.03:
    // at 8 the disc is four texels across and a round one is drawn in steps
    // of four, 12 texels (0.19, thinner than full size) or 16 (0.25, the
    // corners its rim crosses are a third covered, over the cut before any
    // scaling); one texel of a 4 × 4 is 0.0625, and a 2 × 2 or a 1 × 1
    // can only be all of it)
    for (const m of mipmaps.filter((l) => l.width >= 16)) expect(Math.abs(covered(m) - coverage), `${m.width}×${m.height}`).toBeLessThanOrEqual(0.03);
  });

  it('keeps thin strokes where a plain average would fade them under the cut', () => {
    // (a one-texel line every eight: at 16 a side each texel averages to a
    // quarter of opaque, under the cut, and a plain mip chain goes bald)
    const strokes = image(64, 64, (x) => (x % 8 === 0 ? [180, 200, 150, 255] : CLEAR));
    const { mipmaps, coverage } = coverageMips(strokes);
    expect(coverage).toBeCloseTo(0.125, 6);
    for (const m of mipmaps) expect(covered(m), `${m.width}×${m.height}`).toBeGreaterThan(0);
  });

  it('works on a map that isn’t square, halving each side down to one', () => {
    // (a red band down the left 30 %; 14 rows, so 3 rows is a fraction of
    // a base row each)
    const band = image(40, 14, (x) => (x < 12 ? [255, 0, 0, 255] : CLEAR));
    const { mipmaps, coverage } = coverageMips(band);
    expect(coverage).toBeCloseTo(0.3, 6);
    expect(mipmaps.map((m) => `${m.width}×${m.height}`)).toEqual(['40×14', '20×7', '10×3', '5×1', '2×1', '1×1']);
    for (const m of mipmaps) expect(m.data.length).toBe(m.width * m.height * 4);
    expect(covered(mipmaps[1])).toBeCloseTo(0.3, 6);
    expect(covered(mipmaps[2])).toBeCloseTo(0.3, 6);
  });

  it('keeps a half-covered texel’s colour (averaged by alpha, as a canvas does), not darkened by the clear around it', () => {
    const band = image(40, 14, (x) => (x < 12 ? [255, 0, 0, 255] : CLEAR));
    const five = coverageMips(band).mipmaps[3];
    // (its second texel covers columns 8 to 15: half red, half clear)
    expect([...five.data.slice(4, 7)]).toEqual([255, 0, 0]);
    expect(five.data[7]).toBeGreaterThan(120);
    expect(five.data[7]).toBeLessThan(140);
  });

  it('leaves a map with nothing over the cut as it is', () => {
    const faint = image(8, 8, () => [255, 255, 255, 40]);
    const { mipmaps, coverage } = coverageMips(faint);
    expect(coverage).toBe(0);
    for (const m of mipmaps) expect(covered(m)).toBe(0);
  });
});

describe('coverage-preserving mips on a texture', () => {
  // (canvases that take every call and draw nothing, as the galaxy kit's test
  // fakes them, but whose getImageData and createImageData answer with as
  // many texels as asked for)
  beforeAll(() => {
    const g = { addColorStop() {} };
    const pixels = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
    const canvas = () => {
      const c = { width: 0, height: 0 };
      const ctx = new Proxy({}, { get: (_, k) => (k === 'canvas' ? c : k === 'getImageData' ? (x, y, w, h) => pixels(w, h) : k === 'createImageData' ? pixels : () => g), set: () => true });
      c.getContext = () => ctx;
      return c;
    };
    globalThis.document = { createElement: canvas };
  });
  afterAll(() => delete globalThis.document);

  it('hands the texture its levels, the image itself first, and stops the graphics chip making its own', () => {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 4;
    const t = new THREE.CanvasTexture(c);
    expect(coverageTexture(t)).toBe(t);
    expect(t.mipmaps.map((m) => `${m.width}×${m.height}`)).toEqual(['16×4', '8×2', '4×1', '2×1', '1×1']);
    expect(t.mipmaps[0]).toBe(c);
    expect(t.generateMipmaps).toBe(false);
    expect(t.minFilter).toBe(THREE.LinearMipmapLinearFilter);
  });

  it('gives the galaxy kit’s leaves a level for every halving of their 256² card', () => {
    const kit = createKit({ seed: 1, scans: false });
    const map = kit.mats.foliage.map;
    expect(map.image.width).toBe(256);
    expect(map.mipmaps.length).toBe(9);
    expect(map.generateMipmaps).toBe(false);
    kit.dispose();
  });
});
