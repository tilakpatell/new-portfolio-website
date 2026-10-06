import { describe, expect, it } from 'vitest';
import { createHandover } from './handover';

describe('createHandover', () => {
  it('is a cover until it starts, then fades over `fade` ms', () => {
    const h = createHandover({ fade: 600 });
    expect(h.frame(0)).toEqual({ opacity: 1, done: false });
    h.start(1000);
    expect(h.frame(1000)).toEqual({ opacity: 1, done: false });
    expect(h.frame(1300).opacity).toBeCloseTo(0.5);
    expect(h.frame(1300).done).toBe(false);
    expect(h.frame(1600)).toEqual({ opacity: 0, done: true });
    expect(h.frame(2000)).toEqual({ opacity: 0, done: true });
  });

  it('cancel ends it at once', () => {
    const h = createHandover();
    h.start(0);
    h.cancel();
    expect(h.frame(10)).toEqual({ opacity: 0, done: true });
  });

  it('a zero fade is done the frame it starts', () => {
    const h = createHandover({ fade: 0 });
    h.start(5);
    expect(h.frame(5)).toEqual({ opacity: 0, done: true });
  });
});
