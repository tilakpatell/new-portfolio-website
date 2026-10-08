// Sitting on what you ride, properly: the hips on its seat, the hands on
// its bars, its reins or its wheel, the feet on its pegs or down its flanks,
// the back leaning as a rider's does. Each ride's points are measured off
// its own model (in the ride's frame: +z its nose, +x its left, y up from
// its underside, in metres), and the rider's limbs are put on them by
// two-bone IK (lib/three/ik.js) over whatever sat clip it's on, every frame
// after its animator's done.
//
// SEATS[kind] → { hips, lean, hands: [left, right], feet: [left, right],
//   elbow, knee, toes } (a hand or a foot of the left side; the right's is
//   its mirror, unless both are given). elbow, knee: which way each bends
//   for the left side, in the ride's frame (the right's mirrored); toes:
//   which way the feet point, likewise.
// seatPoints(seat, matrix) → { hips, hands, feet, elbows, knees, toes, lean,
//   fwd, up, left } in the world (pure: tested in Node)
// poseRider(fig, holder, matrix, seat, w = 1): the figure (bones by name, on
//   Meshy's skeleton) in `holder` moved so its hips are on the seat, then
//   leant and reached; false for a figure it can't pose (no hips: the old
//   stand-in is left as it was)

import * as THREE from 'three';
import { aimBone, reach, rotateWorld } from '../../../lib/three/ik';

// (the 74-Z's grips are 13 cm over its saddle and its pedals behind the
// knee, so its rider sits as a racer does, low over the bars; the
// landspeeder's driver sits down in the left of its cockpit, the wheel
// before him and his feet under the dash; on a beast, astride it, the
// reins in both hands and the feet down its flanks)
export const SEATS = {
  speederbike: { hips: [0, 0.8, -0.66], lean: 0.85, hands: [[0.2, 0.93, -0.12]], feet: [[0.33, 0.15, -0.84]], elbow: [0.7, -0.5, -0.4], knee: [0.45, 0.1, 1], toes: [0.15, -0.35, 1] },
  landspeeder: { hips: [-0.24, 0.4, -0.2], lean: 0.08, hands: [[-0.12, 0.46, 0.03], [-0.34, 0.46, 0.03]], feet: [[-0.15, 0.09, 0.45], [-0.33, 0.09, 0.45]], elbow: [0.5, -0.8, -0.2], knee: [0.15, 0.6, 1], toes: [0, 0.3, 1] },
  tauntaun: { hips: [0, 1.88, 0.18], lean: 0.18, hands: [[0.12, 2.0, 0.52]], feet: [[0.45, 1.3, 0.26]], elbow: [0.5, -0.8, -0.3], knee: [0.8, 0, 0.6], toes: [0.2, -0.2, 1] },
  bantha: { hips: [0, 2.6, 0.65], lean: 0.12, hands: [[0.15, 2.75, 1.05]], feet: [[0.75, 1.9, 0.8]], elbow: [0.5, -0.8, -0.3], knee: [0.9, -0.1, 0.5], toes: [0.2, -0.2, 1] },
  kaadu: { hips: [0, 2.05, -0.1], lean: 0.15, hands: [[0.12, 2.15, 0.3]], feet: [[0.3, 1.35, -0.05]], elbow: [0.5, -0.8, -0.3], knee: [0.8, 0, 0.6], toes: [0.2, -0.2, 1] },
};

const v = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const mirror = (a) => [-a[0], a[1], a[2]];
const both = (list) => [list[0], list[1] ?? mirror(list[0])];

export function seatPoints(seat, matrix) {
  const at = (a) => v(a).applyMatrix4(matrix);
  const dir = (a) => v(a).transformDirection(matrix);
  return {
    hips: at(seat.hips),
    hands: both(seat.hands).map(at),
    feet: both(seat.feet).map(at),
    elbows: [dir(seat.elbow), dir(mirror(seat.elbow))],
    knees: [dir(seat.knee), dir(mirror(seat.knee))],
    toes: [dir(seat.toes), dir(mirror(seat.toes))],
    lean: seat.lean ?? 0,
    fwd: dir([0, 0, 1]),
    up: dir([0, 1, 0]),
    left: dir([1, 0, 0]),
  };
}

// the wrist sits a palm short of what the hand holds, the ankle a heel over
// what the foot stands on (m)
const PALM = 0.07;
const HEEL = 0.08;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _t = new THREE.Vector3();

export function poseRider(fig, holder, matrix, seat, w = 1) {
  const bones = fig?.bones;
  const hips = bones?.Hips;
  if (!hips || !holder?.parent) return false;
  const p = seatPoints(seat, matrix);
  // the hips on the seat: the holder moved by however far they're off it,
  // in its parent's space (a rider on a walker is in the walker's)
  holder.updateMatrixWorld(true);
  hips.getWorldPosition(_a);
  holder.parent.worldToLocal(_b.copy(p.hips));
  holder.parent.worldToLocal(_a);
  holder.position.add(_b.sub(_a));
  holder.updateMatrixWorld(true);
  // leant forward from the hips, most of it low in the back, the head kept up
  if (p.lean) {
    rotateWorld(bones.Spine, p.left, p.lean * 0.45 * w);
    rotateWorld(bones.Spine01, p.left, p.lean * 0.3 * w);
    rotateWorld(bones.Spine02, p.left, p.lean * 0.25 * w);
    rotateWorld(bones.neck, p.left, -p.lean * 0.6 * w);
  }
  const sides = [
    ['Left', 0],
    ['Right', 1],
  ];
  for (const [s, i] of sides) {
    const shoulder = bones[`${s}Arm`];
    const hand = bones[`${s}Hand`];
    if (shoulder && hand) {
      // (the wrist a palm back toward the shoulder from the grip)
      shoulder.getWorldPosition(_a);
      _t.copy(p.hands[i]).addScaledVector(_b.copy(_a).sub(p.hands[i]).normalize(), PALM);
      reach(shoulder, bones[`${s}ForeArm`], hand, _t, p.elbows[i], w);
    }
    const thigh = bones[`${s}UpLeg`];
    const foot = bones[`${s}Foot`];
    if (thigh && foot) {
      _t.copy(p.feet[i]).addScaledVector(p.up, HEEL);
      reach(thigh, bones[`${s}Leg`], foot, _t, p.knees[i], w);
      const toe = bones[`${s}ToeBase`];
      if (toe) aimBone(foot, toe, p.toes[i], w);
    }
  }
  return true;
}
