import { describe, expect, it } from 'vitest';
import { BELIEVE, DAY, EVENT_FIRST, EVENT_MIN_GAP, SUNDOWN, createFlightDirector } from './director';
import { EVENTS, EVENT_KINDS, WEATHER, WORLD_EVENTS } from './eventTables';
import { OCC } from './occurrences';
import { PLANETS, eventsFor, lifeFor, planetSpecOf } from './fixtures/expanse.js';
import { isDead } from './lifeTables';

const T0 = 1_790_000_000_000; // ms: a wall clock, fixed
const hoth = planetSpecOf('hoth');
const here = { at: [1024, 1024], cell: '0,0', biomes: ['plains'] };

// a director on a clock the test moves
function rig(spec = hoth, more = {}) {
  const clock = { t: T0 };
  const d = createFlightDirector({ spec, now: () => clock.t, ...more });
  const run = (secs, ctx = here, step = 1) => {
    const out = { begun: [], ended: [] };
    for (let s = 0; s < secs; s += step) {
      clock.t += step * 1000;
      const r = d.update(step, ctx);
      out.begun.push(...r.begun);
      out.ended.push(...r.ended);
    }
    return out;
  };
  return { d, clock, run };
}

describe('the event tables', () => {
  it('names only known kinds, each over within four minutes, its cooldown at least its ttl', () => {
    for (const k of EVENT_KINDS) {
      expect(EVENTS[k].ttl).toBeLessThan(240);
      expect(EVENTS[k].cooldown).toBeGreaterThanOrEqual(EVENTS[k].ttl);
    }
    for (const [id, rows] of Object.entries(WORLD_EVENTS)) {
      for (const r of rows) {
        expect(EVENTS[r.kind], `${id} ${r.kind}`).toBeTruthy();
        expect(r.line, id).toMatch(/^[A-Z].*[.!]$/);
        expect(r.line, id).not.toMatch(/['"]/);
        expect(r.ttl ?? EVENTS[r.kind].ttl).toBeLessThan(240);
      }
      // (every named world has its occurrences and its events)
      expect(OCC[id], id).toBeTruthy();
    }
  });

  it('gives all fifty worlds their events, and a dead one only the weather', () => {
    expect(PLANETS.length).toBe(50);
    for (const p of PLANETS) {
      const spec = planetSpecOf(p.id);
      const list = eventsFor(spec);
      expect(list.length, p.id).toBeGreaterThan(0);
      if (isDead(lifeFor(spec))) for (const e of list) expect(WEATHER.has(e.play), `${p.id} ${e.kind}`).toBe(true);
    }
  });
});

describe('the director', () => {
  it('rolls nothing in the first minute', () => {
    const { run } = rig();
    expect(run(EVENT_FIRST - 1).begun).toEqual([]);
  });

  it('rolls something before long, one at a time, each over by its ttl, with a gap between', () => {
    const { d, run } = rig();
    const begun = [];
    const ended = [];
    for (let i = 0; i < 3600; i++) {
      const r = run(1);
      begun.push(...r.begun.map((e) => ({ ...e, at0: i })));
      ended.push(...r.ended.map((e) => ({ ...e, at0: i })));
      expect(d.active() ? 1 : 0).toBeLessThanOrEqual(1);
    }
    expect(begun.length).toBeGreaterThan(3);
    for (let k = 1; k < begun.length; k++) {
      const prevEnd = ended.find((e) => e.id === begun[k - 1].id);
      expect(prevEnd).toBeTruthy();
      expect(begun[k].at0 - prevEnd.at0).toBeGreaterThanOrEqual(EVENT_MIN_GAP);
    }
    for (const e of ended) expect(e.at0 - begun.find((b) => b.id === e.id).at0).toBeLessThanOrEqual(e.ttl + 1);
  });

  it('rolls the same for two pilots in one cell', () => {
    const a = rig();
    const b = rig();
    const ra = a.run(1800);
    const rb = b.run(1800);
    expect(ra.begun.map((e) => e.id)).toEqual(rb.begun.map((e) => e.id));
    expect(ra.begun.length).toBeGreaterThan(0);
  });

  it('keeps to what the night and the ground allow', () => {
    // (no eruption on Mustafar with no volcanoes round you)
    const { run } = rig(planetSpecOf('mustafar'));
    const got = run(3 * 3600, { ...here, biomes: ['fields'] }, 5).begun;
    expect(got.length).toBeGreaterThan(0);
    expect(got.some((e) => e.kind === 'eruption')).toBe(false);
    const hot = rig(planetSpecOf('mustafar')).run(3 * 3600, { ...here, biomes: ['volcanoes'] }, 5).begun;
    expect(hot.some((e) => e.kind === 'eruption')).toBe(true);
    // (Naboo's festival only after dark)
    const n = rig(planetSpecOf('naboo'));
    for (let i = 0; i < 3 * 3600; i += 5) {
      const r = n.run(5);
      for (const e of r.begun) if (e.kind === 'festival') expect(n.d.clock().night).toBe(true);
    }
  });

  it('two pilots who rolled differently agree on the earlier one', () => {
    const a = rig();
    const b = rig();
    a.run(EVENT_FIRST);
    b.run(EVENT_FIRST);
    const ea = a.d.force('blizzard');
    b.clock.t += 2000;
    const eb = b.d.force('hunt');
    expect(ea.id < eb.id).toBe(true);
    // (a fake room: each hears the other's announcement)
    expect(a.d.receive(b.d.wire(eb))).toBe(false);
    expect(b.d.receive(a.d.wire(ea))).toBe(true);
    expect(a.d.active().id).toBe(ea.id);
    expect(b.d.active().id).toBe(ea.id);
    // (b's own is ended at its next update, and never taken up again)
    expect(b.run(1).ended.map((e) => e.id)).toContain(eb.id);
    expect(b.d.receive(b.d.wire(eb))).toBe(false);
  });

  it('believes a peer only with a known kind, near, and still running', () => {
    const { d, run } = rig();
    run(1);
    const ev = { id: '1790000000:blizzard:0,0', kind: 'blizzard', at: [1000, 1000], t: 5, seed: 3 };
    expect(d.receive({ ...ev, kind: 'eruption' })).toBe(false);
    expect(d.receive({ ...ev, at: [1024 + BELIEVE + 10, 1024] })).toBe(false);
    expect(d.receive({ ...ev, t: EVENTS.blizzard.ttl + 1 })).toBe(false);
    expect(d.receive(ev)).toBe(true);
    expect(d.active().t0).toBeCloseTo(T0 / 1000 + 1 - 5);
    // (believed, it ends on time here too)
    expect(run(EVENTS.blizzard.ttl).ended.map((e) => e.id)).toContain(ev.id);
  });

  it('drops a later one of the same kind within its cooldown', () => {
    const { d, run } = rig();
    run(1);
    expect(d.receive({ id: '1790000000:blizzard:0,0', kind: 'blizzard', at: [1000, 1000], t: 80, seed: 1 })).toBe(true);
    run(15);
    expect(d.active()).toBe(null);
    expect(d.receive({ id: '1790000100:blizzard:1,0', kind: 'blizzard', at: [1000, 1000], t: 1, seed: 1 })).toBe(false);
  });

  it('brings the Purge at sundown, once a visit, never by day', () => {
    const spec = planetSpecOf('purge');
    const { d, run } = rig(spec);
    const purges = [];
    for (let i = 0; i < DAY * 2.5; i += 2) {
      const r = run(2, here, 2);
      for (const e of r.begun) {
        if (e.kind !== 'purge') continue;
        purges.push(e);
        const c = d.clock();
        expect(c.night).toBe(true);
        expect(c.phase).toBeGreaterThanOrEqual(SUNDOWN);
      }
    }
    expect(purges).toHaveLength(1);
    expect(purges[0].ttl).toBe(180);
  });

  it('tells a pilot who arrives mid-Purge, and starts it part-way for one alone', () => {
    const spec = planetSpecOf('purge');
    const a = rig(spec);
    // (fly until the Purge is on)
    while (!(a.d.active()?.kind === 'purge')) a.run(5, here, 5);
    a.run(30);
    const b = rig(spec);
    b.clock.t = a.clock.t;
    b.run(1);
    expect(b.d.active()?.id).toBe(a.d.active().id);
    expect(b.clock.t / 1000 - b.d.active().t0).toBeGreaterThan(30);
    // (and told, by the room, it believes it as the same one)
    expect(b.d.receive(a.d.wire(a.d.active()))).toBe(false);
  });

  it('leaves nothing behind when cleared', () => {
    const { d, run } = rig();
    run(EVENT_FIRST);
    d.force('blizzard');
    d.clear();
    expect(d.active()).toBe(null);
    expect(run(EVENT_FIRST - 1).begun).toEqual([]);
  });
});
