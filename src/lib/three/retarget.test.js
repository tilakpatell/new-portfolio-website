import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { RICK_HIPS, retarget } from './retarget';
import * as lib from './clipLibrary';

const clip = () =>
  new THREE.AnimationClip('c', 2, [
    new THREE.QuaternionKeyframeTrack('Spine.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 1, 0]),
    new THREE.VectorKeyframeTrack('Hips.position', [0, 1], [0, RICK_HIPS, 1, 2, RICK_HIPS - 2, 3]),
    new THREE.VectorKeyframeTrack('Spine.position', [0, 1], [0, 1, 0, 0, 2, 0]),
    new THREE.VectorKeyframeTrack('Hips.scale', [0, 1], [1, 1, 1, 2, 2, 2]),
  ]);

describe('retarget', () => {
  it('scales the hips’ position by hipsY / RICK_HIPS and leaves the source alone', () => {
    const c = clip();
    const r = retarget(c, RICK_HIPS * 2);
    const hips = r.tracks.find((t) => t.name === 'Hips.position');
    expect(Array.from(hips.values)).toEqual([0, RICK_HIPS * 2, 2, 4, (RICK_HIPS - 2) * 2, 6].map((v) => expect.closeTo(v, 3)));
    expect(c.tracks[1].values[1]).toBeCloseTo(RICK_HIPS, 3);
    expect(r.name).toBe('c');
    expect(r.duration).toBe(2);
  });

  it('scales from `from` where given', () => {
    const hips = retarget(clip(), 100, 50).tracks.find((t) => t.name === 'Hips.position');
    expect(hips.values[1]).toBeCloseTo(RICK_HIPS * 2, 3);
  });

  it('keeps quaternion tracks and drops every other track but the hips’ position', () => {
    expect(retarget(clip(), 90).tracks.map((t) => t.name)).toEqual(['Spine.quaternion', 'Hips.position']);
  });

  it('gives null for no clip, and clipLibrary re-exports the same functions', () => {
    expect(retarget(null, 90)).toBeNull();
    expect(lib.retarget).toBe(retarget);
    expect(lib.RICK_HIPS).toBe(RICK_HIPS);
  });
});
