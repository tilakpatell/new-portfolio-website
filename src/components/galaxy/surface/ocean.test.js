import { describe, expect, it } from 'vitest';
import { SEAS, WAVES_GLSL, bakeDepth, damp, discRings, heightAt, seaFor, snapCentre, wavesFor } from './ocean';

// the plain Gerstner sum (no depth): what deep water does
const plain = (x, z, t, waves) => {
  let qx = x;
  let qz = z;
  for (let i = 0; i < 3; i++) {
    let ox = 0;
    let oz = 0;
    for (const w of waves) {
      const c = Math.cos(w.k * (w.dx * qx + w.dz * qz - w.c * t)) * w.amp;
      ox += w.dx * c;
      oz += w.dz * c;
    }
    qx = x - ox;
    qz = z - oz;
  }
  let y = 0;
  for (const w of waves) y += Math.sin(w.k * (w.dx * qx + w.dz * qz - w.c * t)) * w.amp;
  return y;
};

describe('the seas', () => {
  it('never fold over: every preset’s steepness sums under 1', () => {
    for (const [id, sea] of Object.entries(SEAS)) {
      const total = sea.waves.reduce((s, [, , steep]) => s + steep, 0);
      expect(total, id).toBeLessThan(1);
    }
  });

  it('give each world its own, and a world with none the one its water’s kind wants', () => {
    expect(seaFor('scarif', { kind: 'sea' })).toBe(SEAS.scarif);
    expect(seaFor('kamino', { kind: 'sea' })).toBe(SEAS.kamino);
    expect(seaFor('nowhere', { kind: 'sea' })).toBe(SEAS.sea);
    expect(seaFor('nowhere', { kind: 'swamp' })).toBe(SEAS.swamp);
  });

  it('run highest in Kamino’s storm and stillest on a swamp', () => {
    const peak = (sea) => wavesFor(sea).reduce((s, w) => s + w.amp, 0);
    expect(peak(SEAS.kamino)).toBeGreaterThan(peak(SEAS.scarif));
    expect(peak(SEAS.scarif)).toBeGreaterThan(peak(SEAS.naboo));
    expect(peak(SEAS.naboo)).toBeGreaterThan(peak(SEAS.swamp));
    expect(peak(SEAS.kamino)).toBeLessThan(5); // (no wave over Tipoca's deck at 12 m)
  });

  it('keep Scarif turquoise to the horizon: a far colour, and less of the pale sky in it', () => {
    expect(SEAS.scarif.far).toMatch(/^#[0-9a-f]{6}$/);
    expect(SEAS.scarif.farMix).toBeGreaterThan(0);
    expect(SEAS.scarif.sky).toBeLessThan(1);
    for (const [id, sea] of Object.entries(SEAS)) expect(sea.sky ?? 1, id).toBeGreaterThan(0);
  });
});

describe('the water’s height', () => {
  const waves = wavesFor(SEAS.scarif);
  it('is the Gerstner sum out in deep water', () => {
    for (const [x, z, t] of [[0, 0, 0], [13.2, -40, 2.5], [-210, 77, 9.1]]) expect(heightAt(x, z, t, waves)).toBeCloseTo(plain(x, z, t, waves), 5);
  });
  it('goes flat at the waterline', () => {
    expect(heightAt(13.2, -40, 2.5, waves, 0)).toBe(0);
    expect(Math.abs(heightAt(13.2, -40, 2.5, waves, 0.05))).toBeLessThan(0.1);
  });
});

describe('the shallows', () => {
  it('lift the swell before the beach, and still it on the sand', () => {
    expect(damp(0, SEAS.scarif)).toBe(0);
    expect(damp(-3, SEAS.scarif)).toBe(0);
    expect(damp(2.5, SEAS.scarif)).toBeGreaterThan(1);
    expect(damp(60, SEAS.scarif)).toBeCloseTo(1, 5);
  });
});

describe('the depth map', () => {
  // a beach: land rising east, the water's level at 0
  const ground = (x) => x * 0.05 - 10;
  const map = bakeDepth((x) => ground(x), 0, { half: 400, n: 128, max: 24 });
  it('reads back the depth it was baked with', () => {
    for (const x of [-300, -120, 0, 150]) {
      const want = Math.max(0, Math.min(24, -ground(x)));
      expect(map.at(x, 37)).toBeCloseTo(want, 0);
    }
  });
  it('knows how far each place is from the waterline (x = 200), whatever the slope', () => {
    expect(map.shoreAt(150, 0)).toBeGreaterThan(44);
    expect(map.shoreAt(150, 0)).toBeLessThan(56);
    expect(map.shoreAt(196, 0)).toBeLessThan(9);
    expect(map.shoreAt(260, 0)).toBe(0);
    expect(map.shoreAt(-5000, 0)).toBe(64);
  });
  it('is deep past its edge, and none on dry land', () => {
    expect(map.at(5000, 0)).toBe(24);
    expect(map.at(390, 0)).toBe(0);
  });
});

describe('the disc', () => {
  it('rings out from the camera, finer near it', () => {
    const { radii } = discRings({});
    for (let i = 1; i < radii.length; i++) expect(radii[i]).toBeGreaterThan(radii[i - 1]);
    expect(radii[1] - radii[0]).toBeLessThan(radii.at(-1) - radii.at(-2));
  });
  it('fits the budget, and the small one is under half', () => {
    const verts = ({ radii, around }) => radii.length * around;
    expect(verts(discRings({})) * 2).toBeLessThan(50000); // (triangles: about two a vertex)
    expect(verts(discRings({ small: true }))).toBeLessThan(verts(discRings({})) / 2);
  });
  it('holds still within a step, so a fast camera doesn’t make the waves swim', () => {
    expect(snapCentre(10.1, -3.2, 2)).toEqual(snapCentre(11.9, -2.1, 2));
    expect(snapCentre(10.1, 0, 2)).not.toEqual(snapCentre(12.1, 0, 2));
  });
});

describe('the waves in GLSL', () => {
  it('has one block a wave, and the function the shader calls', () => {
    const waves = wavesFor(SEAS.kamino);
    const glsl = WAVES_GLSL(waves);
    expect(glsl).toContain('vec3 gerstner(vec2 p, float dist, float amp, out vec3 n, out float pinch)');
    expect(glsl.split('float f = ').length - 1).toBe(waves.length);
  });
});
