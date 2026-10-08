import { describe, expect, it } from 'vitest';
import { GCW } from './gcw';
import { SIDE_KEY, current, oathIn, readAllegiance, setTheatre, suggestSide, swear, teamFor, writeAllegiance } from './allegiance';

const NOW = GCW.start + 3600e3; // campaign 0
const LATER = GCW.start + GCW.campaign + 3600e3; // campaign 1

describe('the oath', () => {
  it('is kept under its own key', () => {
    expect(SIDE_KEY).toBe('tp-gcw-side');
  });
  it('nothing kept is unsworn, in the Civil War', () => {
    const a = readAllegiance(null, { now: NOW });
    expect(current(a)).toEqual({ war: 'gcw', side: null, sworn: 0, turncoat: false });
  });
  it('a bad save is unsworn', () => {
    for (const raw of ['{', '"rebel"', '{"since":0,"war":"nope","oaths":{"gcw":{"side":"jawa"}}}', 42, []]) {
      const a = readAllegiance(raw, { now: NOW });
      expect(current(a).side).toBeNull();
      expect(current(a).war).toBe('gcw');
    }
  });
  it('a side sworn in the wrong war is not kept', () => {
    const a = readAllegiance({ since: 0, war: 'clone', oaths: { clone: { side: 'rebel', sworn: 1, turncoat: false } } }, { now: NOW });
    expect(current(a)).toEqual({ war: 'clone', side: null, sworn: 0, turncoat: false });
  });
  it('comes back as it was written', () => {
    const a = swear(readAllegiance(null, { now: NOW }), 'empire', NOW);
    expect(readAllegiance(writeAllegiance(a), { now: NOW })).toEqual(a);
  });
  it('an oath from a past campaign is forgotten, but not the war you fight in', () => {
    const a = swear(readAllegiance(null, { now: NOW }), 'separatists', NOW);
    const b = readAllegiance(writeAllegiance(a), { now: LATER });
    expect(current(b)).toEqual({ war: 'clone', side: null, sworn: 0, turncoat: false });
  });
  it('swearing makes that side’s war the one you fight in', () => {
    const a = swear(readAllegiance(null, { now: NOW }), 'remnant', NOW);
    expect(current(a)).toEqual({ war: 'remnant', side: 'remnant', sworn: 1, turncoat: false });
  });
  it('swearing the other side in a campaign is a turncoat', () => {
    let a = swear(readAllegiance(null, { now: NOW }), 'rebel', NOW);
    a = swear(a, 'empire', NOW);
    expect(current(a)).toEqual({ war: 'gcw', side: 'empire', sworn: 2, turncoat: true });
  });
  it('swearing the same side again changes nothing', () => {
    const a = swear(readAllegiance(null, { now: NOW }), 'rebel', NOW);
    expect(swear(a, 'rebel', NOW)).toBe(a);
  });
  it('an oath in each war is its own: a side in the Clone Wars is no turncoat in the Civil War', () => {
    let a = swear(readAllegiance(null, { now: NOW }), 'republic', NOW);
    a = swear(a, 'empire', NOW);
    expect(current(a).turncoat).toBe(false);
    a = setTheatre(a, 'clone');
    expect(current(a)).toEqual({ war: 'clone', side: 'republic', sworn: 1, turncoat: false });
  });
  it('nobody swears to the Hutts, or to nothing', () => {
    const a = readAllegiance(null, { now: NOW });
    expect(swear(a, 'hutt', NOW)).toBe(a);
    expect(swear(a, 'jawas', NOW)).toBe(a);
    expect(setTheatre(a, 'nope')).toBe(a);
  });
});

describe('suggestSide', () => {
  it('the X-wing and the Falcon suggest the war’s light side, the cruiser nothing, Fett the dark', () => {
    expect(suggestSide({ crew: 'xwing' }, 'gcw')).toBe('rebel');
    expect(suggestSide({ crew: 'falcon' }, 'clone')).toBe('republic');
    expect(suggestSide({ crew: 'cruiser' }, 'gcw')).toBeNull();
    expect(suggestSide({ crew: 'xwing', hero: { lean: 'dark' } }, 'remnant')).toBe('remnant');
    expect(suggestSide({}, 'gcw')).toBeNull();
    // (a hero by id, heroes.js's lean: Fett over the X-wing)
    expect(suggestSide({ crew: 'xwing', hero: 'bobafett' }, 'gcw')).toBe('empire');
    expect(suggestSide({ crew: 'cruiser', hero: 'leia' }, 'clone')).toBe('republic');
    expect(suggestSide({ crew: 'xwing', hero: 'rick' }, 'gcw')).toBe('rebel');
  });
});

describe('teamFor', () => {
  // (gcw.js's battleAt lists a battle's sides by team: the light side 0, the dark 1)
  const lib = { attacker: 'rebel', defender: 'empire', sides: ['rebel', 'empire'] };
  const hutts = { attacker: 'hutt', defender: 'rebel', sides: ['rebel', 'hutt'] };
  it('your team is your side’s place in the battle', () => {
    expect(teamFor('rebel', lib)).toBe(0);
    expect(teamFor('empire', lib)).toBe(1);
    expect(teamFor('rebel', hutts)).toBe(0);
  });
  it('unsworn, or not in the battle, nobody’s', () => {
    expect(teamFor(null, lib)).toBeNull();
    expect(teamFor('empire', hutts)).toBeNull();
    expect(teamFor('rebel', null)).toBeNull();
  });
});

describe('oathIn', () => {
  it('gives the oath in another war, unsworn when none', () => {
    const a = swear(readAllegiance(null, { now: NOW }), 'rebel', NOW);
    expect(oathIn(a, 'clone')).toEqual({ war: 'clone', side: null, sworn: 0, turncoat: false });
    expect(oathIn(a, 'gcw').side).toBe('rebel');
    expect(oathIn(a, 'gcw')).toEqual(current(a));
  });
});
