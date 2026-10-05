import { describe, expect, it } from 'vitest';
import { HOME, PLACES, distanceKm } from '../../data/places';
import {
  ALT,
  AROUND_KM,
  CAPTURE,
  CLOUD_ALT,
  HOME_V,
  KM,
  LOOK,
  ROLL,
  STAMPS,
  TRAIL,
  angle,
  aroundWorld,
  arrivals,
  autopilot,
  bearingOf,
  bearingTo,
  dot,
  easeLook,
  fly,
  headingOf,
  kmBetween,
  len,
  cross,
  logTrail,
  newFlight,
  newLook,
  nextStamp,
  rotate,
  routeArc,
  subsolar,
  toLonLat,
  toVec,
  turnLook,
  unit,
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

  it('can get down under the cloud deck, and up well over it', () => {
    expect(ALT.min).toBeLessThan(CLOUD_ALT);
    expect(ALT.max).toBeGreaterThan(CLOUD_ALT * 4);
    expect(ALT.start).toBeGreaterThan(CLOUD_ALT);
    const f = newFlight();
    for (let i = 0; i < 400; i++) fly(f, { climb: -1 }, DT);
    expect(f.alt).toBeLessThan(CLOUD_ALT);
    expect(f.alt * KM).toBeGreaterThan(10); // still well up, in km
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

  it('slows down to turn when the place is well off the nose, and boosts once it’s ahead and far', () => {
    const f = newFlight(); // heading east-north-east
    const mexico = toVec(-99.13, 19.43); // behind, to the south-west
    expect(autopilot(f, mexico)).toMatchObject({ slow: true, boost: false });
    const ahead = rotate(f.p, unit(cross(f.p, f.h)), 1); // far, straight down the nose
    expect(autopilot(f, ahead)).toMatchObject({ slow: false, boost: true });
    // and the turn costs well under a turning circle at cruising speed
    const stamped = new Set();
    let n = 0;
    while (!stamped.has('mx') && n < 20000) {
      fly(f, autopilot(f, mexico), DT);
      arrivals(f, stamped, false);
      n++;
    }
    expect(f.km - kmBetween(HOME_V, mexico)).toBeLessThan(1000);
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

describe('Earth: the flight log', () => {
  it('keeps a trail of where the plane has flown, a point every so often, up to a limit', () => {
    const f = newFlight();
    const trail = [];
    expect(logTrail(trail, f.p)).toBe(true);
    expect(logTrail(trail, f.p)).toBe(false); // not moved: no new point
    let added = 0;
    for (let i = 0; i < 20 / DT; i++) {
      fly(f, still, DT);
      if (logTrail(trail, f.p)) added++;
    }
    expect(added).toBeGreaterThan(5);
    expect(trail).toHaveLength(added + 1);
    // the points are spaced about TRAIL.step apart along the ground, and on the sphere
    for (let i = 1; i < trail.length; i++) {
      expect(len(trail[i])).toBeCloseTo(1, 6);
      expect(angle(trail[i - 1], trail[i])).toBeGreaterThanOrEqual(TRAIL.step * 0.99);
      expect(angle(trail[i - 1], trail[i])).toBeLessThan(TRAIL.step * 2.5);
    }
    // and the trail is only ever so long: the oldest go
    for (let i = 0; i < 400 / DT; i++) {
      fly(f, { ...still, boost: true }, DT);
      logTrail(trail, f.p);
    }
    expect(trail.length).toBeLessThanOrEqual(TRAIL.max);
    expect(trail.length).toBe(TRAIL.max);
    expect(angle(trail[trail.length - 1], f.p)).toBeLessThan(TRAIL.step * 1.5);
  });

  it('draws the route to a place along the great circle, evenly', () => {
    const q = toVec(-0.13, 51.51); // London
    const arc = routeArc(HOME_V, q, 32);
    expect(arc).toHaveLength(33);
    expect(arc[0]).toEqual(HOME_V);
    expect(angle(arc[32], q)).toBeLessThan(1e-9);
    const total = angle(HOME_V, q);
    for (let i = 0; i < 32; i++) {
      expect(len(arc[i])).toBeCloseTo(1, 9);
      expect(angle(arc[i], arc[i + 1])).toBeCloseTo(total / 32, 9);
    }
    // the middle of the way to London is well north of both ends
    expect(toLonLat(arc[16])[1]).toBeGreaterThan(52);
    // a route to the same place is just the place
    expect(routeArc(q, q, 4).every((v) => angle(v, q) < 1e-9)).toBe(true);
  });

  it('counts the way round the world', () => {
    expect(AROUND_KM).toBeCloseTo(2 * Math.PI * KM, -1);
    expect(aroundWorld(0)).toBe(0);
    expect(aroundWorld(AROUND_KM / 4)).toBeCloseTo(0.25);
    expect(aroundWorld(AROUND_KM * 3)).toBe(1);
  });
});

describe('Earth: the barrel roll', () => {
  it('rolls the plane right round on the button, once at a time, and comes back level', () => {
    const f = newFlight();
    expect(f.roll).toBe(0);
    fly(f, { ...still, roll: true }, DT);
    expect(f.rolling).toBe(true);
    const seen = [];
    for (let i = 0; i < ROLL.time / DT + 5; i++) {
      // pressing again in the middle of one does nothing
      fly(f, { ...still, roll: i < 20 && i % 7 === 0 }, DT);
      seen.push(f.roll);
    }
    expect(Math.max(...seen)).toBeGreaterThan(Math.PI);
    expect(Math.max(...seen)).toBeLessThanOrEqual(2 * Math.PI + 1e-9);
    expect(f.roll).toBe(0);
    expect(f.rolling).toBe(false);
    // and it never left its course: still on the sphere, heading square to the ground
    expect(len(f.p)).toBeCloseTo(1, 9);
    expect(dot(f.p, f.h)).toBeCloseTo(0, 9);
    // the roll takes about ROLL.time
    const g = newFlight();
    fly(g, { ...still, roll: true }, DT);
    let n = 0;
    while (g.rolling && n < 1000) {
      fly(g, still, DT);
      n++;
    }
    expect(n * DT).toBeCloseTo(ROLL.time, 0);
  });
});

describe('Earth: looking round', () => {
  it('turns the camera round the plane as far as its limits, and no further', () => {
    const l = newLook();
    expect(l).toMatchObject({ yaw: 0, pitch: 0, held: false });
    turnLook(l, 0.5, 0.2);
    expect(l.yaw).toBeCloseTo(0.5);
    expect(l.pitch).toBeCloseTo(0.2);
    expect(l.held).toBe(true);
    turnLook(l, 100, -100);
    expect(l.yaw).toBe(LOOK.yaw);
    expect(l.pitch).toBe(-LOOK.pitch);
  });

  it('settles back behind the plane once let go, and stays put while held', () => {
    const l = newLook();
    turnLook(l, 1, 0.3);
    for (let i = 0; i < 30; i++) easeLook(l, DT);
    expect(l.yaw).toBeCloseTo(1);
    l.held = false;
    for (let i = 0; i < 30; i++) easeLook(l, DT);
    expect(Math.abs(l.yaw)).toBeLessThan(0.5);
    expect(Math.abs(l.yaw)).toBeGreaterThan(0);
    for (let i = 0; i < 300; i++) easeLook(l, DT);
    expect(Math.abs(l.yaw)).toBeLessThan(0.01);
    expect(Math.abs(l.pitch)).toBeLessThan(0.01);
  });
});
