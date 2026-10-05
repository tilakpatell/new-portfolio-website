// Elrond's kitchens, the evening before the Council: pale stone open to the
// valley, a stream running through the middle with two bridges over it
// (everything you fetch is on one bank, everything that cooks on the
// other), cauldrons of mushroom soup, ovens of elvish bread, and casks of
// wine for the Hall of Fire. Lindir runs the household and calls the
// orders. (The tiles are ../rules.js's; '~' is the stream.)

export const RIVENDELL = {
  id: 'rivendell',
  town: 'rivendell',
  theme: 'rivendell',
  name: 'The feast before the Council',
  host: 'Lindir',
  lead: 'Elves, Men, Dwarves and four hobbits at Elrond’s table, and Lindir short of hands. Mushroom soup, elvish bread and wine for the Hall of Fire, from kitchens split by a stream: everything you fetch is on one bank, everything that cooks on the other.',
  tiles: [
    '#uhB#~~#PPO#',
    'd....~~....O',
    'B..........T',
    '#....~~....T',
    'X....~~....#',
    'g..........#',
    'b....~~....W',
    '##RSS~~SS#W#',
  ],
  spawn: [
    [2, 2],
    [9, 2],
    [2, 5],
    [9, 5],
  ],
  recipes: {
    crates: { u: 'mushroom', h: 'herb', d: 'dough' },
    shelves: { g: 'goblet', b: 'bowl' },
    pot: { takes: ['mushroom', 'herb'], need: 3, into: 'bowl', makes: 'soup' },
    oven: { takes: 'dough', makes: 'loaf' },
    tap: { into: 'goblet', makes: 'wine' },
  },
  stock: { goblet: 4, bowl: 3 },
  move: { speed: 4.2, dashSpeed: 10, dashTime: 0.17, dashCool: 0.7 },
  times: { chop: 1.5, wash: 1.6, scrape: 1.2, cook: 9, burn: 10, bake: 7, char: 9, fill: 2.4, spill: 5, back: 7 },
  orders: {
    first: 2,
    second: 6,
    every: 15,
    max: 4,
    patience: { wine: 50, soup: 85, bread: 65 },
    mix: { wine: 0.4, soup: 0.35, bread: 0.25 },
    lapse: 5,
  },
  prices: { wine: 9, soup: 17, bread: 11 },
  tip: 6,
  time: 180,
  stars: [60, 130, 200],
  dishes: {
    wine: { name: 'A cup of wine', note: 'Goblet, cask', icon: '🍷', steps: ['goblet', 'cask'], k: 'goblet', s: 'wine', back: 'goblet' },
    soup: { name: 'Mushroom soup', note: 'Chop three, cauldron, bowl', icon: '🥣', steps: ['chop 3', 'cauldron', 'bowl'], k: 'bowl', s: 'soup', back: 'bowl' },
    bread: { name: 'Elvish bread', note: 'Dough, oven', icon: '🍞', steps: ['dough', 'oven'], k: 'loaf', s: 'baked', back: null },
  },
  lines: {
    start: ['“Lord Elrond’s guests are seated. Quickly now, and quietly: this is Rivendell.”'],
    order: {
      wine: ['“Wine for the Lady Arwen’s table.”', '“A cup for the Ranger. He’s been on the road a long while.”', '“Wine for Master Bilbo, and he says it had better be the good one.”'],
      soup: ['“Soup for the Dwarves. More soup. Always more soup.”', '“The mushroom soup, for the hobbits’ table. They asked twice.”'],
      bread: ['“Bread for the Men of Gondor.”', '“The Dwarves want bread. And meat. We have bread.”'],
    },
    served: ['“Beautifully done.”', '“Lord Elrond will be pleased.”', '“There. Not a word of complaint from the Dwarves. Yet.”'],
    lapsed: ['“They have gone to hear the songs instead. Hardly a compliment.”', '“A guest left waiting! In Rivendell!”'],
    burnt: ['“Something is burning. That has not happened here in three thousand years.”'],
    spilt: ['“Wine on the floor of the Last Homely House!”'],
    end: ['“The guests go to the Hall of Fire, and all is well. Thank you.”'],
  },
};
