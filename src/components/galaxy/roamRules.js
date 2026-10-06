// Whose galaxy you fly in, system by system: the side a star system is on
// (universe/sides.js's shape, so universe/director.js can run the galaxy as
// it runs the universe map), from who holds it (systems.js's `faction`:
// the Empire, the Separatists, the Imperial remnant, or nobody). Pure, so
// it's tested in Node; galaxy/roam.js wraps the director with it.
//
// The Empire's worlds: TIEs by the pack with Vader among them, a Star
// Destroyer now and then launching bombers and a gunboat, the bounty hunters
// (Fett, IG-88, Bossk, Dengar) after you alone. The remnant's: Moff
// Gideon's TIEs, his cruiser as the capital ship, and Fett (the only one of
// the four still at it). The Separatists': vulture droids and tri-fighters,
// no capital ship (the Confederacy's are a battle, not a drop-in), no bounty
// hunters. Nobody's (Dagobah, Alderaan's rubble, Sorgan): nothing hunts
// you, but a bounty hunter can still find you. Everywhere: Weequay pirates
// (Hondo's gang) after whoever's in distress, and the purrgil passing.
//
// galaxySide(sys) → side | null (null without a system), the same object
//   for the same faction, so a scene can keep what it built for one.
// ROAM_EVENTS: the director's events the galaxy plays now (Phase 1,
//   "Outlaws": the hunt, the Star Destroyer and the bounty hunter).

import { EVENTS } from '../universe/director';
import { SIDES } from '../universe/sides';
import { FACTIONS as GALAXY_FACTIONS, KINDS as GALAXY_KINDS, NAMES as GALAXY_NAMES } from './hunted';

const SW = SIDES.starwars;
const NO_HUNT = Object.freeze([]);

export const ROAM_EVENTS = Object.freeze({ hunt: EVENTS.hunt, destroyer: EVENTS.destroyer, bounty: EVENTS.bounty });

// each faction's factions by role (the galaxy's hunted.js rows, which carry
// the universe map's Empire and bounty hunters)
const ROLES = {
  empire: { hunt: ['empire'], capital: 'navy', capitalShip: 'destroyer', bounty: ['fett', 'ig88', 'bossk', 'dengar'], pieces: ['destroyer'] },
  remnant: { hunt: ['remnant'], capital: 'navy', capitalShip: 'destroyer', bounty: ['fett'], pieces: ['destroyer'] },
  separatists: { hunt: ['separatists'], capital: null, capitalShip: null, bounty: NO_HUNT, pieces: [] },
  none: { hunt: NO_HUNT, capital: null, capitalShip: null, bounty: ['fett', 'bossk', 'dengar'], pieces: [] },
};
const LABELS = { empire: 'The Empire’s space', remnant: 'The Imperial remnant’s space', separatists: 'The Separatists’ space', none: 'Open space' };

const make = (key) => {
  const r = ROLES[key];
  const factions = {};
  const add = (id, role) => {
    const f = GALAXY_FACTIONS[id];
    if (!f) throw new Error(`galaxy side: no faction ${id}`);
    factions[id] = { ...f, role, weight: f.weight ?? 1, family: 'starwars' };
  };
  for (const id of r.hunt) add(id, 'hunt');
  if (r.capital) add(r.capital, 'capital');
  for (const id of r.bounty) add(id, 'bounty');
  add('weequay', 'pirates');
  const roles = new Set(Object.values(factions).map((f) => f.role));
  const side = {
    id: `galaxy-${key}`,
    label: LABELS[key],
    crews: [], // (every crew flies here: a crew's side is the universe map's, this is the system's)
    factions,
    kinds: GALAXY_KINDS,
    names: GALAXY_NAMES,
    allies: SW.allies,
    traffic: SW.traffic,
    civil: SW.civil,
    convoy: SW.convoy,
    distress: SW.distress,
    skirmish: r.hunt.length ? { ...SW.skirmish, faction: r.hunt[0] } : null,
    pieces: r.pieces,
    capital: r.capital,
    capitalShip: r.capitalShip,
    leviathan: SW.leviathan,
    troops: SW.troops,
    squads: SW.squads,
    ahead: {},
    has: (need) => roles.has(need) || r.pieces.includes(need) || (need === 'pirates' && Boolean(SW.distress.pirates)) || (need === 'leviathan' && Boolean(SW.leviathan)),
  };
  return Object.freeze(side);
};
const BY_FACTION = { empire: make('empire'), remnant: make('remnant'), separatists: make('separatists'), none: make('none') };

export const galaxySide = (sys) => (sys ? (BY_FACTION[sys.faction ?? 'none'] ?? BY_FACTION.none) : null);
export const GALAXY_SIDES = BY_FACTION;
