import { describe, expect, it } from 'vitest';
import { afterLine, areaLines, battleLine, endCard, heldColour, nextLine, oathOf, objectiveBars, progressOf, recordLine, resultTitle, stageLine, standing, whyLine, yoursLine } from './warText';

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

// the battle you're in, as warfront.js's info has it (its stage, its
// objectives' shared hp, what's next and how it ended)
const fight = (o = {}) => ({
  sys: 'hoth',
  team: 1,
  side: 'empire',
  on: { id: 'c0.gcw.hoth.3', sides: ['rebel', 'empire'], attackerTeam: 1, end: NOW + 245e3, fightEnd: NOW + 125e3 },
  laid: { attacker: 1, kind: 'evacuation' },
  stage: { index: 0, count: 3, open: true, opensIn: 0, need: 2 },
  objectives: [
    { id: 'gen-port', name: 'Shield generator', type: 'group', hp: 70, hpMax: 140, down: false },
    { id: 'gen-star', name: 'Shield generator', type: 'group', hp: 0, hpMax: 140, down: true },
  ],
  next: { type: 'wave', at: 180, in: 40, name: 'the bomber wave' },
  result: null,
  ...o,
});

describe('the battle you’re in, in words (WarHud, BattleEnd)', () => {
  it('a stage line: which stage of how many, and your side’s part in it', () => {
    expect(stageLine(fight())).toBe('Stage 1 of 3 · Destroy: Shield generator ×2');
    expect(stageLine(fight({ team: 0, side: 'rebel' }))).toBe('Stage 1 of 3 · Defend: Shield generator ×2');
    expect(stageLine(fight({ stage: { index: 1, count: 3, open: false, opensIn: 70, need: 1 }, objectives: [{ id: 'bridge', name: 'Bridge', type: 'destroy', hp: 300, hpMax: 300, down: false }] }))).toBe('Stage 2 of 3 · Bridge opens in 1:10');
    // (three of four to take, a zone to hold, and the plan's own words for a boarding)
    const sats = [0, 1, 2, 3].map((n) => ({ id: `sat-${n}`, name: 'Shield projector', type: 'group', hp: 93, hpMax: 93, down: false }));
    expect(stageLine(fight({ stage: { index: 0, count: 3, open: true, opensIn: 0, need: 3 }, objectives: sats }))).toBe('Stage 1 of 3 · Destroy: 3 of 4 Shield projectors');
    expect(stageLine(fight({ objectives: [{ id: 'relay', name: 'the comms relay', type: 'zone', hp: 300, hpMax: 300, down: false }], stage: { index: 1, count: 3, open: true, opensIn: 0, need: 1 } }))).toBe('Stage 2 of 3 · Hold: the comms relay');
    expect(stageLine(fight({ objectives: [{ id: 'engines', name: 'the Tantive IV’s engines', type: 'destroy', verbs: ['Disable', 'Defend'], hp: 1, hpMax: 2, down: false }], stage: { index: 0, count: 3, open: true, opensIn: 0, need: 2 } }))).toBe('Stage 1 of 3 · Disable: the Tantive IV’s engines');
    expect(stageLine(fight({ team: null, side: null }))).toBe('Stage 1 of 3 · Shield generator ×2');
    expect(stageLine(fight({ stage: null }))).toBeNull();
  });
  it('up to three objective bars, each its share of hp left', () => {
    expect(objectiveBars(fight())).toEqual([
      { id: 'gen-port', name: 'Shield generator', k: 0.5, down: false },
      { id: 'gen-star', name: 'Shield generator', k: 0, down: true },
    ]);
    const many = Array.from({ length: 5 }, (_, n) => ({ id: `p${n}`, name: 'Orbital defence platform', type: 'group', hp: 10, hpMax: 40, down: false }));
    expect(objectiveBars(fight({ objectives: many }))).toHaveLength(3);
  });
  it('says what’s coming next on the battle’s clock', () => {
    expect(nextLine({ type: 'wave', in: 40, name: 'the bomber wave' })).toBe('Bomber wave in 0:40');
    expect(nextLine({ type: 'push', in: 130, name: 'the final push' })).toBe('Final push in 2:10');
    expect(nextLine({ type: 'ace', in: 5, name: 'Darth Vader' })).toBe('Darth Vader in 0:05');
    expect(nextLine(null)).toBeNull();
  });
  it('says why it ended in words', () => {
    expect(whyLine({ winner: 1, why: 'flagship' })).toBe('The reactor went');
    expect(whyLine({ winner: 1, why: 'interdictor' })).toBe('The Interdictor went down');
    expect(whyLine({ winner: 0, why: 'deathstar' })).toBe('The Death Star’s reactor went');
    expect(whyLine({ winner: 0, why: 'gate' })).toBe('The Shield Gate fell');
    expect(whyLine({ winner: 0, why: 'clock' })).toBe('Held out to the end');
    expect(whyLine({ winner: 0, why: 'runners', runners: { kind: 'transport', team: 0, out: 6, down: 1 } })).toBe('Six transports got away');
    expect(whyLine({ winner: 1, why: 'runners', runners: { kind: 'transport', team: 0, out: 2, down: 4 } })).toBe('Four transports were stopped');
    expect(whyLine({ winner: 0, why: 'forced' })).toBe('Called off');
  });
  it('victory or defeat by your side, and what you did in it', () => {
    expect(resultTitle({ winner: 1 }, 1)).toBe('Victory');
    expect(resultTitle({ winner: 0 }, 1)).toBe('Defeat');
    expect(resultTitle({ winner: 0 }, null)).toBe('Battle over');
    expect(yoursLine({ kills: 3, objectives: 1, intercepts: 0, points: 13.3 })).toBe('3 kills · 1 objective');
    expect(yoursLine({ kills: 1, objectives: 0, intercepts: 2, points: 2.1 })).toBe('1 kill · 2 intercepts');
    expect(yoursLine({ kills: 0, objectives: 0, intercepts: 0, points: 0 })).toBe('You weren’t in among it');
  });
  it('after an early end, the line over the galaxy: who won here, and when the next one’s on', () => {
    const ended = fight({ result: { winner: 1, why: 'flagship', at: 400, ago: 2, yours: { kills: 0, objectives: 0, intercepts: 0, points: 0 } } });
    expect(afterLine(ended, 'Hoth', NOW)).toBe('Victory at Hoth · next battle in 4:05');
    expect(afterLine({ ...ended, team: 0, side: 'rebel' }, 'Hoth', NOW)).toBe('Defeat at Hoth · next battle in 4:05');
    expect(afterLine({ ...ended, team: null, side: null }, 'Hoth', NOW)).toBe('The Empire won at Hoth · next battle in 4:05');
  });
  it('the end card: its title, why in words, what you did and your points', () => {
    const ended = fight({ result: { winner: 1, why: 'flagship', at: 400, ago: 2, yours: { kills: 4, objectives: 2, intercepts: 0, points: 16.4 } } });
    expect(endCard(ended)).toEqual({ title: 'Victory', tone: 'won', why: 'The reactor went', yours: '4 kills · 2 objectives', points: '+16 points' });
    expect(endCard({ ...ended, team: 0 })).toMatchObject({ title: 'Defeat', tone: 'lost' });
    expect(endCard(fight())).toBeNull();
  });
});
