import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bakeMatcap, matcapFor, matcapKey } from './matcap';

const stub = () => ({ render() {}, setRenderTarget() {}, getRenderTarget: () => null, renders: 0 });
const rig = () => {
  const sun = new THREE.DirectionalLight(0xffe2b0, 2.6);
  sun.position.set(10, 20, 5);
  const hemi = new THREE.HemisphereLight(0xcfe2ff, 0x6a7a3a, 1);
  return { sun, hemi };
};

describe('a matcap from the world’s own light', () => {
  it('is known by the light and the surface, so equal ones are made once', () => {
    const lights = rig();
    expect(matcapKey({ roughness: 0.8, metalness: 0 }, lights)).toBe(matcapKey({ roughness: 0.8, metalness: 0 }, lights));
    expect(matcapKey({ roughness: 0.8 }, lights)).not.toBe(matcapKey({ roughness: 0.3 }, lights));
    const warmer = rig();
    warmer.sun.color.set(0xff8040);
    expect(matcapKey({ roughness: 0.8 }, lights)).not.toBe(matcapKey({ roughness: 0.8 }, warmer));
  });

  it('is the same picture for any colour: the colour multiplies it', () => {
    const lights = rig();
    expect(matcapKey({ roughness: 0.8, color: 0xff0000 }, lights)).toBe(matcapKey({ roughness: 0.8, color: 0x00ff00 }, lights));
  });

  it('comes from a cache once made', () => {
    const r = stub();
    const lights = rig();
    const a = bakeMatcap(r, { roughness: 0.6 }, lights);
    const b = bakeMatcap(r, { roughness: 0.6 }, lights);
    expect(a).toBe(b);
    expect(a.isTexture).toBe(true);
  });
});

describe('a lit material, painted with a matcap', () => {
  it('keeps its colour, its picture and its vertex colours', () => {
    const map = new THREE.Texture();
    const src = new THREE.MeshStandardMaterial({ color: 0x336699, map, vertexColors: true, roughness: 0.7 });
    const out = matcapFor(src, stub(), rig());
    expect(out.isMeshMatcapMaterial).toBe(true);
    expect(out.color.getHex()).toBe(0x336699);
    expect(out.map).toBe(map);
    expect(out.vertexColors).toBe(true);
    expect(out.matcap.isTexture).toBe(true);
  });

  it('leaves alone what isn’t lit, and what glows', () => {
    const basic = new THREE.MeshBasicMaterial();
    expect(matcapFor(basic, stub(), rig())).toBe(basic);
    const lamp = new THREE.MeshStandardMaterial({ emissive: 0xffaa00 });
    expect(matcapFor(lamp, stub(), rig())).toBe(lamp);
  });
});
