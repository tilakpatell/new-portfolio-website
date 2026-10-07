import { describe, expect, it } from 'vitest';
import { voiceOf } from '../../lib/voiced';
import { LEVELS } from './rush/levels';
import { HOST_VOICE, VOICELINES as RUSH } from './rush/voicelines';
import { SPOKEN } from './shire/rules';
import { VOICELINES as SHIRE } from './shire/voicelines';
import { CAST as RIVENDELL } from './towns/rivendell/layout';
import { VOICELINES as TOWNS } from './towns/voicelines';

describe("Middle-earth's lines, for their speakers' voices", () => {
  it('has a voice for every kitchen host', () => {
    for (const l of Object.values(LEVELS)) expect(voiceOf(HOST_VOICE[l.host]), l.host).toBeTruthy();
    expect(RUSH.every((l) => l.who)).toBe(true);
  });
  it("leaves out the lines the films' own recordings play", () => {
    expect(SHIRE.some((l) => SPOKEN[l.text])).toBe(false);
  });
  it('says no narration in a town whose lines quote what is said', () => {
    const told = RIVENDELL.flatMap((c) => c.lines).filter((t) => !t.includes('“'));
    expect(told.length).toBeGreaterThan(0);
    expect(TOWNS.some((l) => told.includes(l.text))).toBe(false);
    expect(TOWNS.some((l) => l.text === 'Bolts slide back, and the West Gate creaks open.')).toBe(false);
  });
});
