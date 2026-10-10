// A level's light probe from the 2017 drop, made the site's: the game keeps
// each reflection volume as six 128² Radiance faces in its own light units
// (Frostbite's: a cloudy sky over Hoth's plain averages about a hundred),
// and the site wants them where its own sky dome's light sits (a mean
// near 0.8), at the size its quality level loads (src/lib/three/levelSky.js).
//
// encodeRgbe({ data: Float32 RGBA, width, height }) → a .hdr Buffer (run-
//   length scanlines, as three's HDRLoader reads them)
// halve(face) → the face at half its size, each 2 × 2 averaged
// normalise(faces, mean) → new faces scaled so their mean light is `mean`
// luminance(data, i) → texel i's light (Rec. 709)

export const luminance = (d, i) => 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];

// one texel's RGBE: a shared exponent, each channel's 8-bit mantissa
function rgbe(r, g, b, out, at) {
  const v = Math.max(r, g, b);
  if (v < 1e-32) {
    out[at] = out[at + 1] = out[at + 2] = out[at + 3] = 0;
    return;
  }
  const e = Math.ceil(Math.log2(v) + 1e-9);
  const k = 256 / 2 ** e;
  out[at] = Math.min(255, Math.floor(r * k));
  out[at + 1] = Math.min(255, Math.floor(g * k));
  out[at + 2] = Math.min(255, Math.floor(b * k));
  out[at + 3] = e + 128;
}

export function encodeRgbe({ data, width, height }) {
  const head = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`, 'ascii');
  const parts = [head];
  const line = new Uint8Array(width * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      rgbe(data[i], data[i + 1], data[i + 2], line, x * 4);
    }
    // (the run-length form, every channel as plain runs of up to 128: a flat
    // scanline whose first texel happened to read 2, 2 would be taken for
    // a run-length one)
    const out = [2, 2, width >> 8, width & 255];
    for (let c = 0; c < 4; c++)
      for (let x = 0; x < width; x += 128) {
        const n = Math.min(128, width - x);
        out.push(n);
        for (let k = 0; k < n; k++) out.push(line[(x + k) * 4 + c]);
      }
    parts.push(Buffer.from(out));
  }
  return Buffer.concat(parts);
}

export function halve({ data, width, height }) {
  const w = width >> 1;
  const h = height >> 1;
  const out = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 4; c++) {
        let s = 0;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) s += data[((y * 2 + dy) * width + x * 2 + dx) * 4 + c];
        out[(y * w + x) * 4 + c] = s / 4;
      }
  return { data: out, width: w, height: h };
}

export function normalise(faces, mean = 0.8) {
  let sum = 0;
  let n = 0;
  for (const f of faces)
    for (let i = 0; i < f.width * f.height; i++) {
      sum += luminance(f.data, i);
      n++;
    }
  const k = sum > 0 ? (mean * n) / sum : 1;
  return faces.map((f) => {
    const data = new Float32Array(f.data);
    for (let i = 0; i < data.length; i++) if (i % 4 !== 3) data[i] *= k;
    return { ...f, data };
  });
}
