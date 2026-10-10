import { describe, expect, it } from 'vitest';
import { BLOOM, bloomGroups } from './bloom';

describe('the house bloom', () => {
  it('is his numbers: only what is over white glows, and gently', () => {
    expect(BLOOM).toEqual({ threshold: 1, strength: 0.25, radius: 0.4 });
    expect(Object.isFrozen(BLOOM)).toBe(true);
  });

  it('gives the panel one group of three sliders bound to the pass', () => {
    const pass = { threshold: 1, strength: 0.25, radius: 0.4 };
    const groups = bloomGroups(pass);
    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group.name).toBe('bloom');
    expect(group.items.map((it) => [it.key, it.type, it.min, it.max])).toEqual([
      ['threshold', 'range', 0, 2],
      ['strength', 'range', 0, 1.5],
      ['radius', 'range', 0, 1],
    ]);
    expect(group.items.map((it) => it.get())).toEqual([1, 0.25, 0.4]);
    group.items[0].set(1.2);
    group.items[1].set(0.6);
    group.items[2].set(0.1);
    expect(pass).toEqual({ threshold: 1.2, strength: 0.6, radius: 0.1 });
  });

  it('gives a soft-knee pass a knee slider too', () => {
    const pass = { threshold: 1.4, strength: 0.5, radius: 0, knee: 0.5 };
    const [group] = bloomGroups(pass);
    expect(group.items.map((it) => it.key)).toEqual(['threshold', 'knee', 'strength', 'radius']);
    expect(group.items.find((it) => it.key === 'threshold').max).toBe(3);
    group.items[1].set(0.25);
    expect(pass.knee).toBe(0.25);
  });
});
