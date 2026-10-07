import { describe, expect, it } from 'vitest';
import { STEP, absorb, hostileStep, parries, startBurst, startBurst as sb, stepBurst, strafeStep } from './hostiles';
import { seeded } from '../../../lib/seeded';
import { createSearch } from '../../../lib/ai/search';
import { createTokens } from '../../../lib/ai/squad';

describe('how the enemies fight', () => {
  it('fires a burst a shot at a time, then runs dry', () => {
    const b = startBurst({ burst: { n: 3, gap: 0.1 } });
    expect(b).toEqual({ left: 3, wait: 0 });
    expect(stepBurst(b, 0.016, 0.1)).toBe(1);
    expect(stepBurst(b, 0.05, 0.1)).toBe(0);
    expect(stepBurst(b, 0.06, 0.1)).toBe(1);
    expect(stepBurst(b, 0.5, 0.1)).toBe(1); // (the last, however long the frame)
    expect(stepBurst(b, 1, 0.1)).toBe(0);
    expect(sb(null).left).toBe(1); // (one without a burst: one shot)
  });

  it('strafes across the line to you, holding its distance', () => {
    const you = { x: 0, z: 0 };
    const h = { strafe: { speed: 2, every: 2, keep: 10 } };
    const a = strafeStep({ x: 0, z: 10 }, you, h, 0.5, 0);
    expect(a.yaw).toBeCloseTo(Math.PI, 5); // (facing you)
    expect(Math.abs(a.x)).toBeCloseTo(1, 5); // (a metre across in half a second)
    expect(a.z).toBeCloseTo(10, 5); // (at the distance it likes: no closer)
    const b = strafeStep({ x: 0, z: 10 }, you, h, 0.5, 2.5);
    expect(Math.sign(b.x)).toBe(-Math.sign(a.x)); // (the other way, a couple of seconds on)
    // too far: it comes in; too close: it backs off
    expect(strafeStep({ x: 0, z: 20 }, you, h, 0.5, 0).z).toBeLessThan(20);
    expect(strafeStep({ x: 0, z: 4 }, you, h, 0.5, 0).z).toBeGreaterThan(4);
  });

  it('soaks hits on a shield before the body takes any', () => {
    expect(absorb({ shield: 3, hp: 2 }, 1)).toEqual({ shield: 2, hp: 2 });
    expect(absorb({ shield: 1, hp: 2 }, 2)).toEqual({ shield: 0, hp: 1 });
    expect(absorb({ shield: 0, hp: 2 }, 1)).toEqual({ shield: 0, hp: 1 });
    expect(absorb({ hp: 2 }, 2)).toEqual({ shield: 0, hp: 0 });
  });

  it('parries a share of swings, never without a blade', () => {
    expect(parries({ parry: 0.5 }, 0.2)).toBe(true);
    expect(parries({ parry: 0.5 }, 0.7)).toBe(false);
    expect(parries({}, 0.0)).toBe(false);
    expect(parries(null, 0.0)).toBe(false);
  });
});

describe('an enemy’s head', () => {
  const DT = 1 / 30;
  const trooper = (over = {}) => ({ b: { x: 0, z: 0, yaw: 0, to: null, wait: 0 }, hostile: { range: 40, every: 2, damage: 6, ...over.hostile }, spec: { roam: 4, leash: 40, speed: 1.4, ...over.spec }, home: [0, 0], hp: 2, hpMax: 2, flinch: 0 });
  // a wall along x = 10: nothing sees across it
  const wall = (a, b) => (a.x < 10) === (b.x < 10);
  const run = (t, world, seconds, r = seeded(1), each = null) => {
    const modes = new Set();
    let out = null;
    for (let s = 0; s < seconds; s += DT) {
      const w = typeof world === 'function' ? world(s) : world;
      out = hostileStep(t, w, DT, r);
      t.b.x = out.x;
      t.b.z = out.z;
      t.b.yaw = out.yaw;
      modes.add(out.mode);
      each?.(out, s);
    }
    return { out, modes };
  };

  it('a trooper that loses you behind a wall goes to where you were, then looks about with the others', () => {
    const t = trooper();
    const search = createSearch({ rand: seeded(2), spots: (b) => [{ x: b.at.x + 6, y: 0, z: b.at.z + 6 }, { x: b.at.x - 6, y: 0, z: b.at.z - 6 }] });
    let lookedAt = null;
    let guessedAt = null;
    const { modes } = run(
      t,
      (s) => ({ you: s < 3 ? { x: 5, z: 20 } : { x: 15, z: 24 }, allies: [], seesThrough: wall, search, who: 'a' }),
      22,
      seeded(1),
      (out, s) => {
        if (out.mode === 'look' && lookedAt === null) lookedAt = { s, goal: { ...t.mind.goal } };
        if (out.guessed && guessedAt === null) guessedAt = s;
        search.update(DT);
      },
    );
    expect(guessedAt).toBeGreaterThan(3 + 2.5 - 0.2);
    expect(lookedAt).not.toBeNull();
    // where it last had you: behind the wall, where you went in the moment it still knew
    expect(lookedAt.goal.x).toBeCloseTo(15, 0);
    expect(lookedAt.goal.z).toBeCloseTo(24, 0);
    expect(modes.has('search')).toBe(true);
  });

  it('fires at its belief, not at you, once it can only guess', () => {
    const t = trooper();
    const aims = [];
    // you step behind the wall at 2 s, and once it can only guess (2.5 s on) you move on along it
    run(t, (s) => ({ you: s < 2 ? { x: 5, z: 10 } : s < 5 ? { x: 15, z: 10 } : { x: 15, z: 30 }, allies: [], seesThrough: wall }), 8, seeded(1), (out, s) => {
      if (s > 5.3 && out.aim) aims.push(out);
    });
    expect(aims.length).toBeGreaterThan(0);
    for (const a of aims) {
      expect(a.guessed).toBe(true);
      expect(Math.hypot(a.aim.x - 15, a.aim.z - 30)).toBeGreaterThan(3);
    }
    // in sight, it aims at you
    const u = trooper();
    const { out } = run(u, { you: { x: 5, z: 10 }, allies: [], seesThrough: wall }, 2);
    expect(out.aim).toEqual({ x: 5, z: 10 });
    expect(out.guessed).toBe(false);
  });

  it('a blaster trooper with no shot takes cover from your line of fire; a duellist stays in your view', () => {
    const tokens = createTokens({ pools: { shot: 0 } });
    // a pillar between: a wall on x = 10 hides anything on its far side from you at x = 0
    const t = trooper({ spec: { leash: 60, roam: 4, speed: 1.4 } });
    t.b.x = 8;
    let deepest = 0;
    const { modes } = run(t, { you: { x: 0, z: 0 }, allies: [], seesThrough: wall, tokens, who: 'a' }, 12, seeded(1), (out) => {
      deepest = Math.max(deepest, out.x);
    });
    expect(modes.has('cover')).toBe(true);
    expect(deepest).toBeGreaterThan(10);
    const duel = trooper({ hostile: { range: 14, chase: 1.8, melee: true, reach: 2.6, blade: { color: '#f00' } } });
    duel.b.x = 8;
    const d = run(duel, { you: { x: 0, z: 0 }, allies: [], seesThrough: wall, tokens, who: 'd' }, 6);
    expect(d.modes.has('cover')).toBe(false);
    expect(d.modes.has('close')).toBe(true);
    expect(Math.hypot(d.out.x, d.out.z)).toBeLessThan(3.5);
  });

  it('the old spawns run as before: a strafer circles, holding its distance; a chaser comes to arm’s reach and stops', () => {
    const s = trooper({ hostile: { range: 45, strafe: { speed: 2.6, every: 2.2, keep: 14 } }, spec: { roam: 4, leash: 60 } });
    s.b.z = 14;
    let crossed = 0;
    let minD = Infinity;
    run(s, { you: { x: 0, z: 0 }, allies: [] }, 8, seeded(3), (out) => {
      if (Math.abs(out.x) > 1) crossed += 1;
      minD = Math.min(minD, Math.hypot(out.x, out.z));
    });
    expect(crossed).toBeGreaterThan(30);
    expect(minD).toBeGreaterThan(14 * 0.6);
    const c = trooper({ hostile: { range: 40, chase: 2.7, melee: true, reach: 3.4 }, spec: { roam: 3, leash: 15 } });
    c.b.z = 12;
    const r = run(c, { you: { x: 0, z: 0 }, allies: [] }, 8);
    expect(Math.hypot(r.out.x, r.out.z)).toBeLessThan(3.4);
    expect(Math.hypot(r.out.x, r.out.z)).toBeGreaterThan(1.5);
    // and never further from home than its leash: a chaser with a short leash stops short
    const k = trooper({ hostile: { range: 60, chase: 2.7, melee: true, reach: 2 }, spec: { roam: 3, leash: 6 } });
    const far = run(k, { you: { x: 0, z: 30 }, allies: [] }, 8);
    expect(far.out.z).toBeLessThanOrEqual(6.01);
    // with nobody about, it wanders near home
    const w = trooper();
    const wander = run(w, { you: null, allies: [] }, 10);
    expect(wander.modes.has('wander')).toBe(true);
    expect(Math.hypot(wander.out.x, wander.out.z)).toBeLessThan(5);
    expect(STEP.rethink).toBeGreaterThan(0);
  });
});
