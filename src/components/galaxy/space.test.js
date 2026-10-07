import { describe, expect, it } from 'vitest';
import { SHIP, autopilot, spawn, step } from '../universe/ship';
import { EDGE, PULSE, aligned, atGoal, makeSpace, parkBy, steerToward } from './space';

const planet = { id: 'planet', at: [0, 0, 0], r: 40, reach: 84, goal: true };
const station = { id: 'deathstar', at: [170, 26, 150], r: 34, reach: 48, goal: true };
const pebble = { id: 'rock-1', at: [300, 0, 0], r: 0.6, reach: 0.6 };
const space = makeSpace([planet, station, pebble]);

describe('makeSpace', () => {
  it('opens the drive up out in the open, not near anything', () => {
    expect(space.openness(0, 0, 100)).toBe(0);
    expect(space.openness(-500, 0, -500)).toBe(1);
    expect(space.boostAt(0, 0, 100)).toBe(SHIP.boost);
    expect(space.boostAt(-500, 0, -500)).toBe(PULSE);
    // a pebble doesn't count
    expect(space.openness(300, 0, -230)).toBeGreaterThan(0.5);
  });
  it('knows its goals', () => {
    expect(Object.keys(space.goals).sort()).toEqual(['deathstar', 'planet']);
  });
  it('flies in it: bounces off the planet, turned back at the edge', () => {
    let s = { ...spawn(null, { x: 0, y: 0, z: 90, heading: 0 }), speed: 2 };
    for (let i = 0; i < 400; i++) s = step(s, { throttle: 0.3 }, 0.05, space.solids, space).ship;
    expect(Math.hypot(s.x, s.y, s.z)).toBeGreaterThanOrEqual(planet.r);
    let far = { ...spawn(null, { x: 0, y: 0, z: EDGE - 5, heading: Math.PI }), speed: 20 };
    for (let i = 0; i < 200; i++) far = step(far, { throttle: 1, boost: true }, 0.05, space.solids, space).ship;
    expect(Math.hypot(far.x, far.z)).toBeLessThanOrEqual(EDGE + 1e-6);
  });
  it('goes high and low, nothing like the universe map’s disc', () => {
    let s = { ...spawn(null, { x: 300, y: 0, z: 300, heading: 0 }), pitch: 1.2, speed: 5 };
    for (let i = 0; i < 400; i++) s = step(s, { throttle: 1, climb: 0.2 }, 0.05, space.solids, space).ship;
    expect(s.y).toBeGreaterThan(40);
  });
});

describe('the autopilot in a system', () => {
  it('parks off a goal, facing it, clear of the rest', () => {
    const p = parkBy(station, [0, 0, 300], space.solids);
    expect(Math.hypot(p.x - station.at[0], p.z - station.at[2])).toBeGreaterThan(station.reach);
    expect(Math.hypot(p.x, p.y, p.z)).toBeGreaterThan(planet.reach);
    expect(aligned({ ...p, pitch: 0 }, [station.at[0] - p.x, 0, station.at[2] - p.z].map((v, _, a) => v / Math.hypot(a[0], a[2])))).toBeGreaterThan(0.99);
  });
  it('flies there and stops', () => {
    let s = spawn(null, { x: -200, y: 30, z: 260, heading: 0 });
    const park = parkBy(station, [s.x, s.y, s.z], space.solids);
    let done = false;
    for (let i = 0; i < 4000 && !done; i++) {
      const a = autopilot(s, 'deathstar', park, space);
      done = a.done;
      s = step(s, a.input, 0.05, space.solids, space).ship;
    }
    expect(done).toBe(true);
    expect(atGoal(s, space.goals)).toBe('deathstar');
  });
  it('knows where it is, and holds on till it’s clearly left', () => {
    expect(atGoal({ x: 0, y: 0, z: 88 }, space.goals)).toBe('planet');
    expect(atGoal({ x: 0, y: 0, z: 97 }, space.goals)).toBe(null);
    expect(atGoal({ x: 0, y: 0, z: 97 }, space.goals, 'planet')).toBe('planet');
    expect(atGoal({ x: 0, y: 0, z: 200 }, space.goals, 'planet')).toBe(null);
  });
  it('says how well the nose points somewhere', () => {
    expect(aligned({ heading: 0, pitch: 0 }, [0, 0, -1])).toBeCloseTo(1);
    expect(aligned({ heading: Math.PI / 2, pitch: 0 }, [-1, 0, 0])).toBeCloseTo(1);
    expect(aligned({ heading: 0, pitch: 0 }, [0, 0, 1])).toBeCloseTo(-1);
  });
});

describe('steerToward', () => {
  it('swings the nose round onto the way to jump, however it starts', () => {
    for (const dir of [[1, 0, 0], [0, 0, 1], [-0.6, 0, 0.8], [0.3, 0.5, -0.81]]) {
      const l = Math.hypot(...dir);
      const d = dir.map((v) => v / l);
      let s = { ...spawn(null, { x: 500, y: 0, z: 500, heading: 0.4 }), speed: 3, bank: 0.6 };
      for (let i = 0; i < 160; i++) s = step(s, { throttle: 0.2, ...steerToward(s, d) }, 0.05, space.solids, space).ship;
      expect(aligned(s, d), dir.join()).toBeGreaterThan(0.995);
    }
  });
});
