// The lock-on: a toggle (a Lock button on touch, Tab on a keyboard) that
// keeps the camera turned onto the one you're squared up to. On a coarse
// pointer it comes on by itself when a hostile comes within `near`, and
// goes off when there's none; a choice made by hand stands till the fight
// it was made in is over (with no fight, till it's changed), so the next
// fight starts from the default.
// Pure: no React, no three.js; each world turns its own camera.
//
//   createLockOn({ coarse }) → { on, toggle() → on, step({ near }) → on }
//     `near`: how far the nearest hostile is (m), Infinity for none.
//   turnTo(from, to, dt, rate) → a heading eased toward another, the short way.
//   yawToward(at, to, forward) → the heading whose forward points from `at`
//     to `to` ({ x, z }s), in a world's own convention: `forward(yaw)` → [x, z].

export const LOCK_ON = { near: 14, turn: 8 };

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createLockOn({ coarse = false } = {}) {
  let on = false;
  let byHand = null; // (the choice made by hand, kept till a fight ends)
  let fighting = false;
  return {
    get on() {
      return on;
    },
    toggle() {
      on = !on;
      byHand = on;
      return on;
    },
    step({ near = Infinity } = {}) {
      const now = Number.isFinite(near);
      if (fighting && !now) byHand = null;
      fighting = now;
      if (byHand != null) on = byHand;
      else on = coarse && near <= LOCK_ON.near;
      return on;
    },
  };
}

export function turnTo(from, to, dt, rate = LOCK_ON.turn) {
  return from + wrap(to - from) * Math.min(1, dt * rate);
}

export function yawToward(at, to, forward) {
  const angle = (v) => Math.atan2(v[1], v[0]);
  const a0 = angle(forward(0));
  const s = wrap(angle(forward(Math.PI / 2)) - a0) < 0 ? -1 : 1;
  return wrap((angle([to.x - at.x, to.z - at.z]) - a0) * s);
}
