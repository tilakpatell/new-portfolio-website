// The eyes: what a brain, a bolt or a blade asks the physics world, as
// plain numbers. A ray (a line of sight, a bolt's flight, the floor under
// a point), a sweep (a capsule or ball cast over a motion: a blade's
// stroke, a figure's whisker), an overlap (what a ball at a point holds: a
// Force push, a pound), a floor probe and a point projection (the
// ragdoll's floor). Every one asks the world as it was after its last
// step (Rapier answers nothing before the first), skips sensors unless
// the filter names zones or hurtboxes, and all but `project` spend the budget
// (budget.js): a refused call answers `undefined`, which is not `null`
// (nothing hit), so a caller keeps its last answer instead of seeing
// through a wall. Shapes are built once per size and kept. No three.js.
//
//   createQueries(phys, { budget = createBudget() }) → {
//     ray(from, dir, max, { groups = sight's, exclude, omit, solid = true })
//       → { dist, at, normal, body, tag } | null | undefined
//     sweep(shape, from, to, { groups, exclude, omit }) → { toi (0…1 of from → to), at, normal, body, tag } | null | undefined
//       (shape: { shape: 'capsule' | 'ball', args, rotation? }; a motion under 1 mm is a resting overlap, toi 0)
//     overlap(shape, at, { groups, exclude }) → [{ body, tag }] (empty when refused)
//     floorAt(x, z, { from = 3, down = 6, groups = floor | object }) → { y, normal } | null | undefined
//     project(point, { groups }) → { at, inside } | null (never budgeted)
//     frame() (the next frame's budget), stats() (the budget's)
//   }
//   from, dir, at, to: [x, y, z]; groups: groups.js's filterOf(...); exclude: a Body handle (world.js's);
//   omit: a Set of Body handles to pass over (a strike's victims already hit)
//   body: the Body handle a hit collider belongs to (null for one the world didn't add);
//   tag: the collider's tag (world.js's `tagOf`), or null

import { createBudget } from './budget';
import { MEMBERS, filterOf } from './groups';

const SIGHT = filterOf('floor', 'object', 'character');
const FLOOR = filterOf('floor', 'object');
const STILL = 1e-3; // m: a sweep this short is an overlap
const I = { x: 0, y: 0, z: 0, w: 1 };

export function createQueries(phys, { budget = createBudget() } = {}) {
  const { RAPIER, world } = phys;
  const shapes = new Map();
  const v = { x: 0, y: 0, z: 0 };
  const v2 = { x: 0, y: 0, z: 0 };
  const ray = new RAPIER.Ray(v, v2);
  const bodyOf = (c) => c?.parent()?.userData ?? null;
  const tagOf = (c) => (phys.tagOf ? phys.tagOf(c) : null);
  // (sensors are skipped unless the filter names what is a sensor: a zone, a hurtbox)
  const SENSORS = MEMBERS.zone | MEMBERS.hurtbox;
  const flags = (groups) => (groups & SENSORS ? 0 : RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
  const excluded = (exclude) => exclude?.body ?? undefined;
  const omitting = (omit) => (omit?.size ? (c) => !omit.has(bodyOf(c)) : undefined);
  const shapeOf = (s) => {
    const key = `${s.shape}:${s.args.join(',')}`;
    let made = shapes.get(key);
    if (!made) {
      if (s.shape === 'capsule') made = new RAPIER.Capsule(s.args[0], s.args[1]);
      else if (s.shape === 'ball') made = new RAPIER.Ball(s.args[0]);
      else throw new Error(`physics: no query shape '${s.shape}'`);
      shapes.set(key, made);
    }
    return made;
  };
  const rot = (s) => (s.rotation ? { x: s.rotation[0], y: s.rotation[1], z: s.rotation[2], w: s.rotation[3] } : I);
  const set = (o, a) => {
    o.x = a[0];
    o.y = a[1];
    o.z = a[2];
    return o;
  };

  function cast(from, dir, max, groups, exclude, solid, omit = null) {
    set(ray.origin, from);
    set(ray.dir, dir);
    const h = world.castRayAndGetNormal(ray, max, solid, flags(groups), groups, undefined, excluded(exclude), omitting(omit));
    if (!h) return null;
    const t = h.timeOfImpact;
    return { dist: t, at: [from[0] + dir[0] * t, from[1] + dir[1] * t, from[2] + dir[2] * t], normal: [h.normal.x, h.normal.y, h.normal.z], body: bodyOf(h.collider), tag: tagOf(h.collider) };
  }

  return {
    ray(from, dir, max, { groups = SIGHT, exclude = null, omit = null, solid = true } = {}) {
      if (!budget.take('rays')) return undefined;
      return cast(from, dir, max, groups, exclude, solid, omit);
    },
    sweep(shape, from, to, { groups = SIGHT, exclude = null, omit = null } = {}) {
      if (!budget.take('sweeps')) return undefined;
      const s = shapeOf(shape);
      const motion = set(v2, [to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
      if (Math.hypot(motion.x, motion.y, motion.z) < STILL) {
        let found = null;
        world.intersectionsWithShape(set(v, from), rot(shape), s, (c) => {
          found = c;
          return false;
        }, flags(groups), groups, undefined, excluded(exclude), omitting(omit));
        return found ? { toi: 0, at: [...from], normal: [0, 0, 0], body: bodyOf(found), tag: tagOf(found) } : null;
      }
      const h = world.castShape(set(v, from), rot(shape), motion, s, 0, 1, true, flags(groups), groups, undefined, excluded(exclude), omitting(omit));
      if (!h) return null;
      return { toi: h.time_of_impact, at: [h.witness1.x, h.witness1.y, h.witness1.z], normal: [h.normal1.x, h.normal1.y, h.normal1.z], body: bodyOf(h.collider), tag: tagOf(h.collider) };
    },
    overlap(shape, at, { groups = SIGHT, exclude = null } = {}) {
      const out = [];
      if (!budget.take('overlaps')) return out;
      world.intersectionsWithShape(set(v, at), rot(shape), shapeOf(shape), (c) => {
        out.push({ body: bodyOf(c), tag: tagOf(c) });
        return true;
      }, flags(groups), groups, undefined, excluded(exclude));
      return out;
    },
    floorAt(x, z, { from = 3, down = 6, groups = FLOOR } = {}) {
      if (!budget.take('rays')) return undefined;
      // (not solid: a probe that starts inside a crate finds the ground under it)
      const h = cast([x, from, z], [0, -1, 0], down, groups, null, false);
      return h ? { y: h.at[1], normal: h.normal } : null;
    },
    project(point, { groups = FLOOR } = {}) {
      const r = world.projectPoint(set(v, point), true, flags(groups), groups);
      return r ? { at: [r.point.x, r.point.y, r.point.z], inside: r.isInside } : null;
    },
    frame: () => budget.frame(),
    stats: () => budget.stats(),
  };
}
