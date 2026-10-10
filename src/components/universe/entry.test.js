import { describe, expect, it } from 'vitest';
import { AIR, ENTRY, LANDABLE, airTop, entering, entryAhead, entryGuess, entryPath, entrySpot, fxAt, velocityOf } from './entry';
import { PLANETS, SHIP, headingTo, spawn, step } from './ship';
import { NOSE, fromAngles, rotate } from './orient';
import { flat, vec } from './foot';
import { ORDER } from './layout';
import { byId } from './universes';

const { dot, cross, add, scale, len, unit } = vec;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const angle = (a, b) => Math.atan2(len(cross(a, b)), dot(a, b)); // (exact near 0, where acos is not)
const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const randUnit = (rand) => unit([rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1]);
const G = ENTRY.glide;

// a ship at `pos` flying along `dir` (a unit vector) at `speed`, upright
const flying = (pos, dir, speed) => ({
  ...spawn(null),
  x: pos[0],
  y: pos[1],
  z: pos[2],
  heading: headingTo(dir[0], dir[2]),
  pitch: Math.asin(clamp(dir[1], -1, 1)),
  speed,
  vy: dir[1] * speed,
});
// a ship `depth` under a planet's air top (negative: above it), out along n from its middle
const inAir = (p, n, dir, speed, depth = 0.2) => flying(add(p.at, n, airTop(p) - depth), dir, speed);
const distTo = (s, p) => Math.hypot(s.x - p.at[0], s.y - p.at[1], s.z - p.at[2]);
const first = LANDABLE[0];
const OUT = unit([0.6, 0.48, 0.64]); // out from a planet's middle, a little above its equator

describe('the air', () => {
  it('reaches 1.2 of the radius, as far as the halo', () => {
    expect(AIR).toBe(1.2);
    for (const p of PLANETS) expect(airTop(p)).toBeCloseTo(p.r * 1.2, 9);
  });

  it('is round every fandom planet, not the stations or the gate', () => {
    const ids = LANDABLE.map((p) => p.id);
    for (const id of ORDER) {
      const u = byId(id);
      expect(ids.includes(id), id).toBe(u.kind !== 'core' && id !== 'starwars');
    }
    expect(LANDABLE.every((p) => PLANETS.includes(p))).toBe(true);
  });

  it('is deeper than a frame at the fastest landing, so an entry always gets its frame', () => {
    const smallest = Math.min(...LANDABLE.map((p) => p.r));
    expect(ENTRY.fast * 0.05).toBeLessThan((AIR - 1) * smallest);
  });

  it('sits between the cruise and the boost: one lands, the other crashes', () => {
    expect(ENTRY.fast).toBeGreaterThan(SHIP.cruise);
    expect(ENTRY.fast).toBeLessThan(SHIP.boost);
  });
});

describe('velocityOf', () => {
  it('is the nose times the speed, with the climb the ship reports', () => {
    const s = flying([0, 0, 0], unit([0.3, -0.4, -0.866]), 5);
    const f = rotate(fromAngles(s.heading, s.pitch, s.bank), NOSE);
    const v = velocityOf(s);
    expect(v[0]).toBeCloseTo(f[0] * 5, 9);
    expect(v[1]).toBeCloseTo(s.vy, 9);
    expect(v[2]).toBeCloseTo(f[2] * 5, 9);
  });

  it('works the climb out from the nose and the lift when there is none reported', () => {
    const s = { ...flying([0, 0, 0], unit([0, 0.5, -1]), 4), vy: undefined, lift: 0.7 };
    const f = rotate(fromAngles(s.heading, s.pitch, s.bank), NOSE);
    expect(velocityOf(s)[1]).toBeCloseTo(f[1] * 4 + 0.7, 9);
  });
});

describe('entering', () => {
  it('takes a ship coming down through the air at cruise', () => {
    for (const p of LANDABLE) {
      const e = entering(inAir(p, OUT, scale(OUT, -1), SHIP.cruise));
      expect(e, p.id).toMatchObject({ id: p.id, kind: 'enter' });
      expect(e.speed).toBeCloseTo(SHIP.cruise, 6);
      expect(e.sink).toBeCloseTo(SHIP.cruise, 6);
      expect(len(e.n)).toBeCloseTo(1, 9);
      expect(dot(e.n, OUT)).toBeCloseTo(1, 9);
      expect(e.h).toBeCloseTo(airTop(p) - 0.2 - p.r, 6);
      expect(len(e.vel)).toBeCloseTo(SHIP.cruise, 6);
    }
  });

  it('takes a ship coming down at a slant, not only straight in', () => {
    const along = flat([0, 1, 0], OUT);
    const dir = unit(add(along, OUT, -0.3));
    expect(entering(inAir(first, OUT, dir, SHIP.cruise))).toMatchObject({ id: first.id, kind: 'enter' });
  });

  it('calls it hot at the boost: no landing', () => {
    for (const p of LANDABLE) expect(entering(inAir(p, OUT, scale(OUT, -1), SHIP.boost)), p.id).toMatchObject({ id: p.id, kind: 'hot' });
  });

  it("doesn't take a ship skimming along the top of the air", () => {
    const along = flat([0, 1, 0], OUT);
    expect(entering(inAir(first, OUT, along, SHIP.cruise))).toBe(null);
    // nor one only barely going down
    const barely = unit(add(along, OUT, -(ENTRY.sink * 0.5) / SHIP.cruise));
    expect(entering(inAir(first, OUT, barely, SHIP.cruise))).toBe(null);
  });

  it("doesn't take a ship climbing out", () => {
    expect(entering(inAir(first, OUT, OUT, SHIP.cruise))).toBe(null);
    expect(entering(inAir(first, OUT, OUT, SHIP.boost))).toBe(null);
  });

  it("doesn't take a ship above the air, or one sitting still in it", () => {
    expect(entering(inAir(first, OUT, scale(OUT, -1), SHIP.cruise, -0.2))).toBe(null);
    expect(entering(inAir(first, OUT, scale(OUT, -1), 0))).toBe(null);
  });

  it('never takes a ship into a station or the gate', () => {
    const airless = PLANETS.filter((p) => !LANDABLE.includes(p));
    expect(airless.some((p) => p.id === 'starwars')).toBe(true);
    for (const p of airless) {
      const s = flying(add(p.at, OUT, p.r * AIR - 0.05), scale(OUT, -1), SHIP.cruise);
      expect(entering(s), p.id).toBe(null);
    }
  });
});

describe('entryAhead', () => {
  // (the ship moved on along its way by t seconds)
  const after = (s, t) => {
    const v = velocityOf(s);
    return { ...s, x: s.x + v[0] * t, y: s.y + v[1] * t, z: s.z + v[2] * t };
  };

  it('is what entering() says once the ship gets there, holding its course', () => {
    const rand = seeded(11);
    let seen = 0;
    for (const p of LANDABLE) {
      for (let i = 0; i < 12; i++) {
        const n = randUnit(rand);
        // (out past the air, headed in at a slant, at cruise or at an approach's 9)
        const aim = unit(add(scale(n, -1), randUnit(rand), 0.6));
        const s = flying(add(p.at, n, airTop(p) + 0.5 + rand() * 5), aim, i % 2 ? SHIP.cruise : 9);
        const a = entryAhead(s, p, 10);
        if (!a) continue;
        seen++;
        expect(a.t, p.id).toBeGreaterThan(0);
        const e = entering(after(s, a.t * (1 + 1e-6)), [p]);
        expect(e, `${p.id} #${i}`).not.toBe(null);
        expect(a.kind).toBe(e.kind);
        expect(a.id).toBe(e.id);
        for (let k = 0; k < 3; k++) {
          expect(a.n[k]).toBeCloseTo(e.n[k], 5);
          expect(a.vel[k]).toBeCloseTo(e.vel[k], 9);
        }
        expect(a.h).toBeCloseTo(e.h, 4);
        expect(a.speed).toBeCloseTo(e.speed, 9);
        expect(a.sink).toBeCloseTo(e.sink, 4);
        // (and not a moment sooner)
        expect(entering(after(s, a.t * (1 - 1e-6)), [p])).toBe(null);
      }
    }
    expect(seen).toBeGreaterThan(LANDABLE.length * 6);
  });

  it('says how long till then', () => {
    const p = first;
    const s = flying(add(p.at, OUT, airTop(p) + 3), scale(OUT, -1), SHIP.cruise);
    expect(entryAhead(s, p).t).toBeCloseTo(3 / SHIP.cruise, 9);
    expect(entryAhead(s, p)).toMatchObject({ id: p.id, kind: 'enter' });
  });

  it("is null heading away, passing by, skimming in, getting there too late, or in the air already", () => {
    const p = first;
    const out = add(p.at, OUT, airTop(p) + 1);
    expect(entryAhead(flying(out, OUT, SHIP.cruise), p)).toBe(null);
    // (on a tangent past the air, and along its top)
    const along = flat([0, 1, 0], OUT);
    expect(entryAhead(flying(out, along, SHIP.cruise), p)).toBe(null);
    expect(entryAhead(flying(add(p.at, OUT, airTop(p)), along, SHIP.cruise), p)).toBe(null);
    // (only grazing it: in, but sinking slower than ENTRY.sink, as entering() won't take; a little steeper, it would)
    const top = add(p.at, OUT, airTop(p) + 1e-4);
    const graze = flying(top, unit(add(along, OUT, -(ENTRY.sink * 0.8) / SHIP.cruise)), SHIP.cruise);
    expect(entryAhead(graze, p)).toBe(null);
    expect(entering(after(graze, 0.01), [p])).toBe(null);
    expect(entryAhead(flying(top, unit(add(along, OUT, -(ENTRY.sink * 1.5) / SHIP.cruise)), SHIP.cruise), p)).toMatchObject({ kind: 'enter' });
    // (straight in, but 3 s away with 2 to look)
    expect(entryAhead(flying(add(p.at, OUT, airTop(p) + SHIP.cruise * 3), scale(OUT, -1), SHIP.cruise), p, 2)).toBe(null);
    expect(entryAhead(flying(add(p.at, OUT, airTop(p) + SHIP.cruise * 3), scale(OUT, -1), SHIP.cruise), p, 4)).not.toBe(null);
    // (already inside, and sitting still outside)
    expect(entryAhead(inAir(p, OUT, scale(OUT, -1), SHIP.cruise), p)).toBe(null);
    expect(entryAhead(flying(out, scale(OUT, -1), 0), p)).toBe(null);
  });

  it('calls it hot at the boost, as entering() does', () => {
    for (const p of LANDABLE) expect(entryAhead(flying(add(p.at, OUT, airTop(p) + 1), scale(OUT, -1), SHIP.boost), p), p.id).toMatchObject({ id: p.id, kind: 'hot' });
  });
});

describe('entryGuess', () => {
  it('is entryAhead’s word for a ship heading in at a speed it can land at', () => {
    const p = first;
    const s = flying(add(p.at, OUT, airTop(p) + 3), scale(OUT, -1), SHIP.cruise);
    expect(entryGuess(s, p)).toEqual(entryAhead(s, p));
  });

  it('foresees one boosting in at the speed it must slow to, where it would go in', () => {
    for (const p of LANDABLE) {
      const s = flying(add(p.at, OUT, airTop(p) + 1), scale(OUT, -1), SHIP.boost);
      const ahead = entryAhead(s, p);
      const g = entryGuess(s, p);
      expect(g, p.id).toMatchObject({ id: p.id, kind: 'hot', speed: ENTRY.fast, n: ahead.n, vel: ahead.vel });
    }
  });

  it('foresees one in the air too fast, or skimming it, from where it is', () => {
    const p = first;
    const hot = inAir(p, OUT, scale(OUT, -1), SHIP.boost);
    expect(entryAhead(hot, p)).toBe(null);
    expect(entryGuess(hot, p)).toMatchObject({ ...entering(hot, [p]), speed: ENTRY.fast });
    // (along the top, sinking slower than entering() takes: where it is now, at its own speed)
    const skim = inAir(p, OUT, flat([0, 1, 0], OUT), SHIP.cruise);
    expect(entering(skim, [p])).toBe(null);
    const g = entryGuess(skim, p);
    expect(g).toMatchObject({ id: p.id, kind: 'skim' });
    expect(g.speed).toBeCloseTo(SHIP.cruise, 9);
    for (let k = 0; k < 3; k++) expect(g.n[k]).toBeCloseTo(OUT[k], 9);
    expect(g.h).toBeCloseTo(airTop(p) - 0.2 - p.r, 9);
  });

  it('is null out of the air and not heading into it soon', () => {
    const p = first;
    expect(entryGuess(flying(add(p.at, OUT, airTop(p) + 1), OUT, SHIP.cruise), p)).toBe(null);
    expect(entryGuess(flying(add(p.at, OUT, airTop(p) + SHIP.cruise * 3), scale(OUT, -1), SHIP.cruise), p, 2)).toBe(null);
  });

  // (the way the HUD tells you: “Too fast to fly into …: ease off the boost”)
  it('follows a ship boosted in that eases off in the air, every frame till the air takes it, and near where it comes down', () => {
    // (the planets: a moon's air is too shallow to slow in from the boost)
    const planets = LANDABLE.filter((p) => p.r > 20);
    expect(planets.length).toBeGreaterThan(8);
    for (const p of planets) {
      const R = byId(p.id).size;
      // (a second out, in at a slant, at the boost; off it once in the air)
      const dir = unit(add(scale(OUT, -1), flat([0, 1, 0], OUT), 0.7));
      let s = flying(add(p.at, OUT, airTop(p) + SHIP.boost), dir, SHIP.boost);
      let boost = true;
      let took = null;
      let last = null;
      let blind = 0;
      let hot = 0;
      let said = 0;
      for (let i = 0; i < 600 && !took; i++) {
        const e = entering(s, [p]);
        if (e?.kind === 'enter') took = e;
        if (took) break;
        if (e?.kind === 'hot') hot++;
        if (entryAhead(s, p, 2)?.kind === 'enter') said++;
        const g = entryGuess(s, p, 2);
        if (g) last = g;
        else blind++;
        if (distTo(s, p) < airTop(p)) boost = false;
        s = step(s, { throttle: 1, boost }, 1 / 60).ship;
      }
      expect(took, p.id).not.toBe(null);
      expect(hot, p.id).toBeGreaterThan(0); // (it was in the air too fast a while)
      expect(said, p.id).toBe(0); // (and entryAhead never once called it a landing on the way)
      expect(blind, p.id).toBe(0);
      expect(last.speed, p.id).toBeLessThanOrEqual(ENTRY.fast);
      const guessed = entrySpot({ n: last.n, track: last.vel, speed: last.speed, R });
      const real = entrySpot({ n: took.n, track: took.vel, speed: took.speed, R });
      expect(angle(guessed.n, real.n), p.id).toBeLessThan(0.02);
      // (where the boost's speed would have put it: some 5° on, past a biome's edge)
      expect(angle(entrySpot({ n: last.n, track: last.vel, speed: SHIP.boost, R }).n, real.n), p.id).toBeGreaterThan(0.05);
    }
  });
});

describe('the crash still happens', () => {
  const crashOrBump = (events, id) => events.some((e) => (e.type === 'crash' || e.type === 'bump') && e.id === id);

  it('boosting into a planet goes through the air, hot all the way, and crashes', () => {
    for (const p of LANDABLE) {
      let s = { ...spawn(p.id), speed: SHIP.boost };
      expect(distTo(s, p), p.id).toBeGreaterThan(airTop(p)); // (starts outside the air)
      let crash = null;
      let hot = 0;
      for (let i = 0; i < 400 && !crash; i++) {
        const r = step(s, { throttle: 1, boost: true }, 0.05);
        s = r.ship;
        crash = r.events.find((e) => e.type === 'crash' && e.id === p.id) ?? null;
        const e = entering(s);
        expect(e?.kind, p.id).not.toBe('enter');
        // (the frame it hits, the scene starts the crash and asks nothing more)
        if (!crash && distTo(s, p) < airTop(p)) {
          expect(e, p.id).toMatchObject({ id: p.id, kind: 'hot' });
          hot++;
        }
      }
      expect(crash, p.id).not.toBe(null);
      expect(crash.speed).toBeGreaterThan(SHIP.crash);
      expect(hot, p.id).toBeGreaterThan(0); // the HUD had a frame to say so
    }
  });

  it('at cruise, the air takes the ship before it can touch the ground', () => {
    for (const p of LANDABLE) {
      let s = { ...spawn(p.id), speed: SHIP.cruise };
      const events = [];
      let e = null;
      for (let i = 0; i < 400 && !e; i++) {
        const r = step(s, { throttle: 1 }, 0.05);
        s = r.ship;
        events.push(...r.events);
        if (distTo(s, p) < airTop(p)) {
          e = entering(s);
          expect(e, p.id).toMatchObject({ id: p.id, kind: 'enter' }); // the first frame in it
        }
      }
      expect(e, p.id).not.toBe(null);
      expect(crashOrBump(events, p.id), p.id).toBe(false);
    }
  });
});

describe('entrySpot', () => {
  const R = 17;

  it('comes down ahead along the track, further the faster, within ENTRY.arc', () => {
    const rand = seeded(7);
    for (let i = 0; i < 300; i++) {
      const n = randUnit(rand);
      const ground = flat(randUnit(rand), n);
      const track = add(ground, n, -rand() * 2); // (going down, some)
      const speed = rand() * ENTRY.fast;
      const r = 15 + rand() * 5;
      const spot = entrySpot({ n, track, speed, R: r });
      expect(len(spot.n)).toBeCloseTo(1, 9);
      expect(dot(spot.n, ground)).toBeGreaterThan(0); // ahead
      const a = angle(n, spot.n);
      expect(a).toBeCloseTo(clamp((speed * ENTRY.glide * 0.5) / r, ENTRY.arc[0], ENTRY.arc[1]), 9);
      expect(a).toBeGreaterThanOrEqual(ENTRY.arc[0] - 1e-9);
      expect(a).toBeLessThanOrEqual(ENTRY.arc[1] + 1e-9);
      // heading along the ground, on away from where it went in
      expect(len(spot.f)).toBeCloseTo(1, 9);
      expect(dot(spot.f, spot.n)).toBeCloseTo(0, 9);
      expect(dot(spot.f, n)).toBeLessThan(0);
      expect(dot(cross(n, spot.n), cross(spot.n, spot.f))).toBeGreaterThan(0); // (the same great circle, the same way round)
    }
  });

  it('holds the arc at its least when slow and its most when fast', () => {
    const n = [0, 1, 0];
    expect(angle(n, entrySpot({ n, track: [1, -1, 0], speed: 0, R }).n)).toBeCloseTo(ENTRY.arc[0], 9);
    expect(angle(n, entrySpot({ n, track: [1, -1, 0], speed: 100, R }).n)).toBeCloseTo(ENTRY.arc[1], 9);
  });

  it('still finds a spot when the ship comes straight down', () => {
    const n = unit([0.2, 0.9, -0.3]);
    const spot = entrySpot({ n, track: scale(n, -4), speed: SHIP.cruise, R });
    expect(spot.n.every(Number.isFinite)).toBe(true);
    expect(len(spot.n)).toBeCloseTo(1, 9);
    expect(angle(n, spot.n)).toBeCloseTo((SHIP.cruise * ENTRY.glide * 0.5) / R, 9);
    expect(dot(spot.f, spot.n)).toBeCloseTo(0, 9);
    expect(len(spot.f)).toBeCloseTo(1, 9);
  });

  it('leans toward the day side, never by more than ENTRY.lean', () => {
    const rand = seeded(11);
    let leaned = 0;
    for (let i = 0; i < 300; i++) {
      const n = randUnit(rand);
      const track = flat(randUnit(rand), n);
      const light = randUnit(rand);
      const speed = rand() * ENTRY.fast;
      const plain = entrySpot({ n, track, speed, R });
      const lit = entrySpot({ n, track, light, speed, R });
      const lean = angle(plain.n, lit.n);
      expect(len(lit.n)).toBeCloseTo(1, 9);
      expect(len(lit.f)).toBeCloseTo(1, 9);
      expect(dot(lit.f, lit.n)).toBeCloseTo(0, 9);
      expect(lean).toBeLessThanOrEqual(ENTRY.lean + 1e-9);
      if (dot(plain.n, light) >= ENTRY.day) {
        expect(lean).toBeCloseTo(0, 9); // already in the day
      } else {
        leaned++;
        expect(dot(lit.n, light)).toBeGreaterThan(dot(plain.n, light));
        // as far as the day, unless that's more than it leans
        if (lean < ENTRY.lean - 1e-6) expect(dot(lit.n, light)).toBeCloseTo(ENTRY.day, 9);
      }
    }
    expect(leaned).toBeGreaterThan(50);
  });

  it("doesn't lean a spot that's already in the day", () => {
    const n = [0, 1, 0];
    const track = [1, 0, 0];
    const plain = entrySpot({ n, track, speed: SHIP.cruise, R });
    const lit = entrySpot({ n, track, light: plain.n, speed: SHIP.cruise, R });
    expect(angle(plain.n, lit.n)).toBeCloseTo(0, 9);
    expect(dot(plain.f, lit.f)).toBeCloseTo(1, 9);
  });
});

describe('entryPath', () => {
  const R = 17;
  const hE = R * (AIR - 1) - 0.1;
  const hH = 0.9;
  const rest = 0.12;
  const T = ENTRY.glide + ENTRY.settle;
  const samples = (path) => Array.from({ length: Math.round(T * 100) + 1 }, (_, i) => path.at(i / 100));

  const checkPath = (path, nE, nS, from = hE) => {
    expect(path.T).toBeCloseTo(T, 9);
    const start = path.at(0);
    const p0 = scale(nE, R + from);
    for (let i = 0; i < 3; i++) expect(start.p[i]).toBeCloseTo(p0[i], 9);
    const end = path.at(T);
    expect(end.done).toBe(true);
    expect(end.h).toBeCloseTo(rest, 9);
    expect(dot(end.n, nS)).toBeCloseTo(1, 9);
    expect(path.at(T - 0.01).done).toBe(false);
    let prev = null;
    for (const s of samples(path)) {
      expect([...s.n, ...s.p, s.h].every(Number.isFinite)).toBe(true);
      expect(len(s.n)).toBeCloseTo(1, 9);
      const p = scale(s.n, R + s.h);
      for (let i = 0; i < 3; i++) expect(s.p[i]).toBeCloseTo(p[i], 9);
      expect(s.h).toBeGreaterThanOrEqual(rest - 1e-9); // never under the ground
      expect(s.h).toBeLessThanOrEqual(from + 1e-9);
      if (prev) {
        expect(s.h).toBeLessThanOrEqual(prev.h + 1e-9); // never back up
        expect(angle(nE, s.n)).toBeGreaterThanOrEqual(angle(nE, prev.n) - 1e-7); // on over the ground, never back
        expect(angle(s.n, nS)).toBeLessThanOrEqual(angle(prev.n, nS) + 1e-7);
      }
      prev = s;
    }
  };

  it('starts where the ship went in, glides over the spot and settles onto it', () => {
    const nE = unit([0.3, 0.8, -0.5]);
    const spot = entrySpot({ n: nE, track: [1, -0.5, 0.2], speed: SHIP.cruise, R });
    const path = entryPath({ nE, hE, nS: spot.n, hH, rest, R });
    checkPath(path, nE, spot.n);
    // over the spot, at the hover height, by the end of the glide; then straight down
    const over = path.at(ENTRY.glide);
    expect(dot(over.n, spot.n)).toBeCloseTo(1, 9);
    expect(over.h).toBeCloseTo(hH, 9);
    expect(path.at(ENTRY.glide + 0.5).settling).toBe(true);
    expect(path.at(ENTRY.glide - 0.5).settling).toBe(false);
    expect(angle(path.at(ENTRY.glide + 0.5).n, spot.n)).toBeCloseTo(0, 9);
  });

  it('flies on at the speed it came in at (when the arc is not held)', () => {
    const nE = [0, 0, 1];
    const speed = SHIP.cruise;
    const spot = entrySpot({ n: nE, track: [1, 0, 0], speed, R });
    const path = entryPath({ nE, hE, nS: spot.n, hH, rest, R });
    const dt = 1e-4;
    expect((angle(nE, path.at(dt).n) * R) / dt).toBeCloseTo(speed, 2);
  });

  it('holds t to the path: before the start is the start, after the end the end', () => {
    const nE = [1, 0, 0];
    const nS = unit([1, 0.4, 0]);
    const path = entryPath({ nE, hE, nS, hH, rest, R });
    expect(path.at(-3)).toEqual(path.at(0));
    expect(path.at(T + 5)).toEqual(path.at(T));
    expect(path.at(T + 5).done).toBe(true);
  });

  it('goes round the planet when the spot is right the other side', () => {
    const nE = unit([0.2, -0.3, 0.9]);
    const nS = scale(nE, -1);
    const track = flat([1, 0, 0], nE);
    checkPath(entryPath({ nE, hE, nS, hH, rest, R, track }), nE, nS);
    // the way the ship was going
    const early = entryPath({ nE, hE, nS, hH, rest, R, track }).at(0.5).n;
    expect(dot(early, track)).toBeGreaterThan(0);
    // and with no track to go by, some way round
    checkPath(entryPath({ nE, hE, nS, hH, rest, R }), nE, nS);
  });

  it('comes straight down when the spot is where it went in', () => {
    const nE = unit([-0.4, 0.5, 0.2]);
    const path = entryPath({ nE, hE, nS: nE, hH, rest, R });
    checkPath(path, nE, nE);
    for (const s of samples(path)) expect(angle(s.n, nE)).toBeCloseTo(0, 9);
  });

  it('glides on level when it came in under the hover height, never back up to it', () => {
    const nE = unit([0.3, 0.8, -0.5]);
    const nS = entrySpot({ n: nE, track: [1, -0.5, 0.2], speed: SHIP.cruise, R }).n;
    const low = (hH + rest) / 2;
    const path = entryPath({ nE, hE: low, nS, hH, rest, R });
    checkPath(path, nE, nS, low);
    expect(path.at(ENTRY.glide).h).toBeCloseTo(low, 9);
  });

  it('parks at its height even when it came in lower than that, rising to it', () => {
    const nE = [0, 1, 0];
    const nS = unit([0.3, 1, 0]);
    const under = rest / 2;
    const path = entryPath({ nE, hE: under, nS, hH, rest, R });
    const p0 = scale(nE, R + under);
    for (let i = 0; i < 3; i++) expect(path.at(0).p[i]).toBeCloseTo(p0[i], 9);
    const end = path.at(T);
    expect(end.done).toBe(true);
    expect(end.h).toBeCloseTo(rest, 9); // (not with its hull in the ground)
    expect(dot(end.n, nS)).toBeCloseTo(1, 9);
    let prev = null;
    for (const s of samples(path)) {
      expect(s.h).toBeGreaterThanOrEqual(under - 1e-9);
      expect(s.h).toBeLessThanOrEqual(rest + 1e-9);
      if (prev) expect(s.h).toBeGreaterThanOrEqual(prev.h - 1e-9);
      prev = s;
    }
  });
});

describe('fxAt', () => {
  const T = ENTRY.glide + ENTRY.settle;
  const times = Array.from({ length: 801 }, (_, i) => -1 + (i / 800) * (T + 2));
  const peak = (key) => times.reduce((best, t) => (fxAt(t)[key] > fxAt(best)[key] ? t : best), times[0]);

  it('keeps everything between 0 and 1', () => {
    for (const t of times) {
      const fx = fxAt(t);
      for (const k of ['burn', 'cloud', 'white', 'sky', 'shake']) {
        expect(fx[k], `${k} at ${t}`).toBeGreaterThanOrEqual(0);
        expect(fx[k], `${k} at ${t}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is dark and still before the air, and clear sky after the glide', () => {
    expect(fxAt(0)).toEqual({ burn: 0, cloud: 0, white: 0, sky: 0, shake: 0, title: false });
    expect(fxAt(-1)).toEqual({ burn: 0, cloud: 0, white: 0, sky: 0, shake: 0, title: false });
    expect(fxAt(G + 0.01)).toEqual({ burn: 0, cloud: 0, white: 0, sky: 1, shake: 0, title: true });
    expect(fxAt(T + 3)).toEqual({ burn: 0, cloud: 0, white: 0, sky: 1, shake: 0, title: true });
  });

  it('burns hot early, then breaks into the clouds, then out under them', () => {
    expect(fxAt(0.5).burn).toBeCloseTo(1, 9);
    expect(fxAt(0.3 * G).burn).toBeCloseTo(1, 9);
    expect(fxAt(0.3 * G).cloud).toBe(0);
    const cloud = peak('cloud');
    expect(cloud).toBeGreaterThan(peak('burn'));
    expect(cloud).toBeLessThan(0.75 * G); // before the break-out
    expect(fxAt(cloud).cloud).toBeCloseTo(1, 2);
    expect(fxAt(cloud).burn).toBeLessThan(0.1);
  });

  it('whites out inside the clouds, at their thickest', () => {
    const white = peak('white');
    expect(fxAt(white).white).toBeCloseTo(0.85, 2);
    expect(fxAt(white).cloud).toBeGreaterThan(0.9);
    expect(fxAt(0.5 * G).white).toBe(0);
    expect(fxAt(0.76 * G).white).toBe(0);
  });

  it('brings the sky up from black over the glide', () => {
    expect(fxAt(0).sky).toBe(0);
    expect(fxAt(0.1 * G).sky).toBe(0);
    expect(fxAt(0.4 * G).sky).toBeGreaterThan(0.2);
    expect(fxAt(0.4 * G).sky).toBeLessThan(0.8);
    expect(fxAt(0.7 * G).sky).toBe(1);
    let prev = -1;
    for (const t of times) {
      expect(fxAt(t).sky).toBeGreaterThanOrEqual(prev);
      prev = fxAt(t).sky;
    }
  });

  it('shakes with the burn and the clouds, never past 1', () => {
    for (const t of times) {
      const fx = fxAt(t);
      expect(fx.shake).toBeCloseTo(Math.min(1, fx.burn * 0.6 + fx.cloud * 0.25), 9);
    }
    expect(fxAt(1).shake).toBeGreaterThan(0.5);
  });

  it('names the place once it breaks out under the clouds', () => {
    expect(fxAt(0.74 * G).title).toBe(false);
    expect(fxAt(0.75 * G).title).toBe(true);
    expect(fxAt(0.9 * G).title).toBe(true);
  });
});
