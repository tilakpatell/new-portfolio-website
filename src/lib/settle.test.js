import { describe, expect, it } from 'vitest';
import { allOrUndo } from './settle';

describe('making several things at once, or none', () => {
  it('gives back everything made, in order, and keeps a note of each', async () => {
    const made = [];
    await expect(allOrUndo([Promise.resolve('a'), Promise.resolve('b')], made)).resolves.toEqual(['a', 'b']);
    expect(made).toEqual(['a', 'b']);
  });
  it('fails with the first failure, having noted what was made all the same', async () => {
    const made = [];
    const boom = new Error('no rooms');
    await expect(allOrUndo([Promise.resolve('concourse'), Promise.reject(boom), Promise.resolve('crowd')], made)).rejects.toBe(boom);
    // so the caller can dispose of them
    expect(made).toEqual(['concourse', 'crowd']);
  });
});
