import { Document } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { atlasSet, atlasUVs, uvArea } from './bf2017-uv.mjs';

// The UV set the game reads a vehicle's maps through, told by what each set
// covers (the measures in the comments are the drop's LOD0s).
describe('the game’s atlas UV set', () => {
  it('sums a set’s triangles’ area in UV space, indexed or not', () => {
    const square = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    expect(uvArea(square, [0, 1, 2, 0, 2, 3])).toBeCloseTo(1);
    expect(uvArea(new Float32Array([0, 0, 2, 0, 0, 2]))).toBeCloseTo(2);
  });

  it('takes the second set where it unwraps the model once and the first tiles it', () => {
    expect(atlasSet(2.22, 0.66)).toBe(1); // the X-wing's fuselage
    expect(atlasSet(58.88, 0.81)).toBe(1); // the AT-AT's body
    expect(atlasSet(11.68, 1.26)).toBe(1); // the gunship's fuselage
    expect(atlasSet(0.81, 1416.3)).toBe(0); // the TIE Advanced's body: the first is the atlas
    expect(atlasSet(1.2, 0)).toBe(0); // the U-wing's, whose second set is a point
    expect(atlasSet(0.79, 0.79)).toBe(0); // the same either way: the drop's binding stands
    expect(atlasSet(200.1, 291.3)).toBe(0);
  });

  it('swaps the sets on the primitives whose atlas is the second', async () => {
    const doc = new Document();
    const buffer = doc.createBuffer();
    const acc = (type, a) => doc.createAccessor().setType(type).setArray(a).setBuffer(buffer);
    const pos = acc('VEC3', new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]));
    const index = acc('SCALAR', new Uint16Array([0, 1, 2, 0, 2, 3]));
    const tiled = acc('VEC2', new Float32Array([0, 0, 4, 0, 4, 4, 0, 4]));
    const once = acc('VEC2', new Float32Array([0, 0, 0.8, 0, 0.8, 0.8, 0, 0.8]));
    const prim = (a, b) => doc.createPrimitive().setAttribute('POSITION', pos).setIndices(index).setAttribute('TEXCOORD_0', a).setAttribute('TEXCOORD_1', b);
    const [hull, kept] = [prim(tiled, once), prim(once, tiled)];
    doc.createMesh().addPrimitive(hull).addPrimitive(kept);
    await doc.transform(atlasUVs());
    expect(hull.getAttribute('TEXCOORD_0')).toBe(once);
    expect(hull.getAttribute('TEXCOORD_1')).toBe(tiled);
    expect(kept.getAttribute('TEXCOORD_0')).toBe(once);
  });

  it('leaves a primitive whose maps the drop already reads through the second set as the drop binds them', async () => {
    // (the game's two-UV presets: the ISD's main engine binds its colour map
    // at texCoord 1, its atlas, and its tiling normal at 0; swapping the sets
    // again would put the colour on the tiling set)
    const doc = new Document();
    const buffer = doc.createBuffer();
    const acc = (type, a) => doc.createAccessor().setType(type).setArray(a).setBuffer(buffer);
    const pos = acc('VEC3', new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]));
    const index = acc('SCALAR', new Uint16Array([0, 1, 2, 0, 2, 3]));
    const tiled = acc('VEC2', new Float32Array([0, 0, 4, 0, 4, 4, 0, 4]));
    const once = acc('VEC2', new Float32Array([0, 0, 0.8, 0, 0.8, 0.8, 0, 0.8]));
    const colour = doc.createTexture('cs');
    const normal = doc.createTexture('nam');
    const mat = doc.createMaterial().setBaseColorTexture(colour).setNormalTexture(normal);
    mat.getBaseColorTextureInfo().setTexCoord(1);
    const engine = doc.createPrimitive().setAttribute('POSITION', pos).setIndices(index).setAttribute('TEXCOORD_0', tiled).setAttribute('TEXCOORD_1', once).setMaterial(mat);
    doc.createMesh().addPrimitive(engine);
    await doc.transform(atlasUVs());
    expect(engine.getAttribute('TEXCOORD_0')).toBe(tiled);
    expect(engine.getAttribute('TEXCOORD_1')).toBe(once);
    expect(mat.getBaseColorTextureInfo().getTexCoord()).toBe(1);
  });
});
