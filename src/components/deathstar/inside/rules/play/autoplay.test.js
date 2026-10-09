// Every story played start to end through the game's own step, with
// nothing but the inputs a person at the keys would give (autoplay.js):
// the way walked, the lifts ridden, E pressed at what each step names,
// the lines picked, the fights fought. Your health is kept topped up, so
// what this finds is a story that can't be finished, not one that is
// hard. It takes a minute or two a story, so it runs only when asked:
//
//   DS_AUTOPLAY=1 npx vitest run src/components/deathstar/inside/rules/play/autoplay.test.js
import { describe, expect, it } from 'vitest';
import { STEP, drain, newGame, step } from '../game';
import { autoInput } from './autoplay';

const LIMIT = 150; // seconds any one step may take
const STORIES = [
  ['ds1', 'rebel'],
  ['ds1', 'imperial'],
  ['ds2', 'rebel'],
  ['ds2', 'imperial'],
];

// (DS_AUTOPLAY_SEEDS=1,2,3 plays each story on each seed: the patrols and the fights go differently)
const SEEDS = (globalThis.process?.env?.DS_AUTOPLAY_SEEDS ?? '5').split(',').map(Number);
const RUNS = STORIES.flatMap(([station, side]) => SEEDS.map((seed) => [station, side, seed]));

describe.skipIf(!globalThis.process?.env?.DS_AUTOPLAY)('every story, played', () => {
  it.each(RUNS)('%s %s (seed %i) is finished with the keys alone', (station, side, seed) => {
    const g = newGame({ station, side, mode: 'story', seed });
    const mem = {};
    let at = g.plot.progress.step;
    let since = 0;
    for (let t = 0; !g.plot.done && t < 1500; t += STEP) {
      step(g, autoInput(g, mem));
      drain(g);
      g.you.hp = g.you.max ?? 100;
      since = g.plot.progress.step === at ? since + STEP : 0;
      at = g.plot.progress.step;
      expect(since, `stalled at ${at}`).toBeLessThan(LIMIT);
    }
    expect(g.plot.done).toBe(true);
  }, 900000);
});
