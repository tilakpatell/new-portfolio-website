// Supper in the dell under Weathertop, the night the Riders come: a fry-up
// in the pans, sausages on the spits, and tea from the kettle. The fires
// burn down while they cook, and cook nothing once they're out: keep them
// fed with wood. Strider calls the orders, keeping his voice down. (The
// tiles are ../rules.js's.)

export const WEATHERTOP = {
  id: 'weathertop',
  town: 'weathertop',
  theme: 'weathertop',
  name: 'Supper on Weathertop',
  host: 'Strider',
  lead: 'Night in the dell under Amon Sûl, and the hobbits want supper: tomatoes and sausages fried in the pans, sausages on the spits, and tea from the kettle. The fires burn down while they cook, so keep them fed with wood, and keep the smoke low.',
  work: 'chop, wash, scrape',
  tiles: [
    '#tu#BB#PP#pm',
    'w..........T',
    'w...O..O...T',
    '#..........#',
    '#..........W',
    'X..........R',
    '#..........#',
    '##SSS##SSS##',
  ],
  spawn: [
    [2, 1],
    [9, 1],
    [2, 5],
    [9, 5],
  ],
  recipes: {
    crates: { t: 'tomato', u: 'sausage', w: 'wood' },
    shelves: { p: 'plate', m: 'mug' },
    pot: { takes: ['tomato', 'sausage'], need: 3, into: 'plate', makes: 'fryup' },
    oven: { takes: 'sausage', makes: 'banger' },
    tap: { into: 'mug', makes: 'tea' },
  },
  fuel: { wood: 'wood', burn: 24, load: 0.5 },
  stock: { plate: 3, mug: 4 },
  move: { speed: 4.2, dashSpeed: 10, dashTime: 0.17, dashCool: 0.7 },
  times: { chop: 1.4, wash: 1.5, scrape: 1.4, cook: 9, burn: 10, bake: 6, char: 8, fill: 2.6, spill: 6, back: 7 },
  orders: {
    first: 2,
    second: 6,
    every: 14,
    max: 4,
    patience: { fryup: 80, sausages: 60, tea: 45 },
    mix: { fryup: 0.35, sausages: 0.35, tea: 0.3 },
    lapse: 5,
  },
  prices: { fryup: 18, sausages: 11, tea: 7 },
  tip: 6,
  time: 180,
  stars: [55, 120, 185],
  dishes: {
    fryup: { name: 'A fry-up', note: 'Three of tomato or sausage, chopped, in the pan; a plate', icon: '🍳', steps: ['chop 3', 'pan', 'plate'], k: 'plate', s: 'fryup', back: 'plate' },
    sausages: { name: 'Sausages', note: 'On the spit', icon: '🌭', steps: ['sausage', 'spit'], k: 'banger', s: 'grilled', back: null },
    tea: { name: 'Tea', note: 'Mug, kettle', icon: '🍵', steps: ['mug', 'kettle'], k: 'mug', s: 'tea', back: 'mug' },
  },
  lines: {
    start: ['“We’ll rest here tonight. A small fire, and keep it low. They’re abroad.”'],
    order: {
      fryup: ['“Pippin says: tomatoes, sausages, nice crispy bacon. There is no bacon.”', '“A fry-up for Merry, and quietly.”'],
      sausages: ['“Sausages for Sam. He carried the pans, he’s earned them.”', '“Sausages. And keep the smoke down.”'],
      tea: ['“Tea for Frodo. He’s cold, and it’s not the night air.”', '“A mug of tea. Hobbits.”'],
    },
    served: ['“Good. Eat, and then sleep. I’ll keep watch.”', '“Well done. Quietly, now.”'],
    lapsed: ['“He’s fallen asleep waiting.”'],
    burnt: ['“Burnt. And the smell will carry for miles.”'],
    spilt: ['“Mind the kettle.”'],
    out: ['“The fire’s out! Wood, quickly.”', '“Feed that fire, or there’s no supper.”'],
    end: ['“Five of them, on the slope below. Stand together, and take a brand from the fire!”'],
  },
};
