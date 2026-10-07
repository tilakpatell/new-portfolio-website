import { describe, expect, it } from 'vitest';
import { VOICELINES } from './voicelines';
import { BRIEF } from './tesseract/lines';
import { TEACH } from './smash/lines';
import { PACKS } from './world/rules';
import { REACTOR } from './world/reactor';

const said = (who) => VOICELINES.filter((l) => l.who === who).map((l) => l.text);

describe('what the HQ’s people say aloud, for their own voices', () => {
  it('has each line once, from its speaker, and none of the ones put together as they happen', () => {
    expect(new Set(VOICELINES.map((l) => l.who))).toEqual(new Set(['friday', 'thor', 'clint', 'banner', 'peter']));
    for (const { text } of VOICELINES) expect(text).toMatch(/^[^$]*\w[^$]*$/);
    expect(new Set(VOICELINES.map((l) => `${l.who}|${l.text}`)).size).toBe(VOICELINES.length);
  });
  it('has the lines that change with the controls both ways, keys and touch', () => {
    for (const b of BRIEF) expect(said('friday')).toEqual(expect.arrayContaining([b(true), b(false)]));
    expect(said('friday')).toEqual(expect.arrayContaining(REACTOR));
    for (const t of Object.values(TEACH)) expect(said('banner')).toEqual(expect.arrayContaining([t(true), t(false)]));
  });
  it('has Peter on every backpack round the compound', () => {
    expect(said('peter')).toEqual(expect.arrayContaining(PACKS.map((p) => p.line)));
  });
});
