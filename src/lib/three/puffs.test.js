import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createPuffs, puffGeometry, puffShader } from './puffs';
import { createWind } from './wind';

const LAMBERT = { vertexShader: THREE.ShaderChunk.meshlambert_vert, fragmentShader: THREE.ShaderChunk.meshlambert_frag };

describe('puffGeometry', () => {
  it('is his 80 cards in a sphere, lit as the sphere', () => {
    const g = puffGeometry({ seed: 3 });
    expect(g.attributes.position.count).toBe(80 * 6);
    expect(g.attributes.uv.count).toBe(80 * 6);
    const p = g.attributes.position;
    const n = g.attributes.normal;
    for (let i = 0; i < p.count; i += 7) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      expect(v.length()).toBeLessThan(1 + 0.8);
      const nn = new THREE.Vector3().fromBufferAttribute(n, i);
      expect(nn.length()).toBeCloseTo(1, 3);
      // (the normal mostly the sphere's, out from the middle)
      const sphere = v.clone().normalize();
      expect(nn.distanceTo(sphere)).toBeLessThan(0.3);
    }
  });

  it('is the same for a seed', () => {
    expect(Array.from(puffGeometry({ seed: 5 }).attributes.position.array)).toEqual(Array.from(puffGeometry({ seed: 5 }).attributes.position.array));
  });
});

describe('puffShader', () => {
  it('cuts the card out of a blob turned by the wind, two-toned by the light', () => {
    const out = puffShader(LAMBERT);
    expect(out.swapped).toBe(true);
    expect(out.fragmentShader).toContain('windOffset(');
    expect(out.fragmentShader).toContain('2.2');
    expect(out.fragmentShader).toContain('smoothstep(0.0, 1.0, dot(');
    expect(out.fragmentShader).toContain('discard');
  });
});

describe('createPuffs', () => {
  it('takes and frees slots, and reuses a freed one', () => {
    const wind = createWind();
    const puffs = createPuffs({ species: { a: 0xb4b536, b: 0xd8cf3b, bark: 0x6b4a32 }, count: 4, wind, facing: [1, 1, 1] });
    expect(puffs.crowns).toBeInstanceOf(THREE.InstancedMesh);
    expect(puffs.trunks.count).toBe(4);
    const a = puffs.take();
    const b = puffs.take();
    expect(a).not.toBe(b);
    puffs.set(a, 10, 2, -3, 1, 0.5);
    const m = new THREE.Matrix4();
    puffs.trunks.getMatrixAt(a, m);
    const at = new THREE.Vector3().setFromMatrixPosition(m);
    expect(at.x).toBeCloseTo(10);
    expect(at.z).toBeCloseTo(-3);
    expect(at.y).toBeCloseTo(2);
    puffs.crowns.getMatrixAt(a, m);
    expect(new THREE.Vector3().setFromMatrixPosition(m).y).toBeGreaterThan(5);
    puffs.free(a);
    puffs.trunks.getMatrixAt(a, m);
    expect(new THREE.Vector3().setFromMatrixScale(m).length()).toBe(0);
    expect(puffs.take()).toBe(a);
    puffs.take();
    puffs.take();
    expect(puffs.take()).toBe(-1);
    puffs.dispose();
    wind.dispose();
  });
});
