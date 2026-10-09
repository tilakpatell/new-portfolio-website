import { describe, expect, it } from 'vitest';
import { CLIPS } from '../../../lib/three/clipLibrary';
import { BLOCK_CLIP, DASH_CLIP, DIRS, DODGE, FORCE, GUARD, HEAVY, PARRY, STANCES, STANCE_IDS, STRIKE, dodgeStep, forceAt, guardHit, guardStep, blockOutcome, hitStop, lungeTo, pushVelocity, rootScale, stanceOf, strokeFor } from './combatRules';

describe('the stances', () => {
  it('each strokes in clips the library has, with its numbers', () => {
    for (const id of STANCE_IDS) {
      const s = STANCES[id];
      expect(s.strokes.length, id).toBeGreaterThanOrEqual(2);
      for (const k of s.strokes) {
        expect(CLIPS[k.clip], `${id} ${k.clip}`).toBeTruthy();
        expect(k.speed).toBeGreaterThan(0.5);
        expect(k.damage).toBeGreaterThan(0);
      }
    }
    for (const c of [...HEAVY.clips, ...Object.values(DIRS).map((d) => d.clip), BLOCK_CLIP, DASH_CLIP]) expect(CLIPS[c], c).toBeTruthy();
  });
  it('the fast stances strike quicker and lighter than the heavy one', () => {
    expect(STANCES.dual.strokes[0].speed).toBeGreaterThan(STANCES.heavy.strokes[0].speed);
    expect(STANCES.heavy.strokes[0].damage).toBeGreaterThan(STANCES.dual.strokes[0].damage);
  });
  it('an unknown stance is the single blade', () => {
    expect(stanceOf('nope')).toBe(STANCES.single);
  });
  it('the heavy stroke is harder than any stance’s and breaks a guard', () => {
    expect(HEAVY.damage).toBeGreaterThanOrEqual(Math.max(...STANCES.single.strokes.map((s) => s.damage)));
    expect(HEAVY.breaks).toBe(true);
  });
  it('the parry is the first quarter second of the block', () => {
    expect(PARRY.window).toBe(0.25);
  });
});

describe('strokeFor', () => {
  const s = STANCES.single;
  it('chains the combo in order within 0.45 s of the last ending, and starts over after', () => {
    let last = null;
    const seen = [];
    for (let i = 0; i < s.strokes.length + 1; i++) {
      const k = strokeFor(s, { last, now: 5 + i });
      seen.push(k.clip);
      last = { ...k, endedAt: 5 + i + 0.7 };
    }
    expect(seen).toEqual([...s.strokes.map((k) => k.clip), s.strokes[0].clip]);
    expect(strokeFor(s, { last: { ...strokeFor(s, {}), endedAt: 5 }, now: 5.6 }).clip).toBe(s.strokes[0].clip);
  });
  it('W strokes overhead, A and D cut from their side, S rises', () => {
    expect(strokeFor(s, { dir: 'up' }).clip).toBe('sword.heavy.a');
    expect(strokeFor(s, { dir: 'left' }).clip).toBe(DIRS.left.clip);
    expect(strokeFor(s, { dir: 'right' }).clip).toBe(DIRS.right.clip);
    expect(DIRS.left.clip).not.toBe(DIRS.right.clip);
    expect(strokeFor(s, { dir: 'rise' }).clip).toBe('sword.uppercut');
    // (a direction breaks the combo: the next plain one starts it again)
    const up = strokeFor(s, { dir: 'up', now: 1 });
    expect(strokeFor(s, { last: { ...up, endedAt: 1.2 }, now: 1.3 }).clip).toBe(s.strokes[0].clip);
  });
  it('the heavy ones chain A to D while they come quickly', () => {
    let last = null;
    const seen = [];
    for (let i = 0; i < 5; i++) {
      const k = strokeFor(s, { last, now: i, heavy: true });
      expect(k.heavy).toBe(true);
      expect(k.damage).toBe(HEAVY.damage);
      seen.push(k.clip);
      last = { ...k, endedAt: i + 0.8 };
    }
    expect(seen).toEqual([...HEAVY.clips, HEAVY.clips[0]]);
  });
  it('carries the stance’s lunge', () => {
    expect(strokeFor(STANCES.dual, {}).lunge).toBe(STANCES.dual.lunge);
  });
});

describe('the root’s travel', () => {
  it('scales a stroke’s step to land it STRIKE short of the one it’s locked on, never past the lunge', () => {
    expect(rootScale(1, null, 3.5)).toBe(1); // (no lock: the clip's own step)
    expect(rootScale(5, null, 3.5)).toBeCloseTo(0.7); // (but never past the lunge)
    expect(rootScale(1, STRIKE + 2, 3.5)).toBeCloseTo(2);
    expect(rootScale(1, STRIKE + 6, 3.5)).toBeCloseTo(3.5);
    expect(rootScale(1, STRIKE - 0.5, 3.5)).toBe(0); // (already there: no step)
    expect(rootScale(0, 4, 3.5)).toBe(0); // (a clip that doesn't go anywhere)
  });
});

describe('the lunge', () => {
  const me = { x: 0, z: 0, yaw: 0 };
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
  // their blade's contact, met by yours: a parry is the block begun within
  // the window before their contact (or between it and now); held up from
  // earlier it's a block; not up at all, the stroke lands
  it('parries a block begun within the window before their contact, blocks one up from before', () => {
    const at = { contactAt: 10, now: 10.1 };
    expect(blockOutcome({ shown: true, blockAt: 10 - PARRY.window + 0.01, ...at })).toBe('parry');
    expect(blockOutcome({ shown: true, blockAt: 10.05, ...at })).toBe('parry');
    expect(blockOutcome({ shown: true, blockAt: 10 - PARRY.window - 0.01, ...at })).toBe('block');
    expect(blockOutcome({ shown: true, blockAt: null, ...at })).toBe('block');
    expect(blockOutcome({ shown: false, blockAt: 9.95, ...at })).toBe('hit');
    // (a perk's wider window)
    expect(blockOutcome({ shown: true, blockAt: 9.6, ...at, window: 0.5 })).toBe('parry');
  });
  it('a swipe that lands as it’s decided (a brawler’s) is parried by a block just before it', () => {
    expect(blockOutcome({ shown: true, blockAt: 4.9, contactAt: 5, now: 5 })).toBe('parry');
    expect(blockOutcome({ shown: true, blockAt: 5 - PARRY.window - 0.05, contactAt: 5, now: 5 })).toBe('block');
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
    // a push with its own numbers (a roar's): a wider cone, a shorter reach
    const roar = { range: 5, cone: 1.4, force: 8, lift: 2 };
    expect(forceAt(me, { x: 0, z: 6 }, 'push', roar).hit).toBe(false);
    expect(forceAt(me, { x: 3, z: 1 }, 'push', roar).hit).toBe(true);
    expect(pushVelocity(me, { x: 0, z: 4 }, 1, 'push', roar).vz).toBeCloseTo(8);
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
