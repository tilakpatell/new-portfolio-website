import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { STEPS } from '../../lib/three/pace';
import { createPost } from '../universe/post';
import { createSky } from './sky';
import { followRatio } from './drawnAt';

// just enough of a renderer for the post chain to be built, at the 1.5 the
// galaxy is drawn at (nothing is drawn)
const renderer = (ratio = 1.5) => ({
  getPixelRatio: () => ratio,
  getSize: (v) => v.set(64, 64),
  getDrawingBufferSize: (v) => v.set(96, 96),
  getContext: () => ({}),
  getRenderTarget: () => null,
  setRenderTarget: vi.fn(),
  setPixelRatio: vi.fn(),
  setSize: vi.fn(),
  capabilities: { isWebGL2: true },
});
// what the sky's stars and beacons are sized by
const dprsOf = (sky) => {
  const out = [];
  sky.group.traverse((o) => {
    if (o.material?.uniforms?.uDpr) out.push(o.material.uniforms.uDpr.value);
  });
  return out;
};

describe("the ratio the galaxy's points are sized by", () => {
  it("is the post chain's, which a quality step softens, not the canvas's, which keeps its size", () => {
    const post = createPost(renderer(1.5), new THREE.Scene(), new THREE.PerspectiveCamera());
    const sky = createSky({ small: true });
    const follow = followRatio(post, (r) => sky.setRatio(r));
    expect(follow()).toBe(1.5);
    expect(dprsOf(sky).length).toBeGreaterThan(0);
    for (const d of dprsOf(sky)) expect(d).toBe(1.5);
    post.sharpness = STEPS[2]; // (the world's lowerQuality(2))
    expect(follow()).toBeCloseTo(1.08);
    for (const d of dprsOf(sky)) expect(d).toBe(post.ratio); // (on screen, as big as before)
    sky.dispose();
    post.dispose?.();
  });

  it('is told on only when it moves (and the first time)', () => {
    const post = { ratio: 1.5 };
    const apply = vi.fn();
    const follow = followRatio(post, apply);
    follow();
    follow();
    expect(apply).toHaveBeenCalledTimes(1);
    post.ratio = 1.275;
    expect(follow()).toBe(1.275);
    follow();
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenLastCalledWith(1.275);
  });
});
