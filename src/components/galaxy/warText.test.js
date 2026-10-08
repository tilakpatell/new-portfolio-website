import { describe, expect, it } from 'vitest';
import { areaLines, battleLine, heldColour, oathOf, progressOf, recordLine, standing } from './warText';

const NOW = 1_000_000;
const row = (o) => ({ id: 'hoth', owner: 'empire', control: 0.75, front: false, attack: null, rate: null, ...o });

describe('a system’s place in a war, in words', () => {
  it('a front is the liberator’s progress: how much of the holder’s hold is gone', () => {
    expect(progressOf(row({ front: true }))).toBeCloseTo(0.25, 5);
    expect(standing(row({ front: true, rate: 4 }), NOW, 'gcw')).toBe('25% liberated · +4.0%/h');
  });
  it('under attack it’s the holder’s hold, and the time left to hold out', () => {
    const r = row({ owner: 'rebel', attack: { by: 'empire', until: NOW + 90e3 }, control: 0.6 });
    expect(progressOf(r)).toBeCloseTo(0.6, 5);
    expect(standing(r, NOW, 'gcw')).toBe('The Empire attacks: 60% held, 1:30 to hold out');
  });
  it('a Hutt raid says so', () => {
    expect(standing(row({ owner: 'empire', attack: { by: 'hutt', until: NOW + 60e3 }, control: 0.5 }), NOW, 'gcw')).toBe('The Hutts raid: 50% held, 1:00 to hold out');
  });
  it('a quiet system names its holder, the Hutts’ as Hutt space', () => {
    expect(standing(row({ owner: 'separatists' }), NOW, 'clone')).toBe('Held by the Separatists');
    expect(standing(row({ owner: 'hutt' }), NOW, 'gcw')).toBe('Hutt space');
  });
  it('colours a system its holder’s', () => {
    expect(heldColour('rebel')).toMatch(/^#/);
    expect(heldColour('hutt')).not.toBe(heldColour('rebel'));
    expect(heldColour(undefined)).toBeUndefined();
  });
});

describe('the war card', () => {
  it('lists the areas, who holds each whole, and how many of yours there are', () => {
    const areas = { core: { total: 2, rebel: 2, holder: 'rebel' }, anoat: { total: 4, empire: 3, rebel: 1, holder: null } };
    const lines = areaLines(areas, 'rebel');
    expect(lines).toEqual([
      { id: 'core', name: 'The Core and Kashyyyk', text: 'The Rebellion’s, all 2', yours: true },
      { id: 'anoat', name: 'Anoat and Atravis', text: '1 of 4 the Rebellion’s', yours: false },
    ]);
    expect(areaLines({ anoat: { total: 4, hutt: 4, holder: 'hutt' } }, null)[0].text).toBe('Hutt space, all 4');
  });
  it('a record line: your rank, your points, your battles', () => {
    expect(recordLine('rebel', { points: 16.2, wins: 2, battles: 3 })).toBe('Flight Leader · 16 points · 2 won of 3 battles');
    expect(recordLine('empire', { points: 0, wins: 0, battles: 0 })).toBe('Ensign · no battles yet');
    expect(recordLine(null, { points: 5, wins: 0, battles: 1 })).toBeNull();
  });
  it('the oath card: the war’s two sides, the one sworn and the one suggested', () => {
    expect(oathOf('gcw', { side: 'empire' }, 'rebel')).toEqual({
      war: 'gcw',
      sides: [
        { id: 'rebel', name: 'Rebel Alliance', colour: expect.any(String), sworn: false, suggested: true },
        { id: 'empire', name: 'Galactic Empire', colour: expect.any(String), sworn: true, suggested: false },
      ],
    });
  });
  it('a system’s battle in a line: its kind for your part in it, its clock', () => {
    const row = { id: 'hoth', kind: 'evacuation', battle: { fighting: true, fightEnd: NOW + 125e3, end: NOW + 245e3, attacker: 'empire', defender: 'rebel' } };
    expect(battleLine(row, NOW, 'rebel')).toBe('Hold the evacuation · 2:05 left');
    expect(battleLine(row, NOW, 'empire')).toBe('Stop the evacuation · 2:05 left');
    expect(battleLine(row, NOW, 'republic')).toBe('Evacuation · 2:05 left');
    expect(battleLine(row, NOW, null)).toBe('Evacuation · 2:05 left');
    expect(battleLine({ ...row, battle: { ...row.battle, fighting: false } }, NOW, 'rebel')).toBe('Evacuation: regrouping, the next in 4:05');
    expect(battleLine({ ...row, battle: null }, NOW, 'rebel')).toBeNull();
  });
});
