import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cullWithin } from './meshyCast';

// a skinned figure 1.8 m tall, as a Meshy rig arrives: its mesh under a
// node scaled to the rig's centimetres, its positions in those units
function figure() {
  const geo = new THREE.BoxGeometry(50, 180, 30).translate(0, 90, 0);
  const n = geo.attributes.position.count;
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0), 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(n).fill([1, 0, 0, 0]).flat(), 4));
  const root = new THREE.Bone();
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  const rig = new THREE.Group();
  rig.scale.setScalar(0.01);
  rig.add(root, mesh);
  mesh.bind(new THREE.Skeleton([root]));
  const group = new THREE.Group();
  group.add(rig);
  group.updateMatrixWorld(true);
  return { group, mesh };
}
const frustumAt = (x, z) => {
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  cam.position.set(x, 1.2, z);
  cam.lookAt(x, 1.0, z - 5);
  cam.updateMatrixWorld();
  return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
};

describe('a Meshy figure’s culling', () => {
  it('culls a skinned figure within a sphere round the whole figure, whatever its rig’s units', () => {
    const { group, mesh } = figure();
    cullWithin(mesh, group, 1.8);
    expect(mesh.frustumCulled).toBe(true);
    const world = mesh.boundingSphere.clone().applyMatrix4(mesh.matrixWorld);
    expect(world.center.y).toBeCloseTo(0.9, 5);
    expect(world.radius).toBeCloseTo(1.8 * 0.8, 5);
  });
  it('is seen in front of the camera, close or off to one side, and not behind it', () => {
    const { group, mesh } = figure();
    cullWithin(mesh, group, 1.8);
    const f = frustumAt(0, 5);
    for (const [x, z, seen] of [
      [0, 0, true],
      [0, 3.6, true],
      [2.2, 1, true],
      [0, 8, false],
    ]) {
      group.position.set(x, 0, z);
      group.updateMatrixWorld(true);
      expect(f.intersectsObject(mesh), `${x},${z}`).toBe(seen);
    }
  });
});
