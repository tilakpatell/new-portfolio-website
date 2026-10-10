import { describe, expect, it } from 'vitest';
import { fitTo, windowCost } from './fit';

// one cell, three draws: triangles a piece and the weight (count × volume)
const cells = () =>
  new Map([
    [
      '0,0',
      {
        draws: [
          { mesh: 0, count: 1, tris: 4, weight: 50 },
          { mesh: 1, count: 2, tris: 2, weight: 1 }, // snow debris: the lightest
          { mesh: 2, count: 1, tris: 3, weight: 9 },
        ],
      },
    ],
  ]);

describe('fitTo', () => {
  it('keeps everything that fits', () => {
    const { kept, dropped } = fitTo(cells(), { tris: 100, calls: 100 }, { share: 1 });
    expect(dropped).toEqual([]);
    expect(kept.get('0,0').length).toBe(3);
  });

  it('on a row of 10 triangles drops the lightest draw first', () => {
    // 4 + 4 + 3 = 11 > 10: the debris (weight 1, 4 triangles) goes
    const { kept, dropped } = fitTo(cells(), { tris: 10, calls: 100 }, { share: 1 });
    expect(dropped).toEqual([{ mesh: 1, count: 2, tris: 4 }]);
    expect(kept.get('0,0').map((d) => d.mesh)).toEqual([0, 2]);
  });

  it('holds the share: 70% of 9 is 6.3, so the next lightest goes too', () => {
    const { dropped } = fitTo(cells(), { tris: 9, calls: 100 });
    expect(dropped.map((d) => d.mesh)).toEqual([1, 2]);
  });

  it('counts calls as the distinct meshes, cuts and sides in a window', () => {
    const { dropped } = fitTo(cells(), { tris: Infinity, calls: 2 }, { share: 1 });
    expect(dropped.map((d) => d.mesh)).toEqual([1]);
  });

  it('drops a mesh everywhere at once, by its weight over the whole arena', () => {
    const m = new Map([
      ['0,0', { draws: [{ mesh: 0, count: 1, tris: 6, weight: 5 }, { mesh: 1, count: 1, tris: 6, weight: 2 }] }],
      ['5,5', { draws: [{ mesh: 1, count: 1, tris: 6, weight: 2 }] }], // far off: alone it fits
    ]);
    const { kept, dropped } = fitTo(m, { tris: 10, calls: 10 }, { share: 1 });
    expect(dropped).toEqual([{ mesh: 1, count: 2, tris: 12 }]);
    expect(kept.get('5,5')).toEqual([]);
  });

  it('a window is the cells within the radius: neighbours add up', () => {
    const m = new Map([
      ['0,0', { draws: [{ mesh: 0, count: 1, tris: 6, weight: 5 }] }],
      ['1,1', { draws: [{ mesh: 1, count: 1, tris: 6, weight: 3 }] }],
    ]);
    expect(windowCost(m, '0,0', { radius: 1 })).toEqual({ tris: 12, calls: 2 });
    expect(windowCost(m, '0,0', { radius: 0 })).toEqual({ tris: 6, calls: 1 });
    expect(fitTo(m, { tris: 10, calls: 10 }, { share: 1, radius: 1 }).dropped.map((d) => d.mesh)).toEqual([1]);
  });

  it('weighs each ring at its own cut through `cost`', () => {
    const m = new Map([
      ['0,0', { draws: [{ mesh: 0, count: 1, tris: { plain: 8, lod1: 2 }, weight: 5 }] }],
      ['1,0', { draws: [{ mesh: 0, count: 1, tris: { plain: 8, lod1: 2 }, weight: 5 }] }],
    ]);
    const cost = (d, ring) => (ring === 0 ? { tris: d.tris.plain, cut: 'plain' } : { tris: d.tris.lod1, cut: 'lod1' });
    // the worst window: 8 near + 2 beyond, and two calls (one mesh, two cuts)
    expect(windowCost(m, '0,0', { radius: 1, cost })).toEqual({ tris: 10, calls: 2 });
    expect(fitTo(m, { tris: 10, calls: 2 }, { share: 1, radius: 1, cost }).dropped).toEqual([]);
  });
});
