import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ROCK_RELIEF, rock, rockHook, rockMaterial } from './rock';

describe('rock', () => {
  it('the rock material has relief on high and none on low', () => {
    const high = rockMaterial({ tier: 'high' });
    expect(high.customProgramCacheKey()).toBe('rock');
    expect(high.flatShading).toBe(false);
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    high.onBeforeCompile(shader);
    expect(shader.fragmentShader).toContain('rockPits(vRockObj)');
    expect(shader.vertexShader).toContain('vRockObj = position');
    expect(shader.uniforms.uSeed.value.isVector3).toBe(true);
    // (one switch for every rock's relief: the pace's step 3)
    expect(shader.uniforms.uRockRelief).toBe(ROCK_RELIEF);
    expect(shader.fragmentShader).toContain('* uRockRelief');
    expect(rockMaterial({ tier: 'mid' }).customProgramCacheKey()).toBe('rock');
    const low = rockMaterial({ tier: 'low' });
    expect(low.onBeforeCompile).toBe(THREE.Material.prototype.onBeforeCompile);
    expect(low.flatShading).toBe(true);
    expect(low.roughness).toBe(0.92);
  });

  it('pits a rock material of your own, after the hook it has', () => {
    const mat = new THREE.MeshStandardMaterial({ flatShading: true });
    let before = 0;
    mat.onBeforeCompile = (sh) => {
      before++;
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3(position);');
    };
    mat.customProgramCacheKey = () => 'deep-debris';
    rockHook(mat, { tier: 'mid' });
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    mat.onBeforeCompile(shader);
    expect(before).toBe(1);
    expect(shader.vertexShader).toContain('vRockObj = position');
    expect(mat.customProgramCacheKey()).toBe('rock-deep-debris');
    expect(mat.flatShading).toBe(false);
  });

  it('a boulder is finer, shared and cratered; a rock is as it was', () => {
    const plain = rock(11);
    expect(plain.index).toBeNull();
    expect(plain.attributes.position.count).toBe(240); // (an icosphere of 80 faces, as the belt always drew)
    const boulder = rock(53, { craters: true });
    expect(boulder.index).not.toBeNull();
    expect(boulder.index.count / 3).toBe(180);
    // pressed in: some of its points well inside the sphere it was
    const p = boulder.attributes.position;
    let inside = 0;
    for (let i = 0; i < p.count; i++) if (Math.hypot(p.getX(i), p.getY(i), p.getZ(i)) < 0.8) inside++;
    expect(inside).toBeGreaterThan(3);
  });
});
