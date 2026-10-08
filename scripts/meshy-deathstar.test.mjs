// What scripts/meshy-deathstar.mjs promises before it spends anything: its
// table of the three the Death Star’s interior still builds or dresses in
// code, and costOf, the sum it checks against the account’s balance before
// a paid step (so a short account is turned away before Meshy is asked for
// anything).
import { describe, expect, it } from 'vitest';
import { ASSETS, costOf, covers } from './meshy-deathstar.mjs';

describe('the Death Star’s Meshy assets', () => {
  it('has the trooper, the IT-O, the dianoga and old Ben, each with a height, a polygon budget and a texture size', () => {
    expect(Object.keys(ASSETS).sort()).toEqual(['dianoga', 'dstrooper', 'ito', 'obiwan']);
    for (const a of Object.values(ASSETS)) {
      expect(a.height).toBeGreaterThan(0);
      expect(a.poly).toBeGreaterThan(0);
      expect(a.tex).toBeGreaterThan(0);
      expect(a.prompt.length).toBeGreaterThan(40);
    }
    expect(ASSETS.dstrooper.height).toBe(1.8);
    expect(ASSETS.ito.height).toBe(0.3);
    expect(ASSETS.obiwan.height).toBe(1.78);
  });

  it('writes each one under /models/deathstar/, by its own name', () => {
    for (const [name, a] of Object.entries(ASSETS)) expect(a.url).toBe(`/models/deathstar/${name}.glb`);
  });

  it('has Meshy rig only the trooper: the IT-O and the dianoga are props, and old Ben takes the crew’s skeleton from jedi3', () => {
    expect(Object.keys(ASSETS).filter((n) => ASSETS[n].rigged)).toEqual(['dstrooper']);
    expect(ASSETS.obiwan.donor).toBe('/models/galaxy/crew/jedi3.glb');
  });

  it('makes old Ben on Meshy’s cheaper image and model steps', () => {
    expect(ASSETS.obiwan.image).toBe('nano-banana');
    expect(ASSETS.obiwan.model).toBe('meshy-6-lite');
  });

  it('describes them by their looks, never by a name Meshy turns down', () => {
    for (const a of Object.values(ASSETS)) expect(a.prompt).not.toMatch(/death star|star wars|stormtrooper|imperial|dianoga|IT-O|empire|kenobi|obi-wan|jedi|guinness|lightsaber/i);
  });
});

describe('costOf', () => {
  it('costs a fresh start an image and a model each, and the trooper’s rig: 140 credits', () => {
    expect(costOf(Object.keys(ASSETS), {})).toBe(9 + 30 + 5 + (9 + 30) + (9 + 30) + (3 + 15));
    expect(costOf(Object.keys(ASSETS), {})).toBe(140);
    expect(costOf(['obiwan'])).toBe(18);
    expect(costOf(['obiwan'], { obiwan: { image: 'a' } })).toBe(15);
    expect(costOf(['dstrooper'])).toBe(44);
    expect(costOf(['ito', 'dianoga'], {})).toBe(78);
  });

  it('charges nothing for a step whose task id is recorded', () => {
    expect(costOf(['dstrooper'], { dstrooper: { image: 'a' } })).toBe(35);
    expect(costOf(['dstrooper'], { dstrooper: { image: 'a', model: 'b' } })).toBe(5);
    expect(costOf(['dstrooper'], { dstrooper: { image: 'a', model: 'b', rig: 'c' } })).toBe(0);
    expect(costOf(['dstrooper', 'ito', 'dianoga'], { ito: { image: 'a', model: 'b' }, dianoga: { image: 'c' } })).toBe(44 + 0 + 30);
    // (another asset’s ids pay for nothing here)
    expect(costOf(['ito'], { dianoga: { image: 'a', model: 'b' } })).toBe(39);
  });

  it('can sum only some steps, as each paid step checks only its own', () => {
    expect(costOf(Object.keys(ASSETS), {}, ['images'])).toBe(30);
    expect(costOf(Object.keys(ASSETS), {}, ['models'])).toBe(105);
    // (a prop has no rig to pay for)
    expect(costOf(Object.keys(ASSETS), {}, ['rig'])).toBe(5);
    expect(costOf(['ito'], {}, ['rig'])).toBe(0);
    expect(costOf(['obiwan'], {}, ['rig'])).toBe(0);
  });

  it('throws for a name it doesn’t know', () => {
    expect(() => costOf(['chewie'], {})).toThrow(/chewie/);
    expect(() => costOf(['ito', 'nobody'], {})).toThrow(/unknown/);
    // (nor for a name every object has: it would be paid for and never recorded)
    for (const name of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) expect(() => costOf([name], {}), name).toThrow(/unknown/);
  });
});

describe('covers', () => {
  it('lets spending through only when the balance is a number at least as big as what is owed', () => {
    expect(covers(122, 122)).toBe(true);
    expect(covers(500, 122)).toBe(true);
    expect(covers(1, 122)).toBe(false);
  });

  it('fails closed when the balance didn’t come back as a number', () => {
    for (const have of [undefined, null, NaN, '500', Infinity]) expect(covers(have, 5), String(have)).toBe(false);
  });
});
