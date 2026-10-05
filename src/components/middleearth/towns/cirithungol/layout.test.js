import { describe, expect, it } from 'vitest';
import { pushOut } from '../walker';
import { BRAWL, LAIR_IN, LAIR_OUT, ORC_ROUNDS, SHELOB_ROUNDS, STAIR_RISE, TOWER_COLLIDERS, TOWER_DOOR, TOWER_IN, TOWER_WALLS, TUNNELS, inTunnels, stairAt, validAt } from './layout';
import { STAIRS } from './rules';
import { cirithProgress } from './story';

const towerFree = (x, z, r = 0.4) => {
  const [px, pz] = pushOut(x, z, r, TOWER_COLLIDERS, TOWER_WALLS);
  return Math.hypot(px - x, pz - z) < 0.02;
};

describe('the stairs', () => {
  it('climb steadily from the foot to the top', () => {
    let last = -1;
    for (let s = 0; s <= STAIRS.len; s += 2) {
      const [, y] = stairAt(s);
      expect(y).toBeGreaterThanOrEqual(last);
      last = y;
    }
    expect(stairAt(STAIRS.len)[1]).toBeCloseTo(STAIR_RISE);
  });
});

describe('Shelob’s lair', () => {
  it('joins the way in to the way out', () => {
    expect(inTunnels(LAIR_IN.x, LAIR_IN.z)).toBe(true);
    expect(inTunnels(LAIR_OUT.x, LAIR_OUT.z)).toBe(true);
    // walk every tunnel end to end
    for (const [x0, z0, x1, z1] of TUNNELS) for (let t = 0; t <= 1; t += 0.05) expect(inTunnels(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)).toBe(true);
    expect(inTunnels(30, 30)).toBe(false);
  });
  it('keeps her rounds in the tunnels', () => {
    for (const round of SHELOB_ROUNDS) for (const [x, z] of round) expect(inTunnels(x, z)).toBe(true);
  });
});

describe('the Tower', () => {
  it('has room to come in, and to reach the door', () => {
    expect(towerFree(TOWER_IN.x, TOWER_IN.z)).toBe(true);
    expect(towerFree(TOWER_DOOR.x, TOWER_DOOR.z)).toBe(true);
  });
  it('keeps the orcs’ rounds clear of the pillars and the brawl', () => {
    for (const round of ORC_ROUNDS) for (const [x, z] of round) expect(towerFree(x, z, 0.5), `${x},${z}`).toBe(true);
    expect(towerFree(BRAWL.x + 0.5, BRAWL.z)).toBe(false);
  });
});

describe('the story', () => {
  it('moves you from the vale, up the stairs, into the lair, and makes you Sam', () => {
    expect(cirithProgress([]).zone).toBe('vale');
    expect(cirithProgress(['morgul']).zone).toBe('stairs');
    expect(cirithProgress(['morgul', 'stairs']).zone).toBe('lair');
    expect(cirithProgress(['morgul', 'stairs']).asSam).toBe(false);
    expect(cirithProgress(['morgul', 'stairs', 'shelob']).asSam).toBe(true);
    expect(cirithProgress(['morgul', 'stairs', 'shelob', 'samwise']).zone).toBe('tower');
  });
  it('keeps a fair saved spot', () => {
    expect(validAt({ zone: 'lair', x: 18, z: -8 }, 'lair')).toEqual({ zone: 'lair', x: 18, z: -8, face: 0 });
    expect(validAt({ zone: 'lair', x: 30, z: 30 }, 'lair')).toEqual({ zone: 'lair', ...LAIR_IN });
  });
});
