// The lock-on on a galaxy surface (lib/combat/lockOn.js on this world's
// things), beside scene.js, which is past its size. While it's on, the
// camera turns onto the one you're squared up to (scene.js's state.lock,
// the nearest in front: strokes home on it), so the reticle stays on them
// as you walk round. The Lock button and L toggle it (Tab is the crewmate
// swap here); on a coarse pointer it's on by itself while a hostile lock
// is within 14 m. The page hears { type: 'lockOn', on } when it changes,
// for the button.
//
//   createSurfaceLockOn({ coarse, emit }) → { on, toggle(), step(state, at, dt) }
//     `state` the scene's (its lock, its camera's yaw, its phase), `at`
//     where you are ({ x, z }).

import { createLockOn, turnTo, yawToward } from '../../../lib/combat/lockOn';

// (this camera's yaw looks along (sin, cos), as scene.js's pickLock measures it)
const forward = (yaw) => [Math.sin(yaw), Math.cos(yaw)];

export function createSurfaceLockOn({ coarse = false, emit = () => {} } = {}) {
  const l = createLockOn({ coarse });
  let was = false;
  const tell = () => {
    if (l.on === was) return;
    was = l.on;
    emit({ type: 'lockOn', on: l.on });
  };
  return {
    get on() {
      return l.on;
    },
    toggle() {
      l.toggle();
      tell();
    },
    step(state, at, dt) {
      const t = state.phase === 'walk' && state.lock && !state.lock.down ? state.lock : null;
      const q = t?.holder.position;
      l.step({ near: q && t.hostile ? Math.hypot(q.x - at.x, q.z - at.z) : Infinity });
      tell();
      if (l.on && q) state.cam.yaw = turnTo(state.cam.yaw, yawToward(at, q, forward), dt);
    },
  };
}
