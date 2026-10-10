// A 16-bit greyscale PNG's values (a level pack's heightmaps). The browser's
// own decoders give 8 bits a channel through a canvas, which would step the
// game's ground in 4 m stairs at a 1,024 m height scale; this reads the
// file's 16 bits with the platform's inflate (DecompressionStream, in every
// browser the site supports and in Node). Pure apart from that.
//
//   decodePng16(bytes: Uint8Array) → Promise<{ data: Uint16Array, w, h }>

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function decodePng16(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < 8 || SIGNATURE.some((v, i) => b[i] !== v)) throw new Error('not a PNG');
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let w = 0;
  let h = 0;
  const idat = [];
  for (let o = 8; o + 8 <= b.length; ) {
    const len = view.getUint32(o);
    const type = String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]);
    const data = b.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      w = view.getUint32(o + 8);
      h = view.getUint32(o + 12);
      if (data[8] !== 16 || data[9] !== 0 || data[12] !== 0) throw new Error('not a 16-bit grey PNG (interlaced or colour)');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  const z = new Uint8Array(idat.reduce((n, d) => n + d.length, 0));
  let at = 0;
  for (const d of idat) {
    z.set(d, at);
    at += d.length;
  }
  const raw = await inflate(z);
  const stride = w * 2;
  const out = new Uint16Array(w * h);
  const prev = new Uint8Array(stride);
  const row = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const base = y * (stride + 1);
    const f = raw[base];
    for (let i = 0; i < stride; i++) {
      const x = raw[base + 1 + i];
      const a = i >= 2 ? row[i - 2] : 0;
      const up = prev[i];
      const c = i >= 2 ? prev[i - 2] : 0;
      let p = 0;
      if (f === 1) p = a;
      else if (f === 2) p = up;
      else if (f === 3) p = (a + up) >> 1;
      else if (f === 4) {
        const q = a + up - c;
        const pa = Math.abs(q - a);
        const pb = Math.abs(q - up);
        const pc = Math.abs(q - c);
        p = pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      }
      row[i] = (x + p) & 0xff;
    }
    for (let i = 0; i < w; i++) out[y * w + i] = (row[i * 2] << 8) | row[i * 2 + 1];
    prev.set(row);
  }
  return { data: out, w, h };
}
