import { describe, expect, it } from 'vitest';
import { dropMips, ktx2Info, mipsToFit } from './ktx2-mips.mjs';

// A KTX2 by hand: `levels` mips of a w × h image, each level's bytes filled
// with its index; ETC1S (BasisLZ, scheme 1) carries one image descriptor a
// level and a codebook in its global data
function ktx2(w, h, levels, { basislz = false } = {}) {
  const dfd = Buffer.alloc(44, 7);
  dfd.writeUInt32LE(44, 0);
  const kvd = Buffer.from('\x0c\x00\x00\x00KTXwriter\x00x\x00\x00\x00', 'binary');
  let sgd = Buffer.alloc(0);
  if (basislz) {
    const head = Buffer.alloc(20);
    head.writeUInt16LE(1, 0);
    head.writeUInt16LE(1, 2);
    head.writeUInt32LE(4, 4); // endpoints
    const descs = Buffer.alloc(20 * levels);
    for (let l = 0; l < levels; l++) descs.writeUInt32LE(100 + l, l * 20 + 4); // (an rgbSliceByteOffset to know it by)
    sgd = Buffer.concat([head, descs, Buffer.from([9, 9, 9, 9])]);
  }
  const header = Buffer.alloc(80 + 24 * levels);
  Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header);
  header.writeUInt32LE(0, 12);
  header.writeUInt32LE(1, 16);
  header.writeUInt32LE(w, 20);
  header.writeUInt32LE(h, 24);
  header.writeUInt32LE(0, 28);
  header.writeUInt32LE(0, 32);
  header.writeUInt32LE(1, 36);
  header.writeUInt32LE(levels, 40);
  header.writeUInt32LE(basislz ? 1 : 2, 44);
  let at = header.length;
  const dfdAt = at;
  at += dfd.length;
  const kvdAt = at;
  at += kvd.length;
  const sgdAt = sgd.length ? at : 0;
  at += sgd.length;
  header.writeUInt32LE(dfdAt, 48);
  header.writeUInt32LE(dfd.length, 52);
  header.writeUInt32LE(kvdAt, 56);
  header.writeUInt32LE(kvd.length, 60);
  header.writeBigUInt64LE(BigInt(sgdAt), 64);
  header.writeBigUInt64LE(BigInt(sgd.length), 72);
  const datas = [];
  for (let l = levels - 1; l >= 0; l--) {
    const len = 8 + 4 * (levels - l);
    header.writeBigUInt64LE(BigInt(at), 80 + l * 24);
    header.writeBigUInt64LE(BigInt(len), 88 + l * 24);
    header.writeBigUInt64LE(BigInt(len * 3), 96 + l * 24);
    datas.push(Buffer.alloc(len, l));
    at += len;
  }
  return Buffer.concat([header, dfd, kvd, sgd, ...datas]);
}

describe('dropMips', () => {
  it('keeps the levels from n: the size halves, the rest is the same bytes', () => {
    const src = ktx2(2048, 1024, 12);
    const out = dropMips(src, 2);
    const info = ktx2Info(out);
    expect(info).toMatchObject({ width: 512, height: 256, levels: 10 });
    for (let l = 0; l < 10; l++) {
      const { offset, length } = info.levelIndex[l];
      expect(length).toBe(8 + 4 * (12 - (l + 2)));
      expect(out.subarray(offset, offset + length).every((b) => b === l + 2)).toBe(true);
    }
    expect(out.length).toBeLessThan(src.length);
  });

  it('keeps the data format and the key-values whole', () => {
    const out = dropMips(ktx2(256, 256, 9), 1);
    const i = ktx2Info(out);
    expect(out.subarray(i.dfd.offset, i.dfd.offset + i.dfd.length).subarray(4).every((b) => b === 7)).toBe(true);
    expect(out.subarray(i.kvd.offset, i.kvd.offset + i.kvd.length).toString('binary')).toContain('KTXwriter');
  });

  it('drops an ETC1S file’s image descriptors with its levels, the codebooks kept', () => {
    const out = dropMips(ktx2(1024, 1024, 11, { basislz: true }), 3);
    const i = ktx2Info(out);
    const sgd = out.subarray(i.sgd.offset, i.sgd.offset + i.sgd.length);
    expect(i.sgd.length).toBe(20 + 20 * 8 + 4);
    expect(sgd.readUInt32LE(20 + 4)).toBe(103);
    expect([...sgd.subarray(sgd.length - 4)]).toEqual([9, 9, 9, 9]);
  });

  it('is the same file at 0, and refuses to drop every level', () => {
    const src = ktx2(64, 64, 7);
    expect(dropMips(src, 0).equals(src)).toBe(true);
    expect(() => dropMips(src, 7)).toThrow(/level/);
  });
});

describe('mipsToFit', () => {
  it('counts the levels to drop for a size', () => {
    expect(mipsToFit(2048, 512)).toBe(2);
    expect(mipsToFit(1024, 1024)).toBe(0);
    expect(mipsToFit(512, 2048)).toBe(0);
    expect(mipsToFit(1500, 512)).toBe(2);
  });
});
