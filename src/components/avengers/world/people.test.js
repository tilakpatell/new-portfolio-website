import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { clipsFor } from './people';
import { GAIT, HERO, gaitFor } from './rules';

// a model of one bone, and clips that move it (walk a second long, run 0.6 s)
const rig = () => {
  const model = new THREE.Object3D();
  const bone = new THREE.Object3D();
  bone.name = 'b';
  model.add(bone);
  const clip = (name, d) => new THREE.AnimationClip(name, d, [new THREE.NumberKeyframeTrack('b.position[x]', [0, d], [0, 1])]);
  return { model, clips: [clip('idle', 2), clip('walk', 1), clip('run', 0.6), clip('jump', 1.5)] };
};

describe('clipsFor', () => {
  it('goes from a walk to a run at the same point of the stride', () => {
    const { model, clips } = rig();
    const c = clipsFor(model, clips);
    c.play('walk');
    c.update(0.25); // a quarter of the walk's step
    c.play('run');
    expect(c.actions.run.time).toBeCloseTo(0.25 * 0.6, 5);
    c.update(0.1);
    c.play('walk');
    expect(c.actions.walk.time / 1).toBeCloseTo(c.actions.run.time / 0.6, 5);
  });

  it("starts anything else where it's asked", () => {
    const { model, clips } = rig();
    const c = clipsFor(model, clips);
    c.play('walk');
    c.update(0.4);
    c.play('jump', { loop: false, from: 0.5 });
    expect(c.actions.jump.time).toBeCloseTo(0.5, 5);
    c.play('idle');
    expect(c.actions.idle.time).toBe(0);
  });

  it('takes clips made for it later, and says when a one-shot has played through', () => {
    const { model, clips } = rig();
    const c = clipsFor(model, clips);
    const wave = new THREE.AnimationClip('wave', 0.8, [new THREE.NumberKeyframeTrack('b.position[y]', [0, 0.8], [0, 1])]);
    expect(c.play('wave')).toBe(false);
    c.add(wave);
    c.play('idle');
    expect(c.play('wave', { loop: false, fade: 0.5 })).toBe(true);
    expect(c.playing).toBe('wave');
    expect(c.finished('wave')).toBe(false);
    c.update(0.25);
    // (still fading in over its half second)
    expect(c.actions.wave.getEffectiveWeight()).toBeLessThan(1);
    c.update(0.75);
    expect(c.finished('wave')).toBe(true);
    // asked again once it's over, it plays again from the start
    c.play('wave', { loop: false, again: true });
    expect(c.finished('wave')).toBe(false);
    expect(c.actions.wave.time).toBe(0);
    // its own clip of a name is kept over one made for it
    const own = c.actions.idle;
    c.add(new THREE.AnimationClip('idle', 1, []));
    expect(c.actions.idle).toBe(own);
    expect(c.finished('idle')).toBe(false);
  });

  it("doesn't start a clip over when it's taken back before it has faded out", () => {
    const { model, clips } = rig();
    const c = clipsFor(model, clips);
    c.play('idle');
    c.update(1.2);
    c.play('jump', { loop: false });
    c.update(0.05); // idle is still fading out
    c.play('idle');
    expect(c.actions.idle.time).toBeGreaterThan(1);
  });
});

describe('gaitFor', () => {
  const line = (GAIT.up + GAIT.down) / 2;

  it('never walks faster than the walk clip can step, nor runs slower than the run can', () => {
    // speeding up from a standstill to flat out, and easing off again
    const speeds = [];
    for (let v = 0; v <= HERO.run; v += 0.05) speeds.push(v);
    for (let v = HERO.run; v >= 0; v -= 0.05) speeds.push(v);
    let g = 'idle';
    for (const v of speeds) {
      g = gaitFor(g, v);
      if (g === 'walk') expect(v / GAIT.walk).toBeLessThanOrEqual(GAIT.rates.walk[1]);
      if (g === 'run') expect(v / GAIT.run).toBeGreaterThanOrEqual(GAIT.rates.run[0]);
    }
    // and his plain walk is a walk
    expect(gaitFor('walk', HERO.walk)).toBe('walk');
    expect(gaitFor('run', HERO.walk)).toBe('walk');
  });

  it('picks the clip for the speed', () => {
    expect(gaitFor(null, 0)).toBe('idle');
    expect(gaitFor(null, HERO.walk)).toBe('walk');
    expect(gaitFor(null, HERO.run)).toBe('run');
    expect(gaitFor('jump', HERO.walk)).toBe('walk');
  });

  it("doesn't flick between two clips at the line between them", () => {
    // speed wobbling either side of the walk-run line: one change, not one a frame
    let g = 'walk';
    const seen = [];
    for (let i = 0; i < 40; i++) {
      g = gaitFor(g, line + Math.sin(i) * 0.18);
      seen.push(g);
    }
    expect(new Set(seen).size).toBe(1);
    // and the same from a standstill
    g = 'idle';
    for (let i = 0; i < 40; i++) g = gaitFor(g, 0.4 + Math.sin(i) * 0.05);
    expect(g).toBe('idle');
  });

  it('changes once well past the line', () => {
    expect(gaitFor('walk', line + 1)).toBe('run');
    expect(gaitFor('run', line - 1)).toBe('walk');
    expect(gaitFor('idle', 1)).toBe('walk');
    expect(gaitFor('walk', 0.1)).toBe('idle');
  });
});
