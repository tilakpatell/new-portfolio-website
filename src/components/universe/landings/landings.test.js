import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MOONS, UNIVERSES } from '../universes';
import { STYLES } from './ground';
import { CLEAR, LANDINGS, SCATTER_MAX, landingOf, scatterSpots, seedOf } from './landings';
import { biomeAt } from './biomes';

const HEX = /^#[0-9a-f]{6}$/i;
const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '../../../../public');
// the planets you can land on: the fandoms (not the gate into the galaxy)
const LANDABLE = [...UNIVERSES.filter((u) => u.kind === 'fandom' && !u.portal), ...MOONS].map((u) => u.id);
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
// the planets whose things are built (their files, as furnish.js loads them)
const FILES = {
  middleearth: () => import('./middleearth.js'),
  breakingbad: () => import('./breakingbad.js'),
  rickmorty: () => import('./rickmorty.js'),
  transformers: () => import('./transformers.js'),
  gaming: () => import('./gaming.js'),
  marvel: () => import('./marvel.js'),
  office: () => import('./office.js'),
  music: () => import('./music.js'),
  travel: () => import('./travel.js'),
  caribbean: () => import('./caribbean.js'),
  invincible: () => import('./invincible.js'),
  gazorpazorp: () => import('./rmmoons.js'),
  squanch: () => import('./rmmoons.js'),
  birdworld: () => import('./rmmoons.js'),
  gearworld: () => import('./rmmoons.js'),
  pluto: () => import('./rmmoons.js'),
  snakeplanet: () => import('./rmmoons.js'),
  nuptia: () => import('./rmmoons.js'),
  resort: () => import('./rmmoons.js'),
  cronenberg: () => import('./rmmoons.js'),
  purge: () => import('./rmmoons.js'),
};

// each landing as it is, and as each of its biomes has it (biomes.js), by name
const PLACES = Object.entries(LANDINGS).flatMap(([id, l]) => [[id, id, l], ...(l.biomes ?? []).map((b) => [id, `${id}/${b.id}`, biomeAt({ ...l, biomes: [b] }, [0, 0, 0])])]);

describe('planet landings', () => {
  it('give every planet you can land on its own place: a name, a ground and a sky', () => {
    expect(LANDABLE.length).toBe(21);
    const titles = new Set();
    for (const id of LANDABLE) {
      const l = landingOf(id);
      expect(l, id).toBeTruthy();
      expect(l.title.length, id).toBeGreaterThan(2);
      titles.add(l.title);
      expect(STYLES[l.ground.style], `${id}'s ground`).toBeTruthy();
      expect(l.ground.colors).toHaveLength(3);
      for (const c of l.ground.colors) expect(c, id).toMatch(HEX);
      for (const k of ['zenith', 'horizon', 'sun']) expect(l.sky[k], `${id}'s ${k}`).toMatch(HEX);
      expect(l.sky.space ?? 0).toBeGreaterThanOrEqual(0);
      expect(l.sky.space ?? 0).toBeLessThanOrEqual(1);
    }
    expect(titles.size).toBe(LANDABLE.length);
    expect(landingOf('starwars')).toBeNull(); // (a gate, not a planet)
  });

  it('only name models that are there to load', () => {
    for (const [, id, l] of PLACES) {
      for (const [kind, m] of Object.entries(l.models ?? {})) {
        expect(existsSync(join(PUBLIC, m.url)), `${id}'s ${kind}: ${m.url}`).toBe(true);
        expect(Boolean(m.tall || m.long || m.wide), `${id}'s ${kind} has a size`).toBe(true);
      }
    }
  });

  it("build every thing and scatter from a model or the planet's own file", async () => {
    for (const [planet, id, l] of PLACES) {
      if (!l.things && !l.scatter) continue;
      expect(FILES[planet], `${id} has a file`).toBeTruthy();
      const P = await FILES[planet]();
      const models = l.models ?? {};
      // (a figure is built by furnish itself: landings/people.js)
      for (const t of l.things ?? []) expect(Boolean(models[t.kind] || P.PROPS?.[t.kind] || (t.kind === 'figure' && (t.opts?.url || t.opts?.meshy))), `${id}: ${t.kind}`).toBe(true);
      for (const t of l.things ?? []) if (t.kind === 'figure' && t.opts?.url) expect(existsSync(join(PUBLIC, t.opts.url)), `${id}: ${t.opts.url}`).toBe(true);
      for (const e of l.scatter ?? []) expect(Boolean(models[e.kind] || P.SCATTER?.[e.kind] || P.PROPS?.[e.kind]), `${id}: scattered ${e.kind}`).toBe(true);
    }
  });

  it('stand things clear of the ship and of each other', () => {
    for (const [, id, l] of PLACES) {
      const things = (l.things ?? []).filter((t) => !t.strip && !t.around);
      for (const t of things) {
        expect(t.at, `${id}: ${t.kind}`).toHaveLength(2);
        expect(t.r, `${id}: ${t.kind}'s reach`).toBeGreaterThanOrEqual(0);
        expect(Math.hypot(...t.at) - t.r, `${id}: ${t.kind} by the ship`).toBeGreaterThanOrEqual(CLEAR);
      }
      for (let i = 0; i < things.length; i++)
        for (let j = i + 1; j < things.length; j++) {
          const [a, b] = [things[i], things[j]];
          expect(Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]), `${id}: ${a.kind} and ${b.kind}`).toBeGreaterThanOrEqual(a.r + b.r);
        }
    }
  });

  it('scatter within its ring, clear of the things and (if solid) the ship, within budget', () => {
    for (const [planet, id, l] of PLACES) {
      let total = 0;
      for (const e of l.scatter ?? []) {
        expect(e.n, `${id}: ${e.kind}`).toBeLessThanOrEqual(SCATTER_MAX);
        expect(e.from).toBeLessThan(e.to);
        total += e.n;
        const reach = 0.6;
        const spots = scatterSpots(e, l.things ?? [], seeded(seedOf(planet)), { reach });
        expect(spots.length, `${id}: ${e.kind} found room`).toBeGreaterThan(e.n * 0.8);
        for (const p of spots) {
          const d = Math.hypot(p.x, p.z);
          expect(d).toBeGreaterThanOrEqual(e.from - 1e-9);
          expect(d).toBeLessThanOrEqual(e.to + 1e-9);
          if (e.solid !== false) expect(d - reach * p.s).toBeGreaterThanOrEqual(CLEAR);
          for (const t of (l.things ?? []).filter((x) => !x.strip && !x.around)) expect(Math.hypot(t.at[0] - p.x, t.at[1] - p.z)).toBeGreaterThanOrEqual(t.r + reach * p.s);
        }
      }
      expect(total, `${id}'s scatter`).toBeLessThanOrEqual(1200);
    }
  });

  it('give every planet a way into its page, and its doors and lines their words', () => {
    for (const id of LANDABLE) {
      const doors = (LANDINGS[id].things ?? []).filter((t) => t.door);
      expect(doors.length, `${id} has a door`).toBeGreaterThanOrEqual(1);
      for (const t of doors) expect(t.door.label.length).toBeGreaterThan(2);
      for (const t of (LANDINGS[id].things ?? []).filter((x) => x.say)) {
        expect(t.say.name.length).toBeGreaterThan(1);
        expect(t.say.line.length).toBeGreaterThan(3);
      }
    }
  });

  it('lays a planet out the same for everyone, and each planet its own way', () => {
    const e = LANDINGS.breakingbad.scatter[0];
    const a = scatterSpots(e, LANDINGS.breakingbad.things, seeded(seedOf('breakingbad')));
    const b = scatterSpots(e, LANDINGS.breakingbad.things, seeded(seedOf('breakingbad')));
    expect(a).toEqual(b);
    expect(seedOf('breakingbad')).not.toBe(seedOf('rickmorty'));
  });
});

describe('the sky on foot', () => {
  it('every landing’s sky stays near its hand-set colours at noon, and warms toward sunset', async () => {
    const { skyAt } = await import('./sky');
    const THREE = await import('three');
    const lin = (hex) => {
      const c = new THREE.Color(hex);
      return [c.r, c.g, c.b];
    };
    let checked = 0;
    // (each biome's own sky too, under its planet's air)
    for (const [u, landing] of UNIVERSES.flatMap((u) => [[u, landingOf(u.id)], ...(landingOf(u.id)?.biomes ?? []).filter((b) => b.sky).map((b) => [u, b])])) {
      if (!u.air || !landing?.sky) continue;
      checked++;
      const noon = skyAt(landing.sky, u.air, 1);
      for (const k of ['zenith', 'horizon', 'sun']) {
        const set = lin(landing.sky[k]);
        noon[k].forEach((v, i) => expect(Math.abs(v - set[i]), `${u.id} ${k}`).toBeLessThanOrEqual(0.15));
      }
      // (low, the sun's light comes through more air, which takes out most
      // what it scatters most: a bluer air's sun goes redder)
      const air = lin(u.air.colour);
      const low = skyAt(landing.sky, u.air, 0.06);
      const redder = low.sun[0] / Math.max(low.sun[2], 1e-6) >= noon.sun[0] / Math.max(noon.sun[2], 1e-6) - 1e-9;
      expect(redder, u.id).toBe(air[2] >= air[0]);
    }
    expect(checked).toBeGreaterThan(4);
    // a planet with no air keeps its hand-set sky, whatever the hour
    const office = landingOf('office');
    if (office?.sky) expect(skyAt(office.sky, null, 0.1).zenith).toEqual(lin(office.sky.zenith));
  });
});
