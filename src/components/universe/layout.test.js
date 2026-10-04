import { describe, expect, it } from 'vitest';
import { MAP_RADIUS, ORDER, POSITIONS, REACH, SUN, keyStep, next, nextWorld, parseId, prev } from './layout';

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

  it('steps through the map in order and wraps', () => {
    expect(next('home')).toBe('experience');
    expect(next('terminal')).toBe('starwars');
    expect(next('starwars')).toBe('music');
    expect(next('travel')).toBe('home');
    expect(prev('home')).toBe('travel');
    expect(next(null)).toBe('home');
    expect(prev(null)).toBe('travel');
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
    expect(nextWorld('rickmorty').id).toBe('starwars'); // gaming and travel have no world page
    expect(nextWorld('starwars').id).toBe('music');
    expect(nextWorld('albuquerque')?.id).toBe('starwars'); // not an id: starts from the top
    expect(nextWorld(null).id).toBe('starwars');
    expect(nextWorld('home').id).toBe('starwars'); // the stations aren't world pages
  });

  it('maps the focus group keys and leaves the rest alone', () => {
    expect(keyStep('ArrowRight', 'starwars')).toBe('music');
    expect(keyStep('ArrowDown', 'starwars')).toBe('music');
    expect(keyStep('ArrowLeft', 'starwars')).toBe('terminal');
    expect(keyStep('ArrowUp', null)).toBe('travel');
    expect(keyStep('Home', 'office')).toBe('home');
    expect(keyStep('End', 'office')).toBe('travel');
    expect(keyStep('Enter', 'office')).toBeUndefined();
    expect(keyStep('a', 'office')).toBeUndefined();
  });
});
