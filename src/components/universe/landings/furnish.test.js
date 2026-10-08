import { describe, expect, it } from 'vitest';
import { cellsOf, modelUrls, within } from './furnish';

describe('within', () => {
  it("is what the promise gives, when it's in time", async () => {
    await expect(within(Promise.resolve(7), 50)).resolves.toBe(7);
  });

  it('gives up waiting after so long, and resolves all the same', async () => {
    const never = new Promise(() => {});
    const t0 = Date.now();
    await expect(within(never, 30)).resolves.toBeUndefined();
    expect(Date.now() - t0).toBeGreaterThanOrEqual(25);
  });

  it("never rejects: a promise that fails is waited for as one that's in", async () => {
    await expect(within(Promise.reject(new Error('no scans')), 50)).resolves.toBeUndefined();
  });
});

describe('modelUrls', () => {
  it("is every model a landing may stand about, its biomes' too, each once", () => {
    const landing = {
      models: { rv: { url: '/models/rv.glb' }, car: { url: '/models/car.glb' } },
      biomes: [{ id: 'city', models: { car: { url: '/models/car.glb' }, sign: { url: '/models/sign.glb' } } }, { id: 'sands' }],
    };
    expect(modelUrls(landing)).toEqual(['/models/rv.glb', '/models/car.glb', '/models/sign.glb']);
  });

  it('is none for a landing with no models', () => {
    expect(modelUrls({ things: [] })).toEqual([]);
    expect(modelUrls(null)).toEqual([]);
  });
});

describe('cellsOf', () => {
  // (spots as scatterSpots lays them: metres from the landing's middle)
  const ring = (n, d) => Array.from({ length: n }, (_, i) => ({ x: Math.sin(((i + 0.5) / n) * Math.PI * 2) * d, z: Math.cos(((i + 0.5) / n) * Math.PI * 2) * d, s: 1, yaw: 0 }));
  const angle = (p) => (Math.atan2(p.x, p.z) + Math.PI * 2) % (Math.PI * 2);

  it('puts every spot in one cell, each once, in the order they were laid', () => {
    const spots = [...ring(40, 60), ...ring(13, 8), ...ring(29, 100)];
    const cells = cellsOf(spots, { sectors: 8, inner: 20 });
    const all = cells.flat();
    expect([...all].sort((a, b) => a - b)).toEqual(spots.map((_, i) => i));
    for (const c of cells) expect(c).toEqual([...c].sort((a, b) => a - b));
  });

  it('keeps the spots near the middle together, and splits the rest by the way they lie from it', () => {
    const spots = [...ring(16, 5), ...ring(64, 70)];
    const cells = cellsOf(spots, { sectors: 8, inner: 20 });
    const middle = cells.find((c) => c.includes(0));
    expect(middle).toEqual(Array.from({ length: 16 }, (_, i) => i));
    const out = cells.filter((c) => c !== middle);
    expect(out).toHaveLength(8);
    for (const c of out) {
      const k = Math.floor(angle(spots[c[0]]) / (Math.PI / 4));
      for (const i of c) expect(Math.floor(angle(spots[i]) / (Math.PI / 4))).toBe(k);
    }
  });

  it('leaves out a cell with nothing in it', () => {
    const spots = [{ x: 50, z: 1, s: 1, yaw: 0 }, { x: 51, z: 2, s: 1, yaw: 0 }];
    expect(cellsOf(spots, { sectors: 8, inner: 20 })).toEqual([[0, 1]]);
  });

  it('is one cell of them all with a single sector (what can be knocked about goes anywhere)', () => {
    const spots = [...ring(9, 5), ...ring(9, 70)];
    expect(cellsOf(spots, { sectors: 1 })).toEqual([spots.map((_, i) => i)]);
    expect(cellsOf([], { sectors: 8 })).toEqual([]);
  });

  it("doesn't move them", () => {
    const spots = ring(12, 40);
    const before = JSON.stringify(spots);
    cellsOf(spots, { sectors: 8, inner: 20 });
    expect(JSON.stringify(spots)).toBe(before);
  });
});
