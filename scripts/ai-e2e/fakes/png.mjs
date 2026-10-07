// A PNG from a function of each pixel, with nothing but zlib: the fakes need
// pictures that are byte-identical from run to run (so resume keys can be
// tested for real), and an image library's encoder may change its bytes
// between versions.
//
//   png(width, height, (x, y) => [r, g, b, a], { level }) → Buffer   (level: zlib's, 9 unless speed matters more)

import { crc32, deflateSync } from 'node:zlib';

const chunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
};

export function png(width, height, pixel, { level = 9 } = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA, no interlace
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const at = y * (width * 4 + 1);
    rows[at] = 0; // no filter: the bytes are the pixels
    for (let x = 0; x < width; x++) rows.set(pixel(x, y), at + 1 + x * 4);
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows, { level })), chunk('IEND', Buffer.alloc(0))]);
}

// A number from 0 to 1 for each call, the same sequence for the same seed
// (mulberry32): the fakes' only source of variety.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
