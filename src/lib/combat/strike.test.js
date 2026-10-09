import { beforeAll, describe, expect, it } from 'vitest';
import { createPhysics } from '../physics/world';
import { createCharacter } from '../physics/character';
import { createHurtboxes } from '../physics/hurtbox';
import { createQueries } from '../physics/queries';
import { clashOf, createStrike, stepStrike } from './strike';

let phys;
let q;
let victim;
let owner;
beforeAll(async () => {
  phys = await createPhysics();
  phys.add({ type: 'fixed', position: [0, -0.5, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [20, 0.5, 20] }] });
  victim = createCharacter(phys, { position: [2, 1, 0] });
  createHurtboxes(phys, victim, { single: true, tall: 1.8 });
  owner = createCharacter(phys, { position: [0, 1, 0] });
  createHurtboxes(phys, owner, { single: true, tall: 1.8 });
  phys.step(1 / 60);
  q = createQueries(phys);
});

// a vertical blade a metre long at (x, z)
const blade = (x, z) => ({ base: [x, 0.5, z], tip: [x, 1.5, z] });
const strike = (more = {}) => createStrike({ id: 'a', owner: owner.body, r: 0.12, damage: 2, kind: 'light', window: [0.2, 0.4], ...more });

describe('stepStrike', () => {
  it('a sweep across the figure inside the window hits once with tag whole', () => {
    const s = strike();
    const hits = stepStrike(s, q, { prev: blade(2, -1), now: blade(2, 1) }, 0.25);
    expect(hits).toHaveLength(1);
    expect(hits[0].victim).toBe(victim.body);
    expect(hits[0].tag).toBe('whole');
    expect(hits[0].toi).toBeGreaterThan(0);
    expect(hits[0].toi).toBeLessThan(1);
    expect(s.hits.has(victim.body)).toBe(true);
  });

  it('the same victim is not hit twice in one strike', () => {
    const s = strike();
    stepStrike(s, q, { prev: blade(2, -1), now: blade(2, 1) }, 0.25);
    expect(stepStrike(s, q, { prev: blade(2, -1), now: blade(2, 1) }, 0.05)).toEqual([]);
  });

  it('outside the window nothing is swept', () => {
    const s = strike();
    const used = q.stats().sweeps.used;
    expect(stepStrike(s, q, { prev: blade(2, -1), now: blade(2, 1) }, 0.1)).toEqual([]);
    expect(q.stats().sweeps.used).toBe(used);
    expect(s.done).toBe(false);
    stepStrike(s, q, { prev: blade(5, -1), now: blade(5, 1) }, 0.35);
    expect(s.done).toBe(true);
    expect(stepStrike(s, q, { prev: blade(2, -1), now: blade(2, 1) }, 0.01)).toEqual([]);
  });

  it('a zero-length pose overlapping the figure still hits', () => {
    const s = strike();
    const hits = stepStrike(s, q, { prev: blade(2, 0), now: blade(2, 0) }, 0.25);
    expect(hits).toHaveLength(1);
    expect(hits[0].toi).toBe(0);
  });

  it('the owner is never a victim', () => {
    const s = strike();
    expect(stepStrike(s, q, { prev: blade(0, -1), now: blade(0, 1) }, 0.25)).toEqual([]);
  });

  it('dir is the tip’s motion, flat and unit', () => {
    const s = strike();
    const [h] = stepStrike(s, q, { prev: blade(2, -1), now: blade(2, 1) }, 0.25);
    expect(h.dir[0]).toBeCloseTo(0, 5);
    expect(h.dir[1]).toBeCloseTo(0, 5);
    expect(h.dir[2]).toBeCloseTo(1, 5);
    expect(h.at[0]).toBeCloseTo(2, 0);
  });

  it('a refused sweep answers nothing and keeps the strike open', () => {
    const tight = createQueries(phys, { budget: { take: () => false, frame() {}, stats: () => ({}) } });
    const s = strike();
    expect(stepStrike(s, tight, { prev: blade(2, -1), now: blade(2, 1) }, 0.25)).toEqual([]);
    expect(s.hits.size).toBe(0);
  });
});

describe('clashOf', () => {
  it('two blades crossing is a clash, two apart is not', () => {
    const a = strike();
    const b = createStrike({ id: 'b', owner: victim.body, r: 0.12, damage: 2, kind: 'light', window: [0, 1] });
    stepStrike(a, q, { prev: blade(1, -0.5), now: blade(1, 0) }, 0.25);
    stepStrike(b, q, { prev: { base: [0.5, 1, 0], tip: [1.5, 1, 0] }, now: { base: [0.5, 1, 0], tip: [1.5, 1, 0] } }, 0.25);
    const c = clashOf(a, b);
    expect(c).not.toBeNull();
    expect(c.at[0]).toBeCloseTo(1, 1);
    expect(c.at[1]).toBeCloseTo(1, 1);
    const far = createStrike({ id: 'c', owner: victim.body, r: 0.12, damage: 2, kind: 'light', window: [0, 1] });
    stepStrike(far, q, { prev: blade(6, 0), now: blade(6, 0) }, 0.25);
    expect(clashOf(a, far)).toBeNull();
  });
});
