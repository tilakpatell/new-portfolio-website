import { describe, expect, it } from 'vitest';
import { CORE, REGIONS, edgeAt } from './systems';
import { LETTER_SPACING, REGION_FONT, regionAngle, regionNamesShown, unknownNameX } from './regionNames';

const unit = (box, k = 1) => (box * k) / 21; // (screen px per map unit, as HoloMap.jsx has it)
const ids = (box, k) => REGIONS.slice(1).map((r) => r.id).filter((id) => regionNamesShown(REGIONS, unit(box, k)).has(id));

describe('regionNames: which of the regions’ names have room', () => {
  it('shows only the wide outer rings’ names on a 617 px map that’s fitted', () => {
    // (the inner rings are 0.4 to 0.5 units, 12 to 15 px, apart: their names would sit on each other)
    expect(ids(617, 1)).toEqual(['mid', 'outer']);
  });
  it('shows them all at k=3, and each name that shows stays showing as you zoom in', () => {
    expect(ids(617, 3)).toEqual(REGIONS.slice(1).map((r) => r.id));
    for (const box of [340, 617, 900]) {
      let was = new Set();
      for (let k = 1; k <= 8; k *= 1.25) {
        const now = regionNamesShown(REGIONS, unit(box, k));
        for (const id of was) expect(now.has(id), `${id} at ${box} px, k=${k.toFixed(2)}`).toBe(true);
        was = now;
      }
    }
  });
  it('counts the space between the letters of a name along its ring: a letter is 0.62 em and 0.18 more', () => {
    expect(LETTER_SPACING).toBe(0.18);
    // the outer ring's name, at the width it needs (0.9 of its letters', each 0.8 em), shows just above it and not just under
    const i = REGIONS.findIndex((r) => r.id === 'outer');
    const r = REGIONS[i];
    const px = (0.9 * r.name.length * REGION_FONT * 0.8) / edgeAt(r.r, regionAngle(i));
    expect(regionNamesShown(REGIONS, px * 1.02).has('outer')).toBe(true);
    expect(regionNamesShown(REGIONS, px * 0.98).has('outer')).toBe(false);
  });
  it('shows no names where the map has no size', () => {
    expect(regionNamesShown(REGIONS, 0).size).toBe(0);
    expect(regionNamesShown(REGIONS, NaN).size).toBe(0);
  });
  it('never shows the Deep Core’s, which has no name on the map', () => {
    expect(regionNamesShown(REGIONS, unit(900, 8)).has('deep')).toBe(false);
  });
  it('sets the first name at the north and leaves every name the right way up along its ring', () => {
    expect(regionAngle(1)).toBeCloseTo(-Math.PI / 2);
    // (HoloMap.jsx turns a name by its angle + 90 degrees: under a quarter turn either way reads upright)
    for (let i = 1; i < REGIONS.length; i++) expect(Math.abs((regionAngle(i) * 180) / Math.PI + 90)).toBeLessThan(90);
  });
});

describe('the Unknown Regions’ name', () => {
  const left = (box) => unknownNameX(unit(box)) * unit(box) - (15 * REGION_FONT * 0.62) / 2; // (its left edge on screen, from the map's)
  it('is where it always was, out west, on a map with the room for it', () => {
    expect(unknownNameX(unit(617))).toBeCloseTo(CORE[0] - 9.3);
    expect(left(617)).toBeGreaterThan(18);
  });
  it('is kept in off the map’s edge on a phone’s', () => {
    for (const box of [340, 390, 403, 500]) expect(left(box), `${box} px`).toBeGreaterThanOrEqual(18 - 1e-6);
  });
});
