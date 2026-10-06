import { describe, expect, it } from 'vitest';
import { STAR_DESTROYER, destroyerSpot } from './setpieces';
import { GOALS, SOLIDS, parkAt } from './ship';
import { ORDER } from './layout';

const clear = (spot) => SOLIDS.every((o) => Math.hypot(spot[0] - o.at[0], spot[1] - o.at[1], spot[2] - o.at[2]) > o.r + STAR_DESTROYER * 0.6);

describe('where the Star Destroyer drops in', () => {
  it('ahead of the ship and off to the side asked, in open space', () => {
    const ship = { x: 0, y: 0, z: 1000, heading: 0 }; // facing −z, nothing near
    const [x, , z] = destroyerSpot(ship, 1, []);
    expect(z).toBeCloseTo(1000 - 28, 6);
    expect(x).toBeCloseTo(10, 6);
  });

  it('never inside a station, planet or the sun, parked at any of them, either side', () => {
    for (const id of ORDER) {
      if (!GOALS[id]) continue;
      const p = parkAt(id);
      for (const side of [-1, 1]) expect(clear(destroyerSpot({ ...p, y: p.y }, side)), `${id} ${side}`).toBe(true);
    }
  });

  it('keeps clear of whatever solids it is given, not the universe map\'s', () => {
    // a galaxy system: its planet at the middle, the ship just off it
    const planet = { id: 'planet', at: [0, 0, 0], r: 40 };
    const ship = { x: 0, y: 14, z: 90, heading: 0 }; // facing −z: 28 ahead is 62 out, inside the planet's half-length margin
    for (const side of [-1, 1]) {
      const p = destroyerSpot(ship, side, [planet]);
      expect(Math.hypot(p[0], p[1], p[2])).toBeGreaterThan(planet.r + STAR_DESTROYER * 0.6);
    }
  });
});
