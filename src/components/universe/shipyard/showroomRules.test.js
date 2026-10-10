import { describe, expect, it } from 'vitest';
import { FLING, FPS, createFling, fitDistance, heroOf, pulseAt, yawFromDrag } from './showroomRules';

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

describe('the ship the showroom shows', () => {
  const MODELS = { xwing: '/x.glb', falcon: '/f.glb', rv: '/rv.glb' };
  it('is the real model of an iconic ship, the cruiser’s own, or none on a garage build', () => {
    expect(heroOf('xwing', null, MODELS)).toEqual({ glb: '/x.glb' });
    expect(heroOf('falcon', null, MODELS)).toEqual({ glb: '/f.glb' });
    expect(heroOf('rv', null, MODELS)).toEqual({ glb: '/rv.glb' });
    expect(heroOf('cruiser', null, MODELS)).toEqual({ cruiser: true });
    expect(heroOf('xwing', { hull: 'dart' }, MODELS)).toBeNull(); // (a build is whole as it is)
    expect(heroOf('nonsense', null, MODELS)).toBeNull();
  });
});

describe('the showroom’s fling', () => {
  it('keeps turning a drag let go at speed, slowing to a stop', () => {
    const f = createFling();
    // a drag across, a pixel a millisecond for a tenth of a second
    for (let t = 0; t < 0.1; t += 1 / 60) f.track(yawFromDrag(1000 / 60), 1 / 60);
    const v0 = f.release(0);
    expect(v0).toBeGreaterThan(5);
    expect(v0).toBeLessThanOrEqual(FLING.max);
    let turned = 0;
    let t = 0;
    while (f.moving && t < 10) {
      turned += f.coast(1 / 30);
      t += 1 / 30;
    }
    expect(turned).toBeGreaterThan(0.5);
    expect(t).toBeLessThan(3);
    expect(f.moving).toBe(false);
  });

  it('stays put when the drag stood still before letting go, or was slow', () => {
    const f = createFling();
    for (let i = 0; i < 6; i++) f.track(yawFromDrag(20), 1 / 60);
    expect(f.release(0.2)).toBe(0); // (held there a fifth of a second first)
    const g = createFling();
    g.track(yawFromDrag(0.1), 1 / 60);
    expect(g.release(0)).toBe(0);
    expect(g.coast(1 / 30)).toBe(0);
  });

  it('a new grab stops it at once', () => {
    const f = createFling();
    for (let i = 0; i < 6; i++) f.track(yawFromDrag(1000 / 60), 1 / 60);
    f.release(0);
    f.grab();
    expect(f.moving).toBe(false);
    expect(f.coast(1 / 30)).toBe(0);
  });
});
