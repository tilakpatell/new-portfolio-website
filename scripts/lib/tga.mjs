// A Targa image (.tga, what the Battlefront II mod tools and the remaster's
// textures come as) read into RGBA pixels, top row first: uncompressed and
// run-length true colour (types 2 and 10) at 24 or 32 bits, and greyscale
// (types 3 and 11) at 8; the origin flag honoured (rows stored bottom-up
// are turned over). Pure; tested in tga.test.mjs.
//
//   decodeTga(Buffer | Uint8Array) → { width, height, data: Uint8Array (RGBA) }

export function decodeTga(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (b.length < 18) throw new Error('tga: too short for a header');
  const idLength = b[0];
  const colourMapType = b[1];
  const type = b[2];
  const colourMapLength = b[5] | (b[6] << 8);
  const colourMapDepth = b[7];
  const width = b[12] | (b[13] << 8);
  const height = b[14] | (b[15] << 8);
  const depth = b[16];
  const descriptor = b[17];
  const topDown = (descriptor & 0x20) !== 0;
  const rightToLeft = (descriptor & 0x10) !== 0;
  if (![2, 3, 10, 11].includes(type)) throw new Error(`tga: image type ${type} isn't read (true colour or greyscale, plain or run-length)`);
  if (!((type === 2 || type === 10) && (depth === 24 || depth === 32)) && !((type === 3 || type === 11) && depth === 8)) throw new Error(`tga: ${depth} bits a pixel isn't read for type ${type}`);
  const bytes = depth / 8;
  let at = 18 + idLength + (colourMapType ? colourMapLength * Math.ceil(colourMapDepth / 8) : 0);
  const n = width * height;
  const data = new Uint8Array(n * 4);
  const put = (i, p) => {
    // (stored bottom-up unless the flag says: row 0 of the file is the last row drawn)
    const row = Math.floor(i / width);
    const col = i % width;
    const y = topDown ? row : height - 1 - row;
    const x = rightToLeft ? width - 1 - col : col;
    const o = (y * width + x) * 4;
    if (bytes === 1) {
      data[o] = data[o + 1] = data[o + 2] = b[p];
      data[o + 3] = 255;
    } else {
      data[o] = b[p + 2];
      data[o + 1] = b[p + 1];
      data[o + 2] = b[p];
      data[o + 3] = bytes === 4 ? b[p + 3] : 255;
    }
  };
  if (type === 2 || type === 3) {
    if (at + n * bytes > b.length) throw new Error('tga: the pixels run past the end of the file');
    for (let i = 0; i < n; i++) put(i, at + i * bytes);
  } else {
    // run-length: a packet byte, its high bit a run (one pixel repeated) and its low seven the count less one
    let i = 0;
    while (i < n) {
      if (at >= b.length) throw new Error('tga: the run-length packets run past the end of the file');
      const packet = b[at++];
      const count = (packet & 0x7f) + 1;
      if (packet & 0x80) {
        for (let k = 0; k < count && i < n; k++) put(i++, at);
        at += bytes;
      } else {
        for (let k = 0; k < count && i < n; k++) {
          put(i++, at);
          at += bytes;
        }
      }
    }
  }
  return { width, height, data };
}
