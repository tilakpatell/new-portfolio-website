// The Prancing Pony's kitchen, the night the hobbits came: the bar's tap
// barrels, the hearth with its stew pots, the bread ovens, the boards, the
// crates and the dough tub, the mug and bowl shelves, the wash tubs, and
// Butterbur's counter through to the common room, where the served things
// go and the dirty ones come back. (The tiles are ../rules.js's; row 0 is
// the back wall, row 7 the counter to the common room, nearest the camera.)

export const PONY = {
  id: 'pony',
  town: 'bree',
  name: 'A busy night at the Pony',
  host: 'Barliman Butterbur',
  lead: 'The common room’s full, Nob and Bob are nowhere, and Barliman Butterbur wants pints, stew and bread out through the hatch. Fetch, chop, cook, pour, serve, and wash up before the mugs run out.',
  tiles: [
    '#cp#BB#PP#O#',
    'd..........O',
    '#..........T',
    'X...####...T',
    '#...####...#',
    'm..........#',
    'b..........#',
    '##RSSS##WW##',
  ],
  spawn: [
    [2, 2],
    [9, 2],
    [2, 5],
    [9, 5],
  ],
  stock: { mug: 4, bowl: 3 },
  move: { speed: 4.2, dashSpeed: 10, dashTime: 0.17, dashCool: 0.7 },
  times: { chop: 1.6, wash: 1.6, scrape: 1.2, cook: 9, burn: 10, bake: 7, char: 9, fill: 2.6, spill: 5, back: 7 },
  orders: {
    first: 2,
    second: 6,
    every: 15,
    max: 4,
    patience: { pint: 50, stew: 80, bread: 65 },
    mix: { pint: 0.45, stew: 0.3, bread: 0.25 },
    lapse: 5,
  },
  prices: { pint: 8, stew: 16, bread: 11 },
  tip: 6,
  time: 180,
  stars: [60, 130, 200],
  dishes: {
    pint: { name: 'A pint', note: 'Mug, tap, wait', icon: '🍺', steps: ['mug', 'tap'] },
    stew: { name: 'Stew', note: 'Chop three, pot, bowl', icon: '🍲', steps: ['chop 3', 'pot', 'bowl'] },
    bread: { name: 'A loaf', note: 'Dough, oven', icon: '🍞', steps: ['dough', 'oven'] },
  },
  // Butterbur, through the hatch
  lines: {
    start: ['“Nob! Bob! The house is full, and the hobbits are helping. Look lively!”'],
    order: {
      pint: ['“Two pints for the corner! No, one. One pint!”', '“A pint for the Bree-lander by the fire!”', '“Pint, Nob! Where’s Nob?”'],
      stew: ['“Stew for the table by the window!”', '“A bowl of stew, and quick about it!”'],
      bread: ['“A loaf for the dwarves!”', '“Bread! They want bread with it!”'],
    },
    served: ['“That’s the way, little master!”', '“Lovely. Lovely!”', '“Off it goes!”'],
    lapsed: ['“They’ve gone! Gone without paying, and it’s my head!”', '“Too slow! He’s off to the Green Dragon… well, he would be, if it weren’t in Hobbiton.”'],
    burnt: ['“Something’s burning! Nob!”', '“That’s smoke, that is!”'],
    spilt: ['“Ale on the floor! Mind the ale!”'],
    end: ['“Well! That’s a night. You’ve earned your supper.”'],
  },
};
