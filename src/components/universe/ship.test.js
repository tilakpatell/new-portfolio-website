import { describe, expect, it } from 'vitest';
import { EDGE, PLANETS, SHIP, SOLIDS, autopilot, ceilingAt, forward, inTrench, orbiting, parkAt, spawn, step } from './ship';
import { DEEP, WONDERS } from './deep';
import { ORDER, REACH } from './layout';
import { byId } from './universes';

const fly = (s, input, seconds, solids = SOLIDS) => {
  let ship = s;
  const events = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    const r = step(ship, input, 1 / 60, solids);
    ship = r.ship;
    events.push(...r.events);
  }
  return { ship, events };
};
// in something solid (a trench, where one's laid, is open down to its floor)
const inside = (s) => SOLIDS.some((p) => Math.hypot(s.x - p.at[0], s.y - p.at[1], s.z - p.at[2]) < (inTrench(p, s.x, s.y, s.z) ? p.band.floor : p.r) + SHIP.radius - 1e-6);

describe('flying the ship', () => {
  it('speeds up to cruise, faster with boost, and coasts to a stop', () => {
    const s = spawn(null); // in open space for this one: nothing to bump into
    expect(fly(s, { throttle: 1 }, 3, []).ship.speed).toBeCloseTo(SHIP.cruise, 1);
    expect(fly(s, { throttle: 1, boost: true }, 4, []).ship.speed).toBeCloseTo(SHIP.boost, 1);
    const going = fly(s, { throttle: 1 }, 3, []).ship;
    expect(fly(going, {}, 4, []).ship.speed).toBeCloseTo(0, 3);
  });

  it('goes the way it points, and turns right when told to', () => {
    const s = { ...spawn(null), x: 0, z: 0, heading: 0 };
    const ahead = fly(s, { throttle: 1 }, 0.5, []).ship;
    expect(ahead.z).toBeLessThan(0); // heading 0 is −z
    const right = fly(s, { throttle: 1, turn: 1 }, 0.5, []).ship;
    expect(forward(right.heading)[0]).toBeGreaterThan(0); // nose toward +x
  });

  it('never goes through a planet, and says when it hits one', () => {
    for (const id of ORDER) {
      const park = parkAt(id);
      // pointed straight at the planet, full boost, for as long as it takes to get there
      const { ship, events } = fly({ ...spawn(null), x: park.x, y: park.y, z: park.z, heading: park.heading }, { throttle: 1, boost: true }, 3 + (REACH[id] - byId(id).size) / 8);
      expect(orbiting({ ...ship, ...park }, null), id).toBe(id); // the parking spot is at this planet, not a neighbour
      expect(inside(ship), id).toBe(false);
      expect(events.some((e) => (e.type === 'bump' || e.type === 'crash') && e.id === id), id).toBe(true);
    }
  });

  it('crashes into a planet when it hits it fast, and only bumps when slow', () => {
    const park = parkAt('marvel');
    const at = { ...spawn(null), x: park.x, y: park.y, z: park.z, heading: park.heading };
    const fast = fly(at, { throttle: 1, boost: true }, 4).events;
    expect(fast.some((e) => e.type === 'crash' && e.id === 'marvel')).toBe(true);
    const crash = fast.find((e) => e.type === 'crash');
    expect(crash.speed).toBeGreaterThan(SHIP.crash);
    expect(Math.hypot(...crash.normal)).toBeCloseTo(1, 6);
    const slow = fly(at, { throttle: 0.3 }, 14).events;
    expect(slow.some((e) => e.type === 'bump' && e.id === 'marvel')).toBe(true);
    expect(slow.some((e) => e.type === 'crash')).toBe(false);
  });

  it('climbs and dives, nose up or down as it goes, and levels off when let go', () => {
    const s = { ...spawn(null), x: 0, z: 0, heading: 0 };
    const up = fly(s, { throttle: 1, climb: 1 }, 1, []).ship;
    expect(up.y).toBeGreaterThan(s.y + 2);
    expect(up.vy).toBeCloseTo(SHIP.climb, 1);
    expect(up.pitch).toBeGreaterThan(0.3);
    const down = fly(s, { throttle: 1, climb: -1 }, 1, []).ship;
    expect(down.y).toBeLessThan(s.y - 2);
    expect(down.pitch).toBeLessThan(-0.3);
    const level = fly(up, { throttle: 1 }, 2, []).ship;
    expect(level.vy).toBeCloseTo(0, 3);
    expect(Math.abs(level.pitch)).toBeLessThan(0.01);
  });

  it('stops at the ceiling and the floor, and says so once', () => {
    for (const way of [1, -1]) {
      const { ship, events } = fly({ ...spawn(null), x: 0, z: 0 }, { climb: way, boost: true }, 12, []);
      expect(Math.abs(ship.y)).toBeLessThan(SHIP.ceiling + 1);
      expect(Math.abs(ship.y)).toBeGreaterThan(SHIP.ceiling - 2.5);
      expect(events.filter((e) => e.type === 'edge')).toHaveLength(1);
    }
  });

  it('never goes through a planet from above or below either', () => {
    for (const id of ['marvel', 'home', ORDER.at(-1)]) {
      const p = PLANETS.find((o) => o.id === id);
      for (const way of [1, -1]) {
        // straight over (or under) it, diving (or climbing) into it flat out
        const s = { ...spawn(null), x: p.at[0], y: p.at[1] + way * (p.r + 3), z: p.at[2] };
        const { ship, events } = fly(s, { climb: -way, boost: true }, 3);
        expect(inside(ship), id).toBe(false);
        const hit = events.find((e) => (e.type === 'bump' || e.type === 'crash') && e.id === id);
        expect(hit, id).toBeTruthy();
        if (hit.type === 'crash') expect(hit.normal[1] * way).toBeGreaterThan(0.9); // it went in from that side
      }
    }
  });

  it('is turned back at the edge of the map', () => {
    const s = { ...spawn(null), z: EDGE - 3, heading: Math.PI }; // facing out, near the edge
    const { ship, events } = fly(s, { throttle: 1 }, 3, []);
    expect(Math.hypot(ship.x, ship.z)).toBeLessThanOrEqual(EDGE + 1e-9);
    expect(events.filter((e) => e.type === 'edge')).toHaveLength(1);
    const [fx, fz] = forward(ship.heading);
    expect((-fx * ship.x - fz * ship.z) / Math.hypot(ship.x, ship.z)).toBeGreaterThan(0.5); // nose back toward the middle
  });
});

describe('deep space', () => {
  const open = { ...spawn(null), x: 0, z: DEEP.open + 200, heading: Math.PI }; // out past the system, facing further out

  it('boosts up to the pulse drive out there, and only to the boost at home', () => {
    expect(fly(open, { throttle: 1, boost: true }, 6, []).ship.speed).toBeGreaterThan(SHIP.pulse - 2);
    expect(fly(spawn(null), { throttle: 1, boost: true }, 6, []).ship.speed).toBeCloseTo(SHIP.boost, 1);
  });

  it('falls back to the home system’s speeds by the time it comes home at pulse speed', () => {
    let s = { ...open, heading: 0, speed: SHIP.pulse }; // facing home, flat out
    for (let t = 0; t < 30 && Math.hypot(s.x, s.z) > DEEP.system; t += 1 / 60) s = step(s, { throttle: 1, boost: true }, 1 / 60, []).ship;
    expect(Math.hypot(s.x, s.z)).toBeLessThanOrEqual(DEEP.system);
    expect(s.speed).toBeLessThanOrEqual(SHIP.boost + 0.5);
  });

  it('can climb far higher out there than at home', () => {
    expect(ceilingAt(open.x, open.z)).toBe(DEEP.ceiling);
    expect(ceilingAt(0, 0)).toBe(SHIP.ceiling);
    const { ship } = fly(open, { climb: 1 }, 20, []);
    expect(ship.y).toBeGreaterThan(DEEP.ceiling - 25);
    expect(ship.y).toBeLessThan(DEEP.ceiling + 5);
  });

  it('lets the ship down into the Death Star’s trench, and only there', () => {
    const ds = SOLIDS.find((o) => o.id === 'starwars');
    expect(ds.band).toBeTruthy();
    // level with the trench on the stretch that's laid (the side toward home),
    // heading straight in, slowly: it stops near the floor
    const toward = (a, dy, out) => {
      const x = ds.at[0] + Math.cos(a) * (ds.r + out);
      const z = ds.at[2] + Math.sin(a) * (ds.r + out);
      return { ...spawn(null), x, y: ds.at[1] + dy, z, heading: Math.atan2(-(ds.at[0] - x), -(ds.at[2] - z)), speed: 2 };
    };
    const into = fly(toward(ds.band.home, 0, 3), { throttle: 0.3 }, 6).ship;
    const d = Math.hypot(into.x - ds.at[0], into.y - ds.at[1], into.z - ds.at[2]);
    expect(d).toBeLessThan(ds.r - 1.5);
    expect(d).toBeGreaterThanOrEqual(ds.band.floor + SHIP.radius - 1e-6);
    // above the trench, or round the far side where none is laid, it's the surface that stops it
    for (const s of [toward(ds.band.home, ds.band.half + 2, 3), toward(ds.band.home + Math.PI, 0, 3)]) {
      const off = fly(s, { throttle: 0.3 }, 6).ship;
      expect(Math.hypot(off.x - ds.at[0], off.y - ds.at[1], off.z - ds.at[2])).toBeGreaterThanOrEqual(ds.r + SHIP.radius - 1e-6);
    }
  });

  it('crashes into a wonder, never through it', () => {
    for (const w of WONDERS.filter((o) => o.solid !== false)) {
      // from 120 out, level with it, flat out at it (slowed by the drive dropping out as it nears)
      const s = { ...spawn(null), x: w.at[0], y: w.at[1], z: w.at[2] + w.r + 120, heading: 0, speed: SHIP.pulse };
      const { ship, events } = fly(s, { throttle: 1, boost: true }, 9);
      expect(inside(ship), w.id).toBe(false);
      expect(events.some((e) => e.type === 'crash' && e.id === w.id), w.id).toBe(true);
    }
  });
});

describe('being at a universe', () => {
  it('starts parked at a linked universe, and at the edge otherwise', () => {
    for (const id of ORDER) expect(orbiting(spawn(id), null)).toBe(id);
    expect(orbiting(spawn(null), null)).toBeNull();
  });

  it('holds on to the universe until the ship has clearly left', () => {
    const p = PLANETS[0];
    const at = parkAt(p.id);
    const nearEdge = { x: p.at[0] + (at.x - p.at[0]) * 1.5, z: p.at[2] + (at.z - p.at[2]) * 1.5 };
    expect(orbiting({ ...spawn(null), ...nearEdge }, p.id)).toBe(p.id);
  });
});

describe('autopilot', () => {
  it('flies from the edge to every universe without hitting anything', () => {
    for (const id of ORDER) {
      let s = spawn(null);
      const park = parkAt(id, [s.x, s.z]);
      let done = false;
      let bumps = 0;
      for (let t = 0; t < 40 && !done; t += 1 / 60) {
        const a = autopilot(s, id, park);
        done = a.done;
        const r = step(s, a.input, 1 / 60);
        s = r.ship;
        bumps += r.events.filter((e) => e.type === 'bump' || e.type === 'crash').length;
      }
      expect(done, id).toBe(true);
      expect(bumps, id).toBe(0);
      expect(orbiting(s, null), id).toBe(id);
    }
  });

  it('flies down (or up) to a universe from high above (or below) the map, level with it', () => {
    for (const id of ORDER) {
      for (const y of [12, -12]) {
        let s = { ...spawn(null), y };
        const park = parkAt(id, [s.x, s.z]);
        let done = false;
        for (let t = 0; t < 45 && !done; t += 1 / 60) {
          const a = autopilot(s, id, park);
          done = a.done;
          s = step(s, a.input, 1 / 60).ship;
          expect(inside(s), `${id} at ${t.toFixed(2)}s`).toBe(false);
        }
        expect(done, `${id} from ${y}`).toBe(true);
        expect(s.y).toBeCloseTo(park.y, 0);
        expect(orbiting(s, null), id).toBe(id);
      }
    }
  });

  it('flies from one universe to the next all the way round', () => {
    let s = spawn(ORDER[0]);
    for (let i = 1; i <= ORDER.length; i++) {
      const id = ORDER[i % ORDER.length];
      const park = parkAt(id, [s.x, s.z]);
      let done = false;
      for (let t = 0; t < 40 && !done; t += 1 / 60) {
        const a = autopilot(s, id, park);
        done = a.done;
        s = step(s, a.input, 1 / 60).ship;
        expect(inside(s), `${id} at ${t.toFixed(2)}s`).toBe(false);
      }
      expect(done, id).toBe(true);
    }
  });
});
