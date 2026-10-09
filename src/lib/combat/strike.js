// A strike: a blade (or a fist, a bite) swept over its motion inside its
// clip's contact window, as a Rapier shape cast against the hurtboxes
// (lib/physics/queries.js's sweep), so a fast stroke never steps over
// anyone and a body is hit once a stroke by construction (the victims hit
// are passed over on the next casts). A step whose pose didn't move still
// asks (a resting overlap: hit-stop, a paused clip). Blade on blade is not
// a hurtbox hit but a clash, which blade.js's segment maths decides from
// the two strikes' latest frames. Pure.
//
//   createStrike({ id, owner (a Body), r = 0.12, damage, kind = 'light', window: [t0, t1], groups = hurtboxes })
//     → s: { id, owner, hits (a Set of victim Bodies), t, done, blade (blade.js's, this strike's frames) }
//   stepStrike(s, q, pose, dt) → [{ victim, tag, at, dir, toi }]
//     pose: { prev: { base, tip }, now: { base, tip } } (world [x, y, z]); q: queries.js's
//     dir: the tip's motion, unit (the blade's own axis when it didn't move)
//   clashOf(a, b) → { at } | null  (two strikes' blades crossing)

import { capsuleBetween } from '../physics/hurtbox';
import { filterOf } from '../physics/groups';
import { createBlade } from './blade';

const HURT = filterOf('hurtbox');
const STILL = 1e-3;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l > 1e-9 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0];
};

export function createStrike({ id, owner, r = 0.12, damage, kind = 'light', window, groups = HURT }) {
  return { id, owner, r, damage, kind, window, groups, hits: new Set(), t: 0, done: false, blade: createBlade({ r }) };
}

export function stepStrike(s, q, pose, dt) {
  const was = s.t;
  s.t += dt;
  s.blade.push(pose.now.base, pose.now.tip, s.t);
  if (s.done) return [];
  const [t0, t1] = s.window;
  const inside = s.t >= t0 && was < t1; // (the step touched the window)
  if (s.t >= t1) s.done = true;
  if (!inside) return [];
  const cap = capsuleBetween(pose.now.base, pose.now.tip, [0, 0, 0], [0, 0, 0, 1]);
  const before = capsuleBetween(pose.prev.base, pose.prev.tip, [0, 0, 0], [0, 0, 0, 1]);
  const shape = { shape: 'capsule', args: [Math.round(cap.halfHeight * 50) / 50, s.r], rotation: cap.rotation };
  const h = q.sweep(shape, before.translation, cap.translation, { groups: s.groups, exclude: s.owner, omit: s.hits });
  if (!h || !h.body || h.body === s.owner) return [];
  s.hits.add(h.body);
  const motion = sub(pose.now.tip, pose.prev.tip);
  const dir = Math.hypot(motion[0], motion[1], motion[2]) < STILL ? unit(sub(pose.now.tip, pose.now.base)) : unit(motion);
  return [{ victim: h.body, tag: h.tag, at: h.at, dir, toi: h.toi }];
}

export const clashOf = (a, b) => a.blade.clash(b.blade);
