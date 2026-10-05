// The galaxy's systems by name, and nothing else: small enough for the
// site's multiplayer (online/where.js) to say "on Hoth" without bringing the
// whole galaxy (systems.js, which the tests keep in step with this) into
// every page.

export const GALAXY = '/galaxy';

export const SYSTEM_NAMES = {
  tatooine: 'Tatooine',
  hoth: 'Hoth',
  endor: 'Endor',
  yavin: 'Yavin 4',
  alderaan: 'Alderaan',
  bespin: 'Bespin',
  dagobah: 'Dagobah',
  mustafar: 'Mustafar',
  coruscant: 'Coruscant',
  naboo: 'Naboo',
  kashyyyk: 'Kashyyyk',
  kamino: 'Kamino',
  geonosis: 'Geonosis',
  scarif: 'Scarif',
  jakku: 'Jakku',
  crait: 'Crait',
  starkiller: 'Starkiller Base',
  exegol: 'Exegol',
  ahchto: 'Ahch-To',
};

// Where each system sits on the galaxy's disc, for the universe map's
// gateway (galaxy/gateway.js) to light it there: [x, z] from the galaxy's
// middle as a share of its radius (+x east, +z south, as the galaxy map has
// them; systems.js's pos, CORE and RIM, kept in step by its tests) and the
// system's own colour.
export const SYSTEM_MARKS = {
  tatooine: [0.519, 0.519, '#f0c27a'],
  hoth: [-0.148, 0.704, '#bfe1ff'],
  endor: [-0.417, 0.528, '#8fd27a'],
  yavin: [0.324, -0.398, '#9fe07a'],
  alderaan: [0.046, -0.028, '#8fc3ff'],
  bespin: [-0.111, 0.741, '#ffb79a'],
  dagobah: [0.046, 0.806, '#a8c48a'],
  mustafar: [-0.046, 0.806, '#ff8a4a'],
  coruscant: [-0.046, -0.12, '#ffd08a'],
  naboo: [0.231, 0.62, '#7fd8a8'],
  kashyyyk: [0.324, -0.12, '#b5d97a'],
  kamino: [0.602, 0.435, '#8ec7e8'],
  geonosis: [0.481, 0.565, '#ff9a6a'],
  scarif: [0.611, -0.37, '#6fe0d8'],
  jakku: [-0.611, 0.315, '#e8cf9a'],
  crait: [-0.519, 0.833, '#ff8f8a'],
  starkiller: [-0.889, -0.352, '#ff6a5a'],
  exegol: [-1, -0.056, '#c48aff'],
  ahchto: [-0.926, 0.333, '#9fd0c0'],
};

// a galaxy path's system ('/galaxy/hoth' and '/galaxy/hoth/mission' are
// Hoth), or null
export function systemOfPath(pathname) {
  const m = /^\/galaxy\/([a-z0-9-]+)/.exec(pathname ?? '');
  return m && SYSTEM_NAMES[m[1]] ? m[1] : null;
}

// flying in the galaxy: at a system, or arriving at one ('/galaxy'), not
// reading a mission's briefing
export const inGalaxyFlight = (where) => where === GALAXY || /^\/galaxy\/[a-z0-9-]+$/.test(where ?? '');
