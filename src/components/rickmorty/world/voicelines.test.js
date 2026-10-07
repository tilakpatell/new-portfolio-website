import { afterEach, describe, expect, it, vi } from 'vitest';
import { spoken, voiceOf } from '../../../lib/voiced';
import { DESTINATIONS } from './dimensions/destinations';
import { ROOMS_SAY, SAY } from './say';
import { SHIP_LINES } from './ship';
import { PLACE_VOICE, VOICE, VOICELINES, lineVoice } from './voicelines';

describe('C-137: whose voice each line is in', () => {
  it('gives every line a voice of its own and something to say', () => {
    for (const { who, text } of VOICELINES) {
      expect(who, text).toMatch(/^[a-z0-9]+$/);
      // (passed straight through: no voice here is lib/voiced.js's shorthand for another)
      expect(voiceOf(who), text).toBe(who);
      expect(spoken(text), text).not.toBe('');
    }
    for (const v of [...Object.values(VOICE), ...Object.values(PLACE_VOICE).flatMap(Object.values)]) expect(voiceOf(v)).toBe(v);
  });
  it('never has two voices say the same words', () => {
    const by = new Map();
    for (const { who, text } of VOICELINES) {
      expect(by.get(text) ?? who, text).toBe(who);
      by.set(text, who);
    }
  });
  it('voices who’s talking, and leaves what Morty only sees a caption', () => {
    expect(lineVoice(SAY.jerry.text)).toBe('jerry');
    // the US President, not the Citadel's (lib/voiced.js's 'president' is President Morty)
    expect(lineVoice(SAY.president.text)).toBe('uspresident');
    expect(lineVoice(SAY.tinyrick.text)).toBe('rick');
    // narration that quotes someone is theirs; narration alone, a hiss or a gesture is nobody's
    expect(lineVoice(SAY.summer.text)).toBe('summer');
    expect(lineVoice(ROOMS_SAY.won.text)).toBe('rick');
    expect(lineVoice(ROOMS_SAY.lost.text)).toBeNull();
    expect(lineVoice(SAY.mortyroom.text)).toBeNull();
    expect(lineVoice(SAY.snakeastronaut.text)).toBeNull();
    expect(lineVoice('(He watches you fight. He doesn’t get up.)')).toBeNull();
    // (two speakers in one line: neither)
    expect(lineVoice(SAY.fartcell.text)).toBeNull();
    expect(lineVoice('Not a line anybody says.')).toBeNull();
  });
  it('has the places’ people heard as Morty goes about them', () => {
    const d = (id) => DESTINATIONS.find((x) => x.id === id);
    expect(lineVoice(d('customs').caught)).toBe('gromflomite');
    expect(lineVoice(d('customs').escape.before.text)).toBe('gromflomite');
    expect(lineVoice(d('purge').caught)).toBeNull();
    expect(lineVoice(d('fantasy').people.find((p) => p.id === 'fmeeseeks').ai.bark.lines[0])).toBe('meeseeks');
    expect(lineVoice(d('dream').people.find((p) => p.id === 'scaryterry').ai.hunt.line)).toBe('scaryterry');
    expect(lineVoice(d('blooddome').people.find((p) => p.id === 'hemorrhage').ai.hunt.duel.won.text)).toBe('hemorrhage');
    expect(lineVoice(d('evilrick').people.find((p) => p.id === 'evilrick').ai.hunt.duel.won.text)).toBeNull();
    const cable = d('cablestudio').extras.find((e) => e.kind === 'realfakedoors');
    expect(lineVoice(cable.ai.bark.lines[0])).toBe('realfakedoors');
  });
  it('lists every one of the cruiser’s lines in its own voice', () => {
    const ship = VOICELINES.filter((l) => l.who === 'ship').map((l) => l.text);
    expect(ship.sort()).toEqual(Object.values(SHIP_LINES).flat().sort());
  });
});

describe('C-137: the cruiser’s voice', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.doUnmock('../../../lib/voiced');
    vi.doUnmock('../../../lib/audio');
    vi.doUnmock('../../../lib/hooks');
  });
  // the ship's voice module, with the made lines in `made` and the browser's speech recorded
  async function ship({ made = {}, on = true } = {}) {
    const synth = [];
    const played = [];
    vi.stubGlobal('window', {
      speechSynthesis: { cancel: vi.fn(), speak: (u) => synth.push(u.text), getVoices: () => [] },
      SpeechSynthesisUtterance: function Utterance(text) {
        this.text = text;
      },
    });
    vi.doMock('../../../lib/audio', () => ({ soundOn: () => true }));
    vi.doMock('../../../lib/hooks', () => ({ local: { get: (k, d) => (k === 'tp-c137-shipvoice' ? on : d), set: () => {} } }));
    vi.doMock('../../../lib/voiced', () => ({
      voicedSrc: async (who, text) => made[`${who}|${text}`] ?? null,
      sayVoiced: async (who, text) => {
        const h = { who, text, stopped: false, stop: () => (h.stopped = true) };
        played.push(h);
        return h;
      },
    }));
    const m = await import('./shipVoice');
    return { ...m, synth, played };
  }
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('says a made line in its own voice, and the rest in the browser’s', async () => {
    const line = SHIP_LINES.board[0];
    const s = await ship({ made: { [`ship|${line}`]: '/audio/voiced/ship/x.mp3' } });
    s.speak(line);
    await settle();
    expect(s.played.map((h) => h.text)).toEqual([line]);
    expect(s.synth).toEqual([]);
    s.speak(SHIP_LINES.land[0]);
    await settle();
    expect(s.played[0].stopped).toBe(true);
    expect(s.synth).toEqual([SHIP_LINES.land[0]]);
  });
  it('keeps quiet with its voice switched off, and stops when told', async () => {
    const line = SHIP_LINES.hello[0];
    const off = await ship({ made: { [`ship|${line}`]: '/x.mp3' }, on: false });
    off.speak(line);
    await settle();
    expect(off.played).toEqual([]);
    expect(off.synth).toEqual([]);
    vi.resetModules();
    const s = await ship({ made: { [`ship|${line}`]: '/x.mp3' } });
    s.speak(line);
    s.stopSpeaking(); // (before it's even been looked up)
    await settle();
    expect(s.played).toEqual([]);
    expect(s.synth).toEqual([]);
  });
});
