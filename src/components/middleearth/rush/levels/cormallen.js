// The feast on the Field of Cormallen: the Ring is gone, the Eagles have
// brought Frodo and Sam down from the mountain, and the whole host of the
// West is to be fed. Roasts and bread out of the ovens, put together with
// herbs on the carving tables into platters for the King's table, bread
// for the minstrels, and wine. Gandalf calls the orders. (The tiles are
// ../rules.js's; 'A' is a carving table.)

export const CORMALLEN = {
  id: 'cormallen',
  town: 'mordor',
  theme: 'cormallen',
  name: 'The feast at Cormallen',
  host: 'Gandalf',
  lead: 'It’s over. The Eagles have brought Frodo and Sam down from the mountain, and on the Field of Cormallen the whole host of the West sits down to eat: roasts and bread from the ovens, put together with herbs into platters on the carving tables, more bread for the minstrels, and wine.',
  work: 'chop, wash',
  tiles: [
    '#ee#OO#BB#hh',
    'd..........g',
    'd...AA.....g',
    'O..........T',
    '#...AA.....T',
    'X..........W',
    '#..........R',
    '##SS####SS##',
  ],
  spawn: [
    [2, 1],
    [9, 1],
    [2, 5],
    [9, 5],
  ],
  recipes: {
    crates: { e: 'meat', d: 'dough', h: 'herb' },
    shelves: { g: 'goblet' },
    oven: [
      { takes: 'meat', makes: 'roast' },
      { takes: 'dough', makes: 'loaf' },
    ],
    tap: { into: 'goblet', makes: 'wine' },
    platter: {
      parts: [
        { k: 'roast', s: 'roasted' },
        { k: 'loaf', s: 'baked' },
        { k: 'herb', s: 'chopped' },
      ],
      makes: { k: 'platter', s: 'feast' },
    },
  },
  stock: { goblet: 4 },
  move: { speed: 4.2, dashSpeed: 10, dashTime: 0.17, dashCool: 0.7 },
  times: { chop: 1.4, wash: 1.5, scrape: 1.4, cook: 9, burn: 10, bake: 6, char: 8, fill: 2.4, spill: 6, back: 7 },
  orders: {
    first: 2,
    second: 6,
    every: 14,
    max: 4,
    patience: { feast: 95, wine: 45, bread: 60 },
    mix: { feast: 0.4, wine: 0.3, bread: 0.3 },
    lapse: 5,
  },
  prices: { feast: 24, wine: 8, bread: 10 },
  tip: 6,
  time: 180,
  stars: [55, 125, 195],
  dishes: {
    feast: { name: 'A feast', note: 'Roast, bread and herbs, on the carving table', icon: '🍽️', steps: ['roast', 'bread', 'herbs', 'carve'], k: 'platter', s: 'feast', back: null },
    wine: { name: 'Wine', note: 'Goblet, cask', icon: '🍷', steps: ['goblet', 'cask'], k: 'goblet', s: 'wine', back: 'goblet' },
    bread: { name: 'Bread', note: 'Dough, oven', icon: '🍞', steps: ['dough', 'oven'], k: 'loaf', s: 'baked', back: null },
  },
  lines: {
    start: ['“The Ring is gone, and the Dark Lord with it. Now: there is a whole host to feed.”'],
    order: {
      feast: ['“A feast for the King’s table!”', '“Platters for the captains of Gondor and Rohan.”'],
      wine: ['“Wine for Gimli and Legolas. They’re counting again.”', '“Wine for the Steward’s men.”'],
      bread: ['“Bread for the minstrels.”', '“Bread for the Eagles. No, really.”'],
    },
    served: ['“Praise them with great praise!”', '“Well done. Very well done.”'],
    lapsed: ['“He’s gone to hear the minstrel instead.”'],
    burnt: ['“Burnt. Even I can’t mend that.”'],
    spilt: ['“Mind the wine; it’s from the King’s own cellars.”'],
    end: ['“And the minstrel of Gondor sings of Frodo of the Nine Fingers and the Ring of Doom, and all the host laughs, and weeps.”'],
  },
};
