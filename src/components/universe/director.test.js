import { describe, expect, it } from 'vitest';
import { EVENTS, PACE, createDirector } from './director';

// a seeded random, so a run is the same every time
const seeded = (seed = 7) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const run = (d, seconds, state, dt = 0.5) => {
  const got = [];
  for (let t = 0; t < seconds; t += dt) {
    const e = d.update(dt, typeof state === 'function' ? state(t) : state);
    if (e) got.push({ t, e });
  }
  return got;
};

describe('the director', () => {
  it('does nothing without a ship', () => {
    expect(run(createDirector({ rand: seeded() }), 1200, { family: null })).toHaveLength(0);
  });

  it('waits a while, then something happens every minute or two', () => {
    const got = run(createDirector({ rand: seeded() }), 1200, { family: 'starwars' });
    expect(got[0].t).toBeGreaterThanOrEqual(PACE.first[0]);
    expect(got[0].t).toBeLessThanOrEqual(PACE.first[1] + 0.5);
    for (let i = 1; i < got.length; i++) {
      const gap = got[i].t - got[i - 1].t;
      expect(gap).toBeGreaterThanOrEqual(PACE.gap[0] - 0.5);
      expect(gap).toBeLessThanOrEqual(PACE.gap[1] + 0.5);
    }
  });

  it('only brings what belongs in your universe, and never the same twice running', () => {
    for (const family of ['starwars', 'rickmorty']) {
      const got = run(createDirector({ rand: seeded(11) }), 6000, { family });
      expect(got.length).toBeGreaterThan(40);
      for (const { e } of got) expect(EVENTS[e].families, e).toContain(family);
      for (let i = 1; i < got.length; i++) expect(got[i].e).not.toBe(got[i - 1].e);
      const kinds = new Set(got.map((g) => g.e));
      if (family === 'starwars') expect(kinds.has('destroyer') && !kinds.has('council')).toBe(true);
      else expect(kinds.has('council') && !kinds.has('destroyer')).toBe(true);
    }
  });

  it('holds off while something is going on, and comes sooner and angrier with heat', () => {
    expect(run(createDirector({ rand: seeded() }), 600, { family: 'rickmorty', busy: true })).toHaveLength(0);
    const calm = run(createDirector({ rand: seeded(3) }), 6000, { family: 'starwars', heat: 0 });
    const hot = run(createDirector({ rand: seeded(3) }), 6000, { family: 'starwars', heat: 6 });
    expect(hot.length).toBeGreaterThan(calm.length * 1.5);
    const share = (got) => got.filter((g) => g.e === 'hunt' || g.e === 'destroyer').length / got.length;
    expect(share(hot)).toBeGreaterThan(share(calm));
  });

  it('comes sooner, and angrier, on the way somewhere', () => {
    const still = run(createDirector({ rand: seeded(5) }), 3000, { family: 'starwars' });
    const moving = run(createDirector({ rand: seeded(5) }), 3000, { family: 'starwars', travelling: true });
    expect(moving.length).toBeGreaterThan(still.length * 1.5);
    const hunts = (got) => got.filter((g) => g.e === 'hunt' || g.e === 'destroyer').length / got.length;
    expect(hunts(moving)).toBeGreaterThan(hunts(still));
  });

  it('sends nobody after you while your shields are low', () => {
    const got = run(createDirector({ rand: seeded(7) }), 6000, { family: 'starwars', heat: 6, travelling: true, calm: true });
    expect(got.length).toBeGreaterThan(10);
    expect(got.some((g) => g.e === 'hunt' || g.e === 'destroyer' || g.e === 'council')).toBe(false);
  });

  it('knows the meteors and the bounty hunter, and sends no bounty hunter while your shields are low', () => {
    expect(EVENTS.meteors.heat).toBe(0);
    expect(EVENTS.bounty.heat).toBeGreaterThan(0);
    for (const id of ['meteors', 'bounty']) expect(EVENTS[id].families).toEqual(['starwars', 'rickmorty', 'both']);
    const got = run(createDirector({ rand: seeded(9) }), 6000, { family: 'rickmorty', heat: 4, calm: true });
    expect(got.length).toBeGreaterThan(10);
    expect(got.some((g) => g.e === 'bounty')).toBe(false);
    const hot = run(createDirector({ rand: seeded(9) }), 6000, { family: 'rickmorty', heat: 4 });
    expect(hot.some((g) => g.e === 'bounty')).toBe(true);
    expect(hot.some((g) => g.e === 'meteors')).toBe(true);
  });

  it('brings on what it is asked for next', () => {
    const d = createDirector({ rand: seeded() });
    d.soon('comet');
    expect(d.update(0.1, { family: 'starwars' })).toBe('comet');
    d.soon('council'); // not in Star Wars: ignored
    expect(d.update(0.1, { family: 'starwars' })).toBeNull();
  });

  it('knows the flare, the rift and the leviathans, for every crew, and none of them is trouble', () => {
    for (const id of ['flare', 'rift', 'leviathan']) {
      expect(EVENTS[id].families).toEqual(['starwars', 'rickmorty', 'both']);
      expect(EVENTS[id].heat).toBe(0);
    }
    const d = createDirector({ rand: seeded() });
    d.soon('rift');
    expect(d.update(0.1, { family: 'rickmorty', calm: true })).toBe('rift');
  });
});
