import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WIND_GLSL, WIND_SCALE, createWind, sampleNoise, swayShader, windNoise, windOffsetAt } from './wind';

describe('one wind for a world', () => {
  it('reads two scrolling lookups of one noise, a fast one and a slow broad gust', () => {
    expect(WIND_GLSL).toContain('vec2 windOffset(vec2 xz)');
    expect(WIND_GLSL).toContain('uniform sampler2D uWindNoise;');
    // (two lookups at two scales, summed and centred, along the wind's way)
    expect(WIND_GLSL.match(/texture2D\(uWindNoise/g)).toHaveLength(2);
    expect(WIND_GLSL).toContain('uWindDir * (a + b - 1.0) * uWindStrength');
  });

  it('makes a small tiling noise picture to read', () => {
    const t = windNoise(32);
    expect(t.image.width).toBe(32);
    expect(t.wrapS).toBe(THREE.RepeatWrapping);
    const px = t.image.data;
    const min = Math.min(...px);
    const max = Math.max(...px);
    // (it uses most of its range, so the sum moves both ways about nought)
    expect(max - min).toBeGreaterThan(120);
    t.dispose();
  });

  it('blows the way it is pointed, as hard as it is set, and moves faster the harder it blows', () => {
    const wind = createWind({ strength: 0.5, angle: 0 });
    expect(wind.uniforms.uWindDir.value.toArray()).toEqual([1, 0]);
    expect(wind.uniforms.uWindStrength.value).toBe(0.5);
    wind.update(1);
    const slow = wind.uniforms.uWindTime.value;
    wind.set({ strength: 1, angle: Math.PI / 2 });
    expect(wind.uniforms.uWindDir.value.x).toBeCloseTo(0, 6);
    expect(wind.uniforms.uWindDir.value.y).toBeCloseTo(1, 6);
    wind.update(1);
    expect(wind.uniforms.uWindTime.value - slow).toBeGreaterThan(slow);
    wind.dispose();
  });
});

describe('swaying in the wind', () => {
  const SHADER = {
    vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n#include <project_vertex>\n}',
    fragmentShader: 'void main() {}',
  };

  it('bends the top of each thing by the wind where it stands, the root left still', () => {
    const out = swayShader(SHADER, { strength: 0.3, height: 2 });
    expect(out.swapped).toBe(true);
    const vs = out.vertexShader;
    expect(vs).toContain('vec2 windOffset(vec2 xz)');
    expect(vs).toMatch(/USE_INSTANCING[\s\S]*instanceMatrix\[3\]/);
    expect(vs).toContain('transformed.xz += windOffset(');
    expect(vs).toContain('0.300');
    expect(vs.indexOf('transformed.xz += windOffset(')).toBeGreaterThan(vs.indexOf('#include <begin_vertex>'));
  });

  it('leaves a shader without the line it looks for alone', () => {
    const odd = { vertexShader: 'void main() {}', fragmentShader: 'void main() {}' };
    expect(swayShader(odd).swapped).toBe(false);
  });

  it('chains what a material had, and shares the wind’s uniforms', () => {
    const wind = createWind();
    const m = new THREE.MeshLambertMaterial();
    let ran = 0;
    m.onBeforeCompile = () => (ran += 1);
    wind.sway(m, { strength: 0.2 });
    const sh = { vertexShader: THREE.ShaderChunk.meshlambert_vert, fragmentShader: THREE.ShaderChunk.meshlambert_frag, uniforms: {} };
    m.onBeforeCompile(sh, null);
    expect(ran).toBe(1);
    expect(sh.uniforms.uWindTime).toBe(wind.uniforms.uWindTime);
    expect(sh.vertexShader).toContain('windOffset(');
    expect(m.customProgramCacheKey()).toMatch(/\|sway:0\.2:1$/);
    wind.dispose();
  });
});

describe('the wind, read on the CPU', () => {
  const data = Uint8Array.from({ length: 16 }, (_, k) => (k * 37) % 256);
  const img = { data, width: 4, height: 4 };

  it('reads the noise picture as the graphics chip does: bilinear, repeating, at texel centres', () => {
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) expect(sampleNoise(img, (i + 0.5) / 4, (j + 0.5) / 4)).toBeCloseTo(data[j * 4 + i] / 255, 9);
    // (halfway between two texels, their mean)
    expect(sampleNoise(img, 0.25, 0.125)).toBeCloseTo((data[0] + data[1]) / 510, 9);
    expect(sampleNoise(img, 0.125, 0.25)).toBeCloseTo((data[0] + data[4]) / 510, 9);
    // (and round again past either edge)
    expect(sampleNoise(img, 1.125, 0.375)).toBeCloseTo(sampleNoise(img, 0.125, 0.375), 9);
    expect(sampleNoise(img, -0.875, 0.375)).toBeCloseTo(sampleNoise(img, 0.125, 0.375), 9);
  });

  it('reads at the scales the shader does', () => {
    expect(WIND_GLSL).toContain(`xz * ${WIND_SCALE.quick}`);
    expect(WIND_GLSL).toContain(`xz * ${WIND_SCALE.slow}`);
    expect(WIND_GLSL).toContain(`uWindTime * ${WIND_SCALE.slowTime}`);
  });

  it('pushes along the wind, never harder than it blows, and moves on with it', () => {
    const wind = createWind({ strength: 0.5, angle: 0.6 * Math.PI });
    const d = wind.uniforms.uWindDir.value;
    const o = { x: 0, z: 0, k: 0 };
    for (let i = 0; i < 1000; i++) {
      windOffsetAt(wind.uniforms, (i * 7.31) % 200 - 100, (i * 13.7) % 200 - 100, o);
      expect(Math.abs(o.k)).toBeLessThanOrEqual(0.5 + 1e-9);
      // (along the wind's way: parallel to it)
      expect(o.x * d.y - o.z * d.x).toBeCloseTo(0, 9);
      expect(o.x).toBeCloseTo(d.x * o.k, 9);
    }
    const was = windOffsetAt(wind.uniforms, 3, 4).k;
    wind.update(1);
    expect(windOffsetAt(wind.uniforms, 3, 4).k).not.toBeCloseTo(was, 6);
    wind.dispose();
  });
});
