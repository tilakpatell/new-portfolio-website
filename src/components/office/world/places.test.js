import { describe, expect, it } from 'vitest';
import { COLLIDERS, SEATS, WALLS, seatOf } from './layout';
import { collidersFor, findPath, freeNear, isFree, seatWay, seatYaw } from './paths';
import { AMBLERS, TALK_CLIP, officePlaces } from './places';
import { CLIPS } from '../../../lib/three/clipLibrary';
import { CAST } from '../people';

const BOUNDS = { x0: -15, x1: 15, z0: -8.5, z1: 8.5 };
const places = officePlaces();
const byId = new Map(places.map((p) => [p.id, p]));

describe('a spot clear of everything', () => {
  it('is the point itself when it’s clear, else the nearest clear one', () => {
    const open = { x: 6, z: -1.5 };
    expect(freeNear(open, { colliders: [], walls: [] })).toEqual(open);
    const c = [{ kind: 'circle', x: 0, z: 0, r: 0.5 }];
    const p = freeNear({ x: 0.1, z: 0 }, { colliders: c, walls: [], radius: 0.25 });
    expect(isFree(0, 0, 0.25, c, [])).toBe(false); // (its very middle too)
    expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(0.75 - 1e-6);
    expect(Math.hypot(p.x, p.z)).toBeLessThan(0.85);
  });
});

describe('getting up from a desk', () => {
  const sat = SEATS.filter((s) => s.who);
  it('faces each sitter at their desk, as the set turns the chair', () => {
    for (const s of sat) {
      const yaw = seatYaw(s);
      // (ahead of the chair is the desk)
      const ahead = { x: s.chair.x + Math.sin(yaw) * 0.5, z: s.chair.z + Math.cos(yaw) * 0.5 };
      expect(Math.hypot(ahead.x - s.x, ahead.z - s.z), s.who).toBeLessThan(Math.hypot(s.chair.x - s.x, s.chair.z - s.z));
    }
  });

  it('stands up just ahead of the chair, and steps out round it, clear of everything, to where a way starts', () => {
    let sideways = 0;
    // (Michael's back is to his office's wall: he steps out beside his desk)
    for (const s of sat) {
      const w = seatWay(s);
      expect(Math.hypot(w.stand.x - s.chair.x, w.stand.z - s.chair.z), s.who).toBeCloseTo(0.2, 5);
      expect(w.exit.length, s.who).toBeGreaterThanOrEqual(1);
      const end = w.exit[w.exit.length - 1];
      expect(isFree(end.x, end.z, 0.22, collidersFor(s), WALLS), `${s.who} out at ${end.x.toFixed(2)},${end.z.toFixed(2)}`).toBe(true);
      if (w.exit.length === 2) sideways += 1;
    }
    // (most can step round their chair rather than through it)
    expect(sideways).toBeGreaterThan(sat.length / 2);
  });
});

describe('the office’s places', () => {
  it('each has its spots clear, a need, a time, and a clip the library has', () => {
    for (const p of places) {
      expect(p.spots.length, p.id).toBeGreaterThan(0);
      for (const s of p.spots) expect(isFree(s.x, s.z, 0.25, COLLIDERS, WALLS), `${p.id} at ${s.x.toFixed(2)},${s.z.toFixed(2)}`).toBe(true);
      expect(typeof p.need).toBe('string');
      expect(p.duration).toBeGreaterThan(0);
      if (p.clip) expect(CLIPS[p.clip], `${p.id}: ${p.clip}`).toBeTruthy();
      expect(Number.isFinite(p.face), p.id).toBe(true);
      if (p.with) expect(seatOf(p.with) || p.with === 'erin', p.id).toBeTruthy();
    }
  });

  it('faces each place at what it’s for', () => {
    const coffee = byId.get('coffee');
    // (the counter is north: −z, a yaw of π)
    expect(Math.abs(Math.abs(coffee.face) - Math.PI)).toBeLessThan(0.3);
  });

  it('has everyone who gets up sat somewhere, wanting what their places give, with a way to each', () => {
    for (const a of AMBLERS) {
      expect(CAST[a.who], a.who).toBeTruthy();
      const seat = seatOf(a.who);
      expect(seat, a.who).toBeTruthy();
      const w = seatWay(seat);
      const from = w.exit[w.exit.length - 1];
      for (const id of a.places) {
        const p = byId.get(id);
        expect(p, `${a.who}: ${id}`).toBeTruthy();
        expect(a.needs[p.need], `${a.who} wants ${p.need} for ${id}`).toBeGreaterThan(0);
        const path = findPath(from, p.spots[0], { colliders: collidersFor(seat), walls: WALLS, radius: 0.26, bounds: BOUNDS });
        expect(path, `${a.who} to ${id}`).not.toBeNull();
      }
    }
  }, 30000);

  it('talks with clips the library has', () => {
    for (const [who, c] of Object.entries(TALK_CLIP)) expect(CLIPS[c], `${who}: ${c}`).toBeTruthy();
  });
});
