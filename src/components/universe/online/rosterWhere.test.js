import { describe, expect, it } from 'vitest';
import { rosterWhere } from './rosterWhere';
import { UNIVERSE } from './where';
import { POSITIONS } from '../layout';

describe('rosterWhere', () => {
  it('names the region a pilot in the universe is in, after its place', () => {
    const [x, y, z] = POSITIONS.middleearth;
    expect(rosterWhere(UNIVERSE, { x: x + 300, y, z })).toBe('Universe · Near Middle-earth');
  });
  it('says so when they are out in the void between the regions', () => {
    expect(rosterWhere(UNIVERSE, { x: 40000, y: 0, z: 40000 })).toBe('Universe · the void');
  });
  it('names the home system and the Rick and Morty sector', () => {
    expect(rosterWhere(UNIVERSE, { x: 0, y: 0, z: 200 })).toBe('Universe · the home system');
    expect(rosterWhere(UNIVERSE, { x: 0, y: 0, z: -48000 })).toBe('Universe · the Central Finite Curve');
  });
  it('names the place alone without a pose, or anywhere off the map', () => {
    expect(rosterWhere(UNIVERSE, null)).toBe('the universe');
    expect(rosterWhere('/galaxy/hoth', { x: 0, y: 0, z: 0 })).toBe('Hoth');
    expect(rosterWhere('/deathstar', null)).toBe('the Death Star');
  });
});
