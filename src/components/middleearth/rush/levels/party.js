// The Long-expected Party, in the pavilion on the Party Field: seed-cake
// out of the ovens, mushrooms up in Farmer Maggot's patch (they grow; pick
// them when they're up) and fried in the pan, and ale for a hundred and
// forty-four. Bilbo calls the orders, for the last time. (The tiles are
// ../rules.js's; 'G' here is the mushroom patch.)

export const PARTY = {
  id: 'party',
  town: 'shire',
  theme: 'party',
  name: 'The Long-expected Party',
  host: 'Bilbo',
  lead: 'Bilbo’s eleventy-first birthday, and the whole Shire’s come: seed-cake out of the ovens, mushrooms from Farmer Maggot’s patch (they grow while you work: pick them when they’re up) fried in the pan, and ale for a hundred and forty-four.',
  work: 'wash',
  tiles: [
    '#dd#OOO#TT#m',
    'G..........m',
    'G..........#',
    'G...####...W',
    '#..........R',
    'X..........#',
    '#..........#',
    '##SSS##SSS##',
  ],
  spawn: [
    [2, 2],
    [9, 2],
    [2, 5],
    [9, 5],
  ],
  recipes: {
    crates: { d: 'dough' },
    shelves: { m: 'mug' },
    patch: { grows: 'mushroom' },
    oven: [
      { takes: 'dough', makes: 'cake' },
      { takes: 'mushroom', makes: 'skillet' },
    ],
    tap: { into: 'mug', makes: 'ale' },
  },
  stock: { mug: 4 },
  move: { speed: 4.2, dashSpeed: 10, dashTime: 0.17, dashCool: 0.7 },
  times: { grow: 9, chop: 1.5, wash: 1.5, scrape: 1.4, cook: 10, burn: 10, bake: 7, char: 8, fill: 2.4, spill: 5, back: 7 },
  orders: {
    first: 2,
    second: 6,
    every: 13,
    max: 4,
    patience: { cake: 70, mushrooms: 55, ale: 45 },
    mix: { cake: 0.3, mushrooms: 0.4, ale: 0.3 },
    lapse: 5,
  },
  prices: { cake: 12, mushrooms: 12, ale: 8 },
  tip: 6,
  time: 180,
  stars: [55, 120, 185],
  dishes: {
    cake: { name: 'Seed-cake', note: 'Dough, oven', icon: '🎂', steps: ['dough', 'oven'], k: 'cake', s: 'baked', back: null },
    mushrooms: { name: 'Mushrooms', note: 'From the patch, in the pan', icon: '🍄', steps: ['patch', 'pan'], k: 'skillet', s: 'fried', back: null },
    ale: { name: 'A pint', note: 'Mug, tap', icon: '🍺', steps: ['mug', 'tap'], k: 'mug', s: 'ale', back: 'mug' },
  },
  lines: {
    start: ['“My dear Bagginses and Boffins, Tooks and Brandybucks… a hundred and forty-four of you, and every one of you hungry.”'],
    order: {
      cake: ['“Seed-cake for the Proudfoots. Proudfeet!”', '“Cake for the children. Gandalf’s promised them fireworks after.”'],
      mushrooms: ['“Mushrooms for the Gaffer. He’s been eyeing Maggot’s patch all evening.”', '“Pick them before Merry and Pippin do!”'],
      ale: ['“A pint for Sam. Go on, ask Rosie to dance.”', '“Ale for the Green Dragon lot.”'],
    },
    served: ['“Splendid!”', '“I don’t know half of you half as well as I should like.”', '“Eleventy-one years, and never a better party.”'],
    lapsed: ['“He’s gone off to watch the fireworks.”', '“Too slow. Lobelia took it.”'],
    burnt: ['“Burnt! The fireworks are meant to be the only things smoking.”'],
    spilt: ['“Mind the ale! That’s the Green Dragon’s best.”'],
    end: ['“I regret to announce that this is the end. I am going. I bid you all a very fond farewell. Goodbye!”'],
  },
};
