import { describe, expect, it } from 'vitest';
import { PLANETS } from '../world/dimensions/destinations';
import { LINES } from './lines';
import { VOICED, voiceFor, voicedLines } from './voicelines';
import { PLANET_SITES, planetSite } from '.';

const CREW = new Set(['rick', 'morty']);
const linesOf = (by) => Object.values(by).flatMap((crews) => crews.cruiser ?? []);

describe('what Rick and Morty say on the planets', () => {
  it('has a landing for every planet with a site, and lines only for the sector’s planets', () => {
    for (const id of Object.keys(PLANET_SITES)) expect(LINES[id]?.landing?.cruiser?.length, id).toBeGreaterThan(0);
    for (const id of Object.keys(LINES)) expect(PLANETS, id).toContain(id);
  });

  it('is said by the cruiser’s two, in whole lines with curly quotes', () => {
    for (const [id, by] of Object.entries(LINES)) {
      expect(Object.keys(by).every((w) => ['landing', 'won', 'lost'].includes(w)), id).toBe(true);
      for (const [who, text] of linesOf(by)) {
        expect(CREW.has(who), `${id}: ${who}`).toBe(true);
        expect(text.trim().length, id).toBeGreaterThan(3);
        expect(text, id).not.toMatch(/'/);
      }
    }
  });

  it('is what Rick and Morty say as they climb out, unless the site has its own', () => {
    expect(planetSite('gazorpazorp').lines.out.cruiser).toEqual(LINES.gazorpazorp.landing.cruiser);
  });
});

describe('the planets’ lines for the voices job', () => {
  it('keys every line said, and only lines that are said', () => {
    const all = new Set(Object.values(LINES).flatMap((by) => linesOf(by).map(([, text]) => text)));
    const quests = Object.values(PLANET_SITES).flatMap((s) => (s.quests ?? []).flatMap((q) => [...(q.intro ?? []), ...(q.done ?? [])].map(([, text]) => text)));
    for (const [key, { who, text }] of Object.entries(VOICED)) {
      expect(key).toMatch(/^[a-z0-9]+\.[a-z0-9-]+(\.[a-z]+)?\.\d+$/);
      expect(typeof who, key).toBe('string');
      expect(all.has(text) || quests.includes(text), key).toBe(true);
    }
    expect(Object.keys(VOICED)).toHaveLength(Object.values(LINES).reduce((n, by) => n + linesOf(by).length, 0) + quests.length);
    expect(voiceFor('gazorpazorp.landing.0')).toEqual({ who: 'morty', text: LINES.gazorpazorp.landing.cruiser[0][1] });
    expect(voiceFor('nowhere.landing.0')).toBeNull();
  });

  it('keys a quest’s opening and closing lines by the quest', () => {
    const v = voicedLines({}, { here: { quests: [{ id: 'gate', intro: [['rick', 'In we go.']], done: [['morty', 'We did it!']] }] } });
    expect(v).toEqual({ 'here.gate.intro.0': { who: 'rick', text: 'In we go.' }, 'here.gate.done.0': { who: 'morty', text: 'We did it!' } });
  });
});
