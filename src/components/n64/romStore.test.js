import { describe, expect, it } from 'vitest';
import { romInfo, toZ64 } from './romStore';

// a cartridge header: the magic word, then the title at 0x20, in .z64 order
function z64(title = 'SUPER MARIO 64', size = 0x1000) {
  const b = new Uint8Array(size);
  b.set([0x80, 0x37, 0x12, 0x40], 0);
  for (let i = 0; i < 20; i++) b[0x20 + i] = i < title.length ? title.charCodeAt(i) : 0x20;
  return b;
}
// the same bytes as the two other dumps have them
const v64 = (b) => b.map((_, i) => b[i ^ 1]); // pairs swapped
const n64 = (b) => b.map((_, i) => b[(i & ~3) + 3 - (i & 3)]); // each word reversed

describe('an N64 ROM file', () => {
  it('is read in any of the three byte orders dumps come in', () => {
    const base = z64();
    expect(romInfo(base)).toMatchObject({ format: 'z64', title: 'SUPER MARIO 64' });
    expect(romInfo(v64(base))).toMatchObject({ format: 'v64', title: 'SUPER MARIO 64' });
    expect(romInfo(n64(base))).toMatchObject({ format: 'n64', title: 'SUPER MARIO 64' });
  });

  it('comes back in .z64 order from any of them', () => {
    const base = z64('SOME GAME');
    expect([...toZ64(v64(base))]).toEqual([...base]);
    expect([...toZ64(n64(base))]).toEqual([...base]);
    expect(toZ64(base)).toBe(base);
  });

  it('says whether it’s Super Mario 64', () => {
    expect(romInfo(z64()).mario).toBe(true);
    expect(romInfo(z64('CPU TEST CPU ADD')).mario).toBe(false);
  });

  it('is nothing when it isn’t an N64 ROM', () => {
    expect(romInfo(new Uint8Array(0x1000))).toBeNull();
    expect(romInfo(new Uint8Array(8))).toBeNull();
    expect(romInfo(new TextEncoder().encode('PK\u0003\u0004 a zip, not a ROM'.padEnd(0x100)))).toBeNull();
  });
});
