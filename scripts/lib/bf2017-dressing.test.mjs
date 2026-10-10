import { Document } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { GLASS, KEPT, decalOf, dressed, isGlass, isMarker, isPacked, ncsColour, withMask } from './bf2017-dressing.mjs';

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

  it('tells a decal by its shader: one that lerps everything, and one that lerps only the normal', () => {
    expect(decalOf('Shaders/Presets/Walrus/SS_DecalLerpEverything_01')).toBe('colour');
    expect(decalOf('Shaders/Presets/Walrus/SS_DecalLerpNormal_01')).toBe('normal');
    expect(decalOf('Shaders/Presets/Walrus/SS_VehiclePreset')).toBe(null);
    expect([...withMask(Buffer.from([10, 20, 30, 99, 40, 50, 60, 99]), Buffer.from([0, 0, 255, 1, 0, 0, 0, 1]))]).toEqual([10, 20, 30, 255, 40, 50, 60, 0]);
  });

  it('blends a decal through the game’s own mask, drops a normal-only one, and leaves every other map as the game made it', async () => {
    const sharp = (await import('sharp')).default;
    const png = (r, g, b, alpha) => sharp({ create: { width: 2, height: 2, channels: 4, background: { r, g, b, alpha } } }).png().toBuffer();
    const tex = async (name, ...c) => doc.createTexture(name).setImage(new Uint8Array(await png(...c))).setMimeType('image/png');
    const doc = new Document();
    const mesh = doc.createMesh();
    const hullMap = await tex('t_hull_cs', 200, 100, 50, 0.3);
    const hull = doc.createMaterial('M_Hull').setBaseColorTexture(hullMap);
    const decal = doc.createMaterial('Mat_XWing_decal_ca').setExtras({ decal: 'colour' }).setBaseColorTexture(await tex('t_decals_cs', 160, 40, 40, 0.6)).setMetallicRoughnessTexture(await tex('t_decals_nam__orm', 255, 108, 255, 1));
    const normalOnly = doc.createMaterial('Mat_XWing_decal_na').setExtras({ decal: 'normal' });
    for (const m of [hull, decal, normalOnly]) mesh.addPrimitive(doc.createPrimitive().setMaterial(m));
    await doc.transform(dressed({ sharp }));
    expect(mesh.listPrimitives().map((p) => p.getMaterial().getName())).toEqual(['M_Hull', 'Mat_XWing_decal_ca']);
    expect(hull.getBaseColorTexture()).toBe(hullMap);
    expect(decal.getAlphaMode()).toBe('BLEND');
    expect(decal.getMetallicFactor()).toBe(0);
    expect(decal.getExtras()).toEqual({});
    const made = decal.getBaseColorTexture();
    expect(made.getName().startsWith(KEPT)).toBe(true);
    expect(made.getMimeType()).toBe('image/webp');
    const { data } = await sharp(Buffer.from(made.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([...data.subarray(0, 4)]).toEqual([160, 40, 40, 255]);
  });
});
