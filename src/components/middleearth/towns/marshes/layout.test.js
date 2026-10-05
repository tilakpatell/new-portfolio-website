import { describe, expect, it } from 'vitest';
import { pushOut } from '../walker';
import { BED, BOULDERS, EMYN_COLLIDERS, EMYN_START, EMYN_WALLS, GATE_COLLIDERS, GATE_WALLS, LIGHTS, LOOKOUT, MARSH_PATH, MARSH_START, SCOUT_ROUNDS, SLOPE_START, SNAGS, SPOTS, marshHeight, onFirm, slopeHeight, toPath, validAt } from './layout';
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
