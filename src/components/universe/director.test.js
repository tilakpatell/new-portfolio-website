import { describe, expect, it } from 'vitest';
import { EVENTS, INTENSITY, PACE, canHave, createDirector, withWhere } from './director';
import { SIDES } from './sides';

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
    expect(run(createDirector({ rand: seeded() }), 1200, { side: null })).toHaveLength(0);
  });

  it('waits a while, then something happens every minute or two', () => {
    const got = run(createDirector({ rand: seeded() }), 1200, { side: SIDES.starwars });
    expect(got[0].t).toBeGreaterThanOrEqual(PACE.first[0]);
    expect(got[0].t).toBeLessThanOrEqual(PACE.first[1] + 0.5);
    for (let i = 1; i < got.length; i++) {
      const gap = got[i].t - got[i - 1].t;
      expect(gap).toBeGreaterThanOrEqual(PACE.gap[0] - 0.5);
      expect(gap).toBeLessThanOrEqual(PACE.gap[1] + 0.5);
    }
  });

  it('only brings what belongs in your universe, and never the same twice running', () => {
    for (const side of Object.values(SIDES)) {
      const got = run(createDirector({ rand: seeded(11) }), 6000, { side });
      expect(got.length).toBeGreaterThan(40);
      for (const { e } of got) expect(canHave(side, EVENTS[e]), `${side.id} ${e}`).toBe(true);
      for (let i = 1; i < got.length; i++) expect(got[i].e).not.toBe(got[i - 1].e);
      const kinds = new Set(got.map((g) => g.e));
      for (const id of ['hunt', 'distress', 'convoy', 'bounty', 'leviathan', 'minefield', 'escort']) expect(kinds.has(id), `${side.id} ${id}`).toBe(true);
      // (every side has a capital ship now: a Star Destroyer, a Federation cruiser, a Madrigal freighter)
      expect(kinds.has('destroyer'), side.id).toBe(true);
      // (and the Federation's NX-5 Planet Remover, Rick's universe's alone)
      expect(kinds.has('remover'), side.id).toBe(side.id === 'rickmorty');
      if (side.id === 'starwars') expect(!kinds.has('council') && !kinds.has('roadblock')).toBe(true);
      else if (side.id === 'rickmorty') expect(kinds.has('council') && !kinds.has('roadblock')).toBe(true);
      else expect(kinds.has('roadblock') && !kinds.has('council')).toBe(true);
    }
  });

  it('lays a minefield for any side, and brings an escort where there are pirates to come for it', () => {
    for (const side of Object.values(SIDES)) expect(canHave(side, EVENTS.minefield), side.id).toBe(true);
    expect(EVENTS.escort.needs).toBe('pirates');
    expect(canHave({ has: () => false }, EVENTS.escort)).toBe(false);
    expect(canHave({ has: () => false }, EVENTS.minefield)).toBe(true);
    for (const side of Object.values(SIDES)) expect(canHave(side, EVENTS.escort), side.id).toBe(side.has('pirates'));
  });

  it('brings an eclipse only where there is a sun to cross: not at a station, not in the gate', () => {
    for (const side of Object.values(SIDES)) {
      // (a side alone has no sun: it's where you are that has one)
      expect(canHave(side, EVENTS.eclipse), side.id).toBe(false);
      expect(canHave(withWhere(side, { sun: true }), EVENTS.eclipse), side.id).toBe(true);
      expect(canHave(withWhere(side, { sun: true, station: true }), EVENTS.eclipse), side.id).toBe(false);
      expect(canHave(withWhere(side, { sun: true, gate: true }), EVENTS.eclipse), side.id).toBe(false);
      expect(canHave(withWhere(side, { sun: false }), EVENTS.eclipse), side.id).toBe(false);
      // (and everything else as the side has it)
      expect(canHave(withWhere(side, { sun: true }), EVENTS.escort)).toBe(canHave(side, EVENTS.escort));
    }
    expect(withWhere(null, { sun: true })).toBeNull();
    const got = run(createDirector({ rand: seeded(11) }), 6000, { side: withWhere(SIDES.starwars, { sun: true }) });
    expect(got.some((g) => g.e === 'eclipse')).toBe(true);
  });

  it('holds off while something is going on, and comes sooner and angrier with heat', () => {
    expect(run(createDirector({ rand: seeded() }), 600, { side: SIDES.rickmorty, busy: true })).toHaveLength(0);
    const calm = run(createDirector({ rand: seeded(3) }), 6000, { side: SIDES.starwars, heat: 0 });
    const hot = run(createDirector({ rand: seeded(3) }), 6000, { side: SIDES.starwars, heat: 6 });
    expect(hot.length).toBeGreaterThan(calm.length * 1.5);
    const share = (got) => got.filter((g) => g.e === 'hunt' || g.e === 'destroyer').length / got.length;
    expect(share(hot)).toBeGreaterThan(share(calm));
  });

  it('comes sooner, and angrier, on the way somewhere', () => {
    const still = run(createDirector({ rand: seeded(5) }), 3000, { side: SIDES.starwars });
    const moving = run(createDirector({ rand: seeded(5) }), 3000, { side: SIDES.starwars, travelling: true });
    expect(moving.length).toBeGreaterThan(still.length * 1.5);
    const hunts = (got) => got.filter((g) => g.e === 'hunt' || g.e === 'destroyer').length / got.length;
    expect(hunts(moving)).toBeGreaterThan(hunts(still));
  });

  it('sends nobody after you while your shields are low', () => {
    const got = run(createDirector({ rand: seeded(7) }), 6000, { side: SIDES.starwars, heat: 6, travelling: true, calm: true });
    expect(got.length).toBeGreaterThan(10);
    expect(got.some((g) => g.e === 'hunt' || g.e === 'destroyer' || g.e === 'council' || g.e === 'roadblock')).toBe(false);
  });

  it('knows the meteors and the bounty hunter, and sends no bounty hunter while your shields are low', () => {
    expect(EVENTS.meteors.heat).toBe(0);
    expect(EVENTS.bounty.heat).toBeGreaterThan(0);
    expect(EVENTS.meteors.needs).toBeNull();
    for (const side of Object.values(SIDES)) expect(canHave(side, EVENTS.bounty), side.id).toBe(true);
    const got = run(createDirector({ rand: seeded(9) }), 6000, { side: SIDES.rickmorty, heat: 4, calm: true });
    expect(got.length).toBeGreaterThan(10);
    expect(got.some((g) => g.e === 'bounty')).toBe(false);
    const hot = run(createDirector({ rand: seeded(9) }), 6000, { side: SIDES.rickmorty, heat: 4 });
    expect(hot.some((g) => g.e === 'bounty')).toBe(true);
    expect(hot.some((g) => g.e === 'meteors')).toBe(true);
  });

  it('brings on what it is asked for next', () => {
    const d = createDirector({ rand: seeded() });
    d.soon('comet');
    expect(d.update(0.1, { side: SIDES.starwars })).toBe('comet');
    d.soon('council'); // not in Star Wars: ignored
    expect(d.update(0.1, { side: SIDES.starwars })).toBeNull();
  });

  it('knows the flare, the rift and the leviathans, for every crew, and none of them is trouble', () => {
    for (const id of ['flare', 'rift', 'leviathan']) {
      for (const side of Object.values(SIDES)) expect(canHave(side, EVENTS[id]), `${side.id} ${id}`).toBe(true);
      expect(EVENTS[id].heat).toBe(0);
    }
    const d = createDirector({ rand: seeded() });
    d.soon('rift');
    expect(d.update(0.1, { side: SIDES.rickmorty, calm: true })).toBe('rift');
  });

  it('can foretell what comes next, and then that is what comes, about when it said', () => {
    for (const side of Object.values(SIDES)) {
      const d = createDirector({ rand: seeded(5) });
      run(d, 10, { side });
      const told = d.foretell(side);
      expect(EVENTS[told.id], side.id).toBeTruthy();
      expect(canHave(side, EVENTS[told.id]), side.id).toBe(true);
      expect(told.in).toBeGreaterThan(0);
      // (asked again, the same answer)
      expect(d.foretell(side).id).toBe(told.id);
      const got = run(d, 200, { side });
      expect(got[0].e, side.id).toBe(told.id);
      expect(Math.abs(got[0].t - told.in), side.id).toBeLessThan(1);
    }
    expect(createDirector({ rand: seeded() }).foretell(null)).toBeNull();
  });

  it('picks only from the events it is given, when a map brings only some', () => {
    const events = { hunt: EVENTS.hunt, comet: EVENTS.comet };
    const got = run(createDirector({ rand: seeded(5), events }), 6000, { side: SIDES.starwars });
    expect(got.length).toBeGreaterThan(40);
    for (const { e } of got) expect(['hunt', 'comet']).toContain(e);
    // (asked for one it wasn't given, it brings nothing of the kind)
    const d = createDirector({ rand: seeded(5), events });
    d.soon('rift');
    expect(run(d, 600, { side: SIDES.starwars }).map((g) => g.e)).not.toContain('rift');
  });
});

describe('the law on your back', () => {
  it('sends more hunts after a pilot the law wants', () => {
    const quiet = run(createDirector({ rand: seeded(21) }), 6000, { side: SIDES.starwars });
    const wanted = run(createDirector({ rand: seeded(21) }), 6000, { side: SIDES.starwars, wanted: true });
    const share = (got) => got.filter((g) => g.e === 'hunt' || g.e === 'destroyer' || g.e === 'bounty').length / got.length;
    expect(share(wanted)).toBeGreaterThan(share(quiet) * 1.3);
    // (and not while your shields are low)
    const calm = run(createDirector({ rand: seeded(21) }), 3000, { side: SIDES.starwars, wanted: true, calm: true });
    expect(calm.some((g) => g.e === 'hunt')).toBe(false);
  });
});

describe('the drama’s pace', () => {
  it('holds off past a peak of intensity, then gives a breather once it has fallen, and carries on', () => {
    // a hammering from 100 s to 112 s: 40 damage a frame
    const hurt = (t) => (t > 100 && t < 112 ? 40 : 0);
    const d = createDirector({ rand: seeded(2) });
    const got = run(d, 400, (t) => ({ side: SIDES.starwars, hurt: hurt(t) }));
    const d2 = createDirector({ rand: seeded(2) });
    const quiet = run(d2, 400, { side: SIDES.starwars });
    // nothing comes while it's hot, nor in the breather after
    expect(got.some((g) => g.t > 100 && g.t < 112 + INTENSITY.relax)).toBe(false);
    expect(got.filter((g) => g.t > 140).length).toBeGreaterThan(0);
    expect(quiet.length).toBeGreaterThan(got.length);
    expect(d.intensity).toBeLessThan(INTENSITY.low);
    // kills count too: heat going up
    const d3 = createDirector({ rand: seeded(2) });
    let before = 0;
    for (let i = 0; i < 6; i++) d3.update(0.5, { side: SIDES.starwars, heat: i, hurt: 0 });
    before = d3.intensity;
    expect(before).toBeGreaterThan(INTENSITY.kill * 3);
  });
});
