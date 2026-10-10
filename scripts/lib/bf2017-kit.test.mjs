import { Document } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { kitIndex, mergeKit, pieceName } from './bf2017-kit.mjs';

// a piece as the drop has one: its own document, a node or two, a mesh whose
// material is the system's shared one (`M_Wall`), its origin at a corner
function piece(x, { material = 'M_Wall', nodes = 1 } = {}) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  const m = doc.createMaterial(material).setRoughnessFactor(0.7).setMetallicFactor(0);
  for (let n = 0; n < nodes; n++) {
    const pos = doc
      .createAccessor()
      .setType('VEC3')
      .setArray(new Float32Array([0, 0, 0, x, 0, 0, 0, 3, n]))
      .setBuffer(buffer);
    const prim = doc.createPrimitive().setAttribute('POSITION', pos).setMaterial(m);
    scene.addChild(doc.createNode(`part${n}`).setMesh(doc.createMesh().addPrimitive(prim)));
  }
  return doc;
}

describe('a kit: the pieces of one system in one file', () => {
  it('keeps each piece as one node by its name, and shares the material the pieces share', async () => {
    const doc = await mergeKit([
      { name: 'wall_a', doc: piece(2.56) },
      { name: 'wall_b', doc: piece(5.12, { nodes: 2 }) },
    ]);
    const root = doc.getRoot();
    expect(root.listScenes()).toHaveLength(1);
    expect(root.listScenes()[0].listChildren().map((n) => n.getName())).toEqual(['wall_a', 'wall_b']);
    expect(root.listMaterials()).toHaveLength(1);
    // (a piece's own parts joined: one draw per material it wears)
    for (const n of root.listScenes()[0].listChildren()) {
      const prims = [];
      n.traverse((c) => c.getMesh() && prims.push(...c.getMesh().listPrimitives()));
      expect(prims).toHaveLength(1);
    }
  });

  it('keeps two materials apart where the pieces wear different ones', async () => {
    const doc = await mergeKit([
      { name: 'wall', doc: piece(2.56) },
      { name: 'floor', doc: piece(2.56, { material: 'M_Floor' }) },
    ]);
    expect(doc.getRoot().listMaterials().map((m) => m.getName()).sort()).toEqual(['M_Floor', 'M_Wall']);
  });

  it('indexes each piece’s box, from its own origin (kept where the game put it)', async () => {
    const doc = await mergeKit([{ name: 'wall_b', doc: piece(5.12, { nodes: 2 }) }]);
    const at = kitIndex(doc).wall_b;
    expect(at.min).toEqual([0, 0, 0]);
    expect(at.max).toEqual([5.12, 3, 1]);
  });

  it('names a piece as the kit file keeps it: the manifest name’s last part, without _mesh', () => {
    expect(pieceName('objects/architecture/hoth/hangarsystem_01/new/hangarlargewall_01_3072x2048_mesh')).toBe('hangarlargewall_01_3072x2048');
    expect(pieceName('wall_01_s_256x256')).toBe('wall_01_s_256x256');
  });
});
