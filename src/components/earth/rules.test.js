import { describe, expect, it } from 'vitest';
import { HOME, PLACES, distanceKm } from '../../data/places';
import {
  ALT,
  CAPTURE,
  HOME_V,
  KM,
  STAMPS,
  angle,
  arrivals,
  autopilot,
  bearingOf,
  bearingTo,
  dot,
  fly,
  headingOf,
  kmBetween,
  len,
  newFlight,
  nextStamp,
  subsolar,
  toLonLat,
  toVec,
} from './rules';

const DT = 1 / 30;
const still = { turn: 0, climb: 0, boost: false };

describe('Earth: the frame', () => {
  it('turns longitude and latitude into points and back', () => {
    for (const [lon, lat] of [
      [0, 0],
      [-76.15, 43.05],
      [77.21, 28.61],
      [-70.67, -33.45],
      [179, -10],
    ]) {
      const [a, b] = toLonLat(toVec(lon, lat));
      expect(a).toBeCloseTo(lon, 6);
      expect(b).toBeCloseTo(lat, 6);
    }
    expect(toVec(0, 0)).toEqual([0, 0, 1]); // longitude 0 faces +z, as on the travel globe
    expect(toVec(90, 0)[0]).toBeCloseTo(1);
  });

  it('measures the same distances as the travel page', () => {
    for (const p of PLACES) expect(kmBetween(HOME_V, toVec(...p.at))).toBeCloseTo(distanceKm(HOME.at, p.at), -1);
  });

  it('reads bearings the way a compass does', () => {
    const p = toVec(-76.15, 43.05);
    expect(bearingOf(p, headingOf(p, 0))).toBeCloseTo(0);
    expect(bearingOf(p, headingOf(p, 90))).toBeCloseTo(90);
    expect(bearingOf(p, headingOf(p, 225))).toBeCloseTo(225);
    // due north of Syracuse is north; due south, south
    expect(bearingTo(p, toVec(-76.15, 60))).toBeCloseTo(0, 3);
    expect(bearingTo(p, toVec(-76.15, 10))).toBeCloseTo(180, 3);
    // Europe is north-east of New York along the great circle, not due east
    const london = bearingTo(p, toVec(-0.13, 51.51));
    expect(london).toBeGreaterThan(40);
    expect(london).toBeLessThan(65);
  });
});

describe('Earth: flying', () => {
  it('starts over home, at cruising height', () => {
    const f = newFlight();
    expect(angle(f.p, HOME_V)).toBeLessThan(1e-9);
    expect(f.alt).toBe(ALT.start);
    expect(dot(f.p, f.h)).toBeCloseTo(0);
  });

  it('stays on the sphere and keeps its heading along the ground', () => {
    const f = newFlight();
    for (let i = 0; i < 3000; i++) fly(f, { turn: Math.sin(i / 50), climb: Math.cos(i / 70), boost: i % 400 < 200 }, DT);
    expect(len(f.p)).toBeCloseTo(1, 9);
    expect(len(f.h)).toBeCloseTo(1, 9);
    expect(dot(f.p, f.h)).toBeCloseTo(0, 9);
    expect(f.alt).toBeGreaterThanOrEqual(ALT.min);
    expect(f.alt).toBeLessThanOrEqual(ALT.max);
  });

  it('flies a great circle when flown straight: all the way round and back', () => {
    const f = newFlight({ bearing: 30 });
    const start = f.p;
    let far = 0;
    let n = 0;
    while (f.km < 2 * Math.PI * KM - 1) {
      fly(f, still, Math.min(DT, (2 * Math.PI * KM - f.km) / (f.speed * KM)));
      far = Math.max(far, angle(f.p, start));
      n += 1;
    }
    expect(far).toBeGreaterThan(Math.PI - 0.05); // over the far side
    expect(angle(f.p, start)).toBeLessThan(0.01); // and home again
    expect(n).toBeGreaterThan(100);
  });

  it('turns right when the stick goes right', () => {
    const f = newFlight({ bearing: 90 });
    for (let i = 0; i < 20; i++) fly(f, { turn: 1 }, DT);
    expect(bearingOf(f.p, f.h)).toBeGreaterThan(95);
    const g = newFlight({ bearing: 90 });
    for (let i = 0; i < 20; i++) fly(g, { turn: -1 }, DT);
    expect(bearingOf(g.p, g.h)).toBeLessThan(85);
  });

  it('climbs and descends within its limits, and goes faster with boost', () => {
    const f = newFlight();
    for (let i = 0; i < 400; i++) fly(f, { climb: 1 }, DT);
    expect(f.alt).toBe(ALT.max);
    for (let i = 0; i < 400; i++) fly(f, { climb: -1, boost: true }, DT);
    expect(f.alt).toBe(ALT.min);
    expect(f.speed).toBeGreaterThan(0.3);
  });
});

describe('Earth: the passport', () => {
  it('has a stamp for every place but home', () => {
    expect(STAMPS.map((s) => s.id)).toEqual(PLACES.filter((p) => !p.home).map((p) => p.id));
    expect(STAMPS.some((s) => s.id === HOME.id)).toBe(false);
  });

  it('keeps the places far enough apart that each is its own stamp', () => {
    for (const a of STAMPS) for (const b of STAMPS) if (a !== b) expect(angle(a.v, b.v), `${a.id}-${b.id}`).toBeGreaterThan(CAPTURE * 2);
  });

  it('flies itself from home to every place on the autopilot, and stamps it', () => {
    for (const s of STAMPS) {
      const f = newFlight();
      const stamped = new Set();
      let away = false;
      let got = null;
      for (let i = 0; i < 30 * 60 && !got; i++) {
        fly(f, autopilot(f, s.v), DT);
        const r = arrivals(f, stamped, away);
        away = r.away;
        got = r.ev.find((e) => e.type === 'stamp' && e.id === s.id);
      }
      expect(got, s.id).toBeTruthy();
    }
  });

  it('stamps each place once, and welcomes you home after a trip', () => {
    const india = STAMPS.find((x) => x.id === 'in');
    const f = newFlight({ at: india.at });
    const stamped = new Set();
    let r = arrivals(f, stamped, false);
    expect(r.ev).toEqual([{ type: 'stamp', id: 'in' }]);
    expect(arrivals(f, stamped, r.away).ev).toEqual([]);
    expect(r.away).toBe(true);
    const home = newFlight();
    r = arrivals(home, stamped, true);
    expect(r.ev).toEqual([{ type: 'home' }]);
    expect(r.away).toBe(false);
  });

  it('points at the nearest place still to stamp', () => {
    const f = newFlight({ bearing: 0 });
    const n = nextStamp(f, new Set());
    expect(n.id).toBe('ca'); // Ottawa is the nearest to Syracuse
    expect(n.km).toBeGreaterThan(200);
    expect(n.km).toBeLessThan(400);
    expect(nextStamp(f, new Set(STAMPS.map((s) => s.id)))).toBeNull();
  });
});

describe('Earth: the sun', () => {
  it('is over the equator at noon on the March equinox, at longitude 0', () => {
    const [lon, lat] = subsolar(new Date(Date.UTC(2026, 2, 20, 12, 0)));
    expect(Math.abs(lon)).toBeLessThan(1);
    expect(Math.abs(lat)).toBeLessThan(1);
  });

  it('is over the tropic of Cancer in June and Capricorn in December', () => {
    expect(subsolar(new Date(Date.UTC(2026, 5, 21, 12)))[1]).toBeCloseTo(23.4, 0);
    expect(subsolar(new Date(Date.UTC(2026, 11, 21, 12)))[1]).toBeCloseTo(-23.4, 0);
  });

  it('moves west fifteen degrees an hour', () => {
    const a = subsolar(new Date(Date.UTC(2026, 6, 1, 12)))[0];
    const b = subsolar(new Date(Date.UTC(2026, 6, 1, 13)))[0];
    expect(a - b).toBeCloseTo(15);
  });
});

describe('Earth: the seas', () => {
  it('names the sea under the plane', async () => {
    const { seaName } = await import('./rules');
    expect(seaName([-40, 40])).toBe('the Atlantic');
    expect(seaName([-150, 20])).toBe('the Pacific');
    expect(seaName([75, -10])).toBe('the Indian Ocean');
    expect(seaName([18, 35])).toBe('the Mediterranean');
    expect(seaName([-75, 15])).toBe('the Caribbean Sea');
    expect(seaName([0, 80])).toBe('the Arctic Ocean');
    expect(seaName([-80, -20])).toBe('the Pacific'); // off Chile
  });
});
