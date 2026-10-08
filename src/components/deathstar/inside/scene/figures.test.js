import { describe, expect, it } from 'vitest';
import { gait, playerKind } from './figures';

const sum = (w) => w.idle + w.walk + w.run;

describe('a figure’s gait, from how fast it goes', () => {
  it('stands idle when still, walks at walking pace and runs at running pace', () => {
    expect(gait(0)).toMatchObject({ idle: 1, walk: 0, run: 0 });
    expect(gait(1.6)).toMatchObject({ idle: 0, walk: 1, run: 0 });
    expect(gait(4.2)).toMatchObject({ idle: 0, walk: 0, run: 1 });
  });

  it('blends walking into running between the two paces, the weights always summing to one', () => {
    const w = gait(2.9);
    expect(w.walk).toBeGreaterThan(0);
    expect(w.run).toBeGreaterThan(0);
    expect(w.idle).toBe(0);
    for (const s of [0, 0.3, 0.9, 1.6, 2.2, 3.5, 4.2, 9]) expect(sum(gait(s))).toBeCloseTo(1);
  });

  it('paces the walk to the ground: slower steps creeping, quicker ones hurrying', () => {
    expect(gait(1.0).pace).toBeLessThan(gait(1.6).pace);
    expect(gait(1.6).pace).toBeCloseTo(1);
  });
});

describe('who the player is drawn as', () => {
  it('is the Rebel hero picked, in their own clothes', () => {
    expect(playerKind({ side: 'rebel', hero: 'leia' })).toBe('leia');
    expect(playerKind({ side: 'rebel', hero: 'obiwan' })).toBe('obiwan');
  });

  it('is a stormtrooper in borrowed armour, and always as an Imperial', () => {
    expect(playerKind({ side: 'rebel', hero: 'han', armour: true })).toBe('stormtrooper');
    expect(playerKind({ side: 'imperial' })).toBe('stormtrooper');
  });

  it('is Luke when the hero is someone the station has no figure for', () => {
    expect(playerKind({ side: 'rebel', hero: 'nobody' })).toBe('luke');
  });
});
