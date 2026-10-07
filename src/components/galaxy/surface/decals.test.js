import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { insignia, scorch } from './decals';

const sizeOf = (g) => {
  g.computeBoundingBox();
  return g.boundingBox.getSize(new THREE.Vector3());
};

describe('insignia', () => {
  for (const kind of ['rebel', 'imperial', 'republic']) {
    it(`draws the ${kind} one flat, facing out, within its size`, () => {
      const g = insignia(kind, 3);
      const s = sizeOf(g);
      expect(Math.max(s.x, s.y)).toBeCloseTo(3, 1);
      expect(s.x).toBeLessThanOrEqual(3 + 1e-6);
      expect(s.y).toBeLessThanOrEqual(3 + 1e-6);
      expect(s.z).toBeLessThan(1e-6);
      const n = g.attributes.normal;
      for (let i = 0; i < n.count; i++) expect(n.getZ(i)).toBeCloseTo(1);
    });
  }

  it('makes the starbird taller than it is wide', () => {
    const s = sizeOf(insignia('rebel', 2));
    expect(s.y).toBeGreaterThan(s.x);
  });

  it('makes the Empire’s crest round', () => {
    const s = sizeOf(insignia('imperial', 2));
    expect(Math.abs(s.x - s.y) / s.y).toBeLessThan(0.02);
  });

  it('knows no other', () => {
    expect(() => insignia('mandalorian', 1)).toThrow();
  });
});

describe('scorches', () => {
  it('stay inside their radius, flat and facing out', () => {
    const g = scorch(1.5, 3);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      expect(Math.hypot(p.getX(i), p.getY(i))).toBeLessThanOrEqual(1.5 + 1e-6);
      expect(p.getZ(i)).toBe(0);
    }
  });

  it('are each their own shape', () => {
    const a = scorch(1, 1).attributes.position;
    const b = scorch(1, 2).attributes.position;
    let differ = false;
    for (let i = 0; i < Math.min(a.count, b.count); i++) if (Math.abs(a.getX(i) - b.getX(i)) > 1e-3) differ = true;
    expect(differ).toBe(true);
  });
});
