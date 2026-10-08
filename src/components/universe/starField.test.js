import { describe, expect, it } from 'vitest';
import { RECORD, decodeStars, encodeStar, skyDir } from './starCatalog';
import { STAR_RADIUS, createStarField, starBrightness } from './starField';

describe('starBrightness', () => {
  it('falls with magnitude, the faintest the naked eye sees still seen', () => {
    expect(starBrightness(6)).toBeCloseTo(0.25, 2);
    expect(starBrightness(10)).toBeGreaterThan(0.01);
    expect(starBrightness(0)).toBeGreaterThan(starBrightness(1));
  });
  it('keeps the catalogue faintest well under the naked eye, so they do not crowd the sky', () => {
    expect(starBrightness(10) / starBrightness(6)).toBeLessThan(0.1);
  });
  it('holds the very brightest back, so Sirius is a star and not a lamp', () => {
    expect(starBrightness(-1.46)).toBeLessThan(15);
    expect(starBrightness(-1.46)).toBeGreaterThan(starBrightness(0));
  });
  it('puts only the brightest few over the bloom threshold (post.js, 1.7)', () => {
    expect(starBrightness(-1.46)).toBeGreaterThan(1.7); // Sirius
    expect(starBrightness(2)).toBeGreaterThan(1.7);
    expect(starBrightness(3.5)).toBeLessThan(1.7);
  });
});

describe('createStarField', () => {
  const catalog = () => {
    const buf = new Uint8Array(3 * RECORD);
    encodeStar(buf, 0, skyDir(0, 0), -1, 0);
    encodeStar(buf, 1, skyDir(90, 10), 4, 0.65);
    encodeStar(buf, 2, skyDir(200, -40), 9, 1.6);
    return decodeStars(buf.buffer);
  };
  it('draws every star, out at the star radius, brightest first', () => {
    const field = createStarField(catalog());
    const pos = field.geometry.getAttribute('position');
    expect(pos.count).toBe(3);
    expect(Math.hypot(pos.getX(1), pos.getY(1), pos.getZ(1))).toBeCloseTo(STAR_RADIUS, 0);
    const b = field.geometry.getAttribute('aBright');
    expect(b.getX(0)).toBeGreaterThan(b.getX(1));
    expect(b.getX(1)).toBeGreaterThan(b.getX(2));
  });
  it('is empty, not broken, with no catalogue', () => {
    expect(createStarField(null).geometry.getAttribute('position').count).toBe(0);
  });
});
