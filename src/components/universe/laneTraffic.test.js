// The lane traffic near you, in Node: the models are stand-ins (a group
// each), the fleet a fake, and the flow laneFlow.js’s own.
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./glbFleet', () => ({ createFleet: () => null }));
vi.mock('./trafficModels', () => ({
  TRAFFIC: { starwars: ['tie', 'interceptor', 'xwing', 'shuttle', 'destroyer'], rickmorty: ['patrol', 'federation', 'gromflomite', 'meeseeks', 'birdperson'] },
  buildTraffic: () => null,
}));

const { HEAVY, HEAVY_MAX, createLaneTraffic } = await import('./laneTraffic');
const { NEAR, RESOLVE, flowAt, positionOf } = await import('./laneFlow');
const { LANES } = await import('./hyperlanes');
const { TYPES } = await import('./traffic');

// a fleet of stand-ins, remembering every model it made
function fakeFleet() {
  const made = [];
  return {
    made,
    has: () => true,
    loaded: () => false,
    wanted: [],
    want(list) {
      this.wanted.push(...list);
    },
    make(kind) {
      const m = { kind, group: new THREE.Group(), size: new THREE.Vector3(1, 1, 1), update() {}, dispose() {} };
      made.push(m);
      return m;
    },
  };
}

const trunk = LANES.find((l) => l.tier === 'trunk');
const T0 = 500;
const DT = 0.1;
// a flow ship on the trunk that can be brought down (not big, not over 2 units)
const target = flowAt(trunk, 'out', T0).find((f) => !TYPES[f.kind].big && TYPES[f.kind].size <= 2);
const where = (t) => {
  const f = flowAt(trunk, 'out', t).find((g) => g.i === target.i && g.m === target.m);
  return f && positionOf(trunk, 'out', f.s, f.off);
};
// the ship riding along just beside it
const shipAt = (t) => {
  const p = where(t);
  return { x: p[0] + 2, y: p[1], z: p[2], heading: 0, speed: 0 };
};
const isTarget = (r) => r.lane === trunk.id && r.way === 'out' && r.i === target.i && r.m === target.m;
const ride = (traffic, dead, frames = 6) => {
  let t = T0;
  for (let k = 0; k < frames; k++, t += DT) traffic.update(DT, t, shipAt(t), dead);
  return t - DT; // (the last update's)
};

describe('the lane traffic near you (laneTraffic.js)', () => {
  it('gives the nearest flow ships, the one beside you among them, models within NEAR', () => {
    const fleet = fakeFleet();
    const parent = new THREE.Group();
    const traffic = createLaneTraffic(parent, { fleet });
    const t = ride(traffic, new Map());
    const ship = shipAt(t);
    expect(traffic.count).toBeGreaterThan(0);
    expect(traffic.count).toBeLessThanOrEqual(RESOLVE);
    expect(parent.children.length).toBe(traffic.count);
    for (const r of traffic.list) expect(Math.hypot(r.at[0] - ship.x, r.at[1] - ship.y, r.at[2] - ship.z)).toBeLessThanOrEqual(NEAR + 1e-6);
    const mine = traffic.list.find(isTarget);
    expect(mine).toBeTruthy();
    expect(mine.kind).toBe(target.kind);
    const p = where(t);
    expect(Math.hypot(mine.at[0] - p[0], mine.at[1] - p[1], mine.at[2] - p[2])).toBeLessThan(1e-6);
    // the fleet’s asked for every kind that came near, once each
    expect(fleet.wanted).toContain(target.kind);
    expect(new Set(fleet.wanted).size).toBe(fleet.wanted.length);
    // (a ship already resolved keeps its model: no more made than are out, plus the pool)
    expect(fleet.made.length).toBeLessThanOrEqual(RESOLVE * 2);
  });

  it('brings down the ship a shot goes through, until it comes round again', () => {
    const fleet = fakeFleet();
    const traffic = createLaneTraffic(new THREE.Group(), { fleet });
    const dead = new Map();
    const t = ride(traffic, dead);
    const at = new THREE.Vector3(...traffic.list.find(isTarget).at);
    const h = traffic.hit(at.clone().add(new THREE.Vector3(-1, 0.05, 0)), at.clone().add(new THREE.Vector3(1, 0.05, 0)));
    expect(h).toBeTruthy();
    expect(h.kind).toBe(target.kind);
    expect(h.glance).toBeUndefined();
    expect(h.at.distanceTo(at)).toBeLessThan(1e-6);
    expect(traffic.list.find(isTarget)).toBeUndefined();
    expect(flowAt(trunk, 'out', t + 0.1, dead).some((f) => f.i === target.i && f.m === target.m)).toBe(false);
    // the kill comes in the next update’s events, and it isn’t resolved again
    const events = traffic.update(DT, t + DT, shipAt(t + DT), dead);
    expect(events).toEqual([{ type: 'kill', kind: target.kind }]);
    expect(traffic.list.find(isTarget)).toBeUndefined();
    // a shot through empty space hits nothing
    expect(traffic.hit(new THREE.Vector3(1e6, 1e6, 1e6), new THREE.Vector3(1e6 + 1, 1e6, 1e6))).toBeNull();
  });

  it('makes nothing on a phone', () => {
    const fleet = fakeFleet();
    const parent = new THREE.Group();
    const traffic = createLaneTraffic(parent, { fleet, small: true });
    ride(traffic, new Map());
    expect(traffic.count).toBe(0);
    expect(fleet.made.length).toBe(0);
    expect(parent.children.length).toBe(0);
  });

  it('gives everything back when you aren’t flying', () => {
    const parent = new THREE.Group();
    const traffic = createLaneTraffic(parent, { fleet: fakeFleet() });
    const t = ride(traffic, new Map());
    expect(traffic.count).toBeGreaterThan(0);
    expect(traffic.update(DT, t + DT, null, new Map())).toEqual([]);
    expect(traffic.count).toBe(0);
    expect(parent.children.length).toBe(0);
    traffic.dispose();
  });

  it('draws a heavy model for the nearest of them only, and the kit’s stand-ins for the rest', () => {
    // every model the fleet makes is a heavy one (the X-wing’s 120,000 triangles)
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array((HEAVY + 1) * 9), 3));
    const fleet = fakeFleet();
    fleet.make = (kind) => {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(geo));
      return { kind, group, size: new THREE.Vector3(1, 1, 1), model: true, update() {}, dispose() {} };
    };
    const built = [];
    const build = (kind) => {
      built.push(kind);
      return { group: new THREE.Group(), size: new THREE.Vector3(1, 1, 1), update() {}, dispose() {} };
    };
    const traffic = createLaneTraffic(new THREE.Group(), { fleet, build });
    // beside a convoy: a column of four to seven, all near
    const lead = flowAt(trunk, 'out', T0).find((f) => f.m === 3);
    const p = positionOf(trunk, 'out', lead.s, lead.off);
    for (let k = 0; k < 4; k++) traffic.update(DT, T0, { x: p[0] + 2, y: p[1], z: p[2] }, new Map());
    expect(traffic.count).toBeGreaterThan(HEAVY_MAX);
    expect(traffic.heavy).toBeLessThanOrEqual(HEAVY_MAX);
    expect(built.length).toBeGreaterThan(0);
  });
});
