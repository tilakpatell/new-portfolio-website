import { describe, expect, it } from 'vitest';
import { dropLevels, ktx2Info } from './ktx2-levels.mjs';

// a KTX2 of `levels` mips (zstd), each level's bytes filled with its index
function ktx2(levels, w = 8) {
  const dfd = new Uint8Array([28, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
  const kvd = new Uint8Array([6, 0, 0, 0, 107, 61, 118, 0, 0, 0]);
  const lens = Array.from({ length: levels }, (_, i) => 16 + i);
  let at = 80 + levels * 24;
  const dfdAt = at;
  at += dfd.length;
  const kvdAt = Math.ceil(at / 4) * 4;
  at = kvdAt + kvd.length;
  const places = [];
  for (let i = levels - 1; i >= 0; i--) {
    at = Math.ceil(at / 8) * 8;
    places[i] = at;
    at += lens[i];
  }
  const b = new Uint8Array(at);
  const v = new DataView(b.buffer);
  b.set([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);
  [0, 1, w, w, 0, 0, 1, levels, 2].forEach((x, i) => v.setUint32(12 + i * 4, x, true));
  [dfdAt, dfd.length, kvdAt, kvd.length].forEach((x, i) => v.setUint32(48 + i * 4, x, true));
  for (let i = 0; i < levels; i++) {
    v.setBigUint64(80 + i * 24, BigInt(places[i]), true);
    v.setBigUint64(88 + i * 24, BigInt(lens[i]), true);
    v.setBigUint64(96 + i * 24, BigInt(lens[i] * 4), true);
    b.fill(i + 1, places[i], places[i] + lens[i]);
  }
  b.set(dfd, dfdAt);
  b.set(kvd, kvdAt);
  return b;
}
const levelBytes = (b) => {
  const v = new DataView(b.buffer, b.byteOffset);
  return Array.from({ length: ktx2Info(b).levels }, (_, i) => {
    const o = Number(v.getBigUint64(80 + i * 24, true));
    return [...b.subarray(o, o + Number(v.getBigUint64(88 + i * 24, true)))];
  });
};

describe('a KTX2 with its largest mips taken off', () => {
  it('keeps the smaller levels byte for byte, at half the size a level', () => {
    const src = ktx2(4, 8);
    const out = dropLevels(src, 2);
    expect(ktx2Info(out)).toEqual({ width: 2, height: 2, levels: 2, scheme: 2 });
    expect(levelBytes(out)).toEqual(levelBytes(src).slice(2));
    expect(out.subarray(0, 12)).toEqual(src.subarray(0, 12));
  });

  it('keeps the descriptors, and is the same file with nothing dropped', () => {
    const src = ktx2(3);
    const out = dropLevels(src, 1);
    const v = new DataView(out.buffer);
    const s = new DataView(src.buffer);
    const block = (d, b, at) => [...b.subarray(d.getUint32(at, true), d.getUint32(at, true) + d.getUint32(at + 4, true))];
    expect(block(v, out, 48)).toEqual(block(s, src, 48));
    expect(block(v, out, 56)).toEqual(block(s, src, 56));
    expect(dropLevels(src, 0)).toBe(src);
  });

  it('refuses BasisLZ and dropping every level', () => {
    const src = ktx2(3);
    expect(() => dropLevels(src, 3)).toThrow(/levels/);
    new DataView(src.buffer).setUint32(44, 1, true);
    expect(() => dropLevels(src, 1)).toThrow(/BasisLZ/);
  });
});
