import { describe, expect, it } from 'vitest';
import { cullLabels } from './labels';

describe('which names show at a zoom', () => {
  it('shows only the first of two names too close together', () => {
    expect(cullLabels([{ id: 'a', x: 0, y: 0, on: true }, { id: 'b', x: 30, y: 40, on: true }])).toEqual(new Set(['a']));
  });
  it('shows both when they’re far enough apart', () => {
    expect(cullLabels([{ id: 'a', x: 0, y: 0, on: true }, { id: 'b', x: 80, y: 0, on: true }])).toEqual(new Set(['a', 'b']));
  });
  it('measures from shown names only, so a hidden one hides nothing', () => {
    const points = [
      { id: 'a', x: 0, y: 0, on: true },
      { id: 'b', x: 50, y: 0, on: true },
      { id: 'c', x: 100, y: 0, on: true },
    ];
    expect(cullLabels(points)).toEqual(new Set(['a', 'c']));
  });
  it('never shows a name that’s off, and an off one never hides another', () => {
    const points = [
      { id: 'a', x: 0, y: 0, on: false },
      { id: 'b', x: 10, y: 0, on: true },
    ];
    expect(cullLabels(points)).toEqual(new Set(['b']));
  });
  it('takes its own spacing', () => {
    expect(cullLabels([{ id: 'a', x: 0, y: 0, on: true }, { id: 'b', x: 50, y: 0, on: true }], 40)).toEqual(new Set(['a', 'b']));
  });
  it('gives nothing for nothing', () => {
    expect(cullLabels([])).toEqual(new Set());
  });
});
