import { describe, expect, it } from 'vitest';
import { groundAt } from './ground';
import { FIELD, POND, WORLD } from './rules';

const at = (x, z) => {
  const out = [0, 0, 0];
  const grass = groundAt(x, z, out);
  return { out, grass };
};
const greenish = ([r, g, b]) => g > r && g > b;

describe('the Shire’s ground, as one function for its colour and its grass', () => {
  it('grows grass on the open green, and paints it green', () => {
    const p = at(-8, -16);
    expect(p.grass).toBeGreaterThan(0.9);
    expect(greenish(p.out)).toBe(true);
  });

  it('wears the lanes to dirt, with no grass on them', () => {
    // (the lane runs east-west along z = -4)
    const p = at(20, -4);
    expect(p.grass).toBeLessThan(0.1);
    expect(greenish(p.out)).toBe(false);
  });

  it('grows nothing in Maggot’s tilled field, under the water or round the doors', () => {
    expect(at((FIELD.x0 + FIELD.x1) / 2, (FIELD.z0 + FIELD.z1) / 2).grass).toBe(0);
    expect(at(POND.x, POND.z).grass).toBe(0);
  });

  it('stays a colour everywhere in the world', () => {
    for (let x = -WORLD.edge; x <= WORLD.edge; x += 13)
      for (let z = -WORLD.edge; z <= WORLD.edge; z += 11) {
        const p = at(x, z);
        for (const c of p.out) expect(c >= 0 && c <= 1).toBe(true);
        expect(p.grass >= 0 && p.grass <= 1).toBe(true);
      }
  });
});
