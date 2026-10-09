// The seven states every fighting figure has (mind.js runs them), generic:
// what they need of the world comes through the blackboard, so the file
// stays pure and a world fills in its own. patrol walks `bb.route` (its
// index in `bb.at`); search goes to `bb.lastSeen` and gives up after
// `bb.searchFor` seconds; chase runs at `bb.target.at` and attacks once
// `bb.inReach(bb, w)` says so; attack is the world's own `bb.attack(bb,
// w, dt)` (a duellist's duel.js step, a shooter's hold); stunned holds
// still for `bb.stun` seconds (set by the struck interrupt) then goes to
// `bb.after` or chase; flee runs from the target until `bb.hp` is back
// over `bb.fleeUntil`; dead is final. Every tick reads `bb.pos` ({ x, z },
// the body's, which the world writes each frame) and `bb.pace` ({ walk,
// run } m/s).
//
//   STATES: mind.js's table; a world spreads its own rows over it.

import { IDLE } from './mind';

const NEAR = 0.3; // m: at a waypoint
const toward = (from, to, speed) => {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return { vel: { x: 0, z: 0 }, face: null, d };
  return { vel: { x: (dx / d) * speed, z: (dz / d) * speed }, face: Math.atan2(dx, dz), d };
};
const walk = (bb, to, speed, mode) => {
  const t = toward(bb.pos, to, speed);
  return { ...IDLE, vel: t.vel, face: t.face, mode };
};
const still = (mode, face = null) => ({ ...IDLE, face, mode });
const target = (bb) => bb.target?.at ?? null;

export const STATES = {
  patrol: {
    tick(bb) {
      const route = bb.route;
      if (!route?.length) return still('hold');
      bb.at = (bb.at ?? 0) % route.length;
      const goal = route[bb.at];
      if (toward(bb.pos, goal, 1).d < NEAR) {
        bb.at = (bb.at + 1) % route.length;
        return walk(bb, route[bb.at], bb.pace.walk, 'patrol');
      }
      return walk(bb, goal, bb.pace.walk, 'patrol');
    },
  },
  search: {
    enter(bb) {
      bb.searchUntil = bb.clock + (bb.searchFor ?? 6);
    },
    tick(bb) {
      if (bb.clock >= bb.searchUntil) return { to: 'patrol' };
      const at = bb.lastSeen ?? target(bb);
      if (!at || toward(bb.pos, at, 1).d < NEAR) return still('search');
      return walk(bb, at, bb.pace.walk, 'search');
    },
  },
  chase: {
    tick(bb, w) {
      const at = target(bb);
      if (!at) return { to: 'search' };
      if (bb.inReach?.(bb, w)) return { to: 'attack' };
      return walk(bb, at, bb.pace.run, 'chase');
    },
  },
  attack: {
    tick(bb, w, dt) {
      const at = target(bb);
      if (!at) return { to: 'search' };
      if (!bb.inReach?.(bb, w)) return { to: 'chase' };
      if (bb.attack) return bb.attack(bb, w, dt) ?? still('attack');
      return { ...still('attack', toward(bb.pos, at, 1).face), act: 'strike' };
    },
  },
  stunned: {
    enter(bb) {
      bb.until = bb.clock + (bb.stun ?? 0.3);
    },
    tick(bb) {
      if (bb.clock >= bb.until) return { to: bb.after ?? 'chase' };
      return still('stunned');
    },
  },
  flee: {
    tick(bb) {
      if (bb.hp > (bb.fleeUntil ?? 0)) return { to: 'chase' };
      const at = target(bb);
      if (!at) return still('flee');
      const t = toward(at, bb.pos, bb.pace.run);
      return { ...IDLE, vel: t.vel, face: t.face, mode: 'flee' };
    },
  },
  dead: {
    enter(bb) {
      bb.dead = true;
    },
    tick: () => still('dead'),
  },
};
