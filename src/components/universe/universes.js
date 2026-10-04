// The nine fandoms on the universe map, in map order (the order Home always
// showed them in). Pure data: the map, the mini-map, the world pages' links
// and the guide all read this list.
//
//   label    the fandom, as the map names it
//   world    the world page's own name, or null when it isn't a world page
//   to       where Enter goes
//   swatch   the planet's colour on the mini-map and its label
//   accent   the page accent while it's selected (4.5:1 on #03040a)
//   size     the planet's radius in map units
//   palette  the colours its procedural planet is painted in

export const UNIVERSES = [
  {
    id: 'starwars',
    label: 'Star Wars',
    world: 'Death Star',
    to: '/deathstar',
    swatch: '#ffe81f',
    accent: '#ffe81f',
    size: 0.78,
    palette: { base: '#8d939c', dark: '#3a3f47', light: '#c9ced6', glow: '#7dff7a' },
  },
  {
    id: 'music',
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
    label: 'The Office',
    world: 'Scranton',
    to: '/scranton',
    swatch: '#e9e4d6',
    accent: '#e9e4d6',
    size: 0.58,
    palette: { base: '#f1eee4', dark: '#9aa7b8', light: '#ffffff', glow: '#d23b3b' },
  },
  {
    id: 'gaming',
    label: 'Gaming',
    world: null,
    to: '/projects/gameboy-emulator',
    swatch: '#9bbc0f',
    accent: '#9bbc0f',
    size: 0.56,
    palette: { base: '#8bac0f', dark: '#0f380f', light: '#9bbc0f', glow: '#306230' },
  },
  {
    id: 'travel',
    label: 'Travel',
    world: null,
    to: '/travel',
    swatch: '#5cb8ff',
    accent: '#5cb8ff',
    size: 0.68,
    palette: { base: '#1f5f99', dark: '#0d2a47', light: '#5f9e5a', glow: '#5cb8ff' },
  },
];

const BY_ID = new Map(UNIVERSES.map((u) => [u.id, u]));

export const byId = (id) => BY_ID.get(id);

// The universe a page belongs to: '/deathstar' → starwars, '/universe/x' → none.
export const byPath = (pathname) => UNIVERSES.find((u) => u.to === pathname);

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
