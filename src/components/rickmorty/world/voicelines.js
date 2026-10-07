// What Dimension C-137's people say aloud, for scripts/voices to make in their
// own voices (its README: "Whose lines"): everyone Morty talks to (./say.js),
// what the portal dial's places say as he goes about them (their people's
// barks, their hunters' catches, a duel won: ./dimensions/), the street's
// walkers, and the cruiser (./ship.js). Built from those, so an edited line
// is made again.
//
// RmWorld shows a line with the speaker's name, not their voice, so it asks
// lineVoice(text) whose voice a line is in; a line that isn't anybody's
// (what Morty sees, a hiss, a gesture in brackets) has none, and stays a
// caption.

import { spoken } from '../../../lib/voiced';
import { DESTINATIONS } from './dimensions/destinations';
import { PEOPLE } from './rules';
import { ROOMS_SAY, SAY } from './say';
import { SHIP_LINES, SHIP_VOICE } from './ship';

// Each speaker's voice (lib/voiced.js), by the hotspot Morty talks to them at,
// the id they stand as, or the kind of figure in a crowd. Rick's and Morty's
// variants are Rick and Morty; a hotspot whose look quotes someone is theirs.
export const VOICE = {
  // the Smiths' house, the street, the school, the Oval Office and Shoney's
  jerry: 'jerry',
  beth: 'beth',
  summer: 'summer',
  rick: 'rick',
  president: 'uspresident',
  ovalpresident: 'uspresident',
  secretservice: 'secretservice',
  agent1: 'gromflomite',
  agent2: 'gromflomite',
  agent3: 'gromflomite',
  dineragent: 'gromflomite',
  general1: 'general',
  general2: 'general',
  principal: 'principalvagina',
  jessica: 'jessica',
  'jessica-walk': 'jessica',
  brad: 'brad',
  'brad-walk': 'brad',
  tammy: 'tammy',
  ethan: 'ethan',
  'ethan-walk': 'ethan',
  'goldenfold-walk': 'goldenfold',
  tinyrick: 'rick',
  poopybutthole: 'poopybutthole',
  spacebeth: 'beth',
  nancy: 'nancy',
  tricia: 'tricia',
  therapy: 'drwong',
  // Interdimensional Customs, Planet Squanch, Gazorpazorp, Bird World
  'customs-agent1': 'gromflomite',
  'customs-agent2': 'gromflomite',
  krombopulos: 'krombopulos',
  squanchy: 'squanchy',
  sbirdperson: 'birdperson',
  stammy: 'tammy',
  marsha: 'marsha',
  mortyjr: 'mortyjr',
  bbirdperson: 'birdperson',
  phoenixperson: 'birdperson',
  unity: 'unity',
  // Fantasy World, the Microverse, Anatomy Park, Needful Things, the Jerryboree, the Purge Planet
  fmeeseeks: 'meeseeks',
  kingjellybean: 'kingjellybean',
  zeep: 'zeep',
  kyle: 'kyle',
  xenonbloom: 'xenonbloom',
  poncho: 'poncho',
  annie: 'annie',
  needful: 'needful',
  jerryreal: 'jerry',
  receptionist: 'rick',
  jerrytv: 'jerry',
  arthricia: 'arthricia',
  // Pluto (Morty at the podium), Gear World, the Vindicators' ship, the simulation
  flippynips: 'flippynips',
  scroopy: 'scroopy',
  podium: 'morty',
  gearhead: 'gearhead',
  vance: 'vance',
  supernova: 'supernova',
  alanrails: 'alanrails',
  millionants: 'millionants',
  crocubot: 'crocubot',
  noobnoob: 'noobnoob',
  nebulon: 'nebulon',
  poptart: 'poptart',
  // the Story Train, Rick Prime's fortress, Froopyland, Mr. Nimbus, the Gromflomite base, Heist-Con
  storylord: 'storylord',
  ticketsguy: 'ticketsguy',
  primeconsole: 'rick',
  tommy: 'tommy',
  nimbus: 'nimbus',
  kmichael: 'krombopulos',
  fart: 'fart',
  miles: 'miles',
  'heister-a1': 'heister',
  'heister-b1': 'catburglar',
  // Nuptia 4, St. Gloopy Noops, the resort, the Get Schwifty show
  glexo: 'glexo',
  nbeth: 'beth',
  njerry: 'jerry',
  glipglop: 'glipglop',
  shrimply: 'shrimply',
  gjerry: 'jerry',
  reception: 'receptionist',
  risotto: 'risotto',
  poolbar: 'bartender',
  watert: 'watert',
  cromulon: 'cromulon',
  // Evil Rick's lair (the Mortys in the pods, and Evil Rick at the third), Cronenberg World, the Blood Dome
  evilrick: 'rick',
  evilmorty: 'morty',
  pod1: 'morty',
  pod3: 'rick',
  cbeth: 'beth',
  cjerry: 'jerry',
  csummer: 'summer',
  ring: 'hemorrhage',
  hemorrhage: 'hemorrhage',
  bsummer: 'summer',
  // the Federation prison (Rick, when the second switch frees him), the cable studio
  prick: 'rick',
  switch2: 'rick',
  cornvelious: 'cornvelious',
  'set-doors': 'realfakedoors',
  antsjohnson: 'antsjohnson',
  babylegs: 'babylegs',
  regularlegs: 'regularlegs',
  mrsneezy: 'mrsneezy',
  gazorpazorpfield: 'gazorpazorpfield',
  shmlo: 'shmlonathan',
  lilbits: 'lilbits',
  realfakedoors: 'realfakedoors',
  // Mr. Goldenfold's dream (Scary Terry by the bed), the agency, the golf course (a Meeseeks from the box), the vat, 35-C
  mrspancakes: 'mrspancakes',
  dgoldenfold: 'goldenfold',
  goldenfold: 'goldenfold',
  scaryterry: 'scaryterry',
  dreambed: 'scaryterry',
  jaguar: 'jaguar',
  picklerick: 'rick',
  pickle: 'rick',
  gjerry2: 'jerry',
  meeseeksbox2: 'meeseeks',
  meeseeks: 'meeseeks',
  vrick: 'rick',
  'vgromflomite-a': 'gromflomite',
  drick: 'rick',
};

// Whose voice a place's own lines are in, where someone says them aloud: its
// hunters' catch (`caught`), their seeing him (`spotted`), and its way out not
// yet (`escape.before`). (Caught on Rick Prime's watch, it's him who says “Nope.”)
export const PLACE_VOICE = {
  customs: { caught: 'gromflomite', before: 'gromflomite' },
  squanch: { caught: 'gromflomite' },
  simulation: { caught: 'zigerion' },
  fortress: { caught: 'rick' },
  nimbus: { caught: 'atlantean' },
  gromflomites: { caught: 'gromflomite' },
  blooddome: { caught: 'deathstalker' },
  prison: { spotted: 'gromflomite' },
  meeseeksgolf: { caught: 'meeseeks' },
  dim35c: { caught: 'gromflomite' },
};

// narration says what's said in quotes (lib/voiced.js's spoken)
const quoted = (text) => typeof text === 'string' && text.includes('“');

function lines() {
  const out = [];
  // (a line that's all brackets, a gesture, says nothing)
  const add = (who, text) => who && typeof text === 'string' && spoken(text) && out.push({ who, text });
  // what they say when he talks to them (what's only seen is nobody's, unless it quotes someone)
  for (const [id, l] of Object.entries(SAY)) if (l.who || quoted(l.text)) add(VOICE[id], l.text);
  add('rick', ROOMS_SAY.won.text); // (a recording of him, drunk)
  // the street's walkers, and every place's people and crowd as he goes by
  for (const p of PEOPLE) for (const t of p.ai?.bark?.lines ?? []) add(VOICE[p.id], t);
  for (const d of DESTINATIONS) {
    for (const e of d.extras) for (const t of e.ai?.bark?.lines ?? []) add(VOICE[e.kind], t);
    for (const p of [...d.people, ...d.extras.map((e) => ({ ...e, id: e.kind }))]) {
      const h = p.ai?.hunt;
      if (quoted(h?.line)) add(VOICE[p.id], h.line);
      if (quoted(h?.spotted)) add(VOICE[p.id], h.spotted);
      if (quoted(h?.duel?.won?.text)) add(VOICE[p.id], h.duel.won.text);
    }
    const v = PLACE_VOICE[d.id] ?? {};
    if (quoted(d.caught)) add(v.caught, d.caught);
    if (quoted(d.spotted)) add(v.spotted, d.spotted);
    if (quoted(d.escape?.before?.text)) add(v.before, d.escape.before.text);
  }
  return out;
}

const PEOPLES = lines();
const BY_TEXT = new Map(PEOPLES.map((l) => [l.text, l.who]));

// whose voice a line shown in a toast is in, or null if it's nobody's
export const lineVoice = (text) => BY_TEXT.get(text) ?? null;

export const VOICELINES = [...PEOPLES, ...Object.values(SHIP_LINES).flatMap((ls) => ls.map((text) => ({ who: SHIP_VOICE, text })))];
