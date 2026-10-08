// A cell's props as bodies: his InstancedGroup half (folio-2025's
// Objects.js, research note §5). Each prop (from src/lib/land/cell.js's
// props) is a body of its kind's collider, standing on the ground where it
// was placed; the movable ones (crates, barrels) sleep until something hits
// them, and sync writes only the ones awake, so a field of still props costs
// nothing a frame. No three.js, no DOM.
//
//   KINDS: crate, barrel, rock, tree (his numbers: a crate is a 0.5 m
//     half-cube of 0.02 that any touch sets off; a tree a fixed cylinder
//     (2.5, 0.15), friction 0.7)
//   addProps(physics, list, kinds = KINDS) → { bodies, sync(write(i,
//     position, quaternion)), wake(i), reset(), remove() }
// (a kind it doesn't know throws before anything is added; once the world
// is disposed, every call is nothing)

export const KINDS = {
  crate: { type: 'dynamic', mass: 0.02, hitThreshold: 0, lift: 0.5, colliders: [{ shape: 'cuboid', args: [0.5, 0.5, 0.5] }] },
  barrel: { type: 'dynamic', mass: 0.1, lift: 0.6, colliders: [{ shape: 'cylinder', args: [0.6, 0.4] }] },
  rock: { type: 'fixed', friction: 0.7, lift: 0.3, colliders: [{ shape: 'ball', args: [1] }] },
  tree: { type: 'fixed', friction: 0.7, lift: 2.5, colliders: [{ shape: 'cylinder', args: [2.5, 0.15] }], scales: false },
};

// a collider's shape at a prop's scale (a tree's trunk keeps its own)
const scaled = (c, s) => ({ ...c, args: c.args.map((a) => a * s) });

export function addProps(physics, list, kinds = KINDS) {
  for (const p of list) if (!kinds[p.kind]) throw new Error(`physics: no prop kind '${p.kind}'`);
  const bodies = list.map((p) => {
    const k = kinds[p.kind];
    const s = k.scales === false ? 1 : (p.scale ?? 1);
    const half = (p.yaw ?? 0) / 2;
    return physics.add({
      type: k.type,
      position: [p.x, p.y + k.lift * s, p.z],
      rotation: [0, Math.sin(half), 0, Math.cos(half)],
      sleeping: k.type === 'dynamic',
      mass: k.mass,
      friction: k.friction,
      hitThreshold: k.hitThreshold,
      colliders: k.colliders.map((c) => scaled(c, s)),
    });
  });
  const index = new Map(bodies.map((b, i) => [b, i]));
  const pos = [0, 0, 0];
  const quat = [0, 0, 0, 1];
  const live = () => !physics.disposed;
  return {
    bodies,
    // (the awake ones only, from the world's own awake set: a field of
    // sleeping props costs nothing)
    sync(write) {
      if (!live()) return;
      physics.awake((h) => {
        const i = index.get(h);
        if (i === undefined || !h.body.isDynamic() || !h.body.isEnabled()) return;
        write(i, h.position(pos), h.quaternion(quat));
      });
    },
    wake(i) {
      if (live() && bodies[i] && !bodies[i].removed) bodies[i].body.wakeUp();
    },
    reset() {
      if (live()) for (const b of bodies) if (!b.removed && b.body.isDynamic()) b.reset();
    },
    remove() {
      if (live()) for (const b of bodies) physics.remove(b);
      bodies.length = 0;
      index.clear();
    },
  };
}
