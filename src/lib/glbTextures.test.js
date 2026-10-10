import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { glbTextures, imageSize } from './glbTextures';

// the smallest headers of each kind, sized 300 × 200
const png = () => {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b);
  b.writeUInt32BE(300, 16);
  b.writeUInt32BE(200, 20);
  return b;
};
const webp = (kind) => {
  const b = Buffer.alloc(40);
  b.write('RIFF', 0, 'ascii');
  b.write('WEBP', 8, 'ascii');
  b.write(kind, 12, 'ascii');
  if (kind === 'VP8X') {
    b.writeUIntLE(299, 24, 3);
    b.writeUIntLE(199, 27, 3);
  } else if (kind === 'VP8 ') {
    b.writeUInt16LE(300, 26);
    b.writeUInt16LE(200, 28);
  } else b.writeUInt32LE((299 & 0x3fff) | ((199 & 0x3fff) << 14), 21);
  return b;
};
// an AVIF: its ftyp box, then the image's spatial extents ('ispe') in its meta
const avif = () => {
  const b = Buffer.alloc(64);
  b.writeUInt32BE(20, 0);
  b.write('ftypavif', 4, 'ascii');
  b.writeUInt32BE(20, 36);
  b.write('ispe', 40, 'ascii');
  b.writeUInt32BE(300, 48);
  b.writeUInt32BE(200, 52);
  return b;
};
const jpeg = () => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0, 200, 1, 44, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe('an image’s size from its header', () => {
  it('reads PNG, the three WebPs, AVIF and JPEG', () => {
    for (const b of [png(), webp('VP8X'), webp('VP8 '), webp('VP8L'), avif(), jpeg()]) expect(imageSize(b)).toEqual({ width: 300, height: 200 });
    expect(imageSize(Buffer.alloc(40))).toBeNull();
  });
});

describe('a GLB’s textures on the GPU', () => {
  it('counts each embedded image as RGBA8 with its mips', () => {
    const img = png();
    const json = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, images: [{ bufferView: 0, mimeType: 'image/png' }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: img.length }] }));
    const pad = (b, c) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4, c)]);
    const j = pad(json, 0x20);
    const bin = pad(img, 0);
    const head = Buffer.alloc(12);
    head.write('glTF', 0, 'ascii');
    head.writeUInt32LE(2, 4);
    head.writeUInt32LE(12 + 8 + j.length + 8 + bin.length, 8);
    const chunk = (len, type) => Buffer.concat([Buffer.from(new Uint32Array([len]).buffer), Buffer.from(type, 'ascii')]);
    const glb = Buffer.concat([head, chunk(j.length, 'JSON'), j, chunk(bin.length, 'BIN\0'), bin]);
    const t = glbTextures(glb);
    expect(t.images).toEqual([{ width: 300, height: 200 }]);
    expect(t.gpuBytes).toBeCloseTo((300 * 200 * 4 * 4) / 3, 6);
  });
});
