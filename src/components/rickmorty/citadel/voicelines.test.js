import { describe, expect, it } from 'vitest';
import { spoken } from '../../../lib/voiced';
import { CAST } from './layout';
import { CAST as TOWN_CAST, WALKS } from './mortytown';
import { VOICE, VOICELINES, voiceFor } from './voicelines';

describe('the Citadel’s people, aloud', () => {
  it('gives everyone who says something a voice', () => {
    for (const c of [...CAST, ...TOWN_CAST, ...WALKS]) {
      for (const line of [...c.lines, ...(c.vote ? [c.vote] : [])]) {
        if (spoken(line)) expect(voiceFor(c, line), `${c.id}: ${line}`).toBe(VOICE[c.kind]);
      }
    }
    expect(voiceFor(CAST.find((c) => c.id === 'janitor'), 'Look at me!')).toBe('meeseeks');
  });
  it('says nothing of a bracketed aside, or of nobody', () => {
    expect(voiceFor(WALKS[0], WALKS[0].lines[0])).toBeNull();
    expect(voiceFor(CAST.find((c) => c.id === 'daycarerick'), '(He turns a page of his magazine.)')).toBeNull();
    expect(voiceFor(null, 'Hello')).toBeNull();
    expect(VOICELINES.every((l) => l.who && spoken(l.text))).toBe(true);
  });
});
