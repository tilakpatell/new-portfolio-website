import { describe, expect, it } from 'vitest';
import { createSurfaceLockOn } from './surfaceLockOn';

const stateWith = (lock, yaw = 0) => ({ phase: 'walk', lock, cam: { yaw } });
const trooper = (x, z, hostile = true) => ({ holder: { position: { x, y: 0, z } }, hostile: hostile ? { reach: 2 } : null, down: false });

describe('the surface’s lock-on', () => {
  it('turns the camera onto the lock while it’s on, and tells the page', () => {
    const heard = [];
    const l = createSurfaceLockOn({ coarse: false, emit: (e) => heard.push(e) });
    const s = stateWith(trooper(5, 5));
    l.step(s, { x: 0, z: 0 }, 1 / 60);
    expect(s.cam.yaw).toBe(0); // (off on a mouse till asked)
    l.toggle();
    expect(heard).toEqual([{ type: 'lockOn', on: true }]);
    for (let i = 0; i < 120; i++) l.step(s, { x: 0, z: 0 }, 1 / 60);
    expect(s.cam.yaw).toBeCloseTo(Math.PI / 4, 3);
  });

  it('on a coarse pointer, is on by itself with a hostile within 14 m', () => {
    const l = createSurfaceLockOn({ coarse: true });
    l.step(stateWith(trooper(0, 20)), { x: 0, z: 0 }, 1 / 60);
    expect(l.on).toBe(false);
    l.step(stateWith(trooper(0, 10)), { x: 0, z: 0 }, 1 / 60);
    expect(l.on).toBe(true);
    l.step(stateWith(trooper(0, 10, false)), { x: 0, z: 0 }, 1 / 60);
    expect(l.on).toBe(false); // (someone friendly isn't a fight)
  });
});
