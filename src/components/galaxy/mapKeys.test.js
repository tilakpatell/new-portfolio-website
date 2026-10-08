import { describe, expect, it } from 'vitest';
import { SYSTEMS } from './systems';
import { findSystems, mapKeyAction } from './mapKeys';

const k = (key, o = {}) => ({ key, meta: false, ctrl: false, alt: false, ...o });

describe('mapKeys', () => {
  it('closes on M and Escape, Escape even while typing', () => {
    expect(mapKeyAction(k('m'), { typing: false, canJump: false })).toBe('close');
    expect(mapKeyAction(k('M'), { typing: false, canJump: false })).toBe('close');
    expect(mapKeyAction(k('Escape'), { typing: true, canJump: false })).toBe('close');
    expect(mapKeyAction(k('m'), { typing: true, canJump: false })).toBeNull();
  });
  it('shuts the films panel first when it is open, and leaves the map', () => {
    expect(mapKeyAction(k('Escape'), { typing: false, filmsOpen: true })).toBe('closeFilms');
    expect(mapKeyAction(k('Escape'), { typing: true, filmsOpen: true })).toBe('closeFilms');
    expect(mapKeyAction(k('Escape'), { typing: false, filmsOpen: false })).toBe('close');
    // (only Escape shuts it: M still closes the map, the panel goes with it)
    expect(mapKeyAction(k('m'), { typing: false, filmsOpen: true })).toBe('close');
  });
  it('jumps only with a course to jump to', () => {
    expect(mapKeyAction(k('j'), { typing: false, canJump: true })).toBe('jump');
    expect(mapKeyAction(k('j'), { typing: false, canJump: false })).toBeNull();
  });
  it('finds and zooms, and leaves modified keys alone', () => {
    expect(mapKeyAction(k('/'), { typing: false, canJump: false })).toBe('find');
    expect(mapKeyAction(k('+'), { typing: false })).toBe('zoomIn');
    expect(mapKeyAction(k('='), { typing: false })).toBe('zoomIn');
    expect(mapKeyAction(k('-'), { typing: false })).toBe('zoomOut');
    expect(mapKeyAction(k('0'), { typing: false })).toBe('fit');
    expect(mapKeyAction(k('m', { meta: true }), { typing: false })).toBeNull();
    expect(mapKeyAction(k('+'), { typing: true })).toBeNull();
  });
  it('finds systems by name, the ones that start with it first', () => {
    expect(findSystems('endo', SYSTEMS).map((s) => s.id)).toEqual(['endor']);
    expect(findSystems('  ', SYSTEMS)).toEqual([]);
    const ho = findSystems('o', SYSTEMS, 3);
    expect(ho.length).toBeLessThanOrEqual(3);
    const t = findSystems('t', SYSTEMS);
    const firstNonStart = t.findIndex((s) => !s.name.toLowerCase().startsWith('t'));
    const lastStart = t.map((s) => s.name.toLowerCase().startsWith('t')).lastIndexOf(true);
    if (firstNonStart !== -1) expect(lastStart).toBeLessThan(firstNonStart);
  });
});
