// A cell's props as bodies: his InstancedGroup half (folio-2025's
// Objects.js, research note §5). Each prop (from src/lib/land/cell.js's
// props, or a landing's scatter) is a body of its kind's collider, standing
// on the ground where it was placed; the movable ones (crates, barrels)
// sleep until something hits them, and sync writes only the ones awake (and
// any a reset or an origin shift has moved since), so a field of still
// props costs nothing a frame. No three.js, no DOM.
//
// A prop stands up its own `up` (default +y: a flat land; a planet passes
// the way out from its middle) and turns by `rotation` (a quaternion) or by
// `yaw` about that up. A kind's scale scales its whole shape (a hull's or a
// trimesh's points, each collider's offset) and its mass by the cube, unless
// the kind says `scales: false` (a tree's trunk keeps its own).
//
// A prop may carry its own size (a kit model's, from its manifest): in
// metres as it stands, its scale not applied again, `radius` is a ball's or
// a cylinder's radius and `height` a cylinder's whole height, its foot on
// the ground (its middle half of it up its up, in place of the kind's lift).
// Only a cylinder kind takes a height: a ball given one keeps its own lift.
//
//   KINDS: crate, barrel, rock, tree (his numbers: a crate is a 0.5 m
//     half-cube of 0.02 that any touch sets off; a tree a fixed cylinder
//     (2.5, 0.15), friction 0.7)
//   kind: { type, mass, lift (metres up its up to its middle), friction,
//     restitution, linearDamping, angularDamping, canSleep, group, onHit,
//     hitThreshold, colliders, scales }
//   addProps(physics, list ([{ kind, x, y, z, yaw?, rotation?, up?, scale?,
//     radius?, height? }]), kinds = KINDS) → { bodies, sync(write(i,
//     position, quaternion)), wake(i), reset(), remove() }
// (a kind it doesn't know throws before anything is added; once the world
// is disposed, every call is nothing)

export const KINDS = {
  crate: { type: 'dynamic', mass: 0.02, hitThreshold: 0, lift: 0.5, colliders: [{ shape: 'cuboid', args: [0.5, 0.5, 0.5] }] },
  barrel: { type: 'dynamic', mass: 0.1, lift: 0.6, colliders: [{ shape: 'cylinder', args: [0.6, 0.4] }] },
  rock: { type: 'fixed', friction: 0.7, lift: 0.3, colliders: [{ shape: 'ball', args: [1] }] },
  tree: { type: 'fixed', friction: 0.7, lift: 2.5, colliders: [{ shape: 'cylinder', args: [2.5, 0.15] }], scales: false },
};

const times = (points, s) => {
  const out = new Float32Array(points.length);
  for (let i = 0; i < points.length; i++) out[i] = points[i] * s;
  return out;
};

// a collider at a prop's scale: every length in it, its offset too
function scaled(c, s) {
  if (s === 1) return c;
  const out = { ...c, position: c.position?.map((a) => a * s) };
  if (c.shape === 'hull') out.args = [times(c.args[0], s)];
  else if (c.shape === 'trimesh') out.args = [times(c.args[0], s), c.args[1]];
  else if (c.shape === 'heightfield') throw new Error('physics: a prop is never a heightfield');
  else out.args = c.args.map((a) => a * s);
  return out;
}

// a ball or a cylinder at the prop's own size, where it gives one
function sized(c, p) {
  if (c.shape === 'ball' && p.radius != null) return { ...c, args: [p.radius] };
  if (c.shape === 'cylinder' && (p.radius != null || p.height != null)) return { ...c, args: [p.height != null ? p.height / 2 : c.args[0], p.radius ?? c.args[1]] };
  return c;
}

// the turn that takes +y to `up`, then `yaw` about it
function standing(up, yaw) {
  const [ux, uy, uz] = up;
  const l = Math.hypot(ux, uy, uz) || 1;
  const x = ux / l;
  const y = uy / l;
  const z = uz / l;
  // +y to up: about (z, 0, −x) by acos(y); upside down is a half turn about x
  let q = y < -0.999999 ? [1, 0, 0, 0] : [z, 0, -x, 1 + y];
  const n = Math.hypot(...q);
  q = q.map((a) => a / n);
  const h = yaw / 2;
  const s = Math.sin(h);
  const yq = [x * s, y * s, z * s, Math.cos(h)]; // (yaw about up, after)
  const [ax, ay, az, aw] = yq;
  const [bx, by, bz, bw] = q;
  return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
}

export function addProps(physics, list, kinds = KINDS) {
  for (const p of list) if (!kinds[p.kind]) throw new Error(`physics: no prop kind '${p.kind}'`);
  const bodies = [];
  try {
    for (const p of list) {
      const k = kinds[p.kind];
      const s = k.scales === false ? 1 : (p.scale ?? 1);
      const up = p.up ?? [0, 1, 0];
      const l = Math.hypot(up[0], up[1], up[2]) || 1;
      const lift = p.height != null && k.colliders.some((c) => c.shape === 'cylinder') ? p.height / 2 : (k.lift ?? 0) * s;
      bodies.push(
        physics.add({
          type: k.type,
          position: [p.x + (up[0] / l) * lift, p.y + (up[1] / l) * lift, p.z + (up[2] / l) * lift],
          rotation: p.rotation ?? standing(up, p.yaw ?? 0),
          sleeping: k.type === 'dynamic',
          mass: k.mass === undefined ? undefined : k.mass * s * s * s,
          friction: k.friction,
          restitution: k.restitution,
          linearDamping: k.linearDamping,
          angularDamping: k.angularDamping,
          canSleep: k.canSleep,
          group: k.group,
          onHit: k.onHit,
          hitThreshold: k.hitThreshold,
          colliders: k.colliders.map((c) => sized(scaled(c, s), p)),
        }),
      );
    }
  } catch (err) {
    for (const b of bodies) physics.remove(b);
    throw err;
  }
  const index = new Map(bodies.map((b, i) => [b, i]));
  const pos = [0, 0, 0];
  const quat = [0, 0, 0, 1];
  const live = () => !physics.disposed;
  return {
    bodies,
    // (the awake ones, from the world's own awake set: a field of sleeping
    // props costs nothing; and once, any a reset or a shift has moved)
    sync(write) {
      if (!live()) return;
      physics.awake((h) => {
        const i = index.get(h);
        if (i === undefined || !h.body.isDynamic() || !h.body.isEnabled()) return;
        h.dirty = false;
        write(i, h.position(pos), h.quaternion(quat));
      });
      for (let i = 0; i < bodies.length; i++) {
        const h = bodies[i];
        if (!h.dirty || h.removed) continue;
        h.dirty = false;
        write(i, h.position(pos), h.quaternion(quat));
      }
    },
    wake(i) {
      if (live() && bodies[i] && !bodies[i].removed) bodies[i].wake();
    },
    reset() {
      if (live()) for (const b of bodies) if (!b.removed && b.dynamic) b.reset();
    },
    remove() {
      if (live()) for (const b of bodies) physics.remove(b);
      bodies.length = 0;
      index.clear();
    },
  };
}
