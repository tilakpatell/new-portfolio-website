import { describe, expect, it } from 'vitest';
import { CRIMES, LOSE_SIGHT, REPORT, RESPONSE, SEARCH, SEARCH_ZONE, STARS, bountyTier, createWanted } from './wanted';

const memory = (init = {}) => {
  const m = { ...init };
  return { m, get: (k, f = null) => (k in m ? JSON.parse(JSON.stringify(m[k])) : f), set: (k, v) => (m[k] = JSON.parse(JSON.stringify(v))) };
};
const at = (x = 0, y = 0, z = 0) => ({ x, y, z });
const types = (events) => events.map((e) => e.type);
// ticks for `seconds`, seen or not, at a place
const wait = (w, seconds, opts = {}, dt = 0.1) => {
  const out = [];
  for (let t = 0; t < seconds; t += dt) out.push(...w.tick(dt, { at: at(), ...opts }));
  return out;
};

describe('wanted', () => {
  it('starts clean, and counts nothing without a side', () => {
    const w = createWanted();
    expect(w.crime('killCivil', { seen: true, at: at() })).toEqual([]);
    w.side('starwars');
    expect(w.stars).toBe(0);
    expect(w.bounty).toBe(0);
    expect(w.phase).toBe('clear');
    expect(w.response()).toBeNull();
  });

  it('puts stars and a bounty on a crime the law sees, at once', () => {
    const w = createWanted();
    w.side('starwars');
    const ev = w.crime('killPatrol', { seen: true, at: at(5, 0, 0) });
    expect(types(ev)).toEqual(expect.arrayContaining(['wanted', 'bounty']));
    expect(w.stars).toBe(CRIMES.killPatrol.stars);
    expect(w.bounty).toBe(CRIMES.killPatrol.bounty);
    expect(w.phase).toBe('pursuit');
    expect(w.lastSeen).toEqual(at(5, 0, 0));
    expect(w.response()).toBe(RESPONSE[w.stars]);
  });

  it('climbs with every crime, more stars for worse ones, never past five', () => {
    const w = createWanted();
    w.side('rickmorty');
    w.crime('shotLaw', { seen: true, at: at() });
    expect(w.stars).toBe(1);
    for (let i = 0; i < 3; i++) w.crime('killCop', { seen: true, at: at() });
    expect(w.stars).toBe(2); // (a third of a star a cop)
    w.crime('capitalKill', { seen: true, at: at() });
    expect(w.stars).toBe(STARS);
    for (let i = 0; i < 10; i++) w.crime('killCop', { seen: true, at: at() });
    expect(w.stars).toBe(STARS);
  });

  it('counts nothing nobody saw', () => {
    const w = createWanted();
    w.side('starwars');
    expect(w.crime('killCivil', { at: at() })).toEqual([]);
    expect(w.stars).toBe(0);
    expect(w.bounty).toBe(0);
  });

  it('lets a witness report you, unless you silence them or leave them behind first', () => {
    const reported = createWanted();
    reported.side('starwars');
    const a = {};
    const b = {};
    const ev = reported.crime('killCivil', { witnesses: [a, b], at: at() });
    expect(ev).toEqual([expect.objectContaining({ type: 'witness', n: 2 })]);
    expect(reported.stars).toBe(0);
    expect(reported.report.left).toBeCloseTo(REPORT, 6);
    const got = wait(reported, REPORT + 0.2, { witnesses: [a, b] });
    expect(types(got)).toContain('reported');
    expect(reported.stars).toBe(CRIMES.killCivil.stars);
    expect(reported.report).toBeNull();

    const silenced = createWanted();
    silenced.side('starwars');
    silenced.crime('killCivil', { witnesses: [a, b], at: at() });
    wait(silenced, 2, { witnesses: [a, b] });
    const out = wait(silenced, 1, { witnesses: [] }); // (both shot down, or left far behind)
    expect(types(out)).toContain('silenced');
    wait(silenced, REPORT, { witnesses: [] });
    expect(silenced.stars).toBe(0);
    expect(silenced.bounty).toBe(0);
  });

  it('heaps a second crime onto a report already on its way', () => {
    const w = createWanted();
    w.side('starwars');
    const a = {};
    w.crime('killCivil', { witnesses: [a], at: at() });
    w.crime('killCivil', { witnesses: [a], at: at() });
    wait(w, REPORT + 0.2, { witnesses: [a] });
    expect(w.bounty).toBe(CRIMES.killCivil.bounty * 2);
    expect(w.stars).toBe(Math.floor(CRIMES.killCivil.stars + 2 * CRIMES.killCivil.add));
  });

  it('searches where it last saw you once it loses sight of you, and finds you again if it sees you', () => {
    const w = createWanted();
    w.side('starwars');
    w.crime('killPatrol', { seen: true, at: at() });
    wait(w, LOSE_SIGHT - 0.3, { seen: false });
    expect(w.phase).toBe('pursuit');
    const out = wait(w, 0.5, { seen: false });
    expect(types(out)).toContain('search');
    expect(w.phase).toBe('search');
    expect(w.searchLeft).toBeGreaterThan(0);
    const back = wait(w, 0.2, { seen: true, at: at(3, 0, 0) });
    expect(types(back)).toContain('resighted');
    expect(w.phase).toBe('pursuit');
    expect(w.lastSeen).toEqual(at(3, 0, 0));
  });

  it('lets the stars go once you have stayed hidden long enough, sooner out of the zone they search, and keeps the bounty', () => {
    const lose = (where) => {
      const w = createWanted();
      w.side('starwars');
      w.crime('killPatrol', { seen: true, at: at() });
      let t = 0;
      while (w.stars > 0 && t < 200) {
        w.tick(0.1, { seen: false, at: where });
        t += 0.1;
      }
      return { t, w };
    };
    const near = lose(at(5, 0, 0));
    const far = lose(at(SEARCH_ZONE + 20, 0, 0));
    expect(near.w.stars).toBe(0);
    expect(near.w.phase).toBe('clear');
    expect(near.t).toBeGreaterThan(SEARCH[2] + LOSE_SIGHT - 0.5);
    expect(far.t).toBeLessThan(near.t * 0.75);
    expect(near.w.bounty).toBe(CRIMES.killPatrol.bounty); // (the bounty stays)
  });

  it('searches longer on a harder setting', () => {
    const time = (search) => {
      const w = createWanted();
      w.side('starwars');
      w.crime('killPatrol', { seen: true, at: at() });
      let t = 0;
      while (w.stars > 0 && t < 300) {
        w.tick(0.1, { seen: false, at: at(), search });
        t += 0.1;
      }
      return t;
    };
    expect(time(1.8)).toBeGreaterThan(time(1) * 1.4);
  });

  it('responds harder with every star', () => {
    expect(RESPONSE[0]).toBeNull();
    for (let s = 2; s <= STARS; s++) {
      const a = RESPONSE[s - 1];
      const b = RESPONSE[s];
      expect(b.every).toBeLessThanOrEqual(a.every);
      expect(b.max).toBeGreaterThanOrEqual(a.max);
      expect(b.skill).toBeGreaterThanOrEqual(a.skill);
      expect(b.units.length).toBeGreaterThanOrEqual(a.units.length);
    }
    expect(RESPONSE[STARS].boss).toBe(true);
    expect(RESPONSE[1].interdict).toBeFalsy();
    expect(RESPONSE[3].interdict).toBe(true);
  });

  it('keeps the bounty per side, across visits, and takes it paid off out of the wallet', () => {
    const storage = memory();
    const w = createWanted({ storage });
    w.side('breakingbad');
    w.crime('killPatrol', { seen: true, at: at() });
    const again = createWanted({ storage });
    again.side('breakingbad');
    expect(again.bounty).toBe(CRIMES.killPatrol.bounty);
    expect(again.stars).toBe(0); // (the chase was that visit's)
    again.side('starwars');
    expect(again.bounty).toBe(0);
    again.side('breakingbad');
    // not enough to cover it
    expect(again.payOff(100)).toEqual([expect.objectContaining({ type: 'short', need: CRIMES.killPatrol.bounty - 100 })]);
    expect(again.payOff()).toEqual([expect.objectContaining({ type: 'short', need: CRIMES.killPatrol.bounty })]);
    expect(again.bounty).toBe(CRIMES.killPatrol.bounty);
    expect(again.payOff(1000)).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'paid', amount: CRIMES.killPatrol.bounty }), expect.objectContaining({ type: 'bounty', bounty: 0 })]));
    expect(again.bounty).toBe(0);
    expect(createWanted({ storage }).bounty).toBe(0); // (no side yet)
    const third = createWanted({ storage });
    third.side('breakingbad');
    expect(third.bounty).toBe(0);
  });

  it('will not take payment while the law is after you', () => {
    const w = createWanted();
    w.side('starwars');
    w.crime('killPatrol', { seen: true, at: at() });
    expect(w.payOff(5000)).toEqual([expect.objectContaining({ type: 'chased' })]);
    expect(w.bounty).toBeGreaterThan(0);
  });

  it('clears the stars when you go down, and the bounty stays', () => {
    const w = createWanted();
    w.side('starwars');
    w.crime('capitalKill', { seen: true, at: at() });
    expect(types(w.clear())).toContain('wanted');
    expect(w.stars).toBe(0);
    expect(w.phase).toBe('clear');
    expect(w.bounty).toBe(CRIMES.capitalKill.bounty);
  });

  it('reads anything broken in storage as nothing', () => {
    const w = createWanted({ storage: memory({ 'tp:universe-wanted': { starwars: { bounty: 'lots' } } }) });
    w.side('starwars');
    expect(w.bounty).toBe(0);
  });

  it('sorts a bounty into tiers, the top one the Most Wanted', () => {
    expect(bountyTier(0)).toBe(0);
    expect(bountyTier(299)).toBe(0);
    expect(bountyTier(300)).toBe(1);
    expect(bountyTier(1200)).toBe(2);
    expect(bountyTier(3000)).toBe(3);
  });
});
