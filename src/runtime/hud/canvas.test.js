import { describe, expect, it } from 'vitest';
import { fitCanvas } from './canvas';

const canvas = (w, h) => ({ clientWidth: w, clientHeight: h, width: 300, height: 150 });

describe('a HUD canvas', () => {
  it('has the screen’s pixels under it, up to 3×', () => {
    const c = canvas(150, 150);
    expect(fitCanvas(c, null, 2)).toEqual({ w: 150, h: 150, s: 2 });
    expect([c.width, c.height]).toEqual([300, 300]);
    fitCanvas(c, null, 4);
    expect(c.width).toBe(450);
  });
  it('keeps a 150-unit drawing 150 units at any size', () => {
    expect(fitCanvas(canvas(96, 96), 150, 2)).toEqual({ w: 150, h: 150, s: 192 / 150 });
  });
  it('is nothing while hidden', () => {
    expect(fitCanvas(canvas(0, 0), 150, 2)).toBe(null);
    expect(fitCanvas(null)).toBe(null);
  });
});
