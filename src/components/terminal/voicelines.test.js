import { describe, expect, it } from 'vitest';
import { voiceOf } from '../../lib/voiced';
import { VOICELINES } from './voicelines';

describe('the terminal’s quotes, in their speakers’ voices', () => {
  it('say the ones with a voice, as the terminal prints them', () => {
    expect(VOICELINES).toEqual([
      { who: 'jyn', text: 'Rebellions are built on hope.' },
      { who: 'mando', text: 'This is the way.' },
      { who: 'ben', text: 'In my experience, there’s no such thing as luck.' },
      { who: 'chirrut', text: 'I am one with the Force, and the Force is with me.' },
      { who: 'ben', text: 'An elegant weapon for a more civilized age.' },
    ]);
    for (const { who } of VOICELINES) expect(voiceOf(who)).toBe(who);
  });
});
