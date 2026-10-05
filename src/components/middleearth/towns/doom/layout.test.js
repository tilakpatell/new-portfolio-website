import { describe, expect, it } from 'vitest';
import { pushOut } from '../walker';
import { CROSS, CROSS_COLLIDERS, CROSS_START, CROSS_WALLS, DOOM, EYE_AT, FOOT, MARCH_LEN, MARCH_ROAD, ROCKS, alongMarch, covered, groundHeight, validAt } from './layout';
import { MARCH } from './rules';
import { doomProgress } from './story';

const free = (x, z, r = 0.4) => {
  const [px, pz] = pushOut(x, z, r, CROSS_COLLIDERS, CROSS_WALLS);
  return Math.hypot(px - x, pz - z) < 0.02;
};

describe('the column’s road', () => {
  it('is long enough for the march, and ends by the crossing', () => {
    expect(MARCH_LEN).toBeGreaterThan(MARCH.length * MARCH.pace * 0.9);
    const [x, z] = alongMarch(MARCH_LEN);
    expect(Math.hypot(x - CROSS_START.x, z - CROSS_START.z)).toBeLessThan(12);
    expect(alongMarch(0).slice(0, 2)).toEqual(MARCH_ROAD[0]);
  });
});

describe('the crossing', () => {
  it('starts and ends in the open, inside the plain', () => {
    expect(free(CROSS_START.x, CROSS_START.z)).toBe(true);
    expect(free(FOOT.x, FOOT.z)).toBe(true);
    for (const p of [CROSS_START, FOOT]) {
      expect(p.x).toBeGreaterThan(CROSS.west);
      expect(p.x).toBeLessThan(CROSS.east);
    }
  });
  it('has rocks to hide behind all the way across', () => {
    expect(ROCKS.length).toBeGreaterThan(20);
    for (let x = CROSS.west + 30; x < CROSS.east - 30; x += 40) expect(ROCKS.some(([rx]) => Math.abs(rx - x) < 25)).toBe(true);
  });
  it('hides you in the shadow a rock throws away from the Eye, and not in front of it', () => {
    const [rx, rz, r] = ROCKS[0];
    const dx = rx - EYE_AT.x;
    const dz = rz - EYE_AT.z;
    const d = Math.hypot(dx, dz);
    expect(covered(rx + (dx / d) * (r + 0.6), rz + (dz / d) * (r + 0.6))).toBe(true);
    expect(covered(rx - (dx / d) * (r + 0.6), rz - (dz / d) * (r + 0.6), [ROCKS[0]])).toBe(false);
  });
  it('is the plain, flat at the mountain’s foot and out of the way under it', () => {
    expect(Math.abs(groundHeight(CROSS_START.x, CROSS_START.z))).toBeLessThan(4);
    expect(Math.abs(groundHeight(FOOT.x, FOOT.z))).toBeLessThan(0.5);
    expect(Math.hypot(FOOT.x - DOOM.x, FOOT.z - DOOM.z)).toBeGreaterThan(DOOM.r);
    expect(groundHeight(DOOM.x - DOOM.r + 150, DOOM.z)).toBeLessThan(-10);
  });
});

describe('a saved place', () => {
  it('is kept if it’s on the plain and clear, and otherwise it’s the start', () => {
    expect(validAt({ zone: 'plain', x: CROSS_START.x + 2, z: CROSS_START.z, face: 1 })).toEqual({ zone: 'plain', x: CROSS_START.x + 2, z: CROSS_START.z, face: 1 });
    expect(validAt({ zone: 'plain', x: 0, z: 0 })).toEqual({ zone: 'plain', ...CROSS_START });
    expect(validAt({ zone: 'plain', x: ROCKS[0][0] + 0.3, z: ROCKS[0][1] })).toEqual({ zone: 'plain', ...CROSS_START });
    expect(validAt(null)).toEqual({ zone: 'plain', ...CROSS_START });
  });
});

describe('the story', () => {
  it('goes from the column to the eagles, as Sam on the mountain', () => {
    expect(doomProgress([]).next).toBe('column');
    expect(doomProgress([]).zone).toBe('plain');
    expect(doomProgress(['column', 'gorgoroth']).asSam).toBe(true);
    expect(doomProgress(['column', 'gorgoroth', 'carry']).zone).toBe('crack');
    expect(doomProgress(['column', 'gorgoroth', 'carry', 'crack', 'eagles']).finished).toBe(true);
  });
});
