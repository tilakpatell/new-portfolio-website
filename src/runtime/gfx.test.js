import { describe, expect, it, vi } from 'vitest';
import { makeGfx } from './gfx';

// a stand-in renderer that sizes its canvas as three's does (the drawing
// buffer is the size × the pixel ratio, rounded down)
const fakeRenderer = () => {
  const canvas = { width: 300, height: 150 };
  let ratio = 2;
  let size = { w: 300, h: 150 };
  const fit = () => {
    canvas.width = Math.floor(size.w * ratio);
    canvas.height = Math.floor(size.h * ratio);
  };
  return {
    canvas,
    getPixelRatio: () => ratio,
    setPixelRatio: vi.fn((r) => {
      ratio = r;
      fit();
    }),
    setSize: vi.fn((w, h) => {
      size = { w, h };
      fit();
    }),
    dispose: vi.fn(),
  };
};
const make = (opts = {}) => {
  const renderer = fakeRenderer();
  const gfx = makeGfx({ backend: 'webgl', renderer, canvas: renderer.canvas, ...opts });
  return { gfx, renderer };
};
const calls = (renderer) => renderer.setPixelRatio.mock.calls.length + renderer.setSize.mock.calls.length;

describe('makeGfx', () => {
  it('owns the size and the ratio, and sets the renderer to both', () => {
    const { gfx, renderer } = make();
    gfx.setRatio(1.5);
    gfx.setSize(320, 180);
    expect(gfx.ratio).toBe(1.5);
    expect(gfx.size).toEqual({ w: 320, h: 180 });
    expect(renderer.getPixelRatio()).toBe(1.5);
    expect([renderer.canvas.width, renderer.canvas.height]).toEqual([480, 270]);
    // and a resize keeps the ratio it was given
    gfx.setSize(400, 240);
    expect(renderer.getPixelRatio()).toBe(1.5);
    expect([renderer.canvas.width, renderer.canvas.height]).toEqual([600, 360]);
  });

  it('leaves the renderer alone when the drawing buffer would come out the same', () => {
    const { gfx, renderer } = make();
    gfx.setRatio(1.5);
    gfx.setSize(320, 180);
    renderer.setPixelRatio.mockClear();
    renderer.setSize.mockClear();
    gfx.setSize(320, 180);
    gfx.setSize(320.2, 179.8); // (rounded to the same box)
    gfx.setRatio(1.5);
    expect(calls(renderer)).toBe(0);
  });

  it('a new ratio resizes the buffer at the size it has', () => {
    const { gfx, renderer } = make();
    gfx.setRatio(1.5);
    gfx.setSize(320, 180);
    gfx.setRatio(1.275);
    expect(gfx.ratio).toBe(1.275);
    expect([renderer.canvas.width, renderer.canvas.height]).toEqual([408, 229]);
  });

  it("draws no sharper than the graphics chip can hold at that size (`fit`)", () => {
    const side = 4096;
    const fit = vi.fn((w, h, r) => Math.min(r, (side - 0.5) / w, (side - 0.5) / h));
    const { gfx, renderer } = make({ fit });
    gfx.setRatio(2);
    gfx.setSize(3000, 1000);
    expect(fit).toHaveBeenLastCalledWith(3000, 1000, 2);
    expect(renderer.canvas.width).toBeLessThanOrEqual(side);
    expect(renderer.getPixelRatio()).toBeCloseTo(4095.5 / 3000);
    // a smaller box: the ratio asked for again
    gfx.setSize(1000, 600);
    expect(renderer.getPixelRatio()).toBe(2);
    expect(gfx.ratio).toBe(2);
  });
});
