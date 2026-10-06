import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAP_NAMES, MODEL_PLANETS, farFile, mapFile, mapPlanet } from './planets';
import { ORDER } from './layout';

describe('the planet maps by detail level', () => {
  it('gives a strong card the -hq set, a desktop the standard file, and a phone or a weak device the -sm half', () => {
    expect(mapFile('earth', 'ultra')).toBe('earth-hq.webp');
    expect(mapFile('sky', 'ultra')).toBe('sky-hq.webp');
    expect(mapFile('earth', 'high')).toBe('earth.webp');
    expect(mapFile('earth', 'mid')).toBe('earth-sm.webp');
    expect(mapFile('earth', 'low')).toBe('earth-sm.webp');
  });
  it('gives a strong card the standard file for a map that has no -hq', () => {
    expect(mapFile('transformers', 'ultra')).toBe('transformers.webp');
    expect(mapFile('invincible-night', 'ultra')).toBe('invincible-night.webp');
    expect(mapFile('transformers', 'mid')).toBe('transformers-sm.webp');
  });
  it('is the standard file when no level is given', () => {
    expect(mapFile('marvel')).toBe('marvel.webp');
  });
});

describe('the fandoms’ baked maps', () => {
  it('come in all three sizes where they need them, and one where they don’t', () => {
    expect(mapFile('middleearth', 'ultra')).toBe('middleearth-hq.webp');
    expect(mapFile('caribbean-clouds', 'mid')).toBe('caribbean-clouds-sm.webp');
    expect(mapFile('middleearth-night', 'ultra')).toBe('middleearth-night.webp');
    expect(mapFile('middleearth-night', 'low')).toBe('middleearth-night-sm.webp');
    expect(mapFile('middleearth-glow', 'mid')).toBe('middleearth-glow.webp');
  });
  it('are all there: every file the loader can ask for, at every level', () => {
    const dir = resolve('public/textures/universe');
    const missing = [];
    for (const level of ['low', 'mid', 'high', 'ultra']) for (const name of MAP_NAMES) if (!existsSync(resolve(dir, mapFile(name, level)))) missing.push(mapFile(name, level));
    expect([...new Set(missing)]).toEqual([]);
  });
});

describe('a far planet’s maps, at their small size until it’s near', () => {
  it('knows which planet each of the fandoms’ maps is on (Earth’s are the travel planet’s), and that the sky, the sun and the stations’ metal are no one planet’s', () => {
    expect(mapPlanet('transformers')).toBe('transformers');
    expect(mapPlanet('middleearth-clouds')).toBe('middleearth');
    expect(mapPlanet('earth-night')).toBe('travel');
    for (const name of ['sky', 'sun', 'plates', 'hull-normal', 'paper-normal']) expect(mapPlanet(name)).toBe(null);
    for (const name of MAP_NAMES) if (mapPlanet(name)) expect(ORDER).toContain(mapPlanet(name));
  });
  it('starts a desktop on the -sm copy of a planet’s own map, and a phone on what it has anyway', () => {
    expect(farFile('transformers', 'high')).toBe('transformers-sm.webp');
    expect(farFile('earth', 'ultra')).toBe('earth-sm.webp');
    expect(farFile('earth', 'mid')).toBe(null); // (it's the -sm already)
  });
  it('leaves alone what has no smaller copy, and what isn’t one planet’s', () => {
    expect(farFile('transformers-glow-sm', 'high')).toBe(null);
    expect(farFile('middleearth-glow', 'high')).toBe(null);
    expect(farFile('sky', 'high')).toBe(null);
    expect(farFile('sun', 'ultra')).toBe(null);
  });
  it('names its models by planets that are on the map', () => {
    for (const id of MODEL_PLANETS) expect(ORDER).toContain(id);
  });
});
