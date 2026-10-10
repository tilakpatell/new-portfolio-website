// Cybertron's world, its keys: written once, here, and read by the guide's
// /cybertron page (./pages.js), the world's basics (tour/briefs.js) and the
// start card the world opens with (cybertron/game/GameWorld.jsx), so the
// three never say different things. A file of its own, not a const in
// ./pages.js, so the world's chunk doesn't carry the whole guide to draw
// nine rows. Rows as the guide writes them ([keys, what they do], ./keys.js).

export const CYBERTRON_KEYS = [
  ['W A S D', 'Walk or drive'],
  ['Mouse', 'Look and aim'],
  ['Click / F', 'Fire'],
  ['Q', 'Transform'],
  ['Shift', 'Run or boost'],
  ['Space', 'Jump'],
  ['E', 'Talk, use bridges'],
  ['M', 'Missions'],
  ['Esc', 'Let go'],
];

// …and a phone's (the buttons' own words)
export const CYBERTRON_TOUCH = [
  ['Stick', 'Walk or drive'],
  ['Drag', 'Look round (right of the screen)'],
  ['Fire', 'Hold to fire'],
  ['Transform', 'Transform'],
  ['Boost', 'Hold to boost'],
  ['Leave', 'Let go, and give the page back'],
];

// the rows for these keys, in this order (a brief's few, from the one list)
export const cybertronRows = (keys, rows = CYBERTRON_KEYS) => keys.map((k) => rows.find(([key]) => key === k)).filter(Boolean);
