import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MOODS, shadowFor } from './sky';

const lum = (hex) => {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};

describe('a mood’s shadow colour, where a town gives none', () => {
  it('follows the mood’s sky light: bright by day, dark by night', () => {
    const day = shadowFor(MOODS.day);
    const night = shadowFor(MOODS.night);
    expect(lum(day)).toBeGreaterThan(lum(night) * 3);
  });

  it('keeps the sky’s hue, leaning violet, never grey', () => {
    const c = new THREE.Color(shadowFor({ hemiSky: 0x3355aa, hemi: 1 }));
    expect(c.b).toBeGreaterThan(c.g);
    const hsl = c.getHSL({});
    expect(hsl.s).toBeGreaterThan(0.2);
  });

  it('is the mood’s own where it has one', () => {
    expect(shadowFor(MOODS.day)).toBe(MOODS.day.shadow);
  });
});
