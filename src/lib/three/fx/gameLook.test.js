import { describe, expect, it, vi } from 'vitest';
import { BF2017_FX } from '../../../data/bf2017Fx';
import { gameLook, lookUrl, sheetWidth } from './gameLook';

const TABLE = {
  impact: { from: 'FX/Decals/VolumeDecals/Textures/T_Impact_01_RGB', grid: [1, 1], sizes: { 512: 47000 }, channels: { scorch: 'r', burst: 'g', ring: 'b' } },
  'scorch.metal': { from: 'FX/x', grid: [2, 2], sizes: { 512: 8000, 1024: 26000 }, colour: true },
  big: { from: 'FX/y', grid: [1, 1], sizes: { 512: 1, 1024: 2, 2048: 3 } },
  'debris.snow': { mesh: true, file: '/models/galaxy/bf2017/fx/debris.snow.glb', from: ['fx/a'], bytes: 7000 },
};

describe('gameLook', () => {
  it('is the table’s entry for an effect the bucket had', () => {
    expect(gameLook('impact', TABLE)).toBe(TABLE.impact);
    expect(gameLook('debris.snow', TABLE)).toBe(TABLE['debris.snow']);
  });

  it('is null for one it hasn’t, so the effect keeps its own look', () => {
    expect(gameLook('bolt.red', TABLE)).toBeNull();
    expect(gameLook('', TABLE)).toBeNull();
    expect(gameLook(undefined, TABLE)).toBeNull();
    // (nothing up the prototype chain)
    expect(gameLook('toString', TABLE)).toBeNull();
  });

  it('reads the committed table by default', () => {
    expect(gameLook('impact')).toBe(BF2017_FX.impact);
  });
});

describe('sheetWidth', () => {
  it('1024 at high, 512 below, 2048 at ultra: the nearest it has', () => {
    expect(sheetWidth(TABLE.big, 'high')).toBe(1024);
    expect(sheetWidth(TABLE.big, 'mid')).toBe(512);
    expect(sheetWidth(TABLE.big, 'low')).toBe(512);
    expect(sheetWidth(TABLE.big, 'ultra')).toBe(2048);
    expect(sheetWidth(TABLE['scorch.metal'], 'ultra')).toBe(1024);
    // one size only: that one, whatever the tier
    expect(sheetWidth(TABLE.impact, 'ultra')).toBe(512);
    expect(sheetWidth(TABLE.impact, 'low')).toBe(512);
  });
});

describe('lookUrl', () => {
  it('a sheet’s file at the tier’s size, a mesh’s own', () => {
    expect(lookUrl('scorch.metal', 'high', TABLE)).toBe('/models/galaxy/bf2017/fx/scorch.metal.1024.webp');
    expect(lookUrl('scorch.metal', 'low', TABLE)).toBe('/models/galaxy/bf2017/fx/scorch.metal.512.webp');
    expect(lookUrl('debris.snow', 'high', TABLE)).toBe('/models/galaxy/bf2017/fx/debris.snow.glb');
  });

  it('null for what isn’t there, never a path to nothing', () => {
    expect(lookUrl('bolt.red', 'high', TABLE)).toBeNull();
  });
});

describe('the committed table', () => {
  it('names only files that are there, each under the effect cap', async () => {
    const { existsSync, statSync } = await import('node:fs');
    const at = (p) => new URL(`../../../../public${p}`, import.meta.url);
    for (const name of Object.keys(BF2017_FX)) {
      const e = BF2017_FX[name];
      const files = e.mesh ? [e.file] : Object.keys(e.sizes).map((w) => lookUrl(name, w >= 2048 ? 'ultra' : w >= 1024 ? 'high' : 'low', BF2017_FX));
      for (const f of files) {
        expect(existsSync(at(f)), f).toBe(true);
        expect(statSync(at(f)).size, f).toBeLessThanOrEqual(256 * 1024);
      }
    }
  });
});

describe('loadLook', () => {
  it('resolves null, never throws, when the sheet is not in the table or fails to load', async () => {
    vi.resetModules();
    vi.doMock('../textures', () => ({ loadTexture: vi.fn(() => Promise.reject(new Error('404'))) }));
    const { loadLook } = await import('./gameLook');
    await expect(loadLook('bolt.red', { table: TABLE })).resolves.toBeNull();
    await expect(loadLook('impact', { table: TABLE })).resolves.toBeNull();
    vi.doUnmock('../textures');
  });

  it('hands back the texture with its grid and channels on it', async () => {
    vi.resetModules();
    const tex = { userData: {} };
    vi.doMock('../textures', () => ({ loadTexture: vi.fn(() => Promise.resolve(tex)) }));
    const { loadLook } = await import('./gameLook');
    const t = await loadLook('scorch.metal', { level: 'high', table: TABLE });
    expect(t).toBe(tex);
    expect(t.userData.look).toEqual({ name: 'scorch.metal', grid: [2, 2], channels: null, additive: false });
    vi.doUnmock('../textures');
  });
});
