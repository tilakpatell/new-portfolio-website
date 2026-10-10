// What each of a planet's people and animals does, as a brain per role on the
// site's NPC toolkit (src/lib/ai): context steering for the herds, the
// flocks and the wanderers, a stalk-lunge-rest cycle for a predator, a beat
// with stops for a patrol, utility over a settler's few places, and for a
// hostile, the galaxy surface's way of fighting (galaxy/surface/hostiles.js:
// its senses, its bursts and its strafing) weighed by utility over hold,
// strafe, burst and retreat. A brain is asked now and then (the life
// streamer's budget), and says where to head and how fast; the streamer
// moves the body every frame along it. Pure: no three.js.
//
//   brainFor(actor) → { step(ctx, dt) → intent } | null (a ship's: air.js)
//     actor: { id, role, row, b: { x, y, z, yaw }, home: [x, z] }
//     ctx: { ship: { x, y, z } | null, shipAlt, mates: actors, prey(actor) → actor | null, rand, t }
//     intent: { dir: { x, z }, speed, mode, fire?: { n, at: [x, y, z], damage } }

import { clear, createContext, flee, interest, resolve, seek, separate } from '../../../lib/ai/steer';
import { consider, pick } from '../../../lib/ai/utility';
import { belief, sense } from '../../../lib/ai/perception';
import { sensesFor, startBurst, stepBurst, strafeStep } from '../../galaxy/shared/fight';

export const FLEE = { alt: 60, reach: 220 }; // a ship this low and this near puts a herd to flight
export const PACE = { graze: 0.7, walk: 1.4, run: 9, stalk: 2.2, lunge: 13, fly: 9, walker: 3 };
const REST = 8; // s a predator rests after a lunge
const LUNGE = 18; // m: near enough to lunge

const P = (x, z) => ({ x, y: 0, z });
const at = (a) => P(a.b.x, a.b.z);
const still = (mode) => ({ dir: { x: 0, z: 0 }, speed: 0, mode });
const steerTo = (ctx, mode, speed) => {
  const r = resolve(ctx);
  return r.strength > 0 ? { dir: { x: r.dir.x, z: r.dir.z }, speed, mode } : still(mode);
};
const near = (ship, a, reach) => ship && Math.hypot(ship.x - a.b.x, ship.z - a.b.z) < reach;

// a herd: together, apart enough, grazing a slow way about home; off at a run from a ship that comes in low
function herd(actor) {
  const sc = createContext(12);
  let wander = actor.b.yaw;
  return {
    step(ctx, dt) {
      clear(sc);
      const me = at(actor);
      const scared = ctx.ship && ctx.shipAlt < FLEE.alt && near(ctx.ship, actor, FLEE.reach);
      separate(sc, me, ctx.mates.filter((m) => m !== actor).map(at), 4);
      if (scared) {
        flee(sc, me, P(ctx.ship.x, ctx.ship.z), 1);
        return steerTo(sc, 'flee', PACE.run);
      }
      // (back toward the herd's middle, more the further out)
      const mid = ctx.mates.reduce((s, m) => ({ x: s.x + m.b.x / ctx.mates.length, z: s.z + m.b.z / ctx.mates.length }), { x: 0, z: 0 });
      const out = Math.hypot(mid.x - me.x, mid.z - me.z);
      if (out > 8) seek(sc, me, P(mid.x, mid.z), Math.min(1, out / 30));
      const home = Math.hypot(actor.home[0] - me.x, actor.home[1] - me.z);
      if (home > (actor.row.spread ?? 30) * 2) seek(sc, me, P(actor.home[0], actor.home[1]), 0.8);
      wander += (ctx.rand() - 0.5) * dt;
      interest(sc, { x: Math.sin(wander), z: Math.cos(wander) }, 0.35);
      return ctx.rand() < 0.3 ? still('graze') : steerTo(sc, 'graze', PACE.graze);
    },
  };
}

// a predator: stalks the nearest of a herd, lunges when near, then rests
function predator(actor) {
  const sc = createContext(12);
  let rest = 0;
  return {
    step(ctx, dt) {
      if (rest > 0) {
        rest -= dt;
        return still('rest');
      }
      const prey = ctx.prey(actor);
      clear(sc);
      const me = at(actor);
      if (!prey) {
        seek(sc, me, P(actor.home[0], actor.home[1]), 0.5);
        interest(sc, { x: Math.sin(actor.b.yaw), z: Math.cos(actor.b.yaw) }, 0.3);
        return steerTo(sc, 'prowl', PACE.walk);
      }
      const d = Math.hypot(prey.b.x - me.x, prey.b.z - me.z);
      seek(sc, me, at(prey), 1);
      if (d < 2) {
        rest = REST;
        return still('rest');
      }
      return steerTo(sc, d < LUNGE ? 'lunge' : 'stalk', d < LUNGE ? PACE.lunge : PACE.stalk);
    },
  };
}

// a patrol: a beat of four stops round home, a look about at each
function patrol(actor, rand0) {
  const r = actor.row.spread ?? 40;
  const turn = rand0 * Math.PI * 2;
  const stops = Array.from({ length: 4 }, (_, i) => [actor.home[0] + Math.cos(turn + (i * Math.PI) / 2) * r, actor.home[1] + Math.sin(turn + (i * Math.PI) / 2) * r]);
  let next = 0;
  let look = 0;
  const pace = actor.row.body === 'walker' ? PACE.walker : PACE.walk;
  return {
    step(ctx, dt) {
      if (look > 0) {
        look -= dt;
        return still('look');
      }
      const [x, z] = stops[next];
      const d = Math.hypot(x - actor.b.x, z - actor.b.z);
      if (d < 2) {
        next = (next + 1) % stops.length;
        look = 2 + ctx.rand() * 3;
        return still('look');
      }
      return { dir: { x: (x - actor.b.x) / d, z: (z - actor.b.z) / d }, speed: pace, mode: 'beat' };
    },
  };
}

// a settler: weighs going about its work, stopping a while, and a word with
// the others (utility, a little momentum so it doesn't flit)
const SETTLER = [
  { id: 'work', weight: 1, considerations: [(c) => consider(c.since, [0, 20])] },
  { id: 'rest', weight: 0.8, considerations: [(c) => consider(c.since, [0, 12]), (c) => consider(c.walked, [0, 40])] },
  { id: 'gather', weight: 0.6, considerations: [(c) => (c.mates > 1 ? 1 : 0), (c) => consider(c.apart, [3, 20])] },
];
function settler(actor, rand0) {
  let mode = 'rest';
  let since = 10 + rand0 * 10;
  let walked = 0;
  let goal = null;
  return {
    step(ctx, dt) {
      since += dt;
      const mid = ctx.mates.reduce((s, m) => [s[0] + m.b.x / ctx.mates.length, s[1] + m.b.z / ctx.mates.length], [0, 0]);
      const choice = pick(SETTLER, { since, walked, mates: ctx.mates.length, apart: Math.hypot(mid[0] - actor.b.x, mid[1] - actor.b.z) }, { current: mode, momentum: 0.3 });
      if (choice && choice.id !== mode) {
        mode = choice.id;
        since = 0;
        walked = 0;
        const r = actor.row.spread ?? 30;
        const a = ctx.rand() * Math.PI * 2;
        goal = mode === 'work' ? [actor.home[0] + Math.cos(a) * r, actor.home[1] + Math.sin(a) * r] : mode === 'gather' ? mid : null;
      }
      if (!goal) return still(mode);
      const d = Math.hypot(goal[0] - actor.b.x, goal[1] - actor.b.z);
      if (d < 1.5) return still(mode);
      walked += PACE.walk * dt;
      return { dir: { x: (goal[0] - actor.b.x) / d, z: (goal[1] - actor.b.z) / d }, speed: PACE.walk, mode };
    },
  };
}

// a hostile: perceives the ship (hostiles.js's senses), then holds, strafes
// round where it believes the ship is, fires a burst, or backs off when
// it's on top of it
const HOSTILE = [
  { id: 'hold', weight: 0.4, considerations: [() => 1] },
  { id: 'strafe', weight: 1, considerations: [(c) => consider(c.sure, [0.2, 0.6]), (c) => (c.d < c.range * 1.5 ? 1 : 0)] },
  { id: 'burst', weight: 1.4, considerations: [(c) => consider(c.sure, [0.4, 0.8]), (c) => (c.d < c.range ? 1 : 0), (c) => consider(c.since, [1.5, 3])] },
  { id: 'retreat', weight: 1.2, considerations: [(c) => (c.d < c.range * 0.2 ? 1 : 0)] },
];
function hostile(actor) {
  const h = actor.row.hostile ?? { range: 200 };
  const senses = sensesFor(h);
  const me = { pos: { x: actor.b.x, y: actor.b.y, z: actor.b.z }, dir: { x: Math.sin(actor.b.yaw), y: 0, z: Math.cos(actor.b.yaw) }, beliefs: {} };
  let mode = 'hold';
  let since = 10;
  let burst = null;
  return {
    step(ctx, dt) {
      since += dt;
      me.pos = { x: actor.b.x, y: actor.b.y, z: actor.b.z };
      me.dir = { x: Math.sin(actor.b.yaw), y: 0, z: Math.cos(actor.b.yaw) };
      const targets = ctx.ship ? [{ id: 'ship', at: { x: ctx.ship.x, y: ctx.ship.y, z: ctx.ship.z }, hostile: true }] : [];
      sense(senses, me, { targets }, dt);
      const b = belief(me, 'ship');
      const d = b ? Math.hypot(b.at.x - actor.b.x, b.at.y - actor.b.y, b.at.z - actor.b.z) : Infinity;
      const choice = pick(HOSTILE, { sure: b?.confidence ?? 0, d, range: h.range, since }, { current: mode, momentum: 0.2 });
      mode = choice?.id ?? 'hold';
      let fire = null;
      if (mode === 'burst' && !burst) {
        burst = startBurst(h);
        since = 0;
      }
      if (burst) {
        const n = stepBurst(burst, dt, h.burst?.gap);
        if (n > 0 && b) fire = { n, at: [b.at.x, b.at.y, b.at.z], damage: h.damage ?? 4 };
        if (burst.left <= 0) burst = null;
      }
      if (!b || mode === 'hold' || mode === 'burst') return { ...still(mode), face: b ? Math.atan2(b.at.x - actor.b.x, b.at.z - actor.b.z) : null, fire };
      if (mode === 'retreat') {
        const k = Math.hypot(actor.b.x - b.at.x, actor.b.z - b.at.z) || 1;
        return { dir: { x: (actor.b.x - b.at.x) / k, z: (actor.b.z - b.at.z) / k }, speed: PACE.run * 0.6, mode, fire };
      }
      // (round the ship's ground point, the way hostiles.js strafes you)
      const to = strafeStep({ x: actor.b.x, z: actor.b.z }, { x: b.at.x, z: b.at.z }, { strafe: { ...h.strafe, speed: 1 } }, 1, ctx.t);
      const k = Math.hypot(to.x - actor.b.x, to.z - actor.b.z) || 1;
      return { dir: { x: (to.x - actor.b.x) / k, z: (to.z - actor.b.z) / k }, speed: h.strafe?.speed ?? 3, mode, fire, face: to.yaw };
    },
  };
}

// a wanderer: a slow, turning walk that keeps near home
function wander(actor) {
  const sc = createContext(12);
  let heading = actor.b.yaw;
  return {
    step(ctx, dt) {
      clear(sc);
      const me = at(actor);
      heading += (ctx.rand() - 0.5) * 2 * dt;
      interest(sc, { x: Math.sin(heading), z: Math.cos(heading) }, 0.6);
      const home = Math.hypot(actor.home[0] - me.x, actor.home[1] - me.z);
      if (home > (actor.row.spread ?? 30) * 2) seek(sc, me, P(actor.home[0], actor.home[1]), 1);
      return ctx.rand() < 0.2 ? still('pause') : steerTo(sc, 'wander', PACE.walk);
    },
  };
}

// a flock: a herd's rules in the air (cohesion, separation, a wandering way), lifted over the ground
function flock(actor) {
  const sc = createContext(16);
  let heading = actor.b.yaw;
  return {
    step(ctx, dt) {
      clear(sc);
      const me = at(actor);
      separate(sc, me, ctx.mates.filter((m) => m !== actor).map(at), 5);
      const mid = ctx.mates.reduce((s, m) => ({ x: s.x + m.b.x / ctx.mates.length, z: s.z + m.b.z / ctx.mates.length }), { x: 0, z: 0 });
      if (Math.hypot(mid.x - me.x, mid.z - me.z) > 10) seek(sc, me, P(mid.x, mid.z), 0.7);
      if (Math.hypot(actor.home[0] - me.x, actor.home[1] - me.z) > 400) seek(sc, me, P(actor.home[0], actor.home[1]), 1);
      heading += (ctx.rand() - 0.5) * dt;
      interest(sc, { x: Math.sin(heading), z: Math.cos(heading) }, 0.8);
      if (ctx.ship && near(ctx.ship, actor, 120)) flee(sc, me, P(ctx.ship.x, ctx.ship.z), 1);
      return steerTo(sc, 'fly', PACE.fly);
    },
  };
}

const ROLES = { herd, predator, patrol, settler, hostile, wander, flock };

export function brainFor(actor, rand0 = 0.5) {
  const make = ROLES[actor.role];
  return make ? make(actor, rand0) : null;
}
