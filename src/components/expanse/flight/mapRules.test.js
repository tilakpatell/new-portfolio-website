import { describe, expect, it } from 'vitest';
import { FULL_SCALES, MAP_KEEP, MINI, MAP_CELL, bearingOf, biomeColour, cellAddress, compassPoint, markersOf, miniScale, poiRows, project, unproject, visibleLeaves } from './mapRules';
import { planetSpecOf } from '../../../lib/land/flight/planetSpec';
import { forwardOf } from './flightRules';

const cells = import.meta.glob('../../../lib/net/cells.js', { eager: true });

describe('the map’s numbers', () => {
  it('keeps the plan’s: 256 rasters, a 240 px disc (160 on a phone), three zooms', () => {
    expect(MAP_KEEP).toBe(256);
    expect(MINI.desktop).toBe(240);
    expect(MINI.phone).toBe(160);
    expect(FULL_SCALES).toHaveLength(3);
    // the same ground in the disc on a phone as on a desktop
    expect(miniScale(160) * 80).toBeCloseTo(miniScale(240) * 120, 9);
  });
  it('addresses the shared world’s cell, NET_CELL wherever lib/net says it', () => {
    const net = Object.values(cells)[0]?.NET_CELL;
    expect(MAP_CELL).toBe(net ?? 2048);
    expect(cellAddress(0, 0)).toBe('0,0');
    expect(cellAddress(2100, -1)).toBe('1,-1');
    expect(cellAddress(-0.5, 4095.9)).toBe('-1,1');
  });
});

describe('project', () => {
  const view = { centre: [1000, -500], scale: 16 };
  it('puts north (−z) up and east (+x) right, from the centre', () => {
    expect(project([1000, -500], view)).toEqual([0, 0]);
    expect(project([1160, -500], view)).toEqual([10, 0]);
    expect(project([1000, -660], view)).toEqual([0, -10]);
  });
  it('round-trips through unproject, north up and heading up', () => {
    for (const v of [view, { ...view, headingUp: true, heading: 0.7 }, { ...view, headingUp: true, heading: -2.9 }]) {
      for (const p of [[1234, -88], [-5000, 9000], [1000, -500]]) {
        const back = unproject(project(p, v), v);
        expect(back[0]).toBeCloseTo(p[0], 6);
        expect(back[1]).toBeCloseTo(p[1], 6);
      }
    }
  });
  it('puts the nose up when heading up, whatever the heading', () => {
    for (const yaw of [0, 0.7, Math.PI / 2, -2.5]) {
      const [fx, , fz] = forwardOf({ pitch: 0, yaw });
      const [px, py] = project([1000 + fx * 160, -500 + fz * 160], { ...view, headingUp: true, heading: yaw });
      expect(px).toBeCloseTo(0, 6);
      expect(py).toBeCloseTo(-10, 6);
    }
  });
  it('does not move a point when the floating origin shifts: the map is in world metres', () => {
    const before = project([3000, 4000], view);
    // (the origin's `at` is the renderer's business; the map never reads it)
    const after = project([3000, 4000], { ...view, at: [2048, 0, 2048] });
    expect(after).toEqual(before);
  });
});

describe('visibleLeaves', () => {
  it('lists the 2 km squares the disc touches, the one under the centre first', () => {
    const keys = visibleLeaves([100, 100], 120, 16);
    expect(keys[0]).toBe('map:0:0');
    expect(new Set(keys)).toEqual(new Set(['map:-1:-1', 'map:0:-1', 'map:-1:0', 'map:0:0']));
    expect(visibleLeaves([1024, 1024], 10, 16)).toEqual(['map:0:0']);
  });
  it('grows with the radius', () => {
    expect(visibleLeaves([0, 0], 500, 16).length).toBeGreaterThan(visibleLeaves([0, 0], 120, 16).length);
  });
});

describe('biomeColour', () => {
  const spec = planetSpecOf('hoth');
  const hex = /^#[0-9a-f]{6}$/;
  it('is the first biome’s the planet’s low colour, at its base', () => {
    expect(biomeColour(spec, 0, spec.biomes[0].base)).toBe(spec.palette.low);
  });
  it('is a colour from the planet’s palette for every biome, darker under its base and lighter over it', () => {
    const lum = (h) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
    for (const id of ['hoth', 'tatooine', 'mustafar', 'kamino']) {
      const s = planetSpecOf(id);
      s.biomes.forEach((b, i) => {
        const at = biomeColour(s, i, b.base);
        expect(at).toMatch(hex);
        expect(lum(biomeColour(s, i, b.base - 80))).toBeLessThan(lum(at));
        expect(lum(biomeColour(s, i, b.base + 80))).toBeGreaterThanOrEqual(lum(at));
      });
    }
  });
  it('tells water from land: a sunken biome is bluer than the ground', () => {
    const sea = spec.biomes.findIndex((b) => b.id === 'sea');
    const c = biomeColour(spec, sea, spec.biomes[sea].base);
    expect(parseInt(c.slice(5, 7), 16)).toBeGreaterThan(parseInt(c.slice(1, 3), 16));
  });
});

describe('bearings and the POI list', () => {
  const ship = { x: 0, z: 0, yaw: 0 };
  it('reads a bearing off the nose, + to the right, and a compass point from north', () => {
    expect(bearingOf(ship, [0, -100]).rel).toBeCloseTo(0, 9);
    expect(bearingOf(ship, [100, 0]).rel).toBeCloseTo(Math.PI / 2, 9);
    expect(bearingOf(ship, [100, 0]).compass).toBeCloseTo(Math.PI / 2, 9);
    expect(bearingOf({ ...ship, yaw: Math.PI / 2 }, [-100, 0]).rel).toBeCloseTo(0, 9);
    expect(bearingOf(ship, [0, 250]).dist).toBe(250);
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(Math.PI / 2)).toBe('E');
    expect(compassPoint(-Math.PI / 4)).toBe('NW');
    expect(compassPoint(Math.PI)).toBe('S');
  });
  it('lists every POI nearest first, two of one name both kept, each its own id', () => {
    const spec = { pois: [{ id: 'a', name: 'Imperial outpost', at: [5000, 0] }, { id: 'b', name: 'Imperial outpost', at: [-1000, 0] }, { id: 'c', name: 'Echo Base', at: [0, -3000] }] };
    const rows = poiRows(spec, ship);
    expect(rows.map((r) => r.id)).toEqual(['b', 'c', 'a']);
    expect(rows.map((r) => r.name)).toEqual(['Imperial outpost', 'Echo Base', 'Imperial outpost']);
    expect(rows[0]).toMatchObject({ dist: 1000, point: 'W', far: '1.0 km' });
    expect(poiRows({ pois: [] }, ship)).toEqual([]);
  });
});

describe('markersOf', () => {
  const spec = planetSpecOf('hoth');
  it('draws the POIs and a waypoint, and no one else when nothing online is there', () => {
    const m = markersOf({ spec, waypoint: { id: 'echo-base', name: 'Echo Base', at: [1200, -800] } });
    expect(m.filter((k) => k.kind === 'poi').map((k) => k.label)).toEqual(['Echo Base']);
    expect(m.find((k) => k.kind === 'waypoint')).toMatchObject({ at: [1200, -800], label: 'Echo Base' });
    expect(m.some((k) => ['pilot', 'built', 'occurrence'].includes(k.kind))).toBe(false);
  });
  it('draws pilots by callsign, built things by type and occurrences by name when they are given', () => {
    const m = markersOf({
      spec,
      pilots: [{ id: 'p1', name: 'Rogue 2', pose: { x: 10, y: 50, z: 20 } }, { id: 'p2', name: 'Lost', pose: { x: NaN, z: 0 } }],
      built: [{ id: 'e1', entity_type: 'turret', x: 30, z: 40 }, { id: 'e2', type: 'beacon', x: 1, z: 2 }],
      occurrences: [{ id: 'o1', kind: 'wreck', name: 'A wreck', at: [5, 6] }],
    });
    expect(m.filter((k) => k.kind === 'pilot')).toEqual([{ kind: 'pilot', id: 'p1', at: [10, 20], label: 'Rogue 2' }]);
    expect(m.filter((k) => k.kind === 'built').map((k) => [k.at, k.label])).toEqual([[[30, 40], 'turret'], [[1, 2], 'beacon']]);
    expect(m.find((k) => k.kind === 'occurrence')).toMatchObject({ at: [5, 6], label: 'A wreck', icon: 'wreck' });
  });
});
