import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createLodSet, lodBand } from './lod';

describe('which level a thing is drawn at, by how far it is', () => {
  const BANDS = [60, 140];

  it('is the band its distance falls in, with nothing before it', () => {
    expect(lodBand(10, BANDS)).toBe(0);
    expect(lodBand(59, BANDS)).toBe(0);
    expect(lodBand(61, BANDS)).toBe(1);
    expect(lodBand(139, BANDS)).toBe(1);
    expect(lodBand(141, BANDS)).toBe(2);
  });

  it('holds where it was until it is well past the boundary, either way', () => {
    // (hysteresis 0.1: a 6 m dead band round 60 m)
    expect(lodBand(62, BANDS, 0, 0.1)).toBe(0);
    expect(lodBand(64, BANDS, 0, 0.1)).toBe(1);
    expect(lodBand(58, BANDS, 1, 0.1)).toBe(1);
    expect(lodBand(56, BANDS, 1, 0.1)).toBe(0);
    expect(lodBand(135, BANDS, 2, 0.1)).toBe(2);
    expect(lodBand(132, BANDS, 2, 0.1)).toBe(1);
  });

  it('jumps straight to the far band from the near one', () => {
    expect(lodBand(300, BANDS, 0, 0.1)).toBe(2);
    expect(lodBand(5, BANDS, 2, 0.1)).toBe(0);
  });
});

describe('a set of instanced things drawn by distance', () => {
  const geo = new THREE.BoxGeometry();
  const mat = new THREE.MeshBasicMaterial();
  const items = [
    { x: 10, y: 0, z: 0 },
    { x: 100, y: 0, z: 0 },
    { x: 300, y: 0, z: 0 },
  ];
  // each level's own matrix per item: here each item at its place, the level
  // telling itself apart by its scale
  const matricesFor = (scale) => {
    const out = new Float32Array(items.length * 16);
    const m = new THREE.Matrix4();
    items.forEach((p, i) => m.compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale)).toArray(out, i * 16));
    return out;
  };
  const make = () => {
    const near = new THREE.InstancedMesh(geo, mat, items.length);
    const mid = new THREE.InstancedMesh(geo, mat, items.length);
    const card = new THREE.InstancedMesh(geo, mat, items.length);
    const trunk = new THREE.InstancedMesh(geo, mat, items.length);
    const set = createLodSet({
      items,
      bands: [60, 140],
      levels: [
        { mesh: near, bands: [0], matrices: matricesFor(1) },
        { mesh: mid, bands: [1], matrices: matricesFor(2) },
        { mesh: card, bands: [2], matrices: matricesFor(3) },
        { mesh: trunk, bands: [0, 1], matrices: matricesFor(4) },
      ],
    });
    return { set, near, mid, card, trunk };
  };
  const camAt = (x, z) => {
    const c = new THREE.PerspectiveCamera();
    c.position.set(x, 2, z);
    return c;
  };
  const xOf = (mesh, i) => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(mesh.instanceMatrix.array, i * 16)).x;
  const scaleOf = (mesh, i) => new THREE.Vector3().setFromMatrixScale(new THREE.Matrix4().fromArray(mesh.instanceMatrix.array, i * 16)).x;

  it('puts each thing in its level, and the trunks under the near and the mid ones', () => {
    const { set, near, mid, card, trunk } = make();
    set.update(camAt(0, 0), 0);
    expect([near.count, mid.count, card.count, trunk.count]).toEqual([1, 1, 1, 2]);
    expect(xOf(near, 0)).toBeCloseTo(10, 5);
    expect(xOf(mid, 0)).toBeCloseTo(100, 5);
    expect(xOf(card, 0)).toBeCloseTo(300, 5);
    expect(scaleOf(card, 0)).toBeCloseTo(3, 5);
    expect([xOf(trunk, 0), xOf(trunk, 1)].sort((a, b) => a - b)).toEqual([10, 100]);
    expect(set.stats).toEqual({ bands: [1, 1, 1] });
  });

  it('sorts again only after a while, or once the camera has gone far enough', () => {
    const { set, near } = make();
    set.update(camAt(0, 0), 0);
    // nearer the far one, but not far enough or long enough to re-sort
    set.update(camAt(10, 0), 0.1);
    expect(near.count).toBe(1);
    // gone 200 m: re-sorted at once (now the one at 300 is near, the one at 10 a card)
    set.update(camAt(290, 0), 0.01);
    expect(near.count).toBe(1);
    expect(xOf(near, 0)).toBeCloseTo(300, 5);
  });

  it('re-sorts after half a second even standing still, as things come and go', () => {
    const { set, near, mid } = make();
    set.update(camAt(0, 0), 0);
    items[1].x = 20;
    set.update(camAt(0, 0), 0.6);
    expect(near.count).toBe(2);
    expect(mid.count).toBe(0);
    items[1].x = 100;
  });
});
