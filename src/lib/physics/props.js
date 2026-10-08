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

export const KINDS = {
  crate: { type: 'dynamic', mass: 0.02, hitThreshold: 0, lift: 0.5, colliders: [{ shape: 'cuboid', args: [0.5, 0.5, 0.5] }] },
  barrel: { type: 'dynamic', mass: 0.1, lift: 0.6, colliders: [{ shape: 'cylinder', args: [0.6, 0.4] }] },
  rock: { type: 'fixed', friction: 0.7, lift: 0.3, colliders: [{ shape: 'ball', args: [1] }] },
  tree: { type: 'fixed', friction: 0.7, lift: 2.5, colliders: [{ shape: 'cylinder', args: [2.5, 0.15] }], scales: false },
};

// a collider's shape at a prop's scale (a tree's trunk keeps its own)
const scaled = (c, s) => ({ ...c, args: c.args.map((a) => a * s) });

export function addProps(physics, list, kinds = KINDS) {
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
  const pos = [0, 0, 0];
  const quat = [0, 0, 0, 1];
  return {
    bodies,
    sync(write) {
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i].body;
        if (!b.isDynamic() || b.isSleeping() || !b.isEnabled()) continue;
        write(i, bodies[i].position(pos), bodies[i].quaternion(quat));
      }
    },
    wake(i) {
      bodies[i].body.wakeUp();
    },
    reset() {
      for (const b of bodies) if (b.body.isDynamic()) b.reset();
    },
    remove() {
      for (const b of bodies) physics.remove(b);
      bodies.length = 0;
    },
  };
}
