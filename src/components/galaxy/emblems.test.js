import { describe, expect, it } from 'vitest';
import { EMBLEMS, EMBLEM_BOX } from './emblems';
import { SIDES } from './sides';

describe('the sides’ crests', () => {
  it('has one for every side, and none for anyone else', () => {
    expect(Object.keys(EMBLEMS).sort()).toEqual(Object.keys(SIDES).sort());
  });
  it('draws each as SVG paths in its box', () => {
    expect(EMBLEM_BOX).toBe('0 0 24 24');
    for (const [id, shapes] of Object.entries(EMBLEMS)) {
      expect(shapes.length, id).toBeGreaterThan(0);
      for (const s of shapes) {
        expect(s.d, id).toMatch(/^M[\d\s.,MLHVCSQTAZmlhvcsqtaz-]+$/);
        // (every number inside the box)
        for (const n of s.d.match(/-?\d*\.?\d+/g)) expect(Math.abs(Number(n)), id).toBeLessThanOrEqual(24);
        if (s.evenodd !== undefined) expect(typeof s.evenodd).toBe('boolean');
      }
    }
  });
  it('tells every side apart: no two crests alike', () => {
    const drawn = Object.values(EMBLEMS).map((shapes) => shapes.map((s) => s.d).join('|'));
    expect(new Set(drawn).size).toBe(drawn.length);
  });
});
