import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bindSlot } from './levelGltf';

describe('a level pack’s textures bound to their materials', () => {
  it('reads a colour or emissive map as sRGB, whatever its file says (the game’s colour maps are BC7_SRGB)', () => {
    const mat = new THREE.MeshStandardMaterial();
    const colour = new THREE.Texture();
    colour.colorSpace = THREE.NoColorSpace; // (a KTX2 labelled linear)
    bindSlot(mat, 'map', colour);
    expect(mat.map).toBe(colour);
    expect(colour.colorSpace).toBe(THREE.SRGBColorSpace);
    const glow = new THREE.Texture();
    bindSlot(mat, 'emissiveMap', glow);
    expect(glow.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('leaves the data maps linear: normals, roughness and metal', () => {
    const mat = new THREE.MeshStandardMaterial();
    const normal = new THREE.Texture();
    const orm = new THREE.Texture();
    bindSlot(mat, 'normalMap', normal);
    bindSlot(mat, 'metalRough', orm);
    expect(normal.colorSpace).toBe(THREE.NoColorSpace);
    expect(mat.roughnessMap).toBe(orm);
    expect(mat.metalnessMap).toBe(orm);
    expect(orm.colorSpace).toBe(THREE.NoColorSpace);
  });
});
