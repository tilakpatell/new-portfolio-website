import { describe, expect, it } from 'vitest';
import { manifestText, tidy } from './tidy.mjs';

describe('tidying the made lines', () => {
  const lines = [
    { id: 'b2', who: 'han' },
    { id: 'a1', who: 'han' },
    { id: 'c3', who: 'dwight' },
  ];

  it('drops the recordings of lines no longer said, and lists the rest in the lines’ order', () => {
    const { gone, manifest } = tidy(lines, ['han/a1.mp3', 'han/zz.mp3', 'han/b2.mp3']);
    expect(gone).toEqual(['han/zz.mp3']);
    expect(Object.entries(manifest)).toEqual([
      ['b2', 'han/b2.mp3'],
      ['a1', 'han/a1.mp3'],
    ]);
  });

  it('names who has lines but no voice made yet', () => {
    expect(tidy(lines, ['han/a1.mp3']).voiceless).toEqual(['dwight']);
  });

  it('writes the manifest as generate.py does', () => {
    expect(manifestText({ a1: 'han/a1.mp3', b2: 'han/b2.mp3' })).toBe('{\n"version": 1,\n"lines": {\n"a1": "han/a1.mp3",\n"b2": "han/b2.mp3"\n}\n}');
  });
});
