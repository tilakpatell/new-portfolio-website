// Every story aboard, by id: one for each station and side, run by
// rules/story.js over the free roam.
//
//   STORIES → { [id]: story }
//   storyFor(station, side) → story | null   the one a new game on that station and side runs

import { DS1_IMPERIAL } from './ds1Imperial';
import { DS1_REBEL } from './ds1Rebel';
import { DS2_IMPERIAL } from './ds2Imperial';
import { DS2_REBEL } from './ds2Rebel';

export const STORIES = Object.freeze(Object.fromEntries([DS1_REBEL, DS1_IMPERIAL, DS2_REBEL, DS2_IMPERIAL].map((s) => [s.id, s])));

export function storyFor(station, side) {
  return Object.values(STORIES).find((s) => s.station === station && s.side === side) ?? null;
}
