import { describe, expect, it } from 'vitest';
import { SAVE, SAVE_VERSION, blank, clean } from './save';

// blank()'s shape, written out by hand so a change to blank() can't pass unseen
const BLANK = {
  settings: { view: 'third', sound: true, subtitles: true, guide: true, tips: true },
  ds1: { story: { rebel: null, imperial: null }, seen: [], eggs: [] },
  ds2: { story: { rebel: null, imperial: null }, seen: [], eggs: [] },
};

describe('the save', () => {
  it('is kept as tp-deathstar-inside, version 1', () => {
    expect(SAVE).toBe('tp-deathstar-inside');
    expect(SAVE_VERSION).toBe(1);
  });

  it('starts with third person, sound and subtitles on, and nothing seen on either station', () => {
    expect(blank()).toEqual(BLANK);
  });

  it('gives a fresh save each time, so one game’s rooms never leak into another’s', () => {
    const a = blank();
    a.ds1.seen.push('bay327');
    expect(blank().ds1.seen).toEqual([]);
  });

  it('cleans nothing at all into a blank save', () => {
    expect(clean(null)).toEqual(BLANK);
    expect(clean(undefined)).toEqual(BLANK);
  });

  it('cleans an unversioned (v0) save into the same shape, keeping what still makes sense', () => {
    const v0 = {
      settings: { view: 'first', sound: false },
      ds1: { story: { rebel: 'compactor' }, seen: ['bay327', 'hold', 'bay327'], eggs: ['tk421'] },
      // a station the inside has never had
      ds3: { seen: ['nowhere'] },
    };
    expect(clean(v0)).toEqual({
      settings: { view: 'first', sound: false, subtitles: true, guide: true, tips: true },
      ds1: { story: { rebel: 'compactor', imperial: null }, seen: ['bay327', 'hold'], eggs: ['tk421'] },
      ds2: { story: { rebel: null, imperial: null }, seen: [], eggs: [] },
    });
  });

  it('reads the runtime’s wrapped form ({ v, data }) as the data inside it', () => {
    expect(clean({ v: 1, data: { settings: { subtitles: false } } }).settings).toEqual({ view: 'third', sound: true, subtitles: false, guide: true, tips: true });
  });

  it('cleans garbage into a blank save', () => {
    for (const junk of ['nonsense', 42, true, [1, 2, 3], () => 1]) expect(clean(junk)).toEqual(BLANK);
    const odd = {
      settings: { view: 'sideways', sound: 'loud', subtitles: 1 },
      ds1: { story: { rebel: 7, imperial: { step: 'x' } }, seen: 'bay327', eggs: [null, 3, {}] },
      ds2: 'gone',
    };
    expect(clean(odd)).toEqual(BLANK);
  });

  it('keeps only names that could be a room, a step or an egg', () => {
    const s = clean({ ds1: { seen: ['bay327', '', 'a b', '<script>', 'x'.repeat(80)], story: { imperial: 'tk 421' } } });
    expect(s.ds1.seen).toEqual(['bay327']);
    expect(s.ds1.story.imperial).toBeNull();
  });
});
