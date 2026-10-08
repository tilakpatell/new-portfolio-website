import { describe, expect, it } from 'vitest';
import { RECORD, bvToRgb, decodeStars, encodeStar, equatorialToGalactic, octDecode, octEncode, skyDir } from './starCatalog';

const DEG = Math.PI / 180;
const angle = (a, b) => Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) / DEG;
// where skyShader.js's photo() looks for a direction, as it does it
const photoUv = (d) => [(((Math.atan2(d[2], -d[0]) / (2 * Math.PI)) % 1) + 1) % 1, 1 - Math.acos(d[1]) / Math.PI];

describe('equatorialToGalactic', () => {
  it('puts the galactic centre at l 0, b 0', () => {
    const [l, b] = equatorialToGalactic(266.405, -28.93617);
    expect(Math.min(l, 360 - l)).toBeLessThan(0.01);
    expect(Math.abs(b)).toBeLessThan(0.01);
  });
  it('puts the galactic north pole at b 90', () => {
    expect(equatorialToGalactic(192.85948, 27.12825)[1]).toBeGreaterThan(89.99);
  });
  it('finds the Large Magellanic Cloud where it is', () => {
    const [l, b] = equatorialToGalactic(80.894, -69.756);
    expect(l).toBeCloseTo(280.47, 0);
    expect(b).toBeCloseTo(-32.89, 0);
  });
});

describe('skyDir', () => {
  it('lands on the sky texture where the bake put that place', () => {
    // the bake: ESO's panorama (l 0 in the middle, rising to the left, north
    // up) turned upside down, then 50 of its 6000 columns round
    const [u, v] = photoUv(skyDir(0, 0));
    expect(u).toBeCloseTo(0.5 - 50 / 6000, 5);
    expect(v).toBeCloseTo(0.5, 5);
    const [u2, v2] = photoUv(skyDir(90, -30));
    expect(u2).toBeCloseTo(0.25 - 50 / 6000, 5);
    expect(v2).toBeCloseTo(1 - 60 / 180, 5);
  });
  it('is a unit vector', () => {
    const d = skyDir(123, 45);
    expect(Math.hypot(...d)).toBeCloseTo(1, 6);
  });
});

describe('octEncode / octDecode', () => {
  it('round-trips a direction to well under a pixel of the narrowest view', () => {
    for (const d of [skyDir(0, 0), skyDir(37, 89.9), skyDir(250, -89.9), skyDir(180, 0), skyDir(-12, -3)]) {
      expect(angle(d, octDecode(...octEncode(d)))).toBeLessThan(0.01);
    }
  });
});

describe('encodeStar / decodeStars', () => {
  it('reads back what was written, brightest first as written', () => {
    const stars = [
      { d: skyDir(10, 5), v: -1.46, bv: 0.0 },
      { d: skyDir(200, -40), v: 9.87, bv: 1.62 },
    ];
    const buf = new Uint8Array(stars.length * RECORD);
    stars.forEach((s, i) => encodeStar(buf, i, s.d, s.v, s.bv));
    const out = decodeStars(buf.buffer);
    expect(out.count).toBe(2);
    stars.forEach((s, i) => {
      expect(angle(s.d, [...out.dir.subarray(i * 3, i * 3 + 3)])).toBeLessThan(0.01);
      expect(out.mag[i]).toBeCloseTo(s.v, 1);
      expect(out.bv[i]).toBeCloseTo(s.bv, 1);
    });
  });
});

describe('bvToRgb', () => {
  it('colours a star by its temperature, its brightest channel 1', () => {
    const hot = bvToRgb(-0.3);
    const sun = bvToRgb(0.65);
    const cool = bvToRgb(1.6);
    expect(Math.max(...hot)).toBeCloseTo(1, 5);
    expect(hot[2]).toBeGreaterThan(hot[0]);
    expect(sun[0]).toBeGreaterThanOrEqual(sun[1]);
    expect(sun[1]).toBeGreaterThanOrEqual(sun[2]);
    expect(sun[2]).toBeGreaterThan(0.75);
    expect(cool[0]).toBeGreaterThan(cool[1]);
    expect(cool[1]).toBeGreaterThan(cool[2]);
  });
});
