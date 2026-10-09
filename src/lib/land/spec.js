// A planet's land, as knobs, from a seed and a type: where the sea stands,
// what the relief is summed from (layers.js), how many rivers rise in a
// region and how wide and deep they run (rivers.js), the colours the ground
// is painted in, what grows on it (flora.js), the gravity, the wind and the
// sun. Everything downstream (rivers.js, cell.js, the world) reads only this.
//
// Pure: no three.js, no DOM. Colours are linear [r, g, b] 0…1.
//
//   LAND_TYPES: temperate, desert, ice, ocean, volcanic, forest
//   hashSeed(seed) → a 32-bit integer from any seed (a name or a number)
//   landSpec(seed, type = 'temperate') → { seed, type, sea, relief, rivers:
//     { perRegion, width, depth, meander }, palette: { dirt, grass, sand,
//     rock, shallow, deep, shadow }, flora: floraFor(type), gravity,
//     wind: { angle, strength }, sun: { elevation, azimuth, colour } }

import { floraFor } from './flora.js';

// FNV-1a over the seed's text, so 'seven' and 7 are seeds alike
export function hashSeed(seed) {
  const text = String(seed);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}

// sRGB hex to linear [r, g, b]
const lin = (hex) => [16, 8, 0].map((s) => {
  const c = ((hex >> s) & 255) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

// Bruno's floor gradient (dirt #ffa94e, shallow #5bc2b9, deep #13375f) and
// grass (#b8b62e) are temperate's; the rest are each type's own
const TYPES = {
  temperate: {
    sea: 0,
    relief: [
      { type: 'swell', scale: 600, height: 18 },
      { type: 'hills', scale: 140, height: 9 },
      { type: 'ridges', scale: 900, height: 25, weight: 0.25 },
    ],
    rivers: { perRegion: 2, width: 6, depth: 2, meander: 0.35 },
    palette: { dirt: 0xffa94e, grass: 0xb8b62e, sand: 0xe8d39a, rock: 0x8a8278, shallow: 0x5bc2b9, deep: 0x13375f, shadow: 0x3a2f6b },
    gravity: -9.81,
    wind: { angle: 0.6 * Math.PI, strength: 0.4 },
    sun: { elevation: 0.9, azimuth: 0.25 * Math.PI, colour: 0xfff2dd },
  },
  desert: {
    sea: -Infinity,
    relief: [
      { type: 'swell', scale: 800, height: 14 },
      { type: 'dunes', scale: 60, height: 7, wind: 0.6 * Math.PI },
      { type: 'mesas', scale: 500, height: 30, cover: 0.25 },
    ],
    rivers: { perRegion: 0, width: 4, depth: 1.5, meander: 0.5 },
    palette: { dirt: 0xe0a560, grass: 0xa8a04a, sand: 0xf0cf8e, rock: 0xb0674a, shallow: 0x6ab8a8, deep: 0x1f4f6f, shadow: 0x6b3f5a },
    gravity: -9.81,
    wind: { angle: 0.6 * Math.PI, strength: 0.7 },
    sun: { elevation: 1.1, azimuth: 0.3 * Math.PI, colour: 0xfff0d0 },
  },
  ice: {
    sea: 0,
    relief: [
      { type: 'swell', scale: 700, height: 16 },
      { type: 'ridges', scale: 300, height: 22, weight: 0.5 },
    ],
    rivers: { perRegion: 1, width: 5, depth: 1.5, meander: 0.25 },
    palette: { dirt: 0xc9d6e0, grass: 0xe8f0f4, sand: 0xdde6ea, rock: 0x6f7c88, shallow: 0x8fd3e0, deep: 0x1d3f6a, shadow: 0x4a5a8a },
    gravity: -9.81,
    wind: { angle: 0.2 * Math.PI, strength: 0.6 },
    sun: { elevation: 0.35, azimuth: 0.15 * Math.PI, colour: 0xffe6cc },
  },
  ocean: {
    sea: 4,
    relief: [
      { type: 'swell', scale: 500, height: 14 },
      { type: 'hills', scale: 120, height: 6 },
    ],
    rivers: { perRegion: 1, width: 4, depth: 1.5, meander: 0.4 },
    palette: { dirt: 0xf2c27a, grass: 0x8fbf3a, sand: 0xf5e2b0, rock: 0x7f7a70, shallow: 0x4fd0c8, deep: 0x0f3a6a, shadow: 0x2f4f7a },
    gravity: -9.81,
    wind: { angle: 0.4 * Math.PI, strength: 0.5 },
    sun: { elevation: 1.0, azimuth: 0.2 * Math.PI, colour: 0xfff6e6 },
  },
  volcanic: {
    sea: -2,
    relief: [
      { type: 'swell', scale: 600, height: 20 },
      { type: 'ridges', scale: 250, height: 30, weight: 0.6 },
    ],
    rivers: { perRegion: 1, width: 5, depth: 2, meander: 0.3 },
    palette: { dirt: 0x4a3b36, grass: 0x6b7a3a, sand: 0x5a4a44, rock: 0x2a2426, shallow: 0xd2602a, deep: 0x7a1a10, shadow: 0x2a1a3a },
    gravity: -9.81,
    wind: { angle: 0.8 * Math.PI, strength: 0.3 },
    sun: { elevation: 0.6, azimuth: 0.35 * Math.PI, colour: 0xffd0a8 },
  },
  // temperate's hills, softer and wetter, under a darker green and a forest floor
  forest: {
    sea: 0,
    relief: [
      { type: 'swell', scale: 600, height: 16 },
      { type: 'hills', scale: 160, height: 11 },
    ],
    rivers: { perRegion: 2, width: 5, depth: 1.8, meander: 0.45 },
    palette: { dirt: 0x9a6a3a, grass: 0x7fa02e, sand: 0xd8c08a, rock: 0x6f6a62, shallow: 0x4fa8a0, deep: 0x123a4f, shadow: 0x2a3a5b },
    gravity: -9.81,
    wind: { angle: 0.5 * Math.PI, strength: 0.3 },
    sun: { elevation: 0.8, azimuth: 0.3 * Math.PI, colour: 0xfff0d8 },
  },
};
export const LAND_TYPES = Object.keys(TYPES);

export function landSpec(seed, type = 'temperate') {
  const name = TYPES[type] ? type : 'temperate';
  const t = TYPES[name];
  const palette = {};
  for (const k of Object.keys(t.palette)) palette[k] = lin(t.palette[k]);
  return {
    seed: hashSeed(seed),
    type: name,
    sea: t.sea,
    relief: t.relief.map((l) => ({ ...l })),
    rivers: { ...t.rivers },
    palette,
    flora: floraFor(name),
    gravity: t.gravity,
    wind: { ...t.wind },
    sun: { elevation: t.sun.elevation, azimuth: t.sun.azimuth, colour: lin(t.sun.colour) },
  };
}
