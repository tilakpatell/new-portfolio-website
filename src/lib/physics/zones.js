// A zone: a sensor volume that says who is in it (a rancor's bite reach,
// a town's alarm line, a trigger on the ground). One kinematic body with
// one sensor collider in the `zone` group, so it meets figures (the
// `character` group) and nothing else, pushes nothing, and can be moved
// (`move`, each frame, to ride whatever it follows). `inside()` is the
// set kept from the world's enter and leave events (world.js's `sensor`
// colliders). No three.js.
//
//   createZone(phys, { position, shape = 'ball', args, rotation, tag = null, onEnter(body, tag, otherTag),
//     onLeave(body, tag, otherTag) }) → { body, inside() → [Body…], move(position, rotation?), remove() }

export function createZone(phys, { position, shape = 'ball', args, rotation, tag = null, onEnter = null, onLeave = null }) {
  const within = new Set();
  const body = phys.add({
    type: 'kinematicPositionBased',
    position,
    rotation,
    group: 'zone',
    colliders: [{ shape, args, sensor: true, tag }],
    onEnter(other, mine, theirs) {
      if (other) within.add(other);
      onEnter?.(other, mine, theirs);
    },
    onLeave(other, mine, theirs) {
      if (other) within.delete(other);
      onLeave?.(other, mine, theirs);
    },
  });
  const q = { x: 0, y: 0, z: 0, w: 1 };
  return {
    body,
    inside: () => [...within].filter((b) => !b.removed),
    move(at, rot = null) {
      if (body.removed) return;
      body.body.setNextKinematicTranslation({ x: at[0], y: at[1], z: at[2] });
      if (rot) {
        q.x = rot[0];
        q.y = rot[1];
        q.z = rot[2];
        q.w = rot[3];
        body.body.setNextKinematicRotation(q);
      }
    },
    remove() {
      within.clear();
      body.onEnter = null;
      body.onLeave = null;
      phys.remove(body);
    },
  };
}
