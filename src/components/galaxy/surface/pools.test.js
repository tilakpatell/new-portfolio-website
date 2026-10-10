import { describe, expect, it } from 'vitest';
import { POOLS, poolFor } from './pools';

describe('the worlds’ everyday people, from the game’s civilians', () => {
  it('gives a desert world Mos Eisley’s, Naboo Theed’s, the cities the city’s', () => {
    expect(poolFor('villager', 'tatooine', 0)).toMatch(/^civdesert[123]$/);
    expect(poolFor('farmer', 'naboo', 3)).toMatch(/^civtheed[12]$/);
    expect(poolFor('villager', 'coruscant', 1)).toMatch(/^civcity[123]$/);
    expect(poolFor('zam', 'bespin', 2)).toMatch(/^civcity[123]$/);
  });

  it('takes the pool in turn, figure by figure', () => {
    const seen = new Set([0, 1, 2].map((i) => poolFor('villager', 'tatooine', i)));
    expect(seen).toEqual(new Set(POOLS.tatooine));
  });

  it('leaves a world with no pool, and any other kind, as they were', () => {
    expect(poolFor('villager', 'lothal', 0)).toBe('villager');
    expect(poolFor('stormtrooper', 'tatooine', 0)).toBe('stormtrooper');
  });
});
