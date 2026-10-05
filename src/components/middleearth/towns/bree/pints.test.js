import { describe, expect, it } from 'vitest';
import { POUR, newPour, nextMug, startPour, stepPour, stopPour } from './pints';

// hold the tap for `s` seconds, then let go
function pour(p, s) {
  startPour(p);
  const ev = [];
  for (let t = 0; t < s - 1e-9; t += 1 / 60) ev.push(...stepPour(p, Math.min(1 / 60, s - t)));
  return { ev, out: stopPour(p) };
}

describe('pouring a pint', () => {
  it('is a good pint when let go between the lines', () => {
    const p = newPour();
    expect(pour(p, 2.3).out).toBe('good');
    expect(p.good).toBe(1);
    expect(p.state).toBe('good');
  });
  it('is short when let go too soon', () => {
    const p = newPour();
    expect(pour(p, 1).out).toBe('short');
    expect(p.good).toBe(0);
  });
  it('has too much head when let go a shade late', () => {
    expect(pour(newPour(), 2.58).out).toBe('over');
  });
  it('spills over the brim if never let go', () => {
    const p = newPour();
    const { ev, out } = pour(p, 4);
    expect(ev.map((e) => e.type)).toContain('spilt');
    expect(out).toBeNull();
    expect(p.state).toBe('spilt');
    expect(p.tries).toBe(1);
  });
  it('wins with three good pints, and pours no more after', () => {
    const p = newPour();
    for (let i = 0; i < POUR.need; i++) {
      pour(p, 2.3);
      nextMug(p);
    }
    expect(p.state).toBe('won');
    startPour(p);
    expect(p.pouring).toBe(false);
  });
  it('runs out after six tries without three good ones', () => {
    const p = newPour();
    for (let i = 0; i < POUR.tries; i++) {
      pour(p, i < 2 ? 2.3 : 1);
      nextMug(p);
    }
    expect(p.state).toBe('out');
    expect(p.good).toBe(2);
  });
  it('waits for the next mug before pouring again', () => {
    const p = newPour();
    pour(p, 1);
    startPour(p);
    expect(p.pouring).toBe(false);
    nextMug(p);
    expect(p.level).toBe(0);
    startPour(p);
    expect(p.pouring).toBe(true);
  });
});
