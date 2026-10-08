import { describe, expect, it } from 'vitest';
import { SYSTEMS } from './systems';
import { boxAt, estimateWidth, overlapArea, placeLabels } from './labelPlace';

const at = (box) => SYSTEMS.map((s) => ({ id: s.id, x: (s.pos[0] / 21) * box, y: (s.pos[1] / 21) * box, w: estimateWidth(s.name), h: 18, prio: 0 }));
const boxesOf = (items, places) => items.map((it) => ({ id: it.id, ...boxAt(places[it.id], it.x, it.y, it.w, it.h) }));

describe('labelPlace', () => {
  it('puts a lone name on the right', () => {
    expect(placeLabels([{ id: 'a', x: 100, y: 100, w: 60, h: 18, prio: 0 }])).toEqual({ a: 'r' });
  });
  it('moves a name off a neighbour that would cover it', () => {
    const p = placeLabels([
      { id: 'a', x: 100, y: 100, w: 80, h: 18, prio: 1 },
      { id: 'b', x: 140, y: 102, w: 60, h: 18, prio: 0 },
    ]);
    expect(p.b).not.toBe('l');
    const boxes = boxesOf([{ id: 'a', x: 100, y: 100, w: 80, h: 18 }, { id: 'b', x: 140, y: 102, w: 60, h: 18 }], p);
    expect(overlapArea(boxes)).toBe(0);
    // neither name's label covers the other's dot
    const dot = (i) => ({ x0: i.x - 7, y0: i.y - 7, x1: i.x + 7, y1: i.y + 7 });
    const a = { x: 100, y: 100, w: 80, h: 18 };
    const b = { x: 140, y: 102, w: 60, h: 18 };
    expect(overlapArea([boxAt(p.a, a.x, a.y, a.w, a.h), dot(b)])).toBe(0);
    expect(overlapArea([boxAt(p.b, b.x, b.y, b.w, b.h), dot(a)])).toBe(0);
  });
  it('places every system on a 600 px map with no name over another', () => {
    const items = at(600);
    const p = placeLabels(items, { bounds: { x0: 0, y0: 0, x1: 600, y1: 600 } });
    expect(overlapArea(boxesOf(items, p))).toBe(0);
  });
  it('does better than all-right on a phone-sized map', () => {
    const items = at(380);
    const right = Object.fromEntries(items.map((i) => [i.id, 'r']));
    const p = placeLabels(items, { bounds: { x0: 0, y0: 0, x1: 380, y1: 380 } });
    expect(overlapArea(boxesOf(items, p))).toBeLessThan(overlapArea(boxesOf(items, right)) * 0.25);
  });
  it('gives a contested place to the higher priority', () => {
    const two = (pa, pb) => placeLabels([
      { id: 'here', x: 100, y: 100, w: 80, h: 18, prio: pa },
      { id: 'low', x: 100, y: 115, w: 80, h: 18, prio: pb },
    ]);
    const a = two(100, 0);
    expect(a.here).toBe('r');
    expect(a.low).not.toBe('r');
    const b = two(0, 100);
    expect(b.low).toBe('r');
    expect(b.here).not.toBe('r');
  });
});
