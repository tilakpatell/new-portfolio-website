import { describe, expect, it } from 'vitest';
import { CHART_VIEWS, DESTINATIONS, DRIVES, HYPER, chartAt, chartHeading, destinationById, distanceTo, findDestinations, formatDistance, formatTime, hyperState, onChart, parkFor, parseDrive, riftExit, riftSpot, tripTime } from './nav';
import { GOALS, OVERDRIVE, SHIP, SOLIDS, autopilot, inTrench, orbiting, spawn, startAt, step } from './ship';
import { ORDER } from './layout';
import { WONDERS } from './deep';
import { MAW } from './maw';
import { byId } from './universes';

const inside = (s) => SOLIDS.some((p) => Math.hypot(s.x - p.at[0], s.y - p.at[1], s.z - p.at[2]) < (inTrench(p, s.x, s.y, s.z) ? p.band.floor : p.r) + SHIP.radius - 1e-6);
const worlds = ORDER.filter((id) => byId(id).kind !== 'core');
const stations = ORDER.filter((id) => byId(id).kind === 'core');

// flown there by the autopilot on `od` of overdrive: how long it took, the
// top speed, and anything it hit or went into on the way
function fly(from, id, od, limit = 120) {
  let s = from;
  const park = parkFor(id, [s.x, s.z]);
  let top = 0;
  let hits = 0;
  let t = 0;
  let done = false;
  for (; t < limit && !done; t += 1 / 60) {
    const a = autopilot(s, id, park, undefined, od);
    done = a.done;
    const r = step(s, a.input, 1 / 60);
    s = r.ship;
    top = Math.max(top, s.speed);
    hits += r.events.filter((e) => e.type === 'crash' || e.type === 'bump').length + (inside(s) ? 1 : 0);
  }
  return { s, t, top, hits, done };
}

describe('where there is to go', () => {
  it('lists every station, every world and every wonder once, each somewhere the autopilot can go', () => {
    const ids = DESTINATIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [...ORDER, ...WONDERS.map((w) => w.id)]) expect(ids, id).toContain(id);
    for (const d of DESTINATIONS) {
      expect(GOALS[d.id], d.id).toBeTruthy();
      expect(d.name, d.id).toBeTruthy();
      expect(d.about, d.id).toBeTruthy();
      expect(d.color, d.id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(['station', 'world', 'wonder']).toContain(d.kind);
    }
    expect(DESTINATIONS.filter((d) => d.kind === 'station').map((d) => d.id)).toEqual(stations);
    expect(DESTINATIONS.filter((d) => d.kind === 'world').map((d) => d.id)).toEqual(worlds);
    // a world has its page; a wonder has none
    expect(destinationById('marvel').to).toBe('/avengers');
    expect(destinationById('aurelia').to).toBeNull();
    expect(destinationById('nope')).toBeNull();
  });

  it('filters by kind and finds by name, fandom or what it is, whatever the case or accents', () => {
    expect(findDestinations('wonder').every((d) => d.kind === 'wonder')).toBe(true);
    expect(findDestinations('all')).toHaveLength(DESTINATIONS.length);
    expect(findDestinations('all', 'resume').map((d) => d.id)).toEqual(['resume']);
    expect(findDestinations('all', 'RICK').map((d) => d.id)).toContain('rickmorty'); // (its fandom)
    expect(findDestinations('all', 'nebula').map((d) => d.id).sort()).toEqual(['cradle', 'veil']);
    expect(findDestinations('station', 'nebula')).toEqual([]);
  });

  it('parks at the edge of the Maw’s pull, never in it, and off everything else', () => {
    const p = parkFor(MAW.id, [0, 0]);
    expect(Math.hypot(p.x - MAW.at[0], p.z - MAW.at[2])).toBeLessThan(MAW.reach);
    expect(Math.hypot(p.x - MAW.at[0], p.z - MAW.at[2])).toBeGreaterThan(MAW.reach * 0.8);
    for (const id of worlds) {
      const q = parkFor(id, [0, 0]);
      expect(orbiting({ ...q }, null), id).toBe(id);
    }
  });

  it('measures the distance to the edge of a place, not its middle', () => {
    const d = destinationById('marvel');
    expect(distanceTo({ x: d.at[0], y: d.at[1], z: d.at[2] }, 'marvel')).toBe(0);
    const far = distanceTo({ x: 0, y: 0, z: 0 }, 'marvel');
    expect(far).toBeCloseTo(Math.hypot(...d.at) - d.reach, 3);
    expect(distanceTo(null, 'marvel')).toBeNull();
  });
});

describe('the drives', () => {
  it('keeps the drive picked, and falls back to super speed for anything else', () => {
    for (const d of DRIVES) expect(parseDrive(d.id)).toBe(d.id);
    expect(parseDrive(undefined)).toBe('super');
    expect(parseDrive('warp')).toBe('super');
  });

  it('lets the hyperdrive jump once it has charged, and never while interdicted', () => {
    expect(hyperState()).toEqual({ ready: true, wait: 0, why: null });
    expect(hyperState({ last: 100, now: 103 })).toMatchObject({ ready: false, why: 'charging', wait: HYPER.recharge - 3 });
    expect(hyperState({ last: 100, now: 100 + HYPER.recharge }).ready).toBe(true);
    expect(hyperState({ interdicted: true })).toMatchObject({ ready: false, why: 'interdicted' });
  });

  it('gets to every world on super speed in well under the time cruising takes, without touching anything', () => {
    for (const id of worlds) {
      const cruise = fly(spawn('home'), id, 1);
      const quick = fly(spawn('home'), id, OVERDRIVE);
      expect(quick.done, id).toBe(true);
      expect(quick.hits, id).toBe(0);
      expect(orbiting(quick.s, null), id).toBe(id);
      expect(quick.t, id).toBeLessThan(cruise.t * 0.65);
      expect(quick.t, id).toBeLessThan(15);
      if (id !== 'starwars') expect(quick.top, id).toBeGreaterThan(SHIP.pulse * 2); // (well past the pulse drive; the gate's close to home)
    }
  });

  it('flies out to every wonder on super speed, and from world to world all the way round, without touching anything', () => {
    for (const w of WONDERS.filter((w) => w.id !== MAW.id)) {
      const r = fly(spawn('home'), w.id, OVERDRIVE);
      expect(r.done, w.id).toBe(true);
      expect(r.hits, w.id).toBe(0);
    }
    let s = spawn(ORDER[0]);
    for (let i = 1; i <= ORDER.length; i++) {
      const id = ORDER[i % ORDER.length];
      const r = fly(s, id, OVERDRIVE);
      expect(r.done, id).toBe(true);
      expect(r.hits, id).toBe(0);
      s = r.s;
    }
  });

  it('is no slower between the home system’s stations (it doesn’t kick in there)', () => {
    for (const id of stations.slice(1)) expect(fly(spawn('home'), id, OVERDRIVE).t, id).toBeCloseTo(fly(spawn('home'), id, 1).t, 5);
  });

  it('drops out of super speed in a couple of seconds once the pilot takes the stick', () => {
    // flying out at super speed, then let go of the autopilot (no overdrive)
    let s = spawn('home');
    const park = parkFor('invincible', [s.x, s.z]);
    for (let t = 0; t < 4; t += 1 / 60) s = step(s, autopilot(s, 'invincible', park, undefined, OVERDRIVE).input, 1 / 60).ship;
    expect(s.speed).toBeGreaterThan(SHIP.pulse * 2);
    for (let t = 0; t < 2; t += 1 / 60) s = step(s, { throttle: 1, boost: true }, 1 / 60).ship;
    expect(s.speed).toBeLessThanOrEqual(SHIP.pulse + 1);
  });

  it('is cut back to the boost while hunters have it interdicted', () => {
    let s = { ...spawn('home'), x: 0, z: 2600, heading: 0, speed: 0 }; // out in the open
    for (let t = 0; t < 4; t += 1 / 60) s = step(s, { throttle: 1, boost: true, overdrive: OVERDRIVE, interdicted: true }, 1 / 60).ship;
    expect(s.speed).toBeLessThanOrEqual(SHIP.boost + 0.01);
  });

  it('times a trip on the real physics: the jump the same however far, super speed under cruising', () => {
    const from = spawn('home');
    expect(tripTime(from, 'invincible', 'hyper')).toBe(HYPER.length);
    expect(tripTime(from, 'experience', 'hyper')).toBe(HYPER.length);
    const cruise = tripTime(from, 'invincible', 'cruise');
    const quick = tripTime(from, 'invincible', 'super');
    expect(cruise).toBeGreaterThan(15);
    expect(quick).toBeLessThan(cruise * 0.65);
    expect(tripTime(from, 'nope', 'super')).toBeNull();
    expect(tripTime(null, 'marvel', 'super')).toBeNull();
  });
});

describe('the chart', () => {
  it('puts the sun in the middle and everything on it, further out the further away', () => {
    expect(chartAt(0, 0)).toEqual([0.5, 0.5]);
    for (const d of DESTINATIONS) expect(onChart(chartAt(d.at[0], d.at[2])), d.id).toBe(true);
    const r = (id) => {
      const d = destinationById(id);
      const [u, v] = chartAt(d.at[0], d.at[2]);
      return Math.hypot(u - 0.5, v - 0.5);
    };
    expect(r('music')).toBeLessThan(r('invincible')); // (the spiral grows)
    expect(r('home')).toBeLessThan(r('music'));
    expect(r('home')).toBeGreaterThan(0.04); // the home system opens up enough to see
  });

  it('shows the home system on its own, to scale, with deep space off it', () => {
    for (const id of stations) expect(onChart(chartAt(POS(id)[0], POS(id)[2], CHART_VIEWS.home)), id).toBe(true);
    for (const id of worlds) expect(onChart(chartAt(POS(id)[0], POS(id)[2], CHART_VIEWS.home)), id).toBe(false);
  });

  it('points the ship marker the way the nose points, north up', () => {
    expect(chartHeading(0)).toBeCloseTo(-90); // up the chart
    expect(chartHeading(-Math.PI / 2)).toBeCloseTo(0); // to the right (+x)
    expect(Math.abs(chartHeading(Math.PI))).toBeCloseTo(90); // down
  });
});

describe('in words', () => {
  it('says how long and how far', () => {
    expect(formatTime(2.45)).toBe('2.5 s');
    expect(formatTime(14.2)).toBe('14 s');
    expect(formatTime(65)).toBe('1 min 5 s');
    expect(formatTime(null)).toBe('—');
    expect(formatDistance(0)).toBe('Here');
    expect(formatDistance(26)).toBe('100 ship-lengths');
    expect(formatDistance(4000)).toBe('15,400 ship-lengths');
  });
});

function POS(id) {
  return destinationById(id).at;
}

const seededAt = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

describe('a rift', () => {
  it('opens ahead of the ship and off to one side, clear of anything solid, from anywhere', () => {
    let seed = 5;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const clear = (p) => SOLIDS.every((o) => Math.hypot(p[0] - o.at[0], p[1] - o.at[1], p[2] - o.at[2]) > o.r + 8);
    const ahead = (s, p) => {
      const [fx, fz] = [-Math.sin(s.heading), -Math.cos(s.heading)];
      return (p[0] - s.x) * fx + (p[2] - s.z) * fz;
    };
    // parked at every place (facing it), everywhere a new ship starts, and out in the open
    const ships = [...ORDER.map((id) => ({ ...parkFor(id, [0, 0]), y: 0, speed: 0 })), ...Array.from({ length: 80 }, (_, i) => ({ ...startAt(seededAt(i + 1)), speed: 0 })), { x: 0, y: 0.3, z: 400, heading: 0, speed: 0 }, { x: 2000, y: 100, z: -1500, heading: 2.2, speed: 0 }];
    for (const s of ships) {
      const p = riftSpot(s, rand);
      expect(p, `${s.x},${s.z}`).not.toBeNull();
      expect(clear(p), `${s.x},${s.z}: clear`).toBe(true);
      expect(ahead(s, p)).toBeGreaterThan(20);
      expect(ahead(s, p)).toBeLessThan(100);
      expect(Math.abs(p[1] - s.y)).toBeLessThan(1e-9);
    }
  });

  it('comes out at a place or a wonder, never where you are and never the Maw', () => {
    const seen = new Set();
    let seed = 3;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 300; i++) {
      const from = i % 2 ? 'marvel' : null;
      const id = riftExit(from, rand);
      expect(GOALS[id], id).toBeTruthy();
      expect(id).not.toBe(from);
      expect(id).not.toBe(MAW.id);
      expect(id.includes('-')).toBe(false);
      seen.add(id);
    }
    expect(seen.has('aurelia')).toBe(true);
    expect(seen.has('home')).toBe(true);
  });
});
