import { describe, expect, it } from 'vitest';
import { absorb, parries, startBurst, startBurst as sb, stepBurst, strafeStep } from './hostiles';

describe('how the enemies fight', () => {
  it('fires a burst a shot at a time, then runs dry', () => {
    const b = startBurst({ burst: { n: 3, gap: 0.1 } });
    expect(b).toEqual({ left: 3, wait: 0 });
    expect(stepBurst(b, 0.016, 0.1)).toBe(1);
    expect(stepBurst(b, 0.05, 0.1)).toBe(0);
    expect(stepBurst(b, 0.06, 0.1)).toBe(1);
    expect(stepBurst(b, 0.5, 0.1)).toBe(1); // (the last, however long the frame)
    expect(stepBurst(b, 1, 0.1)).toBe(0);
    expect(sb(null).left).toBe(1); // (one without a burst: one shot)
  });

  it('strafes across the line to you, holding its distance', () => {
    const you = { x: 0, z: 0 };
    const h = { strafe: { speed: 2, every: 2, keep: 10 } };
    const a = strafeStep({ x: 0, z: 10 }, you, h, 0.5, 0);
    expect(a.yaw).toBeCloseTo(Math.PI, 5); // (facing you)
    expect(Math.abs(a.x)).toBeCloseTo(1, 5); // (a metre across in half a second)
    expect(a.z).toBeCloseTo(10, 5); // (at the distance it likes: no closer)
    const b = strafeStep({ x: 0, z: 10 }, you, h, 0.5, 2.5);
    expect(Math.sign(b.x)).toBe(-Math.sign(a.x)); // (the other way, a couple of seconds on)
    // too far: it comes in; too close: it backs off
    expect(strafeStep({ x: 0, z: 20 }, you, h, 0.5, 0).z).toBeLessThan(20);
    expect(strafeStep({ x: 0, z: 4 }, you, h, 0.5, 0).z).toBeGreaterThan(4);
  });

  it('soaks hits on a shield before the body takes any', () => {
    expect(absorb({ shield: 3, hp: 2 }, 1)).toEqual({ shield: 2, hp: 2 });
    expect(absorb({ shield: 1, hp: 2 }, 2)).toEqual({ shield: 0, hp: 1 });
    expect(absorb({ shield: 0, hp: 2 }, 1)).toEqual({ shield: 0, hp: 1 });
    expect(absorb({ hp: 2 }, 2)).toEqual({ shield: 0, hp: 0 });
  });

  it('parries a share of swings, never without a blade', () => {
    expect(parries({ parry: 0.5 }, 0.2)).toBe(true);
    expect(parries({ parry: 0.5 }, 0.7)).toBe(false);
    expect(parries({}, 0.0)).toBe(false);
    expect(parries(null, 0.0)).toBe(false);
  });
});
