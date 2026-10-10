import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../../../Achievements';
import { EGGS } from './eggs';
import { STORIES, storyFor } from './stories';

// The site’s table is what the toast reads and the save keeps: an id the
// station unlocks that isn’t in it is dropped without a word (`unlock`
// ignores unknown ids), so every one the station can give must be there.
// Coming aboard, finding an egg and finishing a story are all it gives,
// and a story gives its achievement by an `{ achievement }` effect, so
// the ids are read from the stories’ own steps rather than written here.
const effectsOf = (step) => [...step.start, ...step.end, ...(step.fail ?? [])];
const given = Object.values(STORIES).flatMap((story) => story.steps.flatMap(effectsOf).filter((e) => e.achievement).map((e) => e.achievement));

// Nothing gives these two yet: the second station’s stories (Task 4.4)
// aren’t written, and the table holds their copy ahead of them. Each is
// awaited only while storyFor finds no story for its station and side;
// once that story is written, what its own steps give replaces it here.
const AWAITED = [
  { station: 'ds2', side: 'rebel', id: 'ds-ds2-rebel' },
  { station: 'ds2', side: 'imperial', id: 'ds-ds2-imperial' },
];
const awaited = AWAITED.filter((a) => !storyFor(a.station, a.side)).map((a) => a.id);

const GIVEN = new Set(['ds-aboard', ...EGGS.map((e) => e.achievement), ...given, ...awaited]);
const station = Object.keys(ACHIEVEMENTS).filter((id) => id.startsWith('ds-'));

describe('the station’s achievements', () => {
  it('include every egg, named and told as the egg is', () => {
    for (const egg of EGGS) {
      // the table’s lines, like every other in it, go without a closing full stop
      expect(ACHIEVEMENTS[egg.achievement], egg.achievement).toEqual({ name: egg.title, desc: egg.line.replace(/\.$/, '') });
    }
  });

  it('include what every written story gives, and the ones still to be written, each with a name and a line', () => {
    for (const id of [...given, ...awaited]) expect(ACHIEVEMENTS[id], id).toEqual({ name: expect.stringMatching(/\S/), desc: expect.stringMatching(/\S/) });
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
