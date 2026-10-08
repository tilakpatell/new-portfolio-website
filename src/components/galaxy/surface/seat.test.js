import { describe, expect, it } from 'vitest';
import { seatY } from './seat';

describe('a thing seated on the ground', () => {
  it('stands at the ground under it on the flat', () => {
    expect(seatY(() => 4, 10, -3, 2.5)).toBe(4);
  });

  it('sinks to the lowest ground under its footprint on a slope, so no side floats', () => {
    // (rising 1 m every 2 m east: 2 m out to the west it's 1 m lower)
    expect(seatY((x) => x / 2, 0, 0, 2)).toBeCloseTo(-1, 6);
  });

  it('goes no deeper than `max` under the middle, on a cliff', () => {
    expect(seatY((x) => x * 5, 0, 0, 2, { max: 1.5 })).toBeCloseTo(-1.5, 6);
  });

  it('is the ground at its middle for something with no footprint', () => {
    expect(seatY((x) => x / 2, 3, 0, 0)).toBeCloseTo(1.5, 6);
  });
});
