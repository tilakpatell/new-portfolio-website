import { describe, expect, it } from 'vitest';
import { pushOut } from '../../middleearth/towns/walker';
import { COLLIDERS, WALLS, WORLD, crowdColliders, inPen } from './layout';
import { PLACES, SCHEDULES, citadelHour, createConcourse } from './ambient';

const DT = 1 / 30;
const KINDS = ['rick', 'constructionrick', 'daycare', 'suitrick', 'detectiverick', 'daycare', 'sweaterrick'];
const run = (c, secs, { from = 0, rick = null, mood = 'day', each } = {}) => {
  for (let t = from; t < from + secs; t += DT) {
    const r = typeof rick === 'function' ? rick(t) : rick;
    const ps = c.step(t, DT, { rick: r, mood });
    each?.(ps, t);
  }
};
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

describe('the concourse’s people', () => {
  it('start round the old loops, the same for the same seed', () => {
    const a = createConcourse({ kinds: KINDS, seed: 3 });
    const b = createConcourse({ kinds: KINDS, seed: 3 });
    expect(a.people.map((p) => [p.x, p.z])).toEqual(b.people.map((p) => [p.x, p.z]));
    run(a, 20);
    run(b, 20);
    expect(a.people.map((p) => [p.x, p.z, p.mode])).toEqual(b.people.map((p) => [p.x, p.z, p.mode]));
  });

  it('keep out of everything on the concourse, the pen and the crowds, and on it', () => {
    const c = createConcourse({ kinds: KINDS, seed: 1 });
    const walls = crowdColliders('day');
    run(c, 240, {
      each: (ps) => {
        for (const p of ps) {
          if (p.base === 'sit' || p.seated) continue; // (sat on a bench, which is a collider)
          const [x, z] = pushOut(p.x, p.z, 0.22, [...COLLIDERS, ...walls], WALLS);
          expect(Math.hypot(x - p.x, z - p.z)).toBeLessThan(0.12);
          expect(Math.hypot(p.x, p.z)).toBeLessThan(WORLD.radius);
          expect(inPen(p.x, p.z)).toBe(false);
        }
      },
    });
  });

  it('never put more at a place than it has room for', () => {
    const c = createConcourse({ kinds: [...KINDS, ...KINDS], seed: 5 });
    run(c, 300, {
      each: (ps) => {
        const at = new Map();
        for (const p of ps) if (p.mode === 'use') at.set(p.place, (at.get(p.place) ?? 0) + 1);
        for (const [id, n] of at) expect(n).toBeLessThanOrEqual(PLACES.find((q) => q.id === id).slots);
      },
    });
  });

  it('go somewhere and do what’s done there: sit on a bench, work a shift, look at the city', () => {
    const c = createConcourse({ kinds: [...KINDS, ...KINDS], seed: 2 });
    const used = new Set();
    let sat = false;
    run(c, 600, {
      each: (ps) => {
        for (const p of ps)
          if (p.mode === 'use') {
            used.add(p.place);
            if (p.base === 'sit') sat = true;
          }
      },
    });
    expect(used.size).toBeGreaterThan(3);
    expect(sat).toBe(true);
  });

  it('send the wafer-line Ricks to Simple Rick’s in their shift, and not after it', () => {
    expect(citadelHour(0)).toBeCloseTo(8, 6);
    const goesTo = (from) => {
      const c = createConcourse({ kinds: ['constructionrick'], seed: 4 });
      const seen = new Set();
      run(c, 12, { from, each: (ps) => ps[0].place && seen.add(PLACES.find((q) => q.id === ps[0].place).need) });
      return seen;
    };
    expect(SCHEDULES.worker.some((s) => s.want === 'work')).toBe(true);
    expect(goesTo(0).has('work')).toBe(true); // (8 in the morning)
    // (9 at night: the shift's over)
    const night = (21 - 8) * 30;
    expect(goesTo(night).has('work')).toBe(false);
  });

  it('turn their corners, never snap round', () => {
    const c = createConcourse({ kinds: KINDS, seed: 7 });
    let last = c.people.map((p) => p.yaw);
    let worst = 0;
    run(c, 120, {
      each: (ps) => {
        ps.forEach((p, i) => (worst = Math.max(worst, Math.abs(wrap(p.yaw - last[i])))));
        last = ps.map((p) => p.yaw);
      },
    });
    expect(worst).toBeLessThan(0.6);
  });

  it('walk a Morty with his Rick', () => {
    const c = createConcourse({ kinds: ['rick', 'daycare'], seed: 2 });
    const [rick, morty] = c.people;
    expect(morty.leader).toBe(rick.id);
    let far = 0;
    let n = 0;
    run(c, 90, {
      from: 10,
      each: () => {
        far += Math.hypot(morty.x - rick.x, morty.z - rick.z);
        n++;
      },
    });
    expect(far / n).toBeLessThan(3.5);
  });

  it('step out of Rick’s way, and look at him', () => {
    const c = createConcourse({ kinds: ['suitrick'], seed: 9 });
    const p = c.people[0];
    // (stood still, half way along the core's north side)
    Object.assign(p, { x: 0, z: -9, speed: 0 });
    p.hold = 99; // (he stays put, but for Rick)
    let looked = false;
    let rick = { x: -4, z: -9, face: 0, speed: 3.4 };
    run(c, 1.2, {
      rick: () => rick,
      each: (ps) => {
        if (ps[0].look && Math.hypot(ps[0].look.x - rick.x, ps[0].look.z - rick.z) < 0.5) looked = true;
        rick = { ...rick, x: rick.x + 3.4 * DT };
      },
    });
    expect(Math.abs(p.z + 9)).toBeGreaterThan(0.7);
    expect(looked).toBe(true);
  });

  it('stop and talk, two who want company, taking turns', () => {
    const c = createConcourse({ kinds: ['rick', 'suitrick', 'sweaterrick', 'detectiverick'], seed: 11, start: { company: 0.9 } });
    let talked = false;
    let listened = false;
    run(c, 120, {
      each: (ps) => {
        for (const p of ps) {
          if (p.mode === 'talk' && p.talk) talked = true;
          if (p.mode === 'listen') listened = true;
        }
      },
    });
    expect(talked).toBe(true);
    expect(listened).toBe(true);
  });
});
