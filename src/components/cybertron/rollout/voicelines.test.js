import { describe, expect, it } from 'vitest';
import { VOICELINES } from './voicelines';
import { CALL, MOTTO } from './lines';

describe('what Roll out’s leaders say aloud, for their own voices', () => {
  it('has Megatron’s call and each side’s motto, from its leader', () => {
    expect(VOICELINES).toEqual([
      { who: 'megatron', text: CALL.decepticon },
      { who: 'optimus', text: MOTTO.autobot },
      { who: 'megatron', text: MOTTO.decepticon },
    ]);
  });
  it('leaves out the call Optimus has his own recording of, and Bumblebee’s beeps', () => {
    const texts = VOICELINES.map((l) => l.text);
    expect(texts).not.toContain(CALL.optimus);
    expect(texts).not.toContain(CALL.bumblebee);
  });
});
