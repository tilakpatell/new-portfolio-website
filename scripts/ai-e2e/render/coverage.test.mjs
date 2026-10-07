// How much of a render is the model: a blank canvas is the failure the
// render tier exists to catch.
import { describe, expect, it } from 'vitest';
import { png } from '../fakes/png.mjs';
import { coverage } from './coverage.mjs';

const BG = [26, 32, 41, 255];

describe('the share of a render that is not background', () => {
  it('is nothing for a blank canvas', async () => {
    expect(await coverage(png(32, 24, () => BG))).toBe(0);
  });
  it('is the drawn share, against the corner’s colour', async () => {
    // a 16×12 block in the middle of 32×24: a quarter
    const drawn = png(32, 24, (x, y) => (x >= 8 && x < 24 && y >= 6 && y < 18 ? [200, 180, 160, 255] : BG));
    expect(await coverage(drawn)).toBeCloseTo(0.25, 5);
  });
  it('lets the background’s own noise through (dithering, antialiasing)', async () => {
    const noisy = png(32, 24, (x) => [BG[0] + (x % 3), BG[1], BG[2] - (x % 2), 255]);
    expect(await coverage(noisy)).toBe(0);
    expect(await coverage(noisy, { tolerance: 0 })).toBeGreaterThan(0.5);
  });
  it('takes a background colour given, rather than the corner’s', async () => {
    const white = png(10, 10, () => [255, 255, 255, 255]);
    expect(await coverage(white, { bg: [255, 255, 255] })).toBe(0);
    expect(await coverage(white, { bg: [0, 0, 0] })).toBe(1);
  });
});
