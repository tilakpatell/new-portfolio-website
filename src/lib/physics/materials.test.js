import { describe, expect, it } from 'vitest';
import books from '../../data/bf2017/physics/materials.json';
import { ENGINE, familyOf, footprintOf, frictionOf, impactOf, loadMaterials, materialOf, tagOf } from './materials';

const hoth = books.hoth_01;

// numeric leaves with neither a `<key>_source` sibling nor `source: 'hand'`
// on an ancestor (lane 0's rule for every rulebook)
function unsourced(node, path = '', hand = false, out = []) {
  if (Array.isArray(node)) node.forEach((v, i) => unsourced(v, `${path}[${i}]`, hand, out));
  else if (node && typeof node === 'object') {
    const h = hand || node.source === 'hand';
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'number' && !h && !(`${k}_source` in node)) out.push(`${path}.${k}`);
      else if (typeof v === 'object') unsourced(v, `${path}.${k}`, h, out);
    }
  }
  return out;
}

describe('surfaces from the material grid', () => {
  it('every number in the rulebook names where it came from', () => {
    // (the `used` counts and the materials' rows carry theirs; `by` is hand)
    expect(unsourced(books)).toEqual([]);
  });

  it('a tag is a material: 14 metal, 28 snow; a tag the level lacks is the default', () => {
    expect(materialOf(hoth, 14).name).toBe('metal');
    expect(materialOf(hoth, '28').name).toBe('snow');
    expect(materialOf(hoth, 250)).toMatchObject({ index: 0, name: 'generic' });
    expect(materialOf(hoth, null).index).toBe(0);
  });

  it('a bolt on metal sparks, on snow puffs, on rock under snow chips', () => {
    expect(impactOf(hoth, { tag: 14 })).toMatchObject({ effect: 'FX_Impact_Blaster_Metal', family: 'metal', decal: 'Decal_Metal_Blaster' });
    expect(impactOf(hoth, { tag: 28 })).toMatchObject({ effect: 'FX_Impact_Blaster_Snow', family: 'snow', decal: 'Decal_Snow_Blaster' });
    expect(impactOf(hoth, { tag: 91 }).family).toBe('rock');
    expect(impactOf(hoth, { tag: 66 }).family).toBe('wood');
    expect(impactOf(hoth, { tag: 14 }).sound).toMatch(/Blasters_Metal/);
  });

  it('a grenade on snow is the grenade’s snow burst, not the bolt’s', () => {
    expect(impactOf(hoth, { tag: 28, by: 'impactGrenade', speed: 15 })).toMatchObject({ effect: 'FX_Grenade_ImpactGrenade_Snow_Explosion', family: 'snow' });
    expect(impactOf(hoth, { tag: 28, by: 'blaster', speed: 700 }).effect).toBe('FX_Impact_Blaster_Snow');
  });

  it('picks the speed band that holds the speed', () => {
    const book = { default: 0, by: { blaster: 5 }, materials: { 0: { name: 'x' }, 1: { name: 'y' } }, pairs: { '1,5': { effects: [{ min: 0, max: 50, effect: 'FX_Slow_Snow' }, { min: 50, max: 10000, effect: 'FX_Fast_Metal' }] } } };
    expect(impactOf(book, { tag: 1, speed: 15 }).effect).toBe('FX_Slow_Snow');
    expect(impactOf(book, { tag: 1, speed: 700 }).effect).toBe('FX_Fast_Metal');
    expect(impactOf(book, { tag: 1, speed: 20000 }).effect).toBe('FX_Fast_Metal');
    expect(impactOf(book, { tag: 1 }).effect).toBe('FX_Slow_Snow');
  });

  it('a pair not in the grid falls back to the default’s pair, then to the generic puff', () => {
    const book = { default: 0, by: { blaster: 5, odd: 9 }, materials: { 0: { name: 'generic' }, 1: { name: 'metal' } }, pairs: { '0,5': { effects: [{ min: 0, max: 1e4, effect: 'FX_Impact_Blaster_Generic' }] } } };
    expect(impactOf(book, { tag: 1 }).effect).toBe('FX_Impact_Blaster_Generic');
    expect(impactOf(book, { tag: 1, by: 'odd' })).toEqual({ effect: 'generic', family: 'metal', sound: null, decal: null, exitDecal: null });
    expect(impactOf(null, { tag: 3 }).effect).toBe('generic');
    expect(impactOf(hoth, { tag: 14, by: 'nobody' }).effect).toBe('generic');
  });

  it('a foot leaves a print on snow (28), none on packed snow (29) or metal', () => {
    expect(footprintOf(hoth, 28)).toEqual({ effect: 'FX_FootStep_Soldier_Snow_Decal_01', family: 'snow' });
    expect(footprintOf(hoth, 29)).toBe(null);
    expect(footprintOf(hoth, 14)).toBe(null);
    expect(footprintOf(hoth, 28, 'walkerFoot')?.family).toBe('snow');
  });

  it('friction and restitution: the grid’s where it has them, the engine’s where not', () => {
    expect(frictionOf(hoth, 14)).toEqual(ENGINE);
    expect(frictionOf(hoth, 141)).toEqual({ friction: ENGINE.friction, restitution: 1 });
    expect(frictionOf({ materials: { 2: { physics: { dynamicFriction: 0.4, dynamicFrictionModifier: 0.5, restitution: 0 } } } }, 2)).toEqual({ friction: 0.2, restitution: ENGINE.restitution });
  });

  it('names the look of an effect', () => {
    expect(familyOf('FX_Impact_Blaster_Concrete')).toBe('rock');
    expect(familyOf('FX_Impact_Blaster_Pipe')).toBe('metal');
    expect(familyOf('FX_Impact_Blaster_Sand_M')).toBe('sand');
    expect(familyOf('FX_Impact_Blaster_Generic')).toBe('generic');
    expect(familyOf(undefined)).toBe('generic');
  });

  it('a walker world’s hit finds its material from the site’s stand-in, a pack’s from its tag', () => {
    const m = { ground: 28, box: 14, circle: 91 };
    expect(tagOf(m, { ground: true })).toBe(28);
    expect(tagOf(m, { solid: { type: 'box' } })).toBe(14);
    expect(tagOf(m, { solid: { type: 'circle' } })).toBe(91);
    expect(tagOf(m, { tag: 45, solid: { type: 'box' } })).toBe(45);
    expect(tagOf(null, { ground: true })).toBe(null);
  });

  it('loads a level’s book, and none for a level without one', async () => {
    expect((await loadMaterials('hoth_01')).default).toBe(0);
    expect(await loadMaterials('nowhere')).toBe(null);
    expect(await loadMaterials(null)).toBe(null);
  });
});
