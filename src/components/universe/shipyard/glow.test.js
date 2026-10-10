import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { glowCopy } from './showroomRules';

describe('the pulse’s material', () => {
  it('a copy keeps the livery’s shader hook, so a lit part keeps its paint', () => {
    const m = new THREE.MeshStandardMaterial({ color: '#b9bdc3' });
    m.onBeforeCompile = () => {};
    m.customProgramCacheKey = () => 'livery';
    const c = glowCopy(m);
    expect(c).not.toBe(m);
    expect(c.onBeforeCompile).toBe(m.onBeforeCompile);
    expect(c.customProgramCacheKey()).toBe('livery');
    expect(c.color.equals(m.color)).toBe(true);
  });
});
