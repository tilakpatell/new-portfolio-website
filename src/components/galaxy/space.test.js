import { describe, expect, it } from 'vitest';
import { SHIP, autopilot, spawn, step } from '../universe/ship';
import { DRIVE, EDGE, PULSE, aligned, atGoal, makeSpace, parkBy, steerToward } from './space';

const planet = { id: 'planet', at: [0, 0, 0], r: 40, reach: 84, goal: true, planet: true };
const station = { id: 'deathstar', at: [170, 26, 150], r: 34, reach: 48, goal: true };
const pebble = { id: 'rock-1', at: [300, 0, 0], r: 0.6, reach: 0.6 };
const space = makeSpace([planet, station, pebble]);

describe('makeSpace', () => {
  it('opens the drive up out in the open, not near anything', () => {
    // (just over the planet's surface, the drive's down; it counts from there, not from its reach)
    expect(space.openness(0, 0, 50)).toBe(0);
    expect(space.openness(-500, 0, -500)).toBe(1);
    expect(space.boostAt(0, 0, 50)).toBe(SHIP.boost);
    expect(space.boostAt(-500, 0, -500)).toBe(PULSE);
    // a pebble doesn't count
    expect(space.openness(300, 0, -230)).toBeGreaterThan(0.5);
  });
  it('keeps the drive open flying past something, and closes it only for what the nose is on', () => {
    const moon = { id: 'moon-1', at: [0, 0, -300], r: 1.6, reach: 2.1 };
    const s = makeSpace([planet, moon]);
    const north = [0, 0, -1];
    // 20 units off to the side of a moon, nose past it: wide open (it was the boost, 12, and stayed there till well past)
    expect(s.driveAlong(20, 0, -280, north)).toBe(1);
    // nose on it from the same distance: down
    const at = [-20 / Math.hypot(20, 20), 0, -20 / Math.hypot(20, 20)];
    expect(s.driveAlong(20, 0, -280, at)).toBeLessThan(0.25);
    // going away from the planet just off its reach: opening, not held at the boost
    expect(s.driveAlong(0, 0, 110, [0, 0, 1])).toBeGreaterThan(0.6);
    // and skimming round it, a little further out than the autopilot parks: more than the boost
    expect(s.boostAt(0, 0, 96, SHIP.boost, s.driveAlong(0, 0, 96, [1, 0, 0]))).toBeGreaterThan(SHIP.boost * 1.8);
  });
  it('climbs out of a grown world’s air at speed, not twelve seconds at the boost', () => {
    const hoth = { id: 'planet', at: [0, 0, 0], r: 137.5, reach: 288.75, goal: true, planet: true };
    const s = makeSpace([hoth]);
    let ship = { ...spawn(null, { x: 0, y: 0, z: 150, heading: Math.PI }), speed: SHIP.boost }; // (nose straight out)
    let t = 0;
    for (; t < 12 && Math.hypot(ship.x, ship.y, ship.z) < hoth.reach; t += 1 / 60) ship = step(ship, { throttle: 1, boost: true }, 1 / 60, s.solids, s).ship;
    expect(t).toBeLessThan(4.5);
    expect(ship.speed).toBeGreaterThan(40);
  });
  it('a battle’s hulls only slow you if you’re flying at them, and small rocks never', () => {
    const hull = { id: 'war-isd-0', at: [400, 0, 0], r: 6, reach: 6, sr: 6, hull: 'war-isd' };
    const rock = { id: 'rocks-0-3', at: [400, 0, -60], r: 2.5, reach: 2.5 };
    const s = makeSpace([planet, hull, rock]);
    expect(s.driveAlong(400, 0, 40, [1, 0, 0])).toBe(1); // (alongside it)
    expect(s.driveAlong(400, 0, 40, [0, 0, -1])).toBeLessThan(0.3); // (at it)
    expect(s.driveAlong(400, 0, -40, [0, 0, -1])).toBe(1); // (a rock dead ahead: it bumps you, it doesn't hold you)
  });
  it('slows you at a steady rate head on, never the old jolt, down to the boost just over the planet’s air', () => {
    let s = { ...spawn(null, { x: 0, y: 0, z: 600, heading: 0 }), speed: PULSE };
    let worst = 0;
    const floor = planet.r * (1 + DRIVE.air) + DRIVE.near;
    for (let i = 0; i < 4000 && Math.hypot(s.x, s.y, s.z) > floor; i++) {
      const next = step(s, { throttle: 1, boost: true }, 1 / 60, space.solids, space).ship;
      worst = Math.max(worst, (s.speed - next.speed) * 60);
      s = next;
    }
    expect(Math.hypot(s.x, s.y, s.z)).toBeLessThanOrEqual(floor);
    expect(worst).toBeLessThan(DRIVE.decel * 1.6);
    expect(s.speed).toBeLessThanOrEqual(SHIP.boost + 0.5);
  });
  it('turning the nose onto something close at speed sheds it hard, but not the old wall', () => {
    const hard = makeSpace([planet]);
    expect(hard.drop).toBeLessThan(SHIP.drop / 2);
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
  it('flies to the planet and parks off it, the drive no help slowing down', () => {
    let s = spawn(null, { x: 300, y: 20, z: 400, heading: 0.3 });
    const park = parkBy(planet, [s.x, s.y, s.z], space.solids);
    let done = false;
    let bumped = false;
    for (let i = 0; i < 4000 && !done; i++) {
      const a = autopilot(s, 'planet', park, space);
      done = a.done;
      const r = step(s, a.input, 0.05, space.solids, space);
      bumped ||= r.events.some((e) => e.type === 'crash' || (e.type === 'bump' && e.id === 'planet'));
      s = r.ship;
    }
    expect(done).toBe(true);
    expect(bumped).toBe(false);
    expect(atGoal(s, space.goals)).toBe('planet');
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
