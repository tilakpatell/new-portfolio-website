import { describe, expect, it } from 'vitest';
import { pastShip } from './leviathans';

describe('pastShip', () => {
  // a pod going along +x, the ship at the middle
  const ship = { x: 0, y: 0, z: 0 };
  const dir = [1, 0, 0];

  it('is not past while the lead is still coming, and past once it has gone by', () => {
    expect(pastShip([-30, 0, 20], dir, ship)).toBe(false);
    expect(pastShip([-1, 0, 20], dir, ship)).toBe(false);
    expect(pastShip([12, 0, 20], dir, ship)).toBe(true);
  });

  it('gives it a margin past you before it counts', () => {
    expect(pastShip([4, 0, 0], dir, ship, 6)).toBe(false);
    expect(pastShip([7, 0, 0], dir, ship, 6)).toBe(true);
  });
});
