import { describe, expect, it } from 'vitest';
import { readSide, recordSide } from './side';

describe('a game on the side, as saved', () => {
  it('believes only a fair record', () => {
    expect(readSide(null)).toEqual({ won: false, best: null });
    expect(readSide({ won: 'yes', best: 'lots' })).toEqual({ won: false, best: null });
    expect(readSide({ won: true, best: 6 })).toEqual({ won: true, best: 6 });
  });
  it('keeps the best go, more or less being better as asked', () => {
    let r = recordSide(null, { won: false, score: 4 });
    expect(r).toEqual({ won: false, best: 4, better: true });
    r = recordSide(r, { won: true, score: 3 });
    expect(r).toEqual({ won: true, best: 4, better: false });
    r = recordSide(r, { score: 9 });
    expect(r.best).toBe(9);
    const low = recordSide({ won: true, best: 7 }, { won: true, score: 5 }, { low: true });
    expect(low).toEqual({ won: true, best: 5, better: true });
    expect(recordSide(low, { won: false, score: null }, { low: true })).toEqual({ won: true, best: 5, better: false });
  });
});
