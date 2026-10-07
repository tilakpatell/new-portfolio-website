import { describe, expect, it } from 'vitest';
import { blendNormals, fitSphere, heightNormals, latitudeOf, placing, platingHeight, trenchRows, yawToFront } from './deathstar-hd.mjs';

const apply = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];

describe('the first Death Star’s plating', () => {
  it('reads the globe’s rows south to north', () => {
    expect(latitudeOf(0, 2048)).toBeCloseTo(-Math.PI / 2, 2);
    expect(latitudeOf(2047, 2048)).toBeCloseTo(Math.PI / 2, 2);
    expect(latitudeOf(1023.5, 2048)).toBeCloseTo(0, 6);
  });

  it('finds the trench: the dark band nearest the equator, and nothing where there is none', () => {
    const profile = Array.from({ length: 200 }, (_, y) => (y >= 96 && y <= 101 ? 60 : y === 20 ? 50 : 140));
    expect(trenchRows(profile)).toEqual([96, 101]);
    expect(trenchRows(profile.map(() => 140))).toBe(null);
  });

  it('lays plates, seams along the bands and the trench sunk between raised lips, the same each time', () => {
    const w = 512;
    const h = 256;
    const H = platingHeight({ w, h, trench: [126, 129] });
    expect(platingHeight({ w, h, trench: [126, 129] })).toEqual(H);
    for (const v of H) expect(v >= 0 && v <= 1).toBe(true);
    // the seam along the top of the second band is lower than the plates either side of it
    const row = (y) => H.slice(y * w, (y + 1) * w).reduce((a, b) => a + b, 0) / w;
    const seam = Math.round(h / 36);
    expect(row(seam)).toBeLessThan(row(seam + 3) - 0.1);
    // the trench's floor, and its lips standing above the plates
    expect(row(127)).toBeLessThan(0.2);
    expect(row(125)).toBeGreaterThan(0.6);
    expect(row(130)).toBeGreaterThan(0.6);
  });
});

describe('a normal map from a height field', () => {
  const ramp = (w, h, f) => Float32Array.from({ length: w * h }, (_, i) => f(i % w, Math.floor(i / w)));

  it('is flat where the field is', () => {
    const n = heightNormals(ramp(8, 8, () => 0.5), 8, 8, 3);
    expect([n[0], n[1], n[2]]).toEqual([-0, -0, 1]);
  });

  it('leans away from the way the field rises: down the rows (its bitangent, as the model’s own tangents run) and along u', () => {
    const down = heightNormals(ramp(8, 8, (x, y) => y * 0.1), 8, 8, 2);
    const i = (4 * 8 + 4) * 3;
    expect(down[i + 1]).toBeLessThan(0);
    expect(down[i]).toBeCloseTo(0, 6);
    const across = heightNormals(ramp(8, 8, (x) => (x > 2 && x < 6 ? 1 : 0)), 8, 8, 2);
    expect(across[(4 * 8 + 2) * 3]).toBeLessThan(0); // (rising to its right)
    expect(across[(4 * 8 + 6) * 3]).toBeGreaterThan(0);
  });

  it('wraps round the globe’s seam', () => {
    const n = heightNormals(ramp(8, 4, (x) => (x === 0 ? 1 : 0)), 8, 4, 2);
    expect(n[(1 * 8 + 7) * 3]).toBeLessThan(0); // (the last column sees the first beside it)
  });

  it('adds the plating’s slopes to the model’s own, its grain under the floor left out', () => {
    const flat = [128, 128, 255];
    const lean = Float32Array.from([0.6, 0, 0.8]);
    const [x, , z] = blendNormals(Uint8Array.from(flat), lean);
    expect(x).toBeGreaterThan(200);
    expect(z).toBeGreaterThan(200);
    const grain = Uint8Array.from([131, 125, 255]);
    expect([...blendNormals(grain, Float32Array.from([0, 0, 1]), { gain: 3, floor: 0.08 })]).toEqual([128, 128, 255]);
    const line = Uint8Array.from([170, 128, 248]);
    expect(blendNormals(line, Float32Array.from([0, 0, 1]), { gain: 2.6, floor: 0.08 })[0]).toBeGreaterThan(170);
  });
});

describe('turning the second Death Star', () => {
  it('finds a sphere’s middle and size from points on it', () => {
    const pts = [];
    for (let i = 0; i < 200; i++) {
      const u = (i * 0.618) % 1;
      const v = i / 200;
      const t = Math.acos(2 * v - 1);
      const p = u * Math.PI * 2;
      pts.push([5 + 3 * Math.sin(t) * Math.cos(p), -2 + 3 * Math.cos(t), 1 + 3 * Math.sin(t) * Math.sin(p)]);
    }
    const { centre, r } = fitSphere(pts);
    expect(centre.map((v) => +v.toFixed(6))).toEqual([5, -2, 1]);
    expect(r).toBeCloseTo(3, 6);
  });

  it('brings its dish round to +z, its middle to the origin and its size to what’s asked', () => {
    const centre = [-15, -1.3, -17.3];
    const dish = [0.8, 0.59, -0.05];
    const m = placing(centre, yawToFront(dish), 10 / 372);
    expect(apply(m, centre).map((v) => +v.toFixed(9) + 0)).toEqual([0, 0, 0]);
    const at = apply(
      m,
      dish.map((d, i) => centre[i] + d * 372),
    );
    expect(at[0]).toBeCloseTo(0, 6);
    expect(at[2]).toBeGreaterThan(0);
    expect(at[1]).toBeCloseTo(0.59 * 10, 6);
    expect(Math.hypot(...at)).toBeCloseTo(10 * Math.hypot(...dish), 6);
  });
});
