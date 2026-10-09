import { describe, expect, it } from 'vitest';
import { downAt } from './respawn';

const zone = { origin: [100, 5, -40], inside: { spawn: [2, 3], yaw: 1.2 } };

describe('where you get up after going down', () => {
  it('is where the quest’s step began, if it says', () => {
    expect(downAt({ step: { respawn: [7, 8] }, zone, spawn: [0, 0] })).toEqual([7, 8, null]);
  });
  it('is by the ship, outside', () => {
    expect(downAt({ step: null, zone: null, spawn: [11, 12] })).toEqual([11, 12, null]);
  });
  it('is the zone’s door in, inside one (it used to leave you where you fell)', () => {
    expect(downAt({ step: null, zone, spawn: [0, 0] })).toEqual([102, -37, 1.2]);
  });
  it('is the zone’s own respawn where it has one', () => {
    const z = { ...zone, inside: { ...zone.inside, respawn: [-4, 6] } };
    expect(downAt({ step: null, zone: z, spawn: [0, 0] })).toEqual([96, -34, 1.2]);
  });
  it('is the zone’s origin, facing its way, with no spawn given', () => {
    expect(downAt({ step: null, zone: { origin: [1, 0, 2], inside: {} }, spawn: [0, 0] })).toEqual([1, 2, 0]);
  });
});
