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
// systems] } (whatever the opening doesn't name is the raider's), capitals:
// { side: war system } (where each power's supply lines run from, with its
// strongholds: gcwAI.js) }.
// DOCTRINE: { side: { worth, weak, cut, area, jitter, every? } }, what each
// side looks for in a target (gcwAI.js weighs a target by them).
// sideOfCode(code) → side id | null; warOfSide(side) → war id | null (the
// Hutts are in every war, so none).

export const SIDES = {
  republic: { id: 'republic', code: 'rep', name: 'Galactic Republic', short: 'Republic', colour: '#7fc4ff', stance: 'light' },
  separatists: { id: 'separatists', code: 'sep', name: 'Confederacy of Independent Systems', short: 'Separatists', colour: '#c9a24a', stance: 'dark' },
  rebel: { id: 'rebel', code: 'reb', name: 'Rebel Alliance', short: 'Rebellion', colour: '#ff6b4a', stance: 'light' },
  empire: { id: 'empire', code: 'imp', name: 'Galactic Empire', short: 'Empire', colour: '#62e08a', stance: 'dark' },
  newrepublic: { id: 'newrepublic', code: 'nr', name: 'New Republic', short: 'New Republic', colour: '#7fe8c8', stance: 'light' },
  remnant: { id: 'remnant', code: 'rem', name: 'Imperial Remnant', short: 'Remnant', colour: '#b0b8c4', stance: 'dark' },
  hutt: { id: 'hutt', code: 'hut', name: 'Hutt Cartel', short: 'Hutts', colour: '#b98ae6', stance: 'hutt' }, // (violet: green was the Empire's)
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
    capitals: { republic: 'coruscant', separatists: 'geonosis', hutt: 'tatooine' },
  },
  gcw: {
    id: 'gcw',
    era: 'empire',
    name: 'The Galactic Civil War',
    short: 'Civil War',
    liberator: 'rebel',
    raider: 'empire',
    opening: { rebel: ['yavin', 'hoth', 'lothal', 'kashyyyk', 'sorgan'], hutt: ['tatooine', 'nevarro'] },
    capitals: { rebel: 'yavin', empire: 'coruscant', hutt: 'tatooine' },
  },
  remnant: {
    id: 'remnant',
    era: 'newrepublic',
    name: 'The Remnant War',
    short: 'Remnant War',
    liberator: 'newrepublic',
    raider: 'remnant',
    opening: { newrepublic: ['coruscant', 'yavin', 'hoth', 'endor', 'naboo', 'kashyyyk', 'kamino', 'lothal', 'sorgan', 'bespin'], hutt: ['tatooine', 'nevarro'] },
    capitals: { newrepublic: 'coruscant', remnant: 'mandalore', hutt: 'tatooine' },
  },
};
export const WAR_IDS = Object.keys(WARS);

// What each side looks for in a target, as weights on what it's worth
// (worth), how far its hold's gone already (weak), how many of its holder's
// systems taking it would cut off from their capital (cut), and whether it
// makes an area whole (area); jitter is how much it leaves to chance, and
// every how soon it goes again (a share of the war's own pace: the droid
// armies never tire). The Republic and the Empire go for what's worth most,
// the Rebellion and the Hutts for what's falling already, the New Republic
// for whole areas, the Remnant for what's worth most and hit often.
export const DOCTRINE = {
  republic: { worth: 3, weak: 1, cut: 1, area: 1, jitter: 1 },
  separatists: { worth: 1, weak: 2, cut: 1, area: 0.5, jitter: 1.5, every: 0.8 },
  rebel: { worth: 1, weak: 3, cut: 0.5, area: 1, jitter: 1.5 },
  empire: { worth: 3, weak: 1, cut: 2, area: 1, jitter: 0.5 },
  newrepublic: { worth: 2, weak: 1, cut: 1, area: 2, jitter: 1 },
  remnant: { worth: 3, weak: 2, cut: 1, area: 0, jitter: 1, every: 0.9 },
  hutt: { worth: 0.5, weak: 4, cut: 0, area: 0, jitter: 1 },
};
export const DEFAULT_WAR = 'gcw';

const BY_CODE = Object.fromEntries(Object.values(SIDES).map((s) => [s.code, s.id]));
export const sideOfCode = (code) => BY_CODE[code] ?? null;
export const warOfSide = (side) => Object.values(WARS).find((w) => w.liberator === side || w.raider === side)?.id ?? null;
// the side of a war that's the other one (the Hutts have no other)
export const otherSide = (side) => {
  const w = WARS[warOfSide(side)];
  return w ? (w.liberator === side ? w.raider : w.liberator) : null;
};

// The areas the wars are fought over, a few systems each (systems.js's
// `war.area`): held whole by one side, an area is its, and its fronts and
// attacks next to it go faster (gcwRules.js's areaBonusOf). The atlas's rings
// would put nearly every world in the war in the Outer Rim, so these are
// the films' own neighbourhoods instead.
export const AREAS = [
  { id: 'core', name: 'The Core and Kashyyyk' },
  { id: 'north', name: 'The Northern Rim' },
  { id: 'arkanis', name: 'Arkanis and Chommell' },
  { id: 'anoat', name: 'Anoat and Atravis' },
  { id: 'western', name: 'The Western Reaches' },
];
