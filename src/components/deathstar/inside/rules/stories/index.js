// Every story aboard, by id: one for each station and side, run by
// rules/story.js over the free roam. The second Death Star’s two join
// with its rooms (Task 4.4).
//
//   STORIES → { [id]: story }
//   storyFor(station, side) → story | null   the one a new game on that station and side runs

import { DS1_IMPERIAL } from './ds1Imperial';
import { DS1_REBEL } from './ds1Rebel';

export const STORIES = Object.freeze({ [DS1_REBEL.id]: DS1_REBEL, [DS1_IMPERIAL.id]: DS1_IMPERIAL });

export function storyFor(station, side) {
  return Object.values(STORIES).find((s) => s.station === station && s.side === side) ?? null;
}
