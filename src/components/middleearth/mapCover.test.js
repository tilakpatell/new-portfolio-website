import { describe, expect, it } from 'vitest';
import { COVERED_MS, hiddenOf, waitOf } from './mapCover';

describe('how much of the map a town hides', () => {
  it('hides nothing with nothing over it', () => {
    expect(hiddenOf(956, [])).toBe(0);
  });
  it('is the share of the rows under the stage', () => {
    // a 13" laptop: the stage from under the chapter's bar nearly to the foot
    expect(hiddenOf(956, [[130, 926]])).toBeCloseTo(796 / 956, 9);
  });
  it('counts only what is on the screen', () => {
    // a phone: the stage runs past the foot
    expect(hiddenOf(844, [[122, 850]])).toBeCloseTo(722 / 844, 9);
    // scrolled half off the top
    expect(hiddenOf(956, [[-400, 396]])).toBeCloseTo(396 / 956, 9);
    expect(hiddenOf(956, [[1183, 1979]])).toBe(0);
    expect(hiddenOf(844, [[-100, 1000]])).toBe(1);
  });
  it('counts rows two stages share once', () => {
    expect(hiddenOf(1000, [[100, 600], [400, 900]])).toBeCloseTo(0.8, 9);
    expect(hiddenOf(1000, [[400, 900], [100, 600], [500, 550]])).toBeCloseTo(0.8, 9);
  });
});

describe('how often the map is drawn behind a town', () => {
  it('waits between frames when the town hides most of the screen', () => {
    expect(waitOf(956, [[130, 926]])).toBe(COVERED_MS);
    expect(waitOf(1080, [[130, 994]])).toBe(COVERED_MS);
    expect(waitOf(844, [[122, 850]])).toBe(COVERED_MS);
    expect(COVERED_MS).toBeCloseTo(41.67, 2);
  });
  it('draws every frame when much of the map shows', () => {
    // a 1440p screen: the stage stops at 54rem, with 446px of map below it
    expect(waitOf(1440, [[130, 994]])).toBe(0);
    expect(waitOf(956, [[-400, 396]])).toBe(0);
    expect(waitOf(956, [])).toBe(0);
  });
});
