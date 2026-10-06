import { describe, expect, it } from 'vitest';
import { decodeTga } from './tga.mjs';

// a .tga written by hand: the 18-byte header, then the pixels (BGR or BGRA)
const header = ({ type, width, height, depth, topDown = false, idLength = 0 }) => {
  const h = new Uint8Array(18);
  h[0] = idLength;
  h[2] = type;
  h[12] = width & 255;
  h[13] = width >> 8;
  h[14] = height & 255;
  h[15] = height >> 8;
  h[16] = depth;
  h[17] = (topDown ? 0x20 : 0) | (depth === 32 ? 8 : 0);
  return h;
};
const tga = (opts, ...parts) => {
  const all = [header(opts), ...parts.map((p) => new Uint8Array(p))];
  const out = new Uint8Array(all.reduce((n, a) => n + a.length, 0));
  let at = 0;
  for (const a of all) {
    out.set(a, at);
    at += a.length;
  }
  return out;
};

describe('a Targa image', () => {
  it('reads plain 24-bit pixels, BGR to RGBA, and turns bottom-up rows over', () => {
    // 2 × 2: the file's first row is the bottom row: red, green; its second row (the top): blue, white
    const img = decodeTga(tga({ type: 2, width: 2, height: 2, depth: 24 }, [0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255]));
    expect([img.width, img.height]).toEqual([2, 2]);
    expect([...img.data.slice(0, 8)]).toEqual([0, 0, 255, 255, 255, 255, 255, 255]); // the top row drawn first: blue, white
    expect([...img.data.slice(8, 16)]).toEqual([255, 0, 0, 255, 0, 255, 0, 255]); // then red, green
  });

  it('keeps the alpha of 32-bit pixels and a top-down flag', () => {
    const img = decodeTga(tga({ type: 2, width: 1, height: 2, depth: 32, topDown: true }, [10, 20, 30, 40, 50, 60, 70, 80]));
    expect([...img.data]).toEqual([30, 20, 10, 40, 70, 60, 50, 80]);
  });

  it('unpacks run-length packets, runs and raw alike', () => {
    // 3 × 1, top-down: a run of two red, then one raw green
    const img = decodeTga(tga({ type: 10, width: 3, height: 1, depth: 24, topDown: true }, [0x81, 0, 0, 255, 0x00, 0, 255, 0]));
    expect([...img.data]).toEqual([255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255]);
  });

  it('reads greyscale, and skips an image id', () => {
    const img = decodeTga(tga({ type: 3, width: 2, height: 1, depth: 8, topDown: true, idLength: 3 }, [1, 2, 3], [0, 200]));
    expect([...img.data]).toEqual([0, 0, 0, 255, 200, 200, 200, 255]);
  });

  it('refuses what it can’t read, plainly', () => {
    expect(() => decodeTga(new Uint8Array(4))).toThrow(/too short/);
    expect(() => decodeTga(tga({ type: 1, width: 1, height: 1, depth: 8 }, [0]))).toThrow(/type 1/);
    expect(() => decodeTga(tga({ type: 2, width: 4, height: 4, depth: 24 }, [0, 0, 0]))).toThrow(/past the end/);
  });
});
