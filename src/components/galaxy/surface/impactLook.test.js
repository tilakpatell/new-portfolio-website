import { describe, expect, it } from 'vitest';
import books from '../../../data/bf2017/physics/materials.json';
import { footprintOf, impactOf, tagOf } from '../../../lib/physics/materials';
import { landingLook, printOf } from './impactLook';
import { SITES } from './sites';

const hoth = books.hoth_01;

describe('how a bolt lands, by what it struck', () => {
  it('snow puffs, metal sparks, rock chips', () => {
    expect(landingLook('snow').kick.n).toBeGreaterThan(0);
    expect(landingLook('snow').sparks).toBeLessThan(landingLook('metal').sparks);
    expect(landingLook('metal').kick).toBe(null);
    expect(landingLook('rock')).toMatchObject({ smoke: 1, kick: { n: 2 } });
  });

  it('an unknown surface keeps the old look: a burn on the ground, sparks off a wall', () => {
    expect(landingLook('generic', { ground: true })).toEqual({ sparks: 12, spark: 'bolt', kick: null, smoke: 0, scorch: true });
    expect(landingLook(undefined)).toMatchObject({ sparks: 9, scorch: false });
  });

  it('a print on snow and sand, none on metal', () => {
    expect(printOf('snow')).toEqual({ r: 0.62, k: 0.3 });
    expect(printOf('sand').r).toBeGreaterThan(0);
    expect(printOf('metal')).toBe(null);
  });

  it('on Hoth, a bolt at the snow puffs and one at a wall sparks; your feet print the snow', () => {
    const m = SITES.hoth.materials;
    expect(m.level).toBe('hoth_01');
    expect(impactOf(hoth, { tag: tagOf(m, { ground: true }) }).family).toBe('snow');
    expect(impactOf(hoth, { tag: tagOf(m, { solid: { type: 'box' } }) }).family).toBe('metal');
    expect(impactOf(hoth, { tag: tagOf(m, { solid: { type: 'circle' } }) }).family).toBe('rock');
    expect(printOf(footprintOf(hoth, m.ground)?.family)).toEqual(printOf('snow'));
  });
});
