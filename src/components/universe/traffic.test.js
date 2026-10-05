// The traffic's life, in Node: the models are stand-ins (a group each), the
// fleet a fake, and Math.random seeded, so what flies is the same every run.
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./glbFleet', () => ({ createFleet: () => null }));
vi.mock('./trafficModels', () => ({
  TRAFFIC: { starwars: ['tie', 'interceptor', 'xwing', 'shuttle', 'destroyer'], rickmorty: ['patrol', 'federation', 'gromflomite', 'meeseeks', 'birdperson'] },
}));

const { createTraffic } = await import('./traffic');
const { PLACES } = await import('./deep');
const { SOLIDS } = await import('./ship');
const { dockable } = await import('./lanes');

// a seeded random, in place of Math.random
const seeded = (seed = 7) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
let random;
beforeEach(() => {
  random = vi.spyOn(Math, 'random').mockImplementation(seeded(11));
});
afterEach(() => random.mockRestore());

// a fleet of stand-ins, remembering every model it made and its kind
function fakeFleet() {
  const made = [];
  return {
    made,
    has: () => true,
    loaded: () => false,
    want() {},
    make(kind) {
      const m = { kind, group: new THREE.Group(), size: new THREE.Vector3(1, 1, 1), update() {}, dispose() {} };
      made.push(m);
      return m;
    },
  };
}
const DT = 0.1;
const planet = PLACES.find((p) => p.kind === 'planet' && dockable(p));
const body = SOLIDS.find((o) => o.id === planet.id).r;
const parked = { x: planet.at[0] + planet.reach + 5, y: planet.at[1], z: planet.at[2], heading: 0, speed: 0 };
const dist = (p) => Math.hypot(p.x - planet.at[0], p.y - planet.at[1], p.z - planet.at[2]);
const setup = () => {
  const fleet = fakeFleet();
  const parent = new THREE.Group();
  const traffic = createTraffic(parent, { fleet });
  traffic.setCrew('xwing');
  return { fleet, parent, traffic };
};
// the model whose group is where a group's lead is
const leadOf = (fleet, g) => fleet.made.find((m) => m.group.parent && g.lead && m.group.position.distanceTo(new THREE.Vector3(...g.lead)) < 0.05);

describe('coming in to land, and launching', () => {
  it('brings the ordinary ships down on to the place you are at, shrinking into it, and launches others out of it', () => {
    const { fleet, traffic } = setup();
    const landed = []; // { last: how far from the middle, scale } of each one that came in
    const launched = []; // the first scale seen of each one going out
    const seen = new Map();
    let t = 0;
    for (let i = 0; i < 6000; i++) {
      t += DT;
      traffic.update(DT, t, parked);
      for (const g of traffic.groups) {
        if (!g.dock) continue;
        const m = leadOf(fleet, g);
        if (!m) continue;
        const key = m.group.id;
        if (g.dock === 'in') seen.set(key, { dock: 'in', last: dist(m.group.position), scale: m.group.scale.x, t: g.t });
        else if (!seen.has(key)) seen.set(key, { dock: 'out', first: dist(m.group.position), scale: m.group.scale.x, kind: g.kind });
      }
    }
    for (const v of seen.values()) (v.dock === 'in' ? landed : launched).push(v);
    expect(landed.length).toBeGreaterThan(2);
    expect(launched.length).toBeGreaterThan(2);
    for (const l of landed) {
      // the last it was seen: on the body (or as near as a tenth of a second allows), and shrunk right down
      expect(l.last).toBeLessThan(body * 1.1 + 1.5);
      expect(l.scale).toBeLessThan(0.15);
      expect(l.t).toBeGreaterThan(0.95);
    }
    for (const l of launched) {
      // the first it was seen: on the body, and tiny
      expect(l.first).toBeLessThan(body * 1.1 + 1.5);
      expect(l.scale).toBeLessThan(0.2);
    }
    // only the ordinary ships land
    expect(fleet.made.filter((m) => ['tie', 'interceptor', 'xwing', 'destroyer'].includes(m.kind) && seen.get(m.group.id)?.dock).length).toBe(0);
  });

  it('never has one on a dock lane while you are out in the open', () => {
    const { traffic } = setup();
    const open = { x: 0, y: 300, z: -3000, heading: 0, speed: 5 };
    let t = 0;
    for (let i = 0; i < 1500; i++) {
      t += DT;
      traffic.update(DT, t, open);
      expect(traffic.groups.some((g) => g.dock)).toBe(false);
    }
  });
});

describe('a wing past you', () => {
  it('peels apart behind you, each away to its own side', () => {
    const { fleet, traffic } = setup();
    const ship = { x: 0, y: 300, z: -3000, heading: 0, speed: 5 };
    traffic.soon('xwing', false);
    let before = null;
    let after = null;
    let t = 0;
    for (let i = 0; i < 1200 && !after; i++) {
      t += DT;
      traffic.update(DT, t, ship);
      const g = traffic.groups.find((x) => x.flyby && x.kind === 'xwing');
      if (!g) continue;
      expect(g.peel).toBe(true);
      const wing = fleet.made.filter((m) => m.kind === 'xwing' && m.group.parent);
      if (wing.length < 2) continue;
      const spread = Math.max(...wing.map((a) => Math.max(...wing.map((b) => a.group.position.distanceTo(b.group.position)))));
      if (g.t > 0.3 && g.t < 0.45 && before === null) before = spread;
      if (g.t > 0.93) after = spread;
    }
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(after).toBeGreaterThan(before + 3);
  });
});

describe('a fight nearby', () => {
  // how far along its lane a freighter gets in a while, with and without one
  const progress = (fight) => {
    const { traffic } = setup();
    traffic.soon('freighter', true);
    let t = 0;
    let g = null;
    for (let i = 0; i < 600 && !g; i++) {
      t += DT;
      traffic.update(DT, t, parked);
      g = traffic.groups.find((x) => x.kind === 'freighter');
    }
    expect(g).not.toBeNull();
    const t0 = g.t;
    // the ship right by it, so it's near the fight
    const near = { ...parked, x: g.lead[0] + 2, y: g.lead[1], z: g.lead[2] };
    let flee = 0;
    for (let i = 0; i < 50; i++) {
      t += DT;
      traffic.update(DT, t, near, { fight });
      flee = traffic.groups.find((x) => x.kind === 'freighter')?.flee ?? flee;
    }
    return { gone: (traffic.groups.find((x) => x.kind === 'freighter')?.t ?? 1) - t0, flee };
  };
  it('sends the ordinary ships near you running: faster, once they get going', () => {
    const calm = progress(false);
    const running = progress(true);
    expect(calm.flee).toBe(0);
    expect(running.flee).toBeGreaterThan(0.9);
    expect(running.gone).toBeGreaterThan(calm.gone * 1.5);
  });
});

describe('a convoy', () => {
  it('is a longer column now, with an escort at each end and one in the middle when it is long', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      random.mockImplementation(seeded(seed));
      const { fleet, traffic } = setup();
      expect(traffic.convoy(parked, 'starwars')).toBe(true);
      const kinds = fleet.made.map((m) => m.kind);
      const escorts = kinds.filter((k) => k === 'xwing').length;
      const freight = kinds.length - escorts;
      expect(freight).toBeGreaterThanOrEqual(4);
      expect(freight).toBeLessThanOrEqual(7);
      expect(escorts).toBe(freight >= 6 ? 3 : 2);
      expect(kinds[0]).toBe('xwing');
      expect(kinds[kinds.length - 1]).toBe('xwing');
    }
  });
});
