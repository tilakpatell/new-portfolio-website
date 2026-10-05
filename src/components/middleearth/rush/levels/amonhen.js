// The last camp, on the lawn at Parth Galen under Amon Hen, the night
// before the Fellowship chooses its road: fish to catch off the rocks
// (hold the line till one bites), grilled on the campfire's spit or cut up
// with herbs for a chowder in the pot, and waterskins filled at the spring
// for the boats. Everything goes out to the boats, drawn up along the
// shore. Aragorn calls the orders. (The tiles are ../rules.js's; '~' here
// is the lake, Nen Hithoel.)

export const AMON_HEN = {
  id: 'amonhen',
  town: 'amon-hen',
  theme: 'amonhen',
  name: 'Supper at Parth Galen',
  host: 'Aragorn',
  lead: 'The Fellowship has come down the Great River to the lawn of Parth Galen, and in the morning it must choose its road. Tonight, everyone’s hungry: fish from the lake, grilled on the fire or in a chowder with herbs, and waterskins filled for the boats.',
  work: 'fish, chop, wash, scrape',
  tiles: [
    '#hh#BB#PP#bb',
    '#..........#',
    'O....##....W',
    'O..........T',
    '#....##....T',
    'k..........X',
    '#..........R',
    '~F~SS~~SS~F~',
  ],
  spawn: [
    [2, 1],
    [9, 1],
    [2, 6],
    [9, 6],
  ],
  recipes: {
    crates: { h: 'herb' },
    shelves: { b: 'bowl', k: 'skin' },
    line: { makes: 'fish' },
    pot: { takes: ['fish', 'herb'], need: 3, into: 'bowl', makes: 'chowder' },
    oven: { takes: 'fish', makes: 'skewer' },
    tap: { into: 'skin', makes: 'water' },
  },
  stock: { bowl: 3, skin: 4 },
  move: { speed: 4.2, dashSpeed: 10, dashTime: 0.17, dashCool: 0.7 },
  times: { fish: 2.6, chop: 1.4, wash: 1.6, scrape: 1.4, cook: 9, burn: 10, bake: 6, char: 8, fill: 2.4, spill: 9, back: 7 },
  orders: {
    first: 2,
    second: 6,
    every: 14,
    max: 4,
    patience: { chowder: 85, fish: 60, water: 45 },
    mix: { chowder: 0.35, fish: 0.35, water: 0.3 },
    lapse: 5,
  },
  prices: { chowder: 18, fish: 12, water: 7 },
  tip: 6,
  time: 180,
  stars: [55, 120, 185],
  dishes: {
    chowder: { name: 'Chowder', note: 'Three of fish or herbs, chopped, in the pot', icon: '🍲', steps: ['fish', 'chop 3', 'pot', 'bowl'], k: 'bowl', s: 'chowder', back: 'bowl' },
    fish: { name: 'Grilled fish', note: 'Fish, on the spit', icon: '🐟', steps: ['fish', 'spit'], k: 'skewer', s: 'grilled', back: null },
    water: { name: 'A waterskin', note: 'Skin, spring', icon: '💧', steps: ['skin', 'spring'], k: 'skin', s: 'water', back: 'skin' },
  },
  lines: {
    start: ['“We rest here tonight, and choose our road in the morning. Eat while you can.”'],
    order: {
      chowder: ['“Chowder for Boromir. He’s been quiet since the river.”', '“A bowl for Pippin. He says it’s his second supper, not his first.”'],
      fish: ['“Grilled fish for Gimli. He says he can’t fight on lembas alone.”', '“A fish for Legolas, if there’s one to spare.”'],
      water: ['“Fill a waterskin for the boats.”', '“Water for Frodo. He’s gone up the hill to think.”'],
    },
    served: ['“Good. Eat, all of you.”', '“The best meal since Lórien.”', '“Well done. Sam’s nodding, and he doesn’t nod at much.”'],
    lapsed: ['“He’s gone off into the woods without it.”', '“Too late. He’s wandered off down the shore to brood.”'],
    burnt: ['“Mind the fire! That smoke will be seen from the far bank.”', '“Burnt black. The orcs can have that one.”'],
    spilt: ['“Don’t waste it! We’ve a long way to go.”'],
    end: ['“Where’s Frodo? Has anyone seen Frodo? … Horns in the woods. Uruk-hai! Leave it, all of you!”'],
  },
};
