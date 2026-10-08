import { describe, expect, it } from 'vitest';
import { MINE, chainFrom, layMines, mineBlast, mineHit, minefieldLane } from './minefield';
import { SHIP, spawn } from './ship';
import { DEEP } from './deep';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// how far a point is along the segment from a to b (0…1), and off it
const along = ([a, b], p) => {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const l2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
  const t = ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / l2;
  const q = [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t];
  return { t, off: dist(p, q) };
};

describe('layMines', () => {
  const lane = [
    [-13, 0, -50],
    [13, 0, -50],
  ];

  it('lays them across the lane, within its width, a little either side of it, none on another', () => {
    const mines = layMines({ lane, seed: 3 });
    expect(mines.length).toBe(MINE.n);
    for (const m of mines) {
      const { t, off } = along(lane, m.at);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1);
      expect(off).toBeLessThanOrEqual(Math.hypot(MINE.depth, MINE.up) + 1e-9);
      expect(m.r).toBe(MINE.r);
    }
    for (let i = 0; i < mines.length; i++) for (let j = i + 1; j < mines.length; j++) expect(dist(mines[i].at, mines[j].at)).toBeGreaterThan(MINE.apart);
  });

  it('never lays one inside a planet', () => {
    const planet = { id: 'p', at: [0, 0, -50], r: 6 };
    const mines = layMines({ lane, seed: 7, solids: [planet] });
    expect(mines.length).toBeGreaterThan(MINE.n / 2);
    for (const m of mines) expect(dist(m.at, planet.at)).toBeGreaterThan(planet.r + m.r + 1);
  });

  it('is the same field for the same seed', () => {
    expect(layMines({ lane, seed: 11 })).toEqual(layMines({ lane, seed: 11 }));
    expect(layMines({ lane, seed: 11 })).not.toEqual(layMines({ lane, seed: 12 }));
  });
});

describe('minefieldLane', () => {
  it('lays it across your way ahead, further the faster you go, clear of everything', () => {
    const ship = { ...spawn(null), x: 0, y: 0, z: DEEP.open + 300, heading: Math.PI, speed: SHIP.cruise };
    const slow = minefieldLane(ship, () => 0.5);
    const fast = minefieldLane({ ...ship, speed: 200 }, () => 0.5);
    expect(slow).not.toBeNull();
    // (ahead is +z for this heading; the lane runs across, along x)
    const mid = (l) => l[0].map((v, i) => (v + l[1][i]) / 2);
    expect(mid(slow)[2] - ship.z).toBeGreaterThan(30);
    expect(mid(fast)[2] - ship.z).toBeGreaterThan(mid(slow)[2] - ship.z);
    expect(Math.abs(slow[0][2] - slow[1][2])).toBeLessThan(1e-9);
    expect(Math.abs(slow[0][0] - slow[1][0])).toBeCloseTo(MINE.width, 6);
  });
});

describe('mineHit', () => {
  const mines = [{ at: [0, 0, -10], r: MINE.r }, { at: [5, 0, -10], r: MINE.r }, { at: [0, 0, -10.5], r: MINE.r, gone: true }];

  it('sets off a mine the ship flies by close, however fast, and not one it passes wide of or one that has gone', () => {
    // heading 0 is along −z: flown from z −9 to −11 in one step, through the first
    const ship = { ...spawn(null), x: 0.3, y: 0, z: -11, heading: 0, pitch: 0, speed: 100 };
    expect(mineHit(ship, mines, 0.02)).toEqual([0]);
    expect(mineHit({ ...ship, x: 2.5 }, mines, 0.02)).toEqual([]);
    // (still, right on top of one)
    expect(mineHit({ ...ship, z: -10, speed: 0 }, mines, 0.02)).toEqual([0]);
  });
});

describe('a mine going off', () => {
  it('sets off the ones close by it, and theirs, but not one further off', () => {
    const mines = [0, 2.5, 5, 12].map((x) => ({ at: [x, 0, 0], r: MINE.r }));
    expect(chainFrom(mines, 0).sort()).toEqual([0, 1, 2]);
    expect(chainFrom(mines, 3)).toEqual([3]);
  });

  it('hurts the ship the more the closer it is, and nothing past its reach', () => {
    expect(mineBlast(0)).toBe(MINE.damage);
    expect(mineBlast(MINE.blast * 0.5)).toBeGreaterThan(0);
    expect(mineBlast(MINE.blast * 0.5)).toBeLessThan(MINE.damage);
    expect(mineBlast(MINE.blast + 0.1)).toBe(0);
  });
});

