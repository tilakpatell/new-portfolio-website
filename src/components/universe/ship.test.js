import { describe, expect, it } from 'vitest';
import { EDGE, PLANETS, SHIP, SOLIDS, autopilot, forward, orbiting, parkAt, spawn, step } from './ship';
import { ORDER } from './layout';

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
const inside = (s) => SOLIDS.some((p) => Math.hypot(s.x - p.at[0], s.y - p.at[1], s.z - p.at[2]) < p.r + SHIP.radius - 1e-6);

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
      // pointed straight at the planet, full boost
      const { ship, events } = fly({ ...spawn(null), x: park.x, z: park.z, heading: park.heading }, { throttle: 1, boost: true }, 2);
      expect(orbiting({ ...ship, ...park }, null), id).toBe(id); // the parking spot is at this planet, not a neighbour
      expect(inside(ship), id).toBe(false);
      expect(events.some((e) => (e.type === 'bump' || e.type === 'crash') && e.id === id), id).toBe(true);
    }
  });

  it('crashes into a planet when it hits it fast, and only bumps when slow', () => {
    const park = parkAt('marvel');
    const at = { ...spawn(null), x: park.x, z: park.z, heading: park.heading };
    const fast = fly(at, { throttle: 1, boost: true }, 2).events;
    expect(fast.some((e) => e.type === 'crash' && e.id === 'marvel')).toBe(true);
    const crash = fast.find((e) => e.type === 'crash');
    expect(crash.speed).toBeGreaterThan(SHIP.crash);
    expect(Math.hypot(...crash.normal)).toBeCloseTo(1, 6);
    const slow = fly(at, { throttle: 0.3 }, 4).events;
    expect(slow.some((e) => e.type === 'bump' && e.id === 'marvel')).toBe(true);
    expect(slow.some((e) => e.type === 'crash')).toBe(false);
  });

  it('is turned back at the edge of the map', () => {
    const s = { ...spawn(null), heading: Math.PI }; // facing out, past the edge
    const { ship, events } = fly(s, { throttle: 1 }, 3, []);
    expect(Math.hypot(ship.x, ship.z)).toBeLessThanOrEqual(EDGE + 1e-9);
    expect(events.filter((e) => e.type === 'edge')).toHaveLength(1);
    const [fx, fz] = forward(ship.heading);
    expect((-fx * ship.x - fz * ship.z) / Math.hypot(ship.x, ship.z)).toBeGreaterThan(0.5); // nose back toward the middle
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
