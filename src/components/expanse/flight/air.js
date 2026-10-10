// The ships in a planet's air: each flies its cell's route (lib/land/flight/
// routes.js), its place along it set by the visit's clock, so a cell let go
// of and loaded again finds its traffic where it would have been. Banked by
// the turn. A guard's route (`scramble: { r, n }`) sends its n ships nearest
// you after you when you come within r of what it guards: they turn on you
// at a hunter's rate (universe/hunterRules.js's turnToward), fire in bursts
// by the galaxy's rules (galaxy/surface/hostiles.js) when you're ahead of
// them and in range, give up once you've been out of r for CALM seconds,
// fly back to where their route has got to, and take it up again. Pure: no
// three.js.
//
//   prepareRoute(route) → route with `cum` (the distance to each point) for pointAt
//   pointAt(route, u, out) → out: { x, y, z, yaw, pitch, roll } at u (0…1 of the loop)
//   placeAir(actor, t) puts a ship on its route at the clock's t
//   airBrain(actor) → { step(ctx, dt) → intent }: the route, or a scramble
//     (it sets actor.fly(actor, dt, t, ship, field) while off its route)

import { turnToward } from '../../universe/hunterRules';
import { startBurst, stepBurst } from '../../galaxy/surface/hostiles';

const BANK = 0.9; // radians of roll at the tightest turn a route has

export function prepareRoute(route) {
  if (route.cum) return route;
  const pts = route.points;
  const cum = [0];
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i % pts.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  route.cum = cum;
  route.length = cum[cum.length - 1];
  return route;
}

// where u (0…1) of the way round the loop is, and which way it faces there
export function pointAt(route, u, out = {}) {
  prepareRoute(route);
  const { points, cum, length } = route;
  const d = (((u % 1) + 1) % 1) * length;
  let i = 0;
  while (i < points.length - 1 && cum[i + 1] < d) i++;
  const a = points[i];
  const b = points[(i + 1) % points.length];
  const c = points[(i + 2) % points.length];
  const seg = cum[i + 1] - cum[i] || 1;
  const k = (d - cum[i]) / seg;
  out.x = a[0] + (b[0] - a[0]) * k;
  out.y = a[1] + (b[1] - a[1]) * k;
  out.z = a[2] + (b[2] - a[2]) * k;
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  // (the flight's yaw: 0 is nose down −z, flightRules.js's)
  out.yaw = Math.atan2(-dx, -dz);
  out.pitch = Math.atan2(b[1] - a[1], Math.hypot(dx, dz) || 1);
  // bank into the coming turn, more the nearer the corner
  const turn = Math.atan2(-(c[0] - b[0]), -(c[2] - b[2])) - out.yaw;
  out.roll = Math.atan2(Math.sin(turn), Math.cos(turn)) * BANK * k;
  return out;
}

export function placeAir(actor, t) {
  const r = actor.route;
  const u = actor.t0 + (t * actor.speed) / (r.length || 1);
  actor.u = u;
  pointAt(r, u, actor.b);
}

export const CALM = 20; // s out of range before a scramble gives up
export const COOL = 30; // s after it's back before it scrambles again
export const HUNT = { turn: 1.1, speed: 1.25, floor: 40, cone: 0.96 }; // rad/s, × its route speed, m over the ground, the cosine it fires inside

const unit3 = (x, y, z) => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};

// off the route: after the ship, or back to where the route has got to
function flyOff(a, dt, t, ship, field) {
  const goal = a.mode === 'hunt' && ship ? [ship.x, ship.y, ship.z] : (pointAt(a.route, a.t0 + (t * a.speed) / (a.route.length || 1), a.goal), [a.goal.x, a.goal.y, a.goal.z]);
  const w = unit3(goal[0] - a.b.x, goal[1] - a.b.y, goal[2] - a.b.z);
  turnToward(a.dir, w, HUNT.turn * dt);
  const v = a.speed * HUNT.speed;
  a.b.x += a.dir[0] * v * dt;
  a.b.y += a.dir[1] * v * dt;
  a.b.z += a.dir[2] * v * dt;
  const floor = field.heightAt(a.b.x, a.b.z) + HUNT.floor;
  if (a.b.y < floor) {
    a.b.y = floor;
    a.dir[1] = Math.max(0, a.dir[1]);
  }
  a.b.yaw = Math.atan2(-a.dir[0], -a.dir[2]);
  a.b.pitch = Math.asin(Math.max(-1, Math.min(1, a.dir[1])));
  a.b.roll = 0;
  if (a.mode === 'back' && Math.hypot(goal[0] - a.b.x, goal[1] - a.b.y, goal[2] - a.b.z) < 60) {
    a.mode = 'route';
    a.fly = null;
    a.cool = COOL;
  }
}

export function airBrain(actor) {
  const s = actor.route?.scramble;
  const h = actor.route?.hostile ?? actor.row?.hostile ?? { range: 600 };
  actor.mode = 'route';
  actor.cool = 0;
  actor.goal = {};
  let out = 0; // s the ship has been out of range
  let burst = null;
  return {
    step(ctx, dt) {
      actor.cool = Math.max(0, actor.cool - dt);
      if (!s || !ctx.ship) return { mode: actor.mode };
      const ship = ctx.ship;
      const near = Math.hypot(ship.x - actor.route.anchor[0], ship.z - actor.route.anchor[1]) < s.r;
      if (actor.mode === 'route') {
        if (!near || actor.cool > 0) return { mode: 'route' };
        // the n of the route's ships nearest the ship go; the rest keep the route
        const order = ctx.mates.filter((m) => m.mode === 'route' || m.mode === 'hunt').sort((p, q) => Math.hypot(p.b.x - ship.x, p.b.z - ship.z) - Math.hypot(q.b.x - ship.x, q.b.z - ship.z));
        const hunting = ctx.mates.filter((m) => m.mode === 'hunt').length;
        if (hunting >= s.n || order.indexOf(actor) >= s.n) return { mode: 'route' };
        actor.mode = 'hunt';
        // (off the way it was flying: the flight's yaw and pitch, nose down −z)
        const p = actor.b.pitch ?? 0;
        actor.dir = unit3(-Math.sin(actor.b.yaw) * Math.cos(p), Math.sin(p), -Math.cos(actor.b.yaw) * Math.cos(p));
        actor.fly = flyOff;
        out = 0;
        return { mode: 'hunt', say: hunting === 0 ? 'Patrol inbound' : null };
      }
      if (actor.mode === 'hunt') {
        out = near ? 0 : out + dt;
        if (out >= CALM) {
          actor.mode = 'back';
          burst = null;
          return { mode: 'back' };
        }
        const to = [ship.x - actor.b.x, ship.y - actor.b.y, ship.z - actor.b.z];
        const d = Math.hypot(...to);
        const ahead = (to[0] * actor.dir[0] + to[1] * actor.dir[1] + to[2] * actor.dir[2]) / (d || 1);
        if (!burst && d < h.range && ahead > HUNT.cone) burst = startBurst(h);
        let fire = null;
        if (burst) {
          const n = stepBurst(burst, dt, h.burst?.gap);
          if (n) fire = { n, at: [ship.x, ship.y, ship.z], damage: h.damage ?? 5 };
          if (burst.left <= 0) burst = null;
        }
        return { mode: 'hunt', fire };
      }
      return { mode: actor.mode };
    },
  };
}
