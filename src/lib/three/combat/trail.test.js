import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createTrail } from './trail';

const frames = (n) => Array.from({ length: n }, (_, i) => ({ base: [i, 0, 0], tip: [i, 1, 0] }));

describe('createTrail', () => {
  it('draws the newest frame at the front while on, and shortens a frame a call once off', () => {
    const parent = new THREE.Group();
    const trail = createTrail(parent, { length: 4 });
    expect(parent.children).toContain(trail.mesh);
    trail.sync(frames(6), true);
    expect(trail.mesh.visible).toBe(true);
    const pos = trail.mesh.geometry.attributes.position.array;
    expect([pos[0], pos[4]]).toEqual([5, 1]); // (the newest: frame 5's hilt and tip)
    expect(pos[18]).toBe(2); // (the oldest of the four kept)
    trail.sync([], false);
    trail.sync([], false);
    expect(trail.mesh.visible).toBe(true);
    trail.sync([], false);
    expect(trail.mesh.visible).toBe(false);
    trail.dispose();
    expect(parent.children).not.toContain(trail.mesh);
  });
  it('shows nothing for a single frame', () => {
    const trail = createTrail(null);
    trail.sync(frames(1), true);
    expect(trail.mesh.visible).toBe(false);
  });
});
