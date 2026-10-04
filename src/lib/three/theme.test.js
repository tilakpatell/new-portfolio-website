import { describe, expect, it } from 'vitest';
import { mix, parseColor } from './theme';

describe('parseColor', () => {
  it('reads hex in long and short forms', () => {
    expect(parseColor('#ff9900')).toEqual([255, 153, 0]);
    expect(parseColor('#f90')).toEqual([255, 153, 0]);
    expect(parseColor(' #0F1111 ')).toEqual([15, 17, 17]);
  });

  it('reads rgb() and rgba() as the browser computes them', () => {
    expect(parseColor('rgb(255, 153, 0)')).toEqual([255, 153, 0]);
    expect(parseColor('rgba(9, 9, 11, 0.5)')).toEqual([9, 9, 11]);
  });

  it('reads color(srgb …), which color-mix() computes to', () => {
    expect(parseColor('color(srgb 1 0.6 0)')).toEqual([255, 153, 0]);
    expect(parseColor('color(srgb 0.5 0.5 0.5 / 0.4)')).toEqual([128, 128, 128]);
  });

  it('gives up on what it cannot read, so the canvas fallback can try', () => {
    expect(parseColor('oklch(0.7 0.15 60)')).toBeNull();
    expect(parseColor('')).toBeNull();
    expect(parseColor('#zzz')).toBeNull();
    expect(parseColor(undefined)).toBeNull();
  });
});

describe('mix', () => {
  it('blends two colours', () => {
    expect(mix([0, 0, 0], [255, 255, 255], 0.5)).toEqual([128, 128, 128]);
    expect(mix([10, 20, 30], [10, 20, 30], 0.3)).toEqual([10, 20, 30]);
  });
});
