// The flight's planets by type: each type's biomes (layer stacks from
// lib/land/layers.js, and field.js's `fnl` for the stylised ones), its
// ground colours and its clutter. A biome sits at a point of the climate
// square (temperature, moisture) with a reach; its `base` lifts or sinks its
// whole stack, so neighbours sit at different heights and the blend between
// them is a slope a few hundred metres long. The first biome of a type is the
// ground between the others.
//
// A biome's `scatter` is a list of islands (or, with a negative height,
// craters) placed per planet from its seed by planetSpec.js (`expand`): {
// count, spread (metres either way of the middle), r: [least, most],
// height: [least, most], core, ragged, rim (a crater's lip: that share of
// its depth, raised round it) }.
//
// Pure: plain data and one function, no three.js.
//
//   TYPE_BIOMES[type] → biomes; PALETTES[type]; CLUTTER[type]
//   expand(biomes, seed) → biomes with each scatter turned into island layers

import { seeded } from '../../seeded.js';

// the stylised planets' ground: FastNoiseLite warped hard and folded (field.js's `fnl`)
const toon = (height, frequency = 0.0012) => ({ type: 'fnl', noise: { type: 'simplex', fractal: 'pingpong', frequency, octaves: 3, warp: 600 }, height });
// round, rolling, cartoon hills
const soft = (scale, height) => ({ type: 'hills', scale, height, octaves: 3, gain: 0.4 });

export const TYPE_BIOMES = {
  ice: [
    // wind-scoured plains, 20 to 40 m of swell and drift
    { id: 'plains', at: [0.2, 0.45], reach: 0.35, base: 0, relief: [{ type: 'swell', scale: 1200, height: 22 }, { type: 'dunes', scale: 220, height: 14, wind: 0.4 }] },
    // a ridge range on a raised base
    { id: 'ridges', at: [0.8, 0.3], reach: 0.32, base: 60, relief: [{ type: 'ridges', scale: 900, height: 230 }, { type: 'hills', scale: 140, height: 12 }] },
    // a glacier: drifts along the wind, cut by crevasses
    { id: 'glacier', at: [0.3, 0.88], reach: 0.3, base: 18, relief: [{ type: 'dunes', scale: 300, height: 14, wind: 0.4 }, { type: 'channels', scale: 380, depth: 8, width: 0.035 }] },
    // a frozen sea, a few islands standing out of it
    { id: 'sea', at: [0.78, 0.86], reach: 0.28, base: -12, relief: [{ type: 'level', height: 0 }, { type: 'swell', scale: 600, height: 1.5 }], scatter: { count: 10, spread: 16000, r: [160, 420], height: [30, 70], core: 0.3 } },
  ],
  desert: [
    // dune seas
    { id: 'erg', at: [0.3, 0.3], reach: 0.35, base: 0, relief: [{ type: 'dunes', scale: 300, height: 48, wind: 0.7 }, { type: 'swell', scale: 1600, height: 14 }] },
    // mesa country, cliffs and all
    { id: 'mesas', at: [0.8, 0.3], reach: 0.3, base: 10, relief: [{ type: 'mesas', scale: 650, height: 110, cover: 0.15, cliff: 0.07 }, { type: 'hills', scale: 200, height: 8 }] },
    // a canyon land: rivers long dry, cut deep into raised hills
    { id: 'canyons', at: [0.3, 0.82], reach: 0.3, base: 70, relief: [{ type: 'hills', scale: 420, height: 30 }, { type: 'channels', scale: 1500, depth: 60, width: 0.1 }] },
    // salt flats
    { id: 'salt', at: [0.8, 0.85], reach: 0.25, base: -4, relief: [{ type: 'level', height: 0 }, { type: 'swell', scale: 300, height: 1.5 }] },
    // badlands, stylised
    { id: 'badlands', at: [0.55, 0.55], reach: 0.18, base: 20, relief: [toon(55, 0.0009)] },
  ],
  rock: [
    // rolling regolith
    { id: 'regolith', at: [0.3, 0.4], reach: 0.35, base: 0, relief: [{ type: 'hills', scale: 260, height: 25 }, { type: 'swell', scale: 1500, height: 30 }] },
    // broken highlands, the mountains rising round the middle of the map
    { id: 'highlands', at: [0.8, 0.4], reach: 0.32, base: 80, relief: [{ type: 'ridges', scale: 800, height: 200 }, { type: 'mountains', scale: 1400, height: 380, from: 4000, to: 12000 }] },
    // crater fields
    { id: 'craters', at: [0.3, 0.85], reach: 0.32, base: 10, relief: [{ type: 'hills', scale: 200, height: 10 }], scatter: { count: 16, spread: 14000, r: [220, 800], height: [-120, -40], core: 0.55, ragged: 0.15, rim: 0.3 } },
  ],
  lava: [
    // cinder plains
    { id: 'cinder', at: [0.35, 0.4], reach: 0.35, base: 0, relief: [{ type: 'swell', scale: 900, height: 15 }, { type: 'hills', scale: 120, height: 6 }] },
    // black rock, ridged, the lava rivers cut through it
    { id: 'blackrock', at: [0.8, 0.35], reach: 0.32, base: 40, relief: [{ type: 'ridges', scale: 500, height: 150 }, { type: 'channels', scale: 900, depth: 25, width: 0.05 }] },
    // a caldera: a great pit with a raised rim
    { id: 'caldera', at: [0.3, 0.85], reach: 0.32, base: 30, relief: [{ type: 'hills', scale: 400, height: 20 }], scatter: { count: 2, spread: 7000, r: [1500, 2000], height: [-170, -140], core: 0.5, ragged: 0.1, rim: 0.9 } },
  ],
  forest: [
    // rounded rolling hills
    { id: 'meadow', at: [0.3, 0.55], reach: 0.35, base: 0, relief: [soft(350, 30), { type: 'swell', scale: 1500, height: 20 }] },
    // warped, folded plateaus: the cartoon in it
    { id: 'plateaus', at: [0.75, 0.35], reach: 0.32, base: 20, relief: [toon(80)] },
    // a river valley, shallow and wide
    { id: 'valley', at: [0.3, 0.85], reach: 0.3, base: 10, relief: [soft(500, 20), { type: 'channels', scale: 1600, depth: 18, width: 0.14 }] },
    // knolls
    { id: 'knolls', at: [0.8, 0.85], reach: 0.25, base: 15, relief: [soft(160, 35)] },
  ],
  ocean: [
    // an archipelago over a level sea
    { id: 'sea', at: [0.4, 0.4], reach: 0.35, base: -20, relief: [{ type: 'level', height: 0 }, { type: 'swell', scale: 1600, height: 4 }], scatter: { count: 18, spread: 15000, r: [400, 1200], height: [100, 300], core: 0.3 } },
    // a continent's edge: mountains from 3 km out to their height by 9 km
    { id: 'coast', at: [0.78, 0.5], reach: 0.35, base: 0, relief: [{ type: 'mountains', scale: 1500, height: 500, from: 3000, to: 9000 }, { type: 'hills', scale: 300, height: 20 }] },
    // reefs
    { id: 'reef', at: [0.25, 0.82], reach: 0.25, base: -8, relief: [{ type: 'hills', scale: 90, height: 8 }] },
  ],
  gas: [
    // a gas giant's cloud deck, flown over as if it were ground
    { id: 'deck', at: [0.5, 0.5], reach: 0.4, base: 0, relief: [{ type: 'swell', scale: 2400, height: 60 }, { type: 'dunes', scale: 600, height: 18, wind: 1.1 }] },
    { id: 'billows', at: [0.2, 0.8], reach: 0.3, base: 30, relief: [soft(500, 80)] },
    { id: 'towers', at: [0.85, 0.25], reach: 0.28, base: 20, relief: [{ type: 'ridges', scale: 900, height: 120 }] },
  ],
};
TYPE_BIOMES.ringed = TYPE_BIOMES.gas;

export const PALETTES = {
  ice: { low: '#e9f0f7', high: '#ffffff', rock: '#6b7a8c', accent: '#9fb7d1' },
  rock: { low: '#8a7f73', high: '#a39383', rock: '#5c544c', accent: '#6f6a64' },
  lava: { low: '#2a2220', high: '#4a3a34', rock: '#1a1514', accent: '#ff6b4a' },
  ocean: { low: '#2f6f8f', high: '#9fd3c7', rock: '#3b5a66', accent: '#e8f4f0' },
  gas: { low: '#c9a77a', high: '#f0dcb4', rock: '#a07850', accent: '#fff2d8' },
  forest: { low: '#4f8f3a', high: '#9bd06a', rock: '#6b5a44', accent: '#e3f2b0' },
  desert: { low: '#e0b878', high: '#f4d9a2', rock: '#b07a4a', accent: '#fff1cf' },
};
PALETTES.ringed = PALETTES.gas;

export const CLUTTER = {
  ice: [{ kind: 'rock', perKm2: 60 }, { kind: 'spire', perKm2: 6, depth: 5 }, { kind: 'debris', perKm2: 20 }],
  rock: [{ kind: 'rock', perKm2: 90 }, { kind: 'spire', perKm2: 4, depth: 5 }],
  lava: [{ kind: 'rock', perKm2: 70 }, { kind: 'spire', perKm2: 8, depth: 5 }],
  ocean: [{ kind: 'rock', perKm2: 20 }],
  gas: [],
  forest: [{ kind: 'rock', perKm2: 30 }, { kind: 'spire', perKm2: 10, depth: 5 }],
  desert: [{ kind: 'rock', perKm2: 40 }, { kind: 'debris', perKm2: 10 }],
};
CLUTTER.ringed = CLUTTER.gas;

const between = (rnd, [a, b]) => a + rnd() * (b - a);

export function expand(biomes, seed) {
  return biomes.map((b, i) => {
    if (!b.scatter) return b;
    const { count, spread, r, height, core = 0.25, ragged = 0.35, rim = 0 } = b.scatter;
    const rnd = seeded((seed | 0) ^ Math.imul(i + 1, 0x9e3779b1));
    const relief = [...b.relief];
    for (let k = 0; k < count; k++) {
      const at = [Math.round((rnd() * 2 - 1) * spread), Math.round((rnd() * 2 - 1) * spread)];
      const rk = Math.round(between(rnd, r));
      const h = Math.round(between(rnd, height));
      // (the lip first: a plateau a third wider, the pit cut into it)
      if (rim) relief.push({ type: 'island', at, r: Math.round(rk * 1.35), height: Math.round(Math.abs(h) * rim), core: 0.7, ragged });
      relief.push({ type: 'island', at, r: rk, height: h, core, ragged });
    }
    // (the scatter itself goes: the spec the worker gets holds the islands it made)
    const rest = { ...b, relief };
    delete rest.scatter;
    return rest;
  });
}
