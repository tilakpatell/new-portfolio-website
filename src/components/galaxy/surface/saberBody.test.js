import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createSaberBody } from './saberBody';

// clips whose hips stand where in the clip they are: x is the clip's time
// (the lunge's), or 100 + its time (the guard's), so the bones say what
// was laid over them and how much
const HIPS = 90;
const clip = (name, dur, at) => {
  const times = [];
  const values = [];
  for (let t = 0; t <= dur + 1e-9; t += 1 / 30) {
    times.push(t);
    values.push(at(t), HIPS, 0);
  }
  const c = new THREE.AnimationClip(name, dur, [new THREE.VectorKeyframeTrack('Hips.position', times, values)]);
  c.userData = { hips: HIPS, strike: 0.4, back: 0.93 };
  return c;
};
const clips = { idle: clip('Sword_Idle', 1.6, (t) => 100 + t), attack: clip('Sword_Attack', 1.5, (t) => t) };
const figure = () => {
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  return { bones: { Hips: hips }, hipsY: HIPS };
};
const STROKE = { dur: 0.38, lead: 0.5, heavy: false };

describe('saberBody', () => {
  it('stays off the figure until the blade is lit, then comes on', () => {
    const fig = figure();
    const body = createSaberBody(fig, clips);
    body.update(1 / 60, 0, { lit: false });
    expect(fig.bones.Hips.position.x).toBe(0);
    for (let i = 0; i < 120; i++) body.update(1 / 60, i / 60, { lit: true });
    expect(fig.bones.Hips.position.x).toBeGreaterThan(99); // (the guard's, all the way)
  });

  it('gives way to the walk', () => {
    const fig = figure();
    const body = createSaberBody(fig, clips);
    for (let i = 0; i < 120; i++) {
      fig.bones.Hips.position.x = 0; // (as the mixer leaves it each frame)
      body.update(1 / 60, i / 60, { lit: true, move: 0.6 });
    }
    expect(fig.bones.Hips.position.x).toBe(0);
  });

  it("strikes on the stroke's lead, holds the lunge down through a chain, and comes back up after", () => {
    const fig = figure();
    const body = createSaberBody(fig, clips);
    const at = (now, swing) => {
      fig.bones.Hips.position.x = 0;
      body.update(1 / 60, now, { lit: true, swing });
      return fig.bones.Hips.position.x;
    };
    const first = { ...STROKE, t0: 1 };
    let now = 0;
    for (; now < 1; now += 1 / 60) at(now, null);
    for (; now < 1 + STROKE.lead * STROKE.dur; now += 1 / 60) at(now, first);
    expect(at(1 + STROKE.lead * STROKE.dur, first)).toBeCloseTo(0.4, 1); // (the clip's strike)
    // chained on: held down, never back up to the wind-up
    const second = { ...STROKE, t0: 1.4 };
    let low = Infinity;
    for (now = 1.4; now < 1.78; now += 1 / 60) low = Math.min(low, at(now, second));
    expect(low).toBeGreaterThan(0.39); // (where the first left it, or on down)
    expect(at(1.78, second)).toBeLessThanOrEqual(0.75 + 1e-6);
    // none: it plays on and goes, back to the guard
    for (now = 1.8; now < 3; now += 1 / 60) at(now, null);
    expect(at(3, null)).toBeGreaterThan(99);
  });

  it('starts a new lunge once the last is coming back up, the last going out under it', () => {
    const fig = figure();
    const body = createSaberBody(fig, clips);
    const at = (now, swing) => {
      fig.bones.Hips.position.x = 0;
      body.update(1 / 60, now, { lit: true, swing });
      return fig.bones.Hips.position.x;
    };
    for (let now = 0; now < 1; now += 1 / 60) at(now, null);
    const first = { ...STROKE, t0: 1 };
    for (let now = 1; now < 1.38; now += 1 / 60) at(now, first);
    let last = 0;
    for (let now = 1.38; now < 1.6; now += 1 / 60) last = at(now, null); // (up past the hold)
    const next = { ...STROKE, t0: 1.6 };
    let jump = 0;
    for (let now = 1.6; now < 1.9; now += 1 / 60) {
      const x = at(now, next);
      jump = Math.max(jump, Math.abs(x - last));
      last = x;
    }
    expect(jump).toBeLessThan(0.15); // (no snap: a crossfade)
    expect(last).toBeCloseTo(0.22 + 0.3 * ((0.4 - 0.22) / (0.5 * 0.38)), 1);
  });
});
