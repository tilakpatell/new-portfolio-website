import { describe, expect, it } from 'vitest';
import { bodyFrom } from '../../../lib/ai/body';
import { COP_BODY, REGARD, catchUp, copStep, createBeats, lookAhead, lookAt, moveFor, nearestN, regard, sayFor, scanLook, stepBody, yawOf } from './bodies';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

describe('a figure regarding someone', () => {
  it('turns only its head for someone within 70° of where it faces', () => {
    const st = {};
    let yaw = 0;
    for (let i = 0; i < 60; i++) yaw = regard(yaw, 1.0, 1 / 30, st);
    expect(yaw).toBe(0);
  });
  it('turns its body, by time, for someone further round, until they are near ahead', () => {
    const st = {};
    let yaw = 0;
    const want = 2.2;
    const first = regard(yaw, want, 1 / 30, st);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(0.5); // (eased, not snapped)
    yaw = first;
    for (let i = 0; i < 90; i++) yaw = regard(yaw, want, 1 / 30, st);
    expect(Math.abs(wrap(want - yaw))).toBeLessThan(REGARD.settle);
  });
  it('goes round on the spot no faster than its feet can stand', () => {
    const st = {};
    let yaw = 0;
    for (let i = 0; i < 60; i++) {
      const next = regard(yaw, Math.PI - 0.1, 1 / 60, st);
      expect(Math.abs(next - yaw)).toBeLessThanOrEqual(REGARD.max / 60 + 1e-9);
      yaw = next;
    }
  });
  it('turns the same way whatever the frame rate', () => {
    const run = (fps) => {
      const st = {};
      let yaw = 0;
      for (let i = 0; i < fps * 0.5; i++) yaw = regard(yaw, 2.4, 1 / fps, st);
      return yaw;
    };
    expect(run(30)).toBeCloseTo(run(144), 1);
  });
});

describe('a Cop Rick’s body from his watch', () => {
  const rick = { x: 4, z: 0 };
  it('walks his round looking about at a corner, his body ahead and his head to the side', () => {
    const w = { x: 0, z: 0, face: 0, mode: 'patrol', look: 0.8 };
    const step = copStep(w, rick);
    expect(step.yaw).toBeCloseTo(yawOf(0), 9);
    const b = bodyFrom(null, step, 1 / 30, { table: COP_BODY });
    // (his look: 0.8 round from +x, toward -z)
    const a = Math.atan2(b.look.x - w.x, b.look.z - w.z);
    expect(wrap(a - (yawOf(0) + 0.8))).toBeCloseTo(0, 6);
  });
  it('stares where he heard something when suspicious, and at his belief of Rick when chasing', () => {
    const sus = bodyFrom(null, copStep({ x: 0, z: 0, face: 0, mode: 'suspicious', at: [3, 5], look: 0 }, rick), 1 / 30, { table: COP_BODY });
    expect(sus.look).toEqual({ x: 3, z: 5 });
    const w = { x: 0, z: 0, face: 0, mode: 'chase', look: 0, me: { beliefs: { you: { at: { x: -2, y: 0, z: 7 } } } } };
    expect(bodyFrom(null, copStep(w, rick), 1 / 30, { table: COP_BODY }).look).toEqual({ x: -2, z: 7 });
    // seen, before the chase: at Rick
    expect(bodyFrom(null, copStep({ ...w, mode: 'alert', me: null }, rick), 1 / 30, { table: COP_BODY }).look).toEqual({ x: 4, z: 0 });
  });
  it('sweeps his head searching', () => {
    expect(bodyFrom(null, copStep({ x: 0, z: 0, face: 0, mode: 'search', look: 0 }, rick), 1 / 30, { table: COP_BODY }).scan).toBe(true);
  });
  it('reads his pace off his steps, ahead of him', () => {
    const a = copStep({ x: 0, z: 0, face: 0, mode: 'chase', look: 0 }, rick);
    const b = copStep({ x: 5.2 / 30, z: 0, face: 0, mode: 'chase', look: 0 }, rick);
    const m = stepBody(a, b, 1 / 30, { table: COP_BODY }).motion;
    expect(m.speed).toBeCloseTo(5.2, 6);
    expect(Math.abs(m.side)).toBeLessThan(1e-9);
  });
});

describe('a step that is a jump', () => {
  it('reads as standing, not a sprint, when the figure’s put somewhere new', () => {
    const m = stepBody({ x: 0, z: 0, yaw: 0 }, { x: 0, z: 20, yaw: 0 }, 1 / 30).motion;
    expect(m.speed).toBe(0);
  });
});

describe('where a head looks', () => {
  it('ahead and to one side, `off` round from its facing', () => {
    const p = lookAhead(1, 2, 0, Math.PI / 2, 6);
    expect(p.x).toBeCloseTo(7, 9);
    expect(p.z).toBeCloseTo(2, 9);
  });
  it('sweeps across its cone and back, each searcher in its own time', () => {
    const at = (t, seed) => {
      const p = scanLook(0, 0, 0, t, seed);
      return Math.atan2(p.x, p.z);
    };
    const seen = Array.from({ length: 40 }, (_, i) => at(i * 0.1, 1));
    expect(Math.max(...seen)).toBeGreaterThan(0.5);
    expect(Math.min(...seen)).toBeLessThan(-0.5);
    expect(Math.max(...seen.map(Math.abs))).toBeLessThanOrEqual(1.0);
    expect(at(1, 1)).not.toBeCloseTo(at(1, 2), 2);
  });
});

describe('a drawn figure catching up with its rules', () => {
  it('walks to where it’s been put rather than appearing there', () => {
    const vis = { x: 0, z: 0, face: 0 };
    catchUp(vis, { x: 10, z: 0 }, 0.1, { speed: 1.5 });
    expect(vis.x).toBeCloseTo(0.15, 6);
    expect(vis.speed).toBeCloseTo(1.5, 6);
    for (let i = 0; i < 80; i++) catchUp(vis, { x: 10, z: 0 }, 0.1, { speed: 1.5 });
    expect(vis.x).toBeCloseTo(10, 6);
    expect(vis.speed).toBe(0);
  });
  it('keeps step with it while it’s near, and is put there when it’s too far to walk', () => {
    const vis = { x: 0, z: 0, face: 0 };
    catchUp(vis, { x: 0.1, z: 0 }, 1 / 30, { speed: 1.5 });
    expect(vis.x).toBeCloseTo(0.1, 9);
    catchUp(vis, { x: 90, z: 0 }, 1 / 30, { speed: 1.5, snap: 40 });
    expect(vis.x).toBe(90);
  });
  it('is kept out of things by `push`', () => {
    const vis = { x: 0, z: 0, face: 0 };
    catchUp(vis, { x: 5, z: 0 }, 0.5, { speed: 2, push: (x, z) => [Math.min(x, 0.5), z] });
    expect(vis.x).toBe(0.5);
  });
});

describe('the dozen nearest', () => {
  const pts = Array.from({ length: 30 }, (_, i) => ({ x: i, z: 0 }));
  it('picks the n nearest that may be picked', () => {
    expect(nearestN(pts, { x: 0, z: 0 }, 3).sort((a, b) => a - b)).toEqual([0, 1, 2]);
    expect(nearestN(pts, { x: 0, z: 0 }, 3, [], { ok: (p) => p.x % 2 === 1 }).sort((a, b) => a - b)).toEqual([1, 3, 5]);
  });
  it('keeps one it has unless another is nearer by a margin', () => {
    // (4 is a little further than 2, but kept)
    expect(nearestN(pts, { x: 0, z: 0 }, 3, [0, 1, 4], { margin: 3 }).sort((a, b) => a - b)).toEqual([0, 1, 4]);
    expect(nearestN(pts, { x: 0, z: 0 }, 3, [0, 1, 9], { margin: 3 }).sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });
});

describe('a rally’s beats', () => {
  it('comes now and then, as the seed says, never two at once', () => {
    const run = (seed) => {
      const b = createBeats({ seed, every: [5, 9] });
      const at = [];
      for (let t = 0; t < 60; t += 1 / 30) if (b.tick(t, true)) at.push(t);
      return at;
    };
    const a = run(3);
    expect(a.length).toBeGreaterThan(4);
    for (let i = 1; i < a.length; i++) {
      expect(a[i] - a[i - 1]).toBeGreaterThanOrEqual(5 - 1e-6);
      expect(a[i] - a[i - 1]).toBeLessThanOrEqual(9 + 0.05);
    }
    expect(run(3)).toEqual(a);
    expect(run(4)).not.toEqual(a);
  });
  it('is quiet while it’s off', () => {
    const b = createBeats({ seed: 1, every: [1, 2] });
    let n = 0;
    for (let t = 0; t < 10; t += 0.05) if (b.tick(t, false)) n++;
    expect(n).toBe(0);
  });
});

describe('how long a line takes', () => {
  it('is longer for more words, and never a flicker or forever', () => {
    expect(sayFor('Hi.')).toBeGreaterThanOrEqual(1.6);
    expect(sayFor('Twelve hours on the line, then home to a pod the size of a closet.')).toBeGreaterThan(sayFor('Howdy, partner.'));
    expect(sayFor('word '.repeat(200))).toBeLessThanOrEqual(6);
  });
});

describe('a head’s target', () => {
  it('is asked of the figure once, and again only when it’s moved on', () => {
    const asked = [];
    const f = { look: (p) => asked.push(p) };
    lookAt(f, { x: 1, z: 2 });
    lookAt(f, { x: 1.05, z: 2 });
    expect(asked).toEqual([{ x: 1, z: 2 }]);
    lookAt(f, { x: 2, z: 2 });
    lookAt(f, { x: 2, y: 9, z: 2 }); // (up at the holo-ads, now)
    lookAt(f, null);
    lookAt(f, null);
    expect(asked).toEqual([{ x: 1, z: 2 }, { x: 2, z: 2 }, { x: 2, y: 9, z: 2 }, null]);
  });
  it('does nothing to a figure that can’t look', () => {
    expect(() => lookAt({}, { x: 0, z: 0 })).not.toThrow();
  });
});

describe('a pace as locomotion’s move', () => {
  // (locomotion.js: idle fades out from 0.04 to 0.3, the run comes in from 0.55 to 0.9)
  it('is all walk at a stroll, all run at a chase, and nothing standing', () => {
    expect(moveFor(0)).toBe(0);
    expect(moveFor(1.3)).toBeGreaterThanOrEqual(0.3);
    expect(moveFor(1.3)).toBeLessThanOrEqual(0.55);
    expect(moveFor(5.2)).toBeGreaterThanOrEqual(0.9);
    expect(moveFor(-1.3)).toBe(moveFor(1.3));
  });
  it('rises with the pace, never jumping', () => {
    let last = 0;
    for (let s = 0; s <= 8; s += 0.01) {
      const m = moveFor(s);
      expect(m).toBeGreaterThanOrEqual(last);
      expect(m - last).toBeLessThan(0.01);
      last = m;
    }
  });
});
