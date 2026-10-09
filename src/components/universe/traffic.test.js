// The traffic's life, in Node: the models are stand-ins (a group each), the
// fleet a fake, and Math.random seeded, so what flies is the same every run.
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./glbFleet', () => ({ createFleet: () => null }));
vi.mock('./trafficModels', () => ({
  TRAFFIC: { starwars: ['tie', 'interceptor', 'xwing', 'shuttle', 'destroyer'], rickmorty: ['patrol', 'federation', 'gromflomite', 'meeseeks', 'birdperson'] },
}));

const { createTraffic } = await import('./traffic');
const { SIDES } = await import('./sides');
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
const planetSide = parked;
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
    const { traffic } = setup();
    const dist = (p) => Math.hypot(p[0] - planet.at[0], p[1] - planet.at[1], p[2] - planet.at[2]);
    const last = new Map(); // a group on a dock lane → how it was last seen
    const landed = [];
    const launched = [];
    const firstSeen = new Set();
    let t = 0;
    for (let i = 0; i < 6000; i++) {
      t += DT;
      traffic.update(DT, t, planetSide);
      const now = new Set();
      for (const g of traffic.groups) {
        if (!g.dock) continue;
        now.add(g.id);
        if (g.dock === 'out' && !firstSeen.has(g.id)) {
          firstSeen.add(g.id);
          launched.push({ first: dist(g.lead), t: g.t, kind: g.kind });
        }
        last.set(g.id, { dock: g.dock, at: dist(g.lead), t: g.t, kind: g.kind });
      }
      // the ones gone since the last frame: landed (or flown on, launching)
      for (const [id, v] of last) {
        if (now.has(id)) continue;
        if (v.dock === 'in') landed.push(v);
        last.delete(id);
      }
    }
    expect(landed.length).toBeGreaterThan(2);
    expect(launched.length).toBeGreaterThan(2);
    for (const l of landed) {
      // the last it was seen: at the end of its lane, on the body
      expect(l.t).toBeGreaterThan(0.98);
      expect(l.at).toBeLessThan(body * 1.1 + 1.5);
    }
    for (const l of launched) {
      // the first it was seen: on the body, at the start of its lane
      expect(l.t).toBeLessThan(0.02);
      expect(l.first).toBeLessThan(body * 1.1 + 1.5);
    }
    // only the ordinary ships land
    expect([...landed, ...launched].every((l) => ['freighter', 'transport', 'corvette'].includes(l.kind))).toBe(true);
  });

  it('draws a landing ship shrinking to nothing on the body, and a launching one growing out of it', () => {
    const { fleet, traffic } = setup();
    let small = 0;
    let t = 0;
    for (let i = 0; i < 6000; i++) {
      t += DT;
      traffic.update(DT, t, parked);
      for (const g of traffic.groups) {
        if (!(g.dock === 'in' && g.t > 0.99) && !(g.dock === 'out' && g.t < 0.01)) continue;
        const m = leadOf(fleet, g);
        if (!m) continue;
        small += 1;
        expect(m.group.scale.x / (m.fit ?? 1)).toBeLessThan(0.15 * 1.8); // (a fraction of its size: the biggest is 1.8 across)
      }
    }
    expect(small).toBeGreaterThan(0);
  });

  it('docks at the station you are by, in the home system', () => {
    const { fleet, traffic } = setup();
    const station = PLACES.find((p) => p.kind === 'station');
    const r = SOLIDS.find((o) => o.id === station.id).r;
    const by = { x: station.at[0] + station.reach + 4, y: station.at[1], z: station.at[2], heading: 0, speed: 0 };
    const near = (p) => Math.hypot(p.x - station.at[0], p.y - station.at[1], p.z - station.at[2]);
    let landed = 0;
    let t = 0;
    for (let i = 0; i < 6000; i++) {
      t += DT;
      traffic.update(DT, t, by);
      for (const g of traffic.groups) {
        if (g.dock !== 'in' || g.t < 0.995) continue;
        const m = leadOf(fleet, g);
        if (m && near(m.group.position) < r * 1.1 + 1.5) landed += 1;
      }
    }
    expect(landed).toBeGreaterThan(0);
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
    let grew = 0;
    for (const seed of [3, 5, 11, 17]) {
      random.mockImplementation(seeded(seed));
      const { traffic } = setup();
      const ship = { x: 0, y: 300, z: -3000, heading: 0, speed: 5 };
      traffic.soon('xwing', false);
      let id = null;
      let before = null;
      let after = null;
      let t = 0;
      for (let i = 0; i < 1200 && after === null; i++) {
        t += DT;
        traffic.update(DT, t, ship);
        const g = id === null ? traffic.groups.find((x) => x.flyby && x.kind === 'xwing') : traffic.groups.find((x) => x.id === id);
        if (!g) continue;
        id = g.id;
        expect(g.peel).toBe(true);
        // each to its own side: some one way, some the other
        const sides = new Set(g.peels.map((p) => Math.sign(p[0])));
        expect(sides.size).toBe(2);
        if (g.ships.length < 2) break;
        // the spread of this wing's own ships, and which way each is off its leader
        const spread = Math.max(...g.ships.map((a) => Math.max(...g.ships.map((b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])))));
        if (g.t > 0.3 && g.t < 0.45 && before === null) before = spread;
        if (g.t > 0.93) after = spread;
      }
      if (before !== null && after !== null) {
        expect(after, `seed ${seed}`).toBeGreaterThan(before + 3);
        grew += 1;
      }
    }
    expect(grew).toBeGreaterThan(1);
  });
});

describe('a fight nearby', () => {
  // how far along its lane the flyby freighter gets in a while, with a fight
  // on or not, the ship `off` from it: the same run each time
  const progress = (fight, off = 2) => {
    random.mockImplementation(seeded(11));
    const { traffic } = setup();
    traffic.soon('freighter', true);
    let t = 0;
    let g = null;
    for (let i = 0; i < 600 && !g; i++) {
      t += DT;
      traffic.update(DT, t, parked);
      g = traffic.groups.find((x) => x.flyby && x.kind === 'freighter');
    }
    expect(g).toBeTruthy();
    const id = g.id;
    const t0 = g.t;
    const near = { ...parked, x: g.lead[0] + off, y: g.lead[1], z: g.lead[2] };
    let flee = 0;
    for (let i = 0; i < 50; i++) {
      t += DT;
      traffic.update(DT, t, near, { fight });
      flee = traffic.groups.find((x) => x.id === id)?.flee ?? flee;
    }
    return { gone: (traffic.groups.find((x) => x.id === id)?.t ?? 1) - t0, flee };
  };
  it('sends the ordinary ships near you running: faster, once they get going', () => {
    const calm = progress(false);
    const running = progress(true);
    expect(calm.flee).toBe(0);
    expect(running.flee).toBeGreaterThan(0.9);
    expect(running.gone).toBeGreaterThan(calm.gone * 1.5);
  });

  it('leaves the ones far off alone, and the fighters, and the ones landing', () => {
    expect(progress(true, 100).flee).toBe(0);
    // a wing of fighters past you, in a fight
    random.mockImplementation(seeded(11));
    const { traffic } = setup();
    traffic.soon('xwing', false);
    let t = 0;
    let most = 0;
    let docking = 0;
    for (let i = 0; i < 3000; i++) {
      t += DT;
      traffic.update(DT, t, parked, { fight: true });
      for (const g of traffic.groups) {
        if (g.kind === 'xwing') most = Math.max(most, g.flee);
        if (g.dock) {
          docking += 1;
          expect(g.flee).toBe(0);
        }
      }
    }
    expect(most).toBe(0);
    expect(docking).toBeGreaterThan(0);
  });
});

describe('a ship near a planet', () => {
  it('is never drawn inside it: landing, launching, leaving or coming in', () => {
    const { fleet, traffic } = setup();
    let seen = 0;
    let t = 0;
    for (let i = 0; i < 6000; i++) {
      t += DT;
      traffic.update(DT, t, parked);
      for (const m of fleet.made) {
        if (!m.group.parent || m.group.scale.x / Math.max(1e-6, m.group.scale.x) === 0) continue;
        const shown = m.group.scale.x * (m.fit ?? 1) > 0; // (its scale is size × fit × how much of it shows)
        if (!shown) continue;
        const d = Math.hypot(m.group.position.x - planet.at[0], m.group.position.y - planet.at[1], m.group.position.z - planet.at[2]);
        // a ship more than a sliver big is outside the body
        const grown = m.group.scale.x / (m.fit ?? 1);
        if (grown > 0.05) {
          seen += 1;
          expect(d).toBeGreaterThan(body * 0.98);
        }
      }
    }
    expect(seen).toBeGreaterThan(1000);
  });

  it('can’t be shot while it’s too small to see', () => {
    const { traffic } = setup();
    let t = 0;
    let tried = 0;
    for (let i = 0; i < 6000 && tried < 20; i++) {
      t += DT;
      traffic.update(DT, t, parked);
      for (const g of traffic.groups) {
        if (!(g.dock === 'out' && g.t < 0.01) && !(g.dock === 'in' && g.t > 0.995)) continue;
        const [x, y, z] = g.lead;
        tried += 1;
        expect(traffic.hit({ x: x - 2, y, z }, { x: x + 2, y, z })).toBeNull();
      }
    }
    expect(tried).toBeGreaterThan(0);
  });
});

describe('the weave', () => {
  it('never jumps as a fight comes and goes, however long the map has been open', () => {
    const { fleet, traffic } = setup();
    traffic.soon('freighter', true);
    let t = 900; // (a quarter of an hour in)
    const step = (fight, n) => {
      let most = 0;
      const was = new Map();
      for (let i = 0; i < n; i++) {
        t += 1 / 60;
        const near = traffic.groups.find((x) => x.kind === 'freighter')?.lead;
        traffic.update(1 / 60, t, near ? { ...parked, x: near[0] + 2, y: near[1], z: near[2] } : parked, { fight });
        for (const m of fleet.made) {
          if (!m.group.parent) continue;
          const p = was.get(m);
          if (p) most = Math.max(most, Math.abs(m.group.position.y - p));
          was.set(m, m.group.position.y);
        }
      }
      return most;
    };
    step(false, 120);
    expect(step(true, 240)).toBeLessThan(0.25); // (a freighter, flying and weaving, moves a fraction of a unit up or down in a frame)
    expect(step(false, 240)).toBeLessThan(0.25);
  });
});

describe('a convoy', () => {
  it('is a longer column now, with an escort at each end and one in the middle when it is long', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      random.mockImplementation(seeded(seed));
      const { fleet, traffic } = setup();
      expect(traffic.convoy(parked, SIDES.starwars)).toBe(true);
      const kinds = fleet.made.map((m) => m.kind);
      const escorts = kinds.filter((k) => k === 'xwing').length;
      const freight = kinds.length - escorts;
      expect(freight).toBeGreaterThanOrEqual(4);
      expect(freight).toBeLessThanOrEqual(7);
      expect(escorts).toBe(freight >= 6 ? 3 : 2);
      if (freight >= 6) {
        expect(kinds[4]).toBe('xwing'); // (the middle one, after three freighters)
        expect(kinds.slice(1, 4).every((k) => k !== 'xwing')).toBe(true);
      }
      expect(kinds[0]).toBe('xwing');
      expect(kinds[kinds.length - 1]).toBe('xwing');
      // where they fly: one at the front and one at the back, on either side
      const [g] = traffic.groups;
      expect(Math.abs(g.offsets[0][2])).toBe(0);
      const last = g.offsets[g.offsets.length - 1];
      const tail = Math.min(...g.offsets.filter((o, i) => kinds[i] !== 'xwing').map((o) => o[2]));
      expect(last[2]).toBeLessThanOrEqual(tail + 0.6 + 1e-9);
      // each escort the other side from the one before it
      const sides = g.offsets.filter((o, i) => kinds[i] === 'xwing').map((o) => Math.sign(o[0]));
      for (let i = 1; i < sides.length; i++) expect(sides[i]).not.toBe(sides[i - 1]);
    }
  });
});

describe('your standing', () => {
  it('sends the ordinary ships running from a pilot they fear, fight or no fight', () => {
    const { traffic, fleet } = setup();
    const ship = { ...parked };
    let fledFeared = false;
    let fledCalm = false;
    // (long enough for a lane's ship to come by, at the ship's pace)
    for (let t = 0; t < 150; t += DT) {
      traffic.update(DT, t, ship, { fight: false, feared: true });
      if (traffic.groups.some((g) => g.flee > 0.5 && fleet.made.length)) fledFeared = true;
    }
    const calm = setup();
    for (let t = 0; t < 150; t += DT) {
      calm.traffic.update(DT, t, ship, { fight: false, feared: false });
      if (calm.traffic.groups.some((g) => g.flee > 0.5)) fledCalm = true;
    }
    expect(fledFeared).toBe(true);
    expect(fledCalm).toBe(false);
  });

  it('has a patrol of the law passing a wanted pilot report them, once a patrol, and never a pilot in good standing', () => {
    const { traffic } = setup();
    const ship = { ...parked };
    const spotted = [];
    let groups = 0;
    for (let t = 0; t < 240; t += DT) {
      if (t % 20 < DT / 2) traffic.soon('tie'); // (a patrol brought past you now and then)
      for (const e of traffic.update(DT, t, ship, { wanted: true })) if (e.type === 'spotted') spotted.push(e);
      groups = Math.max(groups, traffic.groups.length);
    }
    expect(groups).toBeGreaterThan(0);
    expect(spotted.length).toBeGreaterThan(0);
    for (const e of spotted) {
      expect(e.faction).toBe('empire');
      expect(SIDES.starwars.factions.empire.kinds.map(([k]) => k)).toContain(e.kind);
    }
    const clean = setup();
    for (let t = 0; t < 240; t += DT) {
      if (t % 20 < DT / 2) clean.traffic.soon('tie');
      for (const e of clean.traffic.update(DT, t, ship, { wanted: false })) expect(e.type).not.toBe('spotted');
    }
  });

  it('says who is near enough to witness something, the law among them, the same ship frame to frame', () => {
    const { traffic } = setup();
    const ship = { ...parked };
    let seen = null;
    let law = false;
    let civil = false;
    for (let t = 0; t < 120 && !(law && civil); t += DT) {
      if (t % 10 < DT / 2) traffic.soon(t % 20 < 10 ? 'tie' : 'freighter');
      traffic.update(DT, t, ship, {});
      const near = traffic.near(ship, 40);
      for (const n of near) {
        if (n.law) law = true;
        if (n.civil) civil = true;
        if (n.law) expect(SIDES.starwars.factions.empire.kinds.map(([k]) => k)).toContain(n.kind);
      }
      if (near.length && !seen) seen = near[0].ref;
      if (seen && near.length && near.some((n) => n.ref === seen)) expect(near.find((n) => n.ref === seen).kind).toBe(seen.kind);
    }
    expect(law).toBe(true);
    expect(civil).toBe(true);
    expect(traffic.near(ship, 0)).toEqual([]);
  });
});

describe('as bodies for ship contact', () => {
  // flies traffic past you until one of `pick` is near, and answers the bodies then
  const until = (traffic, ship, pick) => {
    for (let t = 0; t < 120; t += DT) {
      if (t % 10 < DT / 2) traffic.soon(t % 20 < 10 ? 'tie' : 'freighter');
      traffic.update(DT, t, ship, {});
      const bodies = traffic.bodies(ship, 40);
      if (bodies.some(pick)) return bodies;
    }
    return [];
  };

  it('answers the small ships near you, the law among them, as near tells them', () => {
    const { traffic } = setup();
    const ship = { ...parked };
    const law = until(traffic, ship, (b) => b.side === 'law').find((b) => b.side === 'law');
    expect(law).toBeTruthy();
    expect(law.key).toMatch(/^t:\d+:\d+$/);
    expect(SIDES.starwars.factions.empire.kinds.map(([k]) => k)).toContain(law.kind);
    expect(law.size).toBeLessThanOrEqual(2);
    for (const k of 'xyz') expect(law.at[k]).toEqual(expect.any(Number));
    const civil = until(traffic, ship, (b) => b.side === 'civil').find((b) => b.side === 'civil');
    expect(civil).toBeTruthy();
    expect(traffic.bodies(ship, 0)).toEqual([]);
  });

  it('never answers a ship too big to bring down: that is a solid', () => {
    const { traffic } = setup();
    const ship = { ...parked };
    for (let t = 0; t < 120; t += DT) {
      traffic.update(DT, t, ship, {});
      for (const b of traffic.bodies(ship, 1e5)) expect(b.size).toBeLessThanOrEqual(2);
    }
  });

  it('takes a ram as a shot: the ship goes down, and is gone from the bodies', () => {
    const { traffic } = setup();
    const ship = { ...parked };
    const b = until(traffic, ship, (o) => o.side === 'civil').find((o) => o.side === 'civil');
    const r = b.hit(1);
    expect(r).toMatchObject({ down: true, kind: b.kind, size: b.size, civil: true });
    expect(r.at).toBeInstanceOf(THREE.Vector3);
    expect(traffic.bodies(ship, 40).some((o) => o.key === b.key)).toBe(false);
  });
});

describe('its big ships as solids', () => {
  it('answers a ship too big to bring down near you as a solid, and never a small one', () => {
    const { traffic } = setup();
    const ship = { ...parked };
    let found = null;
    for (let t = 0; t < 600 && !found; t += DT) {
      if (t % 30 < DT / 2) traffic.soon('destroyer');
      traffic.update(DT, t, ship, {});
      const solids = traffic.solids(ship, 1e5);
      const small = new Set(traffic.bodies(ship, 1e5).map((b) => b.key));
      for (const o of solids) expect(small.has(o.id)).toBe(false);
      found = solids[0] ?? null;
    }
    expect(found).toBeTruthy();
    expect(found.id).toMatch(/^t:\d+:\d+$/);
    expect(found.ship).toBe(true);
    expect(found.at).toHaveLength(3);
    expect(found.r).toBeGreaterThan(2 * 0.3);
    expect(found.reach).toBe(found.r);
    expect(traffic.solids(ship, 0)).toEqual([]);
  });
});
