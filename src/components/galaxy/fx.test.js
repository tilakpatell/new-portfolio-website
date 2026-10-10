import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createBolts, createFlashes } from './fx';

describe('the bolts', () => {
  it('make their instance colours from the start, so the first shot compiles nothing', () => {
    const scene = new THREE.Scene();
    const b = createBolts(scene, { count: 12 });
    expect(b.mesh.instanceColor).toBeTruthy();
    expect(b.mesh.instanceColor.count).toBe(12);
    // (and a shot afterwards keeps the same buffer, so the program is the same one)
    const before = b.mesh.instanceColor;
    b.fire(new THREE.Vector3(), new THREE.Vector3(0, 0, 40), {});
    b.update(0.1);
    expect(b.mesh.instanceColor).toBe(before);
    expect(b.mesh.count).toBe(1);
    b.dispose();
  });
});

describe('the flashes', () => {
  it('swell and go out, and give their slot back', () => {
    const scene = new THREE.Scene();
    const f = createFlashes(scene, { count: 4 });
    expect(f.busy).toBe(false);
    f.at(new THREE.Vector3(1, 2, 3), { size: 1.6, life: 0.8 });
    f.update(0.1);
    expect(f.busy).toBe(true);
    f.update(1);
    expect(f.busy).toBe(false);
    f.dispose();
  });
});

describe('the flash’s look', () => {
  it('fades to its rim instead of ending at a hard edge', () => {
    const scene = new THREE.Scene();
    const f = createFlashes(scene, { count: 2 });
    const mat = scene.children.find((o) => o.isInstancedMesh).material;
    expect(mat.fragmentShader).toContain('smoothstep(0.65, 1.0, r)');
    expect(mat.fragmentShader).not.toContain('discard');
    f.dispose?.();
  });

  it('takes the game’s burst and its black-body ramp when it has them, its own look when not', () => {
    const scene = new THREE.Scene();
    const f = createFlashes(scene, { count: 2, look: null });
    const mat = scene.children.find((o) => o.isInstancedMesh).material;
    expect(mat.uniforms.uHasMap.value).toBe(0);
    expect(mat.uniforms.uHasRamp.value).toBe(0);
    const burst = new THREE.Texture();
    burst.userData.look = { name: 'impact', grid: [1, 1], channels: { burst: 'g' } };
    const ramp = new THREE.Texture();
    f.setLook({ burst, ramp });
    expect(mat.uniforms.uHasMap.value).toBe(1);
    expect(mat.uniforms.uHasRamp.value).toBe(1);
    expect(mat.uniforms.uMap.value).toBe(burst);
    f.dispose();
  });
});
