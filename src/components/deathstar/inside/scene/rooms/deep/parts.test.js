import { describe, expect, it } from 'vitest';
import { box, boundsOf, digitRects, flagsOf, onProp, openOf, resolve, stepClose, turnOf } from './parts';

const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

describe('a prop drawn where furnish says it stands', () => {
  it('turns a part drawn facing +z to face the prop’s yaw (0 faces north, a quarter turn faces east)', () => {
    for (const [yaw, fx, fz] of [[0, 0, -1], [Math.PI / 2, 1, 0], [Math.PI, 0, 1], [-Math.PI / 2, -1, 0]]) {
      const [part] = onProp({ x: 10, y: -36, z: -80, yaw }, [box(0.02, 0.02, 0.02, 0, 0, 1, 'trim')]);
      const b = boundsOf([part]);
      expect(near((b.x0 + b.x1) / 2, 10 + fx)).toBe(true);
      expect(near((b.z0 + b.z1) / 2, -80 + fz)).toBe(true);
      expect(near((b.y0 + b.y1) / 2, -36)).toBe(true);
    }
    expect(turnOf(0)).toBeCloseTo(Math.PI);
  });

  it('measures the box round a set of parts', () => {
    const b = boundsOf([box(2, 1, 1, 0, 0.5, 0, 'trim'), box(1, 1, 4, 3, 2, 0, 'black')]);
    expect(b).toMatchObject({ x0: -1, x1: 3.5, y0: 0, y1: 2.5, z0: -2, z1: 2 });
  });

  it('hands a room’s own materials to the parts that name them, and leaves the kit’s roles as they are', () => {
    const own = { digits: { isMaterial: true, name: 'digits' } };
    const parts = resolve([box(1, 1, 1, 0, 0, 0, 'digits'), box(1, 1, 1, 0, 0, 0, 'trim')], own);
    expect(parts[0].mat).toBe(own.digits);
    expect(parts[1].mat).toBe('trim');
  });
});

describe('numbers drawn as lit segments', () => {
  const count = (text) => digitRects(text, 1).rects.length;

  it('lights seven segments for an eight, two for a one and six for a nought', () => {
    expect(count('8')).toBe(7);
    expect(count('1')).toBe(2);
    expect(count('0')).toBe(6);
    expect(count('2187')).toBe(5 + 2 + 7 + 3);
  });

  it('centres the number on x 0 and stands it from y 0 to its height', () => {
    const { rects, w } = digitRects('3263827', 0.2);
    const x0 = Math.min(...rects.map((r) => r.x0));
    const x1 = Math.max(...rects.map((r) => r.x1));
    expect(near(x0, -w / 2) && near(x1, w / 2)).toBe(true);
    expect(Math.min(...rects.map((r) => r.y0))).toBeCloseTo(0);
    expect(Math.max(...rects.map((r) => r.y1))).toBeCloseTo(0.2);
  });

  it('grows wider with every digit, in proportion to its height', () => {
    expect(digitRects('2187', 1).w).toBeGreaterThan(digitRects('21', 1).w);
    expect(digitRects('2187', 2).w).toBeCloseTo(2 * digitRects('2187', 1).w);
  });

  it('skips what isn’t a digit, keeping its place', () => {
    expect(digitRects('AA-23', 1).rects.length).toBe(1 + 5 + 5);
    expect(digitRects('', 1)).toEqual({ rects: [], w: 0 });
  });
});

describe('the compactor’s walls closing', () => {
  it('closes over forty seconds while it is told to, and stops shut', () => {
    let k = 0;
    for (let i = 0; i < 20 * 30; i++) k = stepClose(k, 1 / 30, true);
    expect(k).toBeCloseTo(0.5, 5);
    for (let i = 0; i < 40 * 30; i++) k = stepClose(k, 1 / 30, true);
    expect(k).toBe(1);
  });

  it('draws back in a few seconds once it is told to stop', () => {
    let k = 1;
    k = stepClose(k, 1, false);
    expect(k).toBeGreaterThan(0);
    expect(k).toBeLessThan(1);
    for (let i = 0; i < 10; i++) k = stepClose(k, 1, false);
    expect(k).toBe(0);
  });
});

describe('what a room reads from the frame it is drawn in', () => {
  it('finds the story’s flags on the frame or in the game it carries, and none when there are none', () => {
    expect(flagsOf({ flags: new Set(['walls-closing']) }).has('walls-closing')).toBe(true);
    expect(flagsOf({ g: { flags: new Set(['grate']) } }).has('grate')).toBe(true);
    expect(flagsOf({ flags: ['grate'] }).has('grate')).toBe(true);
    expect(flagsOf(undefined).size).toBe(0);
    expect(flagsOf({ g: {} }).size).toBe(0);
  });

  it('reads how open a door is, between 0 and 1, and 0 for a door it can’t see', () => {
    const ctx = { g: { doors: { 'cell2187-door': { open: 0.4 }, odd: { open: 3 } } } };
    expect(openOf(ctx, 'cell2187-door')).toBeCloseTo(0.4);
    expect(openOf(ctx, 'odd')).toBe(1);
    expect(openOf(ctx, 'nowhere')).toBe(0);
    expect(openOf(undefined, 'cell2187-door')).toBe(0);
  });
});
