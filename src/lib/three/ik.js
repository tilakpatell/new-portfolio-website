// Two-bone IK and the frames a held thing sits in: the math that puts a
// figure's hand where a gun's grip is and turns its bones in world space,
// whatever the skeleton's rest pose. Pure three.js math (no scene), so it's
// tested in Node. universe/gunplay.js uses it on Meshy's skeleton and on
// the figures built from shapes alike.

import * as THREE from 'three';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _n = new THREE.Vector3();
const _u = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _d = new THREE.Vector3(); // (a direction handed to aimBone, which has temporaries of its own)
const _e = new THREE.Vector3();

// The elbow of a two-bone chain from `S` (the shoulder) reaching for `T`,
// with bones `a` (upper) and `b` (fore) long, bent toward `pole` (a world
// direction: which way the elbow goes). Out of reach, the chain straightens
// onto the line; closer than |a − b|, it folds as far as it can.
export function elbowFor(S, T, a, b, pole, out = new THREE.Vector3()) {
  _n.copy(T).sub(S);
  let d = _n.length();
  if (d < 1e-9) {
    _n.set(0, 0, 1);
    d = 1e-9;
  } else _n.divideScalar(d);
  const far = (a + b) * 0.9995;
  const near = Math.abs(a - b) + 1e-6;
  d = Math.min(far, Math.max(near, d));
  const cosA = Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)));
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  // the pole, squared up to the shoulder–target line
  _u.copy(pole).addScaledVector(_n, -pole.dot(_n));
  if (_u.lengthSq() < 1e-10) _u.set(0, -1, 0).addScaledVector(_n, _n.y); // (any way across it)
  if (_u.lengthSq() < 1e-10) _u.set(1, 0, 0).addScaledVector(_n, -_n.x);
  _u.normalize();
  return out.copy(S).addScaledVector(_n, a * cosA).addScaledVector(_u, a * sinA);
}

// Turn `bone` so the line from it to `child` lies along `dir` (world), `w`
// of the way (0 leaves it, 1 all the way).
export function aimBone(bone, child, dir, w = 1) {
  if (!bone || !child || w <= 0) return;
  bone.updateWorldMatrix(true, false);
  child.updateWorldMatrix(false, false);
  bone.getWorldPosition(_a);
  child.getWorldPosition(_b);
  _b.sub(_a);
  if (_b.lengthSq() < 1e-12) return;
  _b.normalize();
  _q.setFromUnitVectors(_b, _u.copy(dir).normalize());
  bone.getWorldQuaternion(_q2);
  _q2.premultiply(_q); // the bone's turn in the world, once pointed
  bone.parent.getWorldQuaternion(_q).invert();
  _q2.premultiply(_q); // and in its parent's
  bone.quaternion.slerp(_q2, Math.min(1, w));
  bone.updateWorldMatrix(false, true);
}

// Set a bone's orientation in the world to `q`, `w` of the way.
export function setWorldQuaternion(bone, q, w = 1) {
  if (!bone || w <= 0) return;
  bone.parent.updateWorldMatrix(true, false);
  bone.parent.getWorldQuaternion(_q).invert();
  _q.multiply(q); // parent⁻¹ · q
  bone.quaternion.slerp(_q, Math.min(1, w));
  bone.updateWorldMatrix(false, true);
}

// Turn `bone` about a world axis by `angle` (radians), `w` of the way, on
// top of whatever pose it has: local' = parent⁻¹ · R · parent · local.
export function rotateWorld(bone, axis, angle, w = 1) {
  if (!bone || w <= 0 || !angle) return;
  bone.parent.updateWorldMatrix(true, false);
  bone.parent.getWorldQuaternion(_q2);
  _q.setFromAxisAngle(_u.copy(axis).normalize(), angle * Math.min(1, w));
  _q.premultiply(_q2.clone().invert()).multiply(_q2);
  bone.quaternion.premultiply(_q);
  bone.updateWorldMatrix(false, true);
}

// A two-bone chain of Object3Ds (`upper` → `fore` → `hand`, each the
// other's child) reaching to put `hand` at `target` (world), the elbow
// toward `pole`, `w` of the way from where the clip left it.
export function reach(upper, fore, hand, target, pole, w = 1) {
  if (!upper || !fore || !hand || w <= 0) return;
  upper.updateWorldMatrix(true, true);
  const S = upper.getWorldPosition(new THREE.Vector3());
  const E0 = fore.getWorldPosition(new THREE.Vector3());
  const H0 = hand.getWorldPosition(new THREE.Vector3());
  const a = E0.distanceTo(S);
  const b = H0.distanceTo(E0);
  if (a < 1e-9 || b < 1e-9) return;
  const E = elbowFor(S, target, a, b, pole);
  aimBone(upper, fore, _d.copy(E).sub(S), w);
  fore.getWorldPosition(_e);
  aimBone(fore, hand, _d.copy(target).sub(_e), w);
}

// The orientation with +z along `forward` and +y as near `up` as it can be.
export function frameFrom(forward, up, out = new THREE.Quaternion()) {
  _n.copy(forward).normalize();
  _u.copy(up).addScaledVector(_n, -up.dot(_n));
  if (_u.lengthSq() < 1e-10) _u.set(0, 1, 0).addScaledVector(_n, -_n.y);
  if (_u.lengthSq() < 1e-10) _u.set(1, 0, 0);
  _u.normalize();
  _a.crossVectors(_u, _n); // right = up × forward (a right-handed frame with +z forward)
  _m.makeBasis(_a, _u, _n);
  return out.setFromRotationMatrix(_m);
}

// Which way a hand is, from its vertices in the hand bone's own space
// (points: [[x, y, z], …]): the palm's normal is the axis the cloud is
// thinnest along, the fingers run along the longest, the knuckles across
// the third. `toward` (a direction in the same space) signs the normal, if
// given; otherwise it's whichever way is positive. The axes are the bone's
// own (not fitted), which is what a grip offset wants.
export function palmFrame(points, toward = null) {
  const n = points.length || 1;
  const mean = [0, 0, 0];
  for (const p of points) for (let i = 0; i < 3; i++) mean[i] += p[i] / n;
  const v = [0, 0, 0];
  for (const p of points) for (let i = 0; i < 3; i++) v[i] += (p[i] - mean[i]) ** 2;
  const order = [0, 1, 2].sort((i, j) => v[i] - v[j]); // thinnest first
  const axis = (i, sign = 1) => new THREE.Vector3().setComponent(i, sign);
  const normal = axis(order[0]);
  if (toward) normal.multiplyScalar(toward[order[0]] < 0 ? -1 : 1);
  return { normal, along: axis(order[2]), across: axis(order[1]), spread: v, mean };
}

// One step of a damped spring pulling `s.x` back to 0 with velocity `s.v`:
// stiffness `k`, damping `c` (both per second). Semi-implicit, so it holds
// up at a coarse frame.
export function spring(s, dt, k, c) {
  dt = Math.min(dt, 0.05);
  s.v += (-k * s.x - c * s.v) * dt;
  s.x += s.v * dt;
  return s;
}
