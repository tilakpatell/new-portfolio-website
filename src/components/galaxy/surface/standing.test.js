import { describe, it, expect } from 'vitest';
import { standingOf, sideOfKind, NATIVE_LEANS } from './standing.js';

const rebelOnEndor = { war: 'gcw', side: 'rebel', owner: 'empire' };
const unsworn = { war: 'gcw', side: null, owner: 'empire' };

describe('standing', () => {
  it('a stormtrooper is a Rebel’s enemy, nobody’s when you are unsworn', () => {
    expect(standingOf({ kind: 'stormtrooper' }, rebelOnEndor)).toBe('enemy');
    expect(standingOf({ kind: 'stormtrooper' }, unsworn)).toBe('neutral');
  });
  it('your own side is your ally', () => {
    expect(standingOf({ kind: 'rebel' }, rebelOnEndor)).toBe('ally');
  });
  it('an Ewok leans to the light side; a Jawa to nobody', () => {
    expect(standingOf({ kind: 'ewok' }, rebelOnEndor)).toBe('ally');
    expect(standingOf({ kind: 'ewok' }, { ...rebelOnEndor, side: 'empire' })).toBe('neutral');
    expect(standingOf({ kind: 'jawa' }, rebelOnEndor)).toBe('neutral');
  });
  it('an entry’s own side wins over its kind (Gree is the Republic’s whatever he wears)', () => {
    expect(standingOf({ kind: 'clone', side: 'republic' }, { war: 'clone', side: 'separatists' })).toBe('enemy');
  });
  it('stormtroopers are the Remnant’s in the Remnant War', () => {
    expect(sideOfKind('stormtrooper', 'remnant')).toBe('remnant');
    expect(sideOfKind('stormtrooper', 'gcw')).toBe('empire');
  });
  it('the Hutts are nobody’s ally and nobody’s enemy on the ground', () => {
    expect(standingOf({ kind: 'mercenary' }, rebelOnEndor)).toBe('neutral');
    expect(sideOfKind('mercenary', 'gcw')).toBe('hutt');
  });
  it('every trooper family, the droids and the walkers have a side', () => {
    expect(sideOfKind('sandtrooper', 'gcw')).toBe('empire');
    expect(sideOfKind('hothtrooper', 'remnant')).toBe('newrepublic');
    expect(sideOfKind('superdroid', 'clone')).toBe('separatists');
    expect(sideOfKind('droideka', 'clone')).toBe('separatists');
    expect(sideOfKind('atat', 'gcw')).toBe('empire');
    expect(sideOfKind('atap', 'clone')).toBe('republic');
    expect(sideOfKind('rebelpilot', 'gcw')).toBe('rebel');
    expect(sideOfKind('rebelpilot', 'remnant')).toBe('newrepublic');
  });
  it('natives are native, and lean as the film has them', () => {
    expect(sideOfKind('wookiee', 'gcw')).toBe('native');
    expect(NATIVE_LEANS).toMatchObject({ wookiee: 'light', ewok: 'light', gungan: 'light', geonosian: 'dark', kaminoan: null, jawa: null, tusken: null, villager: null });
    expect(standingOf({ kind: 'geonosian' }, { war: 'clone', side: 'separatists' })).toBe('ally');
    expect(standingOf({ kind: 'geonosian' }, { war: 'clone', side: 'republic' })).toBe('neutral');
  });
  it('an entry may say its own lean, and unknown kinds are nobody’s', () => {
    expect(standingOf({ kind: 'villager', leans: 'dark' }, { war: 'gcw', side: 'empire' })).toBe('ally');
    expect(standingOf({ kind: 'astromech' }, rebelOnEndor)).toBe('neutral');
    expect(standingOf(null, rebelOnEndor)).toBe('neutral');
    expect(standingOf({ kind: 'clone' }, null)).toBe('neutral');
  });
  it('a side from another war is nobody’s in this one', () => {
    expect(standingOf({ kind: 'clone' }, rebelOnEndor)).toBe('neutral');
  });
});
