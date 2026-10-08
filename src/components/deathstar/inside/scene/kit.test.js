import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildLayout } from '../rules/layout';
import { DS1 } from '../rules/stations/ds1';
import { flights, gridCells, groupByMaterial, mergeParts, panelLayout, roomWalls, solidRects, windowsOf } from './kit';

const overlap = (a, b) => a.x0 < b.x1 - 1e-6 && b.x0 < a.x1 - 1e-6 && a.y0 < b.y1 - 1e-6 && b.y0 < a.y1 - 1e-6;
const area = (rects) => rects.reduce((s, r) => s + (r.x1 - r.x0) * (r.y1 - r.y0), 0);
const lightRect = (l) => ({ x0: l.x - l.w / 2, x1: l.x + l.w / 2, y0: l.y, y1: l.y + l.h });

describe('the panel maths of a wall', () => {
  it('cuts a plain 16 m wall into 2 m bays with a rib at each end and between', () => {
    const p = panelLayout(16, 3.2, { bay: 2 });
    expect(p.bays).toHaveLength(8);
    expect(p.ribs).toHaveLength(9);
    expect(p.ribs[0].x0).toBe(0);
    expect(p.ribs.at(-1).x1).toBe(16);
    for (const b of p.bays) expect(b.x1 - b.x0).toBeCloseTo(2, 6);
  });

  it('puts a light grid every 4 m along a lit wall, inside it', () => {
    const { lights } = panelLayout(16, 3.2, { bay: 1.25, lights: true });
    expect(lights.map((l) => l.x)).toEqual([2, 6, 10, 14]);
    for (const l of lights) {
      expect(l.x - l.w / 2).toBeGreaterThan(0);
      expect(l.x + l.w / 2).toBeLessThan(16);
      expect(l.y + l.h).toBeLessThan(3.2);
    }
  });

  it('lights facing walls alike, so a corridor’s grids face each other', () => {
    const { lights } = panelLayout(14, 3.2, { bay: 1.25, lights: true });
    const xs = lights.map((l) => l.x);
    expect(xs).toHaveLength(3);
    expect(xs.map((x) => 14 - x).reverse()).toEqual(xs);
  });

  it('never lays a panel over a rib or a light grid', () => {
    const p = panelLayout(19, 3.2, { bay: 1.25, lights: true });
    const ribs = p.ribs.map((r) => ({ x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1 }));
    expect(p.panels.length).toBeGreaterThan(20);
    expect(p.lights.length).toBe(4);
    for (const panel of p.panels) {
      for (const r of ribs) expect(overlap(panel, r)).toBe(false);
      for (const l of p.lights) expect(overlap(panel, lightRect(l))).toBe(false);
    }
  });

  it('stacks a tall wall’s panels no taller than 2.6 m each', () => {
    const p = panelLayout(64, 26, { bay: 4, lights: true });
    const mids = p.panels.filter((q) => q.kind === 'panel');
    expect(mids.length).toBeGreaterThan(16 * 8);
    for (const q of mids) expect(q.y1 - q.y0).toBeLessThanOrEqual(2.6 + 1e-9);
  });

  it('makes a piece narrower than a bay one plain panel without ribs', () => {
    const p = panelLayout(0.9, 3.2, { bay: 2 });
    expect(p.ribs).toHaveLength(0);
    expect(p.bays).toEqual([{ x0: 0, x1: 0.9, light: false }]);
  });

  it('gives a wall too low for a light grid none', () => {
    expect(panelLayout(8, 1.4, { bay: 2, lights: true }).lights).toHaveLength(0);
  });

  it('leaves out whatever a hole in the wall would cover', () => {
    const hole = { x0: 5.5, x1: 8.5, y0: 0, y1: 2.6 };
    const p = panelLayout(16, 3.2, { bay: 1.25, lights: true, holes: [hole] });
    expect(p.lights.map((l) => l.x)).toEqual([2, 10, 14]);
    for (const q of p.panels) expect(overlap(q, hole)).toBe(false);
    for (const r of p.ribs) expect(overlap(r, hole)).toBe(false);
    // a rib crossing the hole stands on above it
    expect(p.ribs.some((r) => r.x0 > 5.5 && r.x1 < 8.5 && r.y0 === 2.6)).toBe(true);
  });
});

describe('the solid parts of a wall round its holes', () => {
  it('cover all of the wall but the holes, without overlapping', () => {
    const holes = [
      { x0: 2, x1: 4, y0: 0, y1: 2.5 },
      { x0: 6, x1: 9, y0: 1, y1: 2 },
    ];
    const rects = solidRects(12, 3, holes);
    expect(area(rects)).toBeCloseTo(12 * 3 - 2 * 2.5 - 3 * 1, 6);
    for (let i = 0; i < rects.length; i++) {
      for (const h of holes) expect(overlap(rects[i], h)).toBe(false);
      for (let j = i + 1; j < rects.length; j++) expect(overlap(rects[i], rects[j])).toBe(false);
    }
  });

  it('are the whole wall when there is no hole', () => {
    expect(solidRects(5, 3, [])).toEqual([{ x0: 0, x1: 5, y0: 0, y1: 3 }]);
  });
});

describe('a light grid’s squares', () => {
  it('come whole, at least one each way', () => {
    expect(gridCells(1.1, 1.5, 0.16)).toEqual({ cols: 7, rows: 9 });
    expect(gridCells(0.05, 0.05, 0.16)).toEqual({ cols: 1, rows: 1 });
  });
});

describe('a room’s walls from the layout', () => {
  const layout = buildLayout(DS1);

  it('runs a corridor’s walls as four sides, the ends holed by its doors', () => {
    const runs = roomWalls(layout, 'corr327');
    expect(runs).toHaveLength(4);
    const holed = runs.filter((r) => r.holes.length);
    expect(holed).toHaveLength(2);
    expect(holed.map((r) => r.holes[0].door).sort()).toEqual(['bay327-corr', 'corr327-lobby1']);
    for (const r of holed) {
      expect(r.len).toBeCloseTo(3.2, 6);
      expect(r.holes[0].x1 - r.holes[0].x0).toBeCloseTo(2.4, 6);
      expect(r.holes[0].y1 - r.holes[0].y0).toBeCloseTo(2.6, 6);
    }
  });

  it('faces every wall into its room', () => {
    for (const id of ['corr327', 'bay327', 'ctl327', 'lobby1', 'lift1-l2']) {
      const room = layout.rooms.get(id);
      const runs = roomWalls(layout, id);
      expect(runs.length).toBe(4);
      for (const r of runs) {
        const mid = { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
        expect((room.x - mid.x) * r.n.x + (room.z - mid.z) * r.n.z).toBeGreaterThan(0);
      }
    }
  });

  it('holes the bay’s north wall where the control room door stands, 6 m up', () => {
    const north = roomWalls(layout, 'bay327').find((r) => r.holes.some((h) => h.door === 'bay327-ctl'));
    const hole = north.holes.find((h) => h.door === 'bay327-ctl');
    expect(hole.y0).toBeCloseTo(6, 6);
    expect(hole.y1).toBeCloseTo(8, 6);
  });
});

describe('the control room’s windows onto its bay', () => {
  const layout = buildLayout(DS1);
  const ctl = layout.rooms.get('ctl327');

  it('are two, either side of its door and clear of it', () => {
    const wins = windowsOf(ctl, layout);
    expect(wins).toHaveLength(2);
    for (const w of wins) {
      expect(w.z0).toBeCloseTo(-24, 6);
      expect(w.z1).toBeCloseTo(-24, 6);
      const [a, b] = [Math.min(w.x0, w.x1), Math.max(w.x0, w.x1)];
      expect(b <= 21.3 - 0.4 || a >= 22.7 + 0.4).toBe(true);
      expect(a).toBeGreaterThanOrEqual(17);
      expect(b).toBeLessThanOrEqual(27);
      expect(w.y0).toBeGreaterThan(6.8);
      expect(w.y1).toBeLessThan(9);
    }
  });

  it('are cut through the bay’s wall as well as the room’s own', () => {
    const wins = windowsOf(ctl, layout);
    const bay = roomWalls(layout, 'bay327', wins).flatMap((r) => r.holes.filter((h) => !h.door));
    const own = roomWalls(layout, 'ctl327', wins).flatMap((r) => r.holes.filter((h) => !h.door));
    expect(bay).toHaveLength(2);
    expect(own).toHaveLength(2);
  });

  it('are none for a room with no bay beside it', () => {
    expect(windowsOf(layout.rooms.get('corr327'), layout)).toEqual([]);
  });
});

describe('the flights of steps in a room', () => {
  it('find the bay’s ramp apart from its stair and landing', () => {
    const layout = buildLayout(DS1);
    const found = flights(layout.rooms.get('bay327'));
    expect(found.map((f) => f.length).sort((a, b) => a - b)).toEqual([7, 21]);
  });
});

describe('merging the parts of a room', () => {
  const steel = new THREE.MeshStandardMaterial();
  const glow = new THREE.MeshStandardMaterial();

  it('groups parts by material, in the order each material first comes', () => {
    const a = { geo: new THREE.BoxGeometry(), mat: steel };
    const b = { geo: new THREE.BoxGeometry(), mat: glow };
    const c = { geo: new THREE.PlaneGeometry(), mat: steel };
    const groups = groupByMaterial([a, b, c]);
    expect([...groups.keys()]).toEqual([steel, glow]);
    expect(groups.get(steel)).toEqual([a, c]);
  });

  it('leaves out parts with nothing to draw', () => {
    const groups = groupByMaterial([{ geo: null, mat: steel }, { geo: new THREE.BufferGeometry(), mat: glow }, { geo: new THREE.BoxGeometry(), mat: steel }]);
    expect([...groups.keys()]).toEqual([steel]);
  });

  it('makes one mesh a material, keeping every triangle', () => {
    const parts = [
      { geo: new THREE.BoxGeometry(), mat: steel },
      { geo: new THREE.BoxGeometry().translate(2, 0, 0), mat: steel },
      { geo: new THREE.PlaneGeometry(), mat: glow },
      // a shape without an index merges with ones that have one
      { geo: new THREE.BoxGeometry().toNonIndexed(), mat: glow },
    ];
    const group = mergeParts(parts);
    expect(group.children).toHaveLength(2);
    const tris = (m) => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
    const [first, second] = group.children;
    expect(first.material).toBe(steel);
    expect(tris(first)).toBe(24);
    expect(second.material).toBe(glow);
    expect(tris(second)).toBe(2 + 12);
  });
});
