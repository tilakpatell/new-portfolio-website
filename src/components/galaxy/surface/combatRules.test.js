import { describe, expect, it } from 'vitest';
import { DODGE, FORCE, GUARD, HEAVY, PARRY, STANCES, STANCE_IDS, arcHit, dodgeStep, forceAt, guardHit, guardStep, hitStop, lungeTo, nextSwing, parried, pushVelocity, stanceOf, swingPose } from './combatRules';

describe('the stances', () => {
  it('each has strokes that start and end where they say, eased between', () => {
    for (const id of STANCE_IDS) {
      const s = STANCES[id];
      expect(s.swings.length, id).toBeGreaterThanOrEqual(2);
      s.swings.forEach((sw, i) => {
        expect(swingPose(s, i, 0)).toEqual({ yaw: sw.yaw[0], pitch: sw.pitch[0] });
        expect(swingPose(s, i, 1)).toEqual({ yaw: sw.yaw[1], pitch: sw.pitch[1] });
        const mid = swingPose(s, i, 0.5);
        expect(mid.yaw).toBeCloseTo((sw.yaw[0] + sw.yaw[1]) / 2, 5);
        expect(sw.dur).toBeGreaterThan(0.2);
        expect(sw.damage).toBeGreaterThan(0);
        expect(sw.lead).toBeGreaterThan(0.3);
        expect(sw.lead).toBeLessThan(0.8);
      });
    }
  });
  it('the fast stances strike quicker and lighter than the heavy one', () => {
    const dps = (s) => s.swings.reduce((a, sw) => a + sw.damage, 0) / s.swings.reduce((a, sw) => a + sw.dur, 0);
    expect(STANCES.heavy.swings[0].dur).toBeGreaterThan(STANCES.dual.swings[0].dur);
    expect(STANCES.heavy.swings[0].damage).toBeGreaterThan(STANCES.dual.swings[0].damage);
    expect(Math.abs(dps(STANCES.single) - dps(STANCES.heavy))).toBeLessThan(3); // (neither way out in front)
    expect(STANCES.double.half).toBeGreaterThan(STANCES.single.half); // (the staff sweeps wider)
  });
  it('an unknown stance is the single blade', () => {
    expect(stanceOf('nope')).toBe(STANCES.single);
  });
  it('chains the combo only within the window', () => {
    const s = STANCES.single;
    expect(nextSwing(s, null, 5)).toBe(0);
    expect(nextSwing(s, { i: 0, endedAt: 5 }, 5.3)).toBe(1);
    expect(nextSwing(s, { i: 2, endedAt: 5 }, 5.3)).toBe(0);
    expect(nextSwing(s, { i: 0, endedAt: 5 }, 5.6)).toBe(0);
  });
  it('the heavy stroke is slower and harder than any stance’s', () => {
    expect(HEAVY.dur).toBeGreaterThan(Math.max(...STANCES.single.swings.map((s) => s.dur)));
    expect(HEAVY.damage).toBeGreaterThanOrEqual(Math.max(...STANCES.single.swings.map((s) => s.damage)));
    expect(HEAVY.breaks).toBe(true);
  });
});

describe('reach and the lunge', () => {
  const me = { x: 0, z: 0, yaw: 0 };
  it('hits inside the arc, not behind or too far', () => {
    expect(arcHit(me, { x: 0, z: 2 }, 2.6, 1.1)).toBe(true);
    expect(arcHit(me, { x: 0, z: -2 }, 2.6, 1.1)).toBe(false);
    expect(arcHit(me, { x: 0, z: 5 }, 2.6, 1.1)).toBe(false);
    expect(arcHit(me, { x: 0, z: 3 }, 2.6, 1.1, 0.5)).toBe(false);
  });
  it('steps in to a target a little out of reach, but not across the room', () => {
    const s = STANCES.single;
    expect(lungeTo(me, { x: 0, z: 1.5, r: 0.5 }, s)).toBe(0);
    const d = lungeTo(me, { x: 0, z: 4, r: 0.5 }, s);
    expect(d).toBeGreaterThan(1);
    expect(d).toBeLessThan(3);
    expect(lungeTo(me, { x: 0, z: 12, r: 0.5 }, s)).toBe(0);
  });
});

describe('the guard and the parry', () => {
  it('spends on blocks, breaks when spent, regrows after a pause and comes back staggered', () => {
    let g = { value: GUARD.max, hitAt: null, brokenAt: null };
    g = guardHit(g, 30, 10);
    expect(g.value).toBe(70);
    expect(g.brokenAt).toBeNull();
    expect(guardStep(g, 0.5, 10.5).value).toBe(70); // (too soon to regrow)
    expect(guardStep(g, 0.5, 12).value).toBeCloseTo(70 + GUARD.regen * 0.5);
    g = guardHit(g, 100, 13);
    expect(g.value).toBe(0);
    expect(g.brokenAt).toBe(13);
    expect(guardStep(g, 0.1, 13.5)).toBe(g); // (still down)
    const back = guardStep(g, 0.1, 13 + GUARD.broken + 0.01);
    expect(back.brokenAt).toBeNull();
    expect(back.value).toBeGreaterThan(0);
  });
  it('parries only a swipe that lands just after the block went up', () => {
    expect(parried(5, 5.1)).toBe(true);
    expect(parried(5, 5 + PARRY.window + 0.01)).toBe(false);
    expect(parried(null, 5)).toBe(false);
    expect(parried(6, 5)).toBe(false);
  });
});

describe('the dodge and the Force', () => {
  it('covers its distance, safe at the start', () => {
    expect(dodgeStep(0).d).toBe(0);
    expect(dodgeStep(1).d).toBeCloseTo(DODGE.dist);
    expect(dodgeStep(0.5).d).toBeGreaterThan(DODGE.dist / 2); // (quick out of the blocks)
    expect(dodgeStep(0.1).safe).toBe(true);
    expect(dodgeStep(0.95).safe).toBe(false);
  });
  it('the push reaches a cone in front, harder up close, and shoves away; the pull draws in', () => {
    const me = { x: 0, z: 0, yaw: 0 };
    expect(forceAt(me, { x: 0, z: 4 }).hit).toBe(true);
    expect(forceAt(me, { x: 0, z: 4 }).k).toBeGreaterThan(forceAt(me, { x: 0, z: 8 }).k);
    expect(forceAt(me, { x: 0, z: -4 }).hit).toBe(false);
    expect(forceAt(me, { x: 0, z: FORCE.push.range + 1 }).hit).toBe(false);
    const v = pushVelocity(me, { x: 0, z: 4 }, 1);
    expect(v.vz).toBeGreaterThan(0);
    expect(v.vy).toBeGreaterThan(0);
    expect(pushVelocity(me, { x: 0, z: 4 }, 1, 'pull').vz).toBeLessThan(0);
  });
  it('a hit holds the frame a touch, a kill a touch more', () => {
    expect(hitStop(2)).toBeGreaterThan(0);
    expect(hitStop(5)).toBeGreaterThan(hitStop(2));
    expect(hitStop(2, true)).toBeGreaterThan(hitStop(5));
    expect(hitStop(2, true)).toBeLessThan(0.15);
  });
});
