import { describe, expect, it } from 'vitest';
import { createCutter, createLedger, cutWanted } from './walrusCuts';

const has = { hasLod: true, hasFar: true, lowData: false, admitted: true };

describe('which cut a 2017 figure draws, by how far it is', () => {
  it('draws the full cut within the level’s near, the light one to its mid, the far one past it', () => {
    expect(cutWanted(20, 'high', has)).toBe('plain');
    expect(cutWanted(100, 'high', has)).toBe('lod1');
    expect(cutWanted(300, 'high', has)).toBe('far');
  });

  it('keeps the light cut where the full one is not admitted, on a phone’s levels and on a saver connection', () => {
    expect(cutWanted(20, 'high', { ...has, admitted: false })).toBe('lod1');
    expect(cutWanted(10, 'low', has)).toBe('lod1');
    expect(cutWanted(10, 'mid', has)).toBe('lod1');
    expect(cutWanted(10, 'high', { ...has, lowData: true })).toBe('lod1');
  });

  it('draws the full cut at every distance at ultra, when it is admitted', () => {
    expect(cutWanted(900, 'ultra', has)).toBe('plain');
    expect(cutWanted(900, 'ultra', { ...has, admitted: false })).toBe('lod1');
  });

  it('never draws the far cut within the level’s near, at any level', () => {
    for (const level of ['low', 'mid', 'high', 'ultra'])
      for (const d of [0, 15, 29]) for (const admitted of [true, false]) expect(cutWanted(d, level, { ...has, admitted })).not.toBe('far');
  });

  it('draws what there is when a cut is missing', () => {
    expect(cutWanted(300, 'high', { ...has, hasFar: false })).toBe('lod1');
    expect(cutWanted(100, 'high', { ...has, hasLod: false, hasFar: false })).toBe('plain');
  });
});

describe('the full cuts’ share of the GPU’s texture memory', () => {
  it('admits a kind while its textures fit, each kind counted once', () => {
    const ledger = createLedger(250);
    expect(ledger.admit('trooper', 200)).toBe(true);
    expect(ledger.admit('trooper', 200)).toBe(true);
    expect(ledger.admit('rebel', 80)).toBe(false);
    expect(ledger.admit('droid', 40)).toBe(true);
    expect(ledger.used()).toBe(240);
  });

  it('admits nothing with no share (a phone’s levels)', () => {
    expect(createLedger(0).admit('trooper', 1)).toBe(false);
  });
});

describe('a figure kept to the cut its distance wants', () => {
  const make = (over = {}) => {
    const asked = [];
    const swapped = [];
    const cutter = createCutter({
      url: '/x/trooper.glb',
      cuts: { lod: true, far: true, fullMB: 100 },
      level: 'high',
      ledger: createLedger(150),
      load: async (u) => (asked.push(u), { scene: u }),
      swap: (s) => swapped.push(s),
      ...over,
    });
    return { cutter, asked, swapped };
  };

  it('starts at the light cut, takes the full one near and the far one past the middle', async () => {
    const { cutter, asked } = make();
    expect(cutter.current()).toBe('lod1');
    expect(cutter.at(100)).toBe(null);
    await cutter.at(10);
    expect(cutter.current()).toBe('plain');
    await cutter.at(400);
    expect(cutter.current()).toBe('far');
    expect(asked).toEqual(['/x/trooper.glb', '/x/trooper.far.glb']);
  });

  it('holds its cut on the band’s edge, and asks one load at a time', async () => {
    const { cutter, asked } = make();
    // (high's near is 70 m: 72 is within a tenth of it)
    expect(cutter.at(72)).toBe(null);
    const p = cutter.at(10);
    expect(cutter.at(10)).toBe(null);
    await p;
    expect(asked.length).toBe(1);
  });

  it('keeps the light cut when the full one is refused by the ledger, or will not load', async () => {
    const ledger = createLedger(150);
    ledger.admit('other', 100);
    const { cutter, asked } = make({ ledger });
    expect(cutter.at(10)).toBe(null);
    expect(asked).toEqual([]);
    const broken = make({ load: async () => null });
    await broken.cutter.at(10);
    expect(broken.cutter.current()).toBe('lod1');
    expect(broken.cutter.at(10)).toBe(null);
  });
});
