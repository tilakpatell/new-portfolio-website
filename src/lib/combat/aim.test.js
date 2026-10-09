import { describe, expect, it } from 'vitest';
import { aimPoint, assist, friction, lead, coneFor, snapped, ASSIST, rayCapsule } from './aim';

const angle = (a, b) => {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(Math.max(-1, Math.min(1, d / (Math.hypot(...a) * Math.hypot(...b)))));
};
// a direction `rad` off +z, turned toward +x
const off = (rad) => [Math.sin(rad), 0, Math.cos(rad)];
// a standing body: a capsule 20 m ahead on +z, 1.8 m tall
const body = (z = 20, x = 0, id = 'a') => ({ id, a: [x, 0.3, z], b: [x, 1.5, z], r: 0.3, ref: id });
// a wall across +z at `z`
const wallAt = (z) => (from, to) => {
  if ((from[2] - z) * (to[2] - z) > 0) return null;
  const t = (z - from[2]) / (to[2] - from[2]);
  return { at: [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, z], normal: [0, 0, -1] };
};
const ray = { from: [0, 1, 0], dir: [0, 0, 1] };

describe('rayCapsule', () => {
  it('meets the side, the caps, and misses beside it', () => {
    expect(rayCapsule([0, 1, 0], [0, 0, 1], [0, 0.3, 20], [0, 1.5, 20], 0.3)).toBeCloseTo(19.7);
    expect(rayCapsule([0, 5, 20], [0, -1, 0], [0, 0.3, 20], [0, 1.5, 20], 0.3)).toBeCloseTo(3.2);
    expect(rayCapsule([1, 1, 0], [0, 0, 1], [0, 0.3, 20], [0, 1.5, 20], 0.3)).toBe(null);
    expect(rayCapsule([0, 1, 30], [0, 0, 1], [0, 0.3, 20], [0, 1.5, 20], 0.3)).toBe(null);
  });
});

describe('aimPoint', () => {
  it('stops at a solid before a target and at a target before a solid', () => {
    const behind = aimPoint(ray, wallAt(10), [body(20)]);
    expect(behind.target).toBe(null);
    expect(behind.dist).toBeCloseTo(10);
    expect(behind.at[2]).toBeCloseTo(10);
    const before = aimPoint(ray, wallAt(30), [body(20)]);
    expect(before.target.id).toBe('a');
    expect(before.dist).toBeCloseTo(19.7);
  });

  it('goes max along the ray with nothing in the way', () => {
    const p = aimPoint(ray, () => null, [], { max: 50 });
    expect(p.at).toEqual([0, 1, 50]);
    expect(p.target).toBe(null);
  });

  it('never returns a point nearer than min 1.5 m ahead, with a solid at 0.3 m', () => {
    const p = aimPoint(ray, wallAt(0.3), [body(20)]);
    expect(p.dist).toBe(1.5);
    expect(p.at[2]).toBeCloseTo(1.5);
  });

  it('picks the nearer of two targets', () => {
    const p = aimPoint(ray, () => null, [body(20, 0, 'far'), body(12, 0, 'near')]);
    expect(p.target.id).toBe('near');
  });
});

describe('assist', () => {
  // a cone with no cap, to see the pull alone
  const open = { inner: 0.02, outer: 0.05, cap: 1 };
  const from = [0, 0.9, 0];
  const t = [body(20)];
  const toTarget = [0, 0, 1];

  it('bends a direction inside inner onto the target, part way between the cones, not at all outside', () => {
    expect(angle(assist(off(0.015), from, t, open), toTarget)).toBeLessThan(1e-6);
    const part = angle(assist(off(0.04), from, t, open), toTarget);
    expect(part).toBeGreaterThan(0.02);
    expect(part).toBeLessThan(0.04);
    expect(assist(off(0.06), from, t, open)).toEqual(off(0.06));
  });

  it('bends at most cap radians in one call', () => {
    const d = off(0.015);
    const bent = assist(d, from, t, ASSIST.mouse);
    expect(angle(bent, d)).toBeCloseTo(ASSIST.mouse.cap, 5);
  });

  it('a target behind the shooter is never pulled toward', () => {
    expect(assist([0, 0, -1], from, t, ASSIST.touch)).toEqual([0, 0, -1]);
  });
});

describe('friction', () => {
  it('is 0.55 with a target inside outer and 1 otherwise', () => {
    expect(friction(off(0.04), [0, 0.9, 0], [body(20)], ASSIST.mouse)).toBe(0.55);
    expect(friction(off(0.08), [0, 0.9, 0], [body(20)], ASSIST.mouse)).toBe(1);
    expect(friction(off(0.08), [0, 0.9, 0], [], ASSIST.mouse)).toBe(1);
  });
});

describe('lead', () => {
  it('meets a target walking 2.3 m/s across at 30 m with a bolt at 90 m/s', () => {
    const target = [0, 1, 30];
    const vel = [2.3, 0, 0];
    const from = [0, 1, 0];
    const at = lead(target, vel, from, 90);
    // the bolt flies to `at`; when it gets there, where is the target?
    const t = Math.hypot(at[0] - from[0], at[1] - from[1], at[2] - from[2]) / 90;
    const then = [target[0] + vel[0] * t, target[1], target[2]];
    expect(Math.hypot(at[0] - then[0], at[1] - then[1], at[2] - then[2])).toBeLessThan(0.05);
  });

  it('falls back to where the target is when the bolt can never catch it', () => {
    expect(lead([0, 0, 10], [0, 0, 100], [0, 0, 0], 50)).toEqual([0, 0, 10]);
  });
});

describe('coneFor', () => {
  it('picks touch on coarse, pad for drag, mouse otherwise', () => {
    expect(coneFor({ coarse: true, mode: 'lock' })).toBe(ASSIST.touch);
    expect(coneFor({ mode: 'drag' })).toBe(ASSIST.pad);
    expect(coneFor({ mode: 'lock' })).toBe(ASSIST.mouse);
    expect(coneFor({})).toBe(ASSIST.mouse);
  });
});

describe('snapped', () => {
  it('pulls a touch tap all the way onto a target anywhere in its cone', () => {
    // 0.2 rad off: inside touch's outer cone, where the plain pull is next to nothing
    const t = body(20, Math.tan(0.2) * 20);
    const bent = assist(off(0), [0, 0.9, 0], [t], snapped(ASSIST.touch));
    expect(aimPoint({ from: [0, 0.9, 0], dir: bent }, null, [t]).target?.id).toBe('a');
    const plain = assist(off(0), [0, 0.9, 0], [t], ASSIST.touch);
    expect(aimPoint({ from: [0, 0.9, 0], dir: plain }, null, [t]).target).toBe(null);
  });
  it('leaves a cone without snap as it is, and nothing outside the cone is taken', () => {
    expect(snapped(ASSIST.mouse)).toBe(ASSIST.mouse);
    const far = body(20, Math.tan(0.3) * 20);
    const bent = assist(off(0), [0, 0.9, 0], [far], snapped(ASSIST.touch));
    expect(bent).toEqual(off(0));
  });
});
