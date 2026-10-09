import { describe, expect, it } from 'vitest';
import { domeOf, fitScale } from './seatFit';

// a glass cap: a hemisphere of radius 1 over y = 0, as points
const hemisphere = (r = 1, cx = 0, cz = 0) => {
  const pts = [];
  for (let a = 0; a <= 90; a += 2) {
    const y = r * Math.sin((a * Math.PI) / 180);
    const ring = r * Math.cos((a * Math.PI) / 180);
    for (let b = 0; b < 360; b += 10) pts.push(cx + ring * Math.cos((b * Math.PI) / 180), y, cz + ring * Math.sin((b * Math.PI) / 180));
  }
  return pts;
};
// a figure: a column of points from y0 to y1 at (x, z)
const column = (x, z, y0, y1) => {
  const pts = [];
  for (let y = y0; y <= y1 + 1e-9; y += 0.01) pts.push(x, y, z);
  return pts;
};

describe('the dome a crew sits under', () => {
  it('is as wide as the glass at each height, and nothing over the top', () => {
    const dome = domeOf(hemisphere());
    expect(dome.base).toBeCloseTo(0, 5);
    expect(dome.top).toBeCloseTo(1, 5);
    expect(dome.radius(0)).toBeCloseTo(1, 1);
    expect(dome.radius(0.6)).toBeCloseTo(0.8, 1);
    expect(dome.radius(0.6)).toBeLessThanOrEqual(0.8 + 1e-6); // (never wider than the glass)
    expect(dome.radius(1.01)).toBeLessThan(0);
    expect(dome.radius(-0.5)).toBe(Infinity); // (below the glass: the hull's)
  });

  it('finds its axis where the glass is, not at the origin', () => {
    const dome = domeOf(hemisphere(1, 2, -1));
    expect(dome.axis[0]).toBeCloseTo(2, 5);
    expect(dome.axis[1]).toBeCloseTo(-1, 5);
  });
});

describe('how big a figure can sit', () => {
  const dome = domeOf(hemisphere());

  it('leaves a figure that fits as he is', () => {
    expect(fitScale(column(0, 0, -0.5, 0.5), [0, -0.5, 0], dome, { margin: 0.05 })).toBe(1);
  });

  it('shrinks one whose head comes through the glass, about where he sits, till it’s under it with room', () => {
    // sat 0.5 out, his head at 1.0: the glass there is only ~0.87 high
    const pts = column(0.5, 0, -0.2, 1);
    const s = fitScale(pts, [0.5, -0.2, 0], dome, { margin: 0.05 });
    expect(s).toBeLessThan(1);
    expect(s).toBeGreaterThan(0.5);
    const top = -0.2 + s * 1.2;
    expect(Math.hypot(0.5, 0) + 0.05).toBeLessThanOrEqual(dome.radius(top + 0.05) + 1e-6);
    // and no more than it needs to
    const more = Math.min(1, s + 0.05);
    expect(Math.hypot(0.5, 0) + 0.05).toBeGreaterThan(dome.radius(-0.2 + more * 1.2 + 0.05));
  });

  it('counts what sticks out sideways near the top (a spike of hair, a hat’s brim)', () => {
    const head = [...column(0, 0, -0.2, 0.8), 0.6, 0.8, 0]; // a spike out at the side, up high
    expect(fitScale(head, [0, -0.2, 0], dome, { margin: 0.05 })).toBeLessThan(1);
  });

  it('never shrinks him past `least`', () => {
    expect(fitScale(column(0.9, 0, 0, 3), [0.9, 0, 0], dome, { margin: 0.05, least: 0.6 })).toBe(0.6);
  });

  it('takes no notice of what’s below the glass', () => {
    expect(fitScale(column(3, 0, -2, -0.1), [3, -2, 0], dome, { margin: 0.05 })).toBe(1);
  });
});
