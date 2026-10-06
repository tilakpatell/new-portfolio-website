// A skeleton for a robot that came without one: Transformers: Prime's
// Optimus, Bumblebee and Ratchet are game models stood in a T or an A, all
// one piece. Their joints are worked out from the shape itself (where the
// feet are, how far the hands reach, the shoulders and the hips as shares of
// the height), bones are put there and named the way lib/three/rig.js knows
// (Hips, Spine, LeftArm, LeftForeArm, LeftUpLeg…), and every vertex goes
// with the bone whose segment it's nearest, all of its weight on that one:
// armour moves as plates, which for a robot is the right way to move.
//
// autorig(root) → a THREE.Group of skinned meshes (the materials kept), in
// the same place and size as `root`, standing on y = 0 and facing +z.

import * as THREE from 'three';

const v = new THREE.Vector3();

// every vertex of every mesh under `root`, where it's drawn
function points(root) {
  root.updateMatrixWorld(true);
  const out = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pos.count / 6000));
    for (let i = 0; i < pos.count; i += step) out.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
  });
  return out;
}

// Where the joints are, from the shape: the feet at the bottom, the hands
// as far out as anything reaches above the hips, the rest in proportion
export function joints(root) {
  const pts = points(root);
  const box = new THREE.Box3().setFromPoints(pts);
  const H = box.max.y - box.min.y;
  const y0 = box.min.y;
  const at = (k) => y0 + H * k;
  const side = (s) => {
    // the foot: the middle of what's low down on this side
    const low = pts.filter((p) => p.y < at(0.08) && Math.sign(p.x) === s);
    const foot = low.length ? low.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(low.length) : new THREE.Vector3(s * H * 0.1, at(0.03), 0);
    // the hand: the farthest out above the hips
    let hand = null;
    for (const p of pts) if (p.y > at(0.42) && Math.sign(p.x) === s && (!hand || Math.abs(p.x) > Math.abs(hand.x))) hand = p;
    hand = hand?.clone() ?? new THREE.Vector3(s * H * 0.4, at(0.6), 0);
    // the shoulder: at the top of the chest, as wide as the torso there
    const chest = pts.filter((p) => p.y > at(0.7) && p.y < at(0.8)).map((p) => Math.abs(p.x)).sort((a, b) => a - b);
    const torso = chest.length ? chest[Math.floor(chest.length * 0.55)] : H * 0.16;
    const shoulderX = s * Math.min(Math.abs(hand.x) * 0.85, Math.max(H * 0.1, torso * 0.9));
    const shoulder = new THREE.Vector3(shoulderX, at(0.78), 0);
    // reach in to the hand a little from its very tip (to the wrist)
    const wrist = hand.clone().lerp(shoulder, 0.12);
    const elbow = shoulder.clone().lerp(wrist, 0.5);
    const hip = new THREE.Vector3(foot.x * 0.8, at(0.5), 0);
    const ankle = new THREE.Vector3(foot.x, at(0.07), foot.z);
    const knee = hip.clone().lerp(ankle, 0.5);
    knee.z += H * 0.015;
    const toe = ankle.clone().add(new THREE.Vector3(0, -H * 0.04, H * 0.06));
    return { shoulder, elbow, wrist, hand, hip, knee, ankle, toe };
  };
  const L = side(1); // +x is the figure's left (it faces +z)
  const R = side(-1);
  return {
    H,
    hips: new THREE.Vector3(0, at(0.5), 0),
    spine: new THREE.Vector3(0, at(0.6), 0),
    chest: new THREE.Vector3(0, at(0.72), 0),
    neck: new THREE.Vector3(0, at(0.84), 0),
    head: new THREE.Vector3(0, at(0.9), 0),
    top: new THREE.Vector3(0, at(1), 0),
    L,
    R,
  };
}

const segDist = (p, a, b) => {
  const ab = b.clone().sub(a);
  const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / Math.max(1e-9, ab.lengthSq())));
  return a.clone().addScaledVector(ab, t).distanceTo(p);
};

export function autorig(root) {
  const J = joints(root);
  // the bones, a figure's hierarchy
  const bone = (name, at, parent) => {
    const b = new THREE.Bone();
    b.name = name;
    const p = parent ? at.clone().sub(parent.userData.at) : at.clone();
    b.position.copy(p);
    b.userData.at = at.clone();
    parent?.add(b);
    return b;
  };
  const hips = bone('Hips', J.hips, null);
  const spine = bone('Spine', J.spine, hips);
  const chest = bone('Spine1', J.chest, spine);
  const neck = bone('Neck', J.neck, chest);
  const head = bone('Head', J.head, neck);
  bone('HeadTop_End', J.top, head);
  const limbs = {};
  for (const [s, side] of [
    ['Left', J.L],
    ['Right', J.R],
  ]) {
    const sh = bone(`${s}Shoulder`, side.shoulder.clone().lerp(J.chest, 0.3), chest);
    const arm = bone(`${s}Arm`, side.shoulder, sh);
    const fore = bone(`${s}ForeArm`, side.elbow, arm);
    const hand = bone(`${s}Hand`, side.wrist, fore);
    bone(`${s}HandTip`, side.hand, hand);
    const up = bone(`${s}UpLeg`, side.hip, hips);
    const leg = bone(`${s}Leg`, side.knee, up);
    const foot = bone(`${s}Foot`, side.ankle, leg);
    bone(`${s}ToeBase`, side.toe, foot);
    limbs[s] = { arm, fore, hand, up, leg, foot, side };
  }
  const bones = [];
  hips.traverse((b) => bones.push(b));
  // the segments a vertex can belong to, each with its bone
  const segs = [
    [J.hips, J.spine, hips],
    [J.spine, J.chest, spine],
    [J.chest, J.neck, chest],
    [J.neck, J.head, neck],
    [J.head, J.top, head],
  ];
  for (const s of ['Left', 'Right']) {
    const { side, arm, fore, hand, up, leg, foot } = limbs[s];
    segs.push([side.shoulder, side.elbow, arm], [side.elbow, side.wrist, fore], [side.wrist, side.hand, hand], [side.hip, side.knee, up], [side.knee, side.ankle, leg], [side.ankle, side.toe, foot]);
  }
  const index = new Map(bones.map((b, i) => [b, i]));
  const skeleton = new THREE.Skeleton(bones);
  const group = new THREE.Group();
  group.add(hips);
  hips.updateMatrixWorld(true);
  skeleton.calculateInverses();

  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    // (in plain floats first: a compressed model keeps its positions in
    // small integers its node scales up, and metres don't fit in those)
    const g = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(o.geometry.attributes)) {
      const out = new Float32Array(attr.count * attr.itemSize);
      for (let i = 0; i < attr.count; i++) for (let c = 0; c < attr.itemSize; c++) out[i * attr.itemSize + c] = attr.getComponent(i, c);
      g.setAttribute(name, new THREE.BufferAttribute(out, attr.itemSize));
    }
    if (o.geometry.index) g.setIndex(o.geometry.index.clone());
    for (const grp of o.geometry.groups) g.addGroup(grp.start, grp.count, grp.materialIndex);
    g.applyMatrix4(o.matrixWorld);
    const pos = g.attributes.position;
    const si = new Uint16Array(pos.count * 4);
    const sw = new Float32Array(pos.count * 4);
    const p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      let best = 0;
      let bestD = Infinity;
      for (let k = 0; k < segs.length; k++) {
        // the arms reach for what's out to the side; the legs for what's low
        let d = segDist(p, segs[k][0], segs[k][1]);
        if (k >= 5 && (k - 5) % 6 < 3 && p.y < J.hips.y) d *= 1.6; // (an arm doesn't take the thigh beside it)
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      si[i * 4] = index.get(segs[best][2]);
      sw[i * 4] = 1;
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    const mesh = new THREE.SkinnedMesh(g, o.material);
    mesh.name = o.name;
    mesh.frustumCulled = false;
    mesh.bind(skeleton, new THREE.Matrix4());
    group.add(mesh);
  });
  return group;
}
