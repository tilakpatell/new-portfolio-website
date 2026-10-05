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

// a galaxy path's system ('/galaxy/hoth' and '/galaxy/hoth/mission' are
// Hoth), or null
export function systemOfPath(pathname) {
  const m = /^\/galaxy\/([a-z0-9-]+)/.exec(pathname ?? '');
  return m && SYSTEM_NAMES[m[1]] ? m[1] : null;
}

// flying in the galaxy: at a system, or arriving at one ('/galaxy'), not
// reading a mission's briefing
export const inGalaxyFlight = (where) => where === GALAXY || /^\/galaxy\/[a-z0-9-]+$/.test(where ?? '');
