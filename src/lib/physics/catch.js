// His bedrock (folio-2025's Floor.js): a kinematic slab, 12 × 1 × 12 m,
// put under the car so it never falls through a gap. Ours is for a cell
// whose heightfield is still on its way from the worker: the world turns
// it on while the cell under the car has no collider, at the nearest loaded
// ground's height, and off again once it has. No three.js, no DOM.
//
//   addCatch(physics) → { body, follow(x, z, y) (its top at y), enable(on) }

export function addCatch(physics) {
  const body = physics.add({
    type: 'kinematicPositionBased',
    position: [0, -1e4, 0],
    group: 'floor',
    colliders: [{ shape: 'cuboid', args: [6, 0.5, 6] }],
  });
  return {
    body,
    follow(x, z, y) {
      const to = { x, y: y - 0.5, z };
      body.body.setTranslation(to, true);
      body.body.setNextKinematicTranslation(to);
    },
    enable(on) {
      body.body.setEnabled(!!on);
    },
  };
}
