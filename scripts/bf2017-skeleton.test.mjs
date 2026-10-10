import { Document } from '@gltf-transform/core';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BODY, SOCKETS, checkWalrus } from '../src/lib/three/walrusRig.js';
import { SKELETON, skeletonOnly, walrusIo } from './bf2017-skeleton.mjs';

const WALRUS = 'public/models/galaxy/bf2017/walrus.glb';

// a rig under the game's names, a skinned body and a prop that is no joint
function rigged() {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('Scene');
  const names = BODY.concat(Object.values(SOCKETS), ['LeftArm_Phys_01']);
  const nodes = names.map((n, i) => doc.createNode(n).setTranslation([0, i * 0.01, 0]));
  const rig = doc.createNode('Rig_Root');
  scene.addChild(rig);
  for (const n of nodes) rig.addChild(n);
  const skin = doc.createSkin();
  for (const n of nodes) skin.addJoint(n);
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', acc('VEC3', new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])))
    .setMaterial(doc.createMaterial('cloth'));
  scene.addChild(doc.createNode('Body').setMesh(doc.createMesh().addPrimitive(prim)).setSkin(skin));
  nodes[0].addChild(doc.createNode('Prop').setMesh(doc.createMesh().addPrimitive(prim)));
  return doc;
}

describe('the skeleton file', () => {
  it('keeps every joint, its parents and rest transform, and nothing else', async () => {
    const doc = rigged();
    expect(await skeletonOnly(doc)).toBe(BODY.length + 6);
    const root = doc.getRoot();
    expect(root.listMeshes()).toHaveLength(0);
    expect(root.listSkins()).toHaveLength(0);
    expect(root.listMaterials()).toHaveLength(0);
    const names = root.listNodes().map((n) => n.getName());
    expect(names).toContain('Rig_Root');
    expect(names).toContain('LeftArm_Phys_01');
    expect(names).not.toContain('Body');
    expect(names).not.toContain('Prop');
    expect(root.listNodes().find((n) => n.getName() === 'Spine1').getTranslation()[1]).toBeCloseTo(0.02);
    expect(root.listScenes()[0].getName()).toBe(SKELETON);
    expect(checkWalrus(names).ok).toBe(true);
  });
  it('refuses a figure whose parts kept skins of their own', async () => {
    const doc = rigged();
    doc.createSkin().addJoint(doc.getRoot().listNodes()[0]);
    await expect(skeletonOnly(doc)).rejects.toThrow(/one skin/);
  });
  // (made once from Luke with keys to the bucket: docs/superpowers/HANDOFF-bf2017.md)
  it.skipIf(!existsSync(WALRUS))('is committed whole: every body bone and socket, 248 joints at least', async () => {
    const doc = await (await walrusIo()).read(WALRUS);
    const names = doc.getRoot().listNodes().map((n) => n.getName());
    expect(checkWalrus(names).ok).toBe(true);
    expect(names.length).toBeGreaterThanOrEqual(248);
  });
});
