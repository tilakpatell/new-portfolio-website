import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { aberrationFor, bloomSize, createPost } from './post';

// just enough of a renderer for the composer to be built (nothing is drawn)
const renderer = () => ({
  getPixelRatio: () => 1,
  getSize: (v) => v.set(64, 64),
  getDrawingBufferSize: (v) => v.set(64, 64),
  getContext: () => ({}),
  getRenderTarget: () => null,
  setRenderTarget: vi.fn(),
  setPixelRatio: vi.fn(),
  setSize: vi.fn(),
  capabilities: { isWebGL2: true },
});

const bloomOf = (post) => post.composer.passes.find((p) => p instanceof UnrealBloomPass);
const gradeOf = (post) => post.composer.passes[post.composer.passes.length - 1];

describe('post.lite', () => {
  it('turns bloom off and keeps the grade, the post staying on', () => {
    const post = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera());
    const bloom = bloomOf(post);
    expect(bloom.enabled).toBe(true);
    post.lite();
    expect(bloom.enabled).toBe(false);
    expect(gradeOf(post).enabled).toBe(true);
    expect(post.on).toBe(true);
    post.lite(); // harmless the second time
    expect(bloom.enabled).toBe(false);
    expect(gradeOf(post).enabled).toBe(true);
    expect(post.on).toBe(true);
  });

  it('leaves flare() nothing to do once bloom is off', () => {
    const post = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera());
    const bloom = bloomOf(post);
    post.flare(2);
    expect(bloom.strength).toBeCloseTo(1.6);
    post.lite();
    const was = bloom.strength;
    post.flare(3);
    expect(bloom.strength).toBe(was);
  });
});

describe('the finished render', () => {
  it('dithers in the final pass, and grains only when asked (the galaxy keeps its picture)', () => {
    const post = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera());
    const u = gradeOf(post).uniforms;
    expect(u.tNoise.value).toBeTruthy();
    expect(u.uGrain.value).toBe(0);
    post.grain(0.03);
    expect(u.uGrain.value).toBeCloseTo(0.03);
    post.grain(0);
    expect(u.uGrain.value).toBe(0);
  });

  it('draws the bloom at half the target, capped', () => {
    expect(bloomSize(2560, 1440)).toEqual([640, 360]);
    expect(bloomSize(1280, 720)).toEqual([640, 360]);
    expect(bloomSize(800, 600, { small: true })).toEqual([200, 150]);
    expect(bloomSize(100, 80, { small: true })).toEqual([64, 64]);
  });

  it('aberration is off on low and grows with the rush and a hit', () => {
    expect(aberrationFor({ rush: 1, hit: 1, tier: 'low' })).toBe(0);
    expect(aberrationFor({})).toBeCloseTo(0.0015);
    expect(aberrationFor({ rush: 1 })).toBeCloseTo(0.006);
    expect(aberrationFor({ hit: 1 })).toBeCloseTo(0.004);
  });

  it('opens the exposure where it is asked, 1 by default', () => {
    const post = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera());
    expect(gradeOf(post).uniforms.uExposure.value).toBe(1);
    post.exposure(1.2);
    expect(gradeOf(post).uniforms.uExposure.value).toBeCloseTo(1.2);
  });

  it('drops the flare at pace step 2 and the aberration at 3, and brings them back', () => {
    const post = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera());
    const u = gradeOf(post).uniforms;
    post.aberration(0.004);
    expect(post.flareOn).toBe(true);
    post.setLevel(2);
    expect(post.flareOn).toBe(false);
    expect(u.uAberration.value).toBeCloseTo(0.004);
    post.setLevel(3);
    expect(u.uAberration.value).toBe(0);
    post.aberration(0.004); // (held off while the pace is down there)
    expect(u.uAberration.value).toBe(0);
    post.setLevel(0);
    expect(post.flareOn).toBe(true);
    post.aberration(0.004);
    expect(u.uAberration.value).toBeCloseTo(0.004);
  });

  it('resizes the bloom target instead of making a new one', () => {
    const post = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera());
    const bloom = bloomOf(post);
    post.composer.render = () => {};
    post.render(800, 600);
    post.render(1200, 700);
    expect(bloomOf(post)).toBe(bloom);
  });
});

describe('a softer look (the galaxy’s)', () => {
  it('takes its own bloom, and flares from it', () => {
    const post = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera(), { look: { bloom: { strength: 0.5, threshold: 2.1 } } });
    const bloom = bloomOf(post);
    expect(bloom.strength).toBeCloseTo(0.5);
    expect(bloom.threshold).toBeCloseTo(2.1);
    expect(bloom.radius).toBeCloseTo(0.55); // (what it's not given stays)
    post.flare(2);
    expect(bloom.strength).toBeCloseTo(1);
  });

  it('smears less in the rush', () => {
    const post = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera(), { look: { rush: 0.4 } });
    post.rush(1);
    expect(gradeOf(post).uniforms.uRush.value).toBeCloseTo(0.4);
    const plain = createPost(renderer(), new THREE.Scene(), new THREE.PerspectiveCamera());
    plain.rush(1);
    expect(gradeOf(plain).uniforms.uRush.value).toBeCloseTo(1);
  });
});
