// The street's props (rules.js STREET_PROPS) as things the Aztek knocks
// flying: lib/three/knockables draws them (one draw a kind) and, where the
// computer can afford the engine (lib/three/knockables's knockablesWanted:
// not a phone, not Data Saver, a high tier), Rapier moves them. The car is
// a kinematic capsule following where the rules put it, so it bulldozes
// them and they never push back (the drive is the rules', not the
// engine's); the buildings near Central are fixed boxes, so a cone doesn't
// sail through a wall. Without the engine they stand, drawn, where they
// were put.
//
//   createStreetProps({ parent, dev, impacts }) → Promise<{ step(dt, car),
//     physical, dispose() }>

import { createKnockables, knockablesWanted } from '../../../lib/three/knockables';
import { CAR, COLLIDERS, STREET_PROPS } from './rules';

const NEAR = 30; // metres either side of Central whose buildings count
const WALL = 3; // half a building's height, for what a cone can reach

export async function createStreetProps({ parent, dev, impacts }) {
  let physics = null;
  if (knockablesWanted(dev)) {
    try {
      const { createPhysics } = await import('../../../lib/physics/world');
      physics = await createPhysics();
    } catch {
      physics = null; // (offline, or the engine wouldn't start: they stand)
    }
  }
  const things = createKnockables({ physics, impacts, parent });
  let car = null;
  if (physics) {
    physics.add({ type: 'fixed', position: [0, -0.5, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [500, 0.5, 500] }] });
    for (const b of COLLIDERS) if (Math.abs(b.z) - b.d / 2 < NEAR) physics.add({ type: 'fixed', position: [b.x, WALL, b.z], colliders: [{ shape: 'cuboid', args: [b.w / 2, WALL, b.d / 2] }] });
    const { addPusher } = await import('../../../lib/physics/pusher');
    car = addPusher(physics, { radius: CAR.radius, half: 0.3, position: [0, 1.4, 0], teleport: 6 });
  }
  things.add(STREET_PROPS);
  // (one step first: the world sees what's been added before it's asked anything)
  physics?.step(1 / 60);
  return {
    physical: things.physical,
    step(dt, at) {
      if (!physics) return;
      car.follow([at.x, 1.4, at.z], dt);
      physics.step(dt);
      things.sync();
    },
    dispose() {
      things.dispose();
      physics?.dispose();
    },
  };
}
