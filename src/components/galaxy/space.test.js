import { describe, expect, it } from 'vitest';
import { SHIP, autopilot, spawn, step } from '../universe/ship';
import { SYSTEMS } from './systems';
import { CEILING, EDGE, FAR, PULSE, WIDE, aligned, atGoal, makeSpace, parkBy, steerToward } from './space';
import { OVERDRIVE } from '../universe/ship';

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
  it('is open: 2,400 out to its edge, and the sublight drive up to 120 out in it', () => {
    expect(EDGE).toBe(2400);
    expect(PULSE).toBe(120);
    expect(makeSpace([planet]).edge).toBe(EDGE);
    // still shut right by the planet, and at it
    for (const at of [[0, 0, 0], [0, 0, planet.r], [planet.reach, 0, 0], [0, planet.reach + 20, 0]]) expect(space.openness(...at), at.join()).toBe(0);
    expect(space.boostAt(0, 0, planet.reach + 10)).toBe(SHIP.boost);
    // and all the way open out by the edge
    expect(space.openness(-EDGE + 10, 0, 0)).toBe(1);
  });
  it('never arrives flat out: boosting at the planet from the edge, it’s down to the boost by the time it’s there', () => {
    let s = { ...spawn(null, { x: 0, y: 0, z: EDGE - 5, heading: 0 }), speed: PULSE };
    let top = 0;
    for (let i = 0; i < 3600 && Math.hypot(s.x, s.y, s.z) > planet.reach; i++) {
      s = step(s, { throttle: 1, boost: true }, 1 / 60, space.solids, space).ship;
      top = Math.max(top, s.speed);
    }
    expect(top).toBeGreaterThan(PULSE * 0.95); // (flat out on the way)
    expect(Math.hypot(s.x, s.y, s.z)).toBeLessThanOrEqual(planet.reach);
    expect(s.speed).toBeLessThan(SHIP.boost + 0.5);
  });
  it('opens into super speed only well out from everything: the overdrive by how wide open it is', () => {
    expect(space.wideAlong(0, 0, planet.reach + WIDE.near - 50)).toBe(0);
    expect(space.wideAlong(0, 0, -(planet.reach + WIDE.near + WIDE.ramp + 50))).toBe(1); // (away from the station's side)
    const mid = space.wideAlong(0, 0, -(planet.reach + WIDE.near + WIDE.ramp / 2));
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
    // (a pebble doesn't count, the station does)
    expect(space.wideAlong(300, 0, -500)).toBe(0);
    expect(space.wideAlong(0, 0, -(station.reach + WIDE.near + WIDE.ramp + 50 + 300))).toBe(1);
    expect(space.overdriveAt(0, 0, planet.reach + 10)).toBe(1);
    expect(space.overdriveAt(0, 0, -EDGE + 10)).toBe(OVERDRIVE);
    // and going the way it's heading: past it wide of it stays open, straight at it shuts
    const z = planet.reach + WIDE.near + WIDE.ramp * 0.3;
    expect(space.wideAlong(0, 0, z, [0, 0, -1])).toBeLessThan(space.wideAlong(0, 0, z, [1, 0, 0]));
  });
  it('never arrives flat out from super speed: boosting on the overdrive from the edge it tops 300, and is down to the boost at the planet', () => {
    let s = { ...spawn(null, { x: 0, y: 0, z: EDGE - 5, heading: 0 }), speed: PULSE };
    let top = 0;
    for (let i = 0; i < 3600 && Math.hypot(s.x, s.y, s.z) > planet.reach; i++) {
      const f = [-Math.sin(s.heading), 0, -Math.cos(s.heading)];
      s = step(s, { throttle: 1, boost: true, overdrive: space.overdriveAt(s.x, s.y, s.z, f) }, 1 / 60, space.solids, space).ship;
      top = Math.max(top, s.speed);
    }
    expect(top).toBeGreaterThan(300);
    expect(Math.hypot(s.x, s.y, s.z)).toBeLessThanOrEqual(planet.reach);
    expect(s.speed).toBeLessThan(SHIP.boost + 0.5);
  });
  it('flies itself in on super speed: the autopilot parks at the planet from the edge in under 25 s', () => {
    let s = { ...spawn(null, { x: 0, y: 0, z: EDGE - 5, heading: 0 }), speed: 0 };
    const park = parkBy(planet, [s.x, s.y, s.z], space.solids);
    let t = 0;
    let done = false;
    let top = 0;
    for (; t < 60 && !done; t += 1 / 60) {
      const a = autopilot(s, 'planet', park, space, space.overdriveAt(s.x, s.y, s.z));
      s = step(s, a.input, 1 / 60, space.solids, space).ship;
      top = Math.max(top, s.speed);
      done = a.done;
    }
    expect(top).toBeGreaterThan(250);
    expect(done).toBe(true);
    expect(t).toBeLessThan(25);
    expect(Math.hypot(s.x - park.x, s.z - park.z)).toBeLessThan(2);
  });
  it('sees everything from anywhere in it: the planet, and the gas giant it orbits whole, inside the far plane from the far edge', () => {
    for (const sys of SYSTEMS) {
      // the worst place to be: out at the edge on the far side, as far below (or above) as it goes
      const things = [{ at: [0, 0, 0], r: sys.body?.r ?? 0 }, ...(sys.parent ? [sys.parent] : [])];
      for (const o of things) {
        const h = Math.hypot(o.at[0], o.at[2]);
        const [ux, uz] = h > 1e-9 ? [o.at[0] / h, o.at[2] / h] : [1, 0];
        const from = [-ux * EDGE, o.at[1] > 0 ? -CEILING : CEILING, -uz * EDGE];
        const d = Math.hypot(o.at[0] - from[0], o.at[1] - from[1], o.at[2] - from[2]);
        // (its rim, where the view grazes it, is the furthest of it you see)
        expect(Math.sqrt(d * d - o.r * o.r), sys.id).toBeLessThan(FAR * 0.95);
      }
    }
  });
  it('climbs out of a grown world’s air at speed, not twelve seconds at the boost', () => {
    const hoth = { id: 'planet', at: [0, 0, 0], r: 137.5, reach: 288.75, goal: true, planet: true };
    const s = makeSpace([hoth]);
    // just over its surface, the drive's down; it counts from there, not from its reach
    expect(s.openness(0, 0, hoth.r + 2)).toBe(0);
    expect(s.openness(0, 0, hoth.reach - 10)).toBeGreaterThan(0.5);
    let ship = { ...spawn(null, { x: 0, y: 0, z: 150, heading: Math.PI }), speed: SHIP.boost }; // (nose straight out)
    let t = 0;
    for (; t < 12 && Math.hypot(ship.x, ship.y, ship.z) < hoth.reach; t += 1 / 60) ship = step(ship, { throttle: 1, boost: true }, 1 / 60, s.solids, s).ship;
    expect(t).toBeLessThan(4.5);
    expect(ship.speed).toBeGreaterThan(40);
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

// Boosting from `s` for `seconds` or until `until(ship)`, the stick from
// `stick(ship)`: where it got, the slowest it went, and how fast it was
// going when it first came inside `p`'s reach
const boostRun = (s, seconds, { sp = space, until = () => false, stick = () => ({}), p = planet } = {}) => {
  let ship = s;
  let slowest = Infinity;
  let arrived = null;
  for (let t = 0; t < seconds && !until(ship); t += 1 / 60) {
    ship = step(ship, { throttle: 1, boost: true, ...stick(ship) }, 1 / 60, sp.solids, sp).ship;
    slowest = Math.min(slowest, ship.speed);
    if (arrived === null && Math.hypot(ship.x - p.at[0], ship.y - p.at[1], ship.z - p.at[2]) < p.reach) arrived = ship.speed;
  }
  return { ship, slowest, arrived };
};

describe('the sublight drive near things: no wall round them', () => {
  it('keeps its speed flying past the planet, wide of it', () => {
    // level with it, 40 out past its reach on the side away from the station, flying by
    const s = { ...spawn(null, { x: -(planet.reach + 40), y: 0, z: 600, heading: 0 }), speed: PULSE };
    expect(boostRun(s, 1200 / PULSE).slowest).toBeGreaterThan(PULSE * 0.85);
  });
  it('opens straight up flying away from the planet, just off it', () => {
    const s = { ...spawn(null, { x: 0, y: 0, z: planet.reach + 5, heading: Math.PI }), speed: SHIP.boost };
    expect(boostRun(s, 2).ship.speed).toBeGreaterThan(SHIP.boost * 3);
  });
  it('keeps its speed flying past a battle’s capital ships', () => {
    const hulls = [-500, -560, -620].map((z, i) => ({ id: `hull-${i}`, at: [0, 0, z], r: 6, reach: 6 }));
    const battle = makeSpace([planet, ...hulls]);
    // 30 off the line of them, flying along it
    const s = { ...spawn(null, { x: 30, y: 0, z: -300, heading: 0 }), speed: PULSE };
    expect(boostRun(s, 500 / PULSE, { sp: battle }).slowest).toBeGreaterThan(PULSE * 0.85);
  });
  it('still never arrives flat out: turned hard into the planet off a pass, it’s down to the boost by its reach', () => {
    const alone = makeSpace([planet]);
    for (const out of [15, 40, 80]) {
      for (const side of [-1, 1]) {
        // flying past it (on the drive as far as it's open there), then the stick hard over toward it
        const x = side * (planet.reach + out);
        let s = { ...spawn(null, { x, y: 0, z: 300, heading: 0 }), speed: PULSE };
        s = boostRun(s, (300 - 20) / PULSE, { sp: alone, until: (o) => o.z < 20 }).ship;
        const toward = (o) => {
          const l = Math.hypot(o.x, o.y, o.z);
          return steerToward(o, [-o.x / l, -o.y / l, -o.z / l]);
        };
        const run = boostRun(s, 12, { sp: alone, stick: toward, until: (o) => Math.hypot(o.x, o.y, o.z) < planet.reach });
        expect(run.arrived, `${out} ${side}`).not.toBe(null);
        expect(run.arrived, `${out} ${side}`).toBeLessThan(SHIP.boost + 1);
      }
    }
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
