import { describe, expect, it } from 'vitest';
import { voiceOf } from '../../lib/voiced';
import { PER_ROUND, VERDICTS, verdict } from './facts';
import { STAFF } from './layout';
import { VOICELINES as PAGE } from './voicelines';
import { LINES, SPOKEN } from './world/layout';
import { SHOUTS } from './world/shouts';
import { VOICELINES as WORLD } from './world/voicelines';

describe('the Office’s voices', () => {
  it('has a voice of their own for everyone who speaks', () => {
    for (const { who, text } of [...PAGE, ...WORLD]) {
      expect(who).toMatch(/^[a-z]+$/);
      expect(voiceOf(who)).toBe(who);
      expect(text.trim()).toBe(text);
    }
  });

  it('leaves the lines the show said out loud to the show', () => {
    const texts = new Set(WORLD.map((l) => l.text));
    for (const line of Object.keys(SPOKEN)) {
      expect(Object.values(LINES).flat()).toContain(line); // (still the bubble's words)
      expect(texts.has(line)).toBe(false);
    }
  });

  it('makes a toast’s speech from its own words, not the score around it', () => {
    expect(WORLD).toContainEqual({ who: 'darryl', text: SHOUTS.hoopsWon.say });
    expect(WORLD.some((l) => /\d+ of \d+/.test(l.text))).toBe(false);
  });

  it('says only the floor plan’s lines that are someone talking', () => {
    const said = PAGE.filter((l) => l.who !== 'dwight');
    expect(said.map((l) => l.who).sort()).toEqual(STAFF.filter((s) => s.said).map((s) => s.id).sort());
  });

  it('gives Dwight’s verdict on the round by the score', () => {
    expect(verdict(PER_ROUND)).toBe(VERDICTS.perfect);
    expect(verdict(PER_ROUND - 2)).toBe(VERDICTS.close);
    expect(verdict(PER_ROUND / 2)).toBe(VERDICTS.half);
    expect(verdict(0)).toBe(VERDICTS.poor);
  });
});
