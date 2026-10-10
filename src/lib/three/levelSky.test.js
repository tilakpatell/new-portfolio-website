import { describe, expect, it, vi } from 'vitest';
import { FACES, forgetLevelSky, loadLevelSky, probeSizeFor, probeUrls, sunFrom } from './levelSky';

// six S × S faces, RGBA floats, dim but for one bright texel on `face` at (x, y)
const faces = (S, bright = null) =>
  FACES.map((f) => {
    const data = new Float32Array(S * S * 4).fill(0.5);
    if (bright && bright.face === f) data.set([90, 100, 120, 1], (bright.y * S + bright.x) * 4);
    return { data, width: S, height: S };
  });
const fakeLoader = (S, bright) => {
  const made = [];
  const load = vi.fn(async (urls) => {
    const env = { images: faces(S, bright), dispose: vi.fn(), urls };
    made.push(env);
    return env;
  });
  return { load, made };
};

describe('a level’s sky and probe as a world’s light', () => {
  it('loads the probe at the size the quality level allows', () => {
    expect(['low', 'mid', 'high', 'ultra'].map(probeSizeFor)).toEqual([64, 128, 128, 128]);
    expect(probeUrls('/textures/galaxy/sky/hoth', 64)[0]).toBe('/textures/galaxy/sky/hoth-probe-64-px.hdr');
    expect(probeUrls('/textures/galaxy/sky/hoth', 128).map((u) => u.slice(-6, -4))).toEqual(FACES);
  });

  it('finds the sun at the brightest texel, as a unit direction in the world the probe is drawn in', () => {
    // (the top middle of the -x face: up, and, as three turns a cube map
    // round to sample it, out along +x)
    const sun = sunFrom(faces(16, { face: 'nx', x: 8, y: 1 }));
    expect(Math.hypot(...sun.dir)).toBeCloseTo(1, 6);
    expect(sun.dir[1]).toBeGreaterThan(0.6);
    expect(sun.dir[0]).toBeGreaterThan(0.3);
    expect(Math.abs(sun.dir[2])).toBeLessThan(0.1);
    // its colour, the brightest channel 1
    expect(Math.max(...sun.color)).toBeCloseTo(1, 6);
    expect(sun.color[2]).toBeCloseTo(1, 6);
    expect(sun.color[0]).toBeCloseTo(90 / 120, 6);
    expect(sun.intensity).toBeGreaterThan(90);
  });

  it('reads straight up off the +y face’s middle', () => {
    const sun = sunFrom(faces(16, { face: 'py', x: 8, y: 8 }));
    expect(sun.dir[1]).toBeGreaterThan(0.99);
  });

  it('returns the probe and its sun, loaded once', async () => {
    forgetLevelSky();
    const { load } = fakeLoader(16, { face: 'pz', x: 8, y: 2 });
    const sky = await loadLevelSky('/textures/galaxy/sky/hoth', { level: 'low', load });
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0][0][0]).toBe('/textures/galaxy/sky/hoth-probe-64-px.hdr');
    expect(sky.env.images).toHaveLength(6);
    expect(sky.sun.dir[1]).toBeGreaterThan(0);
  });

  it('never holds two: the next world’s sky disposes the last one’s first', async () => {
    forgetLevelSky();
    const { load, made } = fakeLoader(8, { face: 'py', x: 4, y: 4 });
    await loadLevelSky('/a', { level: 'high', load });
    expect(made[0].dispose).not.toHaveBeenCalled();
    await loadLevelSky('/b', { level: 'high', load });
    expect(made[0].dispose).toHaveBeenCalledTimes(1);
    expect(made[1].dispose).not.toHaveBeenCalled();
  });

  it('lets go of its probe when the world says so, once', async () => {
    forgetLevelSky();
    const { load, made } = fakeLoader(8, { face: 'py', x: 4, y: 4 });
    const sky = await loadLevelSky('/a', { level: 'high', load });
    sky.dispose();
    sky.dispose();
    expect(made[0].dispose).toHaveBeenCalledTimes(1);
    await loadLevelSky('/b', { level: 'high', load });
    expect(made[0].dispose).toHaveBeenCalledTimes(1);
  });
});
