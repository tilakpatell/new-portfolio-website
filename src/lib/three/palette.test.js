import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createHouse } from './house';
import { createPalette } from './palette';

const EIGHT = ['#7a9a3a', '#d8c08a', '#8a7f72', '#b98a4e', '#3f6a8a', '#d8572a', '#f2e6c9', '#2a2a2a'];

describe('createPalette', () => {
  it('puts each colour’s cell at its centre', () => {
    const p = createPalette(EIGHT);
    expect(p.size).toBe(8);
    expect(p.uv(0)).toEqual([0.0625, 0.5]);
    expect(p.uv(7)).toEqual([0.9375, 0.5]);
  });

  it('gives back a colour as three reads it', () => {
    const p = createPalette(EIGHT);
    expect(p.colour(2).equals(new THREE.Color(EIGHT[2]))).toBe(true);
    expect(createPalette([0x7a9a3a, ...EIGHT.slice(1)]).colour(0).equals(new THREE.Color(EIGHT[0]))).toBe(true);
  });

  it('is a sharp sRGB strip with no mips, its bytes the colours’ own', () => {
    const { texture } = createPalette(EIGHT);
    expect(texture).toBeInstanceOf(THREE.DataTexture);
    expect([texture.image.width, texture.image.height]).toEqual([8, 1]);
    expect(texture.format).toBe(THREE.RGBAFormat);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect([texture.magFilter, texture.minFilter]).toEqual([THREE.NearestFilter, THREE.NearestFilter]);
    expect(texture.generateMipmaps).toBe(false);
    expect([...texture.image.data.slice(4, 8)]).toEqual([0xd8, 0xc0, 0x8a, 255]);
  });

  it('paints every corner of a geometry with one cell, leaving the count as it was', () => {
    const p = createPalette(EIGHT);
    const g = p.paint(new THREE.BoxGeometry(), 3);
    expect(g.attributes.uv.count).toBe(24);
    for (let i = 0; i < 24; i++) {
      expect(g.attributes.uv.getX(i)).toBeCloseTo(p.uv(3)[0], 6);
      expect(g.attributes.uv.getY(i)).toBeCloseTo(0.5, 6);
    }
  });

  it('holds six to sixteen colours', () => {
    expect(() => createPalette(EIGHT.slice(0, 5))).toThrow(/six to sixteen/);
    expect(() => createPalette([...EIGHT, ...EIGHT, '#ffffff'])).toThrow(/six to sixteen/);
    expect(() => createPalette(EIGHT.slice(0, 6))).not.toThrow();
  });

  it('makes one Lambert on the strip, in the house look when given one', () => {
    const p = createPalette(EIGHT);
    const m = p.material();
    expect(m).toBeInstanceOf(THREE.MeshLambertMaterial);
    expect(m.map).toBe(p.texture);
    const house = createHouse();
    const lit = p.material({ house });
    expect(lit.map).toBe(p.texture);
    expect(lit.userData.house).toBe(house.uniforms);
  });

  it('frees its texture', () => {
    const p = createPalette(EIGHT);
    const spy = vi.spyOn(p.texture, 'dispose');
    p.dispose();
    expect(spy).toHaveBeenCalled();
  });
});
