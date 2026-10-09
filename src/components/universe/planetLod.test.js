import { describe, expect, it } from 'vitest';
import { HALO_PX, HIDDEN_PX, lodOf, pxOf, segOf, standIn } from './planetLod';

describe('a body’s size on screen', () => {
  it('is its height in pixels, from its radius, how far off it is, the lens and the frame', () => {
    const want = ((2 * 50) / (2 * 5000 * Math.tan(Math.PI / 6))) * 900;
    expect(Math.abs(pxOf(50, 5000, 60, 900) / want - 1)).toBeLessThan(0.01);
    // twice as far, half as tall; a taller frame, taller; a wider lens, smaller
    expect(pxOf(50, 10000, 60, 900)).toBeCloseTo(pxOf(50, 5000, 60, 900) / 2, 9);
    expect(pxOf(50, 5000, 60, 1800)).toBeCloseTo(pxOf(50, 5000, 60, 900) * 2, 9);
    expect(pxOf(50, 5000, 75, 900)).toBeLessThan(pxOf(50, 5000, 60, 900));
    // (the camera at it or inside it: it fills the frame)
    expect(pxOf(50, 50, 60, 900)).toBe(Infinity);
    expect(pxOf(50, 0, 60, 900)).toBe(Infinity);
  });
});

describe('what a body draws for its size', () => {
  it('everything from 24 px, its halo only under that, nothing under 6', () => {
    expect([HALO_PX, HIDDEN_PX]).toEqual([24, 6]);
    expect(lodOf(30)).toBe('full');
    expect(lodOf(10)).toBe('halo');
    expect(lodOf(5)).toBe('hidden');
    expect(lodOf(24)).toBe('full');
    expect(lodOf(23.9)).toBe('halo');
    expect(lodOf(6)).toBe('halo');
    expect(lodOf(5.9)).toBe('hidden');
    expect(lodOf(Infinity)).toBe('full');
  });

  it('steps down at a threshold and back up only a tenth past it', () => {
    expect(lodOf(23.9, 'full')).toBe('halo');
    expect(lodOf(5.9, 'halo')).toBe('hidden');
    expect(lodOf(26.3, 'halo')).toBe('halo');
    expect(lodOf(26.5, 'halo')).toBe('full');
    expect(lodOf(6.5, 'hidden')).toBe('hidden');
    expect(lodOf(6.7, 'hidden')).toBe('halo');
    // (a jump straight through both)
    expect(lodOf(40, 'hidden')).toBe('full');
    expect(lodOf(2, 'full')).toBe('hidden');
  });

  it('so a body wobbling about a threshold changes once, not every frame', () => {
    for (const [edge, from] of [
      [HALO_PX, 'full'],
      [HIDDEN_PX, 'halo'],
    ]) {
      let lod = from;
      let changes = 0;
      for (let i = 0; i < 600; i++) {
        const next = lodOf(edge * (1 + 0.05 * Math.sin(i * 0.7)), lod);
        if (next !== lod) changes++;
        lod = next;
      }
      expect(changes, `${edge} px`).toBe(1);
    }
  });
});

describe('farPlaces’ light standing in for a body too small to draw', () => {
  it('is all light once the body is hidden, none from half as big again, and fades between', () => {
    expect(standIn(3, 'hidden')).toBe(1);
    expect(standIn(6.5, 'hidden')).toBe(1); // (held hidden: the light all there)
    expect(standIn(HIDDEN_PX * 1.5, 'halo')).toBe(0);
    expect(standIn(40, 'full')).toBe(0);
    // just back from hidden the body's drawn and its light still nearly all there, going as it grows
    const back = standIn(HIDDEN_PX * 1.1, 'halo');
    expect(back).toBeGreaterThan(0.8);
    expect(back).toBeLessThan(1);
    expect(standIn(7.5, 'halo')).toBeLessThan(back);
    expect(standIn(7.5, 'halo')).toBeGreaterThan(0);
  });
});

describe('the sphere’s segments', () => {
  it('are today’s at high: 64 × 40, a phone’s 44 × 28', () => {
    expect(segOf('high')).toEqual([64, 40]);
    expect(segOf('high', true)).toEqual([44, 28]);
  });
  it('double at ultra, through lib/detail’s seg, and never go below what the screen needs', () => {
    expect(segOf('ultra')).toEqual([128, 80]);
    expect(segOf('ultra', true)).toEqual([88, 56]);
    for (const level of ['mid', 'low']) {
      expect(segOf(level), level).toEqual([64, 40]);
      expect(segOf(level, true), level).toEqual([44, 28]);
    }
  });
});
