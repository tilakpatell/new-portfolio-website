import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GROUND_GLSL, createGroundMap, groundPaintShader, paintGround } from './groundmap';

const AREA = { x0: -2, z0: 10, w: 4, d: 8 };
const flat = (r, g, b, grass = 1) => (x, z, out) => {
  out[0] = r;
  out[1] = g;
  out[2] = b;
  return grass;
};
// sRGB's curve, as the bytes hold it
const enc = (c) => Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255);

describe('painting a world’s ground into a picture', () => {
  it('samples each texel at its middle, colour as sRGB bytes and grass in alpha', () => {
    const seen = [];
    const px = paintGround({
      size: 2,
      area: AREA,
      paint: (x, z, out) => {
        seen.push([x, z]);
        out[0] = 0.5;
        out[1] = 0.2;
        out[2] = 0;
        return 0.25;
      },
    });
    expect(px).toBeInstanceOf(Uint8Array);
    expect(px.length).toBe(2 * 2 * 4);
    expect(seen).toEqual([
      [-1, 12],
      [1, 12],
      [-1, 16],
      [1, 16],
    ]);
    expect(Array.from(px.slice(0, 4))).toEqual([enc(0.5), enc(0.2), 0, Math.round(0.25 * 255)]);
  });

  it('clamps what it is given', () => {
    const px = paintGround({ size: 1, area: AREA, paint: flat(2, -1, NaN, 3) });
    expect(Array.from(px)).toEqual([255, 0, 0, 255]);
  });

  it('heights, where asked, as a float a texel', () => {
    const map = createGroundMap({ size: 2, area: AREA, paint: flat(0.1, 0.2, 0.3), height: (x, z) => x + z });
    expect(map.heightAt(-1, 12)).toBeCloseTo(11, 5);
    expect(map.heightTexture.isDataTexture).toBe(true);
    expect(map.uniforms.uGroundHeight.value).toBe(map.heightTexture);
    map.dispose();
  });

  it('heights at a resolution of their own (a slope needs fewer texels than a lane’s edge)', () => {
    let calls = 0;
    const map = createGroundMap({ size: 8, heightSize: 2, area: AREA, paint: flat(0.1, 0.2, 0.3), height: (x, z) => (calls++, x + z) });
    expect(calls).toBe(4);
    expect(map.heightTexture.image.width).toBe(2);
    expect(map.heightAt(-1, 12)).toBeCloseTo(11, 5);
    expect(map.heightAt(1, 16)).toBeCloseTo(17, 5);
    map.dispose();
  });
});

describe('a world’s ground map', () => {
  it('is a colour picture the GPU reads as linear, over the area asked', () => {
    const map = createGroundMap({ size: 4, area: AREA, paint: flat(0.3, 0.5, 0.1) });
    expect(map.texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(map.uniforms.uGroundMap.value).toBe(map.texture);
    expect(map.uniforms.uGroundRect.value.toArray()).toEqual([-2, 10, 1 / 4, 1 / 8]);
    // (no heights asked for: a flat floor at 0)
    expect(map.heightAt(0, 12)).toBe(0);
    map.dispose();
  });

  it('reads its own colour and grass back, in JS, between texels too', () => {
    const map = createGroundMap({ size: 8, area: AREA, paint: (x, z, out) => ((out[0] = 0.5), (out[1] = 0.25), (out[2] = 0.1), x < 0 ? 0 : 1) });
    const c = new THREE.Color();
    map.colourAt(0.3, 13.1, c);
    expect(c.r).toBeCloseTo(0.5, 2);
    expect(c.g).toBeCloseTo(0.25, 2);
    expect(c.b).toBeCloseTo(0.1, 2);
    expect(map.grassAt(-1.5, 12)).toBe(0);
    expect(map.grassAt(1.5, 12)).toBe(1);
    // (half way across the edge between none and all)
    expect(map.grassAt(0, 12)).toBeCloseTo(0.5, 1);
    // (outside the area: the nearest edge)
    map.colourAt(100, -100, c);
    expect(c.r).toBeCloseTo(0.5, 2);
    map.dispose();
  });

  it('gives the shader one function for the ground’s colour, its grass and its height', () => {
    expect(GROUND_GLSL).toContain('vec3 groundColour(vec2 xz)');
    expect(GROUND_GLSL).toContain('float groundGrass(vec2 xz)');
    expect(GROUND_GLSL).toContain('float groundHeight(vec2 xz)');
    expect(GROUND_GLSL).toContain('uniform sampler2D uGroundMap;');
  });
});

describe('a floor painted by the map', () => {
  const SHADER = {
    vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n#include <project_vertex>\n#include <worldpos_vertex>\n}',
    fragmentShader: '#include <common>\nvoid main() {\n#include <map_fragment>\n#include <color_fragment>\n#include <opaque_fragment>\n}',
  };

  it('multiplies the albedo by the map’s colour at each point, after the material’s own', () => {
    const out = groundPaintShader(SHADER);
    expect(out.swapped).toBe(true);
    expect(out.vertexShader).toContain('varying vec3 vGroundPaint;');
    expect(out.vertexShader).toContain('vGroundPaint = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    const fs = out.fragmentShader;
    expect(fs).toContain('uniform sampler2D uGroundMap;');
    expect(fs.indexOf('diffuseColor.rgb *= groundColour(vGroundPaint.xz);')).toBeGreaterThan(fs.indexOf('#include <color_fragment>'));
  });

  it('leaves a shader without a colour line alone', () => {
    const odd = { vertexShader: SHADER.vertexShader, fragmentShader: 'void main() {}' };
    expect(groundPaintShader(odd)).toEqual({ ...odd, swapped: false });
  });

  it('patches a material once, chaining what it had', () => {
    const map = createGroundMap({ size: 2, area: AREA, paint: flat(0.3, 0.5, 0.1) });
    const m = new THREE.MeshStandardMaterial();
    let ran = 0;
    m.onBeforeCompile = () => (ran += 1);
    map.paint(m);
    map.paint(m);
    const sh = { vertexShader: THREE.ShaderChunk.meshphysical_vert, fragmentShader: THREE.ShaderChunk.meshphysical_frag, uniforms: {} };
    m.onBeforeCompile(sh, null);
    expect(ran).toBe(1);
    expect(sh.uniforms.uGroundMap.value).toBe(map.texture);
    expect(sh.fragmentShader).toContain('groundColour(vGroundPaint.xz)');
    expect(m.customProgramCacheKey()).toMatch(/\|groundPaint$/);
    map.dispose();
  });
});
