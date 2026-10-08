import { describe, expect, it } from 'vitest';
import { SITES, siteOf } from '.';
import { ASSAULTS } from '../missions/assaults';
import { heightFor, namedTwice, spawnProblems, standable } from './validity';

describe('every world can be played as written', () => {
  for (const id of Object.keys(SITES)) {
    const site = siteOf(id);
    it(`${id}: every quest's enemies stand somewhere they can come to you from`, () => {
      expect(spawnProblems(site)).toEqual([]);
    });
    it(`${id}: nobody named is there twice`, () => {
      expect(namedTwice(site)).toEqual([]);
    });
    it(`${id}: every quest giver stands on dry ground`, () => {
      for (const a of site.life.filter((l) => l.quest)) expect(standable(site, a.at), a.id).toBe(true);
    });
  }
  for (const [id, m] of Object.entries(ASSAULTS)) {
    it(`the battle on ${id}: every post on dry ground`, () => {
      const site = siteOf(m.system);
      for (const p of m.posts) expect(standable(site, p.at), p.id).toBe(true);
    });
  }
  it('knows the lagoon from the beach (Kashyyyk)', () => {
    const site = siteOf('kashyyyk');
    expect(heightFor(site)(40, 40)).toBeGreaterThan(0.2);
    expect(standable(site, [150, 120])).toBe(false);
  });
});

describe('Kashyyyk, as Revenge of the Sith has it', () => {
  const site = siteOf('kashyyyk');
  const h = heightFor(site);
  it('has a beach in front of the landing, and shallows in front of the beach', () => {
    for (const x of [0, 40, 80, 110]) expect(h(x, 40), `beach ${x}`).toBeGreaterThan(0.4);
    for (const x of [20, 60, 100]) {
      expect(h(x, 90), `shallows ${x}`).toBeLessThan(0);
      expect(h(x, 90), `shallows ${x}`).toBeGreaterThan(-0.8);
    }
  });
  const bar = site.things_all.filter((t) => t.kind === 'barricade');
  const line = Math.max(...bar.map((b) => b.at[1]));
  it('faces its barricades to the water, in front of the cover', () => {
    expect(bar.length).toBeGreaterThanOrEqual(4);
    for (const b of bar) expect(b.at[1]).toBeGreaterThan(50);
    // the cover on the sand lies between the barricades and the water (the
    // stores, crates too, stay back behind the line)
    const cover = site.things_all.filter((t) => t.place === 'beach' && (['karst', 'log'].includes(t.kind) || (t.kind === 'crates' && t.at[1] > 60)));
    expect(cover.length).toBeGreaterThanOrEqual(5);
    for (const c of cover) expect(c.at[1], `${c.kind} at ${c.at}`).toBeGreaterThan(line);
  });
  it('puts the spider-droid wreck on the sand, between the water and the barricades', () => {
    const w = site.things_all.find((t) => t.kind === 'homingspider');
    expect(standable(site, w.at)).toBe(true);
    expect(w.at[1]).toBeGreaterThan(line);
  });
  it('has one Gree and one Tarfful, both where you can talk to them', () => {
    const named = site.life.filter((a) => /Gree|Tarfful/.test(a.name ?? ''));
    expect(named.map((a) => a.name).sort()).toEqual(['Commander Gree', 'Tarfful']);
    const tarfful = named.find((a) => a.name === 'Tarfful');
    // (outside Kachirho's trunk: 18 m round its middle)
    expect(Math.hypot(tarfful.at[0] + 140, tarfful.at[1] + 30)).toBeGreaterThan(22);
  });
  it('stands everyone on Kashyyyk somewhere they can stand', () => {
    for (const a of site.life) {
      for (const p of [a.at, ...(a.path ?? [])].filter(Boolean)) expect(standable(site, p), `${a.name ?? a.kind} at ${p}`).toBe(true);
    }
  });
  it('the droids come out of the shallows in three waves, with clones and Wookiees beside you', () => {
    const q = site.quests.find((x) => x.id === 'beachhead');
    const shoots = q.steps.filter((s) => s.type === 'shoot');
    expect(shoots).toHaveLength(3);
    for (const s of shoots) {
      const spawns = [].concat(s.spawn);
      expect(spawns.some((sp) => sp.side === 'yours')).toBe(true);
      // (your side carries a tag of its own: a kill of theirs, not of yours, is what the step counts)
      for (const sp of spawns.filter((x) => x.side === 'yours')) {
        expect(sp.tag).not.toBe(s.tag);
        // (the whole disc of them is on dry ground: z at its near and far edges)
        for (const dz of [-(sp.spread ?? 0), 0, sp.spread ?? 0]) expect(standable(site, [sp.at[0], sp.at[1] + dz]), `${sp.kind} at ${sp.at} ${dz}`).toBe(true);
      }
      for (const sp of spawns.filter((x) => x.hostile && x.side !== 'yours')) {
        expect(sp.at[1]).toBeGreaterThan(75); // in the shallows
        expect(sp.at[1] - (sp.spread ?? 0)).toBeGreaterThanOrEqual(84); // none of its spread on the sand
        expect(sp.wade).toBe(true);
      }
      expect(s.at).toBeTruthy();
    }
  });
});
