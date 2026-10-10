import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { litWindows, windowShader } from './windows';

const SHADER = {
  vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n#include <project_vertex>\n}',
  fragmentShader: '#include <common>\nvoid main() {\n#include <emissivemap_fragment>\n#include <opaque_fragment>\n}',
};

describe('the towers’ lit windows', () => {
  it('puts the window grid in before the emissive is summed, and leaves a shader without that line alone', () => {
    const out = windowShader(SHADER, { seed: 3 });
    expect(out.swapped).toBe(true);
    const fs = out.fragmentShader;
    expect(fs).toContain('uWindowGrid');
    expect(fs.indexOf('totalEmissiveRadiance +=')).toBeLessThan(fs.indexOf('#include <opaque_fragment>'));
    expect(fs.indexOf('totalEmissiveRadiance +=')).toBeGreaterThan(fs.indexOf('#include <emissivemap_fragment>'));
    // (the windows go dark by day: the house's full light says how bright the day is)
    expect(fs).toContain('uLookRef');
    const plain = { vertexShader: SHADER.vertexShader, fragmentShader: '#include <common>\nvoid main() { gl_FragColor = vec4(1.0); }' };
    expect(windowShader(plain, {}).swapped).toBe(false);
    expect(windowShader(plain, {}).fragmentShader).toBe(plain.fragmentShader);
  });

  it('works against the chunks three ships, instanced or not', () => {
    const out = windowShader({ vertexShader: THREE.ShaderChunk.meshphysical_vert, fragmentShader: THREE.ShaderChunk.meshphysical_frag }, { seed: 1 });
    expect(out.swapped).toBe(true);
    expect(out.vertexShader).toContain('vWindowPos');
    expect(out.vertexShader).toContain('USE_INSTANCING');
  });

  it('dresses a material once, with the grid and the density it was given', () => {
    const m = new THREE.MeshStandardMaterial();
    litWindows(m, { seed: 5, density: 0.4, cell: [3, 4] });
    expect(m.userData.windows.uWindowGrid.value.toArray()).toEqual([3, 4]);
    expect(m.userData.windows.uWindowDensity.value).toBe(0.4);
    const sh = { vertexShader: SHADER.vertexShader, fragmentShader: SHADER.fragmentShader, uniforms: {} };
    m.onBeforeCompile(sh, null);
    expect(sh.uniforms.uWindowGrid).toBeTruthy();
    expect(sh.fragmentShader).toContain('uWindowGrid');
    expect(litWindows(m, { seed: 9 })).toBe(m);
    expect(m.userData.windows.uWindowSeed.value).toBe(5);
  });
});
