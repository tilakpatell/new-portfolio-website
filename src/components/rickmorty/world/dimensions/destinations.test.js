import { describe, expect, it } from 'vitest';
import { AREAS, HOTSPOTS, LINKS, PEOPLE, ROOM_IDS, TASKS } from '../rules';
import { DEST_COL, DESTINATIONS, DIAL, GARAGE_BACK, destArea, linkTarget, portalTarget, validArrive } from './destinations';

const inside = (a, x, z, pad = 0) => x >= a.x0 + pad && x <= a.x1 - pad && z >= a.z0 + pad && z <= a.z1 - pad;
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;

describe('the destinations', () => {
  it('stand in their column, one row each', () => {
    expect(destArea(0)).toEqual({ x0: -470, x1: -330, z0: 875, z1: 925 });
    expect(destArea(3, 40).z0).toBe(1180);
    for (const d of DESTINATIONS) {
      expect(d.area.x0).toBeGreaterThanOrEqual(DEST_COL.x0);
      expect(d.area.x1).toBeLessThanOrEqual(DEST_COL.x1);
      for (const [id, a] of Object.entries(AREAS)) if (id !== d.id) expect(overlap(d.area, a), `${d.id} and ${id}`).toBe(false);
    }
  });
  it('have ids of their own', () => {
    const ids = DESTINATIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect([...ROOM_IDS, 'annex', 'street']).not.toContain(id);
    // and so do their hotspots, people and things to do, among everyone's
    for (const list of [HOTSPOTS, PEOPLE, TASKS]) {
      const all = list.map((o) => o.id);
      expect(new Set(all).size, 'unique ids').toBe(all.length);
    }
  });
  it('put the way in and the way home inside, clear of the edges and apart', () => {
    for (const d of DESTINATIONS) {
      expect(inside(d.area, d.arrive.x, d.arrive.z, 1.5), d.id).toBe(true);
      expect(inside(d.area, d.back.x, d.back.z, 1.5), d.id).toBe(true);
      expect(Math.hypot(d.arrive.x - d.back.x, d.arrive.z - d.back.z)).toBeGreaterThanOrEqual(3);
      for (const o of [...d.people, ...d.hotspots]) expect(inside(d.area, o.x, o.z), `${d.id}: ${o.id}`).toBe(true);
    }
  });
  it('each have a portal home to the garage, and are in the world’s lists', () => {
    for (const d of DESTINATIONS) {
      const home = LINKS.find((l) => l.id === `${d.id}-portal`);
      expect(home).toMatchObject({ area: d.id, kind: 'portal', to: 'garage', arrive: GARAGE_BACK });
      expect(AREAS[d.id]).toEqual(d.area);
      for (const t of d.tasks) expect(TASKS.some((x) => x.id === t.id)).toBe(true);
      // what a talk finishes is one of the place's own things to do
      for (const id of Object.values(d.done)) expect(d.tasks.map((t) => t.id)).toContain(id);
      for (const id of Object.keys(d.done)) expect(d.hotspots.map((h) => h.id)).toContain(id);
    }
  });
});

describe('the dial', () => {
  it('lists the arcade first, then every destination', () => {
    expect(DIAL[0].id).toBe('annex');
    expect(DIAL.map((d) => d.id).slice(1)).toEqual(DESTINATIONS.map((d) => d.id));
  });
  it('sends the garage portal where it’s set, and anything unknown to the arcade', () => {
    expect(portalTarget('nope')).toBe('annex');
    expect(portalTarget(null)).toBe('annex');
    expect(portalTarget(DESTINATIONS[0].id)).toBe(DESTINATIONS[0].id);
    const portal = LINKS.find((l) => l.id === 'garage-portal');
    expect(linkTarget(portal, 'annex')).toBe(portal);
    expect(linkTarget(portal, 'x')).toBe(portal);
    const d = DESTINATIONS[2];
    expect(linkTarget(portal, d.id)).toMatchObject({ to: d.id, arrive: d.arrive });
    // and nothing else is sent anywhere new
    const door = LINKS.find((l) => l.id === 'house-door');
    expect(linkTarget(door, d.id)).toBe(door);
  });
  it('keeps a saved spot that’s still somewhere, and sends the rest to the garage', () => {
    expect(validArrive({ area: 'nowhere', x: 0, z: 0 }, AREAS)).toEqual({ area: 'garage', ...GARAGE_BACK });
    expect(validArrive({ area: 'garage', x: -300, z: 100, face: 0 }, AREAS)).toEqual({ area: 'garage', x: -300, z: 100, face: 0 });
    const d = DESTINATIONS[0];
    expect(validArrive({ area: d.id, ...d.arrive }, AREAS).area).toBe(d.id);
    expect(validArrive({ area: d.id, x: 0, z: 0 }, AREAS).area).toBe('garage');
  });
});

describe('a place’s set of things to find', () => {
  it('names its own hotspots and one of its own tasks, and the map points at the first', () => {
    for (const d of DESTINATIONS.filter((d) => d.collect)) {
      expect(d.tasks.map((t) => t.id)).toContain(d.collect.task);
      for (const id of d.collect.spots) expect(d.hotspots.map((h) => h.id), `${d.id}: ${id}`).toContain(id);
      expect(d.collect.spots.length).toBeGreaterThanOrEqual(2);
      expect(d.goal ?? Object.keys(d.done)[0]).toBeTruthy();
    }
  });
  it('is the Zigerions’ three slips', () => {
    const sim = DESTINATIONS.find((d) => d.id === 'simulation');
    expect(sim.collect).toEqual({ task: 'simulation', spots: ['twins', 'poptart', 'sun'], escape: { s: 45 } });
    expect(sim.people.find((p) => p.id === 'nebulon').y).toBe(3.2);
  });
});
