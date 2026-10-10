import { describe, expect, it } from 'vitest';
import { createFighter, facing, GUARD, PARRY, REGEN, REGUARD, resolveClash, saberStep, STROKES } from './saber';

const STEP = 1 / 30;
const IDLE = { strike: null, guard: false, dodge: false };

// Steps a fighter for `s` seconds holding one input, gathering the events.
function hold(f, input, s) {
  const events = [];
  for (let t = 0; t < s - 1e-9; t += STEP) events.push(...saberStep(f, { ...IDLE, ...input }, STEP));
  return events;
}

// Two fighters 1.5 m apart, face to face: `a` at the origin looking north
// (−z), `b` to its north looking south (+z).
function pair() {
  const a = createFighter({ id: 'a', x: 0, z: 0, yaw: 0, side: 'rebel' });
  const b = createFighter({ id: 'b', x: 0, z: -1.5, yaw: Math.PI, side: 'empire' });
  return { a, b };
}

// Starts `a` on a stroke and runs it to its blow, so resolveClash meets it there.
function toBlow(a, kind) {
  saberStep(a, { ...IDLE, strike: kind }, STEP);
  while (a.stroke && !a.stroke.hit) saberStep(a, IDLE, STEP);
}

describe('a fighter', () => {
  it('starts whole, rested and with its blade down', () => {
    const f = createFighter({ id: 'luke', x: 1, z: 2, yaw: 0.5, side: 'rebel' });
    expect(f).toMatchObject({ id: 'luke', x: 1, z: 2, yaw: 0.5, hp: 100, stamina: 100, guard: false, stroke: null, stagger: 0, side: 'rebel' });
  });

  it('faces −z at yaw 0 and +x at a quarter turn', () => {
    const f = createFighter({ id: 'f', x: 0, z: 0, yaw: 0 });
    expect(facing(f, { x: 0, z: -3 }, 10)).toBe(true);
    expect(facing(f, { x: 0, z: 3 }, 10)).toBe(false);
    f.yaw = Math.PI / 2;
    expect(facing(f, { x: 3, z: 0 }, 10)).toBe(true);
  });
});

describe('strokes', () => {
  it('a light stroke lands its blow on the step that crosses 0.18 s and is over by 0.4 s', () => {
    const f = createFighter({ id: 'f', x: 0, z: 0, yaw: 0 });
    const first = saberStep(f, { ...IDLE, strike: 'light' }, STEP);
    expect(first).toContainEqual({ type: 'stroke', id: 'f', kind: 'light' });
    const before = hold(f, {}, 4 * STEP);
    expect(before.some((e) => e.type === 'blow')).toBe(false);
    expect(saberStep(f, IDLE, STEP)).toContainEqual({ type: 'blow', id: 'f', kind: 'light' });
    hold(f, {}, 0.2 + STEP);
    expect(f.stroke).toBe(null);
  });

  it('a stroke costs stamina, and can’t start without enough of it', () => {
    const f = createFighter({ id: 'f', x: 0, z: 0, yaw: 0 });
    saberStep(f, { ...IDLE, strike: 'heavy' }, STEP);
    expect(f.stamina).toBeCloseTo(100 - STROKES.heavy.cost);
    const g = createFighter({ id: 'g', x: 0, z: 0, yaw: 0 });
    g.stamina = STROKES.heavy.cost - 1;
    expect(saberStep(g, { ...IDLE, strike: 'heavy' }, STEP)).toEqual([]);
    expect(g.stroke).toBe(null);
  });

  it('a fighter mid-stroke can’t start another or raise its guard', () => {
    const f = createFighter({ id: 'f', x: 0, z: 0, yaw: 0 });
    saberStep(f, { ...IDLE, strike: 'light' }, STEP);
    saberStep(f, { ...IDLE, strike: 'heavy', guard: true }, STEP);
    expect(f.stroke.kind).toBe('light');
    expect(f.guard).toBe(false);
  });

  it('a staggered fighter can neither strike nor guard until the stagger passes', () => {
    const f = createFighter({ id: 'f', x: 0, z: 0, yaw: 0 });
    f.stagger = 0.5;
    hold(f, { strike: 'light', guard: true }, 0.4);
    expect(f.stroke).toBe(null);
    expect(f.guard).toBe(false);
    hold(f, { guard: true }, 0.2);
    expect(f.guard).toBe(true);
  });
});

describe('a fighter knocked off balance', () => {
  it('loses the stroke it was in, so it lands no blow while it reels', () => {
    const f = createFighter({ id: 'f', x: 0, z: 0, yaw: 0 });
    saberStep(f, { ...IDLE, strike: 'heavy' }, STEP);
    f.stagger = 0.3;
    const events = hold(f, {}, STROKES.heavy.s);
    expect(events.some((e) => e.type === 'blow')).toBe(false);
    expect(f.stroke).toBe(null);
  });
});

describe('stamina', () => {
  it('comes back 20 a second at rest, 8 behind a guard, none mid-stroke, and never past 100', () => {
    const f = createFighter({ id: 'f', x: 0, z: 0, yaw: 0 });
    f.stamina = 40;
    hold(f, {}, 1);
    expect(f.stamina).toBeCloseTo(40 + REGEN.rest, 1);
    expect(REGEN.rest).toBe(20);
    f.stamina = 40;
    hold(f, { guard: true }, 1);
    expect(f.stamina).toBeCloseTo(40 + REGEN.guard, 1);
    expect(REGEN.guard).toBe(8);
    f.guard = false;
    f.stamina = 40;
    saberStep(f, { ...IDLE, strike: 'light' }, STEP);
    hold(f, {}, 0.3);
    expect(f.stamina).toBeCloseTo(40 - STROKES.light.cost, 5);
    hold(f, {}, 10);
    expect(f.stamina).toBe(100);
  });

  it('a dodge costs 20 and makes a blow miss while it lasts', () => {
    const { a, b } = pair();
    saberStep(b, { ...IDLE, dodge: true }, STEP);
    expect(b.stamina).toBeCloseTo(80);
    toBlow(a, 'light');
    expect(resolveClash(a, b).result).toBe('dodged');
    expect(b.hp).toBe(100);
  });
});

describe('a stroke meeting a guard', () => {
  it('is parried inside the 0.18 s window at the start of a guard: the striker staggers and its stroke ends', () => {
    expect(PARRY).toBe(0.18);
    const { a, b } = pair();
    toBlow(a, 'light');
    saberStep(b, { ...IDLE, guard: true }, STEP);
    hold(b, { guard: true }, 0.1);
    expect(b.guardT).toBeLessThan(PARRY);
    const out = resolveClash(a, b);
    expect(out.result).toBe('parry');
    expect(a.stroke).toBe(null);
    expect(a.stagger).toBeGreaterThan(0.5);
    expect(b.hp).toBe(100);
    expect(b.stamina).toBe(100);
  });

  it('parries a heavy stroke too', () => {
    const { a, b } = pair();
    toBlow(a, 'heavy');
    saberStep(b, { ...IDLE, guard: true }, STEP);
    expect(resolveClash(a, b).result).toBe('parry');
    expect(b.guard).toBe(true);
  });

  it('is blocked once the window has passed: a light stroke costs the guard 8 stamina and no health', () => {
    const { a, b } = pair();
    saberStep(b, { ...IDLE, guard: true }, STEP);
    hold(b, { guard: true }, PARRY + STEP);
    toBlow(a, 'light');
    const out = resolveClash(a, b);
    expect(out.result).toBe('block');
    expect(b.hp).toBe(100);
    expect(b.stamina).toBeCloseTo(100 - GUARD.block, 0);
    expect(b.guard).toBe(true);
    expect(a.stagger).toBe(0);
  });

  it('a heavy stroke breaks a held guard: the guard drops, staggers and loses 25 stamina', () => {
    const { a, b } = pair();
    b.guard = true;
    b.guardT = 1;
    toBlow(a, 'heavy');
    const out = resolveClash(a, b);
    expect(out.result).toBe('break');
    expect(b.guard).toBe(false);
    expect(b.stagger).toBeGreaterThan(0);
    expect(b.stamina).toBe(100 - GUARD.break);
    expect(GUARD.break).toBe(25);
    expect(b.hp).toBe(100);
  });

  it('a block that empties the guard’s stamina breaks it', () => {
    const { a, b } = pair();
    b.guard = true;
    b.guardT = 1;
    b.stamina = 5;
    toBlow(a, 'light');
    expect(resolveClash(a, b).result).toBe('break');
    expect(b.guard).toBe(false);
    expect(b.stamina).toBe(0);
  });

  it('can’t be farmed by tapping: a guard raised again within 0.3 s of coming down opens no new parry window', () => {
    expect(REGUARD).toBe(0.3);
    const { a, b } = pair();
    a.hp = b.hp = 1e6;
    const tally = {};
    for (let i = 0; i < 10 * 30; i++) {
      const blows = saberStep(a, { ...IDLE, strike: 'light' }, STEP).filter((e) => e.type === 'blow');
      // up four steps, down one: a fresh raise every 0.17 s, inside the window each time if it reopened
      saberStep(b, { ...IDLE, guard: i % 5 !== 4 }, STEP);
      for (let n = 0; n < blows.length; n++) {
        const { result } = resolveClash(a, b);
        tally[result] = (tally[result] ?? 0) + 1;
      }
    }
    expect(tally.parry ?? 0).toBeLessThanOrEqual(1);
    expect((tally.block ?? 0) + (tally.break ?? 0)).toBeGreaterThan(3);
  });

  it('opens the window again for a guard raised once it has been down 0.3 s', () => {
    const { a, b } = pair();
    hold(b, { guard: true }, 1);
    hold(b, {}, 0.2);
    saberStep(b, { ...IDLE, guard: true }, STEP);
    expect(b.guardT).toBeGreaterThanOrEqual(PARRY);
    toBlow(a, 'light');
    expect(resolveClash(a, b).result).toBe('block');
    const c = pair();
    hold(c.b, { guard: true }, 1);
    hold(c.b, {}, REGUARD + STEP);
    saberStep(c.b, { ...IDLE, guard: true }, STEP);
    toBlow(c.a, 'light');
    expect(resolveClash(c.a, c.b).result).toBe('parry');
  });

  it('a guard turned away from the stroke doesn’t count: the blow hits', () => {
    const { a, b } = pair();
    b.yaw = 0;
    b.guard = true;
    b.guardT = 0;
    toBlow(a, 'light');
    expect(resolveClash(a, b)).toMatchObject({ result: 'hit', damage: STROKES.light.damage });
    expect(b.hp).toBe(100 - STROKES.light.damage);
  });
});

describe('a stroke meeting nothing but a body', () => {
  it('hits for 18 light and 40 heavy, interrupting the target’s own stroke', () => {
    const { a, b } = pair();
    saberStep(b, { ...IDLE, strike: 'heavy' }, STEP);
    toBlow(a, 'light');
    expect(resolveClash(a, b)).toMatchObject({ result: 'hit', damage: 18, dead: false });
    expect(b.stroke).toBe(null);
    expect(b.stagger).toBeGreaterThan(0);
    const c = pair();
    toBlow(c.a, 'heavy');
    expect(resolveClash(c.a, c.b).damage).toBe(40);
  });

  it('kills at zero health and never goes below it', () => {
    const { a, b } = pair();
    b.hp = 10;
    toBlow(a, 'heavy');
    expect(resolveClash(a, b)).toMatchObject({ result: 'hit', dead: true });
    expect(b.hp).toBe(0);
  });

  it('misses a target out of reach or outside the stroke’s arc', () => {
    const far = pair();
    far.b.z = -(STROKES.light.reach + 0.1);
    toBlow(far.a, 'light');
    expect(resolveClash(far.a, far.b).result).toBe('miss');
    const behind = pair();
    behind.b.z = 1.5;
    toBlow(behind.a, 'light');
    expect(resolveClash(behind.a, behind.b).result).toBe('miss');
    expect(behind.b.hp).toBe(100);
  });

  it('meets nothing when the striker isn’t at a blow', () => {
    const { a, b } = pair();
    expect(resolveClash(a, b).result).toBe('none');
  });

  it('is resolved once against each fighter: asked again later in the same stroke, it meets nothing', () => {
    const { a, b } = pair();
    toBlow(a, 'light');
    expect(resolveClash(a, b).result).toBe('hit');
    saberStep(a, IDLE, STEP);
    expect(a.stroke?.hit).toBe(true);
    expect(resolveClash(a, b)).toEqual({ result: 'none', damage: 0, dead: false });
    expect(b.hp).toBe(100 - STROKES.light.damage);
    // the same sweep still catches someone standing beside the first
    const c = createFighter({ id: 'c', x: 0.5, z: -1.5, yaw: Math.PI, side: 'empire' });
    expect(resolveClash(a, c).result).toBe('hit');
    expect(resolveClash(a, c).result).toBe('none');
  });

  it('spends a blocked blow too, so the guard pays for it once', () => {
    const { a, b } = pair();
    b.guard = true;
    b.guardT = 1;
    toBlow(a, 'light');
    expect(resolveClash(a, b).result).toBe('block');
    expect(resolveClash(a, b).result).toBe('none');
    expect(b.stamina).toBe(100 - GUARD.block);
  });
});

describe('deflecting bolts', () => {
  it('a guard sets deflect with the fighter’s yaw, and lowering it turns deflect off', () => {
    const f = createFighter({ id: 'f', x: 0, z: 0, yaw: 0.7 });
    saberStep(f, { ...IDLE, guard: true }, STEP);
    expect(f.deflect).toEqual({ yaw: 0.7, active: true });
    saberStep(f, IDLE, STEP);
    expect(f.deflect).toEqual({ yaw: 0.7, active: false });
  });
});
