import { describe, expect, it } from 'vitest';
import { HOME_SCALE, HOME_SPREAD, LENGTH } from './scale';
import { LENGTH as SHIP_MODEL_LENGTH } from './shipModels';
import { POSITIONS, SUN } from './layout';
import { PLANETS, SHIP } from './ship';
import { TYPES } from './traffic';
import { STAR_DESTROYER } from './setpieces';
import { poseFor } from './poses';
import { UNIVERSES } from './universes';

const stations = PLANETS.filter((p) => UNIVERSES.find((u) => u.id === p.id).kind === 'core');
const worlds = PLANETS.filter((p) => {
  const u = UNIVERSES.find((x) => x.id === p.id);
  return u.kind !== 'core' && !u.portal;
});
const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

describe('the home system against the ships (scale.js)', () => {
  it('has one ship length, and one ratio for the home system', () => {
    expect(SHIP_MODEL_LENGTH).toBe(LENGTH);
    expect(HOME_SPREAD).toBeCloseTo(Math.cbrt(HOME_SCALE), 9);
    // (universes.js writes HOME_SCALE out, having no imports: Home's base size is 0.6)
    expect(UNIVERSES.find((u) => u.id === 'home').size).toBeCloseTo(0.6 * 7 * HOME_SCALE, 9);
  });

  it('draws every station far bigger than the ship, and the sun bigger again', () => {
    for (const s of stations) expect((2 * s.r) / LENGTH).toBeGreaterThan(80);
    const home = stations.find((s) => s.id === 'home');
    expect((2 * home.r) / LENGTH).toBeGreaterThan(90);
    const biggest = Math.max(...stations.map((s) => s.r));
    expect(SUN.r).toBeGreaterThan(3.5 * biggest);
  });

  it('gives the stations room, but not so much they shrink to specks across it', () => {
    // each station against the gap to the next one round the ring
    const ring = stations.map((s) => ({ ...s, a: Math.atan2(s.at[2], s.at[0]) })).sort((a, b) => a.a - b.a);
    ring.forEach((s, i) => {
      const next = ring[(i + 1) % ring.length];
      expect((2 * s.r) / flat(s.at, next.at)).toBeGreaterThan(0.17);
    });
  });

  it('keeps every station smaller than any world, and the sun under the ceiling', () => {
    const smallest = Math.min(...worlds.map((w) => w.r));
    for (const s of stations) expect(s.r).toBeLessThan(smallest);
    expect(SUN.r).toBeLessThan(SHIP.ceiling - 20);
  });

  it('keeps the sun’s corona and light where the stations sit in it', () => {
    const ring = flat(POSITIONS.home, SUN.at);
    expect(ring / SUN.r).toBeCloseTo(85 / 32, 2);
  });

  // (parking backs off with a station's size, so the parked view gains least:
  // the next station along was 0.55 of the ship on screen at the old scale)
  it('from parked at a station, the next one along looks about as big as the ship', () => {
    const p = poseFor('station');
    const ship = LENGTH / Math.hypot(...p.at.map((v, i) => v - p.eye[i]));
    const others = stations.filter((s) => s.id !== 'home');
    const nearest = others.reduce((a, b) => (flat(a.at, p.eye) < flat(b.at, p.eye) ? a : b));
    const station = 2 * Math.atan(nearest.r / Math.hypot(...nearest.at.map((v, i) => v - p.eye[i])));
    expect(station / ship).toBeGreaterThan(0.9);
  });

  it('no ship out-sizes a station: not the traffic’s Star Destroyer, nor the set piece’s', () => {
    const smallest = Math.min(...stations.map((s) => 2 * s.r));
    for (const [kind, t] of Object.entries(TYPES)) expect(t.size, kind).toBeLessThan(smallest);
    expect(STAR_DESTROYER).toBeLessThan(smallest);
  });
});
