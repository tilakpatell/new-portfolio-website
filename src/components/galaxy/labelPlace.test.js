import { describe, expect, it } from 'vitest';
import { SYSTEMS } from './systems';
import { DOT, boxAt, estimateWidth, overlapArea, placeLabels } from './labelPlace';

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
  it('places every system on a 600 px map with no name over another system’s dot', () => {
    const items = at(600);
    const p = placeLabels(items, { bounds: { x0: 0, y0: 0, x1: 600, y1: 600 } });
    const boxes = boxesOf(items, p);
    const dotOf = (i) => ({ x0: i.x - DOT, y0: i.y - DOT, x1: i.x + DOT, y1: i.y + DOT });
    const covered = [];
    for (const box of boxes) for (const other of items) if (other.id !== box.id && overlapArea([box, dotOf(other)]) > 0) covered.push(`${box.id} over ${other.id}`);
    expect(covered).toEqual([]);
  });
  it('keeps a name inside the map before it keeps it off a neighbour’s dot', () => {
    // a dot 6 px from the right edge of a 346 px map, a neighbour's dot 7 px to its left: the right's cut off by the edge (r, tr, br), the left covers the dot (l)
    const items = [
      { id: 'edge', x: 340, y: 100, w: 39, h: 20, prio: 0 },
      { id: 'next', x: 333, y: 100, w: 30, h: 20, prio: 5 },
    ];
    const bounds = { x0: 0, y0: 0, x1: 346, y1: 346 };
    const p = placeLabels(items, { bounds });
    const b = boxAt(p.edge, 340, 100, 39, 20);
    expect(b.x1).toBeLessThanOrEqual(346);
    expect(b.x0).toBeGreaterThanOrEqual(0);
  });
  it('keeps a name from under a control drawn over the map', () => {
    const lone = { id: 'a', x: 100, y: 100, w: 60, h: 18, prio: 0 };
    const block = { x0: 105, y0: 80, x1: 200, y1: 120 };
    expect(placeLabels([lone])).toEqual({ a: 'r' });
    expect(placeLabels([lone], { blocks: [] })).toEqual({ a: 'r' });
    const p = placeLabels([lone], { blocks: [block] });
    expect(p.a).not.toBe('r');
    expect(overlapArea([boxAt(p.a, 100, 100, 60, 18), block])).toBe(0);
  });
  it('takes the place no control covers, when there is one', () => {
    const lone = { id: 'a', x: 100, y: 100, w: 60, h: 18, prio: 0 };
    // controls over the right and the left of the dot: above or below is what's left
    const blocks = [{ x0: 105, y0: 92, x1: 200, y1: 108 }, { x0: 0, y0: 92, x1: 95, y1: 108 }];
    const p = placeLabels([lone], { blocks });
    expect(['t', 'b']).toContain(p.a);
    for (const k of blocks) expect(overlapArea([boxAt(p.a, 100, 100, 60, 18), k])).toBe(0);
  });
  it('counts a control as it counts a dot: a name goes under neither if there is room', () => {
    const items = [
      { id: 'a', x: 100, y: 100, w: 60, h: 18, prio: 0 },
      { id: 'b', x: 200, y: 200, w: 60, h: 18, prio: 0 },
    ];
    const dotOver = { x0: 118, y0: 92, x1: 132, y1: 108 }; // (b's dot's size, over a's right)
    const p = placeLabels(items, { blocks: [dotOver] });
    expect(overlapArea([boxAt(p.a, 100, 100, 60, 18), dotOver])).toBe(0);
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
