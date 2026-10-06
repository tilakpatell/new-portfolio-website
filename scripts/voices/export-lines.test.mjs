import { describe, expect, it } from 'vitest';
import { lineId, spoken, voiceOf } from '../../src/lib/voiced';
import { conversationLines } from './export-lines.mjs';

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
