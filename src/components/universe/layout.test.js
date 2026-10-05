import { describe, expect, it } from 'vitest';
import { HOME_RADIUS, MAP_RADIUS, ORDER, POSITIONS, REACH, RIM, SUN, keyStep, next, nextWorld, parseId, prev } from './layout';
import { byId } from './universes';
import { DEEP } from './deep';

describe('the map layout', () => {
  it('keeps every universe clear of the others, moons and all', () => {
    for (const a of ORDER) {
      for (const b of ORDER) {
        if (a >= b) continue;
        const [ax, , az] = POSITIONS[a];
        const [bx, , bz] = POSITIONS[b];
        expect(Math.hypot(ax - bx, az - bz), `${a} and ${b}`).toBeGreaterThan(REACH[a] + REACH[b]);
      }
    }
  });

  it('keeps every universe inside the map radius', () => {
    for (const id of ORDER) expect(Math.hypot(POSITIONS[id][0], POSITIONS[id][2]) + REACH[id]).toBeLessThanOrEqual(MAP_RADIUS + 1e-9);
  });

  it('keeps the stations in the home system and sends the fandoms far out, well apart, with a journey between any two', () => {
    const fandoms = ORDER.filter((id) => byId(id).kind !== 'core');
    for (const id of ORDER) {
      const r = Math.hypot(POSITIONS[id][0], POSITIONS[id][2]);
      if (byId(id).kind === 'core') expect(r + REACH[id], id).toBeLessThan(HOME_RADIUS);
      else {
        expect(r - REACH[id], id).toBeGreaterThan(HOME_RADIUS + 750); // out past the home system: a real trip
        expect(Math.abs(POSITIONS[id][1]) + REACH[id], id).toBeLessThan(DEEP.ceiling); // under deep space's ceiling
      }
    }
    for (const a of fandoms) for (const b of fandoms) if (a < b) expect(Math.hypot(...POSITIONS[a].map((v, i) => v - POSITIONS[b][i])) - REACH[a] - REACH[b], `${a} and ${b}`).toBeGreaterThan(750);
  });

  it('rings the map with a rim of ice, out past everything and inside the edge', () => {
    expect(RIM.inner).toBeGreaterThan(MAP_RADIUS + 200);
    expect(RIM.outer).toBeLessThan(DEEP.edge - 300);
    expect(RIM.outer).toBeGreaterThan(RIM.inner + 300);
  });

  it('steps through the map in order and wraps', () => {
    expect(next('home')).toBe('experience');
    expect(next('terminal')).toBe('starwars');
    expect(next('starwars')).toBe('music');
    expect(next('travel')).toBe('caribbean');
    expect(next('caribbean')).toBe('invincible');
    expect(next('invincible')).toBe('home');
    expect(prev('home')).toBe('invincible');
    expect(next(null)).toBe('home');
    expect(prev(null)).toBe('invincible');
  });

  it('keeps the sun clear of everything', () => {
    for (const id of ORDER) expect(Math.hypot(POSITIONS[id][0], POSITIONS[id][2]), id).toBeGreaterThan(SUN.r + REACH[id] + 0.5);
  });

  it('reads only real ids from the URL', () => {
    expect(parseId('marvel')).toBe('marvel');
    for (const bad of ['MARVEL', '__proto__', 'constructor', 'toString', '', undefined, null, 42]) expect(parseId(bad)).toBeNull();
  });

  it('finds the next world page, skipping the ones that are not', () => {
    expect(nextWorld('office').id).toBe('rickmorty');
    expect(nextWorld('rickmorty').id).toBe('gaming');
    expect(nextWorld('gaming').id).toBe('travel');
    expect(nextWorld('travel').id).toBe('caribbean');
    expect(nextWorld('caribbean').id).toBe('invincible');
    expect(nextWorld('invincible').id).toBe('starwars');
    expect(nextWorld('starwars').id).toBe('music');
    expect(nextWorld('albuquerque')?.id).toBe('starwars'); // not an id: starts from the top
    expect(nextWorld(null).id).toBe('starwars');
    expect(nextWorld('home').id).toBe('starwars'); // the stations aren't world pages
  });

  it('maps the focus group keys and leaves the rest alone', () => {
    expect(keyStep('ArrowRight', 'starwars')).toBe('music');
    expect(keyStep('ArrowDown', 'starwars')).toBe('music');
    expect(keyStep('ArrowLeft', 'starwars')).toBe('terminal');
    expect(keyStep('ArrowUp', null)).toBe('invincible');
    expect(keyStep('Home', 'office')).toBe('home');
    expect(keyStep('End', 'office')).toBe('invincible');
    expect(keyStep('Enter', 'office')).toBeUndefined();
    expect(keyStep('a', 'office')).toBeUndefined();
  });
});

describe('the asteroid belt', () => {
  it('sits in the gap between the stations and the planets, touching neither', async () => {
    const { BELT } = await import('./layout');
    for (const id of ORDER) {
      const r = Math.hypot(POSITIONS[id][0], POSITIONS[id][2]);
      expect(r + REACH[id] < BELT.inner || r - REACH[id] > BELT.outer, id).toBe(true);
    }
    expect(BELT.inner).toBeGreaterThan(SUN.r);
  });
});
