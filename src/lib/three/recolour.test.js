import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { REF, meanLuma, measureMap, recolour, recolourShader } from './recolour';

// a w×h image of one colour (sRGB bytes), alpha a
const flat = (w, h, [r, g, b], a = 255) => ({ width: w, height: h, data: Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => [r, g, b, a][i % 4]) });
const lambert = () => {
  const m = new THREE.MeshLambertMaterial({ map: new THREE.Texture() });
  return { m, shader: { uniforms: {}, vertexShader: THREE.ShaderLib.lambert.vertexShader, fragmentShader: THREE.ShaderLib.lambert.fragmentShader } };
};

describe('meanLuma: how bright a map is, where it isn’t cut out', () => {
  it('reads white as one and black as nought, in linear light', () => {
    expect(meanLuma(flat(2, 2, [255, 255, 255]))).toBeCloseTo(1, 4);
    expect(meanLuma(flat(2, 2, [0, 0, 0]))).toBeCloseTo(0, 4);
    // (sRGB mid grey is a fifth of white's light)
    expect(meanLuma(flat(2, 2, [128, 128, 128]))).toBeCloseTo(0.2158, 3);
  });

  it('weighs green over red over blue', () => {
    const g = meanLuma(flat(1, 1, [0, 255, 0]));
    const r = meanLuma(flat(1, 1, [255, 0, 0]));
    const b = meanLuma(flat(1, 1, [0, 0, 255]));
    expect(g).toBeGreaterThan(r);
    expect(r).toBeGreaterThan(b);
  });

  it('counts only the pixels over the cut, and is null for an empty or a wholly cut image', () => {
    const img = flat(2, 1, [255, 255, 255]);
    img.data.set([0, 0, 0, 0], 4); // (the second pixel black and cut out)
    expect(meanLuma(img)).toBeCloseTo(1, 4);
    expect(meanLuma(flat(2, 2, [255, 255, 255], 0))).toBeNull();
    expect(meanLuma({ width: 0, height: 0, data: new Uint8ClampedArray(0) })).toBeNull();
  });
});

describe('recolourShader', () => {
  it('puts the colour in place of the map’s, shaded by the map’s light over its mean, after the map is read', () => {
    const { shader } = lambert();
    const out = recolourShader(shader);
    expect(out.swapped).toBe(true);
    const f = out.fragmentShader;
    expect(f).toContain('uniform vec3 uRecolour;');
    expect(f).toContain('uniform float uRecolourRef;');
    expect(f.indexOf('uRecolour * clamp(')).toBeGreaterThan(f.indexOf('#include <map_fragment>'));
    expect(f).toContain('dot( sampledDiffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) / uRecolourRef');
  });

  it('leaves a shader with no map read as it is', () => {
    const out = recolourShader({ vertexShader: 'v', fragmentShader: 'void main() {}' });
    expect(out.swapped).toBe(false);
    expect(out.fragmentShader).toBe('void main() {}');
  });
});

describe('recolour', () => {
  it('chains onto what the material already does, once, under its own program key', () => {
    const { m, shader } = lambert();
    const seen = [];
    m.onBeforeCompile = () => seen.push('house');
    recolour(m, '#c6ad72');
    recolour(m, '#000000'); // (a second ask changes nothing)
    m.onBeforeCompile(shader);
    expect(seen).toEqual(['house']);
    expect(shader.uniforms.uRecolour.value.getHexString()).toBe('c6ad72');
    expect(shader.uniforms.uRecolourRef.value).toBe(REF);
    expect(shader.fragmentShader).toContain('uRecolour * clamp(');
    expect(m.customProgramCacheKey()).toContain('|recolour');
    // (with no map to read, the colour is the material's own)
    expect(m.color.getHexString()).toBe('c6ad72');
  });
});

describe('measureMap', () => {
  it('is null where there is no canvas to read a map with (in Node)', () => {
    expect(measureMap(new THREE.Texture())).toBeNull();
    expect(measureMap(null)).toBeNull();
  });
});
