import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createHunters } from './hunters';

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
      m.group.add(new THREE.Group());
      made.push(m);
      return m;
    },
    arrive: (kind) => here.add(kind),
  };
};
const ship = { x: 0, y: 0, z: 0, heading: 0, pitch: 0, speed: 0, vy: 0 };
const shown = (parent, fleet) => fleet.made.filter((m) => m.group.parent === parent);

describe('the hunters, drawn', () => {
  it('asks the fleet for the models of the kinds a pack flies as it comes, once each', () => {
    const fleet = fakeFleet();
    const hunters = createHunters(new THREE.Group(), { fleet });
    hunters.pack('empire', ship, { size: 4, ace: true });
    const kinds = new Set(fleet.made.map((m) => m.kind));
    expect(fleet.want).toHaveBeenCalledTimes(1);
    expect(new Set(fleet.want.mock.calls[0][0])).toEqual(kinds);
    expect(fleet.want.mock.calls[0][0]).toHaveLength(kinds.size);
    hunters.dispose();
  });

  it('asks for the model a kind is drawn as, and swaps to it once that one is here (a missile boat flies the gunboat’s)', () => {
    const fleet = fakeFleet();
    const parent = new THREE.Group();
    const hunters = createHunters(parent, { fleet });
    hunters.pack('empire', ship, { size: 1, ace: false, kinds: ['missileboat'] });
    expect(fleet.want.mock.calls[0][0]).toEqual(['gunboat']);
    const [built] = shown(parent, fleet);
    expect(built.kind).toBe('gunboat');
    expect(built.model).toBeFalsy();
    fleet.arrive('gunboat');
    hunters.update(1 / 60, 0, ship);
    expect(shown(parent, fleet)[0].model).toBe(true);
    hunters.dispose();
  });

  it('swaps a hunter flying its built stand-in for the model the moment the model is here, as the galaxy’s slots do', () => {
    const fleet = fakeFleet();
    const parent = new THREE.Group();
    const hunters = createHunters(parent, { fleet });
    hunters.pack('ig88', ship, { size: 1, ace: false });
    const [built] = shown(parent, fleet);
    expect(built.kind).toBe('ig2000');
    expect(built.model).toBeFalsy();
    hunters.update(1 / 60, 0, ship);
    expect(shown(parent, fleet)).toEqual([built]); // (not here yet: the built one flies on)
    fleet.arrive('ig2000');
    hunters.update(1 / 60, 0.02, ship);
    const now = shown(parent, fleet);
    expect(now).toHaveLength(1);
    expect(now[0].model).toBe(true);
    expect(built.dispose).toHaveBeenCalled();
    expect(now[0].group.position.distanceTo(built.group.position)).toBeLessThan(1); // (where the hunter is)
    hunters.dispose();
  });

  it('leaves a hunter already flying the model as it is', () => {
    const fleet = fakeFleet();
    fleet.arrive('ig2000');
    const parent = new THREE.Group();
    const hunters = createHunters(parent, { fleet });
    hunters.pack('ig88', ship, { size: 1, ace: false });
    const [model] = shown(parent, fleet);
    for (let i = 0; i < 3; i++) hunters.update(1 / 60, i / 60, ship);
    expect(shown(parent, fleet)).toEqual([model]);
    expect(fleet.made).toHaveLength(1);
    hunters.dispose();
  });
});

describe('the hunters, as bodies for ship contact', () => {
  it('answers each one in the fight as a foe, where it is and where it was', () => {
    const hunters = createHunters(new THREE.Group(), { fleet: fakeFleet() });
    hunters.pack('empire', ship, { size: 2, ace: false, kinds: ['tie', 'tie'] });
    hunters.update(1 / 60, 0, ship);
    const bodies = hunters.bodies;
    expect(bodies).toHaveLength(2);
    const [b] = bodies;
    expect(b.key).toBe(`h:${b.id}`);
    expect(b.kind).toBe('tie');
    expect(b.side).toBe('foe');
    expect(b.size).toBe(0.3);
    for (const p of [b.at, b.prev, b.vel]) expect(Object.keys(p).sort()).toEqual(['x', 'y', 'z']);
    hunters.dispose();
  });

  it('leaves out a rammer, whose own burst on you stands, and one flickered out of sight', () => {
    const hunters = createHunters(new THREE.Group(), { fleet: fakeFleet() });
    hunters.pack('empire', ship, { size: 1, ace: false, kinds: ['wardrone'] });
    expect(hunters.bodies).toEqual([]);
    hunters.clear();
    hunters.pack('empire', ship, { size: 1, ace: false, kinds: ['zigerion'] });
    const [z] = hunters.bodies;
    expect(z.hit(1).down).toBe(false); // (hit, it flickers out of sight a moment)
    expect(hunters.bodies).toEqual([]);
    hunters.dispose();
  });

  it('takes a ram’s punch as hits, as a shot does: a TIE goes down, Vader comes on', () => {
    const hunters = createHunters(new THREE.Group(), { fleet: fakeFleet() });
    hunters.pack('empire', ship, { size: 2, ace: false, kinds: ['tie', 'tieadvanced'] });
    const [tie, vader] = ['tie', 'tieadvanced'].map((k) => hunters.bodies.find((b) => b.kind === k));
    const down = tie.hit(1);
    expect(down).toMatchObject({ id: tie.id, kind: 'tie', down: true, faction: 'empire' });
    expect(down.at).toBeInstanceOf(THREE.Vector3);
    expect(vader.hit(1)).toMatchObject({ kind: 'tieadvanced', down: false });
    expect(hunters.bodies.map((b) => b.kind)).toEqual(['tieadvanced']);
    hunters.dispose();
  });
});
