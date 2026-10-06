import { describe, expect, it } from 'vitest';
import { JOINTS, POSED, TRIPLE_FRAMES, poseFor } from './pose';
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
