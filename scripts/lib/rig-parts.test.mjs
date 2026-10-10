import { Document } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { detach, joinSkinned, rebindJoints, shareSkins } from './rig-parts.mjs';

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
    const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
    // (bound in the body's own pose: its inverse binds the body's for those two bones)
    const ibm = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 0, 0, 1]);
    const cape = doc.createSkin().addJoint(hips).addJoint(hand).setInverseBindMatrices(acc('MAT4', ibm));
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

describe('a part’s joints re-bound to the body’s', () => {
  it('re-indexes by name', () => {
    const r = rebindJoints(['Hips', 'Head'], ['Hips', 'Spine', 'Head'], new Uint16Array([1, 0, 0, 0]));
    expect([...r.joints]).toEqual([2, 0, 0, 0]);
    expect(r.unmatched).toBe(0);
  });

  it('binds a joint the body lacks to its Hips, and counts it', () => {
    const r = rebindJoints(['Cape_Phys_01', 'Head'], ['Spine', 'Hips', 'Head'], new Uint16Array([0, 1, 0, 0]));
    expect([...r.joints]).toEqual([1, 2, 1, 1]);
    expect(r.unmatched).toBe(1);
  });

  it('leaves a slot of no weight at 0', () => {
    const r = rebindJoints(['Hips', 'Head'], ['Spine', 'Hips', 'Head'], new Uint16Array([1, 0, 0, 0]), new Float32Array([1, 0, 0, 0]));
    expect([...r.joints]).toEqual([2, 0, 0, 0]);
  });
});

describe('a part made in another bind pose', () => {
  // a part's copy of Hips and LeftHand (the body's joints 0 and 3), its
  // inverse binds the body's under a further turn `d` of its own
  function partWith(doc, ibms) {
    const buffer = doc.getRoot().listBuffers()[0];
    const hips = doc.createNode('Hips');
    const hand = doc.createNode('LeftHand');
    hips.addChild(hand);
    doc.getRoot().listScenes()[0].addChild(hips);
    const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
    const part = doc.createSkin().addJoint(hips).addJoint(hand).setInverseBindMatrices(acc('MAT4', new Float32Array(ibms.flat())));
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', acc('VEC3', new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])))
      .setAttribute('JOINTS_0', acc('VEC4', new Uint16Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])))
      .setAttribute('WEIGHTS_0', acc('VEC4', new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])));
    doc.getRoot().listScenes()[0].addChild(doc.createNode('Head').setMesh(doc.createMesh().addPrimitive(prim)).setSkin(part));
    return prim;
  }
  const T = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];

  it('is moved into the body’s bind pose before it shares the body’s skeleton', () => {
    const { doc } = rigged();
    // (the body's inverse binds translate by the joint's index along x; the part's by that and 0.5 up)
    const prim = partWith(doc, [T(0, 0.5, 0), T(3, 0.5, 0)]);
    expect(shareSkins(doc)).toBe(1);
    const p = prim.getAttribute('POSITION').getArray();
    expect([p[0], p[1], p[2]].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0, 0.5, 0]);
    expect([p[3], p[4], p[5]].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([1, 0.5, 0]);
  });

  it('refuses a part whose joints disagree about where its bind pose is', () => {
    const { doc } = rigged();
    partWith(doc, [T(0, 0.5, 0), T(3, 0.9, 0)]);
    expect(() => shareSkins(doc)).toThrow(/LeftHand/);
  });
});

describe('a figure’s parts joined per material', () => {
  // three parts on the one skin (a body, a helmet, a backpack), two materials
  // between them: the body and the backpack share the armour's
  function parts() {
    const { doc, skin, prim } = rigged();
    const root = doc.getRoot();
    const buffer = root.listBuffers()[0];
    const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
    const armour = doc.createMaterial('armour');
    const visor = doc.createMaterial('visor');
    prim.setMaterial(armour);
    const part = (name, material, y) => {
      const p = doc
        .createPrimitive()
        .setMaterial(material)
        .setAttribute('POSITION', acc('VEC3', new Float32Array([0, y, 0, 1, y, 0, 0, y + 1, 0])))
        .setAttribute('JOINTS_0', acc('VEC4', new Uint16Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])))
        .setAttribute('WEIGHTS_0', acc('VEC4', new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])));
      root.listScenes()[0].addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(p)).setSkin(skin));
    };
    part('helmet', visor, 2);
    part('backpack', armour, 3);
    return { doc, skin };
  }
  const draws = (doc) =>
    doc
      .getRoot()
      .listMeshes()
      .reduce((n, m) => n + m.listPrimitives().length, 0);

  it('leaves one draw a material on the skin, every vertex kept', () => {
    const { doc, skin } = parts();
    expect(draws(doc)).toBe(3);
    expect(joinSkinned(doc)).toBe(1);
    expect(draws(doc)).toBe(2);
    const nodes = doc
      .getRoot()
      .listNodes()
      .filter((n) => n.getMesh());
    expect(nodes.length).toBe(1);
    expect(nodes[0].getSkin()).toBe(skin);
    const prims = nodes[0].getMesh().listPrimitives();
    const counts = Object.fromEntries(prims.map((p) => [p.getMaterial().getName(), p.getAttribute('POSITION').getCount()]));
    expect(counts).toEqual({ armour: 6, visor: 3 });
    // (the joints come with the vertices, unchanged)
    const armour = prims.find((p) => p.getMaterial().getName() === 'armour');
    expect([...armour.getAttribute('JOINTS_0').getArray()].filter((_, i) => i % 4 === 0)).toEqual([3, 3, 3, 1, 1, 1]);
  });

  it('keeps apart what cannot share a draw: another skin, other attributes', () => {
    const { doc } = parts();
    const root = doc.getRoot();
    const helmet = root.listNodes().find((n) => n.getName() === 'helmet');
    const backpack = root.listNodes().find((n) => n.getName() === 'backpack').getMesh().listPrimitives()[0];
    const buffer = root.listBuffers()[0];
    backpack.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(6)).setBuffer(buffer));
    helmet.setSkin(doc.createSkin().addJoint(root.listNodes().find((n) => n.getName() === 'Hips')));
    joinSkinned(doc);
    expect(draws(doc)).toBe(3);
  });
});
