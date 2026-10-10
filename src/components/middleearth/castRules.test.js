import { describe, expect, it } from 'vitest';
import { CAST, castFor, createGreeter, manner, motionFrom, moveFor, pick, stepFollower, tintFor } from './castRules';
import * as talk from '../../lib/ai/talk';
import { LOOKS } from './shire/people';

describe('who plays whom', () => {
  it('the story’s people play themselves', () => {
    for (const n of ['frodo', 'sam', 'gandalf', 'aragorn', 'legolas', 'gimli', 'saruman', 'butterbur', 'galadriel']) expect(castFor(n)).toBe(n);
  });
  it('the towns’ own names go to whoever plays them', () => {
    expect(castFor('strider')).toBe('aragorn');
    expect(castFor('gaffer')).toBe('hobbit');
    expect(castFor('lobelia')).toBe('rosie');
    expect(castFor('harry')).toBe('breeman');
    expect(castFor('haldir')).toBe('elf');
    expect(castFor('hama')).toBe('rohirrim');
    expect(castFor('beregond')).toBe('gondorguard');
    expect(castFor('folk3')).toBe('breeman');
    expect(castFor('galadriel-mirror')).toBe('galadriel');
    expect(castFor('strider-dawn')).toBe('aragorn');
    expect(castFor('gimli-bare')).toBe('gimli');
  });
  it('no one plays Gollum or Treebeard', () => {
    expect(castFor('gollum')).toBeNull();
    expect(castFor('treebeard')).toBeNull();
    expect(castFor(null)).toBeNull();
  });
  it('anyone else is the town’s townsfolk, or a hobbit when hobbit-sized', () => {
    expect(castFor('someone', { tall: 1.5 }, { town: 'edoras' })).toBe('rohirrim');
    expect(castFor('someone', { tall: 1.5 }, { town: 'minastirith' })).toBe('gondorguard');
    expect(castFor('someone', { tall: 1.5 }, { town: 'lorien' })).toBe('elf');
    expect(castFor('someone', { tall: 1 }, { town: 'edoras' })).toBe('hobbit');
    expect(castFor('someone', { tall: 0.95, wide: 1.35 })).toBe('gimli');
    expect(castFor('someone', { tall: 1.5 })).toBe('breeman');
  });
  it('every name it gives is one of the twenty-nine', () => {
    for (const id of [...Object.keys(LOOKS), 'strider', 'harry', 'haldir', 'hama', 'beregond', 'guest', 'folk0', 'x']) {
      const n = castFor(id, LOOKS[id] ?? { tall: 1.4 });
      expect(CAST).toContain(n);
    }
    expect(CAST).toHaveLength(29);
  });
});

describe('a crowd’s colours', () => {
  it('tints an archetype toward its coat, lightly, and leaves the named alone', () => {
    const c = tintFor('hobbit', { coat: 0x000000 });
    expect(c).not.toBeNull();
    expect((c >> 16) & 255).toBeGreaterThan(170); // still mostly white
    expect(tintFor('frodo', { coat: 0x7a4a2a })).toBeNull();
    expect(tintFor('hobbit', {})).toBeNull();
    expect(tintFor('rosie', LOOKS.rosie)).toBeNull(); // Rosie as herself
    expect(tintFor('rosie', LOOKS.lobelia)).not.toBeNull(); // Lobelia in her plum
  });
});

describe('walking or running, by the ground covered', () => {
  const W = 1;
  const R = 3;
  it('stands still standing, and walks at its walk’s pace', () => {
    expect(moveFor(0, W, R)).toBe(0);
    const walking = moveFor(W, W, R);
    expect(walking).toBeGreaterThanOrEqual(0.3);
    expect(walking).toBeLessThanOrEqual(0.55);
  });
  it('runs at its run’s pace and beyond', () => {
    expect(moveFor(R, W, R)).toBe(1);
    expect(moveFor(R * 3, W, R)).toBe(1);
  });
  it('never goes back as it speeds up (no pop between the walk and the run)', () => {
    let last = 0;
    for (let v = 0; v <= R * 1.2; v += 0.01) {
      const m = moveFor(v, W, R);
      expect(m).toBeGreaterThanOrEqual(last - 1e-9);
      expect(m - last).toBeLessThan(0.05);
      last = m;
    }
  });
  it('reads backwards as forwards (the walk backward is locomotion’s)', () => {
    expect(moveFor(-W, W, R)).toBeCloseTo(moveFor(W, W, R));
  });
});

describe('motion from two placings', () => {
  it('ahead, to the right, and turning left, in the toys’ frame', () => {
    // facing +x, a metre along +x in a second: ahead
    expect(motionFrom({ x: 0, z: 0, yaw: 0 }, { x: 1, z: 0, yaw: 0 }, 1).speed).toBeCloseTo(1);
    // facing +x, its right is +z
    const m = motionFrom({ x: 0, z: 0, yaw: 0 }, { x: 0, z: 1, yaw: 0 }, 1);
    expect(m.side).toBeCloseTo(1);
    expect(m.speed).toBeCloseTo(0);
    // facing −z (yaw π/2, a left turn from +x): going −z is ahead
    expect(motionFrom({ x: 0, z: 0, yaw: Math.PI / 2 }, { x: 0, z: -2, yaw: Math.PI / 2 }, 1).speed).toBeCloseTo(2);
    expect(motionFrom({ x: 0, z: 0, yaw: 0 }, { x: 0, z: 0, yaw: 0.5 }, 0.5).turn).toBeCloseTo(1);
  });
  it('the short way round, and a jump to somewhere new is standing still', () => {
    expect(motionFrom({ x: 0, z: 0, yaw: Math.PI - 0.1 }, { x: 0, z: 0, yaw: -Math.PI + 0.1 }, 1).turn).toBeCloseTo(0.2);
    const jump = motionFrom({ x: 0, z: 0, yaw: 0 }, { x: 40, z: 0, yaw: 0 }, 0.016, { teleport: 30 });
    expect(jump).toEqual({ speed: 0, side: 0, turn: 0 });
    expect(motionFrom(null, { x: 1, z: 1 }, 1)).toEqual({ speed: 0, side: 0, turn: 0 });
    expect(motionFrom({ x: 0, z: 0 }, { x: 1, z: 1 }, 0)).toEqual({ speed: 0, side: 0, turn: 0 });
  });
});

describe('the greeting, as the map has it', () => {
  it('once as you come near, again only after you’ve gone', () => {
    expect(createGreeter).toBe(talk.createGreeter); // (lib/ai/talk.js's, re-exported)
    const g = createGreeter({ near: 2.8, far: 4.5 });
    expect(g(10)).toBe(false);
    expect(g(2.5)).toBe(true);
    expect(g(2)).toBe(false);
    expect(g(3.5)).toBe(false); // not far enough to be gone
    expect(g(2.5)).toBe(false);
    expect(g(5)).toBe(false);
    expect(g(2.7)).toBe(true);
  });
});

describe('manners', () => {
  it('the elves bow, the hobbits wave, everyone talks with their hands', () => {
    expect(manner('legolas').greet.clip).toBe('bow');
    expect(manner('sam').greet).toEqual({ clip: 'wave', loop: true });
    for (const n of CAST) expect(manner(n).talk.length).toBeGreaterThan(0);
  });
  it('a pick is the figure’s own, the same each time', () => {
    expect(pick(['a', 'b', 'c'], 4)).toBe('b');
    expect(pick(['a', 'b', 'c'], -4)).toBe('b');
    expect(pick([], 1)).toBeNull();
  });
});

describe('followers off the conga line', () => {
  it('reaches its place at its own pace, without overshooting, and stops', () => {
    let f = { x: 0, z: 0, v: 0, face: 0 };
    const goal = { x: 5, z: 0, speed: 0 };
    let maxStep = 0;
    for (let i = 0; i < 400; i++) {
      const n = stepFollower(f, goal, [], 1 / 60);
      maxStep = Math.max(maxStep, Math.hypot(n.x - f.x, n.z - f.z));
      f = n;
      expect(f.x).toBeLessThanOrEqual(5 + 1e-9);
    }
    expect(f.x).toBeCloseTo(5, 1);
    expect(f.v).toBeLessThan(0.3);
    // eased: no first step at full speed
    expect(stepFollower({ x: 0, z: 0, v: 0 }, goal, [], 1 / 60).v).toBeLessThan(0.5);
  });
  it('keeps out of the others’ way', () => {
    const a = { x: 0, z: 0, v: 0 };
    const b = { x: 0.1, z: 0, v: 0 };
    let p = a;
    let q = b;
    for (let i = 0; i < 120; i++) {
      const np = stepFollower(p, { x: 0, z: 0 }, [q], 1 / 60);
      const nq = stepFollower(q, { x: 0.1, z: 0 }, [p], 1 / 60);
      p = np;
      q = nq;
    }
    expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThan(0.35);
  });
  it('turns toward where it’s going over time, not at once', () => {
    const n = stepFollower({ x: 0, z: 0, v: 3, face: 0 }, { x: 0, z: -5 }, [], 1 / 60);
    expect(n.face).toBeGreaterThan(0);
    expect(n.face).toBeLessThan(Math.PI / 4);
  });
});
