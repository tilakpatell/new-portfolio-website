import { describe, expect, it } from 'vitest';
import { GCW, warTable } from './gcw';
import { WAR_IDS } from './sides';
import { ago, areaLines, battleLine, eventLine, heldColour, oathOf, orderLine, phaseLine, progressOf, recordLine, resultLine, standing, strengthLine } from './warText';

const NOW = 1_000_000;
const row = (o) => ({ id: 'hoth', owner: 'empire', control: 0.75, front: false, attack: null, rate: null, ...o });

describe('a system’s place in a war, in words', () => {
  it('a front is the liberator’s progress: how much of the holder’s hold is gone', () => {
    expect(progressOf(row({ front: true }))).toBeCloseTo(0.25, 5);
    expect(standing(row({ front: true, rate: 4 }), NOW, 'gcw')).toBe('25% liberated · +4.0%/h');
  });
  it('a front’s rate is the one that applies (its supply, areas and defence in it), when it’s known', () => {
    expect(standing(row({ front: true, rate: 4, effRate: 2.35 }), NOW, 'gcw')).toBe('25% liberated · +2.4%/h');
    expect(standing(row({ front: true, rate: 4, effRate: -0.5 }), NOW, 'gcw')).toBe('25% liberated · −0.5%/h');
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

describe('the war’s news', () => {
  const H = 3600e3;
  it('says how long ago', () => {
    expect(ago(20e3)).toBe('just now');
    expect(ago(12 * 60e3)).toBe('12m ago');
    expect(ago(2 * H + 5 * 60e3)).toBe('2h ago');
    expect(ago(50 * H)).toBe('2d ago');
  });
  it('tells of each thing that happened, and when', () => {
    const at = NOW - 2 * H;
    expect(eventLine({ type: 'captured', sys: 'hoth', by: 'empire', from: 'rebel', at }, NOW)).toBe('Hoth fell to the Empire · 2h ago');
    expect(eventLine({ type: 'captured', sys: 'naboo', by: 'hutt', from: 'republic', at }, NOW)).toBe('Naboo fell to the Hutts · 2h ago');
    expect(eventLine({ type: 'capital', sys: 'coruscant', by: 'rebel', from: 'empire', at }, NOW)).toBe('Coruscant, the Empire’s capital, fell to the Rebellion · 2h ago');
    expect(eventLine({ type: 'attack', sys: 'hoth', by: 'empire', holder: 'rebel', origin: 'bespin', at }, NOW)).toBe('The Empire attacks Hoth from Bespin · 2h ago');
    expect(eventLine({ type: 'attack', sys: 'hoth', by: 'empire', holder: 'rebel', origin: 'bespin', counter: true, at }, NOW)).toBe('The Empire strikes back at Hoth from Bespin · 2h ago');
    expect(eventLine({ type: 'raid', sys: 'naboo', by: 'hutt', holder: 'republic', origin: 'tatooine', at }, NOW)).toBe('The Hutts raid Naboo from Tatooine · 2h ago');
    expect(eventLine({ type: 'repelled', sys: 'yavin', by: 'empire', holder: 'rebel', at }, NOW)).toBe('The Rebellion held Yavin 4 · 2h ago');
    expect(eventLine({ type: 'area', area: 'north', by: 'rebel', from: null, at }, NOW)).toBe('The Rebellion holds all of the Northern Rim · 2h ago');
    expect(eventLine({ type: 'lastStand', sys: 'geonosis', by: 'separatists', at }, NOW)).toBe('The Separatists’ last stand, at Geonosis · 2h ago');
    expect(eventLine({ type: 'phase', phase: 'Escalation', sys: null, at }, NOW)).toBe('The war escalates · 2h ago');
    expect(eventLine({ type: 'phase', phase: 'Climax', sys: 'coruscant', at }, NOW)).toBe('The climax: the decisive battle, at Coruscant · 2h ago');
  });
  it('has words for everything a real campaign tells of', () => {
    const types = new Set();
    for (const war of WAR_IDS)
      for (const n of [0, 1]) {
        const end = GCW.start + (n + 1) * GCW.campaign - 1;
        const t = warTable(war, end, () => 0);
        for (const e of t.events) {
          types.add(e.type);
          const line = eventLine(e, end);
          expect(line, JSON.stringify(e)).not.toMatch(/undefined|null|NaN/);
          expect(line.startsWith(e.type)).toBe(false);
        }
        expect(resultLine(t)).toMatch(/^The .+ won campaign \d+ · /);
        expect(phaseLine(t, end)).toMatch(/^Climax · /);
        for (const side of Object.keys(t.strength)) expect(strengthLine(t, side)).toMatch(/system/);
      }
    for (const type of ['captured', 'attack', 'raid', 'repelled', 'phase']) expect(types, type).toContain(type);
  });
  it('each side’s strength: its systems, its share of the galaxy’s worth, and which way it’s gone in six hours', () => {
    const table = { strength: { rebel: { systems: 9, worth: 9, share: 0.413, trend6h: 2 }, empire: { systems: 1, worth: 1, share: 0.043, trend6h: -1 }, hutt: { systems: 2, worth: 2, share: 0.087, trend6h: 0 } } };
    expect(strengthLine(table, 'rebel')).toBe('9 systems · 41% of the galaxy’s worth · ▲2 in 6h');
    expect(strengthLine(table, 'empire')).toBe('1 system · 4% of the galaxy’s worth · ▼1 in 6h');
    expect(strengthLine(table, 'hutt')).toBe('2 systems · 9% of the galaxy’s worth');
    expect(strengthLine(table, 'republic')).toBeNull();
  });
  it('the campaign’s phase, and how long till the next (or the end)', () => {
    expect(phaseLine({ phase: { name: 'Escalation', until: NOW + 30 * H + 6 * 60e3, next: 'Decisive' } }, NOW)).toBe('Escalation · the decisive phase in 30h 6m');
    expect(phaseLine({ phase: { name: 'Opening', until: NOW + 61 * 60e3, next: 'Escalation' } }, NOW)).toBe('Opening · escalation in 1h 1m');
    expect(phaseLine({ phase: { name: 'Climax', until: NOW + 2 * H, next: null } }, NOW)).toBe('Climax · 2h 0m to the end');
  });
  it('a side’s order, and the time left on it', () => {
    expect(orderLine({ sys: 'hoth', verb: 'liberate', until: NOW + 4 * H + 12 * 60e3 }, NOW)).toBe('Liberate Hoth · 4h 12m left');
    expect(orderLine({ sys: 'coruscant', verb: 'hold', until: NOW + 90e3 }, NOW)).toBe('Hold Coruscant · 1:30 left');
    expect(orderLine({ sys: 'naboo', verb: 'take', until: NOW + 90e3 }, NOW)).toBe('Take Naboo · 1:30 left');
    expect(orderLine(null, NOW)).toBeNull();
  });
  it('the campaign’s result: who won on victory points, by how much, and where it was decided', () => {
    expect(resultLine({ campaign: 6, result: { winner: 'empire', vp: { rebel: 8, empire: 12, hutt: 3 }, decisive: 'coruscant', over: null } })).toBe('The Empire won campaign 7 · 12–8 on victory points · decisive at Coruscant');
    expect(resultLine({ campaign: 2, result: { winner: 'republic', vp: { republic: 23, separatists: 0, hutt: 0 }, decisive: 'geonosis', over: 'republic' } })).toBe('The Republic won campaign 3 outright: every system theirs · decisive at Geonosis');
    expect(resultLine({ campaign: 2, result: null })).toBeNull();
  });
});
