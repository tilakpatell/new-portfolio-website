import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ROCK_RELIEF, detailWeight, rock, rockHook, rockMaterial, rockPx } from './rock';

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

describe('rock detail by its size on screen', () => {
  it('fades the pits out by how many pixels the rock is, not how far it is', () => {
    expect(detailWeight(8)).toBe(0);
    expect(detailWeight(10)).toBe(0);
    expect(detailWeight(40)).toBe(1);
    expect(detailWeight(200)).toBe(1); // (a rock flown through still shows its pits)
    let last = -1;
    for (let px = 0; px <= 60; px += 2) {
      expect(detailWeight(px)).toBeGreaterThanOrEqual(last);
      last = detailWeight(px);
    }
  });

  it('reads the size from how fast the rock\'s own space changes across a pixel', () => {
    // a unit-radius rock 2 units across its own space: at 0.01 a pixel it's 200 px
    expect(rockPx(0.01)).toBeCloseTo(200, 6);
    expect(rockPx(0.2)).toBeCloseTo(10, 6);
    // the same rock far off or a small one near: the same pixels, the same detail
    expect(detailWeight(rockPx(0.05))).toBe(detailWeight(rockPx(0.05)));
  });

  it('puts the fade in the shader, on the whole pit term', () => {
    const mat = rockMaterial({ tier: 'high' });
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    mat.onBeforeCompile(shader);
    expect(shader.fragmentShader).toContain('smoothstep(10.0, 40.0, rockPxOf)');
    expect(shader.fragmentShader).toContain('* rockDetail');
  });
});
