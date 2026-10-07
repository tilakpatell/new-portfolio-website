// What the people down on the worlds say aloud, for scripts/voices to make
// in their own voices (its README, "Whose lines"): what each says when you
// talk to them (a site's life, actors.js's `says`), and the quests' and
// missions' lines (scene.js's `say`: [who, text], `who` a display name). The
// page says each through voiceFor, so a name here is a voice there too.

import { spoken } from '../../../lib/voiced';
import { SITES } from './sites';
import { EXTRA } from './sites/quests';
import { MISSIONS } from './missions';

// The voice each name down here speaks in. A named character has their own
// (the films' and shows' actors: Obi-Wan on Mustafar is Ewan McGregor's,
// `ben` Alec Guinness's); the soldiers and the townsfolk share one for their
// kind. Not here, so with no voice: whoever doesn't speak Basic (Wookiees,
// Ewoks, Jawas, Huttese), the droids that beep, the beasts and the walkers.
// A person whose name is another's voice says so with their own `voice`
// (actors.js): Obi-Wan's ghost on Dagobah is Ben's, Boba on Kamino a boy.
export const NAMES = {
  // the films' and shows' own
  'C-3PO': 'threepio',
  Yoda: 'yoda',
  'Darth Vader': 'vader',
  'Ben Kenobi': 'ben',
  'Obi-Wan Kenobi': 'obiwan',
  Luke: 'luke',
  'Luke Skywalker': 'luke',
  Leia: 'leia',
  'Lando Calrissian': 'lando',
  'Owen Lars': 'owen',
  'Biggs Darklighter': 'biggs',
  Camie: 'camie',
  Wuher: 'wuher',
  'Dr. Evazan': 'evazan',
  'Bib Fortuna': 'bibfortuna',
  'Boba Fett': 'bobafett',
  'Jango Fett': 'jango',
  Anakin: 'anakin',
  'Anakin Skywalker': 'anakin',
  Padmé: 'padme',
  'Padmé Amidala': 'padme',
  'Qui-Gon Jinn': 'quigon',
  'Mace Windu': 'mace',
  'Count Dooku': 'dooku',
  'Jar Jar Binks': 'jarjar',
  'Boss Nass': 'bossnass',
  'Captain Tarpals': 'tarpals',
  'Captain Panaka': 'panaka',
  'Nute Gunray': 'nute',
  'Dexter Jettster': 'dexter',
  'Elan Sleazebaggano': 'elan',
  'Taun We': 'taunwe',
  'Lama Su': 'lamasu',
  'General Rieekan': 'rieekan',
  'Toryn Farr': 'torynfarr',
  'General Dodonna': 'dodonna',
  'Director Krennic': 'krennic',
  'Jyn Erso': 'jyn',
  'Cassian Andor': 'cassian',
  'K-2SO': 'k2so',
  'Chirrut Îmwe': 'chirrut',
  'Baze Malbus': 'baze',
  'The Mandalorian': 'mando',
  'Greef Karga': 'greef',
  'The Armorer': 'armorer',
  'IG-11': 'ig11',
  Omera: 'omera',
  'Ahsoka Tano': 'ahsoka',
  'Shin Hati': 'shinhati',
  'Governor Azadi': 'azadi',
  // the Empire's troopers, whatever the armour
  Stormtrooper: 'stormtrooper',
  Sandtrooper: 'stormtrooper',
  'Scout trooper': 'stormtrooper',
  Snowtrooper: 'stormtrooper',
  Shoretrooper: 'stormtrooper',
  'Remnant stormtrooper': 'stormtrooper',
  // the Republic's clones (Gree too, and the AT-RT's rider)
  'Clone trooper': 'clonetrooper',
  'Clone commander': 'clonetrooper',
  'Clone cadet': 'clonetrooper',
  'Commander Gree': 'clonetrooper',
  'Coruscant Guard': 'clonetrooper',
  'AT-RT': 'clonetrooper',
  'Battle droid': 'battledroid',
  // the Rebellion's soldiers and crews, and its pilots (and Naboo's)
  'Rebel trooper': 'rebeltrooper',
  'Rebel commando': 'rebeltrooper',
  'Rebel technician': 'rebeltrooper',
  'Rebel sentry': 'rebeltrooper',
  'Rebel scout': 'rebeltrooper',
  'A Rebel scout': 'rebeltrooper',
  'Rebel guard': 'rebeltrooper',
  'General Solo’s strike team': 'rebeltrooper',
  Pathfinder: 'rebeltrooper',
  'Echo Base': 'rebeltrooper',
  'Echo Base crew': 'rebeltrooper',
  'Deck officer': 'rebeltrooper',
  Loadmaster: 'rebeltrooper',
  Controller: 'rebeltrooper',
  Medic: 'rebeltrooper',
  'Tauntaun handler': 'rebeltrooper',
  'X-wing pilot': 'rebelpilot',
  'Rogue Group pilot': 'rebelpilot',
  'Rogue Two': 'rebelpilot',
  'Gold Squadron pilot': 'rebelpilot',
  'Bravo Squadron pilot': 'rebelpilot',
  // the Jedi with no name, the Gungans, the Kaminoans, the guards
  Jedi: 'jedi',
  'Jedi Knight': 'jedi',
  'A Jedi Master': 'jedi',
  Gungan: 'gungan',
  'Gungan soldier': 'gungan',
  Kaminoan: 'kaminoan',
  'Wing Guard': 'cityguard',
  'Palace guard': 'cityguard',
  'Senate Guard': 'cityguard',
  // the townsfolk: the Rim's farms and ports, and the Core's cities
  'A farmhand': 'rimlocal',
  Haulier: 'rimlocal',
  'Mos Eisley local': 'rimlocal',
  'Anchorhead local': 'rimlocal',
  'Twi’lek spacer': 'rimlocal',
  'A Sullustan pilot': 'rimlocal',
  'A courtier': 'rimlocal',
  'Bounty hunter': 'rimlocal',
  'The barkeep': 'rimlocal',
  'A Twi’lek hunter': 'rimlocal',
  'Nevarro local': 'rimlocal',
  'Lothal farmer': 'rimlocal',
  'Krill farmer': 'rimlocal',
  'Naboo farmer': 'rimlocal',
  'A kaadu herder': 'rimlocal',
  'Theed citizen': 'corecitizen',
  'Senate aide': 'corecitizen',
  Coruscanti: 'corecitizen',
  Commuter: 'corecitizen',
  'Cloud City citizen': 'corecitizen',
};

const named = (who) => (typeof who === 'string' && Object.hasOwn(NAMES, who) ? NAMES[who] : null);

// Who says a line down here, as the voice it's made in: a person by their
// name, a crew by their own id (luke, han, rick…: lib/voiced.js says who has
// none), anyone else none.
export const voiceFor = (who) => named(who) ?? (typeof who === 'string' && /^[a-z0-9]+$/.test(who) ? who : null);

// every world's people (and the ones in its zones, and quests.js's), and its quests
function worlds() {
  return Object.keys(SITES).map((id) => ({
    life: [...(SITES[id].life ?? []), ...(SITES[id].zones ?? []).flatMap((z) => z.life ?? []), ...(EXTRA[id]?.life ?? [])],
    quests: [...(SITES[id].quests ?? []), ...(EXTRA[id]?.quests ?? [])],
  }));
}

export function surfaceLines(places = worlds(), missions = MISSIONS) {
  const found = new Map();
  const add = (voice, text) => {
    if (voice && typeof text === 'string' && spoken(text)) found.set(`${voice}|${text}`, { who: voice, text });
  };
  // a quest's or a mission's lines, wherever they are in it: [who, text] by name
  const walk = (v) => {
    if (Array.isArray(v)) {
      if (v.length === 2 && typeof v[1] === 'string' && named(v[0])) add(named(v[0]), v[1]);
      else v.forEach(walk);
    } else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  for (const { life, quests } of places) {
    for (const spec of life) {
      // (a line on its own is theirs, in their voice; [who, text] someone else's)
      for (const line of spec.says ?? []) {
        if (Array.isArray(line)) walk(line);
        else add(spec.voice ?? named(spec.name), line);
      }
      // (someone with nothing else to say, once you've done what they asked: scene.js says it as [name, text])
      if (spec.quest && !spec.says?.length) add(named(spec.name), 'Thanks again.');
    }
    walk(quests);
  }
  walk(missions);
  return [...found.values()];
}

export const VOICELINES = surfaceLines();
