import { describe, expect, it } from 'vitest';
import { BENCHES, BUILDINGS, LAMPS, LAWN_PROPS, LAWN_W, PLANTERS, START, floorAt, walkable } from './rules';
import { inPoly } from '../compound/plan';

describe('the lawn’s props (Tier 3)', () => {
  it('three sets of five cones, two crates and a barrel, near the start', () => {
    expect(LAWN_PROPS).toHaveLength(24);
    expect(LAWN_PROPS.filter((p) => p.kind === 'cone')).toHaveLength(15);
    for (const p of LAWN_PROPS) expect(Math.hypot(p.x - START.x, p.z - START.z)).toBeLessThan(80);
  });
  it('each on the open lawn, on the ground, where he can walk, and clear of what stands there', () => {
    for (const p of LAWN_PROPS) {
      expect(inPoly(p.x, p.z, LAWN_W)).toBe(true);
      expect(BUILDINGS.some((b) => inPoly(p.x, p.z, b.foot))).toBe(false);
      expect(floorAt(p.x, p.z)).toBe(0);
      expect(walkable(p.x, p.z)).toBe(true);
      for (const o of [...LAMPS, ...BENCHES, ...PLANTERS]) expect(Math.hypot(o.x - p.x, o.z - p.z)).toBeGreaterThan(2);
    }
  });
  it('none on top of another', () => {
    for (let i = 0; i < LAWN_PROPS.length; i++) {
      for (let j = i + 1; j < LAWN_PROPS.length; j++) expect(Math.hypot(LAWN_PROPS[i].x - LAWN_PROPS[j].x, LAWN_PROPS[i].z - LAWN_PROPS[j].z)).toBeGreaterThan(0.9);
    }
  });
});
