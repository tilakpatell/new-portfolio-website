import { Buffer } from 'node:buffer';
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodePng16 } from './png16';

// A 16-bit grey PNG by hand, each row with the filter asked for (0 none,
// 1 sub, 2 up, 3 average, 4 Paeth), so the reader is held to every one.
function png16(w, h, values, filters) {
  const bpp = 2;
  const stride = w * bpp;
  const raw = Buffer.alloc(h * (stride + 1));
  const rows = [];
  for (let y = 0; y < h; y++) {
    const r = Buffer.alloc(stride);
    for (let x = 0; x < w; x++) r.writeUInt16BE(values[y * w + x], x * 2);
    rows.push(r);
  }
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    const f = filters[y % filters.length];
    raw[y * (stride + 1)] = f;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? rows[y][i - bpp] : 0;
      const b = y ? rows[y - 1][i] : 0;
      const c = y && i >= bpp ? rows[y - 1][i - bpp] : 0;
      const pred = [0, a, b, (a + b) >> 1, paeth(a, b, c)][f];
      raw[y * (stride + 1) + 1 + i] = (rows[y][i] - pred) & 0xff;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)]); // (the CRC is not read)
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 16; // bit depth
  ihdr[9] = 0; // greyscale
  const z = deflateSync(raw);
  // two IDAT chunks, as an encoder writing in blocks does
  const half = z.length >> 1;
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', z.subarray(0, half)), chunk('IDAT', z.subarray(half)), chunk('IEND', Buffer.alloc(0))]));
}

describe('decodePng16', () => {
  const w = 5;
  const h = 5;
  const values = Array.from({ length: w * h }, (_, i) => (i * 2731 + 17) % 65536);

  it('reads every filter back to the same 16-bit values', async () => {
    for (const f of [0, 1, 2, 3, 4]) {
      const img = await decodePng16(png16(w, h, values, [f]));
      expect(img.w).toBe(5);
      expect(img.h).toBe(5);
      expect(Array.from(img.data)).toEqual(values);
    }
  });

  it('reads rows of mixed filters', async () => {
    const img = await decodePng16(png16(w, h, values, [4, 1, 3, 2, 0]));
    expect(Array.from(img.data)).toEqual(values);
  });

  it('refuses what is not a 16-bit grey PNG', async () => {
    await expect(decodePng16(new Uint8Array([1, 2, 3]))).rejects.toThrow(/PNG/);
  });
});
