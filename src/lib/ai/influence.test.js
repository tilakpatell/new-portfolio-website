import { describe, expect, it } from 'vitest';
import { at, clear, createInfluence, stamp, working } from './influence';

const P = (x, z) => ({ x, y: 0, z });

describe('influence maps', () => {
  it('a stamp peaks at the agent and is zero past r', () => {
    const m = createInfluence({ cell: 1, w: 40, h: 40 });
    stamp(m, P(20, 20), 8);
    expect(at(m, 20, 20)).toBeCloseTo(1);
    expect(at(m, 24, 20)).toBeCloseTo(0.5);
    expect(at(m, 29, 20)).toBe(0);
    expect(at(m, -5, 0)).toBe(0);
  });

  it('two stamps add; clear wipes', () => {
    const m = createInfluence({ cell: 1, w: 40, h: 40 });
    stamp(m, P(18, 20), 8);
    stamp(m, P(22, 20), 8);
    expect(at(m, 20, 20)).toBeCloseTo(1.5);
    clear(m);
    expect(at(m, 20, 20)).toBe(0);
  });

  it('threat is flat most of the way, and strength scales it', () => {
    const m = createInfluence({ cell: 1, w: 40, h: 40 });
    stamp(m, P(20, 20), 10, 3, 'threat');
    expect(at(m, 25, 20)).toBeGreaterThan(2.7);
    expect(at(m, 29, 20)).toBeLessThan(1.2);
    expect(at(m, 20, 20)).toBeCloseTo(3);
  });

  it('stamps at the edge don’t throw', () => {
    const m = createInfluence({ cell: 2, w: 10, h: 10 });
    stamp(m, P(-6, 30), 8);
    stamp(m, P(0, 0), 8);
    expect(at(m, 0, 0)).toBeCloseTo(1);
  });

  it('a working map’s lowest is away from two enemies, and its highest toward them', () => {
    const enemy = createInfluence({ cell: 1, w: 40, h: 40 });
    stamp(enemy, P(26, 20), 10, 1, 'threat');
    stamp(enemy, P(20, 26), 10, 1, 'threat');
    const w = working(enemy, P(20, 20), 6).add(enemy, 1);
    const low = w.lowest();
    expect(low.x).toBeLessThan(20);
    expect(low.z).toBeLessThan(20);
    const high = w.highest();
    expect(high.x + high.z).toBeGreaterThan(40);
    expect(w.at(20, 20)).toBeCloseTo(at(enemy, 20, 20));
    expect(w.at(99, 99)).toBe(0);
    // normalised and inverted, the lowest becomes the highest
    const inv = working(enemy, P(20, 20), 6).add(enemy, 1).normalise().invert();
    expect(inv.highest().x).toBe(low.x);
    expect(inv.highest().z).toBe(low.z);
    // multiplied by my own interest, the far corner stops winning
    const near = working(enemy, P(20, 20), 6).add(enemy, 1).normalise().invert().interest();
    expect(Math.hypot(near.highest().x - 20, near.highest().z - 20)).toBeLessThan(6);
  });
});
