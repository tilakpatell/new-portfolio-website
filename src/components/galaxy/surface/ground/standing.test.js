import { describe, expect, test } from 'vitest';
import { SIDES, WARS } from '../../sides';
import { NATIVES, SIDE_OF_KIND, relation, sideOfKind, standingOf } from './standing';

describe('standing', () => {
  test('a kind is its war’s side', () => {
    expect(sideOfKind('stormtrooper', 'gcw')).toBe('empire');
    expect(sideOfKind('stormtrooper', 'remnant')).toBe('remnant');
    expect(sideOfKind('rebel', 'remnant')).toBe('newrepublic');
    expect(sideOfKind('battledroid', 'clone')).toBe('separatists');
    expect(sideOfKind('weequay', 'gcw')).toBe('hutt');
    expect(sideOfKind('wookiee', 'clone')).toBe('native');
    expect(sideOfKind('womprat', 'gcw')).toBeNull();
  });
  test('every kind names a real side in every war', () => {
    for (const kind of Object.keys(SIDE_OF_KIND)) for (const w of Object.keys(WARS)) expect(SIDES[sideOfKind(kind, w)], `${kind} ${w}`).toBeTruthy();
    for (const kind of Object.keys(NATIVES)) expect(sideOfKind(kind, 'gcw')).toBe('native');
  });
  test('relation: same side ally, the war’s two sides enemies, the Hutts everyone’s enemy, natives by lean, nobody neutral', () => {
    expect(relation('rebel', 'rebel', 'gcw')).toBe('ally');
    expect(relation('rebel', 'empire', 'gcw')).toBe('enemy');
    expect(relation('hutt', 'empire', 'gcw')).toBe('enemy');
    expect(relation('hutt', 'rebel', 'gcw')).toBe('enemy');
    expect(relation({ native: 'wookiee' }, 'republic', 'clone')).toBe('ally');
    expect(relation({ native: 'wookiee' }, 'separatists', 'clone')).toBe('neutral');
    expect(relation({ native: 'geonosian' }, 'republic', 'clone')).toBe('neutral');
    expect(relation({ native: 'geonosian' }, 'separatists', 'clone')).toBe('ally');
    expect(relation({ native: 'jawa' }, 'rebel', 'gcw')).toBe('neutral');
    expect(relation(null, 'empire', 'gcw')).toBe('neutral');
    for (const w of Object.keys(WARS)) for (const a of Object.keys(SIDES)) for (const b of Object.keys(SIDES)) expect(relation(a, b, w)).toBe(relation(b, a, w));
  });
  test('a side out of the world’s war is nobody’s enemy', () => {
    expect(relation('republic', 'empire', 'gcw')).toBe('neutral');
    expect(relation('republic', 'hutt', 'gcw')).toBe('neutral');
  });
  test('standingOf: unsworn is neutral to all', () => {
    expect(standingOf('empire', { side: null, war: 'gcw' })).toBe('neutral');
    expect(standingOf('empire', { side: 'rebel', war: 'gcw' })).toBe('enemy');
    expect(standingOf('rebel', { side: 'rebel', war: 'gcw' })).toBe('ally');
    expect(standingOf('hutt', { side: 'rebel', war: 'gcw' })).toBe('neutral'); // (the Hutts' guards watch you: they hunt nobody)
  });
});
