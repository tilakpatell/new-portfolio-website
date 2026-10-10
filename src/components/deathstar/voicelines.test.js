import { describe, expect, it } from 'vitest';
import { voiceOf } from '../../lib/voiced';
import { PARTS } from './parts';
import { RADIO, WON } from './trench';
import { CALLS, CLEARED, ENDINGS } from './battle';
import { INTERCOM, VOICELINES, endingVoice, quoteVoice, speakerOf } from './voicelines';

describe('the Death Star’s lines, in their speakers’ voices', () => {
  it('know who’s on the radio by the name before their line', () => {
    expect(speakerOf(RADIO.start)).toBe('redleader');
    expect(speakerOf(RADIO.dive)).toBe('luke');
    expect(speakerOf(RADIO.ties)).toBe('biggs');
    expect(speakerOf(RADIO.han)).toBe('han');
    expect(speakerOf(RADIO.r2)).toBe('luke');
    expect(speakerOf(WON.computer)).toBe('han');
  });
  it('leave the lines with a recording of their own, and the calls nobody makes, to themselves', () => {
    expect(speakerOf(RADIO.trench)).toBeNull(); // Gold Five's own
    expect(speakerOf(RADIO.vader)).toBeNull(); // Vader's own
    expect(speakerOf(RADIO.range)).toBeNull();
    expect(speakerOf(WON.force)).toBeNull();
    expect(speakerOf(undefined)).toBeNull();
  });
  it('voice only the readout’s quotes that have no clip', () => {
    expect(PARTS.map(quoteVoice).filter(Boolean)).toEqual(['wedge', 'han']);
    expect(VOICELINES.length).toBe(15);
    for (const l of VOICELINES) expect(voiceOf(l.who)).toBe(l.who);
  });
  it('read out the base’s intercom, and say the battle’s last word in whoever’s voice it is', () => {
    for (const text of [...Object.values(CALLS), CLEARED]) expect(VOICELINES).toContainEqual({ who: INTERCOM, text });
    expect(endingVoice('empire')).toBe('tarkin');
    expect(endingVoice('rebels')).toBe('han');
    expect(endingVoice(null)).toBeNull();
    expect(VOICELINES).toContainEqual({ who: 'tarkin', text: ENDINGS.empire.line });
    expect(VOICELINES).toContainEqual({ who: 'han', text: ENDINGS.rebels.line });
  });
});
