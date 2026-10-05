import { describe, expect, it } from 'vitest';
import { pushOut } from '../walker';
import { BED, BOULDERS, EMYN_COLLIDERS, EMYN_START, EMYN_WALLS, FIRM, GATE_COLLIDERS, GATE_WALLS, ISLAND, LIGHTS, LOOKOUT, MARSH_PATH, MARSH_START, POOL, POOL_BANK, SCOUT_ROUNDS, SLOPE_START, SNAGS, SPOTS, marshHeight, onFirm, slopeHeight, toPath, tussockAt, validAt } from './layout';
import { marshesProgress } from './story';

const freeIn = (cs, ws) => (x, z, r = 0.4) => {
  const [px, pz] = pushOut(x, z, r, cs, ws);
  return Math.hypot(px - x, pz - z) < 0.02;
};
const emynFree = freeIn(EMYN_COLLIDERS, EMYN_WALLS);
const gateFree = freeIn(GATE_COLLIDERS, GATE_WALLS);

describe('the Emyn Muil', () => {
  it('has room to land, sleep and stand', () => {
    expect(emynFree(EMYN_START.x, EMYN_START.z)).toBe(true);
    expect(emynFree(BED.x, BED.z)).toBe(true);
    for (const s of SPOTS.filter((x) => x.zone === 'emyn')) expect(emynFree(s.x, s.z)).toBe(true);
  });
});

describe('the Dead Marshes', () => {
  it('has firm ground all along the path, and the start on it', () => {
    for (const [x, z] of MARSH_PATH) expect(onFirm(x, z)).toBe(true);
    expect(onFirm(MARSH_START.x, MARSH_START.z)).toBe(true);
    expect(onFirm(MARSH_START.x, MARSH_START.z + 6)).toBe(false);
  });
  it('puts the lights just off the path, where you pass close by', () => {
    for (const [x, z] of LIGHTS) {
      const d = toPath(x, z, MARSH_PATH);
      expect(d).toBeGreaterThan(2.2);
      expect(d).toBeLessThan(4.5);
    }
  });
  it('keeps the dead trees in the water, and the path above it', () => {
    for (const [x, z] of SNAGS) expect(onFirm(x, z)).toBe(false);
    expect(marshHeight(0, toPath(0, 0, MARSH_PATH) > 3 ? 0 : 20)).toBeLessThan(marshHeight(-64, 2));
  });
});

describe('before the Gate', () => {
  it('lets you start, and reach the lookout', () => {
    expect(gateFree(SLOPE_START.x, SLOPE_START.z)).toBe(true);
    expect(gateFree(LOOKOUT.x, LOOKOUT.z)).toBe(true);
  });
  it('keeps the scouts’ rounds clear of the boulders', () => {
    for (const round of SCOUT_ROUNDS) {
      for (let i = 0; i < round.length; i++) {
        const [ax, az] = round[i];
        const [bx, bz] = round[(i + 1) % round.length];
        for (let t = 0; t <= 1; t += 0.1) expect(gateFree(ax + (bx - ax) * t, az + (bz - az) * t, 0.5), `${ax},${az}`).toBe(true);
      }
    }
  });
  it('rises to the north', () => {
    expect(slopeHeight(0, -20)).toBeGreaterThan(slopeHeight(0, 16) + 5);
    expect(BOULDERS.length).toBeGreaterThan(8);
  });
});

describe('the story', () => {
  it('moves you from the Emyn Muil to the marshes to the Gate', () => {
    expect(marshesProgress([]).zone).toBe('emyn');
    expect(marshesProgress(['rope']).zone).toBe('emyn');
    expect(marshesProgress(['rope', 'smeagol']).zone).toBe('marsh');
    expect(marshesProgress(['rope', 'smeagol', 'marsh']).zone).toBe('gate');
  });
  it('keeps a fair saved spot in its own place', () => {
    expect(validAt({ zone: 'marsh', x: -40, z: 2 }, 'marsh')).toEqual({ zone: 'marsh', x: -40, z: 2, face: 0 });
    expect(validAt({ zone: 'marsh', x: -40, z: 20 }, 'marsh')).toEqual({ zone: 'marsh', ...MARSH_START });
    expect(validAt({ zone: 'emyn', x: 0, z: 0 }, 'gate')).toEqual({ zone: 'gate', ...SLOPE_START });
  });
});

describe('Sméagol’s safe way', () => {
  it('starts on the path’s bank, with every tussock out in the pool, clear of the dead trees and the lights', () => {
    expect(onFirm(POOL_BANK.x, POOL_BANK.z)).toBe(true);
    for (let row = 0; row < POOL.rows; row++)
      for (let col = 0; col < POOL.cols; col++) {
        const { x, z } = tussockAt(col, row);
        expect(toPath(x, z, MARSH_PATH), `${col}, ${row}`).toBeGreaterThan(FIRM + 0.8);
        for (const [sx, sz] of [...SNAGS, ...LIGHTS]) expect(Math.hypot(sx - x, sz - z), `${col}, ${row}`).toBeGreaterThan(2.5);
      }
    // a hop from the bank to the first row, and from row to row
    expect(Math.hypot(tussockAt(1, 0).x - POOL_BANK.x, tussockAt(1, 0).z - POOL_BANK.z)).toBeLessThan(3.4);
    expect(Math.hypot(tussockAt(0, 0).x - tussockAt(1, 1).x, tussockAt(0, 0).z - tussockAt(1, 1).z)).toBeLessThan(3.2);
    // the island beyond the last row, and nothing on it
    expect(tussockAt(2, POOL.rows - 1).z - ISLAND.z).toBeGreaterThan(ISLAND.r);
    expect(toPath(ISLAND.x, ISLAND.z, MARSH_PATH)).toBeGreaterThan(FIRM + ISLAND.r);
    for (const [sx, sz] of SNAGS) expect(Math.hypot(sx - ISLAND.x, sz - ISLAND.z)).toBeGreaterThan(ISLAND.r + 1);
  });
});
