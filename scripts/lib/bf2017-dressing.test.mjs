import { Document } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { GLASS, dressed, isGlass, isMarker, isPacked, ncsColour } from './bf2017-dressing.mjs';

describe('the game’s materials, dressed for the site', () => {
  it('knows glass and gameplay markers by their names', () => {
    expect(isGlass('M_Glass')).toBe(true);
    expect(isGlass('M_XWing_Canopy_01')).toBe(true);
    expect(isGlass('M_LandSpeeder')).toBe(false);
    expect(isGlass('M_Window')).toBe(true);
    expect(isMarker('m_weakpoints_cover')).toBe(true);
    expect(isMarker('M_MTT_01_Exterior_01')).toBe(false);
  });

  it('makes bare glass see-through and drops the weak points’ covers', async () => {
    const doc = new Document();
    const mesh = doc.createMesh();
    const mat = (name) => doc.createMaterial(name);
    mesh.addPrimitive(doc.createPrimitive().setMaterial(mat('M_Glass')));
    mesh.addPrimitive(doc.createPrimitive().setMaterial(mat('m_weakpoints_cover')));
    mesh.addPrimitive(doc.createPrimitive().setMaterial(mat('M_Hull')));
    await doc.transform(dressed());
    const prims = mesh.listPrimitives();
    expect(prims.map((p) => p.getMaterial().getName())).toEqual(['M_Glass', 'M_Hull']);
    expect(prims[0].getMaterial().getAlphaMode()).toBe('BLEND');
    expect(prims[0].getMaterial().getBaseColorFactor()[3]).toBeCloseTo(GLASS.colour[3]);
    expect(prims[1].getMaterial().getAlphaMode()).toBe('OPAQUE');
  });

  it('takes a packed map’s colour from its blue', () => {
    expect(isPacked('t_tiefighter_wingpanels_01_ncs.ktx2')).toBe(true);
    expect(isPacked('t_tiefighter_wings_01_cs.ktx2')).toBe(false);
    expect([...ncsColour(Buffer.from([128, 69, 40, 200, 120, 60, 90, 10]))]).toEqual([40, 40, 40, 90, 90, 90]);
  });

  it('strips the smoothness alpha from an opaque material’s colour map, and keeps a blended one’s', async () => {
    const sharp = (await import('sharp')).default;
    const rgba = await sharp({ create: { width: 2, height: 2, channels: 4, background: { r: 200, g: 100, b: 50, alpha: 0.3 } } }).png().toBuffer();
    const doc = new Document();
    const mesh = doc.createMesh();
    const hull = doc.createMaterial('M_Hull').setBaseColorTexture(doc.createTexture('hull').setImage(new Uint8Array(rgba)).setMimeType('image/png'));
    const decal = doc.createMaterial('M_Decal').setAlphaMode('BLEND').setBaseColorTexture(doc.createTexture('decal').setImage(new Uint8Array(rgba)).setMimeType('image/png'));
    mesh.addPrimitive(doc.createPrimitive().setMaterial(hull)).addPrimitive(doc.createPrimitive().setMaterial(decal));
    await doc.transform(dressed({ sharp }));
    expect((await sharp(Buffer.from(hull.getBaseColorTexture().getImage())).metadata()).hasAlpha).toBe(false);
    expect((await sharp(Buffer.from(decal.getBaseColorTexture().getImage())).metadata()).hasAlpha).toBe(true);
  });
});
