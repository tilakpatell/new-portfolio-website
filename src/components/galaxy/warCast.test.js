import { describe, expect, it } from 'vitest';
import { WAR_SYSTEMS } from './gcw';
import { SIDES } from './sides';
import { CAST, CAST_KEYS, GENERALS, HUTT_CAST_KEYS, POSTS, castFor, say, voiceOfCommander } from './warCast';
import { voiceOf } from '../../lib/voiced';

describe('the commanders', () => {
  it('each has a name, a colour, the sides they command for, and every line', () => {
    for (const [id, c] of Object.entries(CAST)) {
      expect(c.id).toBe(id);
      expect(c.name, id).toMatch(/\S/);
      expect(c.color, id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.sides.length, id).toBeGreaterThan(0);
      for (const s of c.sides) expect(SIDES[s], `${id} ${s}`).toBeTruthy();
      const keys = c.sides.includes('hutt') ? HUTT_CAST_KEYS : CAST_KEYS;
      for (const k of keys) expect(typeof c.lines[k], `${id} ${k}`).toBe('string');
      for (const t of Object.values(c.lines)) {
        expect(t.length, `${id}: ${t}`).toBeLessThanOrEqual(140);
        expect(t, id).not.toMatch(/['"]/);
        for (const blank of t.match(/\{[^}]*\}/g) ?? []) expect(blank, id).toBe('{rank}');
      }
    }
  });
  it('the films’ own: Ackbar and Piett, Yoda and Grievous, Teva and Gideon, and Jabba', () => {
    for (const id of ['ackbar', 'leia', 'piett', 'vader', 'tarkin', 'thrawn', 'yoda', 'obiwan', 'grievous', 'dooku', 'teva', 'gideon', 'jabba']) expect(CAST[id], id).toBeTruthy();
  });
  it('every side you can be on, and the Hutts, has a general', () => {
    for (const side of Object.keys(SIDES)) expect(CAST[GENERALS[side]]?.sides, side).toContain(side);
  });
  it('every post is a war system, held by a commander of that side', () => {
    for (const [side, posts] of Object.entries(POSTS))
      for (const [sys, id] of Object.entries(posts)) {
        expect(WAR_SYSTEMS, `${side} ${sys}`).toContain(sys);
        expect(CAST[id]?.sides, `${side} ${sys} ${id}`).toContain(side);
      }
  });
});

describe('castFor and say', () => {
  it('falls back to the side’s general where nobody’s posted', () => {
    expect(castFor('nowhere', 'rebel')).toBe(CAST[GENERALS.rebel]);
    expect(castFor('hoth', null)).toBeNull();
  });
  it('a posted commander is the one on the comms there', () => {
    const [side, posts] = Object.entries(POSTS).find(([, p]) => Object.keys(p).length);
    const [sys, id] = Object.entries(posts)[0];
    expect(castFor(sys, side)).toBe(CAST[id]);
  });
  it('says a line on the comms with their name and their voice on it, the rank filled', () => {
    const c = CAST[GENERALS.rebel];
    const ex = say(c, 'join', { rank: 'Flight Cadet' });
    expect(ex).toHaveLength(1);
    const [who, text, clip, speaker] = ex[0];
    expect(who).toBe('comms');
    expect(clip).toBeUndefined();
    expect(speaker).toEqual({ name: c.name, color: c.color, voiced: 'ackbar' });
    expect(text).not.toMatch(/\{rank\}/);
    if (c.lines.join.includes('{rank}')) expect(text).toContain('Flight Cadet');
  });
  it('says the front’s again line when you’ve fought there before, and nothing for a line it hasn’t', () => {
    const c = Object.values(CAST).find((x) => x.lines.again);
    expect(c).toBeTruthy();
    expect(say(c, 'front', { rank: 'Pilot', again: true })[0][1]).toBe(c.lines.again.replace('{rank}', 'Pilot'));
    expect(say(c, 'nothing', {})).toEqual([]);
    expect(say(null, 'front', {})).toEqual([]);
  });
});

describe('the commanders’ voices', () => {
  it('each speaks in their own, by their id, Windu and Gunray in the ones they have on the ground', () => {
    expect(voiceOfCommander(CAST.vader)).toBe('vader');
    expect(voiceOfCommander(CAST.windu)).toBe('mace');
    expect(voiceOfCommander(CAST.gunray)).toBe('nute');
    for (const c of Object.values(CAST)) {
      const v = voiceOfCommander(c);
      if (c.id === 'jabba') continue;
      expect(v, c.id).toMatch(/^[a-z]+$/);
      expect(voiceOf(v), c.id).toBe(v); // (nobody else's, and not the radio's)
    }
    expect(voiceOfCommander(null)).toBeNull();
  });
  it('Jabba’s Huttese has none, so his lines go out in the radio’s', () => {
    expect(voiceOfCommander(CAST.jabba)).toBeNull();
    expect(say(CAST.jabba, 'front')[0][3]).toEqual({ name: CAST.jabba.name, color: CAST.jabba.color });
  });
});
