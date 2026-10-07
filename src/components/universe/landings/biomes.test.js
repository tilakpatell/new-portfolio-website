import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LANDINGS } from './landings';
import { STYLES } from './ground';
import { vec } from '../foot';
import { biomeAt, classify, fromLatLon, latLonOf, readableMap, towardLand, uvOf } from './biomes';

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
    // (the island's middle reads sea on the map's copy: it's too small to show)
    expect(pick('caribbean', '#0a5089', [19.99, 8.63])).toBe('tortuga');
    expect(pick('caribbean', '#3e7f34', [19.945, 8.639])).toBe('tortuga');
    expect(pick('caribbean', '#3e7f34', [20.12, 7.97])).toBe('tortuga');
    expect(pick('caribbean', '#3e7f34', [19.88, 9.3])).toBe('tortuga');
    expect(pick('caribbean', '#3e7f34', [19.57, 8.46])).toBe('beach'); // Port-de-Paix (real 19.94, −72.83), across the channel
    expect(pick('caribbean', '#3e7f34', [49.99, 8.63])).toBe('beach');
  });

  it('names Middle-earth’s places only where the map has them', () => {
    // (the -sm map's own cells: Mirkwood, the Old Forest, Gorgoroth, Near
    // Harad, the conifer belt the bake lays north of 50°, a half-land coast
    // and the polar ice's edge)
    expect(pick('middleearth', '#1c321b', [42, 15.2])).toBe('forest');
    expect(pick('middleearth', '#263829', [38.8, -28.7])).toBe('forest');
    expect(pick('middleearth', '#302a23', [21.3, 26.6])).toBe('mordor');
    expect(pick('middleearth', '#cfae7c', [-0.8, 23.3])).toBe('harad');
    expect(pick('middleearth', '#34472c', [55, -40])).toBe('shire');
    expect(pick('middleearth', '#3a3030', [-30, 150])).not.toBe('mordor');
    expect(pick('middleearth', '#23331c', [-30, 150])).not.toBe('forest');
    expect(pick('middleearth', '#4a5a6a')).toBe('sea');
    expect(pick('middleearth', '#a0b0c0')).toBe('mountains');
    // (Lothlórien's gold reads as grass: it's named by place)
    expect(pick('middleearth', '#596f2c', [36.9, 3.4])).toBe('forest');
    expect(pick('middleearth', '#596f2c', [36.9, 9])).toBe('shire');
  });

  it('names New Mexico’s places where the bake lays them', () => {
    expect(pick('breakingbad', '#a59a89', [39.9, -1.2])).toBe('city'); // Rio Rancho
    expect(pick('breakingbad', '#f4f2ec', [-5.1, 3.7])).toBe('sands'); // the dunes' north tip
    expect(pick('breakingbad', '#f4f2ec', [-8, 20])).not.toBe('sands');
    expect(pick('breakingbad', '#3b3430', [29.6, -24.4])).toBe('malpais'); // El Malpais
    expect(pick('breakingbad', '#5a4a3a', [7.6, 10])).toBe('malpais'); // the Carrizozo flow, by place
    expect(pick('breakingbad', '#3b3430', [10, 170])).not.toBe('malpais'); // made-up lava on the far side
    expect(pick('breakingbad', '#ebebeb', [81, -53])).toBe('mountains'); // the San Juans' snow
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

  it('hands isSea the place too, so a place named by where it is stops the walk', () => {
    const n = onEquator(0.45);
    const place = fromLatLon(0, 0.45 * 360 - 180 + (3 * 0.02 * 180) / Math.PI);
    const isSea = (c, p) => !p || Math.acos(Math.min(1, vec.dot(p, place))) > 0.011;
    const to = towardLand(n, half, isSea, { track: vec.add(fromLatLon(0, 10), n, -1) });
    expect(Math.acos(Math.min(1, vec.dot(to, place)))).toBeLessThan(0.011);
    // (Tortuga, whose cells read sea on the map's copy, is land by place)
    const own = LANDINGS.caribbean;
    const off = fromLatLon(19.99, 8.63);
    expect(towardLand(off, () => rgb('#0a5089'), (c, p) => biomeAt(own, c, latLonOf(p)).sea)).toEqual(off);
  });
});

describe('the colour map a landing reads its biome from', () => {
  // (an ImageBitmap's stand-in: what matters is it's a picture, not data)
  const picture = () => ({ width: 2048, height: 1024 });
  const far = new THREE.Texture(picture()); // the -hq webp the planet was built with
  far.flipY = false;
  const xl = new THREE.CompressedTexture([{ data: new Uint8Array(16), width: 4096, height: 2048 }], 4096, 2048); // the -xl KTX2 worn near on ultra
  const raw = new THREE.DataTexture(new Uint8Array(4), 1, 1);

  it('passes over a GPU-compressed near map for the far one a canvas can read', () => {
    expect(readableMap(far, xl)).toBe(far);
    expect(readableMap(xl, far)).toBe(far);
    expect(readableMap(raw, null, undefined, far)).toBe(far);
  });

  it('is null when nothing given can be read back', () => {
    expect(readableMap(xl)).toBe(null);
    expect(readableMap(raw)).toBe(null);
    expect(readableMap(new THREE.Texture())).toBe(null);
    expect(readableMap()).toBe(null);
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
