import { describe, expect, it } from 'vitest';
import { CRUMBS, DUEL, MORGUL, PHIAL, STAIRS, brush, crumbling, crumbsLeft, dodge, moveHand, newClimb, newCrumbs, newDuel, newMorgul, newPhial, onLedge, recoils, stab, stepClimb, stepCrumbs, stepDuel, stepMorgul, stepPhial } from './rules';

const run = (n, fn) => {
  for (let i = 0; i < n; i++) if (fn(i) === false) break;
};

describe('Minas Morgul', () => {
  it('is got through by keeping your eyes off the city', () => {
    for (const seed of [1, 4, 9]) {
      const m = newMorgul(seed);
      run(2000, () => {
        stepMorgul(m, 0.05, Math.abs(m.gaze) < 0.8 ? Math.sign(m.gaze || 1) : 0);
        return m.state === 'on';
      });
      expect(m.state).toBe('passed');
    }
  });
  it('has you up and walking to it if you don’t look away', () => {
    const m = newMorgul(2);
    run(2000, () => {
      stepMorgul(m, 0.05, 0);
      return m.state === 'on';
    });
    expect(m.state).toBe('stood');
    expect(m.t).toBeLessThan(MORGUL.length);
  });
  it('says when the Witch-king stops to feel for you', () => {
    const m = newMorgul(2);
    const ev = [];
    run(400, () => void ev.push(...stepMorgul(m, 0.05, Math.sign(m.gaze || 1)).map((e) => e.type)));
    expect(ev).toContain('pause');
    expect(ev).toContain('on');
  });
});

describe('the stairs', () => {
  it('get climbed by resting on the ledges, and never on the crumbling bits', () => {
    const c = newClimb();
    run(10000, () => {
      // climb on; rest only on a ledge, and only when tired
      const tired = c.stamina < 0.35 || (onLedge(c.s) && c.stamina < 0.8 && !crumbling(c.s));
      stepClimb(c, 0.05, !(tired && onLedge(c.s)) && !c.spent);
      return c.state === 'on';
    });
    expect(c.state).toBe('top');
  });
  it('slide you back if you stop where it crumbles', () => {
    const c = newClimb();
    c.s = STAIRS.crumble[0][0] + 1;
    const ev = [];
    run(40, () => void ev.push(...stepClimb(c, 0.05, false).map((e) => e.type)));
    expect(ev).toContain('slip');
    expect(c.s).toBe(STAIRS.ledges[1]);
  });
  it('wear you out if you never stop', () => {
    const c = newClimb();
    const ev = [];
    run(10000, () => {
      ev.push(...stepClimb(c, 0.05, true).map((e) => e.type));
      return c.state === 'on';
    });
    expect(ev).toContain('spent');
  });
});

describe('the phial', () => {
  it('shines while you hold it up, fades, and comes back', () => {
    const p = newPhial();
    expect(stepPhial(p, 0.05, true).map((e) => e.type)).toContain('lit');
    expect(recoils(p, PHIAL.reach - 1)).toBe(true);
    expect(recoils(p, PHIAL.reach + 1)).toBe(false);
    const ev = [];
    run(400, () => void ev.push(...stepPhial(p, 0.05, true).map((e) => e.type)));
    expect(ev).toContain('dim');
    expect(p.on).toBe(false);
    run(200, () => void stepPhial(p, 0.05, false));
    stepPhial(p, 0.05, true);
    expect(p.on).toBe(true);
  });
});

describe('Samwise the Brave', () => {
  const fight = (policy) => {
    const d = newDuel(3);
    run(4000, () => {
      for (const e of stepDuel(d, 0.05)) policy(d, e);
      return d.state === 'on';
    });
    return d;
  };
  it('drives her off if you dodge her strikes and stab when she rears', () => {
    const d = fight((d0, e) => {
      if (e.type === 'tell') dodge(d0);
      if (e.type === 'rear') stab(d0);
    });
    expect(d.state).toBe('fled');
    expect(d.wounds).toBe(DUEL.wounds);
  });
  it('beats you if you just stand there', () => {
    expect(fight(() => {}).state).toBe('down');
  });
  it('punishes flailing', () => {
    const d = newDuel(3);
    expect(stab(d)).toBe('miss');
    expect(stab(d)).toBe(null);
    expect(dodge(d)).toBe(null);
  });
});

describe('crumbs on Sam’s cloak', () => {
  it('scatters the crumbs over the cloak, apart and inside its edge', () => {
    for (let seed = 1; seed < 20; seed++) {
      const c = newCrumbs(seed);
      expect(c.crumbs).toHaveLength(CRUMBS.n);
      for (const cr of c.crumbs) {
        expect(Math.abs(cr.u)).toBeLessThanOrEqual(CRUMBS.w / 2 - CRUMBS.edge);
        expect(Math.abs(cr.v)).toBeLessThanOrEqual(CRUMBS.d / 2 - CRUMBS.edge);
        for (const o of c.crumbs) if (o !== cr) expect(Math.hypot(o.u - cr.u, o.v - cr.v)).toBeGreaterThan(CRUMBS.reach);
      }
    }
  });
  it('brushes off a crumb under your hand, one at a time, and is clean when they’re all gone', () => {
    const c = newCrumbs(3);
    c.crumbs.forEach((cr, i) => {
      expect(brush(c, cr.u + 0.02, cr.v - 0.02)).toBe(1);
      expect(c.left).toBe(CRUMBS.n - i - 1);
    });
    expect(c.state).toBe('clean');
    expect(brush(c)).toBeNull();
    expect(stepCrumbs(c, 1)).toEqual([]);
  });
  it('rustles at nothing, and that brings Frodo’s waking nearer', () => {
    const c = newCrumbs(3);
    const far = { u: CRUMBS.w / 2, v: CRUMBS.d / 2 };
    while (c.crumbs.some((cr) => Math.hypot(cr.u - far.u, cr.v - far.v) < CRUMBS.reach)) far.u -= 0.01;
    const before = crumbsLeft(c);
    expect(brush(c, far.u, far.v)).toBe(0);
    expect(crumbsLeft(c)).toBeCloseTo(before - CRUMBS.miss);
    expect(c.misses).toBe(1);
  });
  it('lets Frodo stir as a warning, then wake, crumbs or no', () => {
    const c = newCrumbs(5);
    const ev = [];
    for (let i = 0; i < 2000 && c.state === 'on'; i++) ev.push(...stepCrumbs(c, 0.05));
    expect(ev.map((e) => e.type)).toEqual([...CRUMBS.stirs.map(() => 'stir'), 'woke']);
    expect(c.state).toBe('woke');
    expect(c.t).toBeCloseTo(CRUMBS.time, 1);
  });
  it('keeps your hand on the cloak', () => {
    const c = newCrumbs(5);
    moveHand(c, 1, -1, 30);
    expect(c.hand).toEqual({ u: CRUMBS.w / 2, v: -CRUMBS.d / 2 });
    moveHand(c, -0.5, 0, 0.5);
    expect(c.hand.u).toBeCloseTo(CRUMBS.w / 2 - CRUMBS.hand * 0.25);
  });
});
