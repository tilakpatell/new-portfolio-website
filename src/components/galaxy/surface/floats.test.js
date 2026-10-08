import { describe, expect, it } from 'vitest';
import { diveAt, floatPose, sprayAt } from './floats';

const flat = () => 2;
// a swell running along +z: the bow up the face of it
const slope = (x, z) => z * 0.1;
// one rolling the other way: the starboard (−x) side up
const roll = (x) => -x * 0.1;

describe('floating things', () => {
  it('sit on still water at the level, less their draft, level', () => {
    const p = floatPose(flat, 10, 20, 0, 0, { len: 8, beam: 4, draft: 0.5 });
    expect(p.y).toBeCloseTo(1.5);
    expect(p.pitch).toBeCloseTo(0);
    expect(p.roll).toBeCloseTo(0);
  });

  it('nose up a wave’s face and lean with its roll', () => {
    const up = floatPose(slope, 0, 0, 0, 0, { len: 8, beam: 4, draft: 0 });
    expect(up.pitch).toBeLessThan(0); // (three.js: −x rotation lifts +z)
    expect(up.pitch).toBeCloseTo(-Math.atan(0.1), 2);
    const lean = floatPose(roll, 0, 0, 0, 0, { len: 8, beam: 4, draft: 0 });
    expect(Math.abs(lean.roll)).toBeCloseTo(Math.atan(0.1), 2);
  });

  it('read the wave along the way it faces', () => {
    // turned a quarter, the swell along z comes in from the side: a roll, no pitch
    const p = floatPose(slope, 0, 0, Math.PI / 2, 0, { len: 8, beam: 4, draft: 0 });
    expect(p.pitch).toBeCloseTo(0, 3);
    expect(Math.abs(p.roll)).toBeCloseTo(Math.atan(0.1), 2);
  });

  it('never tip further than the cap', () => {
    const steep = (x, z) => z * 5;
    expect(
      Math.abs(floatPose(steep, 0, 0, 0, 0, { maxTilt: 0.3 }).pitch),
    ).toBeLessThanOrEqual(0.3);
  });
});

describe('an aiwha’s dive', () => {
  const d = { high: 70, low: -3, every: 40, down: 0.22 };

  it('glides high most of the time', () => {
    let high = 0;
    for (let i = 0; i < 400; i++) if (diveAt(i / 10, 0, d).y > 60) high++;
    expect(high / 400).toBeGreaterThan(0.6);
  });

  it('goes under the surface once a cycle, and comes up again', () => {
    const ys = Array.from({ length: 4000 }, (_, i) => diveAt(i / 100, 0, d).y);
    expect(Math.min(...ys)).toBeCloseTo(-3, 0);
    // (down through the surface once each 40 s: one splash in, one out)
    let crossings = 0;
    for (let i = 1; i < ys.length; i++) if (Math.sign(ys[i]) !== Math.sign(ys[i - 1])) crossings++;
    expect(crossings).toBe(2);
  });

  it('moves smoothly, nosing down as it falls', () => {
    for (let t = 0; t < 40; t += 0.05) {
      const a = diveAt(t, 0, d);
      const b = diveAt(t + 0.05, 0, d);
      expect(Math.abs(b.y - a.y)).toBeLessThan(2);
      if (b.y < a.y - 0.05) expect(a.pitch).toBeGreaterThan(0);
    }
  });

  it('keeps each one on its own beat', () => {
    expect(diveAt(10, 0, d).y).not.toBeCloseTo(diveAt(10, 0.5, d).y);
  });
});

describe('spray off the legs', () => {
  it('flies only where the water rises fast and high on a leg', () => {
    expect(sprayAt(0.2, 0.1, 0.1, { level: 0 })).toBe(0);
    expect(sprayAt(2.5, 1.5, 0.1, { level: 0 })).toBeGreaterThan(0.5);
  });

  it('none off a falling or still sea', () => {
    expect(sprayAt(2.5, 3, 0.1, { level: 0 })).toBe(0);
    expect(sprayAt(2.5, 2.5, 0.1, { level: 0 })).toBe(0);
  });

  it('is never more than one', () => {
    expect(sprayAt(20, 0, 0.1, { level: 0 })).toBeLessThanOrEqual(1);
  });
});
