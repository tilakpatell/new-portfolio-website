import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bake } from '../../universe/trafficKit';
import { cellPlant, createPatches } from './patches';

// a kit that only bakes, and a flat world with no water
const kit = { geometry: (list) => bake(list, 1), mats: new Proxy({}, { get: (_, name) => new THREE.MeshBasicMaterial({ name }) }) };
const world = { heightAt: () => 2, normalAt: () => [0, 1, 0], water: null };
const site = { ground: { seed: 3 }, land: { at: [0, 0] }, places: [{ at: [200, 0], flat: { r: 20 } }], patches: [{ kind: 'fern', spacing: 2, radius: 30, scale: [0.8, 1.4], cover: 0.9, opts: { seed: 3 } }] };
const matrices = (p) => p.group.children[0].instanceMatrix.array.slice();
const positions = (p) => {
  const mesh = p.group.children[0];
  const m = new THREE.Matrix4();
  const out = [];
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m);
    if (m.elements[0] !== 0 || m.elements[1] !== 0 || m.elements[2] !== 0) out.push([m.elements[12], m.elements[14]]);
  }
  return out;
};

describe('the undergrowth that goes with you', () => {
  it('grows the same plant in a cell every time, and some cells none', () => {
    const spec = { spacing: 2, cover: 0.6, scale: [1, 2] };
    expect(cellPlant(12, -7, spec, 5)).toEqual(cellPlant(12, -7, spec, 5));
    let grown = 0;
    for (let x = 0; x < 40; x++) for (let z = 0; z < 40; z++) grown += cellPlant(x, z, spec, 5).grow ? 1 : 0;
    expect(grown).toBeGreaterThan(200);
    expect(grown).toBeLessThan(1600);
  });

  it('stands plants round you, none on the landing pad or a place’s ground', () => {
    const p = createPatches({ parent: new THREE.Group(), kit, world, site });
    p.update(0, 0);
    const near = positions(p);
    expect(near.length).toBeGreaterThan(50);
    expect(near.every(([x, z]) => Math.hypot(x, z) > 23)).toBe(true);
    p.update(200, 0);
    expect(positions(p).every(([x, z]) => Math.hypot(x - 200, z) > 21)).toBe(true);
  });

  it('keeps every plant where it grew: walk away and back, and it is all as it was', () => {
    const p = createPatches({ parent: new THREE.Group(), kit, world, site });
    p.update(60, 40);
    const before = matrices(p);
    p.update(900, -300);
    p.update(60, 40);
    expect(matrices(p)).toEqual(before);
  });

  it('thins them out toward the patch’s edge, none past it', () => {
    const p = createPatches({ parent: new THREE.Group(), kit, world, site });
    p.update(100, 100);
    expect(positions(p).every(([x, z]) => Math.hypot(x - 100, z - 100) <= 30)).toBe(true);
  });
});
