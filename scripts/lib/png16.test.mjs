import { describe, expect, it } from 'vitest';
import { decodePng16 } from '../../src/lib/level/png16.js';
import { crc32, encodePng16 } from './png16.mjs';

describe('encodePng16', () => {
  it('writes a 16-bit grey PNG the reader gives back exactly', async () => {
    const data = Uint16Array.from({ length: 7 * 3 }, (_, i) => (i * 4099 + 1) % 65536);
    const img = await decodePng16(encodePng16(data, 7, 3));
    expect([img.w, img.h]).toEqual([7, 3]);
    expect(Array.from(img.data)).toEqual(Array.from(data));
  });

  it('carries real CRCs (an image viewer refuses a file without them)', () => {
    expect(crc32(Buffer.from('IEND', 'ascii'))).toBe(0xae426082);
    const png = encodePng16(new Uint16Array(1), 1, 1);
    expect(png.subarray(png.length - 4).readUInt32BE(0)).toBe(0xae426082);
  });
});
