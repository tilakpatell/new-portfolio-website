// A KTX2 made smaller without encoding it again: its mip levels are already
// in the file, so dropping the first n leaves the same texture at half the
// size n times over, every byte the encoder wrote kept (lane L's level packs
// take the bucket's KTX2 per tier this way: 512 low, 1024 mid and high, 2048
// ultra). The header and the level index are rewritten; an ETC1S file's
// global data loses the image descriptors of the levels that went (its
// codebooks stay, shared by every level).
//
//   ktx2Info(buf) → { width, height, levels, scheme, levelIndex, dfd, kvd, sgd }
//   dropMips(buf, n) → Buffer
//   mipsToFit(width, size) → n

const ID = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a];
const BASIS_LZ = 1;
const IMAGE_DESC = 20;

export function ktx2Info(buf) {
  if (ID.some((b, i) => buf[i] !== b)) throw new Error('not a KTX2');
  const levels = Math.max(1, buf.readUInt32LE(40));
  const levelIndex = Array.from({ length: levels }, (_, l) => ({
    offset: Number(buf.readBigUInt64LE(80 + l * 24)),
    length: Number(buf.readBigUInt64LE(88 + l * 24)),
    raw: Number(buf.readBigUInt64LE(96 + l * 24)),
  }));
  return {
    width: buf.readUInt32LE(20),
    height: buf.readUInt32LE(24),
    depth: buf.readUInt32LE(28),
    layers: buf.readUInt32LE(32),
    faces: buf.readUInt32LE(36),
    levels,
    scheme: buf.readUInt32LE(44),
    levelIndex,
    dfd: { offset: buf.readUInt32LE(48), length: buf.readUInt32LE(52) },
    kvd: { offset: buf.readUInt32LE(56), length: buf.readUInt32LE(60) },
    sgd: { offset: Number(buf.readBigUInt64LE(64)), length: Number(buf.readBigUInt64LE(72)) },
  };
}

// (a level's images: one for each layer, face and slice)
const imagesPer = (i, level) => Math.max(1, i.layers) * i.faces * Math.max(1, i.depth >> level);

export function dropMips(buf, n) {
  if (!n) return buf;
  const i = ktx2Info(buf);
  if (n >= i.levels) throw new Error(`cannot drop ${n} of ${i.levels} levels`);
  const levels = i.levels - n;
  const dfd = buf.subarray(i.dfd.offset, i.dfd.offset + i.dfd.length);
  const kvd = buf.subarray(i.kvd.offset, i.kvd.offset + i.kvd.length);
  let sgd = buf.subarray(i.sgd.offset, i.sgd.offset + i.sgd.length);
  if (i.scheme === BASIS_LZ && sgd.length) {
    let skip = 0;
    let all = 0;
    for (let l = 0; l < i.levels; l++) {
      if (l < n) skip += imagesPer(i, l);
      all += imagesPer(i, l);
    }
    const head = 20;
    sgd = Buffer.concat([sgd.subarray(0, head), sgd.subarray(head + skip * IMAGE_DESC, head + all * IMAGE_DESC), sgd.subarray(head + all * IMAGE_DESC)]);
  }
  const header = Buffer.from(buf.subarray(0, 80 + levels * 24));
  header.writeUInt32LE(Math.max(1, i.width >> n), 20);
  header.writeUInt32LE(i.height ? Math.max(1, i.height >> n) : 0, 24);
  header.writeUInt32LE(i.depth ? Math.max(1, i.depth >> n) : 0, 28);
  header.writeUInt32LE(levels, 40);
  const parts = [header];
  let at = header.length;
  const place = (b) => {
    const o = b.length ? at : 0;
    parts.push(b);
    at += b.length;
    return o;
  };
  header.writeUInt32LE(place(dfd), 48);
  header.writeUInt32LE(dfd.length, 52);
  header.writeUInt32LE(kvd.length ? place(kvd) : 0, 56);
  header.writeUInt32LE(kvd.length, 60);
  // (the global data starts on an 8-byte boundary)
  const pad8 = (at + 7) & ~7;
  if (sgd.length && pad8 > at) place(Buffer.alloc(pad8 - at));
  header.writeBigUInt64LE(BigInt(sgd.length ? place(sgd) : 0), 64);
  header.writeBigUInt64LE(BigInt(sgd.length), 72);
  // the levels smallest first, as the format lays them out, each on a 16-byte
  // boundary (a multiple of every block size and of 4)
  for (let l = i.levels - 1; l >= n; l--) {
    const src = i.levelIndex[l];
    const pad = ((at + 15) & ~15) - at;
    if (pad) place(Buffer.alloc(pad));
    const k = l - n;
    header.writeBigUInt64LE(BigInt(place(buf.subarray(src.offset, src.offset + src.length))), 80 + k * 24);
    header.writeBigUInt64LE(BigInt(src.length), 88 + k * 24);
    header.writeBigUInt64LE(BigInt(src.raw), 96 + k * 24);
  }
  return Buffer.concat(parts);
}

export function mipsToFit(width, size) {
  let n = 0;
  while (width >> n > size) n++;
  return n;
}
