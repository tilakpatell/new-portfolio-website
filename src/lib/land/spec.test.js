import { describe, expect, it } from 'vitest';
import { LAND_TYPES, landSpec } from './spec';

describe('landSpec', () => {
  it('knows five types', () => {
    expect(LAND_TYPES).toEqual(['temperate', 'desert', 'ice', 'ocean', 'volcanic']);
  });

  it.each(['temperate', 'desert', 'ice', 'ocean', 'volcanic'])('%s: rivers 0..3 a region, seven linear colours', (type) => {
    const s = landSpec('seven', type);
    expect(s.type).toBe(type);
    expect(s.rivers.perRegion).toBeGreaterThanOrEqual(0);
    expect(s.rivers.perRegion).toBeLessThanOrEqual(3);
    expect(Object.keys(s.palette).sort()).toEqual(['deep', 'dirt', 'grass', 'rock', 'sand', 'shadow', 'shallow']);
    for (const c of Object.values(s.palette)) {
      expect(c).toHaveLength(3);
      for (const v of c) expect(v >= 0 && v <= 1).toBe(true);
    }
    expect(s.relief.length).toBeGreaterThan(0);
    expect(typeof s.sea).toBe('number');
    expect(s.kit.perCell).toBeGreaterThanOrEqual(0);
  });

  it('is the same for the same seed, and differs by seed', () => {
    expect(landSpec('seven')).toEqual(landSpec('seven'));
    expect(landSpec('seven').seed).not.toBe(landSpec('eight').seed);
    expect(Number.isInteger(landSpec(7).seed)).toBe(true);
  });

  it('temperate is the plan’s', () => {
    const s = landSpec('seven');
    expect(s.sea).toBe(0);
    expect(s.rivers).toEqual({ perRegion: 2, width: 6, depth: 2, meander: 0.35 });
    expect(s.kit).toEqual({ perCell: 24, kinds: ['tree', 'rock', 'crate'] });
    expect(s.gravity).toBe(-9.81);
    expect(s.wind.angle).toBeCloseTo(0.6 * Math.PI);
    expect(s.wind.strength).toBe(0.4);
  });

  it('ignores an unknown type, as temperate', () => {
    expect(landSpec('seven', 'jelly').type).toBe('temperate');
  });
});
