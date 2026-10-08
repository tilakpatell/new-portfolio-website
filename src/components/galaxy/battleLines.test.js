import { describe, expect, it } from 'vitest';
import { CREWS } from '../universe/crews';
import { WAR_SYSTEMS } from './gcw';
import { WARS } from './sides';
import { BATTLE_KEYS, BATTLE_LINES, HUTT_KEYS, PLACES, battleLines, fill } from './battleLines';

const STANCES = ['light', 'dark'];
const exchangesOf = (crew) => {
  const b = BATTLE_LINES[crew];
  const out = [];
  for (const [key, by] of Object.entries(b.battle)) for (const [stance, ex] of Object.entries(by)) out.push([`${crew} battle ${key} ${stance}`, ex]);
  for (const [war, keys] of Object.entries(b.battleWar)) for (const [key, by] of Object.entries(keys)) for (const [stance, ex] of Object.entries(by)) out.push([`${crew} ${war} ${key} ${stance}`, ex]);
  for (const [sys, { war, ...keys }] of Object.entries(b.battleAt)) for (const [key, by] of Object.entries(keys)) for (const [stance, ex] of Object.entries(by)) out.push([`${crew} ${sys} (${war}) ${key} ${stance}`, ex]);
  return out;
};

describe('the crews’ battle lines', () => {
  it('are the four crews’', () => {
    expect(Object.keys(BATTLE_LINES).sort()).toEqual(CREWS.map((c) => c.id).sort());
  });
  it('have every battle key for both sides in every crew, the ask for either, and the Hutts’ for a front, a win and a loss', () => {
    // (seventeen, and since the battle plans five more, one for each kind of
    // stage or side objective that has its own: a group of targets, a zone,
    // a boarding, a bomber wave, an ace joining: battleCrews/stages.js)
    expect(BATTLE_KEYS).toHaveLength(22);
    for (const key of ['group', 'zone', 'board', 'wave', 'hunt']) expect(BATTLE_KEYS).toContain(key);
    for (const crew of Object.keys(BATTLE_LINES)) {
      const b = BATTLE_LINES[crew].battle;
      expect(Object.keys(b).sort(), crew).toEqual([...BATTLE_KEYS].sort());
      for (const key of BATTLE_KEYS) {
        if (key === 'ask') expect(b.ask.any, crew).toBeTruthy();
        else for (const s of STANCES) expect(b[key][s], `${crew} ${key} ${s}`).toBeTruthy();
      }
      for (const key of HUTT_KEYS) expect(b[key].hutt, `${crew} ${key} hutt`).toBeTruthy();
    }
  });
  it('have a war’s own front and win for each side in every war', () => {
    for (const crew of Object.keys(BATTLE_LINES))
      for (const war of Object.keys(WARS))
        for (const key of ['front', 'won']) for (const s of STANCES) expect(BATTLE_LINES[crew].battleWar[war]?.[key]?.[s], `${crew} ${war} ${key} ${s}`).toBeTruthy();
  });
  it('have the places’ own, at the films’ systems, in the war each belongs to, of keys there are', () => {
    expect(PLACES).toEqual({ endor: 'gcw', hoth: 'gcw', scarif: 'gcw', yavin: 'gcw', bespin: 'gcw', coruscant: 'clone', naboo: 'clone', lothal: 'remnant' });
    for (const crew of Object.keys(BATTLE_LINES)) {
      const at = BATTLE_LINES[crew].battleAt;
      expect(Object.keys(at).sort(), crew).toEqual(Object.keys(PLACES).sort());
      for (const [sys, { war, ...keys }] of Object.entries(at)) {
        expect(war, `${crew} ${sys}`).toBe(PLACES[sys]);
        expect(WAR_SYSTEMS).toContain(sys);
        for (const key of ['front', 'won']) for (const s of STANCES) expect(keys[key]?.[s], `${crew} ${sys} ${key} ${s}`).toBeTruthy();
        for (const key of Object.keys(keys)) expect(BATTLE_KEYS, `${crew} ${sys} ${key}`).toContain(key);
      }
    }
  });
  it('say every line in the crew’s own voices, in a breath, with only the blanks the battle fills', () => {
    for (const crew of CREWS)
      for (const [what, ex] of exchangesOf(crew.id)) {
        expect(Array.isArray(ex) && ex.length, what).toBeGreaterThan(0);
        expect(ex.length, what).toBeLessThanOrEqual(4);
        for (const [who, text] of ex) {
          expect(who === 'comms' || Boolean(crew.speakers[who]), `${what}: ${who}`).toBe(true);
          expect(text.length, `${what}: ${text}`).toBeLessThanOrEqual(120);
          expect(text, what).not.toMatch(/['"]/);
          if (who === 'r2' || who === 'chewie') expect(text, what).toMatch(/^\[.+\]$/);
          for (const blank of text.match(/\{[^}]*\}/g) ?? []) expect(['{us}', '{them}', '{place}'], `${what}: ${blank}`).toContain(blank);
          expect(text, `${what}: a blank starts a sentence`).not.toMatch(/(^|[.!?]\s+)\{/);
        }
      }
  });
});

describe('battleLines', () => {
  const crew = 'cruiser';
  it('fills the blanks: your side, theirs, the place', () => {
    expect(fill([['rick', 'For {us}, against {them}, at {place}.']], { side: 'rebel', against: 'empire', sys: 'hoth' })).toEqual([['rick', 'For the Rebellion, against the Empire, at Hoth.']]);
    expect(fill([['rick', 'Not {them} again.']], { side: 'republic', against: 'hutt', sys: 'naboo' })[0][1]).toBe('Not the Hutts again.');
    // (a line's clip, if it has one, kept)
    expect(fill([['rick', 'Hi.', 'clip']], { side: 'rebel', against: 'empire', sys: 'hoth' })[0]).toEqual(['rick', 'Hi.', 'clip']);
  });
  it('a place’s own is only its war’s', () => {
    const b = BATTLE_LINES[crew];
    const raw = (ex) => ex.map(([w, t]) => [w, t]);
    expect(raw(battleLines(crew, { key: 'front', side: 'republic', war: 'clone', sys: 'hoth', against: 'separatists' }))).toEqual(raw(fill(b.battleWar.clone.front.light, { side: 'republic', against: 'separatists', sys: 'hoth' })));
  });
  it('prefers the Hutts’ against the Hutts, else the place’s, then the war’s, then the side’s', () => {
    const b = BATTLE_LINES[crew];
    const raw = (ex) => ex.map(([w, t]) => [w, t]);
    expect(raw(battleLines(crew, { key: 'front', side: 'rebel', war: 'gcw', sys: 'hoth', against: 'empire' }))).toEqual(raw(fill(b.battleAt.hoth.front.light, { side: 'rebel', against: 'empire', sys: 'hoth' })));
    expect(raw(battleLines(crew, { key: 'front', side: 'rebel', war: 'gcw', sys: 'kamino', against: 'empire' }))).toEqual(raw(fill(b.battleWar.gcw.front.light, { side: 'rebel', against: 'empire', sys: 'kamino' })));
    expect(raw(battleLines(crew, { key: 'won', side: 'separatists', war: 'clone', sys: 'tatooine', against: 'hutt' }))).toEqual(raw(fill(b.battle.won.hutt, { side: 'separatists', against: 'hutt', sys: 'tatooine' })));
    expect(raw(battleLines(crew, { key: 'front', side: 'rebel', war: 'gcw', sys: 'hoth', against: 'hutt' }))).toEqual(raw(fill(b.battle.front.hutt, { side: 'rebel', against: 'hutt', sys: 'hoth' })));
    expect(raw(battleLines(crew, { key: 'gens', side: 'empire', war: 'gcw', sys: 'kamino', against: 'rebel' }))).toEqual(raw(fill(b.battle.gens.dark, { side: 'empire', against: 'rebel', sys: 'kamino' })));
  });
  it('asks either way, and has nothing for nobody', () => {
    expect(battleLines(crew, { key: 'ask', side: null, war: 'gcw', sys: 'hoth', against: null })).toBeTruthy();
    expect(battleLines(crew, { key: 'front', side: null, war: 'gcw', sys: 'hoth', against: 'empire' })).toBeNull();
    expect(battleLines('nobody', { key: 'front', side: 'rebel', war: 'gcw', sys: 'hoth', against: 'empire' })).toBeNull();
    expect(battleLines(crew, { key: 'nothing', side: 'rebel', war: 'gcw', sys: 'hoth', against: 'empire' })).toBeNull();
  });
  it('leaves no blank unfilled in any line it gives', () => {
    for (const c of Object.keys(BATTLE_LINES))
      for (const key of BATTLE_KEYS)
        for (const [war, w] of Object.entries(WARS))
          for (const side of [w.liberator, w.raider]) {
            const ex = battleLines(c, { key, side, war, sys: 'hoth', against: side === w.liberator ? w.raider : 'hutt' });
            expect(ex, `${c} ${key} ${side}`).toBeTruthy();
            for (const [, t] of ex) expect(t, `${c} ${key} ${side}`).not.toMatch(/[{}]/);
          }
  });
});
