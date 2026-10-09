// Where a figure can be hurt: one capsule a region (the head, the chest,
// each upper arm, forearm, thigh and shin) on the figure's one kinematic
// body, each a sensor in the `hurtbox` group (it pushes nothing, meets
// nothing by contact, and is found only by a strike's sweep or a bolt's
// ray, which report its region as the hit's `tag`). The rig
// (lib/three/combat/hitboxRig.js) sets each region's segment from its two
// bones each frame; this turns a world segment into the collider's pose
// relative to the body (`capsuleBetween`, pure). An unrigged figure gets
// one capsule, `whole`. The regions' bones are the Meshy skeleton's, the
// radii ragdollPhysics.js's. No three.js.
//
//   REGIONS: { [region]: { bones: [from, to], r } }
//   capsuleBetween(a, b, bodyPos, bodyQuat) → { translation, rotation, halfHeight } (in the body's frame;
//     Rapier's capsule stands along y)
//   createHurtboxes(phys, character, { regions = REGIONS, single = false, tall = 1.8 }) → {
//     set(region, a, b)  (world [x, y, z] ends; an unknown region is ignored), regions, remove() }

export const REGIONS = {
  head: { bones: ['neck', 'head_end'], r: 0.12 },
  chest: { bones: ['Hips', 'neck'], r: 0.2 },
  upperArmL: { bones: ['LeftArm', 'LeftForeArm'], r: 0.07 },
  foreArmL: { bones: ['LeftForeArm', 'LeftHand'], r: 0.06 },
  upperArmR: { bones: ['RightArm', 'RightForeArm'], r: 0.07 },
  foreArmR: { bones: ['RightForeArm', 'RightHand'], r: 0.06 },
  thighL: { bones: ['LeftUpLeg', 'LeftLeg'], r: 0.09 },
  shinL: { bones: ['LeftLeg', 'LeftFoot'], r: 0.07 },
  thighR: { bones: ['RightUpLeg', 'RightLeg'], r: 0.09 },
  shinR: { bones: ['RightLeg', 'RightFoot'], r: 0.07 },
};

// quaternions as [x, y, z, w]
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
const qrot = (q, v) => {
  const [x, y, z, w] = q;
  const ix = w * v[0] + y * v[2] - z * v[1];
  const iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
};
// the rotation taking +y onto the unit vector d (three.js's setFromUnitVectors)
const fromY = (d) => {
  const r = 1 + d[1];
  if (r < 1e-6) return [0, 0, 1, 0]; // (straight down: a half turn about z)
  const q = [d[2], 0, -d[0], r]; // y × d, and 1 + y · d
  const n = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
};

export function capsuleBetween(a, b, bodyPos, bodyQuat) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const mid = [(a[0] + b[0]) / 2 - bodyPos[0], (a[1] + b[1]) / 2 - bodyPos[1], (a[2] + b[2]) / 2 - bodyPos[2]];
  const inv = qconj(bodyQuat);
  const world = len > 1e-6 ? fromY([dx / len, dy / len, dz / len]) : [0, 0, 0, 1];
  return { translation: qrot(inv, mid), rotation: qmul(inv, world), halfHeight: len / 2 };
}

export function createHurtboxes(phys, character, { regions = REGIONS, single = false, tall = 1.8 } = {}) {
  const body = character.body;
  const made = new Map(); // region → collider
  if (single) {
    const r = Math.max(0.4, tall * 0.25);
    made.set('whole', body.attach({ shape: 'capsule', args: [Math.max(0, tall / 2 - r), r], group: 'hurtbox', sensor: true, tag: 'whole' }));
  } else {
    for (const [region, { r }] of Object.entries(regions)) made.set(region, body.attach({ shape: 'capsule', args: [0.1, r], group: 'hurtbox', sensor: true, tag: region }));
  }
  const pos = [0, 0, 0];
  const rot = [0, 0, 0, 1];
  const t = { x: 0, y: 0, z: 0 };
  const q = { x: 0, y: 0, z: 0, w: 1 };
  return {
    regions: [...made.keys()],
    set(region, a, b) {
      const c = made.get(region);
      if (!c || body.removed) return;
      const cap = capsuleBetween(a, b, character.position(pos), character.quaternion(rot));
      t.x = cap.translation[0];
      t.y = cap.translation[1];
      t.z = cap.translation[2];
      q.x = cap.rotation[0];
      q.y = cap.rotation[1];
      q.z = cap.rotation[2];
      q.w = cap.rotation[3];
      c.setTranslationWrtParent(t);
      c.setRotationWrtParent(q);
      c.setHalfHeight(cap.halfHeight);
    },
    remove() {
      for (const c of made.values()) body.detach(c);
      made.clear();
    },
  };
}
