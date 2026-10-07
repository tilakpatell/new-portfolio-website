import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lineId, spoken, voiceOf } from '../../../lib/voiced';
import { worldLines } from '../../../../scripts/voices/export-lines.mjs';
import { BATTLE_KEYS, BATTLE_LINES, battleLines } from '../battleLines';
import { SAID, VOICELINES } from './voicelines';

const has = (who, text) => VOICELINES.some((l) => l.who === who && l.text === text);

describe('the crews’ battle lines, in their own voices', () => {
  it('are for the moments warfront.js has the crew speak on', () => {
    const src = readFileSync(new URL('../warfront.js', import.meta.url), 'utf8');
    const calls = [...src.matchAll(/\bsay\(([^)]*)\)/g)].flatMap((m) => [...m[1].matchAll(/'(\w+)'/g)].map((q) => q[1]));
    expect([...new Set(calls)].sort()).toEqual([...SAID].sort());
    for (const key of SAID) expect(BATTLE_KEYS).toContain(key);
  });

  it('are the crews’ own, under their own voices, as written', () => {
    expect(new Set(VOICELINES.map((l) => l.who))).toEqual(new Set(['rick', 'morty', 'luke', 'han', 'walt', 'jesse']));
    for (const { who, text } of VOICELINES) {
      expect(voiceOf(who)).toBe(who);
      expect(text).not.toMatch(/\{\w+\}/);
    }
    for (const who of ['rick', 'morty', 'luke', 'han', 'walt', 'jesse']) expect(VOICELINES.filter((l) => l.who === who).length, who).toBeGreaterThan(40);
    expect(new Set(VOICELINES.map((l) => `${l.who}|${l.text}`)).size).toBe(VOICELINES.length);
  });

  it('have what a battle says, as the comms play it', () => {
    // asking whose side, nobody's yet
    for (const [who, text] of battleLines('rv', { key: 'ask', war: 'gcw' })) expect(has(who, text), text).toBe(true);
    // against the Hutts; a place's own; a war's own: each line as written, unless it has a blank
    const picked = [
      [BATTLE_LINES.cruiser.battle.front.hutt, battleLines('cruiser', { key: 'front', side: 'rebel', war: 'gcw', against: 'hutt' })],
      [BATTLE_LINES.xwing.battleAt.hoth.won.light, battleLines('xwing', { key: 'won', side: 'rebel', war: 'gcw', sys: 'hoth' })],
      [BATTLE_LINES.falcon.battleWar.clone.won.dark, battleLines('falcon', { key: 'won', side: 'separatists', war: 'clone' })],
    ];
    for (const [written, said] of picked)
      written.forEach(([who, text], i) => {
        if (!voiceOf(who) || /\{\w+\}/.test(text)) return;
        expect(said[i]).toEqual([who, text]);
        expect(has(who, text), text).toBe(true);
      });
    // and none of Artoo's beeps or Chewie's roars
    expect(VOICELINES.some((l) => l.who === 'r2' || l.who === 'chewie')).toBe(false);
  });

  it('leave out the lines no battle says: blanks filled as said, moments nobody says, a side’s own front every war has its own for', () => {
    const [[, filled]] = BATTLE_LINES.rv.battle.front.light; // Jesse's, with {us} and {place}
    expect(filled).toMatch(/\{us\}/);
    expect(VOICELINES.some((l) => l.text === filled)).toBe(false);
    for (const [who, text] of BATTLE_LINES.rv.battle.escort.light) expect(has(who, text), text).toBe(false);
    const [, [who, text]] = BATTLE_LINES.rv.battle.front.light; // Walt's answer, which every war's own front stands in for
    expect(has(who, text)).toBe(false);
  });

  it('are what scripts/voices makes, under the id the comms look them up by', () => {
    const made = worldLines([VOICELINES], { lineId, voiceOf, spoken });
    expect(made).toHaveLength(VOICELINES.length);
    expect(made.map((l) => l.id)).toEqual(VOICELINES.map((l) => lineId(l.who, l.text)));
  });
});
