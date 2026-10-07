import { describe, expect, it } from 'vitest';
import { DAY, celestial, daylight, lightmap, moonPhase, skyColours, skyDarken, starBrightness, sunBrightness, sunrise } from './time';

describe('the day', () => {
  it('a day is 24000 ticks and wraps', () => {
    expect(DAY).toBe(24000);
    expect(celestial(6000 + DAY)).toBeCloseTo(celestial(6000), 10);
    expect(daylight(30000)).toBe(daylight(6000));
  });

  it('the sun is straight up at noon and straight down at midnight, as the game turns it', () => {
    expect(celestial(6000)).toBeCloseTo(0, 10);
    expect(celestial(18000)).toBeCloseTo(0.5, 10);
    // the game eases the sun along: at 0 (sunrise) it's a little past the quarter
    expect(celestial(0)).toBeGreaterThan(0.75);
  });

  it('daylight at noon is 1, at midnight the floor of 4', () => {
    expect(daylight(6000)).toBe(1);
    expect(skyDarken(6000)).toBe(0);
    expect(skyDarken(18000)).toBe(11);
    expect(daylight(18000)).toBeCloseTo(4 / 15, 10);
  });

  it('is full day from 1000 to 11000 and darkens at dusk', () => {
    for (const t of [1000, 3000, 9000, 11000]) expect(daylight(t), t).toBe(1);
    expect(daylight(13000)).toBeLessThan(1);
    expect(daylight(13800)).toBeLessThan(daylight(12500));
    expect(daylight(23500)).toBeGreaterThan(daylight(22000));
  });

  it('the sun’s brightness for the light: 1 at noon, the game’s 0.2 at night', () => {
    expect(sunBrightness(6000)).toBeCloseTo(1, 5);
    expect(sunBrightness(18000)).toBeCloseTo(0.2, 5);
  });

  it('the lightmap: full sky at noon is white, torchlight is warm, the night sky blue-grey', () => {
    const noon = lightmap(15, 0, sunBrightness(6000));
    expect(noon.map((c) => Math.round(c * 100) / 100)).toEqual([0.99, 0.99, 0.99]);
    const torch = lightmap(0, 10, sunBrightness(18000)); // (at 13 and up the game's sum is white: it clamps)
    expect(torch[0]).toBeGreaterThan(torch[2]);
    const moon = lightmap(15, 0, sunBrightness(18000));
    expect(moon[2]).toBeGreaterThan(moon[0]);
    expect(lightmap(0, 0, 1)).toEqual([0.03, 0.03, 0.03]);
  });

  it('moon phase advances each day', () => {
    expect(moonPhase(6000)).toBe(0);
    expect(moonPhase(6000 + DAY)).toBe(1);
    expect(moonPhase(6000 + 8 * DAY)).toBe(0);
  });

  it('the sky is the biome’s colour at noon and near black at midnight', () => {
    const noon = skyColours(6000, [0.47, 0.65, 1], 10);
    expect(noon.sky).toEqual([0.47, 0.65, 1]);
    const night = skyColours(18000, [0.47, 0.65, 1], 10);
    expect(Math.max(...night.sky)).toBeLessThan(0.05);
    expect(Math.max(...night.fog)).toBeLessThan(0.15);
  });

  it('the stars come out at night and go by day', () => {
    expect(starBrightness(6000)).toBe(0);
    expect(starBrightness(18000)).toBeCloseTo(0.5, 5);
  });

  it('sunrise and sunset glow orange low in the sky; none at noon', () => {
    expect(sunrise(6000)).toBeNull();
    const dusk = sunrise(12500);
    expect(dusk).not.toBeNull();
    expect(dusk[0]).toBeGreaterThan(dusk[2]);
    expect(dusk[3]).toBeGreaterThan(0);
  });
});
