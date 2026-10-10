import { describe, expect, it } from 'vitest';
import { Document } from '@gltf-transform/core';
import sharp from 'sharp';
import { MESHY_MAX_POLYCOUNT, checkUltra, mapsOf, takeUltra, ultraName, ultraSpec } from './cut.mjs';

describe('an ultra cut asked of an importer', () => {
  it('is asked for with --ultra, anywhere on the command line', () => {
    expect(takeUltra(['fetch', '--ultra', 'theed', 'palace'])).toEqual({ ultra: true, args: ['fetch', 'theed', 'palace'] });
    expect(takeUltra(['fetch', 'theed'])).toEqual({ ultra: false, args: ['fetch', 'theed'] });
  });

  it('keeps four times the catalogue’s triangles and 8192 maps, its other maps half that', () => {
    expect(ultraSpec({ tris: 30000, tex: 2048, maps: 512, metres: 35 })).toEqual({ tris: 120000, tex: 8192, maps: 4096, metres: 35 });
    expect(ultraSpec({ tris: 30000, tex: 2048, ultra: { tris: 90000, tex: 4096 } })).toMatchObject({ tris: 90000, tex: 4096, maps: 2048 });
  });

  it('goes beside the plain file as <name>.ultra.glb', () => {
    expect(ultraName('theed')).toBe('theed.ultra.glb');
  });

  it('asks Meshy for its most polygons', () => {
    expect(MESHY_MAX_POLYCOUNT).toBe(300000);
  });

  it('is refused over 24 MB, or over its triangle budget', () => {
    expect(checkUltra({ tris: 120000, after: 119000, bytes: 10 * 1024 * 1024 })).toEqual([]);
    expect(checkUltra({ tris: 120000, after: 119000, bytes: 25 * 1024 * 1024 })[0]).toMatch(/over 24 MB/);
    expect(checkUltra({ tris: 120000, after: 200000, bytes: 1 })[0]).toMatch(/over the budget of 120000/);
  });

  it('says the widest map it really carries, not the one asked for', async () => {
    const doc = new Document();
    const png = (w, h) => sharp({ create: { width: w, height: h, channels: 3, background: '#888' } }).png().toBuffer();
    doc.createTexture('a').setImage(await png(64, 32)).setMimeType('image/png');
    doc.createTexture('b').setImage(await png(16, 128)).setMimeType('image/png');
    expect(await mapsOf(doc)).toBe(128);
    expect(await mapsOf(new Document())).toBe(0);
  });
});
