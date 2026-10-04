import { describe, expect, it } from 'vitest';
import { DIVE, along, breakage, cruiserAt, flight, riftAt } from './flight';

const page = (w = 1280, h = 6000) =>
  flight(w, h, {
    launch: { x: 320, y: 420 },
    jumps: [
      { top: 1300, bottom: 2100 }, // the game
      { top: 3400, bottom: 3900 }, // the TV
    ],
  });

describe('the cruiser’s flight', () => {
  it('starts at the hero’s portal and only ever goes down the page', () => {
    const f = page();
    expect(f.X[0]).toBeCloseTo(320);
    expect(f.Y[0]).toBeCloseTo(420);
    for (let i = 1; i < f.Y.length; i++) expect(f.Y[i]).toBeGreaterThan(f.Y[i - 1]);
    expect(f.Y[f.Y.length - 1]).toBeCloseTo(6000 - 40);
  });

  it('keeps on the page, side to side', () => {
    for (const w of [360, 1280]) {
      const f = page(w);
      for (const x of f.X) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(w);
      }
    }
  });

  it('portals past something the page’s width: in above it, out below, on the right where the text isn’t', () => {
    const f = page();
    expect(f.jumps).toHaveLength(2);
    expect(f.portals.map((p) => p.kind)).toEqual(['in', 'out', 'in', 'out']);
    const [game] = f.jumps;
    expect(game.beside).toBe(false);
    expect(game.a.y).toBeLessThan(1300);
    expect(game.b.y).toBeGreaterThan(2100);
    expect(game.a.x).toBeGreaterThan(640);
    expect(game.b.x).toBeGreaterThan(640);
    // the way is drawn in a piece for each stretch flown
    expect(f.d.match(/M /g)).toHaveLength(3);
  });

  it('portals past something narrower beside it: in by its top, out by its bottom on the other side', () => {
    const f = flight(1280, 6000, { launch: { x: 320, y: 420 }, jumps: [{ top: 1300, bottom: 2100, left: 320, right: 960 }, { top: 3400, bottom: 3900, left: 320, right: 960 }] });
    const [one, two] = f.jumps;
    expect(one.beside).toBe(true);
    expect(one.a.y).toBeGreaterThan(1300);
    expect(one.b.y).toBeLessThan(2100);
    expect(one.a.x).toBeGreaterThan(960);
    expect(one.b.x).toBeLessThan(320);
    // the next one the other way round
    expect(two.a.x).toBeLessThan(320);
    expect(two.b.x).toBeGreaterThan(960);
  });

  it('skips a jump it can’t make', () => {
    const f = flight(1280, 3000, { launch: { x: 320, y: 420 }, jumps: [{ top: 500, bottom: 900 }, { top: 2700, bottom: 2990 }] });
    expect(f.jumps).toHaveLength(0);
  });

  it('finds where it is, and which way it’s heading', () => {
    const f = page();
    const p = along(f.X, f.Y, 800);
    expect(p.y).toBe(800);
    expect(p.dy).toBeGreaterThan(0);
    expect(along(f.X, f.Y, -50).y).toBe(f.Y[0]);
  });
});

describe('through the portals', () => {
  it('is gone between two portals, and dives in and pops out at them', () => {
    const f = page();
    const { a, b } = f.jumps[0];
    expect(cruiserAt((a.y + b.y) / 2, f).hidden).toBe(true);
    expect(cruiserAt(a.y - DIVE * 3, f)).toEqual({ hidden: false, scale: 1, spin: 0 });
    const diving = cruiserAt(a.y - 5, f);
    expect(diving.scale).toBeLessThan(0.3);
    expect(cruiserAt(b.y + 2, f).scale).toBeLessThan(0.3);
    expect(cruiserAt(b.y + DIVE * 2, f).scale).toBe(1);
    // and it comes out of the hero's portal at the start
    expect(cruiserAt(f.start.y, f).scale).toBeLessThan(0.3);
  });

  it('opens a portal as the cruiser comes, shuts it once it’s gone, and leaves the cracks', () => {
    const f = page();
    const [inn, out] = f.portals;
    expect(riftAt(inn, inn.y - 1000)).toEqual({ open: 0, crack: 0 });
    expect(riftAt(inn, inn.y).open).toBe(1);
    expect(riftAt(inn, inn.y + 600).open).toBe(0);
    expect(riftAt(inn, inn.y + 600).crack).toBe(1);
    expect(riftAt(out, out.y - 600).open).toBe(0);
    expect(riftAt(out, out.y + 100).open).toBe(1);
    expect(riftAt(out, out.y + 600).open).toBe(0);
  });

  it('breaks the page the same way each time, and says how far it reaches', () => {
    const one = breakage(60, 3);
    expect(breakage(60, 3)).toEqual(one);
    expect(one.cracks.length).toBeGreaterThanOrEqual(7);
    expect(one.shards.length).toBeGreaterThan(0);
    const nums = [one.hole, ...one.cracks, ...one.shards.map((s) => s.d)].join(' ').match(/-?\d+(\.\d+)?/g).map(Number);
    for (const v of nums) expect(Math.abs(v)).toBeLessThanOrEqual(one.reach);
    expect(breakage(60, 4)).not.toEqual(one);
  });
});
