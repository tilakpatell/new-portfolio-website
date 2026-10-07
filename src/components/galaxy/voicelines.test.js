import { describe, expect, it } from 'vitest';
import { voiceOf } from '../../lib/voiced';
import { CAST, say, voiceOfCommander } from './warCast';
import { SYSTEMS } from './systems';
import { VOICELINES } from './voicelines';

describe('the galaxy’s lines, in their speakers’ voices', () => {
  it('the war’s commanders: every line as the comms says it, but the ones with your rank in them and Jabba’s Huttese', () => {
    const war = VOICELINES.filter((l) => Object.values(CAST).some((c) => voiceOfCommander(c) === l.who && Object.values(c.lines).includes(l.text)));
    expect(war).toHaveLength(172);
    for (const l of war) {
      expect(l.text, l.who).not.toContain('{rank}');
      const c = Object.values(CAST).find((x) => voiceOfCommander(x) === l.who);
      const key = Object.keys(c.lines).find((k) => c.lines[k] === l.text);
      const [line] = say(c, key === 'again' ? 'front' : key, { again: key === 'again' });
      expect(line[1]).toBe(l.text);
      expect(line[3].voiced).toBe(l.who);
    }
    expect(VOICELINES.some((l) => CAST.jabba.lines.front === l.text)).toBe(false);
    expect(new Set(war.map((l) => l.who)).size).toBe(30);
  });
  it('the system cards’ quotes with no clip, in the voice each names', () => {
    const quotes = SYSTEMS.filter((s) => s.quote.voice);
    expect(quotes.length).toBe(10);
    for (const s of quotes) {
      expect(s.quote.clip, s.id).toBeUndefined();
      expect(VOICELINES, s.id).toContainEqual({ who: s.quote.voice, text: s.quote.text });
    }
    expect(SYSTEMS.find((s) => s.id === 'mandalore').quote.voice).toBeUndefined(); // (a crowd)
    expect(SYSTEMS.find((s) => s.id === 'naboo').quote.voice).toBe('younganakin'); // (the boy in The Phantom Menace)
  });
  it('every voice is its own', () => {
    for (const l of VOICELINES) expect(voiceOf(l.who), l.text).toBe(l.who);
  });
});
