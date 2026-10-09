import { describe, expect, it } from 'vitest';
import { AREAS, CEILING } from './rules';
import { roomSolids } from './roomSolids';

// The couch in the living room: at (−301.6, −3.5), 3 m long down z (it's
// turned to face the TV, east), 1.1 m deep, 0.9 m high.
describe('what stops a shot in a room', () => {
  const house = roomSolids('house');

  it('stops at the furniture, and passes over it', () => {
    const into = house([-304, 0.5, -3.5], [-299, 0.5, -3.5]);
    expect(into).not.toBe(null);
    expect(into.at[0]).toBeCloseTo(-301.6 - 0.55, 3);
    expect(into.normal).toEqual([-1, 0, 0]);
    expect(house([-304, 1.2, -3.5], [-299, 1.2, -3.5])).toBe(null);
  });

  it('stops at the floor and the ceiling', () => {
    expect(house([-303, 1, -5], [-303, -1, -5]).at[1]).toBeCloseTo(0, 6);
    expect(house([-303, 1, -5], [-303, 4, -5]).at[1]).toBeCloseTo(CEILING.house, 6);
  });

  it('stops at the walls inside, and the house’s own', () => {
    // the kitchen's wall at x −306.7, between z −4.2 and 0
    const w = house([-305, 1.5, -2], [-309, 1.5, -2]);
    expect(w.at[0]).toBeCloseTo(-306.7 + 0.06, 3);
    // out through the north wall
    const out = house([-303, 1.5, -6], [-303, 1.5, -12]);
    expect(out.at[2]).toBeCloseTo(AREAS.house.z0, 6);
  });

  it('passes through a doorway', () => {
    // the kitchen's door between z −6 and −4.2, at x −306.7
    expect(house([-305, 1.5, -5.1], [-308, 1.5, -5.1])).toBe(null);
  });

  it('isn’t stopped by someone standing about (the bodies are the shot’s own)', () => {
    // Mr. Poopybutthole's spot, by the couch's end
    expect(house([-301.6, 1.5, -6.5], [-301.6, 1.5, -4.62])).toBe(null);
  });
});
