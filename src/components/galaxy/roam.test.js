import { describe, expect, it } from 'vitest';
import { createRoam } from './roam';
import { ROAM_EVENTS } from './roamRules';
import { PACE } from '../universe/director';
import { systemById } from './systems';

const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const run = (r, seconds, state, dt = 0.5) => {
  const got = [];
  for (let t = 0; t < seconds; t += dt) {
    const e = r.update(dt, typeof state === 'function' ? state(t) : state);
    if (e) got.push({ t, e });
  }
  return got;
};

describe('the galaxy roam', () => {
  it('brings nothing without a system', () => {
    expect(run(createRoam({ rand: seeded() }), 1200, { sys: null })).toHaveLength(0);
  });

  it('waits a while, then only what the scene plays: hunts and Star Destroyers and bounty hunters over the Empire’s worlds', () => {
    const got = run(createRoam({ rand: seeded() }), 6000, { sys: systemById('hoth') });
    expect(got.length).toBeGreaterThan(40);
    expect(got[0].t).toBeGreaterThanOrEqual(PACE.first[0]);
    const ids = new Set(got.map((g) => g.e));
    expect([...ids].sort()).toEqual(['bounty', 'destroyer', 'hunt']);
    for (let i = 1; i < got.length; i++) expect(got[i].e).not.toBe(got[i - 1].e);
  });

  it('sends only droids over the Separatists’ worlds, and only a bounty hunter where nobody holds the system', () => {
    expect(new Set(run(createRoam({ rand: seeded(3) }), 6000, { sys: systemById('geonosis') }).map((g) => g.e))).toEqual(new Set(['hunt']));
    const quiet = run(createRoam({ rand: seeded(3) }), 6000, { sys: systemById('dagobah') });
    expect(quiet.length).toBeGreaterThan(0);
    expect(new Set(quiet.map((g) => g.e))).toEqual(new Set(['bounty']));
  });

  it('holds off while something is going on, and sends nobody while the shields are low', () => {
    expect(run(createRoam({ rand: seeded() }), 1200, { sys: systemById('hoth'), busy: true })).toHaveLength(0);
    expect(run(createRoam({ rand: seeded() }), 1200, { sys: systemById('hoth'), calm: true })).toHaveLength(0);
  });

  it('plays only the events it is given', () => {
    const r = createRoam({ rand: seeded(), events: { hunt: ROAM_EVENTS.hunt, bounty: ROAM_EVENTS.bounty } });
    const got = run(r, 3000, { sys: systemById('hoth') });
    expect(got.length).toBeGreaterThan(20);
    for (const { e } of got) expect(['hunt', 'bounty']).toContain(e);
    r.soon('destroyer');
    expect(run(r, 600, { sys: systemById('hoth') }).map((g) => g.e)).not.toContain('destroyer');
  });

  it('keeps its clock across jumps: moving on is not a reset', () => {
    // a new system every 100 s: as many come as if you had stayed
    const hop = (t) => ({ sys: systemById(Math.floor(t / 100) % 2 ? 'endor' : 'hoth') });
    const moving = run(createRoam({ rand: seeded() }), 6000, hop);
    const staying = run(createRoam({ rand: seeded() }), 6000, { sys: systemById('hoth') });
    expect(moving.length).toBeGreaterThan(staying.length * 0.8);
    for (let i = 1; i < moving.length; i++) expect(moving[i].t - moving[i - 1].t).toBeLessThanOrEqual(PACE.gap[1] + 0.5);
  });

  it('reads who holds the system: in your side’s space, never a hunt or a Star Destroyer, but escorts and bounty hunters', () => {
    const effects = { owner: 'rebel', yours: true, hostile: false, garrison: 'rebellion', droids: false, hunt: false, escort: true, deserter: false, heat: 0 };
    const r = createRoam({ rand: seeded() });
    const got = run(r, 6000, { sys: systemById('hoth'), effects });
    const ids = new Set(got.map((g) => g.e));
    expect([...ids].sort()).toEqual(['bounty', 'escort']);
    expect(r.side(systemById('hoth'), effects).escort.length).toBeGreaterThan(0);
  });
});
