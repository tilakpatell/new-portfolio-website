import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { measure, measureFile } from './pixel-measure.mjs';

// a 16 × 16 picture: black but for a mid-grey 8 × 8 box at (4, 4) and two
// one-pixel stars well clear of it
const W = 16;
const paint = () => {
  const data = Buffer.alloc(W * W * 3);
  const set = (x, y, v) => data.fill(v, (y * W + x) * 3, (y * W + x) * 3 + 3);
  for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) set(x, y, 128);
  set(2, 2, 255);
  set(13, 2, 255);
  return { data, width: W, height: W, channels: 3 };
};

describe('pixel-measure', () => {
  let dir;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pixel-measure-'));
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it('counts the floor, the stars and the percentiles', () => {
    const m = measure(paint());
    expect(m.under002).toBeCloseTo((256 - 66) / 256, 3);
    expect(m.under005).toBe(m.under002);
    expect(m.points).toBe(2);
    expect(m.median).toBe(0);
    expect(m.p90).toBeCloseTo(128 / 255, 3);
  });

  it('measures a crop against the ring round it', () => {
    const m = measure(paint(), [4, 4, 12, 12]);
    expect(m.crop.mean).toBeCloseTo(128 / 255, 3);
    expect(m.crop.sd).toBe(0);
    // (the ring is the rest of the picture here: black but for the two stars)
    expect(m.crop.ring).toBeCloseTo(2 / (256 - 64), 3);
  });

  it('reads a file the same as its pixels', async () => {
    const img = paint();
    const path = join(dir, 'fixture.png');
    await sharp(img.data, { raw: { width: W, height: W, channels: 3 } }).png().toFile(path);
    expect(await measureFile(path, [4, 4, 12, 12])).toEqual(measure(img, [4, 4, 12, 12]));
  });
});
