import { describe, expect, it } from 'vitest';
import { DRIFT, SPOOL, enter, poseOf, step } from './ride';
import { LANES, NODES, R, RING, TIERS, carriageway } from './hyperlanes';
import { bezier, tangent } from './lanes';
import { SHIP, STARTS, headingTo, spawn, startAt } from './ship';
import { REGIONS } from './regions';

const unit = (v) => {
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// a ship at `at`, its nose along `d` (unit), going `speed`
function shipAt(at, d, speed) {
  return { ...spawn(null), x: at[0], y: at[1], z: at[2], heading: headingTo(d[0], d[2]), pitch: Math.asin(d[1]), speed };
}
const turned = (d, a) => unit([d[0] * Math.cos(a) - d[2] * Math.sin(a), d[1], d[0] * Math.sin(a) + d[2] * Math.cos(a)]);
const node = (id) => NODES.find((n) => n.id === id);
// Middle-earth's ramp: one lane leaves it, its local lane out to its beacon
const local = LANES.find((l) => l.from === 'ramp:middleearth');
const trunk = LANES.filter((l) => l.tier === 'trunk').reduce((a, b) => (Math.abs(b.length - 15000) < Math.abs(a.length - 15000) ? b : a));
// on the trunk's out carriageway at s, nose along it
function riding(lane, s, speed = SHIP.boost, way = 'out') {
  const pts = carriageway(lane, way);
  return shipAt(bezier(pts, s), unit(tangent(pts, s)), speed);
}
const go = (ride, ship, input, t, dt = 1 / 60) => {
  let r = { ride, ship, out: null };
  for (let k = 0; k < Math.round(t / dt) && !r.out; k++) r = step(r.ride, r.ship, input, dt);
  return r;
};

describe('riding a lane (ride.js)', () => {
  it('keeps the spec’s numbers', () => {
    expect(SPOOL).toBe(2.5);
    expect(DRIFT).toBe(4);
  });

  it('gets on through a ramp’s ring, heading out along the lane, and not 50° off it', () => {
    const n = node('ramp:middleearth');
    const d = unit(tangent(carriageway(local, 'out'), 0));
    const on = enter(shipAt([n.at[0], n.at[1] + RING * 0.5, n.at[2]], d, SHIP.boost));
    expect(on?.lane.id).toBe(local.id);
    expect(on.way).toBe('out');
    expect(on.s).toBe(0);
    expect(enter(shipAt(n.at, turned(d, (50 * Math.PI) / 180), SHIP.boost))).toBeNull();
    // and not from outside the ring
    expect(enter(shipAt([n.at[0], n.at[1] + RING * 1.5, n.at[2]], d, SHIP.boost))).toBeNull();
  });

  it('merges in mid-lane at the boost, not at cruise, and only flying along it', () => {
    expect(enter(riding(trunk, 0.5, SHIP.cruise), { throttle: 1 })).toBeNull();
    const on = enter(riding(trunk, 0.5, SHIP.boost), { throttle: 1 });
    expect(on?.lane.id).toBe(trunk.id);
    expect(on.s).toBeCloseTo(0.5, 2);
    // (heading the wrong way down it, or 30° across it: no)
    const pts = carriageway(trunk, 'out');
    const d = unit(tangent(pts, 0.5));
    expect(enter(shipAt(bezier(pts, 0.5), d.map((v) => -v), SHIP.boost), { throttle: 1 })).toBeNull();
    expect(enter(shipAt(bezier(pts, 0.5), turned(d, (30 * Math.PI) / 180), SHIP.boost), { throttle: 1 })).toBeNull();
    // (nor holding back: just dropped out, say)
    expect(enter(riding(trunk, 0.5, SHIP.pulse), { throttle: -1 })).toBeNull();
  });

  it('spools up to the lane’s speed over SPOOL seconds', () => {
    const ship = riding(trunk, 0.05);
    const r = go(enter(ship, { throttle: 1 }), ship, {}, SPOOL);
    expect(r.ride.speed).toBeGreaterThan(TIERS.trunk.speed * 0.99);
    expect(r.ride.speed).toBeLessThanOrEqual(TIERS.trunk.speed);
    expect(r.ship.speed).toBe(r.ride.speed);
  });

  it('rides a trunk end to end in its length over its speed, and half the spool', () => {
    const n = node(trunk.from);
    const d = unit(tangent(carriageway(trunk, 'out'), 0));
    const ship = shipAt(n.at, d, SHIP.boost);
    const ride = enter(ship);
    expect(ride?.lane.id).toBe(trunk.id);
    let r = { ride, ship, out: null };
    let t = 0;
    for (; t < 60 && !r.out; t += 1 / 60) r = step(r.ride, r.ship, {}, 1 / 60);
    expect(r.out).toBe('end');
    expect(t).toBeGreaterThan(trunk.length / 1500 + SPOOL / 2 - 0.5);
    expect(t).toBeLessThan(trunk.length / 1500 + SPOOL / 2 + 0.5);
    // and comes off at the far end at the boost, nose along the lane
    expect(dist([r.ship.x, r.ship.y, r.ship.z], bezier(carriageway(trunk, 'out'), 1))).toBeLessThan(1e-6);
    expect(r.ship.speed).toBe(SHIP.boost);
  });

  // (Review Focus 1: a tab hidden for a minute comes back with a long dt)
  it('ends at the node on a long step, never past it', () => {
    const ship = riding(trunk, 0.9, TIERS.trunk.speed);
    const r = step({ ...enter(ship, { throttle: 1 }), age: SPOOL }, ship, {}, 5);
    expect(r.out).toBe('end');
    expect(r.ride.s).toBe(1);
    expect(dist([r.ship.x, r.ship.y, r.ship.z], bezier(carriageway(trunk, 'out'), 1))).toBeLessThan(1e-6);
  });

  it('drops out with the throttle held back half a second, not a moment', () => {
    const ship = riding(trunk, 0.2);
    const ride = enter(ship, { throttle: 1 });
    expect(go(ride, ship, { throttle: -1 }, 0.3, 0.1).out).toBeNull();
    const r = go(ride, ship, { throttle: -1 }, 0.6, 0.1);
    expect(r.out).toBe('dropped');
    expect(r.ride).toBeNull();
    // (at the speed it had, on the lane's heading: ship.js's drop brings it down)
    expect(r.ship.speed).toBeGreaterThan(SHIP.boost);
  });

  it('drifts across the tube with the stick, held inside it, and drops out pushed past its side', () => {
    const ship = riding(trunk, 0.2);
    const ride = enter(ship, { throttle: 1 });
    const a = go(ride, ship, { turn: 1 }, 0.5);
    expect(a.out).toBeNull();
    expect(a.ride.off[0]).toBeCloseTo(DRIFT * 0.5, 0);
    const b = go(ride, ship, { turn: 1 }, 1.4);
    expect(Math.hypot(...b.ride.off)).toBeLessThanOrEqual(R + 1e-9);
    const c = go(ride, ship, { climb: 1 }, 4);
    expect(c.out).toBe('dropped');
  });

  it('carries straight on through a junction with the throttle forward', () => {
    // a trunk round the ring ends at a beacon another trunk leaves, straight on
    const ship = riding(trunk, 0.99, TIERS.trunk.speed);
    const r = step({ ...enter(ship, { throttle: 1 }), age: SPOOL }, ship, { throttle: 1, next: LANES.find((l) => l.from === trunk.to && l.tier !== 'local')?.id }, 0.5);
    expect(r.out).toBeNull();
    expect(r.ride.lane.id).not.toBe(trunk.id);
  });

  it('poses the ship on the lane: where it is, nose along it', () => {
    const ship = riding(trunk, 0.3);
    const ride = enter(ship, { throttle: 1 });
    const p = poseOf(ride);
    expect(dist([p.x, p.y, p.z], [ship.x, ship.y, ship.z])).toBeLessThan(0.05);
    expect(Math.abs(Math.atan2(Math.sin(p.heading - ship.heading), Math.cos(p.heading - ship.heading)))).toBeLessThan(0.01);
  });
});

describe('the pilots joining at the regions’ beacons (ship.js)', () => {
  it('starts some new ships 60 off a region’s beacon, facing it', () => {
    const hubs = STARTS.filter((s) => s.id.startsWith('beacon:'));
    expect(hubs.length).toBe(REGIONS.length - 1);
    for (const h of hubs) expect(h.d).toBe(60);
    const i = STARTS.indexOf(hubs[2]);
    const seq = [(i + 0.5) / STARTS.length, 0.25];
    const at = startAt(() => seq.shift() ?? 0.5);
    expect(Math.hypot(at.x - hubs[2].at[0], at.z - hubs[2].at[2])).toBeCloseTo(60, 6);
  });
});
