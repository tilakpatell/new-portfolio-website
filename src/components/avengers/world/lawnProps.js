// The lawn’s props (./rules.js LAWN_PROPS: slaloms of cones, crates and a
// barrel near where you start) as things Spider-Man knocks flying, on foot
// or swinging through: lib/three/knockables draws them (one draw a kind)
// and, where the computer can afford the engine (knockablesWanted: a high
// tier, not a phone, not Data Saver), Rapier moves them. He is a kinematic
// capsule following where the rules put him, so he bulldozes them and they
// never push back; the lawn is one fixed floor, and the props stand well
// clear of the buildings. Without the engine they stand, drawn, where they
// were put.
//
//   KINDS: cone, crate, barrel (light against him: 0.1 to 0.4)
//   createLawnProps({ parent, dev, impacts }) → Promise<{ step(dt, hero),
//     physical, dispose() }>

import { KINDS as BASE, createKnockables, knockablesWanted } from '../../../lib/three/knockables';
import { HERO_R, LAWN_PROPS } from './rules';

export const KINDS = {
  cone: { ...BASE.cone, mass: 0.1 },
  crate: { ...BASE.crate, mass: 0.25 },
  barrel: { ...BASE.barrel, mass: 0.4 },
};

const HALF = 0.45; // half his capsule’s straight part: about his height, with the ends

export async function createLawnProps({ parent, dev, impacts }) {
  let physics = null;
  if (knockablesWanted(dev)) {
    try {
      const { createPhysics } = await import('../../../lib/physics/world');
      physics = await createPhysics();
    } catch {
      physics = null; // (offline, or the engine wouldn't start: they stand)
    }
  }
  const things = createKnockables({ physics, kinds: KINDS, impacts, parent, count: LAWN_PROPS.length });
  let him = null;
  if (physics) {
    physics.add({ type: 'fixed', position: [0, -0.5, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [600, 0.5, 600] }] });
    const { addPusher } = await import('../../../lib/physics/pusher');
    // (a zip or a point launch is further than a frame’s walk: put there, not flung through)
    him = addPusher(physics, { radius: HERO_R, half: HALF, position: [0, -50, 0], teleport: 6 });
  }
  things.add(LAWN_PROPS);
  // (one step first: the world sees what's been added before it's asked anything)
  physics?.step(1 / 60);
  return {
    physical: things.physical,
    // `hero` is the rules’ ({ x, y, z }, his feet)
    step(dt, hero) {
      if (!physics) return;
      him.follow([hero.x, hero.y + HALF + HERO_R, hero.z], dt);
      physics.step(dt);
      things.sync();
    },
    dispose() {
      things.dispose();
      physics?.dispose();
    },
  };
}
