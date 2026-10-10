import { describe, expect, it } from 'vitest';
import { ARMS } from './saber';

describe('the bones a stroke lays over the guard', () => {
  it('names the game’s spine and neck beside Meshy’s, so both kinds of figure swing', () => {
    for (const n of ['Spine1', 'Spine2', 'Neck', 'Spine02', 'Spine01', 'Spine']) expect(ARMS).toContain(n);
  });
});
