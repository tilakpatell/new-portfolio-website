import { describe, expect, it } from 'vitest';
import { contrast } from '../universe/universes';
import { CLIPS } from '../../lib/clips';
import { SYSTEM_NAMES, inGalaxyFlight, systemOfPath } from './names';
import { CORE, ERAS, FILMS, FIRST, GRID, LANES, REGIONS, SYSTEMS, arrival, goalsOf, bearing, coreBearing, courseTo, liftOf, starAhead, eraOf, erasOf, filmLabel, filmsOf, gridAt, inEra, jumpSeconds, lightYears, parseSystem, reachAt, reachOf, regionAt, systemById, yearLabel } from './systems';

const LOOKS = ['tatooine', 'jakku', 'geonosis', 'hoth', 'starkiller', 'crait', 'endor', 'endor-giant', 'yavin', 'yavin4', 'kashyyyk', 'dagobah', 'naboo', 'coruscant', 'mustafar', 'kamino', 'scarif', 'bespin', 'exegol', 'ahchto', 'moon-grey', 'moon-ice', 'moon-dust', 'moon-rust'];
const PIECES = ['chase', 'fleet', 'escape', 'cannon', 'rocks', 'station', 'battle', 'deathstar', 'stream', 'patrol', 'depart', 'lanes', 'liftoff', 'shield', 'superlaser', 'wrecks', 'starkiller', 'armada', 'lightning'];
const len = (v) => Math.hypot(...v);

describe('the films and eras', () => {
  it('every film is in an era, in story order', () => {
    const years = Object.values(FILMS).map((f) => f.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    for (const f of Object.values(FILMS)) expect(ERAS.map((e) => e.id)).toContain(f.era);
  });
  it('names years and films the way the galaxy does', () => {
    expect(yearLabel(-19)).toBe('19 BBY');
    expect(yearLabel(4)).toBe('4 ABY');
    expect(yearLabel(0)).toBe('0 ABY');
    expect(filmLabel('esb')).toBe('Episode V: The Empire Strikes Back');
    expect(filmLabel('rogue')).toBe('Rogue One');
  });
  it('has systems in every era', () => {
    for (const e of ERAS) expect(inEra(e.id).length).toBeGreaterThan(3);
  });
});

describe('the systems', () => {
  it('each has what its card and its scene need', () => {
    const ids = new Set();
    for (const s of SYSTEMS) {
      expect(ids.has(s.id), s.id).toBe(false);
      ids.add(s.id);
      expect(s.id).toMatch(/^[a-z0-9-]+$/);
      for (const k of ['name', 'region', 'about', 'accent']) expect(typeof s[k], `${s.id}.${k}`).toBe('string');
      expect(s.films.length).toBeGreaterThan(0);
      for (const f of s.films) expect(FILMS[f], `${s.id} film ${f}`).toBeTruthy();
      expect(s.films, `${s.id}'s moment is from one of its films`).toContain(s.moment.film);
      expect(s.films, `${s.id}'s quote is from one of its films`).toContain(s.quote.film);
      expect(s.facts.length).toBeGreaterThanOrEqual(3);
      // its colour is readable on the page
      expect(contrast(s.accent, '#03040a'), s.id).toBeGreaterThanOrEqual(4.5);
      // on the map
      expect(s.pos[0]).toBeGreaterThan(0);
      expect(s.pos[0]).toBeLessThan(GRID.cols);
      expect(s.pos[1]).toBeGreaterThan(0);
      expect(s.pos[1]).toBeLessThan(GRID.rows);
    }
  });
  it('sits in the grid square the atlas gives it', () => {
    for (const s of SYSTEMS) if (s.grid) expect(gridAt(s.pos), s.id).toBe(s.grid);
  });
  it('sits in the region the atlas gives it', () => {
    const names = [...REGIONS.map((r) => r.name), 'Unknown Regions'];
    for (const s of SYSTEMS) if (names.includes(s.region)) expect(regionAt(s.pos), s.id).toBe(s.region);
  });
  it('draws with looks and pieces the scene has', () => {
    for (const s of SYSTEMS) {
      if (s.body) {
        expect(LOOKS, s.id).toContain(s.body.look);
        expect(s.body.r).toBeGreaterThan(10);
      }
      if (s.parent) expect(LOOKS).toContain(s.parent.look);
      for (const m of s.moons) expect(LOOKS).toContain(m.look);
      for (const p of s.pieces) expect(PIECES, `${s.id}: ${p.type}`).toContain(p.type);
      expect(s.suns.length).toBeGreaterThan(0);
      for (const sun of s.suns) expect(len(sun.dir)).toBeGreaterThan(0.9), expect(len(sun.dir)).toBeLessThan(1.1);
    }
  });
  it('keeps its capital ships clear of its planet', () => {
    for (const s of SYSTEMS) {
      const r = s.body?.r ?? 0;
      for (const p of s.pieces) {
        const ships = p.ships ?? Object.values(p.sides ?? {}).flat();
        const base = p.sides ? p.at : [0, 0, 0];
        for (const sh of ships) {
          const at = sh.at.map((v, i) => v + base[i]);
          expect(len(at) - sh.size * 0.5, `${s.id} ${sh.kind}`).toBeGreaterThan(r + 2);
        }
      }
    }
  });
  it('has a mission each, live ones going somewhere', () => {
    for (const s of SYSTEMS) {
      const g = s.game;
      expect(g, s.id).toBeTruthy();
      for (const k of ['id', 'title', 'role', 'pitch', 'how']) expect(typeof g[k], `${s.id}.game.${k}`).toBe('string');
      expect(FILMS[g.film]).toBeTruthy();
      expect(['soon', 'live']).toContain(g.status);
      expect(g.objectives, s.id).toHaveLength(3);
      if (g.status === 'live') expect(g.to).toMatch(/^\//);
    }
  });
  it('says its lines with clips there are', () => {
    for (const s of SYSTEMS) if (s.quote.clip) expect(CLIPS[s.quote.clip], s.id).toBeTruthy();
  });
  it('keeps the multiplayer\'s names in step', () => {
    expect(Object.keys(SYSTEM_NAMES).sort()).toEqual(SYSTEMS.map((s) => s.id).sort());
    for (const s of SYSTEMS) expect(SYSTEM_NAMES[s.id]).toBe(s.name);
    expect(systemOfPath('/galaxy/hoth/mission')).toBe('hoth');
    expect(systemOfPath('/galaxy/nope')).toBe(null);
    expect(inGalaxyFlight('/galaxy/hoth')).toBe(true);
    expect(inGalaxyFlight('/galaxy/hoth/mission')).toBe(false);
  });
  it('names the places the autopilot can take you', () => {
    expect(goalsOf(systemById('yavin')).map((g) => g.id)).toEqual(['planet', 'deathstar']);
    expect(goalsOf(systemById('yavin'))[1].board).toBe('/deathstar');
    expect(goalsOf(systemById('endor')).map((g) => g.id)).toEqual(['planet', 'deathstar2']);
    expect(goalsOf(systemById('alderaan'))[0].name).toBe('Where Alderaan was');
    for (const s of SYSTEMS) expect(new Set(goalsOf(s).map((g) => g.id)).size).toBe(goalsOf(s).length);
  });
  it('looks systems up by id', () => {
    expect(systemById('hoth').name).toBe('Hoth');
    expect(systemById('nope')).toBe(null);
    expect(parseSystem('endor')).toBe('endor');
    expect(parseSystem('../x')).toBe(null);
    expect(parseSystem(4)).toBe(null);
    expect(systemById(FIRST)).toBeTruthy();
  });
  it('knows its eras and films in order', () => {
    const t = systemById('tatooine');
    expect(eraOf(t)).toBe('empire');
    expect(erasOf(t)).toEqual(expect.arrayContaining(['republic', 'empire', 'firstorder']));
    expect(filmsOf(t).map((f) => f.id)).toEqual(['tpm', 'aotc', 'anh', 'rotj', 'tros']);
    expect(eraOf(systemById('exegol'))).toBe('firstorder');
    expect(eraOf(systemById('naboo'))).toBe('republic');
  });
});

describe('the map', () => {
  it('names grid squares', () => {
    expect(gridAt([0.2, 0.1])).toBe('A-1');
    expect(gridAt([20.9, 20.9])).toBe('U-21');
    expect(gridAt([-3, 40])).toBe('A-21');
  });
  it('has Coruscant near the middle and the Unknown Regions to the west', () => {
    expect(reachAt(systemById('coruscant').pos)).toBeLessThan(2.1);
    expect(regionAt([CORE[0] - 10, CORE[1]])).toBe('Unknown Regions');
    expect(regionAt([CORE[0] + 10.5, CORE[1]])).toBe('Wild Space');
  });
  it('has lanes on the map', () => {
    for (const l of LANES) for (const [x, z] of l.pts) expect(x).toBeGreaterThan(0), expect(z).toBeGreaterThan(0);
  });
  it('points the way between systems along the galaxy', () => {
    const a = systemById('coruscant');
    const b = systemById('tatooine');
    const d = bearing(a, b);
    expect(len(d)).toBeCloseTo(1, 6);
    expect(d[1]).toBe(0);
    expect(d[0]).toBeGreaterThan(0); // Tatooine is east of Coruscant
    expect(d[2]).toBeGreaterThan(0); // and south
    expect(len(coreBearing(b).dir)).toBeCloseTo(1, 6);
    expect(coreBearing(b).d).toBeGreaterThan(coreBearing(a).d);
    expect(lightYears(a, b)).toBeGreaterThan(30000);
  });
  it("puts every other system's star in a sky of its own, none on top of another", () => {
    for (const s of SYSTEMS) expect(Math.abs(liftOf(s)), s.id).toBeLessThan(1);
    for (const from of SYSTEMS) {
      const ways = SYSTEMS.filter((s) => s !== from).map((s) => [s.id, courseTo(from, s)]);
      for (const [id, d] of ways) {
        expect(len(d), id).toBeCloseTo(1, 6);
        // (roughly the way the map has it, a little up or down)
        const flat = bearing(from, systemById(id));
        expect(d[0] * flat[0] + d[2] * flat[2], `${from.id} → ${id}`).toBeGreaterThan(0);
      }
      for (let i = 0; i < ways.length; i++)
        for (let j = i + 1; j < ways.length; j++) {
          const [a, u] = ways[i];
          const [b, v] = ways[j];
          const angle = Math.acos(Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]));
          expect(angle, `from ${from.id}: ${a} and ${b}`).toBeGreaterThan((2.3 * Math.PI) / 180);
        }
    }
  });
  it('picks the star the nose is on, and only when it is on one', () => {
    for (const from of SYSTEMS)
      for (const to of SYSTEMS) {
        if (to === from) continue;
        expect(starAhead(from, courseTo(from, to))?.id, `${from.id} → ${to.id}`).toBe(to.id);
      }
    const hoth = systemById('hoth');
    expect(starAhead(hoth, [0, 1, 0])).toBeNull(); // (straight up out of the galaxy: nothing)
    // between two stars, the one already picked stays picked
    const from = systemById('tatooine');
    const a = courseTo(from, systemById('naboo'));
    const b = courseTo(from, systemById('geonosis'));
    const mid = a.map((v, i) => v + b[i]);
    const l = len(mid);
    const half = mid.map((v) => v / l);
    const wide = { within: 1 };
    expect(starAhead(from, half, { ...wide, keep: 'naboo' })?.id).toBe('naboo');
    expect(starAhead(from, half, { ...wide, keep: 'geonosis' })?.id).toBe('geonosis');
  });
  it('makes a jump take a few seconds, longer for longer ones', () => {
    const near = jumpSeconds(systemById('hoth'), systemById('bespin'));
    const far = jumpSeconds(systemById('exegol'), systemById('kamino'));
    expect(near).toBeGreaterThanOrEqual(1.8);
    expect(far).toBeGreaterThan(near);
    expect(far).toBeLessThanOrEqual(4.2);
  });
  it('brings you out of a jump clear of the planet, facing it', () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const s of SYSTEMS) {
      for (const from of [null, systemById('coruscant'), systemById('exegol')]) {
        const a = arrival(s, from === s ? null : from, rand);
        const d = Math.hypot(a.x, a.y, a.z);
        expect(d, s.id).toBeGreaterThan(reachOf(s));
        // the nose (heading 0 is −z, as ship.js has it) points at the middle
        const nose = [-Math.sin(a.heading), -Math.cos(a.heading)];
        const to = [-a.x, -a.z].map((v) => v / Math.hypot(a.x, a.z));
        expect(nose[0] * to[0] + nose[1] * to[1], s.id).toBeGreaterThan(0.999);
      }
    }
  });
});
