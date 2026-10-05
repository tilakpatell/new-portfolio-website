import { describe, expect, it } from 'vitest';
import { seeded } from './seeded';
import { seeded as shireSeeded } from '../components/middleearth/shire/rules';

describe('seeded', () => {
  it('draws exactly what the Shire’s draws, seed for seed', () => {
    for (const seed of [0, 1, 23, 91, 137, -5, 2 ** 31 - 1]) {
      const a = seeded(seed);
      const b = shireSeeded(seed);
      for (let i = 0; i < 200; i++) expect(a(), `${seed} #${i}`).toBe(b());
    }
  });
});
