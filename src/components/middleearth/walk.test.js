import { describe, expect, it } from 'vitest';
import { WALK, newWalk, spotOf, stepWalk } from './walk';

const DT = 1 / 60;
// a walk with the Eye's light parked somewhere and no orcs till asked for
const quiet = ({ beam = -1e4, rand = () => 0.5 } = {}) => {
  const s = newWalk({ rand });
  s.beamAt = () => beam;
  s.patrolAt = 1e9;
  return s;
};
// step for `seconds`, or until it's over; the events seen
const run = (s, seconds, walking) => {
  const seen = [];
  for (let i = 0; i < Math.round(seconds / DT) && s.state === 'walking'; i++) seen.push(...stepWalk(s, DT, typeof walking === 'function' ? walking(s) : walking).map((e) => e.type));
  return seen;
};

describe('across Gorgoroth', () => {
  it('walks while held, and stands still when let go', () => {
    const s = quiet();
    run(s, 1, true);
    expect(s.x).toBeCloseTo(WALK.x0 + WALK.speed, 0);
    const at = s.x;
    run(s, 1, false);
    expect(s.x).toBe(at);
  });

  it('is seen after a moment’s grace walking in the light, but not standing in it', () => {
    const s = quiet({ beam: WALK.x0 });
    run(s, WALK.grace - 0.05, false);
    expect(s.state).toBe('walking');
    expect(run(s, 1, false)).toEqual([]);
    const ev = run(s, 1, true);
    expect(ev).toContain('seen');
    expect(s.state).toBe('seen');
    expect(s.exposed).toBeGreaterThan(WALK.grace);
    expect(s.exposed).toBeLessThan(WALK.grace + 2 * DT);
  });

  it('puts the Ring on when it weighs too much, and a rest lightens it', () => {
    const s = quiet();
    run(s, 3, true);
    const heavy = s.burden;
    expect(heavy).toBeCloseTo(3 * WALK.burdenUp, 1);
    run(s, 1, false);
    expect(s.burden).toBeCloseTo(heavy - WALK.burdenDown, 1);
    // walking from the start without a rest: (1 / burdenUp) s, unless Sam carries him first
    const t = quiet();
    t.x = WALK.x0;
    const ev = run(t, 1 / WALK.burdenUp + 0.1, (w) => (w.x = WALK.x0) && true);
    expect(ev).toContain('ring');
    expect(t.state).toBe('ring');
  });

  it('is carried by Sam three quarters of the way, quicker, and the Ring stops getting heavier', () => {
    const s = quiet();
    s.x = WALK.x0 + (WALK.x1 - WALK.x0) * WALK.carryAt - 1;
    const ev = run(s, 0.2, (w) => {
      w.burden = 0.5;
      return true;
    });
    expect(ev).toContain('carry');
    expect(s.carried).toBe(true);
    const from = s.x;
    s.burden = 0.5;
    run(s, 0.5, true);
    expect(s.x - from).toBeCloseTo(WALK.speed * WALK.carrySpeed * 0.5, 0);
    expect(s.burden).toBe(0.5);
  });

  it('catches them walking when a patrol passes, and lets them be standing still', () => {
    const walker = quiet();
    walker.patrolAt = 0;
    const ev = run(walker, 20, true);
    expect(ev).toContain('patrol');
    expect(ev.at(-1)).toBe('caught');

    const still = quiet();
    still.patrolAt = 0;
    const evs = run(still, 20, false);
    expect(evs).toContain('passed');
    expect(still.state).toBe('walking');
    expect(still.passed).toBe(1);
  });

  it('gets there', () => {
    const s = quiet();
    s.x = WALK.x1 - 1;
    expect(run(s, 0.5, true)).toContain('there');
    expect(s.state).toBe('there');
    expect(s.x).toBe(WALK.x1);
  });

  it('does nothing more once it’s over', () => {
    const s = quiet();
    s.state = 'seen';
    expect(stepWalk(s, DT, true)).toEqual([]);
    expect(s.x).toBe(WALK.x0);
  });

  it('sweeps the Eye along the plain', () => {
    const s = newWalk();
    const spots = [];
    for (let i = 0; i < 600; i++) {
      stepWalk(s, DT, false);
      spots.push(spotOf(s));
    }
    expect(Math.min(...spots)).toBeLessThan(150);
    expect(Math.max(...spots)).toBeGreaterThan(380);
  });
});
