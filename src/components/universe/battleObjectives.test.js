import { describe, expect, it } from 'vitest';
import { TYPES, keysOf, progressOf, titleOf, typeOf } from './battleObjectives';

const KEY = /^[a-z0-9][a-z0-9:._-]{0,47}$/;
const tally = (o) => (k) => o[k] ?? 0;

describe('the objective types', () => {
  it('are the battles’ kinds of objective: destroy, a group, a zone, the runners, a wave, a boarding, an ace, a run', () => {
    expect(Object.keys(TYPES).sort()).toEqual(['ace', 'board', 'destroy', 'escort', 'group', 'intercept', 'run', 'wave', 'zone']);
    for (const [id, t] of Object.entries(TYPES)) {
      expect(['stage', 'runners', 'side'], id).toContain(t.scope);
      expect(t.verbs, id).toHaveLength(2);
      for (const v of t.verbs) expect(v, id).toMatch(/^[A-Z]/);
    }
  });

  it('count a destroy’s (and a group’s, and a run’s) shots by its id, a run’s each worth its share of the stage', () => {
    expect(progressOf({ id: 'bridge', type: 'destroy', hp: 300 }, tally({ bridge: 12 }))).toBe(12);
    expect(progressOf({ id: 'sat-1', type: 'group', hp: 90 }, tally({ 'sat-1': 5 }))).toBe(5);
    expect(progressOf({ id: 'ds2-core', type: 'run', hp: 420, unit: 10.5 }, tally({ 'ds2-core': 4 }))).toBe(42);
    expect(keysOf({ id: 'bridge', type: 'destroy' })).toEqual(['bridge']);
  });

  it('count a zone’s seconds held by the attackers, net of the defenders’, as its share of the stage', () => {
    const relay = { id: 'relay', type: 'zone', hp: 300, hold: 40 };
    expect(keysOf(relay)).toEqual(['relay:a', 'relay:d']);
    expect(progressOf(relay, tally({ 'relay:a': 20 }))).toBeCloseTo(150, 9);
    expect(progressOf(relay, tally({ 'relay:a': 20, 'relay:d': 8 }))).toBeCloseTo(90, 9);
    // (contested to nothing, never less)
    expect(progressOf(relay, tally({ 'relay:a': 5, 'relay:d': 30 }))).toBe(0);
  });

  it('keep an ace’s hull by its side, and a wave’s intercepts by its id', () => {
    expect(keysOf({ id: 'ace-1', type: 'ace', team: 1 })).toEqual(['ace:1']);
    expect(keysOf({ id: 'w0', type: 'wave' })).toEqual(['w0']);
    for (const o of [{ id: 'gen-port', type: 'destroy' }, { id: 'relay', type: 'zone' }, { id: 'ace-0', type: 'ace', team: 0 }, { id: 'w1', type: 'wave' }]) for (const k of keysOf(o)) expect(k).toMatch(KEY);
  });

  it('say what to do about each, for whoever attacks and whoever defends', () => {
    expect(titleOf({ type: 'destroy', name: 'Shield projector' }, true)).toBe('Destroy: Shield projector');
    expect(titleOf({ type: 'destroy', name: 'Shield projector' }, false)).toBe('Defend: Shield projector');
    expect(titleOf({ type: 'zone', name: 'the comms relay' }, true)).toBe('Hold: the comms relay');
    expect(titleOf({ type: 'zone', name: 'the comms relay' }, false)).toBe('Contest: the comms relay');
    // (an objective may have its own words: a boarding's engines, disabled)
    expect(titleOf({ type: 'destroy', name: 'the Tantive IV’s engines', verbs: ['Disable', 'Defend'] }, true)).toBe('Disable: the Tantive IV’s engines');
    expect(typeOf({ type: 'nonsense' })).toBe(TYPES.destroy);
  });
});
