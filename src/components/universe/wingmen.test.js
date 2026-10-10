import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createWingmen } from './wingmen';

// a fleet as glbFleet.js is one, its models only groups: built ones until
// `arrive(kind)`, then copies of the model (model: true)
const fakeFleet = () => {
  const here = new Set();
  const made = [];
  return {
    made,
    want: vi.fn(),
    loaded: (kind) => here.has(kind),
    make(kind) {
      const m = { kind, group: new THREE.Group(), size: new THREE.Vector3(1, 1, 1), fit: 1, model: here.has(kind) || undefined, update() {}, dispose: vi.fn() };
      made.push(m);
      return m;
    },
    arrive: (kind) => here.add(kind),
  };
};
const ship = { x: 0, y: 0, z: 0, heading: 0, pitch: 0, speed: 20, vy: 0 };
const shown = (parent, fleet) => fleet.made.filter((m) => m.group.parent === parent);

describe('the wingmen, drawn', () => {
  it('asks the fleet for their model as they join, and fly their built ones till it is here', () => {
    const fleet = fakeFleet();
    const parent = new THREE.Group();
    const wingmen = createWingmen(parent, { fleet });
    wingmen.join('ywing', ship, 2);
    expect(fleet.want).toHaveBeenCalledWith(['ywing']);
    wingmen.update(1 / 60, 0, ship, []);
    const built = shown(parent, fleet);
    expect(built).toHaveLength(2);
    for (const m of built) expect(m.model).toBeFalsy();
    wingmen.dispose();
  });

  it('swaps each one flying its built stand-in for the model the moment the model is here', () => {
    const fleet = fakeFleet();
    const parent = new THREE.Group();
    const wingmen = createWingmen(parent, { fleet });
    wingmen.join('ywing', ship, 2);
    wingmen.update(1 / 60, 0, ship, []);
    const built = shown(parent, fleet);
    fleet.arrive('ywing');
    wingmen.update(1 / 60, 0.02, ship, []);
    const now = shown(parent, fleet);
    expect(now).toHaveLength(2);
    for (const m of now) expect(m.model).toBe(true);
    for (const m of built) expect(m.dispose).toHaveBeenCalled();
    wingmen.update(1 / 60, 0.04, ship, []);
    expect(shown(parent, fleet)).toEqual(now); // (and they stay)
    expect(fleet.made).toHaveLength(4);
    wingmen.dispose();
  });
});

describe('the wingmen, as bodies for ship contact', () => {
  it('answers each one flying as a friend to bounce off, who never takes a hit', () => {
    const wingmen = createWingmen(new THREE.Group(), { fleet: fakeFleet() });
    wingmen.join('ywing', ship, 2);
    wingmen.update(1 / 60, 0, ship, []);
    const bodies = wingmen.bodies;
    expect(bodies).toHaveLength(2);
    for (const b of bodies) {
      expect(b.key).toBe(`w:${b.id}`);
      expect(b.kind).toBe('ywing');
      expect(b.side).toBe('friend');
      expect(b.size).toBeGreaterThan(0);
      expect(Object.keys(b.prev).sort()).toEqual(['x', 'y', 'z']);
      expect(b.hit(3)).toBeNull();
    }
    expect(wingmen.bodies).toHaveLength(2); // (and is still there)
    wingmen.clear();
    expect(wingmen.bodies).toEqual([]);
    wingmen.dispose();
  });
});
