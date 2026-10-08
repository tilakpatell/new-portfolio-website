import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bake } from '../../../universe/trafficKit';
import { BOUNDS, PROPS } from './insideBespin';

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

describe('Cloud City, inside', () => {
  for (const kind of ['dininginside', 'carboninside', 'reactorinside', 'corridorinside']) {
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

  it('the carbon platform’s floor moves down on the freeze signal and back up when it’s off', () => {
    const made = PROPS.carboninside(kit, {});
    const f = made.floors.find((x) => x.tag === 'freezeplatform');
    expect(f.moves).toBe(true);
    const top = f.y;
    made.signal('freeze', true);
    for (let i = 0; i < 40; i++) made.update(i * 0.1, 0.1);
    expect(f.y).toBeCloseTo(top - 2.4, 1);
    made.signal('freeze', false);
    for (let i = 0; i < 40; i++) made.update(4 + i * 0.1, 0.1);
    expect(f.y).toBeCloseTo(top, 1);
  });

  it('the corridor’s doors open on Lobot’s signals, one each', () => {
    const made = PROPS.corridorinside(kit, {});
    expect(made.solids.filter((s) => s.tag === 'door1')).toHaveLength(1);
    expect(made.solids.filter((s) => s.tag === 'door2')).toHaveLength(1);
    made.signal('lobot1', true);
    for (let i = 0; i < 30; i++) made.update(i * 0.1, 0.1);
    expect(made.doorOpen(1)).toBeGreaterThan(0.9);
    expect(made.doorOpen(2)).toBe(0);
  });

  it('the reactor’s gantry hangs over nothing: its floors are narrow, and its control room is behind', () => {
    const made = PROPS.reactorinside(kit, {});
    const gantry = made.floors.find((f) => f.tag === 'gantry');
    expect(gantry.hw).toBeLessThan(1.5);
    expect(made.floors.some((f) => f.tag === 'control')).toBe(true);
  });
});
