import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DECAL_POOL, createDecals, pickDecals } from './decals';

const at = (x, z) => ({ position: [x, 0, z], quaternion: [0, 0, 0, 1], scale: [2, 1, 2], tex: 't', alpha: 1 });

describe('the decals’ pool', () => {
  it('takes the nearest, nearest first, and none on low', () => {
    const list = [at(100, 0), at(5, 5), at(-20, 0), at(0, 1)];
    expect(pickDecals(list, [0, 0], 2)).toEqual([list[3], list[1]]);
    expect(pickDecals(list, [0, 0], DECAL_POOL.low)).toEqual([]);
    expect(DECAL_POOL).toEqual({ low: 0, mid: 24, high: 64, ultra: 128 });
  });

  it('makes its pool once and fills it as you move', async () => {
    const scene = new THREE.Scene();
    const tex = new THREE.Texture();
    const d = createDecals(scene, { tier: 'mid', loadTexture: async () => tex });
    expect(scene.children).toHaveLength(24);
    d.set([at(1, 1), at(2000, 0)]);
    d.update([0, 0]);
    await Promise.resolve();
    await Promise.resolve();
    expect(d.count()).toBe(2);
    expect(scene.children.filter((m) => m.visible)).toHaveLength(2);
    expect(scene.children[0].material.map).toBe(tex);
    d.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
