import { describe, expect, it } from 'vitest';
import { channelFate, folded, qmul, qrot, resample, sameAs, travel } from './rig-clips.mjs';

const QUARTER = [0, -Math.SQRT1_2, 0, Math.SQRT1_2]; // a quarter turn about y, the way the game's trajectory carries it

describe('a rig’s clips, packed', () => {
  it('turns a point and composes turns as three.js does', () => {
    const p = qrot(QUARTER, [0, 0, 1]);
    expect(p[0]).toBeCloseTo(-1);
    expect(p[2]).toBeCloseTo(0);
    const full = qmul(QUARTER, qmul(QUARTER, qmul(QUARTER, QUARTER)));
    expect(Math.abs(full[3])).toBeCloseTo(1);
  });

  it('folds the trajectory’s turn into a child so the pose in the world is unchanged', () => {
    // the AT-AT's hips: at rest under a square trajectory the hips carry the
    // turn; in a clip the trajectory carries it and the hips are square
    const rot = folded('rotation', new Float32Array([0, 0, 0, 1]), QUARTER);
    expect(sameAs(Array.from(rot), QUARTER, 1e-6)).toBe(true);
    const at = folded('translation', new Float32Array([-0.089, 14.819, 0.12]), QUARTER);
    expect(at[1]).toBeCloseTo(14.819);
    expect(at[0]).toBeCloseTo(-0.12, 3);
    expect(at[2]).toBeCloseTo(-0.089, 3);
  });

  it('resamples to the asked rate, the end always a key', () => {
    const r = resample([0, 1], new Float32Array([0, 0, 0, 3, 0, 0]), 3, 24, 1);
    expect(r.times.length).toBe(25);
    expect(r.times.at(-1)).toBe(1);
    expect(r.values[12 * 3]).toBeCloseTo(1.5);
  });

  it('keeps turns unit length when it slerps', () => {
    const r = resample([0, 1], new Float32Array([0, 0, 0, 1, ...QUARTER]), 4, 4, 1);
    for (let i = 0; i < r.values.length; i += 4) expect(Math.hypot(...r.values.slice(i, i + 4))).toBeCloseTo(1);
  });

  it('drops a channel that never leaves its rest, holds one that sits elsewhere, keeps one that moves', () => {
    expect(channelFate(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1]), 4, [0, 0, 0, -1])).toBe('drop');
    expect(channelFate(new Float32Array([1, 2, 3, 1, 2, 3]), 3, [0, 0, 0])).toBe('hold');
    expect(channelFate(new Float32Array([1, 2, 3, 1, 2, 4]), 3, [0, 0, 0])).toBe('keep');
  });

  it('measures the ground a clip covers', () => {
    expect(travel(new Float32Array([0, 0, 0, 0, 0, 4, 0, 0, 8.5]))).toBeCloseTo(8.5);
    expect(travel(null)).toBe(0);
  });
});
