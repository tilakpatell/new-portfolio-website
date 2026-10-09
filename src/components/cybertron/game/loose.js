// An area's loose things (its `loose` list: energon crates on Iacon's way
// to the gate) as things Optimus knocks flying, robot or truck:
// lib/three/knockables draws them (one draw a kind) and, where the computer
// can afford the engine (knockablesWanted: a high tier, not a phone, not
// Data Saver), Rapier moves them. He is a kinematic capsule following where
// the rules put him (the robot's tall and thin, the truck's low and wide;
// the one he isn't waits far below), so he bulldozes them and they never
// push back; the area's solids near them are fixed boxes and circles.
// Without the engine they stand, drawn, where they were put.
//
//   KINDS: energon (a crate a metre and a half across, light against him)
//   createLoose({ area, parent, dev, impacts }) → Promise<{ step(dt,
//     player), physical, dispose() }>

import { createKnockables, knockablesWanted } from '../../../lib/three/knockables';
import { ROBOT, VEHICLE } from './rules';

export const KINDS = {
  energon: { mass: 0.4, lift: 0.8, colliders: [{ shape: 'cuboid', args: [0.8, 0.8, 0.8] }], shape: 'box', size: [1.6, 1.6, 1.6], colour: 0x2fb8e8 },
};

const NEAR = 40; // metres from a crate whose solids count
const AWAY = [0, -500, 0]; // where the form he isn't in waits

export async function createLoose({ area, parent, dev, impacts }) {
  const list = area.loose ?? [];
  let physics = null;
  if (list.length && knockablesWanted(dev)) {
    try {
      const { createPhysics } = await import('../../../lib/physics/world');
      physics = await createPhysics();
    } catch {
      physics = null; // (offline, or the engine wouldn't start: they stand)
    }
  }
  const things = createKnockables({ physics, kinds: KINDS, impacts, parent, count: Math.max(1, list.length) });
  let forms = null;
  if (physics) {
    physics.add({ type: 'fixed', position: [0, -0.5, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [600, 0.5, 600] }] });
    const near = (s) => list.some((c) => Math.hypot(c.x - s.x, c.z - s.z) < NEAR + (s.r ?? Math.hypot(s.hw, s.hd)));
    for (const s of area.solids ?? []) {
      if (!near(s)) continue;
      const h = Math.min(s.top ?? 20, 20) / 2;
      const yaw = s.yaw ?? 0;
      if (s.kind === 'circle') physics.add({ type: 'fixed', position: [s.x, h, s.z], colliders: [{ shape: 'cylinder', args: [h, s.r] }] });
      else physics.add({ type: 'fixed', position: [s.x, h, s.z], rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], colliders: [{ shape: 'cuboid', args: [s.hw, h, s.hd] }] });
    }
    const { addPusher } = await import('../../../lib/physics/pusher');
    const robotHalf = (ROBOT.height - 2 * ROBOT.radius) / 2;
    const truckHalf = Math.max(0.1, (VEHICLE.height - 2 * VEHICLE.radius) / 2);
    forms = {
      robot: { pusher: addPusher(physics, { radius: ROBOT.radius, half: robotHalf, position: AWAY, teleport: 6 }), up: ROBOT.radius + robotHalf },
      vehicle: { pusher: addPusher(physics, { radius: VEHICLE.radius, half: truckHalf, position: AWAY, teleport: 6 }), up: VEHICLE.radius + truckHalf },
    };
  }
  things.add(list);
  physics?.step(1 / 60);
  return {
    physical: things.physical,
    step(dt, p) {
      if (!physics) return;
      for (const [mode, f] of Object.entries(forms)) f.pusher.follow(mode === p.mode && !p.dead ? [p.x, p.y + f.up, p.z] : AWAY, dt);
      physics.step(dt);
      things.sync();
    },
    dispose() {
      things.dispose();
      physics?.dispose();
    },
  };
}
