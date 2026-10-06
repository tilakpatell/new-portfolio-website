// Everywhere on the universe map, in map order: the site's own pages first,
// as stations round the sun in the middle (kind 'core'), then the ten
// fandoms as planets further out, in the order Home always showed them.
// Pure data: the map, the mini-map, the world pages' links and the guide all
// read this list.
//
//   label    as the map names it
//   kind     'core' (a station) or 'fandom' (a planet)
//   world    the world page's own name, or null when it isn't a world page
//   pages    more world pages of its own, inside it ({ to, world })
//   crashTo  where flying into it too fast takes you, if not `to`
//   go       how going there reads with a ship ('Jump to'), if not landing
//   place    what you land on or dock at, for the panel's button
//   to       where it goes
//   swatch   its colour on the mini-map and its label
//   accent   the page accent while it's selected (4.5:1 on #03040a)
//   rim      the glow round its edge, when that isn't the swatch
//   size     its radius, before the scale below (stations and planets are
//            drawn bigger than their numbers here, by STATION and PLANET)
//   sign     a station's big sign: its name, and a line under it
//   palette  the colours it's painted in
//   air      a fandom planet's atmosphere (lib/three/atmosphere.js's shell):
//            { colour, density, top (its edge, in radii), sunset }, or null
//            for none (the Office's paper, the Game Boy's screen)

// how much bigger than its size number each kind is drawn, in map units:
// the planets huge against the ship (0.26 long: 360 to 450 of it across)
// and about four times a station across, the stations dwarfing it too (80
// to 97 ship lengths). The 3s are scale.js's HOME_SCALE and WORLD_SCALE,
// written out: this file has no imports, so the prerender
// (scripts/prerender.mjs) can load it in Node as it is; scale.test.js fails
// if they differ. The Star Wars gate keeps its own size (GATE): it's a
// gate, not a world, and the galaxy behind it is sized to it.
const STATION = 7 * 3;
const PLANET = 28 * 3;
const GATE = 28;

const CORE = [
  {
    id: 'home',
    sign: ['HOME', 'Who I am, and what I do'],
    label: 'Home',
    place: 'Home',
    to: '/home',
    swatch: '#ffd27a',
    accent: '#ffd27a',
    size: 0.6,
    palette: { base: '#e9e4d8', dark: '#4a4f5a', light: '#ffffff', glow: '#ffd27a' },
  },
  {
    id: 'experience',
    sign: ['EXPERIENCE', 'Six roles, AWS to SRC'],
    label: 'Experience',
    place: 'Experience',
    to: '/experience',
    swatch: '#ffa94d',
    accent: '#ffa94d',
    size: 0.58,
    palette: { base: '#c9ccd3', dark: '#3c4048', light: '#f1f2f5', glow: '#ffa94d' },
  },
  {
    id: 'projects',
    sign: ['PROJECTS', 'The Game Boy emulator and more'],
    label: 'Projects',
    place: 'Projects',
    to: '/projects',
    swatch: '#6fd3ff',
    accent: '#6fd3ff',
    size: 0.6,
    palette: { base: '#9aa6b8', dark: '#2a3140', light: '#d6e2f2', glow: '#6fd3ff' },
  },
  {
    id: 'resume',
    sign: ['RÉSUMÉ', 'One page, as a PDF'],
    label: 'Résumé',
    place: 'the Résumé',
    to: '/resume',
    swatch: '#c7b8ff',
    accent: '#c7b8ff',
    size: 0.52,
    palette: { base: '#f3f1fa', dark: '#3a3550', light: '#ffffff', glow: '#c7b8ff' },
  },
  {
    id: 'contact',
    sign: ['CONTACT', 'Say hello'],
    label: 'Contact',
    place: 'Contact',
    to: '/contact',
    swatch: '#ff8fb8',
    accent: '#ff8fb8',
    size: 0.56,
    palette: { base: '#b9bec8', dark: '#353a44', light: '#eef0f4', glow: '#ff8fb8' },
  },
  {
    id: 'terminal',
    sign: ['TERMINAL', 'The whole site as a shell'],
    label: 'Terminal',
    place: 'the Terminal',
    to: '/terminal',
    swatch: '#7dff9a',
    accent: '#7dff9a',
    size: 0.52,
    palette: { base: '#1d2128', dark: '#0b0d10', light: '#3a404a', glow: '#7dff9a' },
  },
].map((u) => ({ ...u, size: u.size * STATION, kind: 'core', world: null }));

const FANDOMS = [
  {
    id: 'starwars',
    label: 'Star Wars',
    // a universe of its own: not a planet but the way into one, the galaxy
    // itself in miniature behind a hyperspace gate (galaxy/gateway.js); fly
    // into the gate, or pick it and go, and you jump to lightspeed into the
    // whole galaxy (galaxy/), the Death Star a page of its own inside it
    world: 'A galaxy far, far away',
    place: 'a galaxy far, far away',
    go: 'Jump to', // (not somewhere to land on)
    to: '/galaxy',
    pages: [{ to: '/deathstar', world: 'Death Star' }],
    portal: true, // (flown into, it's through, not a crash: universe/scene.js)
    swatch: '#ffe81f',
    accent: '#ffe81f',
    rim: '#7fc8ff', // the gate's blue
    size: 5.36, // the gate's radius (the galaxy behind it a few times that)
    reach: 1.45, // (where it counts as being at it: in front of the gate)
    airless: true, // no air glowing round it: it's a gate
    palette: { base: '#1a2440', dark: '#0a1020', light: '#bfe3ff', glow: '#7fc8ff' },
  },
  {
    id: 'music',
    air: { colour: '#ffb060', density: 1.2, top: 1.05 },
    label: 'Indian classical music',
    world: 'Music room',
    to: '/music',
    swatch: '#ff9933',
    accent: '#ff9933',
    size: 0.62,
    palette: { base: '#e07a1f', dark: '#7a3a0c', light: '#ffc27a', glow: '#ffe2a8' },
  },
  {
    id: 'middleearth',
    air: { colour: '#9fc4ff', density: 1.8, top: 1.05, sunset: '#ffb070' },
    label: 'The Lord of the Rings',
    world: 'Middle-earth',
    to: '/middle-earth',
    swatch: '#d9b45a',
    accent: '#d9b45a',
    size: 0.66,
    palette: { base: '#5f7a3a', dark: '#2c3b1c', light: '#b9b06a', glow: '#ff8a2a' },
  },
  {
    id: 'transformers',
    air: { colour: '#a98cff', density: 0.9, top: 1.04 },
    label: 'Transformers',
    world: 'Cybertron',
    to: '/cybertron',
    swatch: '#a48cff',
    accent: '#a48cff',
    size: 0.7,
    palette: { base: '#4a5160', dark: '#1d2129', light: '#8a93a6', glow: '#7fd8ff' },
  },
  {
    id: 'marvel',
    air: { colour: '#ffd27a', density: 1.4, top: 1.05 },
    label: 'Marvel',
    world: 'Avengers HQ',
    to: '/avengers',
    swatch: '#ff5a5a',
    accent: '#ff5a5a',
    size: 0.64,
    palette: { base: '#c9a03a', dark: '#7a1f1f', light: '#f2d27a', glow: '#ffd76a' },
  },
  {
    id: 'breakingbad',
    air: { colour: '#ffd9a8', density: 1.6, top: 1.045, sunset: '#ff8a50' },
    label: 'Breaking Bad',
    world: 'Albuquerque',
    to: '/albuquerque',
    swatch: '#5fe0d0',
    accent: '#5fe0d0',
    size: 0.6,
    palette: { base: '#c98f52', dark: '#7a4a24', light: '#e8c08a', glow: '#6fd8ff' },
  },
  {
    id: 'office',
    air: null, // (paper has no air: it keeps its soft rim)
    label: 'The Office',
    world: 'Scranton',
    to: '/scranton',
    swatch: '#e9e4d6',
    accent: '#e9e4d6',
    rim: '#7f8aa0', // the paper's own white would glare
    size: 0.58,
    palette: { base: '#f1eee4', dark: '#9aa7b8', light: '#ffffff', glow: '#d23b3b' },
  },
  {
    id: 'rickmorty',
    air: { colour: '#b8ff5a', density: 2.0, top: 1.05 },
    label: 'Rick and Morty',
    world: 'Dimension C-137',
    to: '/c-137',
    swatch: '#97ce4c',
    accent: '#97ce4c',
    size: 0.6,
    palette: { base: '#6f4fa8', dark: '#2a1a4a', light: '#c7a6ff', glow: '#b6f04a' },
  },
  {
    id: 'gaming',
    air: null, // (a Game Boy's screen has no air: its pixel clouds and rim do)
    label: 'Gaming',
    world: 'Dot Matrix',
    place: 'Dot Matrix island',
    to: '/dot-matrix',
    pages: [{ to: '/dot-matrix/64', world: 'Super Mario 64' }],
    swatch: '#9bbc0f',
    accent: '#9bbc0f',
    rim: '#6f9a1c', // the screen's lightest green would glare as air
    size: 0.56,
    palette: { base: '#8bac0f', dark: '#0f380f', light: '#9bbc0f', glow: '#306230' },
  },
  {
    id: 'travel',
    air: { colour: '#8fc1ff', density: 2.2, top: 1.05 },
    label: 'Travel',
    world: 'Earth',
    place: 'Earth',
    to: '/earth',
    swatch: '#5cb8ff',
    accent: '#5cb8ff',
    size: 0.68,
    palette: { base: '#1f5f99', dark: '#0d2a47', light: '#5f9e5a', glow: '#5cb8ff' },
  },
  {
    id: 'caribbean',
    air: { colour: '#bfe4ff', density: 2.4, top: 1.055 },
    label: 'Pirates of the Caribbean',
    world: 'The Caribbean',
    to: '/caribbean',
    swatch: '#e9b949',
    accent: '#f2c45a',
    size: 0.62,
    palette: { base: '#0f6b70', dark: '#06323a', light: '#e9d9a6', glow: '#f2c45a' },
  },
  {
    id: 'invincible',
    air: { colour: '#ffc9a0', density: 2.8, top: 1.06 },
    label: 'Invincible',
    world: 'Invincible',
    place: 'the Graysons’ city',
    to: '/invincible',
    swatch: '#ffd23a',
    accent: '#ffd23a',
    rim: '#e8743a', // Viltrum's own air, not the suit's yellow
    size: 0.64,
    palette: { base: '#a8482a', dark: '#4a1a10', light: '#e6a05a', glow: '#ffd23a' },
  },
].map((u) => ({ ...u, size: u.size * (u.portal ? GATE : PLANET), kind: 'fandom', place: u.place ?? u.world }));

export const UNIVERSES = [...CORE, ...FANDOMS];

const BY_ID = new Map(UNIVERSES.map((u) => [u.id, u]));

export const byId = (id) => BY_ID.get(id);

// The universe a page belongs to: '/galaxy' and '/deathstar' → starwars, '/universe/x' → none.
export const byPath = (pathname) => UNIVERSES.find((u) => u.to === pathname || u.pages?.some((p) => p.to === pathname));

// WCAG contrast ratio between two '#rrggbb' colours.
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
