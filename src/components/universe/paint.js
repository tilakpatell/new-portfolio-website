// Paint jobs for the ships on the universe map: the site's own colour
// schemes, worn on the hull. The factory paint is every ship's to begin
// with; the six companies' colours come with the Cartographer achievement
// (seeing all six on the Experience page), and each fan scheme comes with
// the same easter egg that unlocks it on the site (theme/themes.js's
// FAN_THEMES). A paint is one slot of a ship's loadout (outfit.js): picked
// for each ship on its own, kept between visits, and the other pilots see
// it (online/protocol.js sends its id, and only ids from here are believed).
// The earned paints belong to a universe and are open to anyone here: what
// locks them is the catalogue's (catalog.js), a rank, a standing or a level
// bought with credits, not an achievement.
//
// A paint is { id, name, group ('stock' | 'company' | 'fan' | 'earned'), hull, trim,
// glow, bolt, achievement, hint }: the hull's colour, the trim the ship's
// markings take, the engines' glow and exhaust, and its lasers. Pure data,
// so it's tested in Node; livery.js puts it on a ship and Hangar.jsx
// offers it.

import { FAN_THEMES, THEMES, THEME_ORDER } from '../../theme/themes';

export const STOCK = 'stock';

// [hull, trim, glow, bolt], from each scheme's own colours (index.css,
// styles/extras.css, styles/caribbean-themes.css); dark hulls lifted a
// little off the scheme's black, so a ship still reads against space
const COATS = {
  // the companies
  aws: ['#232f3e', '#ff9900', '#ff9900', '#ffb547'], // Squid Ink and Smile Orange
  rtx: ['#f2f2f0', '#ce1126', '#ff2b3d', '#ff2b3d'], // white, black and one disciplined red
  bose: ['#232328', '#b4bec7', '#e8ecef', '#f4f6f8'], // bass black and cool grey; its saber's the Darksaber
  pendar: ['#0b2342', '#4da3dc', '#4da3dc', '#7cc4ff'], // laboratory navy and a laser blue
  empowerreg: ['#1853b9', '#dbe64c', '#dbe64c', '#e8f070'], // sky, and one lime spark
  src: ['#e9eef3', '#002c77', '#35b1ea', '#35b1ea'], // instrument white, navy and radar blue
  // the fan schemes
  jedi: ['#e6dfcf', '#2563eb', '#4aa3ff', '#4aa3ff'],
  sith: ['#1f1818', '#c1121f', '#ff2a36', '#ff2a36'],
  heisenberg: ['#f0c330', '#1e7a3c', '#5ec8f0', '#5ec8f0'], // hazmat yellow, the logo's green, Blue Sky
  stark: ['#b3161b', '#e0b13a', '#7fdcff', '#7fdcff'], // hot-rod red and gold, the arc reactor's blue
  dunder: ['#eef1f5', '#1f4e8c', '#8fb6ff', '#8fb6ff'], // paper
  arcade: ['#1c1830', '#d6246e', '#22e07a', '#22e07a'],
  raga: ['#e8871e', '#2d2669', '#ffb347', '#ffb347'], // saffron and indigo
  tortuga: ['#e8d9b0', '#0f6b70', '#d9a436', '#d9a436'],
  pearl: ['#1d1810', '#f2c45a', '#f2c45a', '#f2c45a'],
  dutchman: ['#0e4a3e', '#5df2c0', '#5df2c0', '#5df2c0'],
  optimus: ['#c8102e', '#2251b5', '#7fd0ff', '#ff5263'], // red cab, blue legs, the Matrix's glow
  megatron: ['#8a8f9c', '#6b2fa0', '#b48cff', '#b48cff'], // gunmetal and purple
  bumblebee: ['#f7c600', '#1b1b1b', '#ffd52e', '#ffd52e'],
  shockwave: ['#7a2fb8', '#9aa1ad', '#ffcf3d', '#ffcf3d'], // purple and grey, the one yellow eye
  soundwave: ['#1f6fb2', '#c9d1dc', '#4fd8ff', '#4fd8ff'],
  shire: ['#4f7c2a', '#d4a94a', '#a3d977', '#a3d977'], // a round green door, its brass knob
  mordor: ['#241612', '#c2410c', '#ff7a1a', '#ff7a1a'], // black iron and the fires of Orodruin
  portal: ['#97ce4c', '#1f4a17', '#c4ff7a', '#97ce4c'],
  morty: ['#f3d84b', '#3b65b8', '#f3d84b', '#f3d84b'], // the yellow shirt, the blue jeans
  summer: ['#e2557f', '#f6eef1', '#ff8fb1', '#ff8fb1'],
  beth: ['#8e2b48', '#f1cf6a', '#f1cf6a', '#f1cf6a'], // wine, and gold
  // the earned ones
  rebel: ['#e4dfd3', '#c8331f', '#ff6b4a', '#ff3b2f'], // a weathered white, the Alliance's orange-red
  imperial: ['#8d939a', '#2b2f35', '#9fd8ff', '#3dff6a'], // fleet grey, and a TIE's green bolts
  redsquadron: ['#f1efe9', '#b3261e', '#ffb08a', '#ff2b2b'], // white with the red stripes at Yavin
  citadel: ['#d7dde3', '#2f6fb8', '#7ee8ff', '#97ce4c'], // the Citadel's clean white and its blue
  pollos: ['#f5efe0', '#d42a1f', '#ffc23d', '#ffc23d'], // the restaurant's red on white, and its yellow
  huttgold: ['#b8892b', '#5b3a1a', '#ffd36b', '#ffcf4a'], // Jabba's gold, and the brown of his palace
};

const coat = (id) => {
  const [hull, trim, glow, bolt] = COATS[id];
  return { hull, trim, glow, bolt };
};

// the companies' colours all come with seeing them all
const COMPANY = { achievement: 'cartographer', hint: 'See all six company colors: scroll through the Experience page' };

export const PAINTS = [
  { id: STOCK, name: 'Factory', group: 'stock', hull: null, trim: null, glow: null, bolt: null, achievement: null, hint: null },
  ...THEME_ORDER.map((id) => ({ id, name: THEMES[id].label, group: 'company', ...coat(id), ...COMPANY })),
  ...FAN_THEMES.map((f) => ({ id: f.id, name: THEMES[f.id].label, group: 'fan', ...coat(f.id), achievement: f.achievement, hint: f.hint })),
  ...[
    ['rebel', 'Rebel Alliance'],
    ['imperial', 'Imperial grey'],
    ['redsquadron', 'Red Squadron'],
    ['citadel', 'Citadel issue'],
    ['pollos', 'Los Pollos'],
    ['huttgold', 'Hutt gold'],
  ].map(([id, name]) => ({ id, name, group: 'earned', ...coat(id), achievement: null, hint: null })),
];

const BY_ID = new Map(PAINTS.map((p) => [p.id, p]));

export const paintById = (id) => BY_ID.get(id) ?? BY_ID.get(STOCK);

// A paint id from storage or the wire, or null for anything else.
export const parsePaint = (id) => (typeof id === 'string' && BY_ID.has(id) ? id : null);

// Whether a paint's there to pick, with these achievements unlocked.
export const isOpen = (paint, unlocked = []) => !paint.achievement || unlocked.includes(paint.achievement);

// The paints an achievement opens (for its toast).
export const paintsFor = (achievement) => PAINTS.filter((p) => p.achievement === achievement);
