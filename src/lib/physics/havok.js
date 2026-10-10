// The game's Havok shapes (a level pack's physics/<mesh>.bin, read by
// readShapes) as bodies in our physics world (world.js), and as the
// walker's boxes where there is no engine (lane P0 of the 2017 physics
// design, docs/superpowers/specs/2026-10-10-bf2017-physics-design.md §1).
//
// A shape is in its mesh's frame; a placed instance is a fixed body at the
// instance's position and rotation. Rapier can't scale a body, so a scale
// that isn't 1 is put into the points (a copy, kept per mesh and scale, so
// three hundred corridor pieces still share theirs); a mirrored instance
// (negative determinant) has its trimeshes' triangles turned round so their
// faces still point out. A hull is at most 64 points (the pack cuts them),
// a trimesh is only ever fixed (world.js refuses a moving one); a hull
// of more is refused here, with a plain message, before the engine sees it
// (here, not in world.js, whose universe hulls come from models uncut). Every
// collider carries the shape's material index as `tag`, so a hit can say
// what it struck (world.js keeps the description: body.desc.colliders[i]).
// No three.js, no DOM.
//
//   readShapes(buffer) → shapes (the pack's bin; the same reader as the build's)
//   collidersOf(shapes, { statics = true, materials }) → collider[] (a
//     moving body takes no trimesh; materials: { <index>: { friction,
//     restitution } })
//   instanceBody(colliders, { position, quaternion, scale }, mesh?) → desc
//   cellBodies(instances, collidersByMesh) → desc[] (instances: [{ mesh,
//     position, quaternion, scale }])
//   budgetCell(descs, { colliders, triangles }) → { kept, dropped: [{ mesh,
//     hulls, triangles }] } (the lightest hulls go first, by their box's
//     volume; a trimesh only once every hull has gone)
//   solidsOf(shapes, { position, quaternion, scale }) → [{ type: 'box', x,
//     z, hw, hd, yaw, top, base } | { type: 'circle', x, z, r, top, base }]
//     (each hull's footprint as a box turned by the instance's yaw; a
//     standing capsule or a ball a circle; trimeshes aren't solids: the
//     walker has no floors from them)

export { readShapes } from './shapesBin.js';

export const MAX_HULL = 64;
const ONE = [1, 1, 1];
const IDENTITY = [0, 0, 0, 1];

// (a vector turned by a unit quaternion [x, y, z, w])
function turn(q, v) {
  const [qx, qy, qz, qw] = q;
  const [x, y, z] = v;
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return [x + qw * tx + (qy * tz - qz * ty), y + qw * ty + (qz * tx - qx * tz), z + qw * tz + (qx * ty - qy * tx)];
}

// the shortest turn taking +y onto the unit vector d
function fromUp(d) {
  const [x, y, z] = d;
  if (y < -0.999999) return [1, 0, 0, 0];
  const w = 1 + y;
  const n = Math.hypot(z, 0, -x, w);
  return [z / n, 0, -x / n, w / n];
}

function boxVolume(points) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < points.length; i += 3)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], points[i + k]);
      hi[k] = Math.max(hi[k], points[i + k]);
    }
  return Math.max(0, hi[0] - lo[0]) * Math.max(0, hi[1] - lo[1]) * Math.max(0, hi[2] - lo[2]);
}

function capsuleCollider(a, b, radius) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const dir = len > 1e-9 ? d.map((v) => v / len) : [0, 1, 0];
  return {
    shape: 'capsule',
    args: [len / 2, radius],
    position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    rotation: fromUp(dir),
  };
}

export function collidersOf(shapes, { statics = true, materials = null } = {}) {
  const out = [];
  for (const s of shapes) {
    let c;
    if (s.kind === 'hull') {
      if (s.points.length / 3 > MAX_HULL) throw new Error(`havok: a hull of ${s.points.length / 3} points (at most ${MAX_HULL}: the pack cuts them)`);
      c = { shape: 'hull', args: [s.points], weight: boxVolume(s.points), triangles: 0 };
    }
    else if (s.kind === 'mesh') {
      if (!statics) continue;
      c = { shape: 'trimesh', args: [s.points, s.indices], weight: boxVolume(s.points), triangles: s.indices.length / 3 };
    } else if (s.kind === 'capsule') c = { ...capsuleCollider(s.a, s.b, s.radius), weight: (2 * s.radius) ** 2 * (Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]) + 2 * s.radius), triangles: 0 };
    else if (s.kind === 'sphere') c = { shape: 'ball', args: [s.radius], position: [...s.centre], weight: (2 * s.radius) ** 3, triangles: 0 };
    else continue;
    c.tag = s.material ?? 0;
    const m = materials?.[c.tag];
    if (m && Number.isFinite(m.friction)) c.friction = m.friction;
    if (m && Number.isFinite(m.restitution)) c.restitution = m.restitution;
    out.push(c);
  }
  return out;
}

const unscaled = (s) => Math.abs(s[0] - 1) < 1e-6 && Math.abs(s[1] - 1) < 1e-6 && Math.abs(s[2] - 1) < 1e-6;

function scalePoints(points, s) {
  const out = new Float32Array(points.length);
  for (let i = 0; i < points.length; i += 3) {
    out[i] = points[i] * s[0];
    out[i + 1] = points[i + 1] * s[1];
    out[i + 2] = points[i + 2] * s[2];
  }
  return out;
}

function flipWinding(indices) {
  const out = new Uint32Array(indices.length);
  for (let i = 0; i < indices.length; i += 3) {
    out[i] = indices[i];
    out[i + 1] = indices[i + 2];
    out[i + 2] = indices[i + 1];
  }
  return out;
}

// A mesh's colliders at a scale (mirrored or not): the same objects when it
// is 1, else scaled copies.
function scaled(colliders, s) {
  if (unscaled(s)) return colliders;
  const mirrored = s[0] * s[1] * s[2] < 0;
  const big = Math.max(Math.abs(s[0]), Math.abs(s[1]), Math.abs(s[2]));
  const mul = (p) => [p[0] * s[0], p[1] * s[1], p[2] * s[2]];
  return colliders.map((c) => {
    if (c.shape === 'hull') return { ...c, args: [scalePoints(c.args[0], s)] };
    if (c.shape === 'trimesh') return { ...c, args: [scalePoints(c.args[0], s), mirrored ? flipWinding(c.args[1]) : c.args[1]] };
    if (c.shape === 'capsule') {
      const half = turn(c.rotation, [0, c.args[0], 0]);
      const a = mul([c.position[0] - half[0], c.position[1] - half[1], c.position[2] - half[2]]);
      const b = mul([c.position[0] + half[0], c.position[1] + half[1], c.position[2] + half[2]]);
      return { ...c, ...capsuleCollider(a, b, c.args[1] * big) };
    }
    if (c.shape === 'ball') return { ...c, args: [c.args[0] * big], position: mul(c.position) };
    return c;
  });
}

const cache = new WeakMap(); // colliders → Map(scale key → scaled colliders)

function scaledShared(colliders, s) {
  if (unscaled(s)) return colliders;
  let byScale = cache.get(colliders);
  if (!byScale) cache.set(colliders, (byScale = new Map()));
  const key = s.map((v) => v.toFixed(4)).join(',');
  if (!byScale.has(key)) byScale.set(key, scaled(colliders, s));
  return byScale.get(key);
}

export function instanceBody(colliders, { position = [0, 0, 0], quaternion = IDENTITY, scale = ONE } = {}, mesh = null) {
  return {
    type: 'fixed',
    group: 'floor',
    position: [...position],
    rotation: [...quaternion],
    mesh,
    colliders: scaledShared(colliders, scale ?? ONE),
  };
}

export function cellBodies(instances, collidersByMesh) {
  const out = [];
  for (const inst of instances) {
    const colliders = collidersByMesh[inst.mesh];
    if (!colliders?.length) continue;
    out.push(instanceBody(colliders, inst, inst.mesh));
  }
  return out;
}

export function budgetCell(descs, { colliders = Infinity, triangles = Infinity } = {}) {
  const items = [];
  let count = 0;
  let tris = 0;
  for (const d of descs)
    for (const c of d.colliders) {
      items.push({ d, c });
      count++;
      tris += c.triangles ?? 0;
    }
  if (count <= colliders && tris <= triangles) return { kept: descs, dropped: [] };
  // (hulls and the small round ones by their weight, then the trimeshes by theirs)
  items.sort((x, y) => (x.c.shape === 'trimesh') - (y.c.shape === 'trimesh') || (x.c.weight ?? 0) - (y.c.weight ?? 0));
  const gone = new Set();
  const drop = (it) => {
    gone.add(it);
    count--;
    tris -= it.c.triangles ?? 0;
  };
  // (too many colliders: hulls first; too many triangles: only a trimesh helps)
  for (const it of items) if (count > colliders) drop(it);
  for (const it of items) if (tris > triangles && it.c.shape === 'trimesh' && !gone.has(it)) drop(it);
  const lost = new Map(); // desc → colliders dropped
  for (const it of gone) {
    if (!lost.has(it.d)) lost.set(it.d, new Set());
    lost.get(it.d).add(it.c);
  }
  const kept = [];
  const byMesh = new Map();
  for (const d of descs) {
    const off = lost.get(d);
    if (!off) {
      kept.push(d);
      continue;
    }
    const left = d.colliders.filter((c) => !off.has(c));
    if (left.length) kept.push({ ...d, colliders: left });
    const row = byMesh.get(d.mesh) ?? { mesh: d.mesh, hulls: 0, triangles: 0 };
    for (const c of off) {
      if (c.shape === 'trimesh') row.triangles += c.triangles;
      else row.hulls++;
    }
    byMesh.set(d.mesh, row);
  }
  return { kept, dropped: [...byMesh.values()] };
}

// ── the walker's solids ──

export function solidsOf(shapes, { position = [0, 0, 0], quaternion = IDENTITY, scale = ONE } = {}) {
  const s = scale ?? ONE;
  const xAxis = turn(quaternion, [1, 0, 0]);
  const yaw = Math.atan2(-xAxis[2], xAxis[0]);
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  const world = (x, y, z) => {
    const p = turn(quaternion, [x * s[0], y * s[1], z * s[2]]);
    return [p[0] + position[0], p[1] + position[1], p[2] + position[2]];
  };
  const out = [];
  for (const sh of shapes) {
    if (sh.kind === 'mesh') continue;
    if (sh.kind === 'sphere') {
      const p = world(...sh.centre);
      const r = sh.radius * Math.max(...s.map(Math.abs));
      out.push({ type: 'circle', x: p[0], z: p[2], r, top: p[1] + r, base: p[1] - r });
      continue;
    }
    let pts;
    if (sh.kind === 'capsule') {
      const a = world(...sh.a);
      const b = world(...sh.b);
      const r = sh.radius * Math.max(...s.map(Math.abs));
      const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      if (len < 1e-6 || Math.abs(b[1] - a[1]) / len > 0.9) {
        out.push({ type: 'circle', x: (a[0] + b[0]) / 2, z: (a[2] + b[2]) / 2, r, top: Math.max(a[1], b[1]) + r, base: Math.min(a[1], b[1]) - r });
        continue;
      }
      // (a lying capsule: the box round its two end balls)
      pts = [];
      for (const e of [a, b]) for (const [dx, dy, dz] of [[r, r, r], [-r, -r, -r], [r, -r, -r], [-r, r, r], [r, r, -r], [-r, -r, r]]) pts.push([e[0] + dx, e[1] + dy, e[2] + dz]);
    } else {
      pts = [];
      for (let i = 0; i < sh.points.length; i += 3) pts.push(world(sh.points[i], sh.points[i + 1], sh.points[i + 2]));
    }
    // (into the instance's yaw frame: three.js's, its own x along (cos, −sin))
    let lx0 = Infinity;
    let lx1 = -Infinity;
    let lz0 = Infinity;
    let lz1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const [x, y, z] of pts) {
      const lx = x * c - z * sn;
      const lz = x * sn + z * c;
      lx0 = Math.min(lx0, lx);
      lx1 = Math.max(lx1, lx);
      lz0 = Math.min(lz0, lz);
      lz1 = Math.max(lz1, lz);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    const mx = (lx0 + lx1) / 2;
    const mz = (lz0 + lz1) / 2;
    // (the middle back out of the frame)
    out.push({ type: 'box', x: mx * c + mz * sn, z: -mx * sn + mz * c, hw: (lx1 - lx0) / 2, hd: (lz1 - lz0) / 2, yaw, top: y1, base: y0 });
  }
  return out;
}
