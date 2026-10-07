import { describe, expect, it } from 'vitest';
import { VOICELINES } from './voicelines';
import { CAST, SAUL } from './people';

describe('what Albuquerque’s people say aloud, for their own voices', () => {
  it('has the cast’s answers that are them talking, and none that play the show’s own clip', () => {
    expect(new Set(VOICELINES.map((l) => l.who))).toEqual(new Set(['mike', 'hank', 'saul']));
    for (const c of CAST.filter((p) => p.said)) expect(VOICELINES).toContainEqual({ who: c.id, text: c.done });
    for (const id of ['walt', 'jesse', 'gus', 'hector', 'lalo']) expect(CAST.find((c) => c.id === id).said).toBeFalsy();
  });
  it('has Saul on the superlab, but not his line with the upgrade’s name in it', () => {
    expect(VOICELINES).toContainEqual({ who: 'saul', text: SAUL.superlab });
    expect(SAUL.bought('Billboard')).toBe('Billboard: done. S’all good, man.');
  });
});
