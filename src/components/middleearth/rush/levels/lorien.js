// Caras Galadhon, the night before the Fellowship leaves Lothlórien: two
// flets high in the mallorn trees with rope bridges between them and the
// long drop below, and the Lady's gifts to make ready: lembas baked and
// wrapped in mallorn leaves, rope of hithlain spun on the wheels, and the
// phial filled with the light of the fountain. Haldir calls for them.
// (The tiles are ../rules.js's; '~' here is the drop between the flets,
// and 'L' a leaf table, for the wrapping.)

export const LORIEN = {
  id: 'lorien',
  town: 'lorien',
  theme: 'lorien',
  name: 'Gifts for the Fellowship',
  host: 'Haldir',
  lead: 'The Fellowship leaves at dawn, and the Lady would not send them empty-handed. Lembas baked and wrapped in mallorn leaves, rope of hithlain spun on the wheels, and phials filled with the fountain’s light, made ready across two flets with rope bridges between them.',
  work: 'spin, wrap, wash',
  tiles: [
    '#fd#BB~~#OO#',
    '#.....~~...L',
    'X..........L',
    '#.....~~...T',
    'v.....~~...T',
    '#..........#',
    '#.....~~...W',
    '##RSS#~~#SS#',
  ],
  spawn: [
    [2, 2],
    [9, 2],
    [2, 5],
    [9, 5],
  ],
  recipes: {
    crates: { f: 'fibre', d: 'dough' },
    shelves: { v: 'phial' },
    oven: { takes: 'dough', makes: 'lembas' },
    tap: { into: 'phial', makes: 'light' },
    wrap: { takes: { k: 'lembas', s: 'baked' }, makes: 'wrapped' },
  },
  stock: { phial: 4 },
  move: { speed: 4.2, dashSpeed: 10, dashTime: 0.17, dashCool: 0.7 },
  times: { chop: 1.8, wrap: 1.4, wash: 1.6, scrape: 1.2, cook: 9, burn: 10, bake: 7, char: 9, fill: 2.6, spill: 5, back: 7 },
  orders: {
    first: 2,
    second: 6,
    every: 15,
    max: 4,
    patience: { lembas: 80, rope: 60, phial: 55 },
    mix: { lembas: 0.4, rope: 0.3, phial: 0.3 },
    lapse: 5,
  },
  prices: { lembas: 16, rope: 10, phial: 9 },
  tip: 6,
  time: 180,
  stars: [60, 130, 200],
  dishes: {
    lembas: { name: 'Lembas', note: 'Dough, oven, wrap in leaves', icon: '🍃', steps: ['dough', 'oven', 'leaves'], k: 'lembas', s: 'wrapped', back: null },
    rope: { name: 'Elven rope', note: 'Fibre, spin it', icon: '🪢', steps: ['fibre', 'wheel'], k: 'fibre', s: 'chopped', back: null },
    phial: { name: 'A phial', note: 'Phial, fountain', icon: '✨', steps: ['phial', 'fountain'], k: 'phial', s: 'light', back: 'phial' },
  },
  lines: {
    start: ['“They leave at dawn, and the Lady would not send them empty-handed. Quickly, and quietly.”'],
    order: {
      lembas: ['“Lembas, for the Dwarf. He says he will eat four.”', '“Waybread, wrapped in mallorn leaves, for the road.”'],
      rope: ['“Rope, for the hobbit who keeps asking about rope.”', '“Hithlain, for the boats.”'],
      phial: ['“The light of Eärendil, for the Ring-bearer.”', '“A phial, filled from the fountain.”'],
    },
    served: ['“Well made.”', '“That will serve them on the road.”', '“The Lady will be pleased.”'],
    lapsed: ['“The boats are waiting…”', '“Too slow. Even for a hobbit.”'],
    burnt: ['“Burnt! One small bite should fill a traveller’s stomach, not blacken it.”'],
    spilt: ['“The fountain’s light, spilt on the boards!”'],
    end: ['“They will reach the river by noon. Thank you, little ones.”'],
  },
};
