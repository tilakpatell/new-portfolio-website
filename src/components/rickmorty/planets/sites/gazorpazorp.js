// Gazorpazorp, from the ground: the men's red wasteland and, on a flat to
// the north, the women's walled city behind its gate. (The galaxy's
// sites/index.js has what a site is; this one is made whole by its siteFrom.)
//
// Bare for now: the land, the sky, the cruiser's landing, the gate to find,
// a band of the men outside it and the rock sled by the cruiser. The city's
// walls, the men's camp, the rest of the people, the quests and the chase
// come with the planet's own phase. Its kinds are the planets' kit's
// (../catalog.js, ../props, ../rides.js), which the page hands the scene.

// the women's city: on its own flat to the north, the gate on its south side
// facing the wasteland the cruiser comes down in
const GATE = { at: [0, 300], yaw: Math.PI };

export const SITE = {
  place: 'The men’s wasteland',
  line: 'Red dunes to the mesas, and the women’s gate shut against all of it.',
  sky: {
    // (the landing's dusk: a bruised violet overhead going to a hot orange
    // at the dunes, one swollen sun low over them)
    zenith: '#4a1a4a',
    horizon: '#f2b070',
    below: '#b8603c',
    haze: 0.9,
    hazeColor: '#f0a878',
    suns: [{ az: 0.8, el: 0.22, color: '#ffd8a0', size: 0.026, glow: 1.6 }],
    clouds: { cover: 0.08, color: '#ffd0b0', shade: '#a05a50', scale: 0.6, speed: 0.003 },
    bodies: [{ az: -1.1, el: 0.5, size: 0.03, color: '#d88aa8', color2: '#9a5a7a', bands: 2 }],
  },
  fog: { color: '#e8a07a', density: 0.0009 },
  light: { sun: 2.9, sky: '#e8b0c0', ground: '#a0482a', ambient: 0.75 },
  ground: {
    detail: 'sand',
    detailLook: { color: 0.7, normal: 0.8, metres: 6 },
    seed: 11,
    wind: 1.1,
    layers: [
      { type: 'swell', scale: 380, height: 7 },
      { type: 'dunes', scale: 58, height: 8, wind: 1.1 },
      // the two mesas: east of the landing, and south toward the men's ground
      { type: 'island', at: [260, 60], r: 110, height: 44, core: 0.8, ragged: 0.25 },
      { type: 'island', at: [-210, 230], r: 90, height: 36, core: 0.8, ragged: 0.3 },
      // the dry riverbed, wandering across the wasteland
      { type: 'channels', scale: 520, depth: 3.5, width: 0.05 },
      { type: 'mountains', from: 700, to: 3000, height: 480, scale: 1200 },
    ],
    palette: {
      low: '#c85a3a',
      high: '#e08a5a',
      rock: '#8a3a2a',
      accent: '#d4703f',
      deep: '#a84a30',
      hLow: -4,
      hHigh: 14,
      rockAt: 0.34,
      accentCover: 0.2,
      ripple: { strength: 0.09, scale: 3.2, wind: 1.1 },
      grain: 0.6,
      mark: '#9a4228',
    },
  },
  weather: [{ kind: 'sand', count: 700 }],
  // (turned so the two climb out facing north, the gate ahead)
  land: { at: [0, 0], yaw: -0.5 },
  places: [
    {
      id: 'gate',
      name: 'The women’s gate',
      at: GATE.at,
      yaw: GATE.yaw,
      r: 40,
      flat: { r: 46 },
      about: 'The great gate of the women’s city, shut against the men’s wasteland. Mar-Sha keeps it, and Morty Jr. was born behind it.',
      lines: {
        cruiser: [
          ['morty', 'That’s it, Rick. That’s where they took the baby.'],
          ['rick', 'The women’s gate, Morty. Knock nice. They’ve got lasers and opinions.'],
        ],
      },
      things: [{ kind: 'gazorpgate', at: [0, 0] }],
    },
  ],
  // the men: a band of Gazorpians loitering on the flat outside the women's
  // gate, shut out and shouting at rocks
  life: [{ kind: 'gazorpian', n: 3, at: [14, 262], spread: 6, roam: 14, speed: 1.1, group: true, name: 'A Gazorpian', says: ['RAAARGH.', '(He throws a rock at a rock.)', '(He beats his chest at you, then at the sky, to be safe.)'] }],
  // the men's rock sled, parked by the cruiser
  rides: [{ kind: 'rocksled', at: [16, -10], yaw: 2.2 }],
};
