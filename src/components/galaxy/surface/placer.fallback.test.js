import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { cutsToLoad, fallbackFor, swapIn } from './placer';
import { surfaceLodUrl, surfaceUltraUrl, surfaceUrl } from './catalog';

// an .ultra cut lives in the public bucket only: the plain file stands in
// for it when it can't be had, and nothing stands in for the plain
describe('a cut that can’t be had', () => {
  const models = { full: { ultra: { tris: 100, tex: 2048, full: true } }, plain: {} };
  it('falls from the ultra cut to the plain one', () => {
    expect(fallbackFor('full', surfaceUltraUrl('full'), models)).toBe(surfaceUrl('full'));
  });
  it('has nothing under the plain one, or for a kind without an ultra cut', () => {
    expect(fallbackFor('full', surfaceUrl('full'), models)).toBeNull();
    expect(fallbackFor('plain', surfaceUrl('plain'), models)).toBeNull();
  });
});

describe('the light cut first, the level’s swapped in', () => {
  const models = { native: { native: true, lod: true, ultra: { tris: 100, tex: 2048 } }, old: { lod: true, ultra: { tris: 100, tex: 2048 } }, plain: {} };
  it('draws a native kind’s light cut first, its level’s cut after', () => {
    expect(cutsToLoad('native', 'ultra', models)).toEqual({ first: surfaceLodUrl('native'), then: surfaceUltraUrl('native') });
    expect(cutsToLoad('native', 'high', models)).toEqual({ first: surfaceLodUrl('native'), then: surfaceUrl('native') });
    // (at the phone's levels the light cut is the level's own: loaded once, nothing swapped)
    expect(cutsToLoad('native', 'mid', models)).toEqual({ first: surfaceLodUrl('native'), then: null });
  });
  it('loads anything else’s level cut straight away', () => {
    expect(cutsToLoad('old', 'ultra', models)).toEqual({ first: surfaceUltraUrl('old'), then: null });
    expect(cutsToLoad('plain', 'ultra', models)).toEqual({ first: surfaceUrl('plain'), then: null });
  });
  it('puts the later cut’s insides under the object the first was', () => {
    const o = new THREE.Group();
    o.add(new THREE.Object3D());
    const full = new THREE.Group();
    const a = new THREE.Object3D();
    full.add(a);
    expect(swapIn(o, full)).toBe(o);
    expect(o.children).toEqual([a]);
  });
});
