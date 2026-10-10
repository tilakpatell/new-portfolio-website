import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { STACKED, createKnocks, loosePlaces, stacksOf } from './knocks';

const flat = () => 0;
const things = [
  { kind: 'barrel', at: [20, -9] },
  { kind: 'barrel', at: [21.2, -9.6] },
  { kind: 'bevelcrate', at: [18.6, -10.2] },
  { kind: 'vaporator', at: [-34, 22] },
  { kind: 'crates', at: [-21, 23] },
];
const atOf = (parent, name, i = 0) => {
  const mesh = parent.children.find((m) => m.name === name);
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(i, m);
  return new THREE.Vector3().setFromMatrixPosition(m);
};

describe('the stacks a site puts down', () => {
  it('gathers the crates and barrels within a few metres into one stack, and nothing else', () => {
    const stacks = stacksOf(things);
    expect(stacks).toHaveLength(2);
    expect(stacks[0].x).toBeCloseTo((20 + 21.2 + 18.6) / 3, 6);
    expect(stacks.every((s) => s.r > 0)).toBe(true);
    expect(STACKED.has('vaporator')).toBe(false);
  });
  it('sets loose ones round each, clear of it, on the ground, the same every time', () => {
    const ground = (x) => 0.1 * x;
    const a = loosePlaces(things, ground);
    const b = loosePlaces(things, ground);
    expect(a).toEqual(b);
    expect(a).toHaveLength(6); // (two crates and a barrel a stack)
    expect(a.filter((p) => p.kind === 'crate')).toHaveLength(4);
    for (const s of stacksOf(things)) {
      const mine = a.filter((p) => Math.hypot(p.x - s.x, p.z - s.z) < s.r + 4);
      expect(mine).toHaveLength(3);
      for (const p of mine) expect(Math.hypot(p.x - s.x, p.z - s.z)).toBeGreaterThan(s.r + 0.8);
    }
    for (const p of a) expect(p.y).toBeCloseTo(0.1 * p.x, 6);
  });
  it('has none for a site with no stacks', () => {
    expect(loosePlaces([{ kind: 'tree', at: [0, 0] }], flat)).toEqual([]);
    expect(loosePlaces(undefined, flat)).toEqual([]);
  });
});

describe('the loose crates and barrels', () => {
  const places = loosePlaces(things, flat);
  it('stand still, drawn, on a phone or with Data Saver: no engine loaded', async () => {
    for (const dev of [{ tier: 'mid', phone: true }, { tier: 'high', saveData: true }]) {
      const parent = new THREE.Group();
      const k = await createKnocks({ parent, dev, impacts: null, places, ground: flat });
      expect(k.physical).toBe(false);
      k.step(1 / 60, { x: places[0].x, y: 0, z: places[0].z }, null);
      expect(atOf(parent, 'knockable-crate').x).toBeCloseTo(places[0].x, 4);
      k.dispose();
    }
  });

  it('scatter when a speeder goes through them, and are heard', async () => {
    const parent = new THREE.Group();
    const impacts = { onHit: vi.fn() };
    const k = await createKnocks({ parent, dev: { tier: 'high' }, impacts, places, ground: flat });
    expect(k.physical).toBe(true);
    const crate = places.find((p) => p.kind === 'crate');
    // a speeder bike at 15 m/s straight through the first crate
    for (let i = 0; i < 120; i++) k.step(1 / 60, { x: crate.x - 12 + i * 0.25, y: 1, z: crate.z }, { radius: 0.75 });
    expect(atOf(parent, 'knockable-crate').distanceTo(new THREE.Vector3(crate.x, atOf(parent, 'knockable-crate').y, crate.z))).toBeGreaterThan(1);
    expect(impacts.onHit).toHaveBeenCalled();
    k.dispose();
  });

  it('are shoved by you on foot, too', async () => {
    const parent = new THREE.Group();
    const k = await createKnocks({ parent, dev: { tier: 'high' }, impacts: null, places, ground: flat });
    const crate = places.find((p) => p.kind === 'crate');
    for (let i = 0; i < 180; i++) k.step(1 / 60, { x: crate.x - 3 + i * 0.05, y: 0, z: crate.z }, null);
    expect(atOf(parent, 'knockable-crate').distanceTo(new THREE.Vector3(crate.x, atOf(parent, 'knockable-crate').y, crate.z))).toBeGreaterThan(0.3);
    k.dispose();
  });
});
