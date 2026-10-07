import { describe, expect, it } from 'vitest';
import { laneAim, laneFrame, lanePlan, rideInput, rideLine } from './lanePilot';
import { nodeById, routeTo, carriageway } from './hyperlanes';
import { tangent } from './lanes';
import { SHIP, autopilot, orbiting, parkAt, spawn, step } from './ship';
import { HOME_RADIUS, ORDER, POSITIONS } from './layout';
import { byId } from './universes';

const homeEdge = () => spawn(null);
const fandoms = ORDER.filter((id) => byId(id).kind !== 'core');
const furthest = fandoms.reduce((a, b) => (Math.hypot(POSITIONS[a][0], POSITIONS[a][2]) > Math.hypot(POSITIONS[b][0], POSITIONS[b][2]) ? a : b));

// the scene's fly(), as far as the lanes go: the ride's frame first (getting
// on, riding, getting off), else the autopilot (to the next ramp, or the
// place) and ship.js's step
function trip(id, { limit = 90, drop = null } = {}) {
  let ship = homeEdge();
  let auto = lanePlan(ship, id, parkAt(id, [ship.x, ship.z]));
  let ride = null;
  const log = { rides: 0, ons: 0, outs: [], hits: 0, arrived: false, t: 0, top: 0 };
  for (let t = 0; t < limit; t += 1 / 60) {
    log.t = t;
    let input = { throttle: 0 };
    if (!ride && auto) {
      const aim = laneAim(auto);
      const a = autopilot(ship, aim?.id ?? auto.id, aim?.park ?? auto.park, aim?.space, aim ? 1 : (auto.od ?? 1));
      input = a.input;
      if (a.done && !aim) {
        log.arrived = true;
        break;
      }
    }
    if (drop && ride && t > drop) input = { throttle: -1 };
    const lane = laneFrame({ ride, auto, ship }, input, 1 / 60, { canEnter: !auto || Boolean(auto.route) });
    if (lane) {
      if (lane.on) log.ons++;
      if (lane.out) log.outs.push(lane.out);
      ride = lane.ride;
      auto = lane.auto;
    }
    if (lane?.ship) ship = lane.ship;
    else {
      const r = step(ship, input, 1 / 60);
      ship = r.ship;
      log.hits += r.events.filter((e) => e.type === 'crash' || e.type === 'bump').length;
    }
    if (ride) log.rides++;
    log.top = Math.max(log.top, ship.speed);
  }
  return { ship, auto, ride, log };
}

describe('the autopilot on the lanes (lanePilot.js)', () => {
  it('plans a trip by the lanes, and none where free flight is quicker', () => {
    const at = homeEdge();
    const plan = lanePlan(at, 'middleearth', parkAt('middleearth', [at.x, at.z]));
    expect(plan.route.legs.length).toBeGreaterThanOrEqual(3);
    expect(plan.leg).toBe(0);
    const home = { ...parkAt('home'), speed: 0 };
    expect(lanePlan(home, 'projects', parkAt('projects'))).toBeNull();
  });

  it('aims at the first ramp, parked in its ring facing out along the lane', () => {
    const at = homeEdge();
    const plan = lanePlan(at, 'middleearth', parkAt('middleearth', [at.x, at.z]));
    const aim = laneAim(plan);
    const ride = plan.route.legs[1];
    const node = nodeById(ride.way === 'out' ? ride.lane.from : ride.lane.to);
    expect(aim.id).toBe(node.id);
    expect([aim.park.x, aim.park.y, aim.park.z]).toEqual(node.at);
    const d = tangent(carriageway(ride.lane, ride.way), 0);
    expect(aim.park.heading).toBeCloseTo(Math.atan2(-d[0], -d[2]), 9);
    expect(aim.space.goals[node.id]).toBeTruthy();
    // (and on the last leg it's the autopilot of today's: nothing to aim at)
    expect(laneAim({ ...plan, leg: plan.route.legs.length - 1 })).toBeNull();
  });

  it('carries on through a junction to the next ride, and slows for the last', () => {
    const at = homeEdge();
    const plan = lanePlan(at, furthest, parkAt(furthest, [at.x, at.z]));
    expect(rideInput({ ...plan, leg: 1 })).toEqual({ throttle: 1, next: plan.route.legs[2].lane.id });
    expect(rideInput({ ...plan, leg: plan.route.legs.length - 2 })).toEqual({ throttle: 0 });
  });

  it('flies the whole trip: to the ramp, on, rides, off, and parks at the place, quicker than the route says and a bit', () => {
    const plan = routeTo(homeEdge(), 'middleearth');
    const r = trip('middleearth');
    expect(r.log.ons).toBe(1);
    expect(r.log.outs).toEqual(['end']);
    expect(r.log.hits).toBe(0);
    expect(r.log.arrived).toBe(true);
    expect(orbiting(r.ship, null)).toBe('middleearth');
    expect(r.log.top).toBeGreaterThan(SHIP.pulse * 3);
    expect(r.log.t).toBeLessThan(plan.time + 25);
  }, 20000);

  it('flies to the furthest world in under a minute', () => {
    const r = trip(furthest);
    expect(r.log.arrived).toBe(true);
    expect(r.log.hits).toBe(0);
    expect(r.log.t).toBeLessThan(60);
  }, 20000);

  it('drops out with the throttle held back, and the autopilot flies on free', () => {
    const r = trip('middleearth', { drop: 9, limit: 12 });
    expect(r.log.outs).toEqual(['dropped']);
    expect(r.ride).toBeNull();
    expect(r.auto.route).toBeNull();
    expect(r.auto.id).toBe('middleearth');
  }, 20000);

  it('leaves a hand-flown ship alone unless it flies into a lane', () => {
    const ship = { ...homeEdge(), z: HOME_RADIUS + 3000 };
    expect(laneFrame({ ride: null, auto: null, ship }, { throttle: 1 }, 1 / 60, { canEnter: true })).toBeNull();
  });

  it('says on the HUD which lane, where to and how soon', () => {
    const at = homeEdge();
    const leg = lanePlan(at, 'middleearth', parkAt('middleearth', [at.x, at.z])).route.legs.find((l) => l.kind === 'trunk' || l.lane?.tier === 'trunk');
    const line = rideLine({ lane: leg.lane, way: leg.way, s: 0.5, speed: 1500 });
    expect(line.name).toBe(leg.lane.name);
    expect(line.tier).toBe('trunk');
    expect(line.next.length).toBeGreaterThan(2);
    expect(line.eta).toBeCloseTo((0.5 * leg.lane.length) / 1500, 6);
  });
});
