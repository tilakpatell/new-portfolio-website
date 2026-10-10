import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { resetDevice } from '../device';
import { createLeaves, makeLeaves, stepLeaves } from './leaves';
import { createWind } from './wind';

const params = (more = {}) => ({ focus: { x: 0, z: 0 }, half: 20, wind: { x: 1, z: 0, strength: 0.5 }, car: null, floorAt: () => ({ y: 0, water: false }), ...more });

describe('stepLeaves', () => {
  it('keeps every leaf inside the box round the focus', () => {
    const s = makeLeaves(128, { focus: { x: 100, z: -50 }, half: 20, seed: 2 });
    for (let i = 0; i < 600; i++) stepLeaves(s, 1 / 60, params({ focus: { x: 100 + i * 0.05, z: -50 } }));
    const fx = 100 + 599 * 0.05;
    for (let i = 0; i < 128; i++) {
      expect(Math.abs(s.pos[i * 3] - fx)).toBeLessThanOrEqual(20.001);
      expect(Math.abs(s.pos[i * 3 + 2] + 50)).toBeLessThanOrEqual(20.001);
      expect(Number.isFinite(s.pos[i * 3 + 1])).toBe(true);
    }
  });

  it('floats them on the water', () => {
    const s = makeLeaves(64, { focus: { x: 0, z: 0 }, half: 20, seed: 4 });
    for (let i = 0; i < 600; i++) stepLeaves(s, 1 / 60, params({ floorAt: () => ({ y: 2, water: true }) }));
    for (let i = 0; i < 64; i++) expect(s.pos[i * 3 + 1]).toBeGreaterThanOrEqual(2);
  });

  it('blows a leaf a metre from a passing car', () => {
    const s = makeLeaves(1, { focus: { x: 0, z: 0 }, half: 20, seed: 1 });
    s.pos.set([1, 0.02, 0]);
    s.vel.fill(0);
    stepLeaves(s, 1 / 60, params({ wind: { x: 1, z: 0, strength: 0 }, car: { x: 0, z: 0, vx: 0, vz: 8 } }));
    expect(Math.hypot(s.vel[0], s.vel[2])).toBeGreaterThan(0.1);
  });
});

describe('createLeaves', () => {
  it('draws them as instanced quads', () => {
    const wind = createWind();
    const leaves = createLeaves({ count: 32, wind, floorAt: () => ({ y: 0, water: false }) });
    expect(leaves.mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(leaves.mesh.count).toBe(32);
    leaves.update(1 / 60, { x: 0, z: 0 }, null);
    leaves.dispose();
    wind.dispose();
  });
});

describe('createLeaves by the budget', () => {
  // (the device's level picked by hand, as ?quality= picks it)
  const at = (quality) => {
    vi.stubGlobal('window', { location: { search: `?quality=${quality}`, hash: '' }, localStorage: { getItem: () => null } });
    resetDevice();
  };
  afterEach(() => {
    vi.unstubAllGlobals();
    resetDevice();
  });
  const floorAt = () => ({ y: 0, water: false });

  it('makes none at low: no mesh, and its calls do nothing', () => {
    at('low');
    const wind = createWind();
    const leaves = createLeaves({ wind, floorAt });
    expect(leaves.mesh).toBeNull();
    expect(leaves.state.count).toBe(0);
    leaves.update(1 / 60, { x: 0, z: 0 }, null);
    leaves.shift(10, -10);
    leaves.dispose();
    wind.dispose();
  });

  it('makes the level’s count (high 1024) unless given one', () => {
    at('high');
    const wind = createWind();
    const leaves = createLeaves({ wind, floorAt });
    expect(leaves.mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(leaves.mesh.count).toBe(1024);
    expect(leaves.state.count).toBe(1024);
    leaves.dispose();
    at('low');
    const given = createLeaves({ count: 64, wind, floorAt });
    expect(given.mesh.count).toBe(64);
    given.dispose();
    wind.dispose();
  });
});
