import { describe, expect, it } from 'vitest';
import { LOD, capIndex, lodAt, seenAt, stepsOf, texSizeFor } from './lod';

const chain = [12000, 6000, 3000, 1500, 700];

describe('a level’s LOD by screen size', () => {
  it('steps down the chain as the distance doubles past L0 × radius', () => {
    // high: L0 1, so a 2 m thing is LOD0 to 4 m; its steps are LOD0, LOD2, LOD4
    expect(lodAt(chain, 1, 2, 'high')).toBe(0);
    expect(lodAt(chain, 3, 2, 'high')).toBe(0);
    expect(lodAt(chain, 5, 2, 'high')).toBe(2);
    expect(lodAt(chain, 9, 2, 'high')).toBe(2);
    expect(lodAt(chain, 1e6, 2, 'high')).toBe(4);
  });

  it('draws three steps of a long chain at most, the lighter where the size falls between', () => {
    const six = [20000, 10000, 5000, 2500, 1200, 600, 300];
    // high's cap (12,000): LOD1; the middle LOD4; the last LOD6
    expect(stepsOf(six, 'high')).toEqual([1, 4, 6]);
    expect(lodAt(six, 5, 2, 'high')).toBe(1);
    expect(lodAt(six, 9, 2, 'high')).toBe(4);
    expect(lodAt(six, 100, 2, 'high')).toBe(6);
  });

  it('never draws more than the tier’s cap: the first LOD within it', () => {
    const big = [178635, 101207, 48567, 21042, 7692, 2501];
    expect(capIndex(big, LOD.high.cap)).toBe(4);
    expect(lodAt(big, 1, 20, 'high')).toBe(4);
    expect(lodAt(big, 1, 20, 'low')).toBe(5);
    expect(lodAt(big, 1, 20, 'ultra')).toBe(0);
    // (a chain with nothing under the cap takes its last)
    expect(capIndex([9000, 5000], 2500)).toBe(1);
  });

  it('is seen within K radii', () => {
    expect(seenAt(50, 1, 60)).toBe(true);
    expect(seenAt(70, 1, 60)).toBe(false);
    // (a speck counts as a quarter metre)
    expect(seenAt(14, 0.01, 60)).toBe(true);
  });
});

describe('a map’s size', () => {
  it('follows the biggest thing that wears it, halved on low, doubled on ultra', () => {
    expect(texSizeFor(20, 'high')).toBe(1024);
    expect(texSizeFor(2, 'mid')).toBe(512);
    expect(texSizeFor(0.3, 'high')).toBe(256);
    expect(texSizeFor(0.3, 'low')).toBe(128);
    expect(texSizeFor(20, 'ultra')).toBe(2048);
    // a normal or ORM map a step under its colour
    expect(texSizeFor(20, 'high', true)).toBe(512);
    expect(texSizeFor(0.3, 'high', true)).toBe(128);
  });
});
