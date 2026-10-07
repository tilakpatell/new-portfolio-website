// The galaxy's wars, one for each of its eras (systems.js's ERAS), and the
// sides that fight them, as data: the Clone Wars (the Republic against the
// Separatists), the Galactic Civil War (the Rebellion against the Empire)
// and the Remnant War (the New Republic against what's left of the Empire),
// all three fought at once on the same map (gcw.js), each a pilot can swear
// to a side in (allegiance.js). And the Hutts, in every one of them: a third
// power, nobody's side to swear to, holding Hutt space, raiding its borders,
// and losing worlds like anyone else. The design:
// docs/superpowers/specs/2026-10-07-gcw-allegiance-design.md, revision 3a.
//
// A side: { id, code (its letters in a tally key: gcw.js's pointsKey), name,
// short, colour, stance ('light' the side that liberates, 'dark' the side
// that raids, 'hutt': the crews' lines are by stance, lines.js) }.
// A war: { id, era, name, short, liberator, raider, opening: { side: [war
// systems] } } (whatever the opening doesn't name is the raider's).
// sideOfCode(code) → side id | null; warOfSide(side) → war id | null (the
// Hutts are in every war, so none).

export const SIDES = {
  republic: { id: 'republic', code: 'rep', name: 'Galactic Republic', short: 'Republic', colour: '#7fc4ff', stance: 'light' },
  separatists: { id: 'separatists', code: 'sep', name: 'Confederacy of Independent Systems', short: 'Separatists', colour: '#c9a24a', stance: 'dark' },
  rebel: { id: 'rebel', code: 'reb', name: 'Rebel Alliance', short: 'Rebellion', colour: '#ff6b4a', stance: 'light' },
  empire: { id: 'empire', code: 'imp', name: 'Galactic Empire', short: 'Empire', colour: '#8fa6c8', stance: 'dark' },
  newrepublic: { id: 'newrepublic', code: 'nr', name: 'New Republic', short: 'New Republic', colour: '#7fe8c8', stance: 'light' },
  remnant: { id: 'remnant', code: 'rem', name: 'Imperial Remnant', short: 'Remnant', colour: '#b0b8c4', stance: 'dark' },
  hutt: { id: 'hutt', code: 'hut', name: 'Hutt Cartel', short: 'Hutts', colour: '#9bbf5a', stance: 'hutt' },
};

export const WARS = {
  clone: {
    id: 'clone',
    era: 'republic',
    name: 'The Clone Wars',
    short: 'Clone Wars',
    liberator: 'republic',
    raider: 'separatists',
    opening: { republic: ['coruscant', 'kamino', 'naboo', 'kashyyyk', 'lothal', 'sorgan'], hutt: ['tatooine', 'nevarro'] },
  },
  gcw: {
    id: 'gcw',
    era: 'empire',
    name: 'The Galactic Civil War',
    short: 'Civil War',
    liberator: 'rebel',
    raider: 'empire',
    opening: { rebel: ['yavin', 'hoth', 'lothal', 'kashyyyk', 'sorgan'], hutt: ['tatooine', 'nevarro'] },
  },
  remnant: {
    id: 'remnant',
    era: 'newrepublic',
    name: 'The Remnant War',
    short: 'Remnant War',
    liberator: 'newrepublic',
    raider: 'remnant',
    opening: { newrepublic: ['coruscant', 'yavin', 'hoth', 'endor', 'naboo', 'kashyyyk', 'kamino', 'lothal', 'sorgan', 'bespin'], hutt: ['tatooine', 'nevarro'] },
  },
};
export const WAR_IDS = Object.keys(WARS);
export const DEFAULT_WAR = 'gcw';

const BY_CODE = Object.fromEntries(Object.values(SIDES).map((s) => [s.code, s.id]));
export const sideOfCode = (code) => BY_CODE[code] ?? null;
export const warOfSide = (side) => Object.values(WARS).find((w) => w.liberator === side || w.raider === side)?.id ?? null;
// the side of a war that's the other one (the Hutts have no other)
export const otherSide = (side) => {
  const w = WARS[warOfSide(side)];
  return w ? (w.liberator === side ? w.raider : w.liberator) : null;
};
