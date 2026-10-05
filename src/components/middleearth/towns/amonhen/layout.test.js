import { describe, expect, it } from 'vitest';
import { pushOut } from '../walker';
import { CAST, COLLIDERS, DECOY, GLADE, PATH, RUN_START, SEAT, SKIPPERS, SKIPPING, SPOTS, START, STAIR, STICKS, TREES, URUK_ROUNDS, WALLS, height, inLake, shoreX, toPath, validAt } from './layout';
import { QUESTS } from './story';

const free = (x, z, r = 0.4) => {
  const [px, pz] = pushOut(x, z, r, COLLIDERS, WALLS);
  return Math.hypot(px - x, pz - z) < 0.02 && !inLake(x, z);
};

describe('Amon Hen', () => {
  it('has woods, none of it on the path', () => {
    expect(TREES.length).toBeGreaterThan(70);
    for (const [x, z] of TREES) expect(toPath(x, z)).toBeGreaterThan(3);
  });
  it('lets you walk the path from the camp to the summit', () => {
    for (let i = 1; i < PATH.length; i++) {
      const [ax, az] = PATH[i - 1];
      const [bx, bz] = PATH[i];
      for (let t = 0; t <= 1; t += 0.05) {
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        expect(free(x, z), `path at ${x.toFixed(1)}, ${z.toFixed(1)}`).toBe(true);
      }
    }
  });
  it('rises to the summit, and the stair climbs steadily', () => {
    expect(height(SEAT.x, SEAT.z)).toBeGreaterThan(height(START.x, START.z) + 25);
    let last = -Infinity;
    for (let x = STAIR.x0; x >= STAIR.x1; x -= 1) {
      const h = height(x, STAIR.z);
      expect(h).toBeGreaterThanOrEqual(last - 0.05);
      last = h;
    }
  });
  it('puts everyone, the sticks and the places somewhere you can stand', () => {
    expect(free(START.x, START.z)).toBe(true);
    expect(free(RUN_START.x, RUN_START.z)).toBe(true);
    expect(free(GLADE.x, GLADE.z)).toBe(true);
    for (const [x, z] of STICKS) expect(free(x, z)).toBe(true);
    for (const s of SPOTS) expect(free(s.x, s.z), s.id).toBe(true);
    for (const c of CAST) expect(free(c.x, c.z, 0.3), c.id).toBe(true);
  });
  it('keeps the Uruk-hai’s rounds out of the trees, on dry land', () => {
    for (const round of URUK_ROUNDS) for (const [x, z] of round) expect(free(x, z, 0.5), `${x}, ${z}`).toBe(true);
    expect(free(DECOY.x, DECOY.z, 0.3)).toBe(true);
  });
  it('has the lake east of the shore', () => {
    expect(inLake(shoreX(0) + 2, 0)).toBe(true);
    expect(inLake(shoreX(0) - 4, 0)).toBe(false);
    expect(height(shoreX(0) + 4, 0)).toBeLessThan(-1.2);
  });
  it('has a spot for the quests that need one', () => {
    for (const id of ['seat', 'promise']) expect(SPOTS.some((s) => s.quest === id)).toBe(true);
    expect(QUESTS).toHaveLength(5);
  });
  it('keeps a fair saved spot, and throws out a bad one', () => {
    expect(validAt({ x: 20, z: 1, face: 1 })).toEqual({ x: 20, z: 1, face: 1 });
    expect(validAt({ x: 80, z: 0 })).toEqual(START);
    expect(validAt(null)).toEqual(START);
  });
});

describe('ducks and drakes', () => {
  it('puts you on the shore with the lake before you, and Merry and Pippin on dry land by you', () => {
    expect(free(SKIPPING.x, SKIPPING.z)).toBe(true);
    expect(shoreX(SKIPPING.z) - SKIPPING.x).toBeLessThan(2.5);
    expect(inLake(SKIPPING.x + 4, SKIPPING.z)).toBe(true);
    for (const p of SKIPPERS) {
      expect(free(p.x, p.z, 0.3), p.look).toBe(true);
      expect(Math.hypot(p.x - SKIPPING.x, p.z - SKIPPING.z), p.look).toBeLessThan(4);
    }
    // well away from the boats you push out, and the camp
    for (const s of SPOTS) expect(Math.hypot(s.x - SKIPPING.x, s.z - SKIPPING.z), s.id).toBeGreaterThan(8);
  });
});
