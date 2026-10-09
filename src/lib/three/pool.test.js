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

  it('is never culled, so a slot placed after its first draw is drawn where it went', () => {
    const p = pool(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 4, 'crates');
    expect(p.mesh.frustumCulled).toBe(false);
    // (a frustum looking only at the slot, far from the free slots at the origin)
    const camera = new THREE.PerspectiveCamera(30, 1, 1, 50);
    camera.position.set(100, 2, 10);
    camera.lookAt(100, 2, 0);
    camera.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    // (three's own test: an object culled only when frustumCulled and outside it)
    const drawn = () => !p.mesh.frustumCulled || frustum.intersectsObject(p.mesh);
    expect(drawn()).toBe(true);
    const i = p.take();
    p.place(i, [100, 2, 0], [0, 0, 0, 1], 1);
    expect(drawn()).toBe(true);
    const m = new THREE.Matrix4();
    p.mesh.getMatrixAt(i, m);
    expect(new THREE.Vector3().setFromMatrixPosition(m).toArray()).toEqual([100, 2, 0]);
    expect(frustum.containsPoint(new THREE.Vector3(100, 2, 0))).toBe(true);
    p.dispose();
  });
});
