import { beforeEach, describe, expect, it, vi } from 'vitest';
import { spoken, voiceOf } from '../../../lib/voiced';
import { VOICELINES as AMON_HEN } from './amonhen/voicelines';
import { VOICELINES as BREE } from './bree/voicelines';
import { VOICELINES as CIRITH_UNGOL } from './cirithungol/voicelines';
import { VOICELINES as DOOM } from './doom/voicelines';
import { CONVOS as DOOM_TALK, REMEMBER_SAYS } from './doom/story';
import { VOICELINES as LORIEN } from './lorien/voicelines';
import { VOICELINES as MARSHES } from './marshes/voicelines';
import { VOICELINES as MORIA } from './moria/voicelines';
import { VOICELINES as ORTHANC } from './orthanc/voicelines';
import { CONVOS as ORTHANC_TALK } from './orthanc/story';
import { RIDDLES } from './rivendell/rules';
import { VOICELINES as RIVENDELL } from './rivendell/voicelines';
import { nodeVoice } from './talk';
import { VOICELINES as WEATHERTOP } from './weathertop/voicelines';
import { sayInTurn, toastLines, voicedNodes } from './voice';

const said = vi.hoisted(() => ({ lines: [], made: new Set(), cut: new Set() }));
vi.mock('../../../lib/voiced', async (real) => ({
  ...(await real()),
  voicedSrc: async (who, text) => (said.made.has(text) ? `/${who}.mp3` : null),
  sayVoiced: async (who, text) => {
    said.lines.push(text);
    // a line cut short ends long before its length
    return { length: said.cut.has(text) ? 10 : 0.01, ended: Promise.resolve() };
  },
}));

const TOWNS = [...AMON_HEN, ...BREE, ...CIRITH_UNGOL, ...DOOM, ...LORIEN, ...MARSHES, ...MORIA, ...ORTHANC, ...RIVENDELL, ...WEATHERTOP];

describe("the towns' games and toasts, in their speakers' voices", () => {
  it('says every line in a voice, and says only what’s quoted (or one of Bilbo’s riddles)', () => {
    const riddles = new Set(RIDDLES.map((r) => r.q));
    for (const l of TOWNS) {
      expect(voiceOf(l.who), l.text).toBeTruthy();
      expect(l.text.includes('“') || riddles.has(l.text), l.text).toBe(true);
    }
  });
  it("says Sam's answers in Sam's voice, not folded into Frodo's", () => {
    const frodo = DOOM.filter((l) => l.who === 'frodo').map((l) => spoken(l.text));
    expect(frodo.some((t) => t.includes('Then'))).toBe(false);
    expect(DOOM).toContainEqual({ who: 'sam', text: REMEMBER_SAYS.wrong.then.say });
  });
  it("hears the narrator's quotes, and the Voice of Saruman, in the right voices", () => {
    expect(nodeVoice(ORTHANC_TALK.felled.nodes.voice)).toBe('saruman');
    expect(nodeVoice(DOOM_TALK.column.nodes.line)).toBe('shagrat');
    expect(nodeVoice(DOOM_TALK.foot.nodes.shire)).toBe('sam');
    expect(voicedNodes(ORTHANC_TALK).map((l) => l.who)).toEqual(['saruman', 'saruman', 'saruman']);
  });
  it('lists a toast’s own line where only part of it is theirs, and each of two speaking in one', () => {
    const says = { a: { who: 'gandalf', text: '“I see you.” Then: “Take it off!”', line: '“Take it off!”' }, b: { text: 'x', lines: [{ who: 'pippin', text: '“P”' }, { who: 'merry', text: '“M”' }] } };
    expect(toastLines(says)).toEqual([{ who: 'gandalf', text: '“Take it off!”' }, { who: 'pippin', text: '“P”' }, { who: 'merry', text: '“M”' }]);
  });
});

describe('lines said in turn', () => {
  beforeEach(() => {
    said.lines = [];
    said.made = new Set(['one', 'two']);
    said.cut = new Set();
  });
  it('says no more once one is cut short, so as not to talk over what cut it', async () => {
    said.cut.add('one');
    await sayInTurn([
      { who: 'frodo', text: 'one' },
      { who: 'sam', text: 'two' },
    ]);
    expect(said.lines).toEqual(['one']);
  });
  it('says each after the last, passing over one not made', async () => {
    await sayInTurn([
      { who: 'frodo', text: 'one' },
      { who: 'sam', text: 'not made' },
      { who: 'sam', text: 'two' },
    ]);
    expect(said.lines).toEqual(['one', 'two']);
  });
  it('says nothing in no voice', async () => {
    await sayInTurn([{ who: 'narrator', text: 'one' }]);
    expect(said.lines).toEqual([]);
  });
});
