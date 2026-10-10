import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { withDetail } from './detail';

const scan = { map: new THREE.Texture(), normalMap: new THREE.Texture() };

// (lib/three/coreNodes' wear: a node material with the scan as hooks)
describe('the close-up layer', () => {
  it('lays the scan over a model in the world, three ways', () => {
    const m = withDetail(new THREE.MeshStandardMaterial(), scan, { metres: 3 });
    expect(m.isNodeMaterial).toBe(true);
    expect(m.userData.core.uCoreMap.value).toBe(scan.map);
    expect(m.userData.core.uCoreScale.value).toBeCloseTo(1 / 3);
    expect(m.customProgramCacheKey()).toContain('core:n');
  });

  it('does it once, however often it is asked', () => {
    const m = withDetail(new THREE.MeshStandardMaterial(), scan, { metres: 3 });
    const key = m.customProgramCacheKey();
    expect(withDetail(m, scan, { metres: 3 })).toBe(m);
    expect(m.customProgramCacheKey()).toBe(key);
  });

  it('leaves materials it cannot light alone', () => {
    const m = new THREE.MeshBasicMaterial();
    withDetail(m, scan, { metres: 3 });
    expect(m.userData.core).toBeUndefined();
  });
});
