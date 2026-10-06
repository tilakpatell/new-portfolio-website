import { describe, expect, it } from 'vitest';
import { poseFor } from '../pose';
import { limbTargets } from './limbs';

const len = (v) => Math.hypot(...v);

describe('Mario 64: pose.js as limb directions, for a rigged model', () => {
  it('stands with every limb hanging down, the arms a little out to their own side', () => {
    const t = limbTargets(poseFor('idle', 0));
    for (const k of ['armL', 'foreL', 'armR', 'foreR', 'thighL', 'calfL', 'thighR', 'calfR']) {
      expect(len(t[k]), k).toBeCloseTo(1, 5);
      expect(t[k][1], k).toBeLessThan(-0.9);
    }
    // +x is his left
    expect(t.armL[0]).toBeGreaterThan(0.05);
    expect(t.armR[0]).toBeLessThan(-0.05);
    // feet ahead
    expect(t.footL[2]).toBeGreaterThan(0.5);
  });

  it('swings a leg ahead and the other arm with it as he runs, and leans in', () => {
    const t = limbTargets(poseFor('walk', 0, { fwd: 32, phase: -Math.PI / 2 }));
    // sin(phase) = -1: legL[0] = 0.95 (back), legR[0] = -0.95 (ahead)
    expect(t.thighR[2]).toBeGreaterThan(0.5);
    expect(t.thighL[2]).toBeLessThan(-0.5);
    expect(t.armL[2]).toBeGreaterThan(0.3);
    expect(t.armR[2]).toBeLessThan(-0.3);
    expect(t.torso.pitch).toBeGreaterThan(0.1);
  });

  it('carries the spine’s turn into the arms that hang from it', () => {
    const p = poseFor('idle', 0);
    p.joints.spine[0] = Math.PI / 2; // bent double, forward
    const t = limbTargets(p);
    // the arms hang from the shoulders: bent forward, they point back along him
    expect(t.armL[2]).toBeLessThan(-0.9);
    // the legs don't follow
    expect(t.thighL[1]).toBeLessThan(-0.9);
  });
});
