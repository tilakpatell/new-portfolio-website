import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TRACKS_GLSL, TRACK_VS, createTracks, trackLayout } from './tracks';

describe('trackLayout', () => {
  it('lays a straight track as a ribbon its width across', () => {
    const pos = trackLayout([0, 0, 1, 0, 2, 0], 0.5);
    expect(pos).toHaveLength(3 * 2 * 3);
    for (let i = 0; i < 3; i++) {
      const l = [pos[i * 6], pos[i * 6 + 2]];
      const r = [pos[i * 6 + 3], pos[i * 6 + 5]];
      expect(Math.hypot(l[0] - r[0], l[1] - r[1])).toBeCloseTo(0.5, 6);
      expect(l[0]).toBeCloseTo(i, 6);
      expect(Math.abs(l[1])).toBeCloseTo(0.25, 6);
    }
  });
});

describe('createTracks', () => {
  it('has his sizes, a target and the reads', () => {
    const t = createTracks();
    expect(t.target).toBeInstanceOf(THREE.WebGLRenderTarget);
    expect(t.target.width).toBe(512);
    expect(t.uniforms.uTracksSize.value).toBe(40);
    expect(t.uniforms.uTracks.value).toBe(t.target.texture);
    expect(t.glsl).toBe(TRACKS_GLSL);
    expect(TRACKS_GLSL).toContain('vec4 tracksAt(vec2 xz)');
    expect(TRACKS_GLSL).toContain('uTracksCentre');
    expect(TRACK_VS).toContain('texture2D(uPoints');
    t.dispose();
  });

  it('pushes a point only after 1/30 s and 0.2 m, newest first, with its contact', () => {
    const t = createTracks({ count: 8 });
    const w = t.track(0.5, 'r');
    w.push(0, 0, true, 0);
    w.push(0.1, 0, true, 0.1);
    expect(w.count).toBe(1);
    w.push(0.5, 0, true, 0.01);
    expect(w.count).toBe(1);
    w.push(0.5, 0, false, 0.1);
    expect(w.count).toBe(2);
    const d = w.texture.image.data;
    expect([d[0], d[1], d[2]]).toEqual([0.5, 0, 0]);
    expect([d[4], d[5], d[6]]).toEqual([0, 0, 1]);
    for (let i = 0; i < 20; i++) w.push(1 + i, 0, true, 0.2 + i);
    expect(w.count).toBe(8);
    t.dispose();
  });

  it('draws into its channel, snapped to its texels round the focus', () => {
    const t = createTracks({ size: 40, texels: 512 });
    const g = t.track(1.5, 'g');
    expect(g.mesh.material.uniforms.uChannel.value.toArray()).toEqual([0, 1, 0, 0]);
    const calls = [];
    const renderer = { getRenderTarget: () => null, setRenderTarget: (x) => calls.push(['target', x]), setClearColor: () => {}, getClearColor: (c) => c, getClearAlpha: () => 1, setClearAlpha: () => {}, clear: () => calls.push(['clear']), render: () => calls.push(['render']) };
    t.render(renderer, { x: 10.03, z: -4.01 });
    const c = t.uniforms.uTracksCentre.value;
    expect(c.x / (40 / 512)).toBeCloseTo(Math.round(c.x / (40 / 512)), 6);
    expect(Math.abs(c.x - 10.03)).toBeLessThan(40 / 512);
    expect(calls.map((k) => k[0])).toEqual(['target', 'clear', 'render', 'target']);
    t.dispose();
  });
});
