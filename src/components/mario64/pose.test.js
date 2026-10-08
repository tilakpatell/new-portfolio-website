import { describe, expect, it } from 'vitest';
import { JOINTS, POSED, SLEEP_AFTER, TRIPLE_FRAMES, poseFor, stepAt } from './pose';
import { ACTION_NAMES } from './rules/mario';

const finite = (p) => {
  for (const j of JOINTS) for (const v of p.joints[j]) if (!Number.isFinite(v)) return false;
  return [...p.spin, ...p.offset, p.lift, p.squash].every(Number.isFinite);
};

describe('Mario\'s poses', () => {
  it.each(ACTION_NAMES)('has a pose for %s, every value finite, every joint there', (action) => {
    expect(POSED).toContain(action);
    for (const t of [0, 1, 5, 12, 30, 90]) {
      const p = poseFor(action, t, { fwd: 20, phase: t * 0.3, arg: 0, pitch: 0.2 });
      expect(Object.keys(p.joints).sort()).toEqual([...JOINTS].sort());
      expect(finite(p), `${action} at ${t}`).toBe(true);
    }
  });

  it('turns the triple jump a whole forward flip over its rise', () => {
    expect(poseFor('triple', 0).spin[0]).toBeCloseTo(0);
    expect(Math.abs(poseFor('triple', TRIPLE_FRAMES).spin[0])).toBeCloseTo(Math.PI * 2, 1);
    expect(Math.abs(poseFor('triple', TRIPLE_FRAMES + 20).spin[0])).toBeCloseTo(Math.PI * 2, 1);
  });

  it('swings the legs opposite each other as he runs', () => {
    const p = poseFor('walk', 10, { fwd: 32, phase: 1.2 });
    expect(Math.sign(p.joints.legL[0])).toBe(-Math.sign(p.joints.legR[0]));
  });

  it('hangs him below a ledge, and lifts him onto it as he climbs', () => {
    expect(poseFor('ledge', 3).offset[1]).toBeLessThan(-1);
    expect(poseFor('climb', 10).offset[1]).toBeCloseTo(0, 1);
  });
});

describe('a foot through its stride (stepAt)', () => {
  const TAU = Math.PI * 2;
  it('goes back under him at an even pace while it is down, and forward again in the air', () => {
    // down from phase π/2 (planted ahead) to 3π/2 (behind): a straight line
    const n = 20;
    const at = Array.from({ length: n + 1 }, (_, i) => stepAt(Math.PI / 2 + (i / n) * Math.PI));
    expect(at[0]).toBeCloseTo(1);
    expect(at[n]).toBeCloseTo(-1);
    for (let i = 1; i <= n; i++) expect(at[i] - at[i - 1]).toBeCloseTo(-2 / n, 9);
    // up: from behind to ahead, never further than a tenth past either end
    for (let i = 0; i <= 40; i++) {
      const v = stepAt((3 * Math.PI) / 2 + (i / 40) * Math.PI);
      expect(Math.abs(v)).toBeLessThan(1.1);
    }
    expect(stepAt(TAU)).toBeCloseTo(0); // (passing under him)
    expect(stepAt(Math.PI / 2 - 0.05)).toBeGreaterThan(0.9); // (nearly ahead again)
  });

  it('never jumps: it lifts off and comes down at the pace it moved while down', () => {
    const d = 1e-4;
    for (const at of [Math.PI / 2, (3 * Math.PI) / 2]) {
      const before = (stepAt(at) - stepAt(at - d)) / d;
      const after = (stepAt(at + d) - stepAt(at)) / d;
      expect(Math.abs(stepAt(at + d) - stepAt(at - d))).toBeLessThan(1e-3);
      expect(after).toBeCloseTo(before, 2);
    }
  });

  it('given a swing, reaches each leg as far as it says, the two opposite', () => {
    const swing = 0.6;
    let most = 0;
    for (let i = 0; i < 64; i++) {
      const phase = (i / 64) * TAU;
      const p = poseFor('walk', 0, { fwd: 20, phase, swing, amount: 1 });
      most = Math.max(most, -p.joints.legL[0]);
      // one ahead while the other is behind, but at the ends of the step
      if (Math.abs(Math.sin(phase)) > 0.3) expect(Math.sign(p.joints.legL[0])).toBe(-Math.sign(p.joints.legR[0]));
    }
    // a little past the swing as the foot reaches for the ground, never far
    expect(most).toBeGreaterThan(swing);
    expect(most).toBeLessThan(swing * 1.15);
    // standing (amount 0), the legs hang
    const still = poseFor('walk', 0, { fwd: 0, phase: 1, swing, amount: 0 });
    expect(still.joints.legL[0]).toBeCloseTo(0);
  });

  it('sits him down to nod off after a long while stood still, as in the game', () => {
    expect(poseFor('idle', 60).lift).toBeGreaterThan(-0.05);
    expect(poseFor('idle', SLEEP_AFTER + 120).lift).toBeLessThan(-0.3);
  });
});
