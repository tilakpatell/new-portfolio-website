import { describe, expect, it } from 'vitest';
import { seeded } from '../../../../lib/seeded';
import { canUse, createForce, emperorMind, forceStep, POWERS, stopForce, TAUNTS, useForce, vaderMind } from './force';
import { createFighter, resolveClash, saberStep, STROKES } from './saber';

const STEP = 1 / 30;

// Runs a force's clock for `s` seconds, gathering the events.
function run(force, caster, targets, s) {
  const events = [];
  for (let t = 0; t < s - 1e-9; t += STEP) events.push(...forceStep(force, caster, targets, STEP));
  return events;
}

// Someone `d` metres from the origin, `deg` degrees off north (−z), towards +x.
function at(id, d, deg = 0, extra = {}) {
  const r = (deg * Math.PI) / 180;
  return createFighter({ id, x: d * Math.sin(r), z: -d * Math.cos(r), yaw: Math.PI, side: 'rebel', ...extra });
}

// A caster at the origin facing north.
const caster = (id) => createFighter({ id, x: 0, z: 0, yaw: 0, side: 'empire' });

describe('who may use what', () => {
  it('lets only Vader choke, only the Emperor throw lightning, and only Obi-Wan make a noise', () => {
    expect(canUse(createForce('vader'), 'choke')).toBe(true);
    expect(canUse(createForce('luke'), 'choke')).toBe(false);
    expect(canUse(createForce('emperor'), 'lightning')).toBe(true);
    expect(canUse(createForce('vader'), 'lightning')).toBe(false);
    expect(canUse(createForce('obiwan'), 'distract')).toBe(true);
    expect(canUse(createForce('luke'), 'distract')).toBe(false);
    expect(canUse(createForce('luke'), 'push')).toBe(true);
    expect(canUse(createForce('han'), 'push')).toBe(false);
  });

  it('refuses a power it may not use without starting a cooldown', () => {
    const force = createForce('luke');
    expect(useForce(force, 'choke', caster('luke'), [at('t', 3)])).toBe(null);
    expect(force.cool.choke ?? 0).toBe(0);
  });
});

describe('push', () => {
  it('throws everyone in a 50° cone out to 8 m, and nobody outside it', () => {
    expect(POWERS.push).toMatchObject({ range: 8, cone: 50 });
    const inside = [at('ahead', 7.9), at('edge', 7, 45)];
    const outside = [at('far', 8.5), at('wide', 7, 55), at('behind', 2, 180)];
    const events = useForce(createForce('luke'), 'push', caster('luke'), [...inside, ...outside]);
    expect(events.map((e) => e.id).sort()).toEqual(['ahead', 'edge']);
    const ahead = events.find((e) => e.id === 'ahead');
    expect(ahead.type).toBe('push');
    expect(ahead.dir.x).toBeCloseTo(0);
    expect(ahead.dir.z).toBeCloseTo(-1);
    expect(ahead.speed).toBeGreaterThan(0);
    expect(inside.every((t) => t.stagger > 0 && !t.guard)).toBe(true);
    expect(outside.every((t) => t.stagger === 0)).toBe(true);
  });

  it('cuts short the stroke of someone it throws, so he lands no blow while thrown', () => {
    const t = at('t', 2);
    saberStep(t, { strike: 'light' }, STEP);
    t.dodge = 0.2;
    useForce(createForce('luke'), 'push', caster('luke'), [t]);
    expect(t.stroke).toBe(null);
    expect(t.dodge).toBe(0);
    const events = [];
    for (let i = 0; i < 30; i++) events.push(...saberStep(t, { strike: null }, STEP));
    expect(events.some((e) => e.type === 'blow')).toBe(false);
  });

  it('throws the near harder than the far', () => {
    const [near, far] = useForce(createForce('luke'), 'push', caster('luke'), [at('near', 1), at('far', 7)]);
    expect(near.speed).toBeGreaterThan(far.speed);
  });

  it('can’t be used again until its 3 s cooldown has run', () => {
    const force = createForce('luke');
    const me = caster('luke');
    expect(useForce(force, 'push', me, [])).toEqual([]);
    expect(useForce(force, 'push', me, [])).toBe(null);
    run(force, me, [], POWERS.push.cool - 0.1);
    expect(canUse(force, 'push')).toBe(false);
    run(force, me, [], 0.1 + STEP);
    expect(canUse(force, 'push')).toBe(true);
    expect(POWERS.push.cool).toBe(3);
  });
});

describe('pull', () => {
  it('draws the one thing nearest its aim, out to its range and inside its cone', () => {
    const { range, cone } = POWERS.pull;
    const saber = { id: 'saber', x: 0.5, y: 1, z: -6 };
    const off = at('off', 5, cone + 5);
    const events = useForce(createForce('luke'), 'pull', caster('luke'), [off, saber, at('far', range + 1)]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'pull', id: 'saber' });
    expect(events[0].dir.z).toBeGreaterThan(0.9);
  });

  it('isn’t spent when there is nothing to draw', () => {
    const force = createForce('luke');
    expect(useForce(force, 'pull', caster('luke'), [at('far', POWERS.pull.range + 1)])).toBe(null);
    expect(canUse(force, 'pull')).toBe(true);
  });
});

describe('the choke', () => {
  it('reaches a target Vader faces within its range, and no further', () => {
    const { range, cone } = POWERS.choke;
    expect(useForce(createForce('vader'), 'choke', caster('vader'), [at('t', range + 1)])).toBe(null);
    expect(useForce(createForce('vader'), 'choke', caster('vader'), [at('t', 5, cone + 5)])).toBe(null);
    expect(useForce(createForce('vader'), 'choke', caster('vader'), [at('t', range - 0.5)])).toContainEqual(expect.objectContaining({ type: 'choke', id: 't' }));
  });

  it('lifts its target for 2 s, holding it helpless, then lets it go; it never kills', () => {
    expect(POWERS.choke.s).toBe(2);
    const force = createForce('vader');
    const me = caster('vader');
    const t = at('t', 4);
    t.hp = 3;
    t.guard = true;
    useForce(force, 'choke', me, [t]);
    const held = run(force, me, [t], 1.9);
    const lifts = held.filter((e) => e.type === 'choke').map((e) => e.lift);
    expect(Math.max(...lifts)).toBeGreaterThan(0.3);
    expect(lifts[1]).toBeGreaterThan(lifts[0]);
    expect(t.guard).toBe(false);
    expect(t.stagger).toBeGreaterThan(0);
    expect(held.some((e) => e.type === 'end')).toBe(false);
    const rest = run(force, me, [t], 0.2);
    expect(rest).toContainEqual({ type: 'end', power: 'choke', id: 't' });
    expect(t.hp).toBe(1);
    expect(force.channel).toBe(null);
  });

  it('grips only someone, never a thing lying about', () => {
    const saber = { id: 'saber', x: 0, y: 1, z: -3 };
    expect(useForce(createForce('vader'), 'choke', caster('vader'), [saber])).toBe(null);
  });

  it('has a cooldown longer than its hold', () => {
    const force = createForce('vader');
    const me = caster('vader');
    useForce(force, 'choke', me, [at('t', 4)]);
    run(force, me, [at('t', 4)], POWERS.choke.s + 0.1);
    expect(canUse(force, 'choke')).toBe(false);
    run(force, me, [], POWERS.choke.cool);
    expect(canUse(force, 'choke')).toBe(true);
  });
});

describe('lightning', () => {
  it('burns 20 a second into someone with no guard', () => {
    const force = createForce('emperor');
    const me = caster('emperor');
    const t = at('luke', 6);
    useForce(force, 'lightning', me, [t]);
    const burns = run(force, me, [t], 1);
    expect(100 - t.hp).toBeCloseTo(POWERS.lightning.dps, 0);
    expect(POWERS.lightning.dps).toBe(20);
    expect(burns.every((e) => e.type !== 'lightning' || e.guarded === false)).toBe(true);
  });

  it('is halved by a saber guard facing him, which drains stamina instead', () => {
    const force = createForce('emperor');
    const me = caster('emperor');
    const t = at('luke', 6);
    t.guard = true;
    useForce(force, 'lightning', me, [t]);
    const burns = run(force, me, [t], 1);
    expect(100 - t.hp).toBeCloseTo(POWERS.lightning.dps / 2, 0);
    expect(100 - t.stamina).toBeCloseTo(POWERS.lightning.drain, 0);
    expect(burns.filter((e) => e.type === 'lightning').every((e) => e.guarded)).toBe(true);
  });

  it('isn’t halved by a guard turned away from him', () => {
    const force = createForce('emperor');
    const me = caster('emperor');
    const t = at('luke', 6);
    t.yaw = 0;
    t.guard = true;
    useForce(force, 'lightning', me, [t]);
    run(force, me, [t], 1);
    expect(100 - t.hp).toBeCloseTo(POWERS.lightning.dps, 0);
  });

  it('breaks a guard whose stamina runs out', () => {
    const force = createForce('emperor');
    const me = caster('emperor');
    const t = at('luke', 6);
    t.guard = true;
    t.stamina = 2;
    useForce(force, 'lightning', me, [t]);
    run(force, me, [t], 0.5);
    expect(t.guard).toBe(false);
    expect(t.stamina).toBe(0);
  });

  it('runs its course, or stops when told, and then cools', () => {
    const force = createForce('emperor');
    const me = caster('emperor');
    const t = at('luke', 6);
    useForce(force, 'lightning', me, [t]);
    expect(run(force, me, [t], POWERS.lightning.s + STEP)).toContainEqual({ type: 'end', power: 'lightning', id: 'luke' });
    expect(canUse(force, 'lightning')).toBe(false);
    const again = createForce('emperor');
    useForce(again, 'lightning', me, [t]);
    expect(stopForce(again)).toEqual([{ type: 'end', power: 'lightning', id: 'luke' }]);
    expect(again.channel).toBe(null);
  });

  it('reaches no further than its range', () => {
    expect(useForce(createForce('emperor'), 'lightning', caster('emperor'), [at('luke', POWERS.lightning.range + 1)])).toBe(null);
  });
});

describe('the mind trick', () => {
  it('stands down the two nearest guards within 4 m for 8 s, each echoing the line', () => {
    expect(POWERS.trick).toMatchObject({ range: 4, s: 8 });
    const guards = [at('g1', 3), at('g2', 1.5, 90), at('g3', 3.5, 180), at('g4', 4.5)];
    const events = useForce(createForce('obiwan'), 'trick', caster('obiwan'), guards);
    expect(events.map((e) => e.id)).toEqual(['g2', 'g1']);
    for (const e of events) expect(e).toMatchObject({ type: 'trick', s: 8, line: 'These aren’t the droids we’re looking for.' });
  });

  it('takes a single guard as well as two', () => {
    expect(useForce(createForce('obiwan'), 'trick', caster('obiwan'), [at('g', 2)])).toHaveLength(1);
  });

  it('isn’t spent with no guard near, and cools for 12 s once used', () => {
    const force = createForce('obiwan');
    const me = caster('obiwan');
    expect(useForce(force, 'trick', me, [at('g', 5)])).toBe(null);
    useForce(force, 'trick', me, [at('g', 2)]);
    expect(POWERS.trick.cool).toBe(12);
    run(force, me, [], 11.9);
    expect(canUse(force, 'trick')).toBe(false);
    run(force, me, [], 0.2);
    expect(canUse(force, 'trick')).toBe(true);
  });
});

describe('the distraction', () => {
  it('makes a noise between 6 and 14 m away that the guards near it hear', () => {
    const me = caster('obiwan');
    const near = useForce(createForce('obiwan'), 'distract', me, [], { at: { x: 0, y: 0, z: -2 } })[0];
    expect(Math.hypot(near.at.x, near.at.z)).toBeCloseTo(6);
    const far = useForce(createForce('obiwan'), 'distract', me, [], { at: { x: 30, y: 0, z: 0 } })[0];
    expect(far.at.x).toBeCloseTo(14);
    const guards = [at('close', 11), at('away', 3, 180)];
    const noise = useForce(createForce('obiwan'), 'distract', me, guards, { at: { x: 0, y: 0, z: -10 } })[0];
    expect(noise).toMatchObject({ type: 'noise', heard: ['close'] });
  });

  it('cools before another', () => {
    const force = createForce('obiwan');
    const me = caster('obiwan');
    useForce(force, 'distract', me, [], { at: { x: 0, y: 0, z: -10 } });
    expect(useForce(force, 'distract', me, [], { at: { x: 0, y: 0, z: -10 } })).toBe(null);
    run(force, me, [], POWERS.distract.cool + STEP);
    expect(canUse(force, 'distract')).toBe(true);
  });
});

describe('one power at a time', () => {
  it('can’t push while it holds a choke', () => {
    const force = createForce('vader');
    const me = caster('vader');
    useForce(force, 'choke', me, [at('t', 4)]);
    expect(canUse(force, 'push')).toBe(false);
  });
});

describe('Vader’s mind', () => {
  const duel = () => {
    const me = createFighter({ id: 'vader', x: 0, z: 0, yaw: 0, side: 'empire', hp: 300 });
    const foe = createFighter({ id: 'luke', x: 0, z: -1.6, yaw: Math.PI, side: 'rebel' });
    return { state: { me, force: createForce('vader'), last: null }, foe };
  };

  it('guards a stroke a beat after it starts, and keeps the guard up through its blow', () => {
    for (let s = 1; s < 30; s++) {
      const { state, foe } = duel();
      const rand = seeded(s);
      foe.stroke = { kind: 'light', t: STEP, hit: false };
      expect(vaderMind(state, foe, rand).guard).toBe(false);
      const guards = [];
      for (; foe.stroke.t < STROKES.light.s; foe.stroke.t += STEP) {
        foe.stroke.hit = foe.stroke.t >= STROKES.light.at;
        guards.push(vaderMind(state, foe, rand).guard);
      }
      // once up, it stays up to the stroke’s end, the blow’s step included
      const first = guards.indexOf(true);
      expect(first).toBeGreaterThan(-1);
      expect(guards.slice(first).every(Boolean)).toBe(true);
    }
  });

  it('brings a heavy stroke down on a held guard', () => {
    const { state, foe } = duel();
    foe.guard = true;
    expect(vaderMind(state, foe, seeded(1)).strike).toBe('heavy');
  });

  it('cuts at an open foe', () => {
    const { state, foe } = duel();
    const strikes = new Set();
    for (let s = 1; s < 20; s++) strikes.add(vaderMind(state, foe, seeded(s)).strike);
    expect(strikes.has(null)).toBe(false);
  });

  it('closes in from afar, or chokes when it can, by his rand', () => {
    const { state, foe } = duel();
    foe.z = -6;
    const chosen = new Set();
    for (let s = 1; s < 40; s++) {
      state.last = null;
      const input = vaderMind(state, foe, seeded(s));
      chosen.add(input.force === 'choke' ? 'choke' : input.move);
    }
    expect([...chosen].sort()).toEqual(['choke', 'in']);
    state.force.cool.choke = 5;
    expect(vaderMind(state, foe, seeded(1))).toMatchObject({ move: 'in', force: null });
  });

  it('never stands off just outside his reach, where a heavy can still poke at him', () => {
    for (const d of [2.3, 2.4, 2.5, 2.7, 3.0]) {
      const { state, foe } = duel();
      foe.z = -d;
      state.force.cool.choke = 5;
      const rand = seeded(Math.round(d * 10));
      const chosen = new Set();
      for (let i = 0; i < 150; i++) {
        const input = vaderMind(state, foe, rand);
        expect(input.move === 'in' || input.strike === 'heavy').toBe(true);
        chosen.add(input.strike ?? input.move);
      }
      if (d > STROKES.heavy.reach) expect(chosen).toEqual(new Set(['in']));
    }
  });

  it('does nothing new while staggered or mid-stroke', () => {
    const { state, foe } = duel();
    state.me.stagger = 0.4;
    expect(vaderMind(state, foe, seeded(1))).toMatchObject({ strike: null, guard: false, dodge: false, force: null });
  });

  it('pushes a foe off when he is short of breath', () => {
    const { state, foe } = duel();
    state.me.stamina = 5;
    expect(vaderMind(state, foe, seeded(1)).force).toBe('push');
  });

  it('is the same with the same rand', () => {
    const { state, foe } = duel();
    foe.z = -6;
    const a = vaderMind({ ...state }, foe, seeded(7));
    const b = vaderMind({ ...state }, foe, seeded(7));
    expect(a).toEqual(b);
  });
});

describe('a duel with Vader', () => {
  // the hooks lint takes any use… call inside a named helper for a React hook
  const cast = useForce;

  // The player at 2 m strikes `kind` whenever free and Vader answers by
  // his mind, for 30 s. `blowFirst`: the caller resolves the player’s blow
  // straight after the player’s step; otherwise after Vader’s mind and
  // step. Returns what the player’s blows did to Vader.
  function fight(kind, blowFirst, seed) {
    const rand = seeded(seed);
    const vader = createFighter({ id: 'vader', x: 0, z: 0, yaw: 0, side: 'empire', hp: 1e6 });
    const luke = createFighter({ id: 'luke', x: 0, z: -2, yaw: Math.PI, side: 'rebel', hp: 1e6 });
    const state = { me: vader, force: createForce('vader'), last: null };
    const tally = {};
    for (let i = 0; i < 30 * 30; i++) {
      const blows = saberStep(luke, { strike: kind, guard: false, dodge: false }, STEP).filter((e) => e.type === 'blow');
      const land = () => {
        for (let n = 0; n < blows.length; n++) {
          const { result } = resolveClash(luke, vader);
          tally[result] = (tally[result] ?? 0) + 1;
        }
      };
      if (blowFirst) land();
      forceStep(state.force, vader, [luke], STEP);
      const input = vaderMind(state, luke, rand);
      if (input.force) cast(state.force, input.force, vader, [luke]);
      const own = saberStep(vader, input, STEP);
      if (!blowFirst) land();
      if (own.some((e) => e.type === 'blow')) resolveClash(vader, luke);
    }
    return tally;
  }

  for (const kind of ['light', 'heavy']) {
    for (const blowFirst of [true, false]) {
      it(`neither always parries nor is always hit by ${kind} strokes, with the blow resolved ${blowFirst ? 'before' : 'after'} his turn`, () => {
        const tally = fight(kind, blowFirst, 11);
        const landed = Object.values(tally).reduce((n, k) => n + k, 0);
        expect(landed).toBeGreaterThan(10);
        // he times some guards right, and some strokes still beat him: a
        // light by catching him late, a heavy by that or by cracking a guard held too long
        expect(tally.parry ?? 0).toBeGreaterThan(0);
        expect(tally.parry).toBeLessThan(landed);
        expect((tally.hit ?? 0) + (kind === 'heavy' ? (tally.break ?? 0) : 0)).toBeGreaterThan(0);
        expect(tally.hit ?? 0).toBeLessThan(landed);
      });
    }
  }
});

describe('the Emperor’s mind', () => {
  const throne = () => ({ me: caster('emperor'), force: createForce('emperor'), now: 10, saidAt: -Infinity, last: null });

  it('throws lightning at a foe in range when it is ready', () => {
    expect(emperorMind(throne(), at('luke', 6), seeded(1))).toMatchObject({ force: 'lightning' });
  });

  it('taunts while his lightning cools, then keeps quiet a while', () => {
    const state = throne();
    state.force.cool.lightning = 3;
    const first = emperorMind(state, at('luke', 6), seeded(2));
    expect(TAUNTS).toContain(first.say);
    expect(first.force).toBe(null);
    state.now += 1;
    expect(emperorMind(state, at('luke', 6), seeded(3)).say).toBe(null);
  });

  it('taunts in plain British English with curly quotes', () => {
    for (const line of TAUNTS) {
      expect(line).not.toMatch(/['"]/);
      expect(line).not.toMatch(/!!/);
    }
  });

  it('only taunts a foe beyond his lightning’s reach', () => {
    const state = throne();
    const out = emperorMind(state, at('luke', POWERS.lightning.range + 3), seeded(4));
    expect(out.force).toBe(null);
    expect(TAUNTS).toContain(out.say);
  });
});

