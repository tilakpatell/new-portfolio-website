import { describe, expect, it } from 'vitest';
import { voiceOf } from '../../../lib/voiced';
import { LINES as BOUT } from '../thinkmark/rules';
import { VOICELINES as BOUT_LINES } from '../thinkmark/voicelines';
import { CALLS, LINES } from './lines';
import { VOICELINES } from './voicelines';

describe('the Graysons’ city, in its people’s voices', () => {
  it('gives every line a voice: the city’s, what’s said in passing, and Think, Mark!’s', () => {
    expect(VOICELINES.length).toBe(Object.values(LINES).flat().length + Object.keys(CALLS).length);
    expect(BOUT_LINES.length).toBe(Object.keys(BOUT).length);
    for (const l of [...VOICELINES, ...BOUT_LINES]) expect(voiceOf(l.who)).toBe(l.who);
  });
  it('has Dad say his lines as Omni-Man, wherever he says them', () => {
    expect(VOICELINES.find((l) => l.text === 'Think, Mark!').who).toBe('omniman');
    expect(BOUT_LINES.find((l) => l.text === 'Think, Mark!').who).toBe('omniman');
  });
});
