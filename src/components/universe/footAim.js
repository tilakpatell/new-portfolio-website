// Where your shot goes on foot (lib/combat/aim.js on the landing's things),
// beside footScene.js, which is past its size. Pure: plain [x, y, z]
// arrays, in the planet's space (footScene's `at`, the map's units).
//
//   footAim({ cam, dir, from, targets, solids, cone, lock, range, min })
//     → { at, target, locked, dist, ray }
//     the camera's ray through the reticle (`cam` its place, `dir` its
//     forward), started level with you (`from`, your chest) so nothing
//     between the camera and your back is aimed at; bent toward a target
//     by the input's cone (aim.js's ASSIST row) and no further; then the
//     first of a trooper (`targets`, foot.js's footBodies capsules) or a
//     solid (foot.js's footSolids) along it. The lock (`lock`, a trooper's
//     id) is preferred while it's inside the cone and ignored outside it:
//     a lock 20° off the reticle doesn't take a mouse's shot. A cone with
//     `snap` (touch: the fire button's tap) goes all the way onto the one
//     it bends to, so a tap within 12° hits. `locked`: the lock is in the
//     cone (the reticle's ring).
//
// The muzzle then flies its bolt to `at`, and the gun in your hands
// points there too, so the reticle, the gun and the bolt agree.

import { aimPoint, assist, snapped } from '../../lib/combat/aim';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// how far off a ray a capsule is, as an angle: the least to its feet, its
// middle or its head (near enough for a cone some degrees wide)
function offAngle(from, dir, t) {
  let best = Infinity;
  for (const k of [0, 0.5, 1]) {
    const p = [t.a[0] + (t.b[0] - t.a[0]) * k, t.a[1] + (t.b[1] - t.a[1]) * k, t.a[2] + (t.b[2] - t.a[2]) * k];
    const to = sub(p, from);
    const l = Math.hypot(to[0], to[1], to[2]);
    if (l < 1e-9) continue;
    best = Math.min(best, Math.acos(Math.max(-1, Math.min(1, dot(dir, to) / l))));
  }
  return best;
}

export function footAim({ cam, dir, from, targets = [], solids = null, cone, lock = null, range = 120, min = 1.5 }) {
  const d = unit(dir);
  const s = Math.max(0, dot(sub(from, cam), d));
  const ray = { from: [cam[0] + d[0] * s, cam[1] + d[1] * s, cam[2] + d[2] * s], dir: d };
  const held = lock != null ? targets.find((t) => t.id === lock) ?? null : null;
  const locked = Boolean(held && cone && offAngle(ray.from, d, held) <= cone.outer);
  // (the lock alone while it's in the cone; else whoever's nearest the line)
  const pool = locked ? [held] : targets;
  // (a snap is the whole pull anywhere in the cone, at once: aim.js's snapped)
  const pull = snapped(cone);
  const bent = pull ? assist(d, ray.from, pool, pull) : d;
  const r = aimPoint({ from: ray.from, dir: bent }, solids, targets, { min, max: range });
  return { at: r.at, target: r.target, locked, dist: r.dist, ray };
}
