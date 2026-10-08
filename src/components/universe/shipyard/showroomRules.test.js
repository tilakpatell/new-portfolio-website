import { describe, expect, it } from 'vitest';
import { FPS, fitDistance, pulseAt, yawFromDrag } from './showroomRules';

describe('the showroom’s sums', () => {
  it('the camera backs off on a tall canvas', () => {
    expect(fitDistance(0.5, 1, 30)).toBeGreaterThan(fitDistance(1.6, 1, 30));
    expect(fitDistance(1.6, 2, 30)).toBeCloseTo(2 * fitDistance(1.6, 1, 30));
    expect(fitDistance(2, 1, 30)).toBeCloseTo(fitDistance(1, 1, 30)); // (a wide one fits on its height)
  });

  it('the pulse is 0 at 0 and 1 at 0.6 s', () => {
    expect(pulseAt(0)).toBeCloseTo(0);
    expect(pulseAt(0.6)).toBeCloseTo(1);
    expect(pulseAt(1.2)).toBeCloseTo(0);
    for (let t = 0; t < 3; t += 0.07) expect(pulseAt(t)).toBeGreaterThanOrEqual(0) && expect(pulseAt(t)).toBeLessThanOrEqual(1);
  });

  it('a 100 px drag turns 1.2 rad, and the frame cap is 30', () => {
    expect(yawFromDrag(100)).toBeCloseTo(1.2);
    expect(yawFromDrag(-50)).toBeCloseTo(-0.6);
    expect(FPS).toBe(30);
  });
});
