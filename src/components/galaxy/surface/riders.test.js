import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { RIDES } from './rides';
import { SEATS, poseRider, seatPoints } from './riders';

const V = THREE.Vector3;

// a stick rider on Meshy's bone names: hips, a spine, two arms, two legs,
// standing at the origin facing +z (+x its left), about 1.8 m tall
function stickRider() {
  const bone = (name, at, parent) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(...at);
    parent?.add(b);
    return b;
  };
  const root = new THREE.Group();
  const hips = bone('Hips', [0, 0.95, 0], root);
  const spine = bone('Spine', [0, 0.1, 0], hips);
  const spine01 = bone('Spine01', [0, 0.15, 0], spine);
  const spine02 = bone('Spine02', [0, 0.15, 0], spine01);
  const neck = bone('neck', [0, 0.15, 0], spine02);
  bone('Head', [0, 0.1, 0], neck);
  const bones = { Hips: hips, Spine: spine, Spine01: spine01, Spine02: spine02, neck };
  for (const [s, x] of [
    ['Left', 1],
    ['Right', -1],
  ]) {
    const sh = bone(`${s}Shoulder`, [x * 0.05, 0.1, 0], spine02);
    const arm = bone(`${s}Arm`, [x * 0.15, 0, 0], sh);
    const fore = bone(`${s}ForeArm`, [0, -0.28, 0], arm);
    const hand = bone(`${s}Hand`, [0, -0.26, 0], fore);
    const up = bone(`${s}UpLeg`, [x * 0.1, -0.05, 0], hips);
    const leg = bone(`${s}Leg`, [0, -0.43, 0], up);
    const foot = bone(`${s}Foot`, [0, -0.42, 0], leg);
    const toe = bone(`${s}ToeBase`, [0, -0.05, 0.12], foot);
    Object.assign(bones, { [`${s}Shoulder`]: sh, [`${s}Arm`]: arm, [`${s}ForeArm`]: fore, [`${s}Hand`]: hand, [`${s}UpLeg`]: up, [`${s}Leg`]: leg, [`${s}Foot`]: foot, [`${s}ToeBase`]: toe });
  }
  return { root, bones };
}
const world = (o) => o.getWorldPosition(new V());

describe('riders', () => {
  it('has a seat for every ride you sit astride or in, and none for one it can’t know', () => {
    for (const kind of Object.keys(SEATS)) expect(RIDES[kind], kind).toBeTruthy();
    for (const seat of Object.values(SEATS)) {
      expect(seat.hips).toHaveLength(3);
      expect(seat.hands[0]).toHaveLength(3);
      expect(seat.feet[0]).toHaveLength(3);
      // the hands over the feet, the hips over the feet
      expect(seat.hands[0][1]).toBeGreaterThan(seat.feet[0][1]);
      expect(seat.hips[1]).toBeGreaterThan(seat.feet[0][1]);
    }
  });

  it('mirrors the left side for the right, and turns with the ride', () => {
    const m = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(10, 1, -4);
    const p = seatPoints(SEATS.speederbike, m);
    // (the ride turned a quarter left: its nose along +x, its left along -z)
    expect(p.fwd.x).toBeCloseTo(1, 6);
    expect(p.left.z).toBeCloseTo(-1, 6);
    expect(p.hips.x).toBeCloseTo(10 + SEATS.speederbike.hips[2], 6);
    // both grips the same height, either side of the bike
    expect(p.hands[0].y).toBeCloseTo(p.hands[1].y, 6);
    expect(p.hands[0].z).toBeCloseTo(-4 - SEATS.speederbike.hands[0][0], 6);
    expect(p.hands[1].z).toBeCloseTo(-4 + SEATS.speederbike.hands[0][0], 6);
  });

  it('puts the hips on the seat and the hands and feet where the ride has them', () => {
    const { root, bones } = stickRider();
    const scene = new THREE.Scene();
    const holder = new THREE.Group();
    holder.add(root);
    scene.add(holder);
    const m = new THREE.Matrix4().makeRotationY(0.7).setPosition(3, 1.0, 2);
    const seat = SEATS.speederbike;
    expect(poseRider({ bones }, holder, m, seat)).toBe(true);
    const p = seatPoints(seat, m);
    expect(world(bones.Hips).distanceTo(p.hips)).toBeLessThan(1e-4);
    // the wrists a palm short of the grips, the ankles a heel over the pegs
    for (const [s, i] of [
      ['Left', 0],
      ['Right', 1],
    ]) {
      expect(world(bones[`${s}Hand`]).distanceTo(p.hands[i])).toBeLessThan(0.12);
      expect(world(bones[`${s}Foot`]).distanceTo(p.feet[i])).toBeLessThan(0.12);
    }
    // the left hand on the bike's left
    const toLeft = (o) => world(o).sub(p.hips).dot(p.left);
    expect(toLeft(bones.LeftHand)).toBeGreaterThan(0.1);
    expect(toLeft(bones.RightHand)).toBeLessThan(-0.1);
    // leant forward: the neck ahead of the hips
    expect(world(bones.neck).sub(p.hips).dot(p.fwd)).toBeGreaterThan(0.1);
  });

  it('leaves a figure it can’t pose alone', () => {
    const holder = new THREE.Group();
    new THREE.Scene().add(holder);
    expect(poseRider({ bones: {} }, holder, new THREE.Matrix4(), SEATS.tauntaun)).toBe(false);
    expect(poseRider(null, holder, new THREE.Matrix4(), SEATS.tauntaun)).toBe(false);
    expect(holder.position.length()).toBe(0);
  });
});
