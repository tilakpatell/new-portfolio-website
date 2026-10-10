import { describe, expect, it } from 'vitest';
import { LANDABLE } from '../entry';
import { byId } from '../universes';
import { LANDINGS } from './landings';
import { ENTER_KEY, beaconOf, enterLabel, flownInto, wayIn, worldName } from './wayin';

describe('the way in from a landing', () => {
  it('names the world the planet is the way into', () => {
    expect(enterLabel('breakingbad')).toBe('Enter Albuquerque');
    expect(enterLabel('rickmorty')).toBe('Enter Dimension C-137');
    expect(enterLabel('middleearth')).toBe('Enter Middle-earth');
  });

  it('shows the whole time the crew are out, and opens the planet’s page', () => {
    for (const phase of ['out', 'walk', 'down']) expect(wayIn({ id: 'breakingbad', phase })).toEqual({ id: 'breakingbad', label: 'Enter Albuquerque', key: ENTER_KEY });
  });

  it('hides while the ship comes down, while you board and lift off, and off foot', () => {
    for (const phase of ['land', 'board', 'lift', null, undefined, 'nonsense']) expect(wayIn({ id: 'breakingbad', phase })).toBeNull();
  });

  it('hides while the page is leaving or the ship is crashing', () => {
    expect(wayIn({ id: 'breakingbad', phase: 'walk', frozen: true })).toBeNull();
    expect(wayIn({ id: 'breakingbad', phase: 'walk', crashing: true })).toBeNull();
  });

  it('only for a planet with a page of its own', () => {
    expect(wayIn({ id: 'home', phase: 'walk' })).toBeNull(); // (a station: no landing, and not a world)
    expect(wayIn({ id: 'nowhere', phase: 'walk' })).toBeNull();
    expect(wayIn({ id: null, phase: 'walk' })).toBeNull();
  });

  it('marks the door on every landing that has one', () => {
    for (const [id, landing] of Object.entries(LANDINGS)) {
      const b = beaconOf(id, landing);
      expect(b, id).not.toBeNull();
      expect(b.label).toBe(enterLabel(id));
      const door = landing.things.find((t) => t.door);
      if (door) {
        expect(b.thing).toBe(landing.things.indexOf(door));
        expect(b.at).toBeNull();
      }
    }
  });

  it('puts a door of its own ahead of the ship on a landing with none', () => {
    const b = beaconOf('breakingbad', { things: [{ kind: 'mesa', at: [0, 80], r: 18 }] });
    expect(b.thing).toBeNull();
    expect(b.at).toHaveLength(2);
    expect(Math.hypot(...b.at)).toBeGreaterThan(8); // (clear of the ship)
    expect(b.reach).toBeGreaterThan(0);
    expect(b.door).toBe('Albuquerque');
  });

  it('marks nothing where there is no world to go into', () => {
    expect(beaconOf('home', { things: [] })).toBeNull();
    expect(beaconOf('breakingbad', null)).toBeNull();
  });

  it('flown down into the air, goes straight into the world, never a landing first', () => {
    for (const p of LANDABLE) {
      expect(flownInto(p.id), p.id).toBe(p.id);
      expect(byId(p.id).to, p.id).toMatch(/^\//);
      expect(worldName(p.id), p.id).toBeTruthy();
    }
    // (Bird World: straight to Birdperson, not a landing beside the ship)
    expect(flownInto('birdworld')).toBe('birdworld');
    expect(byId('birdworld').to).toBe('/c-137/birdworld');
    expect(worldName('breakingbad')).toBe('Albuquerque');
  });

  it('flies into nothing where there is no world', () => {
    expect(flownInto('home')).toBeNull();
    expect(flownInto('nowhere')).toBeNull();
    expect(flownInto(null)).toBeNull();
  });
});
