import { describe, expect, it } from 'vitest';
import { factionText, factionsFrom, relation } from './relations';

const NONE = { side: null, standing: null, war: null, oath: null, rank: null };
const f = (over) => ({ ...NONE, ...over });
const calm = { law: null, civil: null, outlaw: null };

describe('relation', () => {
  it('relation: an alliance wins', () => {
    // (even over opposite oaths: you made it, so they're with you)
    expect(relation({ ally: true, factions: f({ war: 'gcw', oath: 'rebel' }) }, { factions: f({ war: 'gcw', oath: 'empire' }) })).toBe('ally');
    expect(relation({ ally: false, factions: NONE }, { ally: 'ally', factions: NONE })).toBe('ally');
  });
  it('relation: the same oath is a friend', () => {
    expect(relation({ factions: f({ war: 'gcw', oath: 'rebel' }) }, { factions: f({ war: 'gcw', oath: 'rebel' }) })).toBe('friend');
    // or the same universe's law trusts you both
    const trusted = f({ side: 'rickmorty', standing: { ...calm, law: 'trusted' } });
    expect(relation({ factions: trusted }, { factions: trusted })).toBe('friend');
  });
  it('relation: opposite oaths in one war are foes', () => {
    expect(relation({ factions: f({ war: 'gcw', oath: 'rebel' }) }, { factions: f({ war: 'gcw', oath: 'empire' }) })).toBe('foe');
    // (sides of two different wars aren't at war with each other)
    expect(relation({ factions: f({ war: 'gcw', oath: 'rebel' }) }, { factions: f({ war: 'clone', oath: 'separatists' }) })).toBe('none');
  });
  it('relation: wanted by my side\'s law is a foe', () => {
    const wanted = f({ side: 'starwars', standing: { ...calm, law: 'wanted' } });
    expect(relation({ factions: f({ side: 'starwars' }) }, { factions: wanted })).toBe('foe');
    // another universe's law isn't yours to answer to
    expect(relation({ factions: f({ side: 'breakingbad' }) }, { factions: wanted })).toBe('none');
  });
  it('is nobody\'s with nothing to go on', () => {
    expect(relation({ factions: NONE }, { factions: NONE })).toBe('none');
    expect(relation({}, {})).toBe('none');
    expect(relation(null, undefined)).toBe('none');
  });
});

describe('factionText', () => {
  it('factionText names the oath, rank and standing', () => {
    expect(factionText(f({ war: 'gcw', oath: 'rebel', rank: 'captain' }))).toBe('Rebellion · Captain');
    expect(factionText(f({ side: 'starwars', standing: { ...calm, law: 'wanted' } }))).toBe('Wanted by the Empire');
    expect(factionText(f({ side: 'starwars', standing: { ...calm, outlaw: 'friend' } }))).toBe('Friend to the Weequay pirates');
    expect(factionText(f({ war: 'gcw', oath: 'empire', rank: 'ensign', side: 'breakingbad', standing: { ...calm, law: 'trusted' } }))).toBe('Empire · Ensign · Trusted by the DEA');
  });
  it('says the most telling standing only', () => {
    expect(factionText(f({ side: 'rickmorty', standing: { law: 'wanted', civil: 'hero', outlaw: 'friend' } }))).toBe('Wanted by the Federation');
  });
  it('is empty with nothing to say', () => {
    expect(factionText(NONE)).toBe('');
    expect(factionText(null)).toBe('');
    expect(factionText(f({ side: 'starwars', standing: calm }))).toBe('');
  });
});

describe('factionsFrom', () => {
  it('reads the side from the ship and the rest from the wallet\'s marks', () => {
    const marks = { standing: { starwars: { ...calm, law: 'trusted' }, rickmorty: calm }, oath: { war: 'gcw', side: 'rebel', rank: 'pilot' } };
    expect(factionsFrom('xwing', marks)).toEqual({ side: 'starwars', standing: { ...calm, law: 'trusted' }, war: 'gcw', oath: 'rebel', rank: 'pilot' });
  });
  it('is nothing with no ship and no marks', () => {
    expect(factionsFrom(null, null)).toEqual(NONE);
    expect(factionsFrom('cruiser', null)).toEqual({ ...NONE, side: 'rickmorty' });
  });
});
