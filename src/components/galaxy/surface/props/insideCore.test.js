import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bake } from '../../../universe/trafficKit';
import { BOUNDS, PROPS } from './insideCore';

// a kit that only bakes (no canvas, no scans): what the builders need of one
const kit = {
  geometry: (list) => bake(list, 1),
  mats: new Proxy({}, { get: (_, name) => ({ name }) }),
  own: (x) => x,
  build(parts, { name = 'prop' } = {}) {
    const g = new THREE.Group();
    g.name = name;
    g.add(new THREE.Mesh(bake(parts, 1), { name: 'baked' }));
    return g;
  },
};
const inside = (s, [hw, hd]) => {
  if (s.circle) return Math.abs(s.circle[0]) <= hw + s.circle[2] && Math.abs(s.circle[1]) <= hd + s.circle[2];
  return Math.abs(s.box[0]) <= hw && Math.abs(s.box[1]) <= hd;
};

describe('Coruscant, inside', () => {
  for (const kind of ['dexinside', 'clubinside', 'templeinside']) {
    it(`${kind}: a room within its bounds, something to stand on, nothing broken`, () => {
      const made = PROPS[kind](kit, {});
      expect(made.object).toBeTruthy();
      expect(BOUNDS[kind].length).toBe(3);
      for (const s of made.solids ?? []) expect(inside(s, BOUNDS[kind]), JSON.stringify(s)).toBe(true);
      expect((made.floors ?? []).length).toBeGreaterThan(0);
      made.object.traverse((o) => {
        if (!o.isMesh) return;
        const a = o.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) expect(Number.isFinite(a.getX(i)) && Number.isFinite(a.getY(i)) && Number.isFinite(a.getZ(i))).toBe(true);
      });
    });
  }

  it('the Temple’s training room opens on the remotes signal', () => {
    const made = PROPS.templeinside(kit, {});
    expect(typeof made.signal).toBe('function');
    expect(typeof made.update).toBe('function');
    made.signal('remotes', true);
    made.update(0, 2);
    expect(made.doorOpen()).toBeGreaterThan(0.9);
  });
});
