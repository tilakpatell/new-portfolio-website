import { describe, expect, it } from 'vitest';
import { GAITS, HABITS, TALK, createManner, createMotion, habitAt, moveFor, seedOf } from './motion';
import { GESTURES } from './people';

describe('a pace as locomotion’s move', () => {
  it('is all walk up to a walk, going over into the run, and all run by a run', () => {
    expect(moveFor(0)).toBe(0);
    expect(moveFor(GAITS.walk)).toBeCloseTo(0.3);
    expect(moveFor(GAITS.jog)).toBeCloseTo(0.55);
    expect(moveFor(GAITS.run)).toBeCloseTo(0.9);
    expect(moveFor(99)).toBe(1);
    expect(moveFor(NaN)).toBe(0);
    // (rising all the way)
    let last = -1;
    for (let s = 0; s < 6; s += 0.1) {
      expect(moveFor(s)).toBeGreaterThanOrEqual(last);
      last = moveFor(s);
    }
  });
});

describe('how a placed figure is moving', () => {
  const run = (path, dt = 1 / 60) => {
    const m = createMotion({ ease: 0.05 });
    let out;
    for (const [x, z, yaw] of path) out = { ...m.step(x, z, yaw, dt) };
    return out;
  };

  it('reads a walk ahead as speed along its facing', () => {
    // facing +z (yaw 0), 1.2 m/s for a second
    const path = Array.from({ length: 61 }, (_, i) => [0, (i * 1.2) / 60, 0]);
    const m = run(path);
    expect(m.speed).toBeCloseTo(1.2, 2);
    expect(Math.abs(m.side)).toBeLessThan(1e-6);
    expect(m.move).toBeCloseTo(0.3, 2);
  });

  it('reads a step to the side as side, and backward as negative speed', () => {
    // facing +z, going toward −x: its right (a figure facing +z has +x on its left)
    const right = run(Array.from({ length: 61 }, (_, i) => [(-i * 1) / 60, 0, 0]));
    expect(right.side).toBeCloseTo(1, 2);
    const back = run(Array.from({ length: 61 }, (_, i) => [0, (-i * 1) / 60, 0]));
    expect(back.speed).toBeCloseTo(-1, 2);
  });

  it('reads a turn on the spot as turn, + to the left', () => {
    const m = run(Array.from({ length: 61 }, (_, i) => [0, 0, (i * 0.5) / 60]));
    expect(m.turn).toBeCloseTo(0.5, 2);
    expect(Math.abs(m.speed)).toBeLessThan(1e-6);
  });

  it('takes a jump for someone put somewhere, not a step', () => {
    const m = createMotion({ ease: 0.05 });
    m.step(0, 0, 0, 1 / 60);
    for (let i = 1; i <= 30; i++) m.step(0, i / 60, 0, 1 / 60);
    const after = m.step(10, 10, 0, 1 / 60);
    expect(after.speed).toBe(0);
    expect(after.side).toBe(0);
  });

  it('eases a jolt rather than passing it to the feet', () => {
    const m = createMotion({ ease: 0.2 });
    m.step(0, 0, 0, 1 / 60);
    const first = m.step(0, 0.05, 0, 1 / 60); // 3 m/s for one frame
    expect(first.speed).toBeGreaterThan(0);
    expect(first.speed).toBeLessThan(0.5);
  });

  it('does nothing with no time', () => {
    const m = createMotion();
    m.step(0, 0, 0, 1 / 60);
    expect(m.step(0, 1, 0, 0).speed).toBe(0);
  });
});

describe('a person’s seed', () => {
  it('differs by name and by copy, and is the same each time', () => {
    expect(seedOf('kevin')).toBe(seedOf('kevin'));
    expect(seedOf('kevin')).not.toBe(seedOf('oscar'));
    expect(seedOf('kevin', 0)).not.toBe(seedOf('kevin', 1));
    expect(Number.isInteger(seedOf('jim'))).toBe(true);
  });
});

describe('talking with the hands', () => {
  it('uses only the gestures people.js has', () => {
    for (const [who, list] of Object.entries(TALK)) for (const g of list) expect(GESTURES, `${who}: ${g}`).toContain(g);
  });

  it('gestures soon after the talk starts, then every so often, and not at all when quiet', () => {
    const m = createManner('michael', 7);
    const got = [];
    for (let i = 0; i < 600; i++) {
      const g = m.step(1 / 60, true);
      if (g) got.push({ g, t: i / 60 });
    }
    expect(got.length).toBeGreaterThanOrEqual(3);
    expect(got[0].t).toBeLessThan(1.2);
    for (let i = 1; i < got.length; i++) expect(got[i].t - got[i - 1].t).toBeGreaterThan(1.4);
    // never the same twice running when there's a choice
    for (let i = 1; i < got.length; i++) expect(got[i].g).not.toBe(got[i - 1].g);
    const q = createManner('michael', 7);
    for (let i = 0; i < 600; i++) expect(q.step(1 / 60, false)).toBeNull();
  });

  it('keeps Stanley stiller than Kelly', () => {
    const count = (who) => {
      const m = createManner(who, 3);
      let n = 0;
      for (let i = 0; i < 60 * 30; i++) if (m.step(1 / 60, true)) n += 1;
      return n;
    };
    expect(count('stanley')).toBeLessThan(count('kelly'));
  });

  it('gives two people with different seeds different timings', () => {
    const first = (seed) => {
      const m = createManner('kevin', seed);
      for (let i = 0; i < 600; i++) if (m.step(1 / 60, true)) return i;
      return -1;
    };
    expect(first(1)).not.toBe(first(2));
  });
});

describe('habits at the desk', () => {
  it('names only habits it knows', () => {
    for (const [who, h] of Object.entries(HABITS)) if (h) expect(habitAt(h, 0, 1) !== undefined, who).toBe(true);
  });

  it('keeps Stanley at his crossword and Phyllis at her knitting all the time, the pen moving', () => {
    const a = habitAt('crossword', 1, 4);
    const b = habitAt('crossword', 1.3, 4);
    expect(a).toMatchObject({ hand: 'right', where: 'desk', amt: 1 });
    expect(a.wiggle).not.toBe(b.wiggle);
    expect(habitAt('knit', 5, 2)).toMatchObject({ hand: 'both', where: 'lap', amt: 1 });
  });

  it('puts Michael’s phone to his ear now and then, eased there and back', () => {
    let on = 0;
    let max = 0;
    let jumps = 0;
    let last = 0;
    for (let i = 0; i < 60 * 120; i++) {
      const h = habitAt('phone', i / 60, 11);
      const amt = h?.amt ?? 0;
      if (h) {
        on += 1;
        expect(h).toMatchObject({ hand: 'left', where: 'ear' });
      }
      max = Math.max(max, amt);
      if (Math.abs(amt - last) > 0.1) jumps += 1;
      last = amt;
    }
    expect(max).toBe(1);
    expect(on / (60 * 120)).toBeGreaterThan(0.1);
    expect(on / (60 * 120)).toBeLessThan(0.6);
    expect(jumps).toBe(0);
  });

  it('is nothing for no habit', () => {
    expect(habitAt(null, 3)).toBeNull();
    expect(habitAt('juggling', 3)).toBeNull();
    expect(habitAt('mug', NaN)).toBeNull();
  });
});
