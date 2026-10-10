import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { markedLines, scan } from './conflict-markers.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const L = '<'.repeat(7), R = '>'.repeat(7), M = '='.repeat(7);

describe('conflict markers', () => {
  it('finds a merge’s opening and closing markers, not a heading’s underline', () => {
    expect(markedLines(`a\n${L} HEAD\nours\n${M}\ntheirs\n${R} origin/main\nb`)).toEqual([2, 6]);
    expect(markedLines(`Title\n${M}\ntext`)).toEqual([]);
    expect(markedLines(`x ${L} y`)).toEqual([]);
  });

  it('are in no file the repository tracks', () => {
    expect(scan(ROOT)).toEqual([]);
  });
});
