import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { addDetail, detailShader, wantsDetail } from './levelDetail';

describe('the game’s detail normals', () => {
  it('only on high and ultra, and not on the node renderer', () => {
    expect(wantsDetail('high', {})).toBe(true);
    expect(wantsDetail('mid', {})).toBe(false);
    expect(wantsDetail('ultra', { isWebGPURenderer: true })).toBe(false);
  });

  it('adds the tiling normal after the material’s own, in tangent space', () => {
    const s = detailShader({ fragmentShader: '#include <normalmap_pars_fragment>\nvoid main() {\n#include <normal_fragment_maps>\n}' });
    expect(s.fragmentShader).toContain('uniform sampler2D uDetailNormal;');
    expect(s.fragmentShader).toContain('vNormalMapUv * uDetailTiling');
    expect(s.fragmentShader.indexOf('mapN.xy *= normalScale;')).toBeLessThan(s.fragmentShader.indexOf('uDetailStrength;\n', s.fragmentShader.indexOf('void main')));
  });

  it('leaves a material without a normal map alone, and repeats the detail map', () => {
    const map = new THREE.Texture();
    expect(addDetail(new THREE.MeshStandardMaterial(), { map, tiling: [8, 4] })).toBe(false);
    const m = new THREE.MeshStandardMaterial({ normalMap: new THREE.Texture() });
    expect(addDetail(m, { map, tiling: [8, 4], strength: 0.5 })).toBe(true);
    expect(map.wrapS).toBe(THREE.RepeatWrapping);
    const shader = { uniforms: {}, fragmentShader: '#include <normalmap_pars_fragment>\n#include <normal_fragment_maps>' };
    m.onBeforeCompile(shader);
    expect(shader.uniforms.uDetailTiling.value.toArray()).toEqual([8, 4]);
    expect(shader.uniforms.uDetailStrength.value).toBe(0.5);
  });
});
