// The forges of Khazad-dûm, the year Balin came back: dark stone halls, a
// channel of molten rock across the floor with two stone bridges over it,
// ore to crush and melt three loads at a time in the crucibles and pour
// into moulds as mithril, iron to beat into axe-heads at the forge (leave
// one in too long and it's ruined), and ale for the miners. Balin calls the
// orders. (The tiles are ../rules.js's; '~' here is the molten channel.)

export const MORIA = {
  id: 'moria',
  town: 'moria',
  theme: 'moria',
  name: 'The forges of Khazad-dûm',
  host: 'Balin',
  lead: 'Balin has come back to Moria and lit the forges again, and every Dwarf in the colony wants something: mithril cast in moulds, axes from the forge, and ale for the miners. Across a channel of molten rock, with two bridges over it.',
  tiles: [
    '#oo#BB#PP#O#',
    'i..........O',
    '#..........T',
    '~~~.~~~~.~~~',
    '~~~.~~~~.~~~',
    'k..........#',
    'm..........W',
    '##RSSS##WX##',
  ],
  spawn: [
    [2, 2],
    [9, 2],
    [2, 5],
    [9, 5],
  ],
  recipes: {
    crates: { o: 'ore', i: 'iron' },
    shelves: { k: 'mould', m: 'mug' },
    pot: { takes: ['ore'], need: 3, into: 'mould', makes: 'mithril' },
    oven: { takes: 'iron', makes: 'axe' },
    tap: { into: 'mug', makes: 'ale' },
  },
  stock: { mould: 3, mug: 4 },
  move: { speed: 4.2, dashSpeed: 10, dashTime: 0.17, dashCool: 0.7 },
  times: { chop: 1.7, wash: 1.6, scrape: 1.4, cook: 10, burn: 10, bake: 7, char: 8, fill: 2.6, spill: 5, back: 7 },
  orders: {
    first: 2,
    second: 6,
    every: 15,
    max: 4,
    patience: { mithril: 90, axe: 65, ale: 50 },
    mix: { mithril: 0.35, axe: 0.3, ale: 0.35 },
    lapse: 5,
  },
  prices: { mithril: 20, axe: 12, ale: 8 },
  tip: 6,
  time: 180,
  stars: [60, 130, 200],
  dishes: {
    mithril: { name: 'Mithril', note: 'Crush three, crucible, mould', icon: '🛡️', steps: ['crush 3', 'crucible', 'mould'], k: 'mould', s: 'mithril', back: 'mould' },
    axe: { name: 'An axe', note: 'Iron, forge', icon: '🪓', steps: ['iron', 'forge'], k: 'axe', s: 'forged', back: null },
    ale: { name: 'Ale', note: 'Mug, tap', icon: '🍺', steps: ['mug', 'tap'], k: 'mug', s: 'ale', back: 'mug' },
  },
  lines: {
    start: ['“The forges are lit in Khazad-dûm again, lads! Let’s give the halls something to ring about.”'],
    order: {
      mithril: ['“Mithril for the gate-wardens! True-silver, light as a feather.”', '“A mould of mithril. Mind it, it’s worth more than the Shire.”'],
      axe: ['“An axe for Óin!”', '“Axes! The miners in the Twenty-first Hall want axes!”'],
      ale: ['“Ale for the miners. They’ve earned it.”', '“A mug for Ori, he’s writing in his book again.”'],
    },
    served: ['“Baruk Khazâd!”', '“Fine work. That’ll last a thousand years.”', '“A Dwarf couldn’t have done better. Well, nearly.”'],
    lapsed: ['“They’ve gone back down the mines without it.”', '“Too slow! He’s off to grumble to Óin.”'],
    burnt: ['“That axe-head’s ruined! Mind the forge!”', '“The crucible’s gone to slag!”'],
    spilt: ['“Ale on the anvils! Have you no respect?”'],
    end: ['“The bells ring the shift’s end. Good work, for hobbits.”'],
  },
};
