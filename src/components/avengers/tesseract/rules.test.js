import { describe, expect, it } from 'vitest';
import { CABLE, CASE, JET, LEGS, PADS, STEP, groundAt, newGame, setInput, startLeg, stepGame } from './rules';
import { pilot } from './pilot';

// fly for up to `secs`, with a pilot or none; every event that happened
const fly = (g, secs, brain) => {
  const ev = [];
  for (let t = 0; t < secs && g.phase === 'fly'; t += STEP) {
    if (brain) setInput(g, brain(g));
    ev.push(...stepGame(g, STEP));
  }
  return ev;
};
const started = (leg = 0, seed = 1) => {
  const g = newGame({ seed, leg });
  startLeg(g, leg);
  return g;
};

describe('Tesseract Run: flying', () => {
  it('crashes a Quinjet nobody flies', () => {
    const g = started(0);
    const ev = fly(g, 20);
    expect(ev.some((e) => e.type === 'controls' && e.idle)).toBe(true); // F.R.I.D.A.Y. let go
    expect(g.phase).toBe('crashed');
    expect(ev.find((e) => e.type === 'crash')).toMatchObject({ what: 'jet' });
  });

  it('lands leg 1 with a PD controller, softly, the same way every time', () => {
    const runs = [1, 2].map(() => {
      const g = started(0, 7);
      const ev = fly(g, 60, (q) => pilot(q));
      return { g, done: ev.find((e) => e.type === 'delivered') };
    });
    const { g, done } = runs[0];
    expect(g.phase).toBe('delivered');
    expect(done.touch).toBeLessThan(CASE.soft);
    expect(Math.abs(g.case.x - PADS[1].x)).toBeLessThan(PADS[1].half - CASE.w / 2);
    expect(done.fuel).toBeGreaterThan(0);
    expect(done.score).toBeGreaterThan(2000);
    expect(runs[1].done).toEqual(done);
  });

  for (const [i, leg] of LEGS.entries()) {
    it(`can be flown by a careful pilot: leg ${i + 1}, ${leg.title}`, () => {
      const g = started(i, 3);
      fly(g, 120, (q) => pilot(q));
      expect(g.phase).toBe('delivered');
      expect(g.result.fuel).toBeGreaterThan(leg.fuel * 0.2);
    });
  }
});

describe('Tesseract Run: crashing and starting again', () => {
  it('breaks the case dropped too hard, and restarts the leg fresh', () => {
    const g = started(1);
    fly(g, 6, (q) => pilot(q)); // up and away
    // coming down far too fast, the case three metres up on a taut cable
    const x = g.case.x;
    Object.assign(g.case, { y: groundAt(x) + 3, vx: 0, vy: -6 });
    Object.assign(g.jet, { x, y: groundAt(x) + 3 + CASE.h + CASE.sling + CABLE + JET.hook, vx: 0, vy: -6, angle: 0 });
    const ev = fly(g, 3, () => ({ thrust: 0 }));
    expect(g.phase).toBe('crashed');
    expect(ev.find((e) => e.type === 'crash')).toMatchObject({ what: 'case', into: 'ground' });

    startLeg(g, g.leg);
    expect(g.phase).toBe('fly');
    expect(g.leg).toBe(1);
    expect(g.fuel).toBe(LEGS[1].fuel);
    expect(g.t).toBe(0);
    expect(g.crash).toBeNull();
    expect(g.case).toMatchObject({ x: PADS[1].x, vx: 0, vy: 0, grounded: true });
    expect(g.jet.x).toBe(PADS[1].x);
  });

  it('gives the Space Stone for the sixth leg, and only the sixth', () => {
    const land = (leg) => {
      const g = started(leg);
      setInput(g, { thrust: 0.4 }); // take the controls
      // the case set down on the pad, the jet hovering clear of it
      const pad = PADS[LEGS[leg].to];
      Object.assign(g.case, { x: pad.x, y: groundAt(pad.x), vx: 0, vy: 0, grounded: true, touch: 0.5 });
      Object.assign(g.jet, { x: pad.x, y: groundAt(pad.x) + 13, vx: 0, vy: 0 });
      return fly(g, 3, () => ({ thrust: 0.4 }));
    };
    const fifth = land(4);
    expect(fifth.some((e) => e.type === 'delivered')).toBe(true);
    expect(fifth.some((e) => e.type === 'won')).toBe(false);
    const sixth = land(5);
    expect(sixth.some((e) => e.type === 'delivered')).toBe(true);
    expect(sixth.some((e) => e.type === 'won')).toBe(true);
  });

  it('starts the next leg fresh after a delivery', () => {
    const g = started(0, 5);
    fly(g, 60, (q) => pilot(q));
    expect(g.phase).toBe('delivered');
    startLeg(g, 1);
    expect(g).toMatchObject({ phase: 'fly', leg: 1, t: 0, fuel: LEGS[1].fuel, result: null, won: false, gust: null });
    expect(g.case.settle).toBe(0);
    expect(g.case.x).toBe(PADS[1].x);
  });
});
