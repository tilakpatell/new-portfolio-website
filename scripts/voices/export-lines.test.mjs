import { describe, expect, it } from 'vitest';
import { lineId, spoken, voiceOf } from '../../src/lib/voiced';
import { conversationLines, peopleLines } from './export-lines.mjs';

const convo = {
  start: 'a',
  nodes: {
    a: { who: 'strider', say: 'Footsteps on the stair. “Frodo?”', next: 'b' },
    b: { who: 'narrator', say: 'He kneels.', next: 'c' },
    c: { who: 'gandalf', say: '“Fly, you fools!”', end: 'won' },
    d: { who: 'gandalf', say: '“Fly, you fools!”' },
    e: { who: 'mrwhoever', say: '“Not voiced here.”' },
  },
};

describe('the worlds’ conversation lines for scripts/voices', () => {
  const lines = conversationLines([{ convo }], { lineId, voiceOf, spoken }, ['aragorn', 'gandalf']);

  it('say each character’s line in their voice, as the site looks it up', () => {
    expect(lines).toContainEqual({ id: lineId('aragorn', 'Footsteps on the stair. “Frodo?”'), who: 'aragorn', text: 'Frodo?' });
    expect(lines).toContainEqual({ id: lineId('gandalf', '“Fly, you fools!”'), who: 'gandalf', text: 'Fly, you fools!' });
  });

  it('leave out the narrator, voices not made here, and the same line twice', () => {
    expect(lines).toHaveLength(2);
  });
});

describe('the worlds’ people, in their own formats', () => {
  const v = { lineId, voiceOf, spoken };
  it('take each person’s lines, and the lines they say after', () => {
    const cast = [{ id: 'thor', lines: ['Worthy!'], after: { place: 'thor', lines: ['I knew it!'] } }, { id: 'bot', lines: ['Beep.'] }];
    const got = peopleLines([cast], v, ['thor']);
    expect(got.map((l) => l.text).sort()).toEqual(['I knew it!', 'Worthy!']);
  });
  it('take a mission giver’s offer', () => {
    const got = peopleLines([[{ id: 'x', giver: 'starscream', say: 'Lord Megatron!' }]], v, ['starscream']);
    expect(got).toEqual([{ id: lineId('starscream', 'Lord Megatron!'), who: 'starscream', text: 'Lord Megatron!' }]);
  });
  it('take a customer’s reactions by their key', () => {
    const got = peopleLines([{ badger: { name: 'Badger', lines: { great: 'Star Trek-level stuff, yo.', bad: 'Dude. No.' } } }], v, ['badger']);
    expect(got.map((l) => l.who)).toEqual(['badger', 'badger']);
  });
  it('leave out a line that’s only an aside', () => {
    expect(peopleLines([[{ id: 'starscream', lines: ['(He sneers.)'] }]], v, ['starscream'])).toEqual([]);
  });
});
