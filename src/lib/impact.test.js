import { describe, expect, it } from 'vitest';
import { createImpacts, impactGroups } from './impact';

// a clock the test moves by hand
const clock = () => {
  let t = 0;
  const now = () => t;
  now.by = (s) => (t += s);
  return now;
};

describe('createImpacts', () => {
  it('is silent at the threshold and full at full', () => {
    const rules = createImpacts({ now: clock(), random: () => 0.5 });
    expect(rules.hit(15, [0, 0, 0])).toBeNull();
    const r = createImpacts({ now: clock(), random: () => 0.5 }).hit(120, [1, 2, 3]);
    expect(r.gain).toBe(1);
    expect(r.dust).toBe(6);
    expect(r.shake).toBeCloseTo(0.15, 12);
    expect(r.at).toEqual([1, 2, 3]);
  });

  it('goes with the square of how far over the threshold it is', () => {
    const r = createImpacts({ now: clock() }).hit(67.5, [0, 0, 0]);
    expect(Math.abs(r.gain - 0.25)).toBeLessThan(1e-9);
    expect(r.dust).toBe(2);
    expect(createImpacts({ now: clock() }).hit(1000, [0, 0, 0]).gain).toBe(1);
  });

  it('says nothing for a force that is not a number', () => {
    const rules = createImpacts({ now: clock() });
    expect(rules.hit(NaN, [0, 0, 0])).toBeNull();
    expect(rules.hit(Infinity, [0, 0, 0])).toBeNull();
    expect(rules.hit(-Infinity, [0, 0, 0])).toBeNull();
  });

  it('answers one key once within the gap, and each key on its own', () => {
    const now = clock();
    const rules = createImpacts({ now });
    expect(rules.hit(100, [0, 0, 0], 'a')).not.toBeNull();
    now.by(0.05);
    expect(rules.hit(100, [0, 0, 0], 'a')).toBeNull();
    expect(rules.hit(100, [0, 0, 0], 'b')).not.toBeNull();
    now.by(0.06);
    expect(rules.hit(100, [0, 0, 0], 'a')).not.toBeNull();
  });

  it('keys on the place when no key is given', () => {
    const now = clock();
    const rules = createImpacts({ now });
    const at = [1, 0, 0];
    expect(rules.hit(100, at)).not.toBeNull();
    expect(rules.hit(100, at)).toBeNull();
  });

  it('draws the pitch from 0.85 to 1.15', () => {
    expect(createImpacts({ now: clock(), random: () => 0 }).hit(100, [0, 0, 0]).pitch).toBe(0.85);
    expect(createImpacts({ now: clock(), random: () => 1 }).hit(100, [0, 0, 0]).pitch).toBeCloseTo(1.15, 12);
  });

  it('takes new numbers live', () => {
    const rules = createImpacts({ now: clock() });
    rules.set({ threshold: 50 });
    expect(rules.hit(40, [0, 0, 0])).toBeNull();
    expect(rules.values()).toEqual({ threshold: 50, full: 120, gap: 0.1 });
  });
});

describe('impactGroups', () => {
  it('reads and writes the rules’ values', () => {
    const rules = createImpacts({ now: clock() });
    const [g] = impactGroups(rules);
    expect(g.name).toBe('hits');
    const item = (key) => g.items.find((i) => i.key === key);
    expect(item('threshold')).toMatchObject({ type: 'range', min: 0, max: 60 });
    expect(item('full')).toMatchObject({ min: 20, max: 400 });
    expect(item('gap')).toMatchObject({ min: 0, max: 0.5 });
    expect(item('full').get()).toBe(120);
    item('gap').set(0.3);
    expect(rules.values().gap).toBe(0.3);
  });
});
