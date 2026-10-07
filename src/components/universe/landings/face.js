// Something stood at a landing turning to face you: `turn`, an inner group
// of `object` (which stands where furnish put it, in metres, facing the
// ship), eased round toward the player's head (ctx.me, in the world, from
// footScene through furnish's update) while they're within `within` metres,
// and back to where it stood once they've gone. The landing's people, the
// Avengers by their compound and the toy figures by Bag End all use it.
//
//   meIn(object, ctx) → Vector3 | null   ctx.me in `object`'s own frame (metres, +z ahead)
//   faceStep(st, object, turn, ctx, dt, { within = 8, rate = 3 }) → { d, seen }
//     st: its own ({ yaw }); d: metres to the player (Infinity: no one); seen: within

import * as THREE from 'three';

const inv = new THREE.Matrix4();
const local = new THREE.Vector3();
// where ctx.me is in `object`'s own frame (metres, +z ahead), or null
export function meIn(object, ctx) {
  if (!ctx?.me || !object) return null;
  return local.copy(ctx.me).applyMatrix4(inv.copy(object.matrixWorld).invert());
}
export function faceStep(st, object, turn, ctx, dt, { within = 8, rate = 3 } = {}) {
  const p = meIn(object, ctx);
  const d = p ? Math.hypot(p.x, p.z) : Infinity;
  const seen = d <= within;
  const want = seen ? Math.atan2(p.x, p.z) : 0;
  st.yaw ??= 0;
  // (the short way round, eased; back to where it stood once you've gone)
  let diff = want - st.yaw;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  st.yaw += diff * Math.min(1, dt * (seen ? rate : rate * 0.5));
  turn.rotation.y = st.yaw;
  return { d, seen };
}

