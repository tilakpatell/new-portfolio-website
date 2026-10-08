import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { RANGES, createWeather, leavesOf, noise, remapClamp, windOf } from './weather';

// his presets, as his DayCycles.js writes them (THREE.Color of an sRGB hex)
const HIS = {
  day: { light: '#ffd2c2', intensity: 1.2, shadow: '#6d3fff', fogA: '#00ffff', fogB: '#9b89ff', near: 0.315, far: 1.25 },
  dusk: { light: '#ff8181', intensity: 1.2, shadow: '#4e009c', fogA: '#3e53ff', fogB: '#ff4ce4', near: 0, far: 1.25 },
  night: { light: '#3240ff', intensity: 3.8, shadow: '#2f00db', fogA: '#10266f', fogB: '#490a42', near: -0.85, far: 1 },
  dawn: { light: '#ffa882', intensity: 1.2, shadow: '#db004f', fogA: '#f885ff', fogB: '#ff7d24', near: 0.3, far: 1.25 },
};
const STOPS = [
  [0, 'day'],
  [0.15, 'day'],
  [0.25, 'dusk'],
  [0.35, 'night'],
  [0.6, 'night'],
  [0.8, 'dawn'],
  [0.9, 'day'],
];
const lin = (hex) => new THREE.Color(hex).toArray();
const close = (a, b, digits = 9) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits));
const SCALARS = ['temperature', 'humidity', 'electric', 'clouds', 'wind', 'rain', 'snow', 'dayProgress'];
const NOW = 1_791_500_000; // a wall clock in October 2026, in seconds
const EPS = 1e-12; // his lerp, (1 − k)·a + k·b, can land an ulp past a stop it holds

describe('his little maths', () => {
  it('is sin(x)·sin(1.678x)·sin(2.345x), and remapClamp keeps to a reversed range too', () => {
    expect(noise(0.7)).toBeCloseTo(Math.sin(0.7) * Math.sin(0.7 * 1.678) * Math.sin(0.7 * 2.345), 12);
    expect(remapClamp(0.5, 0, 1, 0.1, 1)).toBeCloseTo(0.55, 12);
    expect(remapClamp(-3, 0, -5, 0, 1)).toBeCloseTo(0.6, 12);
    expect(remapClamp(20, 0, 10, 0, -1)).toBe(-1);
    expect(remapClamp(-20, 0, 10, 0, -1)).toBe(0);
  });
});

describe('the weather, over many days', () => {
  it('keeps every output inside its range over 10,000 samples, seeds and years', () => {
    const lo = {};
    const hi = {};
    const out = []; // [seed, now, key, value] of anything outside its range
    let samples = 0;
    for (const seed of [0, 1, 7, 42]) {
      const w = createWeather({ seed });
      for (let i = 0; i < 2500; i++) {
        // two years, a sample about every nine hours (some 130 of his days apart),
        // plus a run of seconds today so several whole days are walked through
        const now = i < 2000 ? i * 31_557.7 : NOW + (i - 2000) * 2.9;
        const s = w.at(now);
        samples++;
        for (const k of [...SCALARS, 'lightIntensity', 'fogNear', 'fogFar', 'leaves']) {
          const [a, b] = RANGES[k];
          if (!(s[k] >= a - EPS && s[k] <= b + EPS)) out.push([seed, now, k, s[k]]);
          lo[k] = Math.min(lo[k] ?? Infinity, s[k]);
          hi[k] = Math.max(hi[k] ?? -Infinity, s[k]);
        }
        if (!(s.dayProgress < 1)) out.push([seed, now, 'dayProgress', s.dayProgress]);
        for (const c of ['lightColour', 'shadowColour', 'fogA', 'fogB'])
          if (s[c].length !== 3 || s[c].some((v) => !(v >= -EPS && v <= 1 + EPS))) out.push([seed, now, c, s[c]]);
      }
    }
    expect(samples).toBe(10_000);
    expect(out).toEqual([]);
    // and they move: it rains, it freezes, it thaws, the wind drops and rises
    expect(hi.rain).toBeGreaterThan(0.5);
    expect(lo.snow).toBeLessThan(-0.5);
    expect(hi.snow).toBeGreaterThan(0);
    expect(hi.wind - lo.wind).toBeGreaterThan(0.8);
    expect(hi.temperature - lo.temperature).toBeGreaterThan(25);
  });

  it('wraps the day: at(0) and at(day) are the same hour', () => {
    const w = createWeather();
    expect(w.at(0).dayProgress).toBe(w.at(240).dayProgress);
    expect(w.at(0).dayProgress).toBe(0);
    expect(w.at(120).dayProgress).toBeCloseTo(0.5, 12);
    close(w.at(0).lightColour, w.at(240).lightColour, 12);
    expect(w.at(NOW).dayProgress).toBeCloseTo(w.at(NOW + 240).dayProgress, 6);
    const slow = createWeather({ day: 600 });
    expect(slow.at(0).dayProgress).toBe(slow.at(600).dayProgress);
    expect(slow.at(300).dayProgress).toBeCloseTo(0.5, 12);
    // before 1970 too (a negative clock)
    expect(w.at(-60).dayProgress).toBeCloseTo(0.75, 12);
  });

  it('runs on days, not seconds: his t is the clock over the day', () => {
    const w = createWeather();
    const now = NOW + 17;
    const t = now / 240;
    const s = w.at(now);
    expect(s.clouds).toBeCloseTo(noise(t * 0.44), 9);
    expect(s.wind).toBeCloseTo(noise(t) * 0.5 + 0.5, 9);
    expect(s.rain).toBeCloseTo(remapClamp(s.humidity, 0.65, 1, 0, 1) * remapClamp(s.clouds, 0, 1, 0, 1), 12);
    const freeze = remapClamp(s.temperature, 0, -5, 0, 1);
    const melt = remapClamp(s.temperature, 0, 10, 0, -1);
    expect(s.snow).toBeCloseTo(remapClamp(s.rain, 0.05, 0.3, 0, 1) * freeze + melt, 12);
  });

  it("takes the year's and the day's terms from his cycles", () => {
    // a 1000-second year, so its stops are easy to stand on: winter at 0.125
    const w = createWeather({ year: 1000 });
    const now = 125; // winter; and the day at 125/240 = 0.52, deep night
    const t = now / 240;
    const s = w.at(now);
    expect(s.dayProgress).toBeCloseTo(125 / 240, 12);
    expect(s.temperature - noise(t * 0.4) * 7.5).toBeCloseTo(5 + -7.5, 9); // winter 5, night −7.5
    expect(s.humidity - noise(t * 0.36) * 0.2).toBeCloseTo(0.8, 9); // winter 0.8
    expect(s.electric).toBeCloseTo(1 * noise(t * 0.53), 9); // night's field is 1
    expect(s.leaves).toBeCloseTo(0.25, 12);
    const at = (p) => w.at(p * 1000).leaves;
    expect(at(0.375)).toBeCloseTo(0, 12); // spring
    expect(at(0.625)).toBeCloseTo(0.25, 12); // summer
    expect(at(0.875)).toBeCloseTo(1, 12); // fall
    expect(at(0)).toBeCloseTo(0.625, 12); // halfway from fall to winter, round the year's end
  });
});

describe('his day, in colours', () => {
  it('stands on his values at every stop', () => {
    const w = createWeather();
    for (const [stop, name] of STOPS) {
      const s = w.at(stop * 240);
      const p = HIS[name];
      close(s.lightColour, lin(p.light));
      close(s.shadowColour, lin(p.shadow));
      close(s.fogA, lin(p.fogA));
      close(s.fogB, lin(p.fogB));
      expect(s.lightIntensity).toBeCloseTo(p.intensity, 9);
      expect(s.fogNear).toBeCloseTo(p.near, 9);
      expect(s.fogFar).toBeCloseTo(p.far, 9);
    }
    // his night: #3240ff at 3.8, shade #2f00db
    const night = w.at(0.5 * 240);
    close(night.lightColour, lin(0x3240ff));
    close(night.shadowColour, lin(0x2f00db));
    expect(night.lightIntensity).toBeCloseTo(3.8, 12);
  });

  it('smoothsteps between stops in linear colour, as lerpColors does', () => {
    const w = createWeather();
    const half = w.at(0.3 * 240); // halfway from dusk to night: smoothstep(0.5) is 0.5
    const mid = (a, b) => lin(a).map((v, i) => (v + lin(b)[i]) / 2);
    close(half.shadowColour, mid(HIS.dusk.shadow, HIS.night.shadow));
    close(half.fogA, mid(HIS.dusk.fogA, HIS.night.fogA));
    expect(half.lightIntensity).toBeCloseTo((1.2 + 3.8) / 2, 9);
    // a quarter of the way is smoothstep's 0.15625, not 0.25
    const q = w.at(0.275 * 240);
    expect(q.lightIntensity).toBeCloseTo(1.2 + (3.8 - 1.2) * 0.15625, 9);
    // and the end of the day goes back to the day it began with
    const late = w.at(0.95 * 240);
    close(late.lightColour, lin(HIS.day.light));
  });

  it('fills the object it is given, colours and all, and never its presets', () => {
    const w = createWeather();
    const out = {};
    expect(w.at(0, out)).toBe(out);
    const light = out.lightColour;
    w.at(120, out);
    expect(out.lightColour).toBe(light);
    close(light, lin(HIS.night.light));
    w.override({ lightColour: [0, 0, 0] }, { duration: 0 });
    w.at(120, out);
    w.release({ duration: 0 });
    close(w.at(0).lightColour, lin(HIS.day.light), 12);
    close(w.at(120).lightColour, lin(HIS.night.light), 12);
  });
});

describe('an override, and letting go', () => {
  it('reaches rain 1 after 5 s, easing out, and holds it; snow follows the rain', () => {
    const w = createWeather();
    const free = createWeather();
    w.at(1000);
    w.override({ rain: 1 });
    // power1.out: a quarter of the way through time is 1 − 0.75² of the way
    expect(w.at(1001.25).rain).toBeCloseTo(free.at(1001.25).rain * (1 - 0.4375) + 0.4375, 9);
    expect(w.at(1005).rain).toBe(1);
    expect(w.at(1100).rain).toBe(1);
    const s = w.at(1005);
    expect(s.snow).toBeCloseTo(remapClamp(s.temperature, 0, -5, 0, 1) + remapClamp(s.temperature, 0, 10, 0, -1), 12);
    // what isn't overridden stays the function's
    expect(s.wind).toBe(free.at(1005).wind);
    expect(s.humidity).toBe(free.at(1005).humidity);
  });

  it('snows from the held rain on a cold, dry night: each output reads the overridden ones before it', () => {
    const w = createWeather({ year: 1000 });
    const free = createWeather({ year: 1000 });
    let T = 0;
    while (T < 1e5 && !(free.at(T).rain === 0 && free.at(T).temperature < -5)) T++;
    expect(free.at(T).snow).toBe(0); // dry: no snow of its own
    w.override({ rain: 1 }, { duration: 0, now: T });
    const s = w.at(T);
    expect(s.temperature).toBe(free.at(T).temperature);
    expect(s.snow).toBe(1); // all of the held rain, frozen
  });

  it('returns to the function within 5 s of release()', () => {
    const w = createWeather();
    const free = createWeather();
    w.at(2000);
    w.override({ rain: 1, wind: 0 });
    w.at(2010);
    w.release();
    const mid = w.at(2012.5);
    expect(mid.rain).toBeLessThan(1);
    expect(mid.rain).toBeGreaterThan(free.at(2012.5).rain);
    expect(w.at(2015)).toEqual(free.at(2015));
    expect(w.at(2100)).toEqual(free.at(2100));
  });

  it('takes its own duration, a start time, a colour and the hour', () => {
    const w = createWeather();
    const free = createWeather();
    // no at() yet: it starts on the next one
    w.override({ dayProgress: 0.5, fogA: [1, 0, 0] }, { duration: 2 });
    expect(w.at(50).dayProgress).toBeCloseTo(free.at(50).dayProgress, 12);
    const held = w.at(52);
    expect(held.dayProgress).toBe(0.5);
    close(held.fogA, [1, 0, 0], 12);
    close(held.shadowColour, lin(HIS.night.shadow)); // the forced hour's colours
    // release takes his 5 s unless told, whatever the override took
    w.release({ now: 60 });
    expect(w.at(62).dayProgress).not.toBe(free.at(62).dayProgress);
    expect(w.at(65)).toEqual(free.at(65));
    // duration 0 is at once
    w.override({ clouds: 1 }, { duration: 0, now: 70 });
    expect(w.at(70).clouds).toBe(1);
  });

  it('lets go over his 5 s after a 10 s override, as his end(duration = 5) does', () => {
    const w = createWeather();
    const free = createWeather();
    w.override({ rain: 1 }, { duration: 10, now: 300 });
    expect(w.at(310).rain).toBe(1);
    w.release();
    expect(w.at(312.5).rain).toBeGreaterThan(free.at(312.5).rain);
    expect(w.at(315)).toEqual(free.at(315));
  });

  it('eases from the held value when released before the clock is read', () => {
    const w = createWeather();
    const free = createWeather();
    w.override({ rain: 1 }, { duration: 0, now: 400 });
    w.release(); // no now, and no at() yet: it lets go from the next at()
    expect(w.at(400).rain).toBe(1);
    const mid = w.at(402.5).rain; // power1.out: a quarter of the hold left at half time
    expect(mid).toBeCloseTo(free.at(402.5).rain * 0.75 + 0.25, 9);
    expect(w.at(405)).toEqual(free.at(405));
    // and from wherever a slower hold had got to by then
    const v = createWeather();
    v.override({ rain: 1 }, { duration: 10, now: 500 });
    v.release();
    expect(v.at(505).rain).toBeCloseTo(free.at(505).rain * 0.25 + 0.75, 9); // 1 − 0.5² of the way in
    expect(v.at(510)).toEqual(free.at(510));
  });
});

describe('the same seed, the same weather', () => {
  it('repeats for one seed and differs for another, on the same hour', () => {
    const a = createWeather({ seed: 3 }).at(NOW);
    const b = createWeather({ seed: 3 }).at(NOW);
    const c = createWeather({ seed: 4 }).at(NOW);
    expect(a).toEqual(b);
    expect(c.temperature).not.toBe(a.temperature);
    expect(c.clouds).not.toBe(a.clouds);
    expect(c.wind).not.toBe(a.wind);
    expect(c.dayProgress).toBe(a.dayProgress);
    expect(c.lightColour).toEqual(a.lightColour);
  });
});

describe('what it feeds', () => {
  it("maps the wind onto createWind's strength as his Wind.js does: 0 → 0.1, 1 → 1", () => {
    expect(windOf({ wind: 0 }).strength).toBeCloseTo(0.1, 12);
    expect(windOf({ wind: 1 }).strength).toBe(1);
    expect(windOf({ wind: 0.5 }).strength).toBeCloseTo(0.55, 12);
    expect(windOf({ wind: -1 }).strength).toBeCloseTo(0.1, 12);
    expect(windOf({ wind: 2 }).strength).toBe(1);
  });

  it("gives the leaves his count over his most: 2^round(remap(leaves, 0.25, 1, 7, 11)) of 2048", () => {
    expect(leavesOf({ leaves: 1 }).ratio).toBe(1); // fall: 2048
    expect(leavesOf({ leaves: 0.25 }).ratio).toBe(1 / 16); // winter, summer: 128
    expect(leavesOf({ leaves: 0 }).ratio).toBe(1 / 32); // spring: 64
    expect(leavesOf({ leaves: 0.625 }).ratio).toBe(1 / 4); // 2^9
    expect(leavesOf({ leaves: 3 }).ratio).toBe(1); // never past the budget
  });
});

describe('purity', () => {
  it('imports nothing from three and touches no DOM', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('./weather.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/^import /m);
    expect(src).not.toMatch(/\b(document|window)\./);
  });
});
