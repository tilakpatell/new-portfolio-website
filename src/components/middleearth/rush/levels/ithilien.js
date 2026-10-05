// Of herbs and stewed rabbit: past the Black Gate, Gollum leads them south
// into Ithilien, and Sam cooks. Coneys (Gollum caught them) stewed with
// herbs and taters, roast on the fire, and the skins filled at the stream.
// And Gollum creeps back for the coneys: keep a hobbit by anything he'd
// like, or it's gone. Sam calls the orders. (The tiles are ../rules.js's.)

export const ITHILIEN = {
  id: 'ithilien',
  town: 'dead-marshes',
  theme: 'ithilien',
  name: 'Herbs and stewed rabbit',
  host: 'Sam',
  lead: 'The Black Gate’s shut, Sméagol knows another way, and in the green woods of Ithilien Sam means to cook a proper supper: coneys stewed with herbs and taters, roast on the fire, and the skins filled at the stream. Sméagol caught the coneys. He’d like them back. Raw.',
  work: 'chop, wash, scrape',
  tiles: [
    '#cc#BB#PP#hh',
    'p..........b',
    'p...#..#...b',
    'O...#..#...T',
    'O..........T',
    'k..........W',
    'X..........R',
    '##SS####SS##',
  ],
  spawn: [
    [2, 1],
    [9, 1],
    [2, 5],
    [9, 5],
  ],
  recipes: {
    crates: { c: 'coney', p: 'potato', h: 'herb' },
    shelves: { b: 'bowl', k: 'skin' },
    pot: { takes: ['coney', 'herb', 'potato'], need: 3, into: 'bowl', makes: 'stew' },
    oven: { takes: 'coney', makes: 'roast' },
    tap: { into: 'skin', makes: 'water' },
  },
  thief: { first: 22, every: [16, 26], warn: 3.2, guard: 1.6, steals: ['coney'] },
  stock: { bowl: 3, skin: 4 },
  move: { speed: 4.2, dashSpeed: 10, dashTime: 0.17, dashCool: 0.7 },
  times: { chop: 1.4, wash: 1.6, scrape: 1.4, cook: 9, burn: 10, bake: 6, char: 8, fill: 2.4, spill: 9, back: 7 },
  orders: {
    first: 2,
    second: 6,
    every: 14,
    max: 4,
    patience: { stew: 85, roast: 60, water: 45 },
    mix: { stew: 0.4, roast: 0.3, water: 0.3 },
    lapse: 5,
  },
  prices: { stew: 18, roast: 12, water: 7 },
  tip: 6,
  time: 180,
  stars: [55, 120, 185],
  dishes: {
    stew: { name: 'Stewed rabbit', note: 'Three of coney, herbs or taters, chopped, in the pot', icon: '🍲', steps: ['chop 3', 'pot', 'bowl'], k: 'bowl', s: 'stew', back: 'bowl' },
    roast: { name: 'Roast coney', note: 'Coney, on the fire', icon: '🍖', steps: ['coney', 'fire'], k: 'roast', s: 'roasted', back: null },
    water: { name: 'A waterskin', note: 'Skin, stream', icon: '💧', steps: ['skin', 'stream'], k: 'skin', s: 'water', back: 'skin' },
  },
  lines: {
    start: ['“Po-tay-toes! Boil ’em, mash ’em, stick ’em in a stew. And keep an eye on Sméagol.”'],
    order: {
      stew: ['“A good stew for Mr. Frodo. He’s hardly eaten since the Gate.”', '“Stew. With taters, if there’s a tater to be had.”'],
      roast: ['“A roast coney for Sméagol, if he’ll eat it cooked.”', '“Roast coney. Brace of ’em, Sméagol said.”'],
      water: ['“Fill the skins at the stream. There’s no clean water past here.”'],
    },
    served: ['“There. That’s proper food, that is.”', '“Get that down you, Mr. Frodo.”'],
    lapsed: ['“He’s gone and fallen asleep.”'],
    burnt: ['“Burnt! And smoking, in Ithilien too.”'],
    spilt: ['“Don’t waste it!”'],
    sneak: ['“Sméagol’s creeping round the coneys again!”', '“Watch him!”'],
    stolen: ['“Sméagol! Give that back, you sneaking—!”', '“He’s had another coney raw. Stupid, nasty…”'],
    end: ['“Men! Green hoods, bows… Mr. Frodo, I think they’ve seen our smoke.”'],
  },
};
