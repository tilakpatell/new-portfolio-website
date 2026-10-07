import { describe, expect, it } from 'vitest';
import { lineId, voiceOf } from '../../lib/voiced';
import { ALOUD, BOSS_LINE, LOST_LINE, OPENER } from './portal/callouts';
import { VOICELINES as PORTAL } from './portal/voicelines';
import { MEESEEKS, aloud } from './toys';
import { VOICELINES } from './voicelines';

describe('what the Rick and Morty page says aloud', () => {
  it('says a Meeseeks’ line without its *poof*', () => {
    expect(aloud(MEESEEKS.letGo)).toBe('Ok, we’re done. Everybody.');
    expect(aloud(MEESEEKS.done.top)).toBe('All done!');
    expect(aloud(MEESEEKS.stress[0])).toBe(MEESEEKS.stress[0]);
  });
  it('lists only lines with a voice, once each', () => {
    const all = [...VOICELINES, ...PORTAL];
    expect(all.every((l) => voiceOf(l.who) && l.text && !l.text.includes('*'))).toBe(true);
    expect(new Set(all.map((l) => lineId(voiceOf(l.who), l.text))).size).toBe(all.length);
  });
  it('says Portal panic’s talking callouts, by a clip or a voice, and not the rest', () => {
    for (const t of [OPENER.rick, OPENER.morty, OPENER.pickle, BOSS_LINE.cronenberg, LOST_LINE.morty]) expect(ALOUD[t]?.clip || ALOUD[t]?.who, t).toBeTruthy();
    for (const t of [BOSS_LINE.snowball, BOSS_LINE.evilmorty, BOSS_LINE.cromulon, LOST_LINE.pickle]) expect(ALOUD[t], t).toBeUndefined();
    expect(PORTAL.some((l) => l.who === 'rick' && l.text === 'You stop shots.')).toBe(true);
  });
});
