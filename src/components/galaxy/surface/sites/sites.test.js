import { describe, expect, it } from 'vitest';
import { SYSTEMS } from '../../systems';
import { GALAXY_KINDS } from '../../fleet';
import { BUILT_KINDS } from '../../../universe/trafficModels';
import { SURFACE_MODELS } from '../catalog';
import { FIGURES } from '../figures';
import { CREW } from '../crew';
import { PROPS, SCATTER } from '../props';
import { RIDES } from '../rides';
import { LAYER_TYPES, REACH, heightGrid, makeHeight } from '../terrain';
import { LANDABLE, SITES, siteOf } from '.';
import { talkTree } from '../talk';

const SHIPS = new Set([...GALAXY_KINDS, ...BUILT_KINDS]);
const placeable = (kind) => Boolean(PROPS[kind] || SURFACE_MODELS[kind]);
const WEATHER = ['sand', 'snow', 'rain', 'ash', 'embers', 'motes', 'spray'];

describe('the worlds you can land on', () => {
  it('are the galaxy’s systems with somewhere to stand (Alderaan’s gone)', () => {
    for (const id of Object.keys(SITES)) expect(SYSTEMS.some((s) => s.id === id), id).toBe(true);
    expect(LANDABLE).not.toContain('alderaan');
    expect(LANDABLE).toContain('tatooine');
  });

  for (const id of Object.keys(SITES)) {
    describe(id, () => {
      const site = siteOf(id);

      it('has its sky, its light, its land and where to come down', () => {
        expect(site.place, 'place').toBeTruthy();
        expect(site.line, 'line').toBeTruthy();
        for (const k of ['zenith', 'horizon']) expect(site.sky[k], k).toMatch(/^#[0-9a-f]{6}$/i);
        expect(site.sky.suns?.length ?? 0).toBeLessThanOrEqual(2);
        expect(site.fog.density).toBeGreaterThan(0);
        expect(site.light.sun).toBeGreaterThan(0);
        for (const l of site.ground.layers) expect(LAYER_TYPES, l.type).toContain(l.type);
        for (const k of ['low', 'high', 'rock']) expect(site.ground.palette[k], k).toBeTruthy();
        expect(Math.hypot(...site.land.at)).toBeLessThan(REACH - 40);
        for (const w of site.weather) expect(WEATHER, w.kind).toContain(w.kind);
      });

      it('has places to find, each one somewhere you can get to', () => {
        expect(site.places.length).toBeGreaterThanOrEqual(3);
        const ids = site.places.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const p of site.places) {
          expect(p.name, p.id).toBeTruthy();
          expect(p.about?.length, p.id).toBeGreaterThan(30);
          expect(p.r, p.id).toBeGreaterThan(5);
          // (its middle within reach, or its edge at least)
          expect(Math.hypot(...p.at) - p.r, p.id).toBeLessThan(REACH);
        }
      });

      it('has everything it places built or brought in', () => {
        for (const t of site.things_all) expect(placeable(t.kind), `${t.kind}`).toBe(true);
        for (const s of site.scatter) expect(Boolean(SCATTER[s.kind] || placeable(s.kind)), `scatter ${s.kind}`).toBe(true);
        for (const a of site.life) expect(Boolean(FIGURES.includes(a.kind) || CREW[a.kind] || placeable(a.kind)), `life ${a.kind}`).toBe(true);
        for (const r of site.rides) expect(RIDES[r.kind], `ride ${r.kind}`).toBeTruthy();
        for (const r of site.rides) if (!RIDES[r.kind].figure) expect(placeable(r.kind), `ride ${r.kind}`).toBe(true);
        for (const f of site.flyovers) expect(SHIPS.has(f.kind), `flyover ${f.kind}`).toBe(true);
        for (const f of site.skyships) expect(SHIPS.has(f.kind), `skyship ${f.kind}`).toBe(true);
      });

      it('sends its people to wants that exist, of kinds someone needs, within reach', () => {
        const kinds = new Set(site.wants.map((w) => w.kind));
        const ids = site.wants.map((w) => w.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const w of site.wants) expect(Math.hypot(...w.at), w.id).toBeLessThan(REACH);
        for (const a of site.life) for (const k of a.needs ?? []) expect(kinds.has(k), `${a.kind} needs ${k}`).toBe(true);
        const life = new Set(site.life.map((a) => a.kind));
        for (const a of site.life) for (const k of [...(a.fears ?? []), ...(a.chases ?? [])]) expect(life.has(k), `${a.kind} knows ${k}`).toBe(true);
      });

      it('every `says` that is a tree validates, and every list is lines', () => {
        for (const a of site.life) {
          if (!a.says) continue;
          const lines = talkTree(a.says, `${id} ${a.name ?? a.kind}`);
          expect(lines.length, `${a.name ?? a.kind}`).toBeGreaterThan(0);
          for (const l of lines) expect(typeof l === 'string' || (Array.isArray(l) && l.length === 2)).toBe(true);
        }
      });

      it('can start every quest it has (its giver offers it)', () => {
        const ids = (a) => [a.quest ?? []].flat();
        for (const q of site.quests) {
          if (!q.giver) continue;
          const giver = site.life.filter((a) => a.id === q.giver);
          expect(giver.length, `${q.id}'s giver ${q.giver}`).toBeGreaterThan(0);
          expect(giver.some((a) => ids(a).includes(q.id)), `${q.giver} offers ${q.id}`).toBe(true);
        }
      });

      it('sets the ship down on level ground, inside the world', () => {
        if (site.noGround) {
          expect(site.floors.length + site.things_all.length).toBeGreaterThan(0);
          return;
        }
        const g = heightGrid(makeHeight(site.ground), { n: 64, grow: 1.4 });
        const [x, z] = site.land.at;
        const n = g.normalAt(x, z, 2);
        expect(n[1]).toBeGreaterThan(0.97);
        if (site.water && site.water.kind !== 'clouds') expect(g.heightAt(x, z)).toBeGreaterThan(site.water.level);
      });
    });
  }
});

describe('Bespin, inside', () => {
  const site = siteOf('bespin');
  const quest = (id) => site.quests.find((q) => q.id === id);
  const zone = (id) => site.zones.find((z) => z.id === id);

  it('offers the duel and Lobot’s codes only after the freezing', () => {
    expect(quest('freezing').after).toBeUndefined();
    expect(quest('duel').after).toEqual(['freezing']);
    expect(quest('lobot').after).toEqual(['freezing']);
    for (const id of ['freezing', 'duel', 'lobot']) expect(quest(id).achievement).toBe(`bespin${id}`);
  });

  it('puts the chamber’s guards and the platform in the freezing chamber, and the freeze lowers the platform', () => {
    const q = quest('freezing');
    const o = zone('carbon').origin;
    const fight = q.steps.find((s) => s.type === 'shoot');
    expect(fight.spawn.reduce((n, s) => n + s.n, 0)).toBe(6);
    for (const s of fight.spawn) {
      expect(Math.abs(s.at[0] - o[0])).toBeLessThan(17);
      expect(Math.abs(s.at[1] - o[2])).toBeLessThan(17);
    }
    expect(fight.spawn.some((s) => s.hostile.melee)).toBe(true);
    const use = q.steps.find((s) => s.type === 'use');
    expect(use.at).toEqual([o[0], o[2]]);
    expect(use.end).toEqual(expect.arrayContaining([{ signal: 'freeze' }]));
  });

  it('sets Vader on the gantry with a blade and the Force, and you back on the control room floor when you fall', () => {
    const q = quest('duel');
    const o = zone('reactor').origin;
    const duel = q.steps.find((s) => s.type === 'shoot');
    const [vader] = [].concat(duel.spawn);
    expect(vader.kind).toBe('vader');
    expect(Math.hypot(vader.at[0] - o[0], vader.at[1] - o[2])).toBeLessThan(12);
    expect(vader.hostile.blade).toBeTruthy();
    expect(vader.hostile.force).toEqual({ every: 7, push: 9 });
    expect(vader.hostile.parry).toBeGreaterThan(0.5);
    expect(duel.respawn).toEqual([o[0], o[2] + 19.5]);
    expect(zone('reactor').inside.fall).toBeLessThan(0);
  });

  it('sends the Wing Guard in on your side through the corridor, and the codes open its doors', () => {
    const q = quest('lobot');
    const fight = q.steps.find((s) => s.type === 'shoot');
    const guards = fight.spawn.filter((s) => s.side === 'yours');
    expect(guards.length).toBe(1);
    expect(guards[0].kind).toBe('wingguard');
    expect(guards[0].hostile.range).toBeGreaterThan(0);
    expect(fight.spawn.filter((s) => s.tag === 'escort').reduce((n, s) => n + s.n, 0)).toBe(fight.n);
    const uses = q.steps.filter((s) => s.type === 'use');
    expect(uses.map((u) => u.id)).toEqual(['lobot1', 'lobot2']);
    expect(uses[0].end).toEqual(expect.arrayContaining([{ signal: 'lobot1' }, { solid: 'door1', off: true }]));
    expect(uses[1].end).toEqual(expect.arrayContaining([{ signal: 'lobot2' }, { solid: 'door2', off: true }, { leave: true }]));
    const race = q.steps.at(-1);
    expect(race.type).toBe('race');
    expect(Math.hypot(race.gates.at(-1)[0], race.gates.at(-1)[1] + 255)).toBeLessThan(28);
  });
});
