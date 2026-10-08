import { describe, expect, it } from 'vitest';
import { createGesture } from './gesture';

const R = { left: 0, top: 0, width: 600, height: 600 };

describe('gesture', () => {
  it('a drag pans by the share of the box it moved, and swallows the click it ends with', () => {
    const g = createGesture();
    g.down(1, 300, 300, R);
    expect(g.move(1, 303, 300, R)).toBeNull(); // (under DRAG: still a click)
    const m = g.move(1, 360, 300, R);
    expect(m.pan[0]).toBeCloseTo(60 / 600);
    expect(m.pan[1]).toBeCloseTo(0);
    g.up(1);
    expect(g.takeClick()).toBe(true);
    expect(g.takeClick()).toBe(false);
  });
  it('a press that barely moves is a click', () => {
    const g = createGesture();
    g.down(1, 300, 300, R);
    expect(g.move(1, 302, 301, R)).toBeNull();
    g.up(1);
    expect(g.takeClick()).toBe(false);
  });
  it('two fingers pinch about their middle', () => {
    const g = createGesture();
    g.down(1, 200, 300, R);
    g.down(2, 400, 300, R);
    const m = g.move(2, 500, 300, R);
    expect(m.zoom).toBeCloseTo(300 / 200);
    expect(m.u).toBeCloseTo(0.5);
    expect(m.w).toBeCloseTo(0.5);
    g.up(2);
    g.up(1);
    expect(g.takeClick()).toBe(true); // (a pinch never picks a system)
  });
  it('the finger left after a pinch pans from where it is, not from where it first went down', () => {
    const g = createGesture();
    g.down(1, 200, 300, R);
    g.down(2, 400, 300, R);
    g.move(1, 100, 300, R); // (finger 1 travelled 100 px in the pinch)
    g.up(2);
    expect(g.move(1, 101, 300, R)).toBeNull(); // (1 px: nothing yet, and no jump back to the first press)
    const m = g.move(1, 131, 300, R);
    expect(m.pan[0]).toBeCloseTo(31 / 600);
    g.up(1);
    expect(g.takeClick()).toBe(true);
  });
  it('a cancelled press forgets itself', () => {
    const g = createGesture();
    g.down(1, 300, 300, R);
    g.cancel(1);
    expect(g.move(1, 400, 300, R)).toBeNull();
  });
});
