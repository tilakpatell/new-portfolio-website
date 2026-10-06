// pose.js's pose for a rigged model: the code-made Mario turns each joint
// (a limb hanging down, turned by its own rotation and every joint above
// it), while lib/three/rig.js points each limb of a skeleton along a
// direction in the figure's frame (+z ahead, +y up, +x his left). So each
// limb's direction is the one the code-made Mario's limb would have: down,
// through the shoulder or hip's chain. The spine's bend is the torso's; the
// hips' turn and the head's are left to the model (they turn whole parts).

import { Euler, Quaternion, Vector3 } from 'three';

const DOWN = new Vector3(0, -1, 0);
const FOOT = new Vector3(0, -0.35, 1).normalize(); // ahead, a little down
const _e = new Euler();
const turn = (r) => new Quaternion().setFromEuler(_e.set(r[0], r[1], r[2]));
const along = (q, v = DOWN) => v.clone().applyQuaternion(q).toArray();

export function limbTargets(p) {
  const J = p.joints;
  const spine = turn(J.spine);
  const out = { torso: { pitch: J.spine[0], yaw: J.spine[1], roll: J.spine[2] } };
  for (const s of ['L', 'R']) {
    const arm = spine.clone().multiply(turn(J[`arm${s}`]));
    const fore = arm.clone().multiply(turn(J[`fore${s}`]));
    out[`arm${s}`] = along(arm);
    out[`fore${s}`] = along(fore);
    const leg = turn(J[`leg${s}`]);
    const shin = leg.clone().multiply(turn(J[`shin${s}`]));
    out[`thigh${s}`] = along(leg);
    out[`calf${s}`] = along(shin);
    out[`foot${s}`] = along(shin, FOOT);
  }
  return out;
}
