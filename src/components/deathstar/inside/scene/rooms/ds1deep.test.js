import { describe, expect, it } from 'vitest';
import { buildLayout } from '../../rules/layout';
import { furnish } from '../../rules/furnish';
import { DS1 } from '../../rules/stations/ds1';
import { DS1_DEEP, drawProp } from './ds1deep';
import { bendOf, spillOf } from './deep/cells';
import { MASHER, mashersOf, waterNormals, waterOf } from './deep/compactor';
import { boundsOf } from './deep/parts';

const KINDS = ['detention', 'cellbay', 'cell', 'chute', 'compactor', 'maintenance'];
const layout = buildLayout(DS1);
const rooms = [...layout.rooms.values()].filter((r) => KINDS.includes(r.kind));
const furnished = rooms.map((room) => ({ room, ...furnish(room, DS1) }));
const EDGE = 0.005; // metres a drawing may stray past its prop’s box (rounding, a lens’s rim)
// furnish.js hangs a cell’s number 3 cm off the wall over its door, which is inside the kit’s
// slide-door lintel (kit.js FRAME.slide, 0.14 deep): the plate is drawn on the lintel’s face instead
const PROUD = { 'cell-number': 0.14 };

// the box a prop’s footprint covers seen from above, turned to its yaw, from its foot to its top
function propBox(p) {
  const [c, s] = [Math.abs(Math.cos(p.yaw)), Math.abs(Math.sin(p.yaw))];
  const [ex, ez] = [c * (p.w / 2) + s * (p.d / 2), s * (p.w / 2) + c * (p.d / 2)];
  return { x0: p.x - ex, x1: p.x + ex, y0: p.y, y1: p.y + p.h, z0: p.z - ez, z1: p.z + ez };
}

describe('the first Death Star’s detention level, drawn', () => {
  it('has a builder for each of its kinds of room', () => {
    for (const kind of KINDS) expect(typeof DS1_DEEP[kind]).toBe('function');
  });

  it('draws every thing its rooms are furnished with, each a drawing of its own kind', () => {
    const kinds = new Set(furnished.flatMap((f) => f.props.map((p) => p.kind)));
    expect(kinds.size).toBeGreaterThan(12);
    for (const { props } of furnished) for (const p of props) expect(drawProp(p).length, p.kind).toBeGreaterThan(0);
  });

  it('draws each thing within the box furnish gives it, so nothing shows where nothing stands', () => {
    for (const { props } of furnished) {
      for (const p of props) {
        const b = boundsOf(drawProp(p));
        const want = propBox({ ...p, d: p.d + 2 * (PROUD[p.kind] ?? 0) });
        for (const [lo, hi] of [['x0', 'x1'], ['y0', 'y1'], ['z0', 'z1']]) {
          expect(b[lo], `${p.kind} at ${p.x}, ${p.z}: ${lo}`).toBeGreaterThanOrEqual(want[lo] - EDGE);
          expect(b[hi], `${p.kind} at ${p.x}, ${p.z}: ${hi}`).toBeLessThanOrEqual(want[hi] + EDGE);
        }
      }
    }
  });

  it('draws something wherever a body bumps into a thing, so nothing stops you that you can’t see', () => {
    for (const { room, props, solids } of furnished) {
      const boxes = props.flatMap((p) => drawProp(p).map((part) => boundsOf([part])));
      for (const s of solids) {
        const shape = s.box ?? { x0: s.circle.x - s.circle.r * 0.7, x1: s.circle.x + s.circle.r * 0.7, z0: s.circle.z - s.circle.r * 0.7, z1: s.circle.z + s.circle.r * 0.7, y0: s.circle.y0, y1: s.circle.y1 };
        const y = (shape.y0 + shape.y1) / 2;
        for (let i = 0; i <= 4; i++) {
          for (let j = 0; j <= 4; j++) {
            const x = shape.x0 + 0.03 + ((shape.x1 - shape.x0 - 0.06) * i) / 4;
            const z = shape.z0 + 0.03 + ((shape.z1 - shape.z0 - 0.06) * j) / 4;
            const seen = boxes.some((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && z >= b.z0 && z <= b.z1);
            expect(seen, `${room.id}: a solid at ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)} drawn`).toBe(true);
          }
        }
      }
    }
  });
});

describe('compactor 3263827', () => {
  const room = layout.rooms.get('compactor');
  const { props } = furnished.find((f) => f.room === room);

  it('stands its murky water a metre over the bottom, up to the walkway out of it', () => {
    const water = waterOf(room);
    const bottom = Math.min(...room.floors.map((f) => f.y));
    expect(water.y - bottom).toBeGreaterThan(0.9);
    expect(water.y - bottom).toBeLessThanOrEqual(1);
    expect(water).toMatchObject({ x0: 6, x1: 13, z0: room.box.z0, z1: room.box.z1 });
  });

  it('floats the bits of junk on the water, and leaves the heaps standing out of it', () => {
    const water = waterOf(room);
    const floating = props.filter((p) => p.kind === 'junk' && p.h < 0.1);
    expect(floating.length).toBeGreaterThan(0);
    for (const p of floating) {
      expect(p.y).toBeLessThan(water.y);
      expect(p.y + p.h).toBeGreaterThan(water.y);
    }
  });

  it('ripples its water with a normal map that tiles without a seam, every texel leaning but facing up', () => {
    const n = 32;
    const px = waterNormals(n, 7);
    expect(px).toHaveLength(n * n * 4);
    const at = (x, y) => [px[(y * n + x) * 4], px[(y * n + x) * 4 + 1], px[(y * n + x) * 4 + 2]];
    const step = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    let inside = 0;
    let lean = 0;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const c = at(x, y);
        expect(c[2]).toBeGreaterThan(160);
        lean = Math.max(lean, Math.abs(c[0] - 128), Math.abs(c[1] - 128));
        if (x + 1 < n) inside = Math.max(inside, step(c, at(x + 1, y)));
      }
    }
    expect(lean).toBeGreaterThan(20);
    // across the wrap, from the last column to the first, no bigger a jump than between any two neighbours
    for (let y = 0; y < n; y++) expect(step(at(n - 1, y), at(0, y))).toBeLessThanOrEqual(inside + 1);
    expect([...waterNormals(n, 7)]).toEqual([...px]);
  });

  it('closes its two long walls over the water towards each other, leaving less than a body’s width and a bit', () => {
    const walls = mashersOf(room);
    expect(walls).toHaveLength(2);
    const [a, b] = walls.sort((p, q) => p.z - q.z);
    expect(a.z).toBeCloseTo(room.box.z0);
    expect(b.z).toBeCloseTo(room.box.z1);
    expect(a.inward).toBe(1);
    expect(b.inward).toBe(-1);
    for (const w of walls) expect(w).toMatchObject({ x0: 6, x1: 13 });
    const gap = b.z - a.z - 2 * MASHER.travel - 2 * MASHER.depth;
    expect(gap).toBeGreaterThan(0.7);
    expect(gap).toBeLessThan(1.2);
  });
});

describe('the cell bay’s bend and the cells off it', () => {
  it('shows each cell’s number in front of its door’s lintel, not behind it', () => {
    const bay = furnished.find((f) => f.room.id === 'cellbay');
    for (const p of bay.props.filter((q) => q.kind === 'cell-number')) {
      const b = boundsOf(drawProp(p));
      // the east wall at x 62, the plate facing west: its face stands clear of the 0.14 m lintel
      expect(62 - b.x0).toBeGreaterThan(0.14);
    }
  });

  it('stencils the compactor’s number above its hatch’s lintel', () => {
    const compactor = furnished.find((f) => f.room.id === 'compactor');
    const hatch = layout.doors.get('compactor-hatch');
    const p = compactor.props.find((q) => q.kind === 'stencil');
    const b = boundsOf(drawProp(p));
    expect(b.y0).toBeGreaterThanOrEqual(hatch.y + hatch.h + 0.18);
  });

  it('lets the light in at cell 2187’s door, into the cell', () => {
    const spill = spillOf(layout.rooms.get('cell2187'), layout);
    expect(spill).toMatchObject({ door: 'cell2187-door', x: 59.5, z: -117, w: 1.2, h: 2.2 });
    expect(spill.dir.x).toBeCloseTo(0);
    expect(spill.dir.z).toBeCloseTo(-1);
  });

  it('turns the bay’s light and floor bands round the bend, in the bay past it, from one centreline to the other', () => {
    expect(bendOf(layout.rooms.get('cellbay'), layout)).toBeNull();
    const bend = bendOf(layout.rooms.get('cellbay2'), layout);
    expect(bend.c).toEqual({ x: 58, z: -113 });
    expect(bend.r).toBeCloseTo(2);
    expect(bend.from).toEqual({ x: 60, z: -113 });
    expect(bend.to).toEqual({ x: 58, z: -115 });
    for (const a of [0.1, 0.5, 0.9]) {
      const p = { x: bend.c.x + bend.r * Math.cos(bend.a0 + (bend.a1 - bend.a0) * a), z: bend.c.z + bend.r * Math.sin(bend.a0 + (bend.a1 - bend.a0) * a) };
      const box = layout.rooms.get('cellbay2').box;
      expect(p.x > box.x0 && p.x < box.x1 && p.z > box.z0 && p.z < box.z1).toBe(true);
    }
  });
});
