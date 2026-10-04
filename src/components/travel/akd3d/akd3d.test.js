import { describe, expect, it } from 'vitest';
import { clockAt, minutesOf, settleMs, valueText } from './day';
import { lerpStats, measure, toneBetween } from './light';

const DAY = [
  { id: 'h-rv-day', time: 'Day' },
  { id: 'h-rv-golden', time: 'Golden hour' },
  { id: 'h-robbinsville', time: 'Sunset' },
];

describe('the clock', () => {
  it('reads a photo’s time as minutes after midnight', () => {
    expect(minutesOf('h-robbinsville')).toBe(18 * 60 + 40);
    expect(minutesOf('nope')).toBeNull();
  });

  it('runs on between stops and labels the nearest one', () => {
    expect(clockAt(DAY, 2)).toEqual({ time: '18:40', label: 'Sunset' });
    expect(clockAt(DAY, 1.5)).toEqual({ time: '18:23', label: 'Sunset' });
    expect(clockAt(DAY, 1.4).label).toBe('Golden hour');
    expect(clockAt(DAY, 0.5).time).toBe('15:18');
  });

  it('clamps off the ends and copes with no clock', () => {
    expect(clockAt(DAY, -3)).toEqual({ time: '12:30', label: 'Day' });
    expect(clockAt(DAY, 9).time).toBe('18:40');
    expect(clockAt([{ id: 'x', time: 'Somewhen' }], 0)).toEqual({ time: '', label: 'Somewhen' });
    expect(clockAt([], 0)).toEqual({ time: '', label: '' });
  });

  it('says it the way a screen reader should', () => {
    expect(valueText(DAY, 2)).toBe('Sunset, 18:40');
    expect(valueText([{ id: 'x', time: 'Somewhen' }], 0)).toBe('Somewhen');
  });

  it('settles a small nudge faster than a long way back', () => {
    expect(settleMs(0.1)).toBeLessThan(settleMs(0.5));
    expect(settleMs(3)).toBe(settleMs(1));
    expect(settleMs(0)).toBeGreaterThan(0);
  });
});

// a w×1 strip of grey pixels at the given sRGB codes
const strip = (codes) => Uint8ClampedArray.from(codes.flatMap((v) => [v, v, v, 255]));

describe('the light in a photo', () => {
  it('orders brightness so the dissolve covers equal areas in equal time', () => {
    const s = measure(strip([0, 64, 128, 255]));
    // a quarter of the photo at each level: the cdf climbs a quarter each time
    expect(s.cdf[0]).toBeLessThan(s.cdf[100]);
    expect(s.cdf[100]).toBeLessThan(s.cdf[200]);
    expect(s.cdf[255]).toBeGreaterThan(200);
    expect(s.cdf[255]).toBeLessThan(255);
    for (let k = 1; k < 256; k++) expect(s.cdf[k]).toBeGreaterThanOrEqual(s.cdf[k - 1]);
  });

  it('keeps a big flat area from owning the whole switch', () => {
    // nine tenths of the photo one shade of night sky, the rest lamps
    const s = measure(strip([...Array(90).fill(8), ...Array(10).fill(230)]));
    // the sky spans a modest share of the switch, not 90% of it
    expect(s.cdf[9] - s.cdf[7]).toBeLessThan(40);
  });

  it('finds a darker photo darker and a flat one flat', () => {
    const bright = measure(strip([200, 220, 240, 250]));
    const dark = measure(strip([10, 20, 30, 40]));
    expect(dark.lum).toBeLessThan(bright.lum);
    expect(measure(strip([90, 90, 90, 90])).spread).toBeCloseTo(0, 5);
  });

  it('grades within a believable range', () => {
    const noon = measure(strip([200, 220, 240, 250]));
    const night = measure(strip([0, 2, 4, 6]));
    const down = toneBetween(noon, night);
    const up = toneBetween(night, noon);
    expect(down.exposure).toBeLessThan(0);
    expect(down.exposure).toBeGreaterThanOrEqual(-3 * Math.LN2);
    expect(up.exposure).toBeLessThanOrEqual(2 * Math.LN2);
    expect(down.contrast).toBeGreaterThanOrEqual(0.7);
    expect(down.contrast).toBeLessThanOrEqual(1.4);
    // grey photos need no white-balance tint
    for (const t of down.tint) expect(Math.abs(t)).toBeLessThan(1e-6);
  });

  it('blends statistics for a frame caught mid-cut', () => {
    const a = { mean: [0, 0, 0], lum: 0, spread: 1 };
    const b = { mean: [2, 4, 6], lum: 2, spread: 3 };
    expect(lerpStats(a, b, 0.5)).toEqual({ mean: [1, 2, 3], lum: 1, spread: 2 });
  });
});
