import { describe, expect, it } from 'vitest';
import { seeded } from '../../lib/seeded';
import { crewLife } from './cruiser3d';

// a figure that keeps what it's asked to play, and when
const figure = () => {
  const played = [];
  return { played, play: (name, opts) => played.push({ name, layer: opts?.layer }) };
};
const fly = (crew, secs, dive = () => 0, dt = 1 / 30) => {
  let st = {};
  const rand = seeded(3);
  const at = [];
  for (let t = 0; t < secs; t += dt) {
    const before = (crew.rick?.played?.length ?? 0) + (crew.morty?.played?.length ?? 0);
    st = crewLife(crew, st, t, dt, dive(t), rand);
    if ((crew.rick?.played?.length ?? 0) + (crew.morty?.played?.length ?? 0) > before) at.push(t);
  }
  return at;
};

describe('the cruiser’s crew, sat in their seats', () => {
  it('has Rick take a pull on his flask now and then, on his upper half', () => {
    const rick = figure();
    const at = fly({ rick }, 200);
    expect(rick.played.length).toBeGreaterThan(4);
    expect(rick.played.every((p) => p.name === 'drink' && p.layer === 'upper')).toBe(true);
    for (let i = 1; i < at.length; i++) {
      expect(at[i] - at[i - 1]).toBeGreaterThanOrEqual(14 - 0.05);
      expect(at[i] - at[i - 1]).toBeLessThanOrEqual(34 + 0.05);
    }
  });

  it('frightens Morty once a dive, not again for a moment, and not on the level', () => {
    const morty = figure();
    // level, then a dive, out of it, and straight into another, then a long one
    const dive = (t) => (t < 2 ? 0 : t < 3 ? 0.9 : t < 3.5 ? 0.1 : t < 4 ? 0.9 : t < 9 ? 0 : 0.8);
    fly({ morty }, 12, dive);
    expect(morty.played.map((p) => p.name)).toEqual(['scared', 'scared']);
    expect(morty.played.every((p) => p.layer === 'upper')).toBe(true);
  });

  it('does nothing without a crew, or with a crew that can’t play', () => {
    expect(() => fly({}, 60, () => 1)).not.toThrow();
    expect(() => fly({ rick: {}, morty: {} }, 60, () => 1)).not.toThrow();
  });
});
