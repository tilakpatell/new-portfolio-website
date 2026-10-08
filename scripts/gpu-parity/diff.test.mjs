import { describe, expect, it } from 'vitest';
import { diff, passes } from './diff.mjs';

// a w × h RGBA picture, every pixel `px`
const img = (w, h, px = [10, 20, 30, 255]) => ({ data: Buffer.from(Array.from({ length: w * h }, () => px).flat()), width: w, height: h, channels: 4 });

describe('diff', () => {
  it('two pictures the same', () => {
    const d = diff(img(2, 2), img(2, 2));
    expect(d.psnr).toBe(Infinity);
    expect(d.off).toBe(0);
    expect(d.mad).toEqual([0, 0, 0]);
  });

  it('one pixel in four off by 20 in red', () => {
    const b = img(2, 2);
    b.data[0] += 20;
    const d = diff(img(2, 2), b);
    expect(d.off).toBe(0.25);
    expect(d.mad).toEqual([5, 0, 0]);
  });

  it('off by 1 everywhere is about 48.1 dB, and none of it counts as off', () => {
    const d = diff(img(4, 4), img(4, 4, [11, 21, 31, 255]));
    expect(d.psnr).toBeCloseTo(10 * Math.log10(255 * 255), 5);
    expect(d.off).toBe(0);
  });

  it('16 apart is not off, 17 is', () => {
    expect(diff(img(1, 1), img(1, 1, [26, 20, 30, 255])).off).toBe(0);
    expect(diff(img(1, 1), img(1, 1, [10, 20, 47, 255])).off).toBe(1);
  });

  it('alpha is left out, and three channels work as well as four', () => {
    expect(diff(img(1, 1), img(1, 1, [10, 20, 30, 0])).psnr).toBe(Infinity);
    const rgb = (v) => ({ data: Buffer.from([v, v, v]), width: 1, height: 1, channels: 3 });
    expect(diff(rgb(0), rgb(0)).psnr).toBe(Infinity);
  });

  it('refuses two sizes', () => {
    expect(() => diff(img(2, 2), img(2, 1))).toThrow(/size/);
  });
});

describe('passes', () => {
  it('PSNR at least 32 dB and under 2 % of pixels off', () => {
    expect(passes({ psnr: 32, off: 0.019 })).toBe(true);
    expect(passes({ psnr: Infinity, off: 0 })).toBe(true);
    expect(passes({ psnr: 31.9, off: 0 })).toBe(false);
    expect(passes({ psnr: 40, off: 0.02 })).toBe(false);
  });
});
