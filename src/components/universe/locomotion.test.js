import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createLocomotion, fallTurn, strideOf } from './locomotion';

const V = THREE.Vector3;

// a pair of legs that walk in place: each foot goes back along the ground
// for half the clip (planted), then up and forward (swinging)
function walker(speed = 1.2, dur = 1) {
  const root = new THREE.Group();
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  root.add(hips);
  const toes = ['LeftToeBase', 'RightToeBase'].map((n) => {
    const t = new THREE.Bone();
    t.name = n;
    hips.add(t);
    return t;
  });
  const times = [];
  const L = [];
  const R = [];
  const steps = 40;
  const half = (speed * dur) / 2; // ground covered while a foot's down
  const foot = (u) => (u < 0.5 ? [0, 0, half / 2 - (u / 0.5) * half] : [0, 0.12 * Math.sin(((u - 0.5) / 0.5) * Math.PI), -half / 2 + ((u - 0.5) / 0.5) * half]);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    times.push(u * dur);
    L.push(...foot(u));
    R.push(...foot((u + 0.5) % 1));
  }
  const clip = new THREE.AnimationClip('walk', dur, [new THREE.VectorKeyframeTrack('LeftToeBase.position', times, L), new THREE.VectorKeyframeTrack('RightToeBase.position', times, R)]);
  const mixer = new THREE.AnimationMixer(root);
  const walk = mixer.clipAction(clip);
  walk.play();
  return { root, mixer, walk, toes };
}

describe('a clip’s stride', () => {
  it('is the ground its planted foot covers a second, and when the left foot comes down', () => {
    const w = walker(1.2, 1);
    const s = strideOf(w.root, w.mixer, [w.walk], w.walk, w.toes);
    expect(s.speed).toBeCloseTo(1.2, 1);
    expect(s.dur).toBe(1);
    expect(s.plant).toBeGreaterThanOrEqual(0);
    expect(s.plant).toBeLessThan(1);
    // and in the parent's units, for a figure scaled down
    const small = walker(1.2, 1);
    small.root.scale.setScalar(0.5);
    expect(strideOf(small.root, small.mixer, [small.walk], small.walk, small.toes).speed).toBeCloseTo(0.6, 1);
  });
});

describe('pacing', () => {
  it('turns the stride over as fast as the ground goes by, backward when walking backward', () => {
    const w = walker(1.2, 1);
    const fig = { model: w.root };
    const loco = createLocomotion(fig, { mixer: w.mixer, act: { walk: w.walk }, root: w.root });
    expect(loco.strides.walk.speed).toBeCloseTo(1.2, 1);
    loco.update(0.1, { move: 0.3, speed: 0 }); // (standing: the clip held where the stride is)
    const t0 = w.walk.time;
    loco.update(0.1, { move: 0.3, speed: 1.2 }); // a walk at the clip's own speed: a tenth of the clip in a tenth of a second
    const d = (((w.walk.time - t0) % 1) + 1) % 1;
    expect(d).toBeCloseTo(0.1, 2);
    const t1 = w.walk.time;
    loco.update(0.1, { move: 0.3, speed: 2.4 }); // twice as fast over the ground: twice the stride
    expect((((w.walk.time - t1) % 1) + 1) % 1).toBeCloseTo(0.2, 2);
    const t2 = w.walk.time;
    loco.update(0.1, { move: 0.3, speed: -1.2 }); // backward
    expect((((t2 - w.walk.time) % 1) + 1) % 1).toBeCloseTo(0.1, 2);
  });
});

describe('a fall', () => {
  it('lays the figure down the way it was pushed, about its feet', () => {
    const up = new V(0, 1, 0);
    const dir = new V(1, 0, 0);
    expect(new V(0, 1, 0).applyQuaternion(fallTurn(0, dir, up)).y).toBeCloseTo(1, 6);
    const done = new V(0, 1, 0).applyQuaternion(fallTurn(1, dir, up));
    expect(done.x).toBeGreaterThan(0.95);
    expect(Math.abs(done.y)).toBeLessThan(0.1);
    // slow at first (the knees go), then quicker
    const early = new V(0, 1, 0).applyQuaternion(fallTurn(0.3, dir, up)).x;
    const late = new V(0, 1, 0).applyQuaternion(fallTurn(0.6, dir, up)).x;
    expect(early).toBeLessThan(late - early);
  });
});
