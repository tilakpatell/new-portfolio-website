// Someone walking about, as a body: a kinematic capsule that follows where
// the walk (foot.js, not the physics) has put them, and shoves whatever
// it walks into (a sleeping crate wakes and goes). It moves by velocity, the
// gap to its target over the frame's time, so every substep in a frame
// carries it the same share and what it hits is pushed as hard as it's
// walking; a jump further than `teleport` (a respawn, a boarding) is put
// there outright, at rest, so nothing where it lands is flung. A target
// that isn't numbers is ignored. No three.js, no DOM.
//
//   addPusher(physics, { radius = 0.35, half = 0.55 (the capsule's half
//     height, its straight part), position, teleport = 2 })
//     → { body, follow([x, y, z], dt, rotation?), position(out), remove() }

const finite = (a) => Array.isArray(a) && a.length >= 3 && Number.isFinite(a[0]) && Number.isFinite(a[1]) && Number.isFinite(a[2]);

export function addPusher(physics, { radius = 0.35, half = 0.55, position = [0, 0, 0], teleport = 2 } = {}) {
  const body = physics.add({
    type: 'kinematicVelocityBased',
    position,
    canSleep: false,
    colliders: [{ shape: 'capsule', args: [half, radius] }],
  });
  const at = [0, 0, 0];
  let gone = false;
  return {
    body,
    follow(target, dt, rotation = null) {
      if (gone || physics.disposed || !finite(target)) return;
      const b = body.body;
      body.position(at);
      const dx = target[0] - at[0];
      const dy = target[1] - at[1];
      const dz = target[2] - at[2];
      if (rotation) b.setRotation({ x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3] }, true);
      if (Math.hypot(dx, dy, dz) > teleport || !(dt > 0)) {
        b.setTranslation({ x: target[0], y: target[1], z: target[2] }, true);
        b.setLinvel({ x: 0, y: 0, z: 0 }, true);
        return;
      }
      b.setLinvel({ x: dx / dt, y: dy / dt, z: dz / dt }, true);
    },
    position(out = [0, 0, 0]) {
      return body.position(out);
    },
    remove() {
      if (gone) return;
      gone = true;
      physics.remove(body);
    },
  };
}
