import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bake } from '../../../universe/trafficKit';
import { BOUNDS, PROPS } from './insideForest';

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

describe('Yavin’s temple, inside', () => {
  for (const kind of ['warroom', 'ceremonyhall', 'templestair']) {
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

  it('the war room’s hologram plays on the brief signal', () => {
    const made = PROPS.warroom(kit, {});
    expect(made.playing()).toBe(false);
    made.signal('brief', true);
    made.update(1, 0.5);
    expect(made.playing()).toBe(true);
  });

  it('the stair climbs: its floors rise from the bottom landing to the top', () => {
    const made = PROPS.templestair(kit, {});
    const ys = made.floors.map((f) => f.y);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBeGreaterThan(10);
    // (no step taller than a walker can take)
    const sorted = [...new Set(ys)].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeLessThanOrEqual(0.55);
  });
});
