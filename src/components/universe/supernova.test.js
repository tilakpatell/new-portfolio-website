import { describe, expect, it } from 'vitest';
import { SUPERNOVA_SITES } from './supernova';
import { DEEP, PLACES } from './deep';

describe('the supernovas', () => {
  it('go off well clear of every place, inside the map, under the ceiling', () => {
    for (const s of SUPERNOVA_SITES) {
      expect(Math.hypot(s[0], s[2])).toBeLessThan(DEEP.edge - 300);
      expect(Math.abs(s[1])).toBeLessThan(DEEP.ceiling);
      for (const p of PLACES) expect(Math.hypot(s[0] - p.at[0], s[1] - p.at[1], s[2] - p.at[2]) - p.reach, `${s} and ${p.id}`).toBeGreaterThan(750);
    }
    for (const a of SUPERNOVA_SITES) for (const b of SUPERNOVA_SITES) if (a !== b) expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeGreaterThan(1500);
  });
});
