import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FAR_PLACES, FAR_REAL, blend, createFarPlaces, pointsFor, spriteSize } from './farPlaces';
import { WONDERS } from './deep';
import { MOONS, UNIVERSES } from './universes';

describe('far places as light', () => {
  it('blends from the real thing to the light over the last 2,000 before FAR_REAL', () => {
    expect(FAR_REAL).toBe(24000);
    expect(blend(0)).toBe(0);
    expect(blend(21999)).toBe(0);
    expect(blend(22000)).toBe(0);
    expect(blend(24000)).toBe(1);
    expect(blend(90000)).toBe(1);
    const mid = blend(23000);
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.6);
    expect(blend(22500)).toBeLessThan(blend(23500)); // (and only ever up, the further off)
  });

  it('sizes a sprite to keep the place’s angle', () => {
    expect(spriteSize(100, 30000, 24000)).toBeCloseTo(spriteSize(80, 24000, 24000), 9);
    expect(spriteSize(80, 24000, 24000)).toBeCloseTo(80, 9);
    expect(spriteSize(100, 60000, 24000)).toBeCloseTo(40, 9);
  });

  it('gives one point per place, along its true direction, blended by its distance', () => {
    const places = [
      { id: 'a', at: [30000, 0, 0], r: 100, color: '#ff0000' },
      { id: 'b', at: [0, 3000, 4000], r: 50, color: '#00ff00' },
      { id: 'c', at: [1000, 1000, 1000], r: 20, color: '#0000ff' }, // (right on top of the camera’s side: the far plane’s no worry)
    ];
    const pts = pointsFor(places, [0, 0, 0]);
    expect(pts.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    for (const p of pts) expect(Math.hypot(...p.dir)).toBeCloseTo(1, 9);
    expect(pts[0].dir).toEqual([1, 0, 0]);
    expect(pts[0].k).toBe(1);
    expect(pts[0].size).toBeCloseTo(80, 9);
    expect(pts[1].k).toBe(0);
    expect(pts[0].color).toBe('#ff0000');
    // a camera exactly on a place still gets a unit direction
    const on = pointsFor(places, [30000, 0, 0]);
    expect(Math.hypot(...on[0].dir)).toBeCloseTo(1, 9);
  });

  it('has every fandom, every Rick and Morty world, every wonder and the home sun, each coloured', () => {
    const ids = new Set(FAR_PLACES.map((p) => p.id));
    for (const u of UNIVERSES.filter((x) => x.kind !== 'core')) expect(ids.has(u.id), u.id).toBe(true);
    for (const m of MOONS) expect(ids.has(m.id), m.id).toBe(true);
    for (const w of WONDERS) expect(ids.has(w.id), w.id).toBe(true);
    expect(ids.has('sun')).toBe(true);
    expect(ids.size).toBe(FAR_PLACES.length);
    for (const p of FAR_PLACES) {
      expect(p.color, p.id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.r, p.id).toBeGreaterThan(0);
      expect(p.at, p.id).toHaveLength(3);
    }
  });

  it('stands in for a place too small to draw, however near it is (planetLod.js)', () => {
    const places = [
      { id: 'a', at: [0, 3000, 4000], r: 50, color: '#00ff00' },
      { id: 'b', at: [0, 0, 6000], r: 50, color: '#0000ff' },
    ];
    const small = (id) => (id === 'a' ? 1 : id === 'b' ? 0.4 : 0);
    const pts = pointsFor(places, [0, 0, 0], FAR_REAL, small);
    expect(pts[0].k).toBe(1);
    expect(pts[1].k).toBe(0.4);
    // (its size the place's own angle, as ever)
    expect(pts[0].size).toBeCloseTo(spriteSize(50, 5000, FAR_REAL), 9);
    // and past FAR_REAL it's light whatever it's told
    expect(pointsFor([{ id: 'c', at: [30000, 0, 0], r: 50, color: '#ffffff' }], [0, 0, 0], FAR_REAL, () => 0)[0].k).toBe(1);
  });

  it('lights the point of a small place and leaves its hiding to it; hides a far one by its own hand or its group', () => {
    const parent = new THREE.Group();
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 1, 1e6);
    camera.updateMatrixWorld(true);
    const calls = [];
    const group = new THREE.Group();
    const places = [
      { id: 'near', at: [0, 0, -5000], r: 50, color: '#00ff00', hide: (on) => calls.push(['near', on]) },
      { id: 'far', at: [0, 0, -30000], r: 50, color: '#0000ff', hide: (on) => calls.push(['far', on]) },
      { id: 'grouped', at: [30000, 0, 0], r: 50, color: '#ff0000', group },
    ];
    const far = createFarPlaces(parent, { places, skyFar: 24000 });
    const k = far.points.geometry.getAttribute('aK');
    far.update(camera, 1 / 60, null, (id) => (id === 'near' ? 1 : 0));
    expect(k.array[0]).toBe(1); // (its light all there, though it's near)
    expect(k.array[1]).toBe(1);
    expect(calls).toEqual([['far', true]]); // (the near one's hiding is its own: planets.js's setLod)
    expect(group.visible).toBe(false);
    // the small one grown: its light goes; the far one come in: shown again, once
    places[1].at = [0, 0, -3000];
    places[2].at = [3000, 0, 0];
    far.update(camera, 1 / 60, null, () => 0);
    far.update(camera, 1 / 60, null, () => 0);
    expect(k.array[0]).toBe(0);
    expect(calls).toEqual([
      ['far', true],
      ['far', false],
    ]);
    expect(group.visible).toBe(true);
    // (and on dispose, what it hid is shown)
    places[1].at = [0, 0, -30000];
    far.update(camera, 1 / 60);
    far.dispose();
    expect(calls.at(-1)).toEqual(['far', false]);
  });

  it('hides a group it alone hides (the sun, a wonder) once it is too small to draw, however near', () => {
    const parent = new THREE.Group();
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 1, 1e6);
    camera.updateMatrixWorld(true);
    const group = new THREE.Group();
    const far = createFarPlaces(parent, { places: [{ id: 'sun', at: [0, 0, -16000], r: 75, color: '#ffcf6a', group }], skyFar: 24000 });
    const k = far.points.geometry.getAttribute('aK');
    far.update(camera, 1 / 60, null, () => 1);
    expect(k.array[0]).toBe(1);
    expect(group.visible).toBe(false);
    // (fading out under it, drawn again)
    far.update(camera, 1 / 60, null, () => 0.6);
    expect(k.array[0]).toBeCloseTo(0.6, 6);
    expect(group.visible).toBe(true);
    far.update(camera, 1 / 60, null, () => 0);
    expect(k.array[0]).toBe(0);
    expect(group.visible).toBe(true);
    far.dispose();
  });
});
