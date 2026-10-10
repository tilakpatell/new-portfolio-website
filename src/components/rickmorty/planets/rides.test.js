import { describe, expect, it } from 'vitest';
import { RIDES } from '../../galaxy/surface/rides';
import { ride, rider, tooDeep } from '../../galaxy/surface/walker';
import { PROPS, RIDE_RADIUS } from './props';
import { RM_RIDES } from './rides';

// walker.test.js's harness: flat ground, sixty steps a second
const flat = (h = 0, extra = {}) => ({ heightAt: () => h, normalAt: () => [0, 1, 0], reach: 500, ...extra });
const run = (s, input, secs, world, spec) => {
  for (let t = 0; t < secs; t += 1 / 60) ride(s, input, 1 / 60, world, spec);
};

describe('the planets’ rides', () => {
  it('are the four, each with a body built of the same name and a footprint as wide', () => {
    expect(Object.keys(RM_RIDES).sort()).toEqual(['birdglider', 'gearbike', 'purgeskiff', 'rocksled']);
    for (const [kind, spec] of Object.entries(RM_RIDES)) {
      expect(typeof PROPS[kind], kind).toBe('function');
      expect(spec.radius, kind).toBe(RIDE_RADIUS[kind]);
      expect(RIDES[kind], `${kind} is the galaxy's`).toBeUndefined();
      for (const k of ['name', 'top', 'accel', 'brake', 'turn', 'bank', 'radius', 'grip', 'seat', 'cam']) expect(spec[k], `${kind}.${k}`).toBeDefined();
    }
  });

  it('start from the galaxy’s numbers: the bike the speeder bike’s, leaving a trail; the skiff a slower landspeeder', () => {
    expect(RM_RIDES.gearbike).toMatchObject({ ...RIDES.speederbike, name: 'the gear bike', trail: true });
    expect(RM_RIDES.purgeskiff.top).toBe(18);
    expect(RM_RIDES.purgeskiff.turn).toBe(RIDES.landspeeder.turn);
    expect(RM_RIDES.birdglider.fly).toEqual({ alt: 14, climb: 7, floor: 0 });
  });

  it('holds the rock sled at its hover over the sand', () => {
    const s = rider(0, 0, 0);
    run(s, { x: 0, y: 0 }, 2, flat(3), RM_RIDES.rocksled);
    // (the spring sits it a few centimetres under, as it does the landspeeder)
    expect(Math.abs(s.y - 3.6)).toBeLessThan(0.1);
    run(s, { x: 0, y: 1 }, 3, flat(3), RM_RIDES.rocksled);
    expect(s.speed).toBeCloseTo(RM_RIDES.rocksled.top, 0);
    expect(Math.abs(s.y - 3.6)).toBeLessThan(0.1);
  });

  it('climbs the glider while Space is held, and sinks it when let go', () => {
    const s = rider(0, 0, 0);
    run(s, { x: 0, y: 1, jump: true }, 2, flat(0), RM_RIDES.birdglider);
    expect(s.y).toBeGreaterThan(10);
    const high = s.y;
    run(s, { x: 0, y: 1 }, 1, flat(0), RM_RIDES.birdglider);
    expect(s.y).toBeLessThan(high);
    run(s, { x: 0, y: 1, jump: true }, 6, flat(0), RM_RIDES.birdglider);
    expect(s.y).toBeCloseTo(14, 1);
  });

  it('never loses a hover ride in deep water: it rides on the oil or the lake, and comes out the far side', () => {
    // (the canal: deep water from x = 10 to 40, past what anyone wades)
    const canal = { ...flat(0), heightAt: (x) => (x > 10 && x < 40 ? -6 : 0), water: -0.5, wadeMax: 1.2 };
    expect(tooDeep(canal, 20, 0)).toBe(true);
    for (const kind of ['rocksled', 'gearbike', 'purgeskiff']) {
      const s = rider(0, 0, 0, Math.PI / 2);
      // (4 s and more over it, at a crawl)
      for (let t = 0; t < 6; t += 1 / 60) {
        ride(s, { x: 0, y: 0.25 }, 1 / 60, canal, RM_RIDES[kind]);
        if (tooDeep(canal, s.x, s.z)) expect(s.y, kind).toBeGreaterThan(canal.water);
      }
      for (let t = 0; t < 8 && s.x < 45; t += 1 / 60) ride(s, { x: 0, y: 1 }, 1 / 60, canal, RM_RIDES[kind]);
      expect(s.x, kind).toBeGreaterThan(40);
      expect(s.y, kind).toBeGreaterThan(0);
    }
  });
});
