import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { pool } from './pool';

describe('pool', () => {
  it('gives every slot once, then −1, and a freed slot again', () => {
    const p = pool(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 3, 'crates');
    expect(p.mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(p.mesh.name).toBe('crates');
    const got = [p.take(), p.take(), p.take()];
    expect(new Set(got).size).toBe(3);
    expect(p.take()).toBe(-1);
    p.free(got[1]);
    expect(p.take()).toBe(got[1]);
    p.dispose();
  });

  it('draws a placed slot, and a free one at nothing', () => {
    const p = pool(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 2, 'rocks');
    const m = new THREE.Matrix4();
    const s = new THREE.Vector3();
    p.mesh.getMatrixAt(0, m);
    expect(s.setFromMatrixScale(m).length()).toBe(0);
    const i = p.take();
    p.place(i, [1, 2, 3], [0, 0, 0, 1], 2);
    p.mesh.getMatrixAt(i, m);
    expect(s.setFromMatrixScale(m).x).toBeCloseTo(2, 9);
    expect(new THREE.Vector3().setFromMatrixPosition(m).toArray()).toEqual([1, 2, 3]);
    p.free(i);
    p.mesh.getMatrixAt(i, m);
    expect(s.setFromMatrixScale(m).length()).toBe(0);
    p.dispose();
  });
});
