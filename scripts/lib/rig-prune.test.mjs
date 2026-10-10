import { Document } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { pruneRig, shareSkins } from './rig-prune.mjs';

// Hips → Spine → LeftArm → LeftHand, Hips → Wep_Root, Spine → PROC_Bone0
// (→ a prop that is no joint); only LeftHand carries weight
function rigged() {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  const n = (name, t) => doc.createNode(name).setTranslation(t);
  const hips = n('Hips', [0, 1, 0]);
  const spine = n('Spine', [0, 0.2, 0]);
  const arm = n('LeftArm', [0.2, 0.3, 0]);
  const hand = n('LeftHand', [0.3, 0, 0]);
  const wep = n('Wep_Root', [0, 0, 0.1]);
  const proc = n('PROC_Bone0', [0, 0.1, 0.1]).setScale([2, 2, 2]);
  const prop = n('Prop', [0.5, 0, 0]);
  scene.addChild(hips);
  hips.addChild(spine).addChild(wep);
  spine.addChild(arm).addChild(proc);
  arm.addChild(hand);
  proc.addChild(prop);
  const joints = [hips, spine, arm, hand, wep, proc];
  const ibm = new Float32Array(16 * joints.length);
  joints.forEach((_, i) => ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, i, 0, 0, 1], i * 16));
  const skin = doc.createSkin().setSkeleton(hips).setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm).setBuffer(buffer));
  for (const j of joints) skin.addJoint(j);
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', acc('VEC3', new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])))
    .setAttribute('JOINTS_0', acc('VEC4', new Uint16Array([3, 3, 3, 0, 3, 3, 3, 0, 3, 3, 3, 0])))
    .setAttribute('WEIGHTS_0', acc('VEC4', new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])));
  scene.addChild(doc.createNode('Body').setMesh(doc.createMesh().addPrimitive(prim)).setSkin(skin));
  return { doc, skin, prim, prop };
}

describe('the rig prune', () => {
  it('keeps the weighted bones and the chain above them', () => {
    const { doc, skin, prim, prop } = rigged();
    const before = prop.getWorldTranslation();
    const r = pruneRig(doc);
    expect(r.before).toBe(6);
    expect(r.after).toBe(4);
    expect([...r.removed].sort()).toEqual(['PROC_Bone0', 'Wep_Root']);
    const names = skin.listJoints().map((j) => j.getName());
    expect(names).toEqual(['Hips', 'Spine', 'LeftArm', 'LeftHand']);
    expect(prim.getAttribute('JOINTS_0').getArray()[0]).toBe(names.indexOf('LeftHand'));
    expect(skin.getInverseBindMatrices().getCount()).toBe(4);
    expect(skin.getInverseBindMatrices().getArray()[16 * 3 + 12]).toBe(3);
    // the prop under a removed bone keeps its place in the world
    const after = prop.getWorldTranslation();
    for (let i = 0; i < 3; i++) expect(after[i]).toBeCloseTo(before[i], 6);
    expect(prop.getParentNode().getName()).toBe('Spine');
  });

  it('keeps a bone it is told to by name', () => {
    const { doc } = rigged();
    const r = pruneRig(doc, { keep: ['Wep_Root'] });
    expect(r.after).toBe(5);
    expect(r.removed).toEqual(['PROC_Bone0']);
  });

  it('does nothing to a model with no skin', () => {
    const doc = new Document();
    doc.createScene().addChild(doc.createNode('a'));
    expect(pruneRig(doc)).toEqual({ before: 0, after: 0, removed: [] });
  });
});

describe('parts on one skeleton', () => {
  it('joins a part’s skin to the body’s by bone name, and drops its copy of the bones', () => {
    const { doc, skin } = rigged();
    const buffer = doc.getRoot().listBuffers()[0];
    // a cape's own copy of two of the bones, weighted to its LeftHand (its joint 1)
    const hips = doc.createNode('Hips').setTranslation([0, 1, 0]);
    const hand = doc.createNode('LeftHand');
    hips.addChild(hand);
    const scene = doc.getRoot().listScenes()[0];
    scene.addChild(hips);
    const cape = doc.createSkin().addJoint(hips).addJoint(hand);
    const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', acc('VEC3', new Float32Array(9)))
      .setAttribute('JOINTS_0', acc('VEC4', new Uint16Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])))
      .setAttribute('WEIGHTS_0', acc('VEC4', new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])));
    const node = doc.createNode('Cape').setMesh(doc.createMesh().addPrimitive(prim)).setSkin(cape);
    scene.addChild(node);
    expect(shareSkins(doc)).toBe(1);
    expect(node.getSkin()).toBe(skin);
    expect(doc.getRoot().listSkins()).toEqual([skin]);
    expect(prim.getAttribute('JOINTS_0').getArray()[0]).toBe(3);
    expect(doc.getRoot().listNodes().filter((n) => n.getName() === 'LeftHand').length).toBe(1);
  });

  it('leaves a part on a skeleton of its own as it is', () => {
    const { doc } = rigged();
    const tail = doc.createNode('Tail1');
    doc.getRoot().listScenes()[0].addChild(tail);
    doc.createNode('T').setSkin(doc.createSkin().addJoint(tail));
    expect(shareSkins(doc)).toBe(0);
    expect(doc.getRoot().listSkins().length).toBe(2);
  });
});
