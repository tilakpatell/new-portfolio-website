// What a GLB's textures cost on the GPU, read from the file alone: each
// embedded image's width and height from its own header (PNG, JPEG, WebP),
// as RGBA8 with a full mip chain (four thirds of the top level), which is
// how three.js uploads a decoded image. Pure, no three, no canvas: a test
// holds a model to the texture contract (docs/superpowers/specs/
// 2026-10-10-battlefront-2017-asset-pipeline-design.md, section 6: 256 MB a
// world on desktop, 128 MB on a phone) without a browser.
//
//   imageSize(bytes) → { width, height } | null
//   glbTextures(buffer) → { images: [{ width, height }], gpuBytes }

export function imageSize(b) {
  if (b.length < 30) return null;
  // PNG: IHDR right after the signature
  if (b[0] === 0x89 && b[1] === 0x50) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  // WebP: RIFF....WEBP then VP8 (lossy), VP8L (lossless) or VP8X (extended)
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (kind === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') {
      const v = b.readUInt32LE(21);
      return { width: (v & 0x3fff) + 1, height: ((v >> 14) & 0x3fff) + 1 };
    }
    return null;
  }
  // JPEG: the first start-of-frame marker
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length; ) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  return null;
}

export function glbTextures(buf) {
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const bin = buf.subarray(20 + jsonLen + 8);
  const images = (json.images ?? []).map((im) => {
    if (im.bufferView == null) return null;
    const bv = json.bufferViews[im.bufferView];
    const start = bv.byteOffset ?? 0;
    return imageSize(bin.subarray(start, start + bv.byteLength));
  });
  const gpuBytes = images.reduce((n, s) => n + (s ? (s.width * s.height * 4 * 4) / 3 : 0), 0);
  return { images, gpuBytes };
}
