import { describe, expect, it } from 'vitest';
import { EDGE, GOALS, PLANETS, SHIP, SOLIDS, autopilot, brakeAt, ceilingAt, forward, inTrench, orbiting, parkAt, spawn, step, turnAt } from './ship';
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

  it('rolls into a turn and out of it, banking with it, rather than snapping', () => {
    const s = { ...spawn(null), x: 0, z: 0, heading: 0 };
    // the first few frames turn less than a full-rate turn would
    const early = fly(s, { throttle: 1, turn: 1 }, 0.05, []).ship;
    expect(Math.abs(early.heading)).toBeLessThan(SHIP.turn * 0.05 * 0.6);
    expect(early.rate).toBeLessThan(0);
    // a moment on, it's at the full rate, banked over to the right
    const going = fly(s, { throttle: 1, turn: 1 }, 1, []).ship;
    expect(going.rate).toBeCloseTo(-SHIP.turn * turnAt(going.speed), 1);
    expect(going.bank).toBeGreaterThan(0.3);
    // let go: the turn eases off, and it levels out
    const settled = fly(going, { throttle: 1 }, 0.8, []).ship;
    expect(Math.abs(settled.rate)).toBeLessThan(0.01);
    expect(Math.abs(settled.bank)).toBeLessThan(0.02);
  });

  it('turns wider the faster it goes', () => {
    expect(turnAt(0)).toBe(1);
    expect(turnAt(SHIP.cruise)).toBe(1);
    expect(turnAt(SHIP.boost)).toBeCloseTo(SHIP.turnFast, 6);
    expect(turnAt(SHIP.pulse)).toBeLessThan(SHIP.turnFast);
    const slow = fly({ ...spawn(null), x: 0, z: 0, heading: 0, speed: SHIP.cruise }, { throttle: 1, turn: 1 }, 1, []).ship;
    const fast = fly({ ...spawn(null), x: 0, z: 0, heading: 0, speed: SHIP.boost }, { throttle: 1, boost: true, turn: 1 }, 1, []).ship;
    expect(Math.abs(fast.heading)).toBeLessThan(Math.abs(slow.heading) * 0.75);
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

  it('turns quicker, and pitches quicker, with the sensitivity turned up', () => {
    const s = { ...spawn(null), x: 0, z: 0, heading: 0, speed: SHIP.cruise };
    const turned = (k) => fly(s, { throttle: 1, turn: 1, turnRate: k }, 0.5, []).ship.heading;
    expect(Math.abs(turned(1.5))).toBeGreaterThan(Math.abs(turned(1)) * 1.3);
    const pitched = (k) => fly(s, { throttle: 1, climb: 1, pitchRate: k }, 0.15, []).ship.pitch;
    expect(pitched(1.5)).toBeGreaterThan(pitched(1) * 1.2);
  });
});

describe('up and down', () => {
  const level = { ...spawn(null), x: 0, z: 0, heading: 0, speed: SHIP.cruise };
  // the ship's path, frame by frame
  const path = (s, input, seconds) => {
    const out = [];
    for (let t = 0; t < seconds; t += 1 / 60) out.push((s = step(s, input, 1 / 60, []).ship));
    return out;
  };

  it('points the nose up with the stick and flies up along it, as a fighter does', () => {
    const { ship } = fly(level, { throttle: 1, climb: 1 }, 1, []);
    expect(ship.pitch).toBeGreaterThan(SHIP.pitchMax * 0.9);
    expect(ship.vy).toBeCloseTo(ship.speed * Math.sin(ship.pitch), 1);
    expect(ship.y).toBeGreaterThan(level.y + 2.5);
    // (its way forward is what's left: it goes up, not up and as far on)
    const flat = fly(level, { throttle: 1 }, 1, []).ship;
    expect(Math.abs(ship.z - level.z)).toBeLessThan(Math.abs(flat.z - level.z) * 0.9);
  });

  it('dives the same way, nose down', () => {
    const { ship } = fly(level, { throttle: 1, climb: -1 }, 1, []);
    expect(ship.pitch).toBeLessThan(-SHIP.pitchMax * 0.9);
    expect(ship.y).toBeLessThan(level.y - 2.5);
  });

  it('climbs and dives faster the faster it flies', () => {
    const slow = fly(level, { throttle: 1, climb: 1 }, 0.8, []).ship.vy;
    const fast = fly({ ...level, speed: SHIP.boost }, { throttle: 1, climb: 1, boost: true }, 0.8, []).ship.vy;
    expect(fast).toBeGreaterThan(slow * 2.5);
  });

  it('eases the nose round, never snapping it', () => {
    const frames = [level, ...path(level, { throttle: 1, climb: 1 }, 0.6), ...path({ ...level, pitch: SHIP.pitchMax }, { throttle: 1, climb: -1 }, 1)];
    for (let i = 1; i < frames.length; i++) expect(Math.abs(frames[i].pitch - frames[i - 1].pitch)).toBeLessThanOrEqual(SHIP.pitchRate / 60 + 1e-9);
  });

  it('levels off by itself when let go', () => {
    const up = fly(level, { throttle: 1, climb: 1 }, 1, []).ship;
    const after = fly(up, { throttle: 1 }, 1.2, []).ship;
    expect(Math.abs(after.pitch)).toBeLessThan(0.02);
    expect(Math.abs(after.vy)).toBeLessThan(0.1);
  });

  it('still rises and sinks on its thrusters when stopped, the nose near level', () => {
    const s = { ...spawn(null), x: 0, z: 0 };
    const up = fly(s, { climb: 1 }, 1, []).ship;
    expect(up.vy).toBeGreaterThan(SHIP.climb * 0.8);
    expect(up.y).toBeGreaterThan(s.y + 2);
    expect(Math.abs(up.pitch)).toBeLessThan(0.35);
    const down = fly(s, { climb: -1 }, 1, []).ship;
    expect(down.y).toBeLessThan(s.y - 2);
  });

  it('rounds out before the ceiling at speed, rather than punching through it', () => {
    for (const way of [1, -1]) {
      const s = { ...level, y: way * (SHIP.ceiling - 5), speed: SHIP.boost };
      const frames = path(s, { throttle: 1, climb: way, boost: true }, 3);
      const top = Math.max(...frames.map((f) => way * f.y));
      expect(top).toBeLessThan(SHIP.ceiling + 0.75);
      expect(Math.abs(frames.at(-1).pitch)).toBeLessThan(0.2);
    }
  });

  it('stops at the ceiling and the floor, without a word', () => {
    for (const way of [1, -1]) {
      const { ship, events } = fly({ ...spawn(null), x: 0, z: 0 }, { climb: way, boost: true }, 12, []);
      expect(Math.abs(ship.y)).toBeLessThan(SHIP.ceiling + 1);
      expect(Math.abs(ship.y)).toBeGreaterThan(SHIP.ceiling - 2.5);
      expect(events.filter((e) => e.type === 'edge')).toHaveLength(0);
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

  it('is cut back to the boost while hunters have it interdicted', () => {
    const pulsing = fly(open, { throttle: 1, boost: true }, 6, []).ship;
    expect(pulsing.speed).toBeGreaterThan(SHIP.pulse - 2);
    const cut = fly(pulsing, { throttle: 1, boost: true, interdicted: true }, 2, []).ship;
    expect(cut.speed).toBeLessThanOrEqual(SHIP.boost + 0.5);
    expect(cut.speed).toBeGreaterThan(SHIP.cruise);
    expect(fly(cut, { throttle: 1, boost: true }, 6, []).ship.speed).toBeGreaterThan(SHIP.pulse - 2); // and off again once they're gone
  });

  it('brakes and coasts harder out there, to match the speeds', () => {
    expect(brakeAt(open.x, open.y, open.z)).toBeGreaterThan(SHIP.brake * 3.5);
    expect(brakeAt(0, 0, 0)).toBe(SHIP.brake);
    const flat = { ...open, speed: SHIP.pulse };
    expect(fly(flat, { throttle: -1 }, 3, []).ship.speed).toBeLessThanOrEqual(0);
    expect(fly(flat, {}, 4, []).ship.speed).toBeLessThan(SHIP.pulse * 0.6);
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

  it('is swallowed by the black hole at any speed, with no bounce, and only there', () => {
    const maw = SOLIDS.find((o) => o.id === 'maw');
    expect(SOLIDS.filter((o) => o.swallow).map((o) => o.id)).toEqual(['maw']);
    // creeping up on it, far slower than any crash
    const creep = (o) => ({ ...spawn(null), x: o.at[0], y: o.at[1], z: o.at[2] + o.r + 2, heading: 0, speed: 1 });
    const { ship, events } = fly(creep(maw), { throttle: 0.15 }, 6);
    const fall = events.find((e) => e.id === 'maw');
    expect(fall).toMatchObject({ type: 'crash', swallowed: true });
    expect(fall.speed).toBeLessThan(SHIP.crash);
    expect(events.some((e) => e.type === 'bump' && e.id === 'maw')).toBe(false);
    expect(inside(ship)).toBe(false); // held at its edge for the scene to take over, not through it
    // the same creep at anything else is only a bump
    const glacia = SOLIDS.find((o) => o.id === 'glacia');
    const slow = fly(creep(glacia), { throttle: 0.15 }, 6).events;
    expect(slow.some((e) => e.type === 'bump' && e.id === 'glacia')).toBe(true);
    expect(slow.some((e) => e.type === 'crash')).toBe(false);
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

  it('flies out from the home system to every wonder in deep space, and back, without hitting anything', () => {
    const trip = (from, id, limit) => {
      let s = from;
      const park = parkAt(id, [s.x, s.z]);
      expect(park, id).toBeTruthy();
      let done = false;
      let top = 0;
      let t = 0;
      for (; t < limit && !done; t += 1 / 60) {
        const a = autopilot(s, id, park);
        done = a.done;
        const r = step(s, a.input, 1 / 60);
        s = r.ship;
        top = Math.max(top, s.speed);
        expect(inside(s), `${id} at ${t.toFixed(2)}s`).toBe(false);
        expect(r.events.some((e) => e.type === 'crash' || e.type === 'bump'), `${id} at ${t.toFixed(2)}s`).toBe(false);
      }
      expect(done, id).toBe(true);
      return { s, top, t };
    };
    for (const w of WONDERS) {
      const { s, top } = trip(spawn(ORDER[0]), w.id, 90);
      expect(top, w.id).toBeGreaterThan(SHIP.boost * 2); // on the pulse drive out there
      const g = GOALS[w.id];
      const d = Math.hypot(s.x - g.at[0], s.z - g.at[2]);
      expect(d, w.id).toBeGreaterThan(g.reach); // parked off it, not in it
      expect(d, w.id).toBeLessThan(g.reach + 8);
      expect(Math.abs(s.y - g.at[1]), w.id).toBeLessThan(0.5); // level with it
    }
    // and home again from the furthest, at the home system's speeds by the end
    const far = WONDERS.reduce((a, b) => (Math.hypot(a.at[0], a.at[2]) > Math.hypot(b.at[0], b.at[2]) ? a : b));
    const there = { ...spawn(null), ...parkAt(far.id), speed: 0 };
    const back = trip(there, ORDER[0], 90);
    expect(orbiting(back.s, null)).toBe(ORDER[0]);
  });

  it('has nowhere to go for anything that is not a place', () => {
    expect(parkAt('nope')).toBeNull();
    expect(autopilot(spawn(null), 'nope').done).toBe(true);
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
