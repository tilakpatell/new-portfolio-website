// The orcs' mess in the Tower of Cirith Ungol, with Frodo and Sam in orc
// gear and Shagrat shouting for his supper: maggoty bread out of the oven,
// meat (best not to ask) stewed in the pot, and orc-draught from the cask.
// The floor's thick with webs dragged up from Shelob's tunnels: slow going.
// (The tiles are ../rules.js's; ',' is webbed floor.)

export const TOWER = {
  id: 'tower',
  town: 'cirith-ungol',
  theme: 'tower',
  name: 'The orcs’ mess',
  host: 'Shagrat',
  lead: 'In orc gear, with the orcs of the Tower shouting for supper: maggoty bread out of the oven, meat (best not to ask) stewed in the pot, and orc-draught from the cask. The floor’s thick with webs from Shelob’s tunnels, so mind your feet.',
  work: 'chop, wash, scrape',
  tiles: [
    '#ee#BB#PP#OO',
    'd...,,.....m',
    'd..,,,,....#',
    'b...,,..,,.T',
    '#.......,,,T',
    'X..,,.....,W',
    '#..,,......R',
    '##SS####SS##',
  ],
  spawn: [
    [2, 1],
    [9, 1],
    [2, 5],
    [9, 5],
  ],
  recipes: {
    crates: { e: 'meat', d: 'dough' },
    shelves: { m: 'mug', b: 'bowl' },
    pot: { takes: ['meat'], need: 3, into: 'bowl', makes: 'stew' },
    oven: { takes: 'dough', makes: 'loaf' },
    tap: { into: 'mug', makes: 'ale' },
  },
  stock: { mug: 4, bowl: 3 },
  move: { speed: 4.2, dashSpeed: 10, dashTime: 0.17, dashCool: 0.7, web: 0.45 },
  times: { chop: 1.5, wash: 1.6, scrape: 1.4, cook: 9, burn: 10, bake: 7, char: 8, fill: 2.6, spill: 5, back: 7 },
  orders: {
    first: 2,
    second: 6,
    every: 14,
    max: 4,
    patience: { bread: 65, meat: 85, grog: 45 },
    mix: { bread: 0.3, meat: 0.4, grog: 0.3 },
    lapse: 5,
  },
  prices: { bread: 10, meat: 18, grog: 8 },
  tip: 6,
  time: 180,
  stars: [55, 120, 185],
  dishes: {
    bread: { name: 'Maggoty bread', note: 'Dough, oven', icon: '🍞', steps: ['dough', 'oven'], k: 'loaf', s: 'baked', back: null },
    meat: { name: 'Meat', note: 'Three of meat, chopped, in the pot', icon: '🍖', steps: ['chop 3', 'pot', 'bowl'], k: 'bowl', s: 'stew', back: 'bowl' },
    grog: { name: 'Orc-draught', note: 'Mug, cask', icon: '🍺', steps: ['mug', 'cask'], k: 'mug', s: 'ale', back: 'mug' },
  },
  lines: {
    start: ['“You two, in the kitchen. Gorbag’s lot are hungry, and so am I.”'],
    order: {
      bread: ['“Bread! Maggots and all, the lads don’t mind.”', '“Bread for the gate.”'],
      meat: ['“Meat’s back on the menu, boys!”', '“Meat! What kind? Don’t ask.”'],
      grog: ['“Grog for the lads on the stair.”', '“Draught! And be quick about it.”'],
    },
    served: ['“Hrr. That’ll do.”', '“Not bad, for a pair of runts.”'],
    lapsed: ['“He’s gone to pick a fight instead.”', '“Too slow! Now he’s sulking.”'],
    burnt: ['“Burnt! Not even an orc’ll eat that.”'],
    spilt: ['“Spilling grog? I’ll have your hide!”'],
    end: ['“What’s that? A mithril shirt? Mine! …and the whole Tower’s at each other’s throats. Run!”'],
  },
};
