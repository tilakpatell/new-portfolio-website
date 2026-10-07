import { describe, expect, it } from 'vitest';
import { LANDINGS } from './landings';
import { STYLES } from './ground';
import { vec } from '../foot';
import { biomeAt, classify, fromLatLon, latLonOf, towardLand, uvOf } from './biomes';

const HEX = /^#[0-9a-f]{6}$/i;
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const pick = (id, hex, at = null) => biomeAt(LANDINGS[id], rgb(hex), at).id;

describe('a landing’s biome, from the colour of the map under it', () => {
  it('classes a colour by hue, saturation and lightness', () => {
    const c = classify(rgb('#ff0000'));
    expect(c.h).toBeCloseTo(0, 5);
    expect(c.s).toBeCloseTo(1, 5);
    expect(c.l).toBeCloseTo(0.5, 5);
    expect(classify(rgb('#00ff00')).h).toBeCloseTo(120, 5);
    expect(classify(rgb('#808080')).s).toBe(0);
  });

  it('finds Middle-earth’s places on Tolkien’s map', () => {
    expect(pick('middleearth', '#5a8a3a')).toBe('shire');
    expect(pick('middleearth', '#3a3030')).toBe('mordor');
    expect(pick('middleearth', '#c8a86a')).toBe('harad');
    expect(pick('middleearth', '#9a9a9a')).toBe('mountains');
    expect(pick('middleearth', '#2a4a8a')).toBe('sea');
    expect(pick('middleearth', '#23331c')).toBe('forest');
  });

  it('finds New Mexico’s, the Caribbean’s, Invincible’s, C-137’s and Earth’s', () => {
    expect(pick('breakingbad', '#d8b07e')).toBe('desert');
    expect(pick('breakingbad', '#f4f2ec')).toBe('sands');
    expect(pick('breakingbad', '#5c5a52')).toBe('mountains');
    expect(pick('breakingbad', '#3b3430')).toBe('malpais');
    expect(pick('breakingbad', '#d8b07e', [35.5, 0.5])).toBe('city');
    // (gypsum up north is the ranges' snow)
    expect(pick('breakingbad', '#f4f2ec', [40, 0])).not.toBe('sands');
    expect(pick('caribbean', '#3e7f34')).toBe('beach');
    expect(pick('caribbean', '#0a5089')).toBe('sea');
    expect(pick('caribbean', '#41c3c6')).toBe('reef');
    expect(pick('invincible', '#e8b088')).toBe('badlands');
    expect(pick('invincible', '#4a1e14')).toBe('city');
    expect(pick('rickmorty', '#7a4ab0')).toBe('hills');
    expect(pick('rickmorty', '#2a9a9a')).toBe('street');
    expect(pick('travel', '#eef2f6')).toBe('ice');
    expect(pick('travel', '#1a3a7a')).toBe('sea');
    expect(pick('travel', '#5a7a3a')).toBe('land');
  });

  it('finds Tortuga by where it is, whatever its colour', () => {
    const tortuga = LANDINGS.caribbean.biomes.find((b) => b.id === 'tortuga');
    const [lat, lon] = tortuga.near;
    expect(pick('caribbean', '#3e7f34', [lat, lon])).toBe('tortuga');
    expect(pick('caribbean', '#3e7f34', [lat + 30, lon])).toBe('beach');
  });

  it('hands back the biome’s own ground, sky and scatter, else the planet’s', () => {
    const me = LANDINGS.middleearth;
    const mordor = biomeAt(me, rgb('#3a3030'));
    expect(mordor.ground).toEqual({ style: 'sand', colors: ['#3a3330', '#4a403a', '#241e1c'] });
    expect(mordor.sky).toMatchObject({ zenith: '#3a2420', horizon: '#8a3a20', sun: '#ff6a30' });
    expect(mordor.title).toBe('Mordor');
    const shire = biomeAt(me, rgb('#5a8a3a'));
    expect(shire.ground).toBe(me.ground);
    expect(shire.sky).toBe(me.sky);
    expect(shire.things).toBe(me.things);
    expect(shire.scatter).toBe(me.scatter);
    expect(shire.title).toBe(me.title);
  });

  it('gives a landing with no biomes its own ground, as the default', () => {
    const office = LANDINGS.office;
    const b = biomeAt(office, rgb('#ffffff'));
    expect(b.id).toBe('default');
    expect(b.ground).toBe(office.ground);
    expect(b.sky).toBe(office.sky);
    expect(b.scatter).toBe(office.scatter);
  });

  it('gives every biome a known ground, whole skies, and the last one no test (the fallback)', () => {
    for (const [id, l] of Object.entries(LANDINGS)) {
      if (!l.biomes) continue;
      const last = l.biomes.at(-1);
      expect(last.match, `${id}'s last biome`).toBeUndefined();
      expect(last.near, `${id}'s last biome`).toBeUndefined();
      expect(last.sea, `${id}'s last biome is land`).toBeFalsy();
      for (const b of l.biomes) {
        if (b.ground) {
          expect(STYLES[b.ground.style], `${id}/${b.id}`).toBeTruthy();
          for (const c of b.ground.colors) expect(c, `${id}/${b.id}`).toMatch(HEX);
        }
        if (b.sky) for (const k of ['zenith', 'horizon', 'sun']) expect(b.sky[k], `${id}/${b.id} ${k}`).toMatch(HEX);
      }
    }
  });
});

describe('a spot over the sea moves on to land', () => {
  // a world that's sea west of u 0.5 and land east of it; [u, 0, 0] the sampler hands back
  const half = ([u]) => [u, 0, 0];
  const sea = ([u]) => u < 0.5;
  const onEquator = (u) => fromLatLon(0, u * 360 - 180);

  it('walks from the sea to the nearest land', () => {
    const n = onEquator(0.45);
    const to = towardLand(n, half, sea);
    expect(uvOf(to)[0]).toBeGreaterThanOrEqual(0.5);
    // (the nearest: no further in than a stride past the coast)
    expect(uvOf(to)[0]).toBeLessThan(0.5 + 0.02 / (Math.PI * 2) + 1e-9);
    expect(Math.hypot(...to)).toBeCloseTo(1, 9);
  });

  it('goes the way it was heading when land is as near both ways', () => {
    // sea in a band round u 0.5, land both sides of it
    const band = ([u]) => Math.abs(u - 0.5) < 0.02;
    const n = onEquator(0.5);
    const east = fromLatLon(0, 10);
    const west = fromLatLon(0, -10);
    expect(uvOf(towardLand(n, half, band, { track: vec.add(east, n, -1) }))[0]).toBeGreaterThan(0.5);
    expect(uvOf(towardLand(n, half, band, { track: vec.add(west, n, -1) }))[0]).toBeLessThan(0.5);
  });

  it('leaves a spot on land where it is', () => {
    const n = onEquator(0.7);
    expect(towardLand(n, half, sea)).toEqual(n);
  });

  it('leaves a spot with no land in reach where it is, after its steps', () => {
    let looked = 0;
    const n = onEquator(0.2);
    const all = () => {
      looked++;
      return true;
    };
    expect(towardLand(n, half, all, { steps: 5, ways: 4 })).toEqual(n);
    expect(looked).toBe(1 + 5 * 4);
  });
});

describe('where on the map a spot is', () => {
  it('reads the planet’s colour map as the bakes lay it (sphere.mjs’s toUv)', () => {
    expect(uvOf([0, 1, 0])[1]).toBe(0);
    expect(uvOf([0, -1, 0])[1]).toBe(1);
    // (u 0 at −x, going round toward +z)
    expect(uvOf([-1, 0, 0])).toEqual([0, 0.5]);
    expect(uvOf([0, 0, 1])[0]).toBeCloseTo(0.25, 6);
    expect(uvOf([1, 0, 0])[0]).toBeCloseTo(0.5, 6);
  });

  it('turns a spot into latitude and longitude and back', () => {
    for (const [lat, lon] of [
      [0, 0],
      [45, -60],
      [-30, 120],
      [70, 179],
    ]) {
      const n = fromLatLon(lat, lon);
      expect(Math.hypot(...n)).toBeCloseTo(1, 9);
      const [a, b] = latLonOf(n);
      expect(a).toBeCloseTo(lat, 6);
      expect(b).toBeCloseTo(lon, 6);
    }
    // (longitude 0 is the map's middle, u 0.5)
    expect(uvOf(fromLatLon(0, 0))[0]).toBeCloseTo(0.5, 9);
  });
});
