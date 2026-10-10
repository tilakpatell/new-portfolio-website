// A blast by the game's numbers: a projectiles.json row's `blast`
// (ExplosionEntityData's InnerBlastRadius, BlastRadius, BlastImpulse,
// ShockwaveRadius, ShockwaveImpulse) shoves every body of a physics world
// (lib/physics/world.js) that stands in its radius, along the line from
// the blast, the whole impulse inside the inner radius and falling to none
// at the edge; and kicks every ragdoll in the shockwave's radius by the
// shockwave's impulse the same way. A body behind something solid (the
// world's ray from the blast to its centre meets another collider first)
// takes nothing, unless the row turns occlusion off (DisableOcclusion).
// What it hit comes back for the damage path (`row.blast.damage`).
//
//   falloff(d, inner, radius) → 0…1
//   applyBlast(physics, at, row, { occlusion = row.blast.occlusion, bodies,
//     ragdolls = [], ray }) → { hit: [{ body, impulse, distance }],
//     kicked: [{ ragdoll, impulse, distance }] }
//     bodies: world Bodies (default: every awake one); ragdolls: [{ centre
//     ([x, y, z] or () → [x, y, z]), kick([ix, iy, iz] N·s) }] (ragdoll2017's);
//     ray(a, b, exclude) → { at, body } | null (default: segmentRay(physics))
//   segmentRay(physics) → (a, b, exclude?) → { at, normal, body } | null:
//     the first collider along a → b in the world (exclude: a Body whose own
//     colliders the ray passes through); in bolt.js's world.solids form, the
//     ray a bolt flies against until lane P0's level world gives its own
// Plain [x, y, z] arrays; the engine only through the world it is given.

const EPS = 1e-6;
const LIFT = 0.05; // m: a ray leaves the blast this far along its line (off the wall it went off against)

export function falloff(d, inner = 0, radius = 0) {
  if (!(radius > 0) || d >= radius) return 0;
  if (d <= inner) return 1;
  return (radius - d) / Math.max(EPS, radius - inner);
}

export function segmentRay(physics) {
  const { RAPIER, world } = physics;
  return (a, b, exclude = null) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len = Math.hypot(d[0], d[1], d[2]);
    if (len < EPS) return null;
    const ray = new RAPIER.Ray({ x: a[0], y: a[1], z: a[2] }, { x: d[0] / len, y: d[1] / len, z: d[2] / len });
    const hit = world.castRayAndGetNormal(ray, len, true, undefined, undefined, undefined, exclude?.body ?? undefined);
    if (!hit) return null;
    const t = hit.timeOfImpact;
    const at = [a[0] + (d[0] / len) * t, a[1] + (d[1] / len) * t, a[2] + (d[2] / len) * t];
    return { at, normal: [hit.normal.x, hit.normal.y, hit.normal.z], body: hit.collider.parent()?.userData ?? null };
  };
}

const centreOf = (r) => (typeof r.centre === 'function' ? r.centre() : r.centre);

export function applyBlast(physics, at, row, { occlusion = row?.blast?.occlusion ?? true, bodies = null, ragdolls = [], ray = null } = {}) {
  const out = { hit: [], kicked: [] };
  const b = row?.blast;
  if (!b) return out;
  const inner = b.inner ?? 0;
  const look = occlusion ? (ray ?? segmentRay(physics)) : null;
  // the line from the blast to p, unit, and how far (straight up when p is on the blast)
  const line = (p) => {
    const d = [p[0] - at[0], p[1] - at[1], p[2] - at[2]];
    const l = Math.hypot(d[0], d[1], d[2]);
    return l < EPS ? { dir: [0, 1, 0], l: 0 } : { dir: [d[0] / l, d[1] / l, d[2] / l], l };
  };
  // something solid between the blast and p (a Body's own colliders don't count)
  const hidden = (p, dir, l, self) => {
    if (!look || l < 2 * LIFT) return false;
    const from = [at[0] + dir[0] * LIFT, at[1] + dir[1] * LIFT, at[2] + dir[2] * LIFT];
    const h = look(from, p, self);
    return !!h && h.body !== self;
  };
  let list = bodies;
  if (!list) {
    list = [];
    physics.awake((body) => list.push(body));
  }
  const pos = [0, 0, 0];
  for (const body of list) {
    if (body.removed) continue;
    const p = body.position(pos).slice();
    const { dir, l } = line(p);
    const f = falloff(l, inner, b.radius);
    if (f <= 0 || !(b.impulse > 0) || hidden(p, dir, l, body)) continue;
    const j = b.impulse * f;
    body.push([dir[0] * j, dir[1] * j, dir[2] * j]);
    out.hit.push({ body, impulse: j, distance: l });
  }
  for (const r of ragdolls) {
    const p = centreOf(r);
    if (!p) continue;
    const { dir, l } = line(p);
    const f = falloff(l, inner, b.shockRadius);
    if (f <= 0 || !(b.shockImpulse > 0) || hidden(p, dir, l, null)) continue;
    const j = b.shockImpulse * f;
    r.kick([dir[0] * j, dir[1] * j, dir[2] * j]);
    out.kicked.push({ ragdoll: r, impulse: j, distance: l });
  }
  return out;
}
