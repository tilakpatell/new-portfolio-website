import { describe, expect, it } from 'vitest';
import { POOLS, poolFor } from './pools';

describe('the worlds’ everyday people, from the game’s civilians', () => {
  it('gives the cities the city’s people', () => {
    expect(poolFor('villager', 'coruscant', 1)).toMatch(/^civcity[13]$/);
    expect(poolFor('zam', 'bespin', 2)).toMatch(/^civcity[13]$/);
  });

  it('takes the pool in turn, figure by figure', () => {
    const seen = new Set([0, 1].map((i) => poolFor('villager', 'coruscant', i)));
    expect(seen).toEqual(new Set(POOLS.coruscant));
  });

  it('leaves a world with no pool, and any other kind, as they were', () => {
    expect(poolFor('villager', 'lothal', 0)).toBe('villager');
    expect(poolFor('villager', 'tatooine', 0)).toBe('villager');
    expect(poolFor('stormtrooper', 'coruscant', 0)).toBe('stormtrooper');
  });
});
