import { describe, expect, it } from 'vitest';
import { BUILD, STAND, canBuild, grounded, nearestOwn, placementFor } from './buildRules';

const echo = [{ id: 'echo-base', name: 'Echo Base', at: [1200, -800], r: 220, edge: 160, h: 12 }];
const ship = (extra = {}) => ({ x: 0, y: 40, z: 0, pitch: 0, yaw: 0.7, roll: 0, speed: 80, ...extra });

describe('where a turret may be built', () => {
  it('is low, slow and over the planet’s own ground', () => {
    expect(canBuild(ship(), 0, echo)).toEqual({ ok: true, why: null });
  });

  it('says why not, a sentence each: too high, too fast, inside a place’s flat, no ground in yet', () => {
    const no = [canBuild(ship({ y: BUILD.up + 1 }), 0, echo), canBuild(ship({ speed: BUILD.speed }), 0, echo), canBuild(ship({ x: 1200 + 220 + 150, z: -800 }), 0, echo), canBuild(ship(), NaN, echo)];
    for (const n of no) {
      expect(n.ok).toBe(false);
      expect(n.why).toMatch(/^[A-Z].*\.$/);
    }
    expect(new Set(no.map((n) => n.why)).size).toBe(4);
    // (just past the flat’s edge is the land’s own)
    expect(canBuild(ship({ x: 1200 + 220 + 160 + 1, z: -800 }), 0, echo).ok).toBe(true);
  });

  it('puts it on the ground under the ship, turned as the ship is', () => {
    expect(placementFor(ship({ x: 5, z: -7 }), 12.5)).toEqual({ x: 5, y: 12.5, z: -7, rot: [0, 0.7, 0], scale: 1 });
  });
});

describe('what X takes down', () => {
  const mine = [
    { id: 'a', owner: 'me', x: 10, z: 0, y: 0 },
    { id: 'b', owner: 'you', x: 1, z: 0, y: 0 },
    { id: 'c', owner: 'me', x: 25, z: 0, y: 0 },
    { id: 'd', owner: 'me', x: 100, z: 0, y: 0 },
  ];
  it('is your own nearest within reach, never another’s', () => {
    expect(nearestOwn(mine, ship(), 'me')?.id).toBe('a');
    expect(nearestOwn(mine, ship({ x: 200 }), 'me')).toBeNull();
    expect(nearestOwn(mine, ship(), null)).toBeNull();
  });
});

describe('a built thing on ground that changed', () => {
  const heightAt = (x, z) => x + z;
  const turret = { id: 't', type: 'turret', x: 3, y: 50, z: 4, terrainVersion: 1 };
  it('is put back on the ground the planet has now, at its kind’s standing height', () => {
    expect(grounded(turret, 2, heightAt)).toMatchObject({ y: 7 + STAND.turret, terrainVersion: 2 });
    expect(grounded({ ...turret, type: 'wreck' }, 2, heightAt).y).toBe(7 + STAND.wreck);
  });
  it('stands where it was stored on the ground it was built on', () => {
    expect(grounded(turret, 1, heightAt)).toBe(turret);
  });
  it('waits where no height is known yet', () => {
    expect(grounded(turret, 2, () => NaN)).toBe(turret);
  });
});
