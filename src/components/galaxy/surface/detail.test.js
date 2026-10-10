import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { withDetail } from './detail';

const shader = () => ({
  uniforms: {},
  vertexShader: '#include <common>\nvoid main() {\n#include <project_vertex>\n}',
  fragmentShader: '#include <common>\nvoid main() {\n#include <map_fragment>\n#include <normal_fragment_maps>\n}',
});
const scan = { map: new THREE.Texture(), normalMap: new THREE.Texture() };

describe('the close-up layer', () => {
  it('lays the scan over a model in the world, three ways', () => {
    const m = new THREE.MeshStandardMaterial();
    withDetail(m, scan, { metres: 3 });
    const s = shader();
    m.onBeforeCompile(s);
    expect(s.vertexShader).toContain('vCorePos = ');
    expect(s.fragmentShader).toContain('diffuseColor.rgb *=');
    expect(s.fragmentShader).toContain('normal = normalize(');
    expect(s.uniforms.uCoreMap.value).toBe(scan.map);
    expect(s.uniforms.uCoreScale.value).toBeCloseTo(1 / 3);
    expect(m.customProgramCacheKey()).toContain('core');
  });

  it('does it once, however often it is asked', () => {
    const m = new THREE.MeshStandardMaterial();
    withDetail(m, scan, { metres: 3 });
    withDetail(m, scan, { metres: 3 });
    const s = shader();
    m.onBeforeCompile(s);
    expect(s.fragmentShader.split('diffuseColor.rgb *=').length).toBe(2);
  });

  it('leaves materials it cannot light alone', () => {
    const m = new THREE.MeshBasicMaterial();
    withDetail(m, scan, { metres: 3 });
    expect(m.userData.core).toBeUndefined();
  });
});
