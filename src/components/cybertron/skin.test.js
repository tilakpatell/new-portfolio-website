import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { cybertronSkin } from './skin';

// what three hands a MeshStandardMaterial's onBeforeCompile
const standard = () => ({ uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader });

describe('Cybertron’s skin', () => {
  it('the seams take the key light’s colour', () => {
    const mat = new THREE.MeshStandardMaterial();
    const u = cybertronSkin(mat);
    expect(u.uKeyColour.value.toArray()).toEqual([1, 1, 1]);
    const shader = standard();
    mat.onBeforeCompile(shader);
    expect(shader.uniforms.uKeyColour).toBe(u.uKeyColour);
    expect(shader.fragmentShader).toMatch(/uEnergon \* mix\(vec3\(1\.0\), uKeyColour/);
  });

  it('composes after a hook already on the material, and keys by it', () => {
    const mat = new THREE.MeshStandardMaterial();
    let before = 0;
    mat.onBeforeCompile = () => before++;
    mat.customProgramCacheKey = () => 'before';
    cybertronSkin(mat);
    mat.onBeforeCompile(standard());
    expect(before).toBe(1);
    expect(mat.customProgramCacheKey()).toBe('cybertron-before');
    // (three's own key, the hook's source, isn't carried into it)
    const plain = new THREE.MeshStandardMaterial();
    cybertronSkin(plain);
    expect(plain.customProgramCacheKey()).toBe('cybertron-');
  });
});
