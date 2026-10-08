import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../../../Achievements';
import { EGGS } from './eggs';

// The site’s table is what the toast reads and the save keeps: an id the
// station unlocks that isn’t in it is dropped without a word (`unlock`
// ignores unknown ids), so every one the station can give must be there.
// Coming aboard, finding an egg and finishing a story are all it gives.
const STORIES = ['ds-ds1-rebel', 'ds-ds1-imperial', 'ds-ds2-rebel', 'ds-ds2-imperial'];
const GIVEN = ['ds-aboard', ...EGGS.map((e) => e.achievement), ...STORIES];
const station = Object.keys(ACHIEVEMENTS).filter((id) => id.startsWith('ds-'));

describe('the station’s achievements', () => {
  it('include every egg, named and told as the egg is', () => {
    for (const egg of EGGS) {
      // the table’s lines, like every other in it, go without a closing full stop
      expect(ACHIEVEMENTS[egg.achievement], egg.achievement).toEqual({ name: egg.title, desc: egg.line.replace(/\.$/, '') });
    }
  });

  it('include each of the four stories, with a name and a line', () => {
    for (const id of STORIES) expect(ACHIEVEMENTS[id], id).toEqual({ name: expect.stringMatching(/\S/), desc: expect.stringMatching(/\S/) });
  });

  it('are only those the station can give', () => {
    expect([...station].sort()).toEqual([...GIVEN].sort());
  });

  it('use curly quotes, no exclamation runs and no closing full stop', () => {
    for (const id of station) {
      for (const text of [ACHIEVEMENTS[id].name, ACHIEVEMENTS[id].desc]) {
        expect(text, id).not.toMatch(/["']/);
        expect(text, id).not.toMatch(/!!/);
        expect(text, id).not.toMatch(/\.$/);
      }
    }
  });
});
