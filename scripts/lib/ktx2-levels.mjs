// A KTX2 file with its largest mip levels taken off: the same texture, a
// half (or quarter…) the size, made of the very blocks the file already
// holds, so nothing is re-encoded and nothing is lost below the new top.
// The game's maps come as zstd-supercompressed UASTC with full mip chains
// (the bucket's web build); a hero's light cuts take them this way instead
// of decoding and re-encoding them (scripts/bf2017-import.mjs).
//
//   ktx2Info(bytes) → { width, height, levels, scheme }
//   dropLevels(bytes, n) → bytes: the file from level n down (n = 0: itself)
//   BASIS_LZ: the scheme dropLevels refuses (ETC1S's codebooks span the levels)
//
// The container (Khronos KTX 2.0): a 12-byte identifier, nine 32-bit
// header fields, the index (DFD, KVD and SGD offsets and lengths), one
// level index entry a level (offset, length, uncompressed length, 64-bit
// each), then the descriptors and the levels' data. Zstd's levels are each
// their own stream, so a level moves as it is; BasisLZ, whose global data
// is per image, is refused.

const ID_LEN = 12;
const HEADER = 48; // identifier + 9 × u32
const INDEX = 80; // + dfd/kvd (4 × u32) + sgd (2 × u64)
export const BASIS_LZ = 1;

export function ktx2Info(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: v.getUint32(ID_LEN + 8, true), height: v.getUint32(ID_LEN + 12, true), levels: v.getUint32(ID_LEN + 28, true), scheme: v.getUint32(ID_LEN + 32, true) };
}

const align = (n, a) => Math.ceil(n / a) * a;

export function dropLevels(bytes, n) {
  if (!n) return bytes;
  const src = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const { width, height, levels, scheme } = ktx2Info(bytes);
  if (scheme === BASIS_LZ) throw new Error('dropLevels: BasisLZ keeps global data a level; only none or zstd');
  if (n >= levels) throw new Error(`dropLevels: ${n} of ${levels} levels`);
  const u64 = (o) => Number(src.getBigUint64(o, true));
  const dfd = [src.getUint32(HEADER, true), src.getUint32(HEADER + 4, true)];
  const kvd = [src.getUint32(HEADER + 8, true), src.getUint32(HEADER + 12, true)];
  const kept = [];
  for (let i = n; i < levels; i++) {
    const at = INDEX + i * 24;
    kept.push({ offset: u64(at), length: u64(at + 8), raw: u64(at + 16) });
  }
  const count = kept.length;
  // the new layout: header, index, level index, DFD, KVD, then the levels
  // (smallest first, as the spec stores them), each 8-aligned
  let at = INDEX + count * 24;
  const dfdAt = at;
  at += dfd[1];
  const kvdAt = kvd[1] ? align(at, 4) : 0;
  if (kvd[1]) at = kvdAt + kvd[1];
  const places = new Array(count);
  for (let i = count - 1; i >= 0; i--) {
    at = align(at, 8);
    places[i] = at;
    at += kept[i].length;
  }
  const out = new Uint8Array(at);
  const dst = new DataView(out.buffer);
  out.set(bytes.subarray(0, HEADER));
  dst.setUint32(ID_LEN + 8, Math.max(1, width >> n), true);
  dst.setUint32(ID_LEN + 12, height ? Math.max(1, height >> n) : 0, true);
  dst.setUint32(ID_LEN + 28, count, true);
  dst.setUint32(HEADER, dfdAt, true);
  dst.setUint32(HEADER + 4, dfd[1], true);
  dst.setUint32(HEADER + 8, kvdAt, true);
  dst.setUint32(HEADER + 12, kvd[1], true);
  dst.setBigUint64(HEADER + 16, 0n, true); // (no supercompression global data: none or zstd)
  dst.setBigUint64(HEADER + 24, 0n, true);
  kept.forEach((l, i) => {
    const e = INDEX + i * 24;
    dst.setBigUint64(e, BigInt(places[i]), true);
    dst.setBigUint64(e + 8, BigInt(l.length), true);
    dst.setBigUint64(e + 16, BigInt(l.raw), true);
    out.set(bytes.subarray(l.offset, l.offset + l.length), places[i]);
  });
  out.set(bytes.subarray(dfd[0], dfd[0] + dfd[1]), dfdAt);
  if (kvd[1]) out.set(bytes.subarray(kvd[0], kvd[0] + kvd[1]), kvdAt);
  return out;
}
