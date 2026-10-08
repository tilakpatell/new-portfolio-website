// A dye: a material keeps its light and shade (its texture's luminance)
// and takes the dye's colour, so a uniform in olive cloth becomes the same
// cloth in charcoal, and blue robes become crimson ones, where a tint (a
// multiply) would have darkened both towards black.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { dyed, dyeShader } from './dye';

const FRAG = 'void main() {\n#include <map_fragment>\n#include <color_fragment>\n}';

describe('dyeShader', () => {
  it('sets the colour from the texel’s luminance after the map is read, and declares its uniforms', () => {
    const out = dyeShader(FRAG);
    expect(out).toMatch(/uniform vec3 uDye;/);
    expect(out.indexOf('uDye *')).toBeGreaterThan(out.indexOf('#include <map_fragment>'));
    expect(out.indexOf('uDye *')).toBeLessThan(out.indexOf('#include <color_fragment>'));
  });

  it('leaves a shader with nowhere to dye as it was', () => {
    expect(dyeShader('void main() {}')).toBe('void main() {}');
  });
});

describe('dyed', () => {
  it('gives a copy its own dye, keeping the first hook and its cache key apart', () => {
    const m = new THREE.MeshStandardMaterial({ color: 0x556b2f });
    let ran = 0;
    m.onBeforeCompile = () => ran++;
    const d = dyed(m, { color: 0x202124, gain: 2, keep: 0.1, roughness: 0.4 });
    expect(d).not.toBe(m);
    expect(d.roughness).toBe(0.4);
    const sh = { uniforms: {}, fragmentShader: FRAG, vertexShader: '' };
    d.onBeforeCompile(sh);
    expect(ran).toBe(1);
    expect(sh.uniforms.uDye.value.getHex()).toBe(new THREE.Color(0x202124).getHex());
    expect(sh.uniforms.uDyeGain.value).toBe(2);
    expect(sh.uniforms.uDyeKeep.value).toBe(0.1);
    expect(d.customProgramCacheKey()).toMatch(/dye$/);
    // (with no texture, its own colour is the luminance the dye reads)
    expect(d.color.getHex()).toBe(0x556b2f);
  });

  it('whitens a textured material’s colour, so the dye isn’t multiplied by it again', () => {
    const m = new THREE.MeshStandardMaterial({ color: 0x8090a0, map: new THREE.Texture() });
    expect(dyed(m, { color: 0xb01020 }).color.getHex()).toBe(0xffffff);
  });
});
