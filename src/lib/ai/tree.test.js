import { describe, expect, it } from 'vitest';
import { DONE, FAILED, RUNNING, cooldown, guard, parallel, repeat, reset, select, sequence, tick, utility } from './tree';

// a leaf that runs once then is done, counting on the blackboard (so two
// blackboards on one tree each get their own count)
const once = (log, name) => (bb) => {
  log.push(name);
  bb[name] = (bb[name] ?? 0) + 1;
  return bb[name] === 1 ? RUNNING : DONE;
};

describe('the tree', () => {
  it('a sequence resumes where it was', () => {
    const log = [];
    const t = sequence(once(log, 'a'), once(log, 'b'));
    const bb = {};
    expect(tick(t, bb, 0.1)).toBe(RUNNING); // a running
    expect(tick(t, bb, 0.1)).toBe(RUNNING); // a done, b running
    expect(tick(t, bb, 0.1)).toBe(DONE);
    expect(log.filter((x) => x === 'b')).toHaveLength(2);
  });

  it('a sequence fails at a failed child, a select stops at the first done', () => {
    const log = [];
    expect(tick(sequence(() => FAILED, () => (log.push('x'), DONE)), {}, 0)).toBe(FAILED);
    expect(log).toEqual([]);
    expect(tick(select(() => FAILED, () => DONE, () => (log.push('y'), DONE)), {}, 0)).toBe(DONE);
    expect(log).toEqual([]);
    expect(tick(select(() => FAILED), {}, 0)).toBe(FAILED);
  });

  it('a guard fails without running its node', () => {
    let ran = false;
    expect(tick(guard(() => false, () => ((ran = true), DONE)), {}, 0)).toBe(FAILED);
    expect(ran).toBe(false);
    expect(tick(guard(() => true, () => DONE), {}, 0)).toBe(DONE);
  });

  it('a cooldown fails until its time', () => {
    const t = cooldown(2, () => DONE, 'k');
    const bb = { clock: 0 };
    expect(tick(t, bb, 0)).toBe(DONE);
    bb.clock = 1;
    expect(tick(t, bb, 0)).toBe(FAILED);
    bb.clock = 2.5;
    expect(tick(t, bb, 0)).toBe(DONE);
  });

  it('parallel and repeat', () => {
    const log = [];
    expect(tick(parallel(() => DONE, once(log, 'p')), {}, 0)).toBe(RUNNING);
    expect(tick(parallel(() => FAILED, () => DONE), {}, 0)).toBe(FAILED);
    const r = repeat(() => DONE);
    expect(tick(r, {}, 0)).toBe(RUNNING);
    expect(tick(repeat(() => FAILED), {}, 0)).toBe(FAILED);
  });

  it('a utility node ticks the best option and holds it under momentum', () => {
    const log = [];
    const t = utility(
      [
        { id: 'a', considerations: [(bb) => bb.a] },
        { id: 'b', considerations: [(bb) => bb.b] },
      ],
      { a: () => (log.push('a'), RUNNING), b: () => (log.push('b'), RUNNING) },
    );
    const bb = { a: 0.5, b: 0.4 };
    tick(t, bb, 0);
    bb.b = 0.55; // within momentum of a
    tick(t, bb, 0);
    bb.b = 0.9;
    tick(t, bb, 0);
    expect(log).toEqual(['a', 'a', 'b']);
    expect(tick(t, { a: 0, b: 0 }, 0)).toBe(FAILED);
  });

  it('two blackboards on one tree don’t share state, and reset clears it', () => {
    const log = [];
    const t = sequence(once(log, 'a'), () => DONE);
    const b1 = {};
    const b2 = {};
    expect(tick(t, b1, 0)).toBe(RUNNING);
    expect(tick(t, b2, 0)).toBe(RUNNING);
    reset(t, b1);
    expect(b1._tree[t.id]).toBeUndefined();
  });
});
