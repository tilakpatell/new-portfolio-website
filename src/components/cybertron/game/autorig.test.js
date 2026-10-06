import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { autorig, joints } from './autorig';

// a robot in a T: a torso, a head, two arms straight out, two legs
function tPose() {
  const root = new THREE.Group();
  const m = new THREE.MeshStandardMaterial();
  const box = (w, h, d, x, y, z, name) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 2, 4, 2), m);
    mesh.position.set(x, y, z);
    mesh.name = name;
    root.add(mesh);
  };
  box(3, 4, 2, 0, 6.5, 0, 'torso');
  box(1.4, 1.4, 1.4, 0, 9.2, 0, 'head');
  box(3.5, 1, 1, 3.25, 7.8, 0, 'armL');
  box(3.5, 1, 1, -3.25, 7.8, 0, 'armR');
  box(1.2, 4.6, 1.2, 0.9, 2.3, 0, 'legL');
  box(1.2, 4.6, 1.2, -0.9, 2.3, 0, 'legR');
  return root;
}

describe('a skeleton made from the shape', () => {
  it('finds the hands out at the arms’ ends and the feet under the legs', () => {
    const J = joints(tPose());
    expect(J.L.hand.x).toBeGreaterThan(4.5);
    expect(J.R.hand.x).toBeLessThan(-4.5);
    expect(J.L.ankle.x).toBeGreaterThan(0.5);
    expect(J.R.ankle.x).toBeLessThan(-0.5);
    expect(J.hips.y).toBeGreaterThan(4);
    expect(J.hips.y).toBeLessThan(6);
  });

  it('puts the arms on the arm bones and the legs on the leg bones, one bone each', () => {
    const rigged = autorig(tPose());
    const meshes = rigged.children.filter((c) => c.isSkinnedMesh);
    expect(meshes).toHaveLength(6);
    const bones = meshes[0].skeleton.bones.map((b) => b.name);
    for (const name of ['Hips', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightUpLeg', 'RightLeg', 'RightFoot']) expect(bones).toContain(name);
    const named = (name) => meshes.find((m) => m.name === name);
    const boneOf = (mesh, i) => mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getX(i)].name;
    for (const [part, re] of [
      ['armL', /^Left(Arm|ForeArm|Hand)$/],
      ['armR', /^Right(Arm|ForeArm|Hand)$/],
      ['legL', /^Left(UpLeg|Leg|Foot)$/],
      ['legR', /^Right(UpLeg|Leg|Foot)$/],
    ]) {
      const mesh = named(part);
      const n = mesh.geometry.attributes.position.count;
      let right = 0;
      for (let i = 0; i < n; i++) if (re.test(boneOf(mesh, i))) right++;
      // (the plates right at the shoulder go with the chest, as armour should)
      expect(right / n, part).toBeGreaterThan(0.85);
    }
    for (const mesh of meshes) {
      const w = mesh.geometry.attributes.skinWeight;
      for (let i = 0; i < w.count; i++) expect(w.getX(i)).toBe(1);
    }
  });
});
