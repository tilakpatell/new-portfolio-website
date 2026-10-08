import { describe, expect, it } from 'vitest';
import { PALETTE, distinct, tint } from './palette';

const NAMES = ['sky', 'nebula', 'star', 'sun', 'bone', 'grey', 'engine', 'shot', 'ink'];
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe('the palette', () => {
  it('has the nine names', () => {
    expect(Object.keys(PALETTE).sort()).toEqual([...NAMES].sort());
  });

  it("gives each colour's linear as its hex brought out of sRGB", () => {
    for (const { hex, linear } of Object.values(PALETTE)) {
      const want = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
      linear.forEach((c, i) => expect(c).toBeCloseTo(want[i], 3));
    }
  });

  it('keeps every pair at least 0.15 apart in OKLab', () => {
    for (let i = 0; i < NAMES.length; i++) {
      for (let j = i + 1; j < NAMES.length; j++) {
        expect(distinct(PALETTE[NAMES[i]].linear, PALETTE[NAMES[j]].linear), `${NAMES[i]} and ${NAMES[j]}`).toBeGreaterThanOrEqual(0.15);
      }
    }
  });

  it('makes the sky the darkest', () => {
    const sky = luminance(PALETTE.sky.linear);
    for (const n of NAMES.filter((n) => n !== 'sky')) expect(luminance(PALETTE[n].linear)).toBeGreaterThan(sky);
  });

  it('tints toward white', () => {
    expect(tint('sky', 1)).toEqual([1, 1, 1]);
    expect(tint('bone', 0)).toEqual(PALETTE.bone.linear);
    const half = tint('grey', 0.5);
    half.forEach((c, i) => expect(c).toBeCloseTo((PALETTE.grey.linear[i] + 1) / 2, 6));
  });

  it('measures no distance from a colour to itself', () => {
    expect(distinct(PALETTE.sun.linear, PALETTE.sun.linear)).toBe(0);
  });
});
