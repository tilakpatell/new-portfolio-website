import { Document } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { detach, rebindJoints, shareSkins } from './rig-parts.mjs';

// Hips → Spine → LeftArm → LeftHand, Hips → Wep_Root, Spine → PROC_Bone0
// (→ a prop that is no joint)
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

describe('a bone taken out of the tree', () => {
  it('leaves what hung from it where it was in the world', () => {
    const { doc, prop } = rigged();
    const before = prop.getWorldTranslation();
    detach(doc.getRoot().listNodes().find((n) => n.getName() === 'PROC_Bone0'));
    const after = prop.getWorldTranslation();
    for (let i = 0; i < 3; i++) expect(after[i]).toBeCloseTo(before[i], 6);
    expect(prop.getParentNode().getName()).toBe('Spine');
  });
});

describe('a part’s joints bound to the body’s', () => {
  it('re-indexes by name', () => {
    const r = rebindJoints(['Hips', 'Head'], ['Hips', 'Spine', 'Head'], new Uint16Array([1, 0, 0, 0]));
    expect([...r.joints]).toEqual([2, 0, 0, 0]);
    expect(r.unmatched).toBe(0);
  });
  it('binds a bone the body lacks to its Hips, and counts it', () => {
    const r = rebindJoints(['Hips', 'Cape_01'], ['Spine', 'Hips'], new Uint16Array([1, 0, 0, 0]));
    expect([...r.joints]).toEqual([1, 1, 1, 1]);
    expect(r.unmatched).toBe(1);
  });
  it('or to its nearest ancestor the body has, when it knows the parents', () => {
    const parents = { Cape_02: 'Cape_01', Cape_01: 'Spine2', Spine2: 'Hips' };
    const r = rebindJoints(['Cape_02', 'Hips'], ['Hips', 'Spine2'], new Uint16Array([0, 1, 0, 0]), { parentOf: (n) => parents[n], weights: new Float32Array([0.5, 0.5, 0, 0]) });
    expect([...r.joints]).toEqual([1, 0, 0, 0]);
  });
  it('joins a part with a bone of its own, which goes', () => {
    const { doc, skin } = rigged();
    const buffer = doc.getRoot().listBuffers()[0];
    const hips = doc.createNode('Hips');
    const flap = doc.createNode('Flap_01');
    hips.addChild(flap);
    doc.getRoot().listScenes()[0].addChild(hips);
    const part = doc.createSkin().addJoint(hips).addJoint(flap);
    const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', acc('VEC3', new Float32Array(3)))
      .setAttribute('JOINTS_0', acc('VEC4', new Uint16Array([1, 0, 0, 0])))
      .setAttribute('WEIGHTS_0', acc('VEC4', new Float32Array([1, 0, 0, 0])));
    doc.getRoot().listScenes()[0].addChild(doc.createNode('Skirt').setMesh(doc.createMesh().addPrimitive(prim)).setSkin(part));
    const said = [];
    expect(shareSkins(doc, { log: (l) => said.push(l) })).toBe(1);
    expect(doc.getRoot().listSkins()).toEqual([skin]);
    expect(prim.getAttribute('JOINTS_0').getArray()[0]).toBe(0);
    expect(said[0]).toMatch(/1 joints bound, 1 unmatched/);
  });
});
