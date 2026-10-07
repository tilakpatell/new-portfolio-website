import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createLocomotion, fallTurn, strideCache, strideOf } from './locomotion';

const V = THREE.Vector3;

// a walk whose feet go back along the ground for half the clip (planted),
// then up and forward (swinging), covering `speed` a second
function walkClip(speed = 1.2, dur = 1) {
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
  return new THREE.AnimationClip('walk', dur, [new THREE.VectorKeyframeTrack('LeftToeBase.position', times, L), new THREE.VectorKeyframeTrack('RightToeBase.position', times, R)]);
}
// a still clip: the hips held as they stand
const stillClip = (name, dur = 2) => new THREE.AnimationClip(name, dur, [new THREE.QuaternionKeyframeTrack('Hips.quaternion', [0], [0, 0, 0, 1])]);

// a pair of legs that walk in place on `clip` (a walk of `speed` by default),
// with an idle beside it when asked; without toes when `toes` is false
function walker(speed = 1.2, dur = 1, { clip = null, idle = false, toes = true } = {}) {
  const root = new THREE.Group();
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  root.add(hips);
  const feet = toes
    ? ['LeftToeBase', 'RightToeBase'].map((n) => {
        const t = new THREE.Bone();
        t.name = n;
        hips.add(t);
        return t;
      })
    : [];
  const mixer = new THREE.AnimationMixer(root);
  const walk = mixer.clipAction(clip ?? (toes ? walkClip(speed, dur) : stillClip('walk', dur)));
  walk.play();
  const act = { walk };
  if (idle) {
    act.idle = mixer.clipAction(stillClip('idle'));
    act.idle.play();
  }
  return { root, mixer, walk, toes: feet, act };
}
const sum = (act) => Object.values(act).reduce((s, a) => s + a.getEffectiveWeight(), 0);
const advance = (from, to, dur = 1) => ((((to - from) % dur) + dur) % dur) / dur;

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

  it('is measured once per template', () => {
    const clip = walkClip(1.2, 1);
    const a = walker(1.2, 1, { clip });
    const b = walker(1.2, 1, { clip });
    const before = strideCache.size;
    const la = createLocomotion({ model: a.root }, { mixer: a.mixer, act: a.act, root: a.root, key: 'trooper' });
    const spy = vi.spyOn(b.mixer, 'update');
    const lb = createLocomotion({ model: b.root }, { mixer: b.mixer, act: b.act, root: b.root, key: 'trooper' });
    expect(spy).not.toHaveBeenCalled(); // (the second copy never played the clip through)
    expect(strideCache.size).toBe(before + 1);
    expect(strideCache.get(`${clip.uuid}:trooper`)).toBe(la.strides.walk);
    expect(lb.strides.walk).toBe(la.strides.walk);
    // another template measures its own; no key, no sharing
    const c = walker(1.2, 1, { clip });
    c.root.scale.setScalar(0.5);
    expect(createLocomotion({ model: c.root }, { mixer: c.mixer, act: c.act, root: c.root, key: 'small' }).strides.walk.speed).toBeCloseTo(0.6, 1);
    const d = walker(1.2, 1, { clip });
    createLocomotion({ model: d.root }, { mixer: d.mixer, act: d.act, root: d.root });
    expect(strideCache.size).toBe(before + 2);
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

  it('with no run clip, running plays the walk faster and the weights sum to 1', () => {
    const w = walker(1.2, 1, { idle: true });
    const loco = createLocomotion({ model: w.root }, { mixer: w.mixer, act: w.act, root: w.root });
    for (const move of [0, 0.2, 0.5, 0.7, 0.9, 1]) {
      loco.update(0.02, { move, speed: move * 3 });
      expect(sum(w.act), `move ${move}`).toBeCloseTo(1, 6);
    }
    expect(w.walk.getEffectiveWeight()).toBeGreaterThanOrEqual(0.99);
    // the walk turns over at the run's ground, not the walk's
    let t = w.walk.time;
    loco.update(0.05, { move: 0.3, speed: 1.2 });
    const walking = advance(t, w.walk.time);
    t = w.walk.time;
    loco.update(0.05, { move: 1, speed: 3 });
    expect(advance(t, w.walk.time) / walking).toBeCloseTo(2.5, 1);
    // and without a measured stride, at the old pace raised by the run's
    const n = walker(1.2, 1, { idle: true, toes: false });
    const blind = createLocomotion({ model: n.root }, { mixer: n.mixer, act: n.act, root: n.root });
    blind.update(0.02, { move: 0.5 });
    const half = n.walk.timeScale;
    blind.update(0.02, { move: 1 });
    expect(sum(n.act)).toBeCloseTo(1, 6);
    expect(n.walk.getEffectiveWeight()).toBeGreaterThanOrEqual(0.99);
    expect(n.walk.timeScale).toBeGreaterThan(half * 1.4);
  });

  it('with no walk, the idle takes its weight; with no idle, the walk', () => {
    const m = new THREE.AnimationMixer(new THREE.Group());
    const act = { idle: m.clipAction(stillClip('idle')), run: m.clipAction(stillClip('run')) };
    const loco = createLocomotion({ model: new THREE.Group() }, { mixer: m, act });
    loco.update(0.02, { move: 0.4 });
    expect(act.idle.getEffectiveWeight()).toBeCloseTo(1, 6);
    expect(sum(act)).toBeCloseTo(1, 6);
    loco.update(0.02, { move: 1 });
    expect(act.run.getEffectiveWeight()).toBeCloseTo(1, 6);
    const m2 = new THREE.AnimationMixer(new THREE.Group());
    const only = { walk: m2.clipAction(stillClip('walk')) };
    const l2 = createLocomotion({ model: new THREE.Group() }, { mixer: m2, act: only });
    for (const move of [0, 0.5, 1]) {
      l2.update(0.02, { move });
      expect(only.walk.getEffectiveWeight()).toBeCloseTo(1, 6);
    }
  });

  it('without toes, clipSpeed paces the walk', () => {
    const w = walker(1.2, 1, { idle: true, toes: false });
    const loco = createLocomotion({ model: w.root }, { mixer: w.mixer, act: w.act, root: w.root, clipSpeed: 1.4 });
    loco.update(0.02, { move: 0.5, speed: 2.8 });
    expect(w.walk.timeScale).toBeCloseTo(2, 1);
    expect(Math.abs(w.walk.timeScale - 2)).toBeLessThan(0.05);
    // in the root's parent's units, and backward
    const u = walker(1.2, 1, { idle: true, toes: false });
    const inUnits = createLocomotion({ model: u.root }, { mixer: u.mixer, act: u.act, root: u.root, unit: 10, clipSpeed: 1.4 });
    inUnits.update(0.02, { move: 0.5, speed: -14 });
    expect(u.walk.timeScale).toBeCloseTo(-1, 2);
    // a caller that knows only `move` keeps the old pace, never NaN
    loco.update(0.02, { move: 0.5 });
    expect(w.walk.timeScale).toBeCloseTo(0.8 + 0.5 * 0.4, 6);
    loco.update(0, { move: 0.5, speed: 2.8 });
    expect(Number.isFinite(w.walk.timeScale)).toBe(true);
  });

  it('a 1 s frame doesn’t jump the phase more than 0.1 s of ground', () => {
    const w = walker(1.2, 1);
    const loco = createLocomotion({ model: w.root }, { mixer: w.mixer, act: w.act, root: w.root });
    loco.update(0.02, { move: 0.3, speed: 1.2 });
    const t = w.walk.time;
    loco.update(1, { move: 0.3, speed: 1.2 });
    expect(advance(t, w.walk.time)).toBeCloseTo(0.1, 2);
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
